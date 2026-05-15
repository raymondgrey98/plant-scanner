const cron = require('node-cron');
const { query } = require('../db');
const { sendReminderEmail, sendReminderSms } = require('./email');

function startReminderScheduler() {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const now = new Date();
      const reminders = await query('SELECT r.*, u.email FROM reminders r JOIN users u ON u.id = r.user_id WHERE r.active = TRUE');
      for (const reminder of reminders.rows) {
        if (!cron.validate(reminder.cron_expression)) continue;
        const task = cron.schedule(reminder.cron_expression, async () => {
          const subject = `Plant Reminder: ${reminder.title}`;
          const body = `<p>Hi! This is your scheduled plant reminder:</p><p><strong>${reminder.title}</strong></p>`;
          if (reminder.channel === 'sms') {
            await sendReminderSms(reminder.destination, `${subject}\n${body}`);
          } else {
            await sendReminderEmail(reminder.destination, subject, body);
          }
          await query('UPDATE reminders SET last_sent = $1 WHERE id = $2', [new Date(), reminder.id]);
          task.stop();
        });
        task.start();
      }
    } catch (err) {
      console.error('Reminder scheduler error', err);
    }
  });
}

module.exports = { startReminderScheduler };
