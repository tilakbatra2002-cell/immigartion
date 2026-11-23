import nodemailer from 'nodemailer';
import env, { flags } from '../config/env.js';

let transporter = null;
if (flags.smtp) {
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE === 'true',
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
}

export const mailerStatus = () => ({
  configured: flags.smtp,
  from: env.SMTP_FROM,
  host: flags.smtp ? env.SMTP_HOST : null,
});

/**
 * Send an email. Returns { sent, provider, error } — never pretends a send
 * succeeded when SMTP is not configured.
 */
export async function sendMail({ to, subject, text, html, replyTo, attachments }) {
  if (!flags.smtp) {
    return { sent: false, provider: 'smtp', error: 'SMTP is not configured. Add SMTP credentials in Settings → Integrations.' };
  }
  try {
    const info = await transporter.sendMail({
      from: env.SMTP_FROM, to, subject, text, html, replyTo, attachments,
    });
    return { sent: true, provider: 'smtp', messageId: info.messageId };
  } catch (err) {
    return { sent: false, provider: 'smtp', error: err.message };
  }
}

export const baseEmailHtml = (title, bodyHtml, footer = '') => `
<div style="background:#F7F9FC;padding:32px 16px;font-family:Manrope,Segoe UI,Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden">
    <div style="background:#101828;padding:20px 28px">
      <div style="color:#fff;font-size:16px;font-weight:700;letter-spacing:-0.01em">ImmigrationFlow</div>
      <div style="color:#94A3B8;font-size:11px;margin-top:2px">by Webamazee</div>
    </div>
    <div style="padding:28px">
      <h1 style="margin:0 0 12px;font-size:19px;color:#111827;font-weight:700">${title}</h1>
      <div style="font-size:14px;color:#374151;line-height:1.6">${bodyHtml}</div>
    </div>
    <div style="padding:16px 28px;border-top:1px solid #E5E7EB;font-size:12px;color:#667085">${footer || 'This is an automated message from ImmigrationFlow.'}</div>
  </div>
</div>`;
