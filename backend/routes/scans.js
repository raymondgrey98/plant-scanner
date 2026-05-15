const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { analyzeImage } = require('../utils/gemini');

const router = express.Router();
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (_req, file, cb) => {
  if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files are allowed'));
  cb(null, true);
}});

async function fetchExamplePhoto(plantName) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(
      `https://api.inaturalist.org/v1/taxa/search?q=${encodeURIComponent(plantName)}&rank=species&per_page=1&is_active=true`,
      { signal: controller.signal }
    ).finally(() => clearTimeout(timer));
    if (!res.ok) return null;
    const data = await res.json();
    return data.results?.[0]?.default_photo?.medium_url || null;
  } catch (_) {
    return null;
  }
}

router.post('/public', upload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Photo is required' });
    const mode = (req.body.mode || 'default').trim();
    const analysis = await analyzeImage(req.file.path, mode);
    const searchName = analysis.common_name || analysis.plant_name;
    const [plantResult, example_photo] = await Promise.all([
      query(
        'INSERT INTO scans (filename, result_json, score) VALUES ($1, $2, $3) RETURNING id, created_at',
        [req.file.filename, analysis, analysis.confidence]
      ),
      searchName ? fetchExamplePhoto(searchName) : Promise.resolve(null),
    ]);

    res.json({
      id: plantResult.rows[0].id,
      filename: req.file.filename,
      url: `/uploads/${req.file.filename}`,
      created_at: plantResult.rows[0].created_at,
      result: analysis,
      example_photo,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/public', async (_req, res, next) => {
  try {
    const result = await query('SELECT id, filename, result_json, score, created_at FROM scans ORDER BY created_at DESC LIMIT 20');
    res.json(result.rows.map((row) => ({
      ...row,
      url: `/uploads/${row.filename}`,
      result: row.result_json,
    })));
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, upload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Photo is required' });
    const mode = (req.body.mode || 'default').trim();
    const analysis = await analyzeImage(req.file.path, mode);
    const searchName = analysis.common_name || analysis.plant_name;
    const [plantResult, example_photo] = await Promise.all([
      query(
        'INSERT INTO scans (user_id, filename, result_json, score) VALUES ($1, $2, $3, $4) RETURNING id, created_at',
        [req.user.id, req.file.filename, analysis, analysis.confidence]
      ),
      searchName ? fetchExamplePhoto(searchName) : Promise.resolve(null),
    ]);

    res.json({
      id: plantResult.rows[0].id,
      filename: req.file.filename,
      url: `/uploads/${req.file.filename}`,
      created_at: plantResult.rows[0].created_at,
      result: analysis,
      example_photo,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/bulk', requireAuth, upload.array('photos', 50), async (req, res, next) => {
  try {
    if (!req.files?.length) return res.status(400).json({ error: 'At least one photo is required' });
    const rows = [];
    for (const file of req.files) {
      const analysis = await analyzePlant(file.path);
      const result = await query(
        'INSERT INTO scans (user_id, filename, result_json, score) VALUES ($1, $2, $3, $4) RETURNING id, created_at',
        [req.user.id, file.filename, analysis, analysis.confidence]
      );
      rows.push({ id: result.rows[0].id, filename: file.filename, url: `/uploads/${file.filename}`, created_at: result.rows[0].created_at, result: analysis });
    }
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const result = await query('SELECT id, filename, result_json, score, created_at FROM scans WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [req.user.id]);
    res.json(result.rows.map((row) => ({
      ...row,
      url: `/uploads/${row.filename}`,
      result: row.result_json,
    })));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
