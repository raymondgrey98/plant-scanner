const express = require('express');
const { query }       = require('../db');
const { optionalAuth }= require('../middleware/auth');

const router = express.Router();

// ── GET /api/map/sightings — species on the map ───────────────
router.get('/sightings', async (req, res, next) => {
  try {
    const { type, country, q, min_lat, max_lat, min_lon, max_lon, limit } = req.query;
    const maxRows = Math.min(Number(limit || 500), 2000);

    const conditions = ['ss.latitude IS NOT NULL'];
    const params     = [];
    let   paramIdx   = 1;

    if (type) { conditions.push(`ss.subject_type ILIKE $${paramIdx++}`); params.push(`%${type}%`); }
    if (country) { conditions.push(`ss.country ILIKE $${paramIdx++}`); params.push(`%${country}%`); }
    if (q) { conditions.push(`(ss.scientific_name ILIKE $${paramIdx} OR ss.common_name ILIKE $${paramIdx})`); params.push(`%${q}%`); paramIdx++; }
    if (min_lat) { conditions.push(`ss.latitude >= $${paramIdx++}`); params.push(Number(min_lat)); }
    if (max_lat) { conditions.push(`ss.latitude <= $${paramIdx++}`); params.push(Number(max_lat)); }
    if (min_lon) { conditions.push(`ss.longitude >= $${paramIdx++}`); params.push(Number(min_lon)); }
    if (max_lon) { conditions.push(`ss.longitude <= $${paramIdx++}`); params.push(Number(max_lon)); }

    params.push(maxRows);
    const result = await query(
      `SELECT ss.id, ss.scientific_name, ss.common_name, ss.subject_type,
              ss.latitude, ss.longitude, ss.altitude_m,
              ss.country, ss.state, ss.city, ss.location_name,
              ss.created_at,
              s.cloud_url AS scan_url, s.filename AS scan_filename
       FROM species_sightings ss
       LEFT JOIN scans s ON s.id = ss.scan_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ss.created_at DESC
       LIMIT $${paramIdx}`,
      params
    );

    res.json({
      sightings: result.rows.map(r => ({
        ...r,
        scan_url: r.scan_url || (r.scan_filename ? `/uploads/${r.scan_filename}` : null),
      })),
      total: result.rows.length,
    });
  } catch (err) { next(err); }
});

// ── GET /api/map/heatmap — species density clusters ──────────
router.get('/heatmap', async (req, res, next) => {
  try {
    const type = req.query.type || null;
    const params = type ? [`%${type}%`] : [];
    const whereType = type ? `WHERE subject_type ILIKE $1` : '';

    const result = await query(
      `SELECT
         ROUND(latitude::numeric, 1)  AS lat,
         ROUND(longitude::numeric, 1) AS lon,
         COUNT(*) AS count,
         subject_type
       FROM species_sightings
       ${whereType}
       GROUP BY ROUND(latitude::numeric,1), ROUND(longitude::numeric,1), subject_type
       ORDER BY count DESC LIMIT 1000`,
      params
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// ── GET /api/map/trails — public hiker trail check-ins ────────
router.get('/trails', optionalAuth, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT hc.latitude, hc.longitude, hc.altitude_m, hc.created_at,
              hc.location_name, hc.note,
              ht.trip_name, ht.country,
              u.full_name AS hiker_name
       FROM hiker_checkins hc
       JOIN hiker_trails ht ON ht.id = hc.trail_id
       JOIN users u ON u.id = hc.user_id
       WHERE hc.latitude IS NOT NULL AND ht.status != 'sos'
       ORDER BY hc.created_at DESC LIMIT 300`
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// ── GET /api/map/species/:scientific_name — where found globally
router.get('/species/:name', async (req, res, next) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const [dbResult, gbifResult] = await Promise.allSettled([
      query(
        `SELECT latitude, longitude, country, state, city, location_name, created_at
         FROM species_sightings
         WHERE scientific_name ILIKE $1 AND latitude IS NOT NULL
         ORDER BY created_at DESC LIMIT 200`,
        [`%${name}%`]
      ),
      fetch(`https://api.gbif.org/v1/occurrence/search?scientificName=${encodeURIComponent(name)}&hasCoordinate=true&limit=100`)
        .then(r => r.ok ? r.json() : null).catch(() => null),
    ]);

    const local = dbResult.status === 'fulfilled' ? dbResult.value.rows : [];
    let gbif = [];
    if (gbifResult.status === 'fulfilled' && gbifResult.value) {
      gbif = (gbifResult.value.results || []).map(r => ({
        latitude:   r.decimalLatitude,
        longitude:  r.decimalLongitude,
        country:    r.countryCode,
        source:     'gbif',
      })).filter(r => r.latitude && r.longitude);
    }

    res.json({ local, gbif, total: local.length + gbif.length });
  } catch (err) { next(err); }
});

// ── GET /api/map/stats — global statistics ────────────────────
router.get('/stats', async (_req, res, next) => {
  try {
    const [totalSightings, countries, types, recentSightings] = await Promise.all([
      query('SELECT COUNT(*) AS total FROM species_sightings'),
      query('SELECT COUNT(DISTINCT country) AS count FROM species_sightings WHERE country IS NOT NULL'),
      query('SELECT subject_type, COUNT(*) AS count FROM species_sightings GROUP BY subject_type ORDER BY count DESC'),
      query('SELECT scientific_name, common_name, subject_type, country, city, created_at FROM species_sightings ORDER BY created_at DESC LIMIT 10'),
    ]);
    res.json({
      total_sightings: Number(totalSightings.rows[0].total),
      countries_covered: Number(countries.rows[0].count),
      by_type: types.rows,
      recent: recentSightings.rows,
    });
  } catch (err) { next(err); }
});

module.exports = router;
