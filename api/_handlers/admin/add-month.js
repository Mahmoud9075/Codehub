const { supabase } = require('../../_lib/supabase');
const { isAuthorized } = require('../../_lib/admin-auth');
const { logAdminAction } = require('../../_lib/admin-audit');
const { applyCors } = require('../../_lib/cors');
const { isValidGradeLevel, gradeLabel } = require('../../_lib/grade-access');

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  const auth = await isAuthorized(req);
  if (!auth.ok) return res.status(401).json({ error: 'مش معاك صلاحية' });

  if (req.method === 'PUT') {
    const id = String(req.body?.id || '').trim();
    const name = req.body?.name === undefined ? undefined : String(req.body.name || '').trim();
    const gradeLevel = String(req.body?.grade_level || '').trim();
    if (!id) return res.status(400).json({ error: 'id مطلوب' });
    if (!isValidGradeLevel(gradeLevel)) return res.status(400).json({ error: 'اختار أولى ثانوي أو ثانية ثانوي' });
    if (name !== undefined && (!name || name.length > 80)) return res.status(400).json({ error: 'اسم الشهر غير صحيح' });

    const { data: current, error: currentError } = await supabase
      .from('months')
      .select('id, name, grade_level')
      .eq('id', id)
      .maybeSingle();
    if (currentError) return res.status(500).json({ error: 'تعذر تحميل الشهر' });
    if (!current) return res.status(404).json({ error: 'الشهر مش موجود' });

    const finalName = name === undefined ? current.name : name;
    const { data: duplicate, error: duplicateError } = await supabase
      .from('months')
      .select('id')
      .eq('grade_level', gradeLevel)
      .ilike('name', finalName)
      .neq('id', id)
      .limit(1)
      .maybeSingle();
    if (duplicateError) return res.status(500).json({ error: 'تعذر التحقق من الشهر' });
    if (duplicate) return res.status(409).json({ error: 'في شهر بنفس الاسم للصف ده بالفعل' });

    const update = { grade_level: gradeLevel };
    if (name !== undefined) update.name = name;
    const { data: month, error } = await supabase
      .from('months')
      .update(update)
      .eq('id', id)
      .select('id, name, order_index, grade_level')
      .single();
    if (error) return res.status(500).json({ error: 'تعذر تحديث الشهر' });

    await logAdminAction(auth.identity, 'update_month_grade', { month_id: id, name: month.name, grade_level: gradeLevel, grade_label: gradeLabel(gradeLevel) });
    return res.status(200).json({ month });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const name = String(req.body?.name || '').trim();
  const gradeLevel = String(req.body?.grade_level || '').trim();
  if (!name) return res.status(400).json({ error: 'اسم الشهر مطلوب' });
  if (name.length > 80) return res.status(400).json({ error: 'اسم الشهر طويل قوي' });
  if (!isValidGradeLevel(gradeLevel)) return res.status(400).json({ error: 'اختار الصف الدراسي للشهر' });

  const { data: duplicate, error: duplicateError } = await supabase
    .from('months')
    .select('id')
    .eq('grade_level', gradeLevel)
    .ilike('name', name)
    .limit(1)
    .maybeSingle();
  if (duplicateError) return res.status(500).json({ error: 'تعذر التحقق من الشهر' });
  if (duplicate) return res.status(409).json({ error: 'الشهر ده موجود بالفعل للصف المختار' });

  // ترتيب كل صف مستقل عن الصف الآخر.
  const { data: existingMonths, error: orderError } = await supabase
    .from('months')
    .select('order_index')
    .eq('grade_level', gradeLevel)
    .order('order_index', { ascending: false })
    .limit(1);
  if (orderError) return res.status(500).json({ error: 'تعذر تحديد ترتيب الشهر' });
  const nextOrder = existingMonths?.length ? Number(existingMonths[0].order_index || 0) + 1 : 1;

  const { data: month, error: monthErr } = await supabase
    .from('months')
    .insert({ name, order_index: nextOrder, grade_level: gradeLevel })
    .select()
    .single();
  if (monthErr) return res.status(500).json({ error: 'تعذر إضافة الشهر' });

  const quizRows = [];
  let ord = 1;
  for (let week = 1; week <= 4; week++) {
    for (let quizNumber = 1; quizNumber <= 2; quizNumber++) {
      quizRows.push({
        month_id: month.id,
        type: 'weekly',
        week_number: week,
        quiz_number_in_week: quizNumber,
        title: `كويز الأسبوع ${week} - رقم ${quizNumber} (${name})`,
        order_index: ord++,
      });
    }
  }
  quizRows.push({ month_id: month.id, type: 'final', title: `الاختبار النهائي - ${name}`, order_index: 99 });

  const { error: quizErr } = await supabase.from('quizzes').insert(quizRows);
  if (quizErr) {
    await supabase.from('months').delete().eq('id', month.id);
    return res.status(500).json({ error: 'تعذر إنشاء اختبارات الشهر' });
  }

  await logAdminAction(auth.identity, 'add_month', { name, month_id: month.id, grade_level: gradeLevel, grade_label: gradeLabel(gradeLevel) });
  return res.status(201).json({ month });
};
