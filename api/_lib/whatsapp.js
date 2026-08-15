// بيبعت رسالة واتساب تلقائية للطالب (مثلاً لما كويز جديد يتفتح).
//
// ⚠️ ملحوظة مهمة: الدالة دي جاهزة بس مش شغالة فعليًا لسه — محتاجة حساب WhatsApp Business
// (Meta Cloud API) موثّق. الخطوات (مجانية للتجربة):
// 1. اعمل حساب على developers.facebook.com وفعّل WhatsApp Cloud API.
// 2. هتاخد WHATSAPP_TOKEN و WHATSAPP_PHONE_ID، حطهم في Environment Variables.
// 3. لازم "قالب رسالة" (Message Template) يتوافق عليه من Meta الأول قبل ما تقدر تبعت رسائل تلقائية.

// لحد ما تخلّص الإعداد ده، الدالة مش هتعمل حاجة (هترجع من غير إرسال) عشان محدش يقابل خطأ.
async function sendWhatsAppNotification(phone, message) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;

  if (!token || !phoneId) {/* Lines 188-211 omitted */}
}

module.exports = { sendWhatsAppNotification };
