const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { addReminder, removeReminder } = require('../utils/reminders');

const FREQ_MAP = {
  daily:    '0 8 * * *',
  weekly:   '0 8 * * 1',
  biweekly: '0 8 1,15 * *',
  monthly:  '0 8 1 * *',
};

// Public: create reminder without account (email-only)
router.post('/public', async (req, res, next) => {
  try {
    const { title, destination, frequency } = req.body;
    if (!title || !destination || !frequency) {
      return res.status(400).json({ error: 'title, destination, and frequency are required' });
    }
    const cron_expression = FREQ_MAP[frequency];
    if (!cron_expression) {
      return res.status(400).json({ error: 'frequency must be: daily, weekly, biweekly, or monthly' });
    }
    const result = await query(
      'INSERT INTO reminders (title, channel, destination, cron_expression) VALUES ($1, $2, $3, $4) RETURNING *',
      [title.slice(0, 200), 'email', destination.toLowerCase().trim(), cron_expression]
    );
    const reminder = result.rows[0];
    addReminder(reminder);
    res.status(201).json(reminder);
  } catch (err) {
    next(err);
  }
});

// Auth: list user's reminders
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM reminders WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Auth: create reminder tied to account
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { title, channel, destination, cron_expression, scan_id, frequency } = req.body;
    const expr = cron_expression || FREQ_MAP[frequency];
    if (!title || !destination || !expr) {
      return res.status(400).json({ error: 'title, destination, and cron_expression (or frequency) are required' });
    }
    const result = await query(
      'INSERT INTO reminders (user_id, scan_id, title, channel, destination, cron_expression) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [req.user.id, scan_id || null, title, channel || 'email', destination, expr]
    );
    const reminder = result.rows[0];
    addReminder(reminder);
    res.status(201).json(reminder);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await query('DELETE FROM reminders WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    removeReminder(Number(req.params.id));
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
