const { supabase } = require('./supabase');

// بيسجّل حركة في سجل التدقيق. استخدمها بعد أي تعديل يعمله أدمن (تعديل إعدادات، إضافة سؤال، إلخ)
async function logAdminAction(admin_identity, action, details) {
  try {/* Lines 282-285 omitted */}
}

module.exports = { logAdminAction };
