const { supabase } = require('../../_lib/supabase');
const { validateName, withinMaxLength, MAX_LENGTHS } = require('../../_lib/auth-validators');
const { applyCors } = require('../../_lib/cors');
const { requireStudent } = require('../../_lib/student-auth');

function validImageSignature(buffer, mime) {
  if (!buffer || buffer.length < 12) return false;
  if (mime === 'jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mime === 'png') return buffer.slice(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  if (mime === 'webp') return buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP';
  return false;
}

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await requireStudent(req, res);
  if (!session) return;
  const studentId = session.id;

  const { first_name, last_name, avatar_base64 } = req.body || {};
  const update = {};

  if (first_name !== undefined) {
    const value = String(first_name || '').trim();
    if (!withinMaxLength(value, MAX_LENGTHS.name) || !validateName(value)) return res.status(400).json({ error: 'الاسم الأول يقبل حروف بس' });
    update.first_name = value;
  }
  if (last_name !== undefined) {
    const value = String(last_name || '').trim();
    if (!withinMaxLength(value, MAX_LENGTHS.name) || !validateName(value)) return res.status(400).json({ error: 'الاسم الأخير يقبل حروف بس' });
    update.last_name = value;
  }

  if (avatar_base64) {
    const matches = String(avatar_base64).match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=\r\n]+)$/);
    if (!matches) return res.status(400).json({ error: 'صيغة الصورة غير صحيحة' });

    const mime = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    if (buffer.length > 1024 * 1024) return res.status(413).json({ error: 'حجم الصورة كبير. جرّب صورة أصغر' });
    if (!validImageSignature(buffer, mime)) return res.status(400).json({ error: 'ملف الصورة غير صالح' });

    const ext = mime === 'jpeg' ? 'jpg' : mime;
    const path = `${studentId}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, buffer, {
      contentType: `image/${mime}`,
      upsert: true,
      cacheControl: '3600',
    });
    if (uploadErr) return res.status(500).json({ error: 'تعذر رفع الصورة' });

    const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path);
    update.avatar_url = `${publicUrlData.publicUrl}?t=${Date.now()}`;
  }

  if (Object.keys(update).length === 0) return res.status(400).json({ error: 'مفيش حاجة اتبعتت عشان تتحدّث' });

  const { data, error } = await supabase
    .from('students')
    .update(update)
    .eq('id', studentId)
    .select('id, first_name, last_name, phone, email, avatar_url, phone_verified')
    .single();
  if (error) return res.status(500).json({ error: 'تعذر تحديث البيانات' });

  return res.status(200).json({ student: data });
};
