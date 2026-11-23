import env, { flags } from '../config/env.js';

export const whatsappStatus = () => ({
  configured: flags.whatsapp,
  provider: env.WHATSAPP_PROVIDER,
  phoneNumberId: flags.whatsapp ? env.WHATSAPP_PHONE_NUMBER_ID : null,
});

/**
 * Send a WhatsApp text message through Meta's WhatsApp Cloud API.
 * Returns { sent, error, providerMessageId }.
 * NEVER returns sent:true unless Meta accepted the message.
 * Note: business-initiated conversations require an approved template beyond
 * the 24-hour customer service window — the API will surface that error.
 */
export async function sendWhatsApp({ to, body }) {
  if (!flags.whatsapp) {
    return { sent: false, error: 'WhatsApp is not configured. Connect the WhatsApp Cloud API in Settings → Integrations.' };
  }
  const phone = String(to || '').replace(/[^\d+]/g, '');
  if (!/^\+?\d{8,15}$/.test(phone)) return { sent: false, error: 'Invalid recipient phone number.' };
  const url = `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'text', text: { preview_url: false, body } }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { sent: false, error: data?.error?.message || `WhatsApp API error (${res.status})` };
    }
    return { sent: true, providerMessageId: data?.messages?.[0]?.id, provider: 'meta' };
  } catch (err) {
    return { sent: false, error: err.message };
  }
}

/** Verify Meta webhook signature. */
export async function verifyWhatsAppSignature(rawBody, signatureHeader, appSecret) {
  if (!appSecret || !signatureHeader) return false;
  const crypto = await import('node:crypto');
  const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch { return false; }
}
