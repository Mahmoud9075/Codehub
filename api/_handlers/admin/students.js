const { supabase } = require('../../_lib/supabase');
const { isAuthorized } = require('../../_lib/admin-auth');
const { applyCors } = require('../../_lib/cors');

// GET /api/admin/students
// بيرجع كل الطلاب (الاسم، الرقم، الإيميل، حالة التحقق، تاريخ التسجيل) — أحدث تسجيل الأول.
// البحث بيتم في الواجهة (client-side) من غير إعادة تحميل، فالـ endpoint بيرجع القايمة كاملة.
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  const auth = await isAuthorized(req);
  if (!auth.ok) return res.status(401).json({ error: 'مش معاك صلاحية' });

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { data, error } = await supabase
    .from('students')
    .select('id, first_name, last_name, phone, email, phone_verified, created_at')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ students: data || [] });
};
