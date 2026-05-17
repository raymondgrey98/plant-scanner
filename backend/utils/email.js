const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:   process.env.EMAIL_HOST,
  port:   Number(process.env.EMAIL_PORT || 587),
  secure: process.env.EMAIL_PORT === '465',
  auth:   { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

const FROM    = process.env.EMAIL_FROM || 'FloraIQ <noreply@floraiq.app>';
const APP_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

function isConfigured() {
  return !!process.env.EMAIL_HOST;
}

async function send(to, subject, html) {
  if (!isConfigured()) {
    console.warn('[email] Not configured — skipping send to:', to);
    return;
  }
  await transporter.sendMail({ from: FROM, to, subject, html });
}

// ── Shared HTML wrapper ───────────────────────────────────────
function wrap(content) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table width="560" cellpadding="0" cellspacing="0" style="background:#18181b;border-radius:16px;overflow:hidden;border:1px solid #27272a">
<tr><td style="background:#16a34a;padding:24px 32px">
  <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800">Flora<span style="color:#bbf7d0">IQ</span></h1>
  <p style="margin:4px 0 0;color:#dcfce7;font-size:13px">Biological Intelligence Platform</p>
</td></tr>
<tr><td style="padding:32px">${content}</td></tr>
<tr><td style="padding:16px 32px 24px;border-top:1px solid #27272a">
  <p style="margin:0;color:#52525b;font-size:12px;text-align:center">
    &copy; ${new Date().getFullYear()} FloraIQ &bull;
    <a href="${APP_URL}/unsubscribe" style="color:#52525b">Unsubscribe</a>
  </p>
</td></tr>
</table></td></tr></table></body></html>`;
}

const BTN = (href, label) =>
  `<a href="${href}" style="display:inline-block;padding:12px 28px;background:#16a34a;color:#fff;font-weight:700;text-decoration:none;border-radius:8px;font-size:15px">${label}</a>`;

// ── Email senders ─────────────────────────────────────────────
async function sendWelcomeEmail(to, name) {
  const html = wrap(`
    <h2 style="margin:0 0 8px;color:#f4f4f5;font-size:20px">Welcome to FloraIQ, ${name || 'Explorer'}!</h2>
    <p style="color:#a1a1aa;line-height:1.6;margin:0 0 24px">
      You now have access to the most advanced biological identification platform on the web.
      Scan plants, insects, birds, mushrooms, and more with AI-powered precision.
    </p>
    <p style="margin:0 0 24px">${BTN(`${APP_URL}/scan`, 'Start Scanning')}</p>
    <div style="background:#09090b;border-radius:8px;padding:16px;margin-top:8px">
      <p style="margin:0 0 8px;color:#71717a;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">What you can do</p>
      ${['Identify 500,000+ species with AI','Track plant health in your growth journal','Set care reminders by email','Search GBIF, iNaturalist & Kew Gardens','Chat with an AI botanist expert'].map(f =>
        `<p style="margin:4px 0;color:#d4d4d8;font-size:14px">✓ ${f}</p>`).join('')}
    </div>
  `);
  await send(to, 'Welcome to FloraIQ!', html);
}

async function sendVerificationEmail(to, token) {
  const link = `${APP_URL}/verify-email?token=${token}`;
  const html = wrap(`
    <h2 style="margin:0 0 8px;color:#f4f4f5;font-size:20px">Verify your email address</h2>
    <p style="color:#a1a1aa;line-height:1.6;margin:0 0 24px">
      Click the button below to verify your email and unlock all FloraIQ features.
      This link expires in 24 hours.
    </p>
    <p style="margin:0 0 24px">${BTN(link, 'Verify Email')}</p>
    <p style="color:#52525b;font-size:12px;margin:0">Or paste this URL in your browser:<br><span style="color:#71717a">${link}</span></p>
  `);
  await send(to, 'Verify your FloraIQ email', html);
}

async function sendPasswordResetEmail(to, token) {
  const link = `${APP_URL}/reset-password?token=${token}`;
  const html = wrap(`
    <h2 style="margin:0 0 8px;color:#f4f4f5;font-size:20px">Reset your password</h2>
    <p style="color:#a1a1aa;line-height:1.6;margin:0 0 24px">
      Someone requested a password reset for your FloraIQ account.
      If this wasn't you, you can safely ignore this email — your account is secure.
      This link expires in <strong style="color:#f4f4f5">1 hour</strong>.
    </p>
    <p style="margin:0 0 24px">${BTN(link, 'Reset Password')}</p>
    <p style="color:#52525b;font-size:12px;margin:0">Or paste this URL:<br><span style="color:#71717a">${link}</span></p>
    <div style="margin-top:24px;padding:12px;background:#7f1d1d20;border-radius:8px;border:1px solid #7f1d1d40">
      <p style="margin:0;color:#fca5a5;font-size:13px">If you didn't request this, please change your password immediately.</p>
    </div>
  `);
  await send(to, 'Reset your FloraIQ password', html);
}

async function sendReminderEmail(to, subject, html) {
  await send(to, subject, html);
}

async function sendScanSummaryEmail(to, name, scanCount, topSpecies) {
  const html = wrap(`
    <h2 style="margin:0 0 8px;color:#f4f4f5;font-size:20px">Your FloraIQ weekly summary</h2>
    <p style="color:#a1a1aa;line-height:1.6;margin:0 0 16px">Hi ${name || 'Explorer'}, here's what you identified this week:</p>
    <div style="background:#09090b;border-radius:8px;padding:16px 20px;margin-bottom:20px">
      <p style="margin:0 0 4px;color:#22c55e;font-size:32px;font-weight:800">${scanCount}</p>
      <p style="margin:0;color:#71717a;font-size:14px">species identified this week</p>
    </div>
    ${topSpecies?.length ? `
    <p style="margin:0 0 8px;color:#71717a;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Top identifications</p>
    ${topSpecies.slice(0,5).map(s => `<p style="margin:4px 0;color:#d4d4d8;font-size:14px">• ${s}</p>`).join('')}
    ` : ''}
    <p style="margin:24px 0 0">${BTN(`${APP_URL}/history`, 'View My History')}</p>
  `);
  await send(to, 'Your FloraIQ weekly summary', html);
}

async function sendPremiumConfirmationEmail(to, name) {
  const html = wrap(`
    <h2 style="margin:0 0 8px;color:#f4f4f5;font-size:20px">You're now FloraIQ Premium!</h2>
    <p style="color:#a1a1aa;line-height:1.6;margin:0 0 24px">
      Welcome to the premium experience, ${name || 'Explorer'}. You now have unlimited scans,
      priority AI analysis, advanced plant care scheduling, and bulk identification.
    </p>
    <p style="margin:0 0 24px">${BTN(`${APP_URL}/scan`, 'Start Using Premium')}</p>
    <div style="background:#09090b;border-radius:8px;padding:16px">
      ${['Unlimited scans per day','Bulk scan up to 50 photos','Priority AI analysis queue','CSV export of all data','Advanced plant health scoring','Premium plant care calendar'].map(f =>
        `<p style="margin:4px 0;color:#d4d4d8;font-size:14px">⭐ ${f}</p>`).join('')}
    </div>
  `);
  await send(to, 'FloraIQ Premium activated!', html);
}

async function sendSubscriptionCancelledEmail(to, name, endDate) {
  const html = wrap(`
    <h2 style="margin:0 0 8px;color:#f4f4f5;font-size:20px">Your Premium subscription has been cancelled</h2>
    <p style="color:#a1a1aa;line-height:1.6;margin:0 0 24px">
      Hi ${name || 'Explorer'}, your FloraIQ Premium subscription has been cancelled.
      You'll continue to have Premium access until <strong style="color:#f4f4f5">${endDate}</strong>,
      after which your account will revert to the free plan.
    </p>
    <p style="margin:0 0 24px">${BTN(`${APP_URL}/pricing`, 'Reactivate Premium')}</p>
    <p style="color:#52525b;font-size:13px;margin:0">
      Thank you for being a FloraIQ Premium member. We hope to see you back soon.
    </p>
  `);
  await send(to, 'Your FloraIQ Premium subscription has been cancelled', html);
}

async function sendBanNotificationEmail(to, reason) {
  const html = wrap(`
    <h2 style="margin:0 0 8px;color:#f4f4f5;font-size:20px">Account suspended</h2>
    <p style="color:#a1a1aa;line-height:1.6;margin:0 0 24px">
      Your FloraIQ account has been suspended${reason ? ' for the following reason: <strong style="color:#f4f4f5">' + reason + '</strong>' : ''}.
    </p>
    <p style="color:#71717a;font-size:13px;margin:0">
      If you believe this is a mistake, please contact support at support@floraiq.app.
    </p>
  `);
  await send(to, 'FloraIQ account suspended', html);
}

module.exports = {
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendReminderEmail,
  sendScanSummaryEmail,
  sendPremiumConfirmationEmail,
  sendSubscriptionCancelledEmail,
  sendBanNotificationEmail,
};
