const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM reminders WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { title, channel, destination, cron_expression, scan_id } = req.body;
    const result = await query(
      'INSERT INTO reminders (user_id, scan_id, title, channel, destination, cron_expression) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [req.user.id, scan_id || null, title, channel || 'email', destination, cron_expression]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await query('DELETE FROM reminders WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
