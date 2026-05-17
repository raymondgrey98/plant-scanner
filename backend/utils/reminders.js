const cron = require('node-cron');
const { query } = require('../db');
const { sendReminderEmail } = require('./email');

const activeTasks = new Map();

function scheduleOne(reminder) {
  if (!cron.validate(reminder.cron_expression)) {
    console.warn(`[reminders] Invalid cron for reminder ${reminder.id}: ${reminder.cron_expression}`);
    return;
  }
  const existing = activeTasks.get(reminder.id);
  if (existing) existing.stop();

  const task = cron.schedule(reminder.cron_expression, async () => {
    const subject = `FloraIQ Reminder: ${reminder.title}`;
    const html = `
      <div style="font-family:sans-serif;max-width:480px;padding:24px;background:#09090b;color:#e4e4e7;border-radius:12px">
        <h2 style="color:#22c55e;margin:0 0 12px">FloraIQ Plant Reminder</h2>
        <p style="margin:0 0 16px;font-size:15px">${reminder.title}</p>
        <p style="color:#71717a;font-size:12px;margin:0">You set this reminder via FloraIQ. To stop receiving it, contact support.</p>
      </div>`;
    try {
      await sendReminderEmail(reminder.destination, subject, html);
      await query('UPDATE reminders SET last_sent = NOW() WHERE id = $1', [reminder.id]);
    } catch (err) {
      console.error(`[reminders] Failed to send reminder ${reminder.id}:`, err.message);
    }
  }, { timezone: 'UTC' });

  activeTasks.set(reminder.id, task);
}

async function startReminderScheduler() {
  try {
    const result = await query('SELECT * FROM reminders WHERE active = TRUE');
    for (const r of result.rows) scheduleOne(r);
    console.log(`[reminders] Scheduled ${result.rows.length} active reminder(s)`);
  } catch (err) {
    console.error('[reminders] Startup error:', err.message);
  }
}

function addReminder(reminder) {
  scheduleOne(reminder);
}

function removeReminder(id) {
  const task = activeTasks.get(id);
  if (task) { task.stop(); activeTasks.delete(id); }
}

module.exports = { startReminderScheduler, addReminder, removeReminder };
