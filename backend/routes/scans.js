const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { query }          = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { analyzeImage }   = require('../utils/gemini');
const { extractLocation }= require('../utils/exif');
const { uploadImage, deleteLocalFile } = require('../utils/cloudinary');

const router    = express.Router();
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:    (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files are allowed'));
    cb(null, true);
  },
});

// ── Fetch reference photo from iNaturalist ────────────────────
async function fetchExamplePhoto(name) {
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res   = await fetch(
      `https://api.inaturalist.org/v1/taxa/search?q=${encodeURIComponent(name)}&rank=species&per_page=1&is_active=true`,
      { signal: ctrl.signal }
    ).finally(() => clearTimeout(timer));
    if (!res.ok) return null;
    const data = await res.json();
    return data.results?.[0]?.default_photo?.medium_url || null;
  } catch { return null; }
}

// ── Process a scan (shared logic) ────────────────────────────
async function processScan(file, mode, userId) {
  try {
  const [analysis, location] = await Promise.all([
    analyzeImage(file.path, mode),
    extractLocation(file.path),
  ]);

  // Upload to Cloudinary if configured, then clean local file
  const cloudUrl = await uploadImage(file.path, 'floraiq/scans');

  const searchName = analysis.common_name || analysis.plant_name;
  const example_photo = searchName ? await fetchExamplePhoto(searchName).catch(() => null) : null;

  // Store scan in DB
  const scanResult = await query(
    `INSERT INTO scans
       (user_id, filename, cloud_url, result_json, score, mode,
        latitude, longitude, altitude_m, country, country_code, state, city, street, location_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING id, created_at`,
    [
      userId || null, file.filename, cloudUrl || null,
      analysis, analysis.confidence, mode,
      location?.latitude    || null, location?.longitude   || null,
      location?.altitude_m  || null, location?.country     || null,
      location?.country_code|| null, location?.state       || null,
      location?.city        || null, location?.street      || null,
      location?.location_name || null,
    ]
  );
  const scan = scanResult.rows[0];

  // Store species sighting if we have GPS
  if (location?.latitude && analysis.scientific_name) {
    await query(
      `INSERT INTO species_sightings
         (scan_id, user_id, scientific_name, common_name, subject_type,
          latitude, longitude, altitude_m, country, country_code, state, city, street, location_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        scan.id, userId || null,
        analysis.scientific_name, analysis.common_name || analysis.plant_name,
        analysis.subject_type,
        location.latitude, location.longitude, location.altitude_m || null,
        location.country || null, location.country_code || null,
        location.state || null, location.city || null,
        location.street || null, location.location_name || null,
      ]
    ).catch(() => {});
  }

  // Increment user scan count
  if (userId) {
    await query('UPDATE users SET scan_count = scan_count + 1 WHERE id = $1', [userId]).catch(() => {});
    // Achievement checks
    const countRow = await query('SELECT scan_count FROM users WHERE id = $1', [userId]);
    const cnt = countRow.rows[0]?.scan_count || 0;
    const milestones = [[1,'first_scan'], [10,'ten_scans'], [50,'fifty_scans'], [100,'hundred_scans'], [500,'five_hundred_scans']];
    for (const [n, key] of milestones) {
      if (cnt >= n) {
        await query(
          'INSERT INTO user_achievements (user_id, achievement_key) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [userId, key]
        ).catch(() => {});
      }
    }
  }

  return {
    id: scan.id, filename: file.filename,
    url: cloudUrl || `/uploads/${file.filename}`,
    created_at: scan.created_at,
    result: analysis, example_photo,
    location: location || null,
  };
  } finally {
    // Security Fix: Always cleanup local storage regardless of success/failure
    if (fs.existsSync(file.path)) deleteLocalFile(file.path);
  }
}

// ── POST /api/scans/public (no auth) ──────────────────────────
router.post('/public', upload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Photo is required' });
    const mode   = (req.body.mode || 'default').trim();
    const result = await processScan(req.file, mode, null);
    res.json(result);
  } catch (err) { next(err); }
});

// ── GET /api/scans/public (recent public scans) ───────────────
router.get('/public', async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT s.id, s.filename, s.cloud_url, s.result_json, s.score, s.mode,
              s.created_at, s.location_name, s.country, s.city,
              COUNT(sl.id) AS like_count
       FROM scans s
       LEFT JOIN scan_likes sl ON sl.scan_id = s.id
       WHERE s.is_public = TRUE
       GROUP BY s.id
       ORDER BY s.created_at DESC LIMIT 30`
    );
    res.json(result.rows.map(r => ({
      ...r, url: r.cloud_url || `/uploads/${r.filename}`, result: r.result_json,
    })));
  } catch (err) { next(err); }
});

// ── POST /api/scans (guest-friendly — accepts field name photo OR image) ──
router.post('/', optionalAuth, upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'image', maxCount: 1 }]), async (req, res, next) => {
  try {
    const file = req.files?.photo?.[0] || req.files?.image?.[0];
    if (!file) return res.status(400).json({ error: 'Photo is required' });
    const mode   = (req.body.mode || 'default').trim();
    const result = await processScan(file, mode, req.user?.id || null);
    res.json(result);
  } catch (err) { next(err); }
});

// ── POST /api/scans/bulk (auth, up to 20 photos) ─────────────
router.post('/bulk', requireAuth, upload.array('photos', 20), async (req, res, next) => {
  try {
    if (!req.files?.length) return res.status(400).json({ error: 'At least one photo is required' });
    const mode  = (req.body.mode || 'default').trim();

    const scanPromises = req.files.map(file => 
      processScan(file, mode, req.user.id)
        .catch(err => ({ filename: file.filename, error: err.message }))
    );

    const items = await Promise.all(scanPromises);
    res.json({ items });
  } catch (err) { next(err); }
});

// ── GET /api/scans (auth, paginated) ─────────────────────────
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const page   = Math.max(1, Number(req.query.page || 1));
    const limit  = Math.min(Number(req.query.limit || 20), 100);
    const offset = (page - 1) * limit;
    const type   = req.query.type || null;

    const whereExtra = type ? `AND result_json->>'subject_type' ILIKE $3` : '';
    const params     = type ? [req.user.id, limit, `%${type}%`, offset] : [req.user.id, limit, offset];
    const offsetParam = type ? '$4' : '$3';

    const [rows, total] = await Promise.all([
      query(
        `SELECT id, filename, cloud_url, result_json, score, mode,
                latitude, longitude, location_name, country, city, created_at
         FROM scans WHERE user_id = $1 ${whereExtra}
         ORDER BY created_at DESC LIMIT $2 OFFSET ${offsetParam}`,
        params
      ),
      query(
        `SELECT COUNT(*) AS total FROM scans WHERE user_id=$1 ${type ? `AND result_json->>'subject_type' ILIKE $2` : ''}`,
        type ? [req.user.id, `%${type}%`] : [req.user.id]
      ),
    ]);

    res.json({
      items: rows.rows.map(r => ({ ...r, url: r.cloud_url || `/uploads/${r.filename}`, result: r.result_json })),
      page, limit,
      total: Number(total.rows[0].total),
      pages: Math.ceil(Number(total.rows[0].total) / limit),
    });
  } catch (err) { next(err); }
});

// ── GET /api/scans/:id/deploy (Maker Mode Python Script) ──────
router.get('/:id/deploy', requireAuth, async (req, res, next) => {
  try {
    const result = await query('SELECT result_json FROM scans WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Scan not found' });
    
    const idea = result.rows[0].result_json.maker_project_idea;
    if (!idea) return res.status(400).json({ error: 'No maker project logic found for this scan' });

    const pythonScript = `
# FloraIQ Autonomous Maker Project: ${idea.title}
# Generated for Raspberry Pi 5 / Arduino
# Agentic AI Logic: ${idea.agentic_logic}

import time

# Hardware Setup (Bill of Materials):
${idea.bill_of_materials.map(m => `# - ${m.item}: ${m.purpose}`).join('\n')}

def run_autonomous_loop():
    print("Starting ${idea.title} autonomous system...")
    # AI Logic Sketch:
    # ${idea.logic_sketch.replace(/\n/g, '\n    # ')}
    pass

if __name__ == "__main__":
    run_autonomous_loop()
`;
    res.setHeader('Content-Type', 'text/x-python');
    res.setHeader('Content-Disposition', `attachment; filename=project_${req.params.id}.py`);
    res.send(pythonScript);
  } catch (err) { next(err); }
});

// ── GET /api/scans/:id ────────────────────────────────────────
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT s.*, u.full_name AS author_name,
              (SELECT COUNT(*) FROM scan_likes WHERE scan_id=s.id) AS like_count,
              (SELECT COUNT(*) FROM scan_comments WHERE scan_id=s.id) AS comment_count
       FROM scans s LEFT JOIN users u ON u.id=s.user_id
       WHERE s.id=$1`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Scan not found' });
    const scan = result.rows[0];

    // Private scan guard
    if (!scan.is_public && (!req.user || req.user.id !== scan.user_id)) {
      return res.status(403).json({ error: 'This scan is private' });
    }

    await query('UPDATE scans SET view_count = view_count + 1 WHERE id=$1', [req.params.id]).catch(() => {});

    // Fetch notes if owner
    let notes = [];
    if (req.user && req.user.id === scan.user_id) {
      const n = await query('SELECT * FROM plant_notes WHERE scan_id=$1 ORDER BY created_at DESC', [req.params.id]);
      notes = n.rows;
    }

    res.json({ ...scan, url: scan.cloud_url || `/uploads/${scan.filename}`, result: scan.result_json, notes });
  } catch (err) { next(err); }
});

// ── PATCH /api/scans/:id (toggle public, add note) ────────────
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const { is_public, note } = req.body;
    const check = await query('SELECT id, user_id FROM scans WHERE id=$1', [req.params.id]);
    if (!check.rows.length || check.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not your scan' });
    }
    if (is_public !== undefined) {
      await query('UPDATE scans SET is_public=$1 WHERE id=$2', [!!is_public, req.params.id]);
    }
    if (note?.trim()) {
      await query('INSERT INTO plant_notes (user_id, scan_id, note) VALUES ($1,$2,$3)', [req.user.id, req.params.id, note.trim()]);
    }
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── DELETE /api/scans/:id ─────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await query('SELECT filename, cloud_url, user_id FROM scans WHERE id=$1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Scan not found' });
    const scan = result.rows[0];
    if (scan.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not your scan' });
    }
    await query('DELETE FROM scans WHERE id=$1', [req.params.id]);
    if (!scan.cloud_url) deleteLocalFile(path.join(uploadDir, scan.filename));
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── POST /api/scans/:id/like ──────────────────────────────────
router.post('/:id/like', requireAuth, async (req, res, next) => {
  try {
    const existing = await query('SELECT id FROM scan_likes WHERE user_id=$1 AND scan_id=$2', [req.user.id, req.params.id]);
    if (existing.rows.length) {
      await query('DELETE FROM scan_likes WHERE user_id=$1 AND scan_id=$2', [req.user.id, req.params.id]);
      res.json({ liked: false });
    } else {
      await query('INSERT INTO scan_likes (user_id, scan_id) VALUES ($1,$2)', [req.user.id, req.params.id]);
      res.json({ liked: true });
    }
  } catch (err) { next(err); }
});

// ── GET /api/scans/:id/comments ───────────────────────────────
router.get('/:id/comments', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT sc.*, u.full_name, u.avatar_url FROM scan_comments sc
       LEFT JOIN users u ON u.id=sc.user_id WHERE sc.scan_id=$1 ORDER BY sc.created_at ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// ── POST /api/scans/:id/comments ──────────────────────────────
router.post('/:id/comments', requireAuth, async (req, res, next) => {
  try {
    const { comment } = req.body;
    if (!comment?.trim()) return res.status(400).json({ error: 'Comment is required' });
    const result = await query(
      'INSERT INTO scan_comments (user_id, scan_id, comment) VALUES ($1,$2,$3) RETURNING *',
      [req.user.id, req.params.id, comment.trim().slice(0, 1000)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
