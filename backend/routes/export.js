const express = require('express');
const { query }       = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function toCSV(rows, cols) {
  const header = cols.join(',');
  const lines  = rows.map(r =>
    cols.map(c => {
      const v = r[c];
      if (v === null || v === undefined) return '';
      const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')
  );
  return [header, ...lines].join('\n');
}

// ── GET /api/export/scans.csv ─────────────────────────────────
router.get('/scans.csv', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, mode,
              result_json->>'common_name'    AS common_name,
              result_json->>'scientific_name' AS scientific_name,
              result_json->>'subject_type'    AS subject_type,
              result_json->>'confidence'      AS confidence,
              result_json->>'disease'         AS disease,
              result_json->>'edibility'       AS edibility,
              result_json->>'toxicity'        AS toxicity,
              result_json->>'habitat'         AS habitat,
              result_json->>'distribution'    AS distribution,
              result_json->>'conservation_status' AS conservation_status,
              latitude, longitude, country, state, city, location_name,
              score, created_at
       FROM scans WHERE user_id=$1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    const cols = ['id','common_name','scientific_name','subject_type','confidence','disease','edibility','toxicity',
                  'habitat','distribution','conservation_status','latitude','longitude','country','state','city',
                  'location_name','score','mode','created_at'];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="floraiq-scans.csv"');
    res.send(toCSV(result.rows, cols));
  } catch (err) { next(err); }
});

// ── GET /api/export/journal.csv ───────────────────────────────
router.get('/journal.csv', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id, title, plant_name, scientific_name, notes, height_cm, health_score, tags, weather_at_time, created_at FROM growth_journal WHERE user_id=$1 ORDER BY created_at DESC',
      [req.user.id]
    );
    const cols = ['id','title','plant_name','scientific_name','notes','height_cm','health_score','tags','weather_at_time','created_at'];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="floraiq-journal.csv"');
    res.send(toCSV(result.rows, cols));
  } catch (err) { next(err); }
});

// ── GET /api/export/sightings.csv ─────────────────────────────
router.get('/sightings.csv', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT ss.id, ss.scientific_name, ss.common_name, ss.subject_type,
              ss.latitude, ss.longitude, ss.altitude_m, ss.country, ss.state, ss.city, ss.location_name, ss.created_at
       FROM species_sightings ss
       WHERE ss.user_id=$1 ORDER BY ss.created_at DESC`,
      [req.user.id]
    );
    const cols = ['id','scientific_name','common_name','subject_type','latitude','longitude','altitude_m','country','state','city','location_name','created_at'];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="floraiq-sightings.csv"');
    res.send(toCSV(result.rows, cols));
  } catch (err) { next(err); }
});

// ── GET /api/export/plants.csv (public plant library) ─────────
router.get('/plants.csv', async (_req, res, next) => {
  try {
    const result = await query(
      'SELECT id, common_name, scientific_name, care_summary, watering, fertilizer, sunlight, soil, habitat, disease, pest, uses FROM plants ORDER BY common_name'
    );
    const cols = ['id','common_name','scientific_name','care_summary','watering','fertilizer','sunlight','soil','habitat','disease','pest','uses'];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="floraiq-plants.csv"');
    res.send(toCSV(result.rows, cols));
  } catch (err) { next(err); }
});

module.exports = router;
