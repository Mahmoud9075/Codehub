const { supabase } = require('../_supabase');

// بيسجّل حركة في سجل التدقيق. استخدمها بعد أي تعديل يعمله أدمن (تعديل إعدادات، إضافة سؤال، إلخ)
async function logAdminAction(admin_identity, action, details) {
  try {
    await supabase.from('admin_audit_log').insert({ admin_identity, action, details: details || {} });
  } catch (e) {
    // متعملش الطلب الأساسي يفشل بس عشان السجل فشل
  }
}

module.exports = { logAdminAction };
