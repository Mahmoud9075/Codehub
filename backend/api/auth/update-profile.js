const { supabase } = require('../_supabase');
const { validateName } = require('./_validators');
const { applyCors } = require('../_cors');

// POST /api/auth/update-profile
// body: { student_id, first_name?, last_name?, avatar_base64? }
// avatar_base64 (اختياري): صورة الطالب بصيغة data URL، مثلاً "data:image/jpeg;base64,...."
// أي صورة جديدة بترفع بتستبدل القديمة تلقائيًا (نفس اسم الملف)، وبتفضل محفوظة لحد ما الطالب يغيّرها بنفسه.
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { student_id, first_name, last_name, avatar_base64 } = req.body || {};
  if (!student_id) return res.status(400).json({ error: 'student_id مطلوب' });

  const update = {};
  if (first_name) {
    if (!validateName(first_name)) return res.status(400).json({ error: 'الاسم الأول يقبل حروف بس' });
    update.first_name = first_name;
  }
  if (last_name) {
    if (!validateName(last_name)) return res.status(400).json({ error: 'الاسم الأخير يقبل حروف بس' });
    update.last_name = last_name;
  }

  if (avatar_base64) {
    const matches = avatar_base64.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: 'صيغة الصورة غير صحيحة' });

    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const path = `${student_id}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from('avatars')
      .upload(path, buffer, { contentType: `image/${matches[1]}`, upsert: true });

    if (uploadErr) return res.status(500).json({ error: uploadErr.message });

    const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path);
    // نضيف timestamp في آخر الرابط عشان المتصفح يجيب الصورة الجديدة على طول بدل الكاش القديم
    update.avatar_url = `${publicUrlData.publicUrl}?t=${Date.now()}`;
  }

  if (Object.keys(update).length === 0) {
    return res.status(400).json({ error: 'مفيش حاجة اتبعتت عشان تتحدّث' });
  }

  const { data, error } = await supabase
    .from('students')
    .update(update)
    .eq('id', student_id)
    .select('id, first_name, last_name, phone, email, avatar_url')
    .single();

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ student: data });
};
