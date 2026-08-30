function normalizeEgyptPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (/^01[0125]\d{8}$/.test(digits)) return `20${digits.slice(1)}`;
  if (/^201[0125]\d{8}$/.test(digits)) return digits;
  return null;
}

function graphVersion() {
  const value = String(process.env.WHATSAPP_GRAPH_VERSION || 'v26.0').trim();
  return /^v\d+\.\d+$/.test(value) ? value : 'v26.0';
}

async function postWhatsApp(phoneId, token, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`https://graph.facebook.com/${graphVersion()}/${encodeURIComponent(phoneId)}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error) return { ok: false, status: response.status };
    return { ok: true };
  } catch (error) {
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(timeout);
  }
}

async function sendWhatsAppNotification(phone, message) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) return { skipped: true, reason: 'not_configured' };

  const to = normalizeEgyptPhone(phone);
  const text = String(message || '').trim().slice(0, 3000);
  if (!to || !text) return { skipped: true, reason: 'invalid_input' };

  const sent = await postWhatsApp(phoneId, token, {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text },
  });
  return sent.ok ? { skipped: false, sent: true } : { skipped: true, sent: false, reason: 'delivery_failed' };
}

async function sendOtpWhatsApp(phone, code) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const templateName = String(process.env.WHATSAPP_OTP_TEMPLATE || 'otp_verification').trim();
  if (!token || !phoneId) return { sent: false, reason: 'not_configured' };

  const to = normalizeEgyptPhone(phone);
  const cleanCode = String(code || '').trim();
  if (!to || !/^\d{6}$/.test(cleanCode) || !/^[A-Za-z0-9_]+$/.test(templateName)) {
    return { sent: false, reason: 'invalid_input' };
  }

  const result = await postWhatsApp(phoneId, token, {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'ar' },
      components: [{ type: 'body', parameters: [{ type: 'text', text: cleanCode }] }],
    },
  });
  return result.ok ? { sent: true } : { sent: false, reason: 'delivery_failed' };
}

module.exports = { sendWhatsAppNotification, sendOtpWhatsApp };
