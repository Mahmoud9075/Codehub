const { supabase } = require('../../_lib/supabase');
const { validateName } = require('../../_lib/auth-validators');
const { applyCors } = require('../../_lib/cors');

// POST /api/auth/update-profile
// body: { student_id, first_name?, last_name?, avatar_base64? }
// avatar_base64 (اختياري): صورة الطالب بصيغة data URL، مثلاً "data:image/jpeg;base64,...."
// أي صورة جديدة بترفع بتستبدل القديمة تلقائيًا (نفس اسم الملف)، وبتفضل محفوظة لحد ما الطالب يغيّرها بنفسه.
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
/* Lines 1934-1984 omitted */
  return res.status(200).json({ student: data });
};
