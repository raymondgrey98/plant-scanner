const express = require('express');
const { query }       = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit || 30), 100);
    const result = await query(
      'SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2',
      [req.user.id, limit]
    );
    const unread = await query(
      'SELECT COUNT(*) AS count FROM notifications WHERE user_id=$1 AND read=FALSE',
      [req.user.id]
    );
    res.json({ items: result.rows, unread: Number(unread.rows[0].count) });
  } catch (err) { next(err); }
});

router.put('/:id/read', requireAuth, async (req, res, next) => {
  try {
    await query('UPDATE notifications SET read=TRUE WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.put('/read-all', requireAuth, async (req, res, next) => {
  try {
    await query('UPDATE notifications SET read=TRUE WHERE user_id=$1', [req.user.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await query('DELETE FROM notifications WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
