const { supabase } = require('../../_lib/supabase');
const { isAuthorized } = require('../../_lib/admin-auth');
const { applyCors } = require('../../_lib/cors');
const { logAdminAction } = require('../../_lib/admin-audit');
const { validateName, validateEmail, validatePhone, normalizeEmail, isDisposableEmail, withinMaxLength, MAX_LENGTHS } = require('../../_lib/auth-validators');
const { isValidGradeLevel, gradeLabel } = require('../../_lib/grade-access');

function cleanText(value) {
  return String(value == null ? '' : value).trim();
}

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  const auth = await isAuthorized(req);
  if (!auth.ok) return res.status(401).json({ error: 'مش معاك صلاحية' });

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('students')
      .select('id, first_name, last_name, phone, parent_phone, grade_level, email, phone_verified, is_active, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(5000);

    if (error) return res.status(500).json({ error: 'تعذر تحميل الطلاب' });
    return res.status(200).json({ students: data || [] });
  }

  if (req.method === 'PUT') {
    const id = cleanText(req.body?.id);
    if (!id) return res.status(400).json({ error: 'id مطلوب' });

    const { data: current, error: currentError } = await supabase
      .from('students')
      .select('id, first_name, last_name, phone, parent_phone, grade_level, email, phone_verified, is_active')
      .eq('id', id)
      .maybeSingle();
    if (currentError) return res.status(500).json({ error: 'تعذر تحميل الطالب' });
    if (!current) return res.status(404).json({ error: 'الطالب مش موجود' });

    const update = {};

    if (req.body?.first_name !== undefined) {
      const value = cleanText(req.body.first_name);
      if (!withinMaxLength(value, MAX_LENGTHS.name) || !validateName(value)) return res.status(400).json({ error: 'الاسم الأول غير صحيح' });
      update.first_name = value;
    }
    if (req.body?.last_name !== undefined) {
      const value = cleanText(req.body.last_name);
      if (!withinMaxLength(value, MAX_LENGTHS.name) || !validateName(value)) return res.status(400).json({ error: 'الاسم الأخير غير صحيح' });
      update.last_name = value;
    }
    if (req.body?.phone !== undefined) {
      const value = cleanText(req.body.phone);
      if (!validatePhone(value)) return res.status(400).json({ error: 'رقم الطالب غير صحيح' });
      const { data: duplicate, error: duplicateError } = await supabase
        .from('students').select('id').eq('phone', value).neq('id', id).limit(1).maybeSingle();
      if (duplicateError) return res.status(500).json({ error: 'تعذر التحقق من رقم الطالب' });
      if (duplicate) return res.status(409).json({ error: 'رقم الطالب مسجل لحساب تاني' });
      update.phone = value;
      if (value !== current.phone) update.phone_verified = false;
    }
    if (req.body?.parent_phone !== undefined) {
      const value = cleanText(req.body.parent_phone);
      if (!validatePhone(value)) return res.status(400).json({ error: 'رقم ولي الأمر غير صحيح' });
      update.parent_phone = value;
    }
    if (req.body?.grade_level !== undefined) {
      const value = cleanText(req.body.grade_level);
      if (!isValidGradeLevel(value)) return res.status(400).json({ error: 'اختار أولى ثانوي أو ثانية ثانوي' });
      update.grade_level = value;
    }
    if (req.body?.email !== undefined) {
      const value = normalizeEmail(req.body.email);
      if (!withinMaxLength(value, MAX_LENGTHS.email) || !validateEmail(value) || isDisposableEmail(value)) return res.status(400).json({ error: 'الإيميل غير صحيح' });
      const { data: duplicate, error: duplicateError } = await supabase
        .from('students').select('id').eq('email', value).neq('id', id).limit(1).maybeSingle();
      if (duplicateError) return res.status(500).json({ error: 'تعذر التحقق من الإيميل' });
      if (duplicate) return res.status(409).json({ error: 'الإيميل مسجل لحساب تاني' });
      update.email = value;
    }
    if (req.body?.is_active !== undefined) update.is_active = req.body.is_active === true;

    if (!Object.keys(update).length) return res.status(400).json({ error: 'مفيش بيانات للتعديل' });
    update.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('students')
      .update(update)
      .eq('id', id)
      .select('id, first_name, last_name, phone, parent_phone, grade_level, email, phone_verified, is_active, created_at, updated_at')
      .single();
    if (error) return res.status(500).json({ error: 'تعذر حفظ بيانات الطالب' });

    await logAdminAction(auth.identity, 'update_student', {
      student_id: id,
      changed_fields: Object.keys(update).filter((key) => key !== 'updated_at'),
      grade_level: data.grade_level,
      grade_label: gradeLabel(data.grade_level),
      is_active: data.is_active,
    });
    return res.status(200).json({ student: data });
  }

  // DELETE is intentionally a safe archive, not a destructive database delete.
  // This preserves quiz history and lets the admin reactivate the student later.
  if (req.method === 'DELETE') {
    const id = cleanText(req.query?.id || req.body?.id);
    if (!id) return res.status(400).json({ error: 'id مطلوب' });
    const { data, error } = await supabase
      .from('students')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, first_name, last_name, is_active')
      .maybeSingle();
    if (error) return res.status(500).json({ error: 'تعذر تعطيل الحساب' });
    if (!data) return res.status(404).json({ error: 'الطالب مش موجود' });
    await logAdminAction(auth.identity, 'deactivate_student', { student_id: id });
    return res.status(200).json({ student: data, message: 'تم تعطيل الحساب مع الاحتفاظ بالنتائج' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
