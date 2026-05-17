const express = require('express');
const { query }       = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ── GET /api/favorites ────────────────────────────────────────
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT f.*,
        p.common_name  AS plant_common_name,  p.scientific_name AS plant_scientific_name, p.image_url AS plant_image,
        o.common_name  AS org_common_name,    o.scientific_name AS org_scientific_name,   o.image_url AS org_image, o.subject_type AS org_type,
        s.result_json  AS scan_result,        s.cloud_url AS scan_cloud_url,              s.filename AS scan_filename
       FROM favorites f
       LEFT JOIN plants p ON p.id = f.plant_id
       LEFT JOIN organisms o ON o.id = f.organism_id
       LEFT JOIN scans s ON s.id = f.scan_id
       WHERE f.user_id = $1 ORDER BY f.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// ── POST /api/favorites ───────────────────────────────────────
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { plant_id, organism_id, scan_id } = req.body;
    if (!plant_id && !organism_id && !scan_id) {
      return res.status(400).json({ error: 'plant_id, organism_id, or scan_id is required' });
    }
    const result = await query(
      'INSERT INTO favorites (user_id, plant_id, organism_id, scan_id) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.user.id, plant_id || null, organism_id || null, scan_id || null]
    );
    // First favorite achievement
    await query(
      'INSERT INTO user_achievements (user_id, achievement_key) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.user.id, 'first_favorite']
    ).catch(() => {});
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Already in favorites' });
    next(err);
  }
});

// ── DELETE /api/favorites/:id ─────────────────────────────────
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      'DELETE FROM favorites WHERE id=$1 AND user_id=$2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Favorite not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── DELETE /api/favorites/by-plant/:id ───────────────────────
router.delete('/by-plant/:id', requireAuth, async (req, res, next) => {
  try {
    await query('DELETE FROM favorites WHERE user_id=$1 AND plant_id=$2', [req.user.id, req.params.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── GET /api/favorites/collections ───────────────────────────
router.get('/collections', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT c.*, COUNT(ci.id) AS item_count
       FROM collections c LEFT JOIN collection_items ci ON ci.collection_id=c.id
       WHERE c.user_id=$1 GROUP BY c.id ORDER BY c.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// ── POST /api/favorites/collections ──────────────────────────
router.post('/collections', requireAuth, async (req, res, next) => {
  try {
    const { name, description, is_public } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Collection name is required' });
    const result = await query(
      'INSERT INTO collections (user_id, name, description, is_public) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.user.id, name.trim(), description?.trim() || null, !!is_public]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// ── DELETE /api/favorites/collections/:id ────────────────────
router.delete('/collections/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      'DELETE FROM collections WHERE id=$1 AND user_id=$2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Collection not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── POST /api/favorites/collections/:id/items ────────────────
router.post('/collections/:id/items', requireAuth, async (req, res, next) => {
  try {
    const check = await query('SELECT id FROM collections WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    if (!check.rows.length) return res.status(404).json({ error: 'Collection not found' });
    const { plant_id, organism_id, scan_id } = req.body;
    const result = await query(
      'INSERT INTO collection_items (collection_id, plant_id, organism_id, scan_id) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.params.id, plant_id || null, organism_id || null, scan_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// ── GET /api/favorites/collections/:id/items ─────────────────
router.get('/collections/:id/items', requireAuth, async (req, res, next) => {
  try {
    const check = await query('SELECT id, is_public FROM collections WHERE id=$1', [req.params.id]);
    if (!check.rows.length) return res.status(404).json({ error: 'Collection not found' });
    const coll = check.rows[0];
    if (!coll.is_public) {
      const own = await query('SELECT id FROM collections WHERE id=$1 AND user_id=$2', [req.params.id, req.user?.id]);
      if (!own.rows.length) return res.status(403).json({ error: 'Private collection' });
    }
    const result = await query(
      `SELECT ci.*,
        p.common_name AS plant_name, p.image_url AS plant_image,
        o.common_name AS org_name, o.image_url AS org_image, o.subject_type AS org_type
       FROM collection_items ci
       LEFT JOIN plants p ON p.id=ci.plant_id
       LEFT JOIN organisms o ON o.id=ci.organism_id
       WHERE ci.collection_id=$1 ORDER BY ci.added_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

module.exports = router;
