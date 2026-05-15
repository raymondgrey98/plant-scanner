const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT || 587),
  secure: process.env.EMAIL_PORT === '465',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendReminderEmail(to, subject, html) {
  if (!process.env.EMAIL_HOST) {
    console.warn('Email configuration missing; skipping reminder email');
    return;
  }

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  });
}

async function sendReminderSms(to, message) {
  console.warn('SMS reminders are not configured. Set up Twilio or another provider to enable SMS.');
  return;
}

module.exports = { sendReminderEmail, sendReminderSms };
