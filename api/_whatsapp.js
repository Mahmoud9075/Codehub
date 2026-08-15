// بيبعت رسالة واتساب تلقائية للطالب (مثلاً لما كويز جديد يتفتح).
//
// ⚠️ ملحوظة مهمة: الدالة دي جاهزة بس مش شغالة فعليًا لسه — محتاجة حساب WhatsApp Business
// (Meta Cloud API) موثّق. الخطوات (مجانية للتجربة):
// 1. اعمل حساب على developers.facebook.com وفعّل WhatsApp Cloud API.
// 2. هتاخد WHATSAPP_TOKEN و WHATSAPP_PHONE_ID، حطهم في Environment Variables.
// 3. لازم "قالب رسالة" (Message Template) يتوافق عليه من Meta الأول قبل ما تقدر تبعت رسائل تلقائية.
//
// لحد ما تخلّص الإعداد ده، الدالة مش هتعمل حاجة (هترجع من غير إرسال) عشان محدش يقابل خطأ.
async function sendWhatsAppNotification(phone, message) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;

  if (!token || !phoneId) {
    // الإعداد لسه مش متظبط — نتجاهل بهدوء بدل ما نكسر الطلب الأساسي (تسجيل النتيجة مثلاً)
    return { skipped: true, reason: 'WhatsApp not configured yet' };
  }

  try {
    const cleanPhone = phone.replace(/^0/, '20'); // 01xxxxxxxxx -> 201xxxxxxxxx
    const response = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: 'text',
        text: { body: message },
      }),
    });
    const data = await response.json();
    return { skipped: false, data };
  } catch (e) {
    return { skipped: true, reason: e.message };
  }
}

module.exports = { sendWhatsAppNotification };
