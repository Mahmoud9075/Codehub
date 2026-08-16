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

// بيبعت كود التحقق (OTP) على واتساب — عن طريق "قالب رسالة" (Message Template) موافَق عليه من Meta.
// واتساب مش بيسمح بإرسال رسالة نصية حرة لطالب لسه ما كلّمش رقم البيزنس بتاعك؛ لازم قالب معتمد.
//
// عشان تفعّلها:
// 1. اعمل حساب على developers.facebook.com وفعّل WhatsApp Cloud API.
// 2. هتاخد WHATSAPP_TOKEN و WHATSAPP_PHONE_ID، حطهم في Environment Variables على Vercel.
// 3. اعتمد قالب رسالة (Message Template) اسمه بالظبط "otp_verification"، باللغة العربية،
//    وفيه متغيّر واحد بس {{1}} هيتحط مكانه الكود، مثلاً:
//    "كود التحقق بتاعك في Code Hub هو: {{1}}"
//    (لو سمّيت القالب باسم مختلف، غيّر WHATSAPP_OTP_TEMPLATE في Environment Variables بنفس الاسم)
//
// لحد ما الإعداد ده يخلص، الدالة بترجع من غير إرسال (مش هتكسر تسجيل الكود في قاعدة البيانات).
async function sendOtpWhatsApp(phone, code) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const templateName = process.env.WHATSAPP_OTP_TEMPLATE || 'otp_verification';

  if (!token || !phoneId) {
    return { sent: false, reason: 'WHATSAPP_TOKEN أو WHATSAPP_PHONE_ID مش متظبطين لسه' };
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
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'ar' },
          components: [
            {
              type: 'body',
              parameters: [{ type: 'text', text: code }],
            },
          ],
        },
      }),
    });
    const data = await response.json();
    if (data.error) {
      return { sent: false, reason: data.error.message || 'فشل الإرسال', raw: data };
    }
    return { sent: true, data };
  } catch (e) {
    return { sent: false, reason: e.message };
  }
}

module.exports = { sendWhatsAppNotification, sendOtpWhatsApp };
