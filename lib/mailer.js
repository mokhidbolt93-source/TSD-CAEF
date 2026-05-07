const { Resend } = require('resend');

let _resend = null;
function getResend() {
  if (!_resend && process.env.RESEND_API_KEY) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

/**
 * Envoie un email via Resend API.
 * Si RESEND_API_KEY n'est pas configuré, log seulement.
 */
async function sendEmail({ to, subject, html }) {
  const r = getResend();
  if (!r) {
    console.log(`[EMAIL non configuré] To: ${to} | Sujet: ${subject}`);
    return null;
  }
  const from = process.env.EMAIL_FROM || 'NECTA Monitor <noreply@nectamonitor.app>';
  const { data, error } = await r.emails.send({ from, to, subject, html });
  if (error) throw new Error(JSON.stringify(error));
  console.log(`[EMAIL] Envoyé à ${to} — ${subject}`);
  return data;
}

/**
 * Template HTML standard pour les alertes NECTA
 */
function buildAlertHtml({ title, subtitle, items, cta, ctaUrl }) {
  const APP_URL = process.env.APP_URL || 'https://necta-monitor.railway.app';
  const itemsHtml = (items || []).map(i => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #1e2130;font-size:14px;color:#e4e7f0">${i}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0b0d12;font-family:system-ui,-apple-system,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px">
    <div style="text-align:center;margin-bottom:32px">
      <div style="font-size:28px;font-weight:800;letter-spacing:-1px;color:#fff">
        NECTA <span style="color:#4f9cf9">MONITOR</span>
      </div>
    </div>
    <div style="background:#11141c;border:1px solid #1e2130;border-radius:16px;overflow:hidden">
      <div style="padding:24px 28px;border-bottom:1px solid #1e2130">
        <div style="font-size:22px;font-weight:700;color:#fff;margin-bottom:6px">${title}</div>
        <div style="font-size:13px;color:#7a8195">${subtitle || ''}</div>
      </div>
      ${items && items.length ? `
      <table style="width:100%;border-collapse:collapse">
        <tbody>${itemsHtml}</tbody>
      </table>` : ''}
      <div style="padding:20px 28px">
        <a href="${ctaUrl || APP_URL}"
           style="display:inline-block;background:#4f9cf9;color:#fff;text-decoration:none;padding:10px 22px;border-radius:8px;font-weight:600;font-size:14px">
          ${cta || 'Ouvrir le tableau de bord'}
        </a>
      </div>
    </div>
    <div style="text-align:center;margin-top:20px;font-size:11px;color:#404557">
      NECTA Monitor — Notification automatique · <a href="${APP_URL}" style="color:#4f9cf9">Gérer les alertes</a>
    </div>
  </div>
</body>
</html>`;
}

module.exports = { sendEmail, buildAlertHtml };
