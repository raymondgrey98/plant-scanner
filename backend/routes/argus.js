const express = require('express');
const router  = express.Router();
const { query } = require('../db');

// Shared secret — set ARGUS_SECRET in .env, Argus must send same value
const SECRET = process.env.ARGUS_SECRET || '';

function checkSecret(req, res, next) {
  if (!SECRET) return next(); // no secret configured = open (dev mode)
  const auth = req.headers['x-argus-secret'] || req.headers['authorization']?.replace('Bearer ', '');
  if (auth !== SECRET) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// ── POST /api/argus/intel  (Argus pushes intel here) ──────────
router.post('/intel', checkSecret, async (req, res, next) => {
  try {
    const { category, title, summary, source = 'argus', url = '', ts } = req.body;
    if (!category || !title || !summary) {
      return res.status(400).json({ error: 'category, title, summary required' });
    }

    const result = await query(
      `INSERT INTO argus_intel (category, title, summary, source, url, ts)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, NOW()))
       RETURNING id, created_at`,
      [
        String(category).slice(0, 80),
        String(title).slice(0, 200),
        String(summary).slice(0, 2000),
        String(source).slice(0, 80),
        String(url).slice(0, 500),
        ts || null,
      ]
    );

    res.json({ ok: true, id: result.rows[0].id, created_at: result.rows[0].created_at });
  } catch (err) { next(err); }
});

// ── GET /api/argus/intel  (FloraIQ/BioScan reads intel) ───────
router.get('/intel', async (req, res, next) => {
  try {
    const category = req.query.category || '';
    const limit    = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset   = parseInt(req.query.offset) || 0;

    const params = [limit, offset];
    let where = '';
    if (category) {
      params.push(category);
      where = `WHERE category = $${params.length}`;
    }

    const result = await query(
      `SELECT id, category, title, summary, source, url, ts, created_at
       FROM argus_intel
       ${where}
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      params
    );

    const total = await query(
      `SELECT COUNT(*) AS count FROM argus_intel ${where}`,
      category ? [category] : []
    );

    res.json({
      items: result.rows,
      total: parseInt(total.rows[0].count),
      limit,
      offset,
    });
  } catch (err) { next(err); }
});

// ── GET /api/argus/intel/categories  (list all known categories)
router.get('/intel/categories', async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT category, COUNT(*) AS count
       FROM argus_intel
       GROUP BY category
       ORDER BY count DESC`
    );
    res.json({ categories: result.rows });
  } catch (err) { next(err); }
});

// ── DELETE /api/argus/intel/:id  (Argus can remove stale intel)
router.delete('/intel/:id', checkSecret, async (req, res, next) => {
  try {
    await query('DELETE FROM argus_intel WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
