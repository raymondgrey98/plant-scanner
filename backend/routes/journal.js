const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { query }       = require('../db');
const { requireAuth } = require('../middleware/auth');
const { uploadImage, deleteLocalFile } = require('../utils/cloudinary');

const router    = express.Router();
const uploadDir = path.join(__dirname, '..', 'uploads', 'journal');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Images only'));
    cb(null, true);
  },
});

// ── GET /api/journal ──────────────────────────────────────────
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const page  = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(Number(req.query.limit || 20), 100);
    const offset = (page - 1) * limit;
    const search = req.query.search?.trim() || null;

    const params = search
      ? [req.user.id, `%${search}%`, limit, offset]
      : [req.user.id, limit, offset];
    const whereSearch = search ? `AND (title ILIKE $2 OR plant_name ILIKE $2 OR scientific_name ILIKE $2 OR notes ILIKE $2)` : '';
    const limitParam  = search ? '$3' : '$2';
    const offsetParam = search ? '$4' : '$3';

    const [rows, total] = await Promise.all([
      query(
        `SELECT * FROM growth_journal WHERE user_id=$1 ${whereSearch} ORDER BY created_at DESC LIMIT ${limitParam} OFFSET ${offsetParam}`,
        params
      ),
      query(
        `SELECT COUNT(*) AS total FROM growth_journal WHERE user_id=$1 ${whereSearch}`,
        search ? [req.user.id, `%${search}%`] : [req.user.id]
      ),
    ]);

    res.json({
      items: rows.rows, page, limit,
      total: Number(total.rows[0].total),
      pages: Math.ceil(Number(total.rows[0].total) / limit),
    });
  } catch (err) { next(err); }
});

// ── POST /api/journal ─────────────────────────────────────────
router.post('/', requireAuth, upload.single('photo'), async (req, res, next) => {
  try {
    const { title, plant_name, scientific_name, notes, height_cm, health_score, tags, weather_at_time } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
    if (health_score && (Number(health_score) < 1 || Number(health_score) > 10)) {
      return res.status(400).json({ error: 'Health score must be 1–10' });
    }

    let photo_url = null;
    if (req.file) {
      const cloudUrl = await uploadImage(req.file.path, 'floraiq/journal');
      photo_url = cloudUrl || null;
      deleteLocalFile(req.file.path);
    }

    const tagsArr = tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(Boolean)) : [];

    const result = await query(
      `INSERT INTO growth_journal
         (user_id, title, plant_name, scientific_name, notes, height_cm, health_score, photo_url, tags, weather_at_time)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        req.user.id, title.trim(),
        plant_name?.trim() || null, scientific_name?.trim() || null,
        notes?.trim() || null,
        height_cm ? Number(height_cm) : null,
        health_score ? Number(health_score) : null,
        photo_url, tagsArr, weather_at_time?.trim() || null,
      ]
    );

    // Achievement for first journal entry
    await query(
      'INSERT INTO user_achievements (user_id, achievement_key) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.user.id, 'first_journal']
    ).catch(() => {});

    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// ── GET /api/journal/:id ──────────────────────────────────────
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM growth_journal WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Entry not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// ── PATCH /api/journal/:id ────────────────────────────────────
router.patch('/:id', requireAuth, upload.single('photo'), async (req, res, next) => {
  try {
    const check = await query('SELECT id, photo_url FROM growth_journal WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    if (!check.rows.length) return res.status(404).json({ error: 'Entry not found' });

    const { title, plant_name, scientific_name, notes, height_cm, health_score, tags, weather_at_time } = req.body;
    let photo_url = check.rows[0].photo_url;
    if (req.file) {
      const cloudUrl = await uploadImage(req.file.path, 'floraiq/journal');
      photo_url = cloudUrl || photo_url;
      deleteLocalFile(req.file.path);
    }

    const tagsArr = tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(Boolean)) : undefined;

    const result = await query(
      `UPDATE growth_journal SET
         title=COALESCE($1,title), plant_name=COALESCE($2,plant_name),
         scientific_name=COALESCE($3,scientific_name), notes=COALESCE($4,notes),
         height_cm=COALESCE($5,height_cm), health_score=COALESCE($6,health_score),
         photo_url=$7, tags=COALESCE($8,tags), weather_at_time=COALESCE($9,weather_at_time)
       WHERE id=$10 AND user_id=$11 RETURNING *`,
      [
        title?.trim() || null, plant_name?.trim() || null,
        scientific_name?.trim() || null, notes?.trim() || null,
        height_cm ? Number(height_cm) : null,
        health_score ? Number(health_score) : null,
        photo_url,
        tagsArr || null,
        weather_at_time?.trim() || null,
        req.params.id, req.user.id,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// ── DELETE /api/journal/:id ───────────────────────────────────
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      'DELETE FROM growth_journal WHERE id=$1 AND user_id=$2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Entry not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── GET /api/journal/stats/summary ───────────────────────────
router.get('/stats/summary', requireAuth, async (req, res, next) => {
  try {
    const [total, avgHealth, recent, timeline] = await Promise.all([
      query('SELECT COUNT(*) AS total FROM growth_journal WHERE user_id=$1', [req.user.id]),
      query('SELECT AVG(health_score)::NUMERIC(4,1) AS avg_health FROM growth_journal WHERE user_id=$1 AND health_score IS NOT NULL', [req.user.id]),
      query('SELECT plant_name, MAX(health_score) AS best, COUNT(*) AS entries FROM growth_journal WHERE user_id=$1 GROUP BY plant_name ORDER BY entries DESC LIMIT 5', [req.user.id]),
      query('SELECT DATE_TRUNC(\'month\',created_at) AS month, COUNT(*) AS count FROM growth_journal WHERE user_id=$1 GROUP BY month ORDER BY month DESC LIMIT 12', [req.user.id]),
    ]);
    res.json({
      total: Number(total.rows[0].total),
      avg_health: Number(avgHealth.rows[0].avg_health) || null,
      top_plants: recent.rows,
      monthly_trend: timeline.rows,
    });
  } catch (err) { next(err); }
});

module.exports = router;
