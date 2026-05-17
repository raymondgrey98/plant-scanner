const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const search = (req.query.search || '').trim();
    const page = Number(req.query.page || 1);
    const limit = Math.min(Number(req.query.limit || 200), 500);
    const offset = (page - 1) * limit;

    const searchClause = search
      ? `WHERE common_name ILIKE $1 OR scientific_name ILIKE $1 OR habitat ILIKE $1 OR uses ILIKE $1 OR disease ILIKE $1`
      : '';
    const params = search ? [`%${search}%`, limit, offset] : [limit, offset];

    const [result, countResult] = await Promise.all([
      query(
        `SELECT id, common_name, scientific_name, care_summary, watering, fertilizer, sunlight, soil, propagation, uses, image_url, habitat, disease, pest FROM plants ${searchClause} ORDER BY common_name LIMIT $${search ? 2 : 1} OFFSET $${search ? 3 : 2}`,
        params
      ),
      query(
        `SELECT COUNT(*) AS total FROM plants ${searchClause}`,
        search ? [`%${search}%`] : []
      ),
    ]);

    const total = Number(countResult.rows[0].total);
    res.json({ items: result.rows, page, total, pages: Math.ceil(total / limit), search });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM plants WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Plant not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.get('/library/latest', requireAuth, async (req, res, next) => {
  try {
    const result = await query('SELECT id, common_name, scientific_name, care_summary, image_url FROM plants ORDER BY created_at DESC LIMIT 6');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const {
      scientific_name, common_name, care_summary, watering, fertilizer,
      sunlight, soil, propagation, uses, image_url, habitat, disease, pest,
    } = req.body;
    if (!common_name && !scientific_name) {
      return res.status(400).json({ error: 'common_name or scientific_name is required' });
    }
    const existing = await query(
      `SELECT id, common_name, scientific_name FROM plants
       WHERE (scientific_name IS NOT NULL AND scientific_name ILIKE $1)
          OR (common_name    IS NOT NULL AND common_name    ILIKE $2)
       LIMIT 1`,
      [scientific_name || '', common_name || '']
    );
    if (existing.rows.length) {
      return res.json({ plant: existing.rows[0], existed: true });
    }
    const result = await query(
      `INSERT INTO plants
         (scientific_name, common_name, care_summary, watering, fertilizer,
          sunlight, soil, propagation, uses, image_url, habitat, disease, pest)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id, common_name, scientific_name`,
      [
        scientific_name || null, common_name || null, care_summary || null,
        watering || null, fertilizer || null, sunlight || null, soil || null,
        propagation || null, uses || null, image_url || null,
        habitat || null, disease || null, pest || null,
      ]
    );
    res.status(201).json({ plant: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
