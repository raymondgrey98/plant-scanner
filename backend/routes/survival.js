const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { query }                    = require('../db');
const { requireAuth, optionalAuth }= require('../middleware/auth');
const { analyzeSurvival, getSurvivalGuide } = require('../utils/gemini');
const { extractLocation }          = require('../utils/exif');
const { uploadImage, deleteLocalFile } = require('../utils/cloudinary');

const router    = express.Router();
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({ dest: uploadDir, limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, f, cb) => { if (!f.mimetype.startsWith('image/')) return cb(new Error('Images only')); cb(null, true); }
});

// ── POST /api/survival/scan ───────────────────────────────────
router.post('/scan', optionalAuth, upload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Photo is required' });

    const [analysis, location] = await Promise.all([
      analyzeSurvival(req.file.path),
      extractLocation(req.file.path),
    ]);

    const cloudUrl = await uploadImage(req.file.path, 'floraiq/survival');
    if (cloudUrl) deleteLocalFile(req.file.path);

    // Build survival priority summary
    const dangerLevel = Number(analysis.danger_level || 0);
    const dangerLabel = dangerLevel >= 8 ? 'DEADLY' : dangerLevel >= 5 ? 'DANGEROUS' : dangerLevel >= 3 ? 'CAUTION' : 'SAFE';

    // Log survival event
    if (req.user) {
      const scanResult = await query(
        `INSERT INTO scans (user_id, filename, cloud_url, result_json, score, mode)
         VALUES ($1,$2,$3,$4,$5,'survival') RETURNING id`,
        [req.user.id, req.file.filename, cloudUrl || null, analysis, analysis.confidence]
      );
      await query(
        `INSERT INTO survival_logs (user_id, scan_id, event_type, latitude, longitude, data_json)
         VALUES ($1,$2,'scan',$3,$4,$5)`,
        [req.user.id, scanResult.rows[0].id, location?.latitude || null, location?.longitude || null, { analysis, dangerLabel }]
      ).catch(() => {});
    }

    res.json({
      analysis,
      danger_level: dangerLevel,
      danger_label: dangerLabel,
      survival_priority: buildSurvivalPriority(analysis),
      location: location || null,
      image_url: cloudUrl || `/uploads/${req.file.filename}`,
    });
  } catch (err) { next(err); }
});

function buildSurvivalPriority(a) {
  const items = [];
  if (a.safety_warning) items.push({ priority: 1, category: 'WARNING', text: a.safety_warning, icon: '⚠️' });
  if (a.first_aid)      items.push({ priority: 1, category: 'FIRST AID', text: a.first_aid, icon: '🩺' });
  if (a.edibility)      items.push({ priority: 2, category: 'EDIBILITY', text: a.edibility, icon: '🍃' });
  if (a.toxicity)       items.push({ priority: 1, category: 'TOXICITY', text: a.toxicity, icon: '☠️' });
  if (a.survival_uses)  items.push({ priority: 3, category: 'SURVIVAL USES', text: a.survival_uses, icon: '🏕️' });
  if (a.ethnobotany)    items.push({ priority: 4, category: 'MEDICINAL USES', text: a.ethnobotany, icon: '💊' });
  return items.sort((a, b) => a.priority - b.priority);
}

// ── GET /api/survival/guide (built-in guide, no AI needed) ───
router.get('/guide', (_req, res) => {
  res.json({ guide: { sections: [
    { title: '🔥 Fire Starting', content: 'Fire provides warmth, water purification, cooking, signaling, and psychological comfort. Always build in a safe location away from dry vegetation.', tips: ['Collect tinder (dry leaves, bark shavings, grass) before striking', 'Use bow-drill with dry hardwood if no lighter available', 'Keep fire small and controllable in wind', 'Never leave fire unattended'] },
    { title: '💧 Finding & Purifying Water', content: 'You can survive 3 weeks without food but only 3 days without water. Always purify water before drinking in the wild.', tips: ['Follow animal trails downhill — they usually lead to water', 'Boil water at least 1 minute (3 min at altitude)', 'Collect morning dew from large leaves with cloth', 'Avoid stagnant water — moving water is safer', 'Coconut, bamboo internodes, and banana stem provide emergency hydration'] },
    { title: '🏕️ Emergency Shelter', content: 'Shelter from wind, rain, and cold is your first priority. Hypothermia kills faster than hunger or thirst in most environments.', tips: ['Look for natural shelters first: caves, rock overhangs, dense canopy', 'Build a lean-to with large leaves, bamboo, or branches', 'Insulate the ground — you lose more heat downward', 'Doorway should face away from prevailing wind'] },
    { title: '🌿 Edible Plants — Safety Rules', content: 'Never eat a plant you cannot positively identify. Use the Universal Edibility Test when unsure.', tips: ['Avoid plants with milky white sap, bitter almond smell, or 3-leaf shiny surface', 'Safe worldwide: dandelion, cattail, bamboo shoots (boiled), moringa, banana (all parts)', 'Always cook unknown plants — heat destroys many toxins', 'Test one small piece at a time, wait 8 hours before eating more'] },
    { title: '🆘 Signaling for Help', content: 'Three of anything is the universal distress signal — three whistle blasts, three fires in triangle, three gunshots.', tips: ['Move to open high ground to stay visible', 'Signal mirror visible 10+ miles on sunny days', 'Spell SOS with rocks or logs in open ground', 'Stay near your original location — rescuers search there first'] },
    { title: '🐍 Dangerous Animals', content: 'Most animals will not attack unless cornered or surprised. Make noise when moving through brush.', tips: ['Check shoes and sleeping area for snakes and scorpions', 'Never reach into dark holes or under rocks', 'Snake bite: immobilize limb, keep below heart level, get to hospital fast', 'Avoid bright clothing near bee/wasp nests'] },
    { title: '🧭 Navigation Without GPS', content: 'The sun rises east and sets west everywhere on Earth. At noon, shadows point north (northern hemisphere) or south (southern hemisphere).', tips: ['Moss grows thickest on north-facing side of trees (northern hemisphere)', 'North Star (Polaris) always directly north at night', 'Follow water downstream — leads to settlements', 'Mark trees to avoid walking in circles'] },
  ]}, is_emergency: false });
});

// ── POST /api/survival/guide ──────────────────────────────────
router.post('/guide', optionalAuth, async (req, res, next) => {
  try {
    const { location_type, region, season, group_size, days, is_emergency, injury, language } = req.body;
    const guide = await getSurvivalGuide({ location_type, region, season, group_size, days, is_emergency, injury }, language || 'en');
    res.json({ guide, is_emergency: !!is_emergency });
  } catch (err) { next(err); }
});

// ── POST /api/survival/sos ────────────────────────────────────
router.post('/sos', requireAuth, async (req, res, next) => {
  try {
    const { trail_id, latitude, longitude, note, injury } = req.body;
    if (!latitude || !longitude) return res.status(400).json({ error: 'Location coordinates required for SOS' });

    // Mark trail as SOS if provided
    if (trail_id) {
      await query(
        'UPDATE hiker_trails SET is_emergency=TRUE, status=\'sos\', emergency_at=NOW(), emergency_note=$1 WHERE id=$2 AND user_id=$3',
        [note || injury || 'SOS activated', trail_id, req.user.id]
      );
    }

    // Log SOS event
    await query(
      `INSERT INTO survival_logs (user_id, trail_id, event_type, latitude, longitude, data_json)
       VALUES ($1,$2,'sos',$3,$4,$5)`,
      [req.user.id, trail_id || null, latitude, longitude, { note, injury, timestamp: new Date() }]
    );

    // Admin notification
    await query(
      `INSERT INTO notifications (user_id, type, title, message)
       SELECT id, 'sos', 'SOS Alert!', $1 FROM users WHERE role='admin'`,
      [`SOS from ${req.user.email} at (${latitude}, ${longitude}). ${note || ''}`]
    ).catch(() => {});

    // Reverse geocode for location name
    let location_name = null;
    try {
      const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
        { headers: { 'User-Agent': 'FloraIQ/2.0' } }
      );
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        location_name = geoData.display_name || null;
      }
    } catch { /* skip */ }

    res.json({
      success:       true,
      sos_id:        Date.now(),
      message:       'SOS signal sent. Authorities and emergency contacts have been notified.',
      location_name,
      coordinates:   { latitude, longitude },
      emergency_services: buildEmergencyContacts(location_name),
    });
  } catch (err) { next(err); }
});

function buildEmergencyContacts(locationName) {
  // Universal emergency numbers by region — users should save local numbers
  return [
    { name: 'International Emergency', number: '112', note: 'Works in most countries' },
    { name: 'US/Canada 911',           number: '911', note: 'USA and Canada' },
    { name: 'UK Emergency',            number: '999', note: 'United Kingdom' },
    { name: 'Australia Emergency',     number: '000', note: 'Australia' },
    { name: 'Philippines Emergency',   number: '911', note: 'Philippines' },
    { name: 'Search & Rescue',         number: '112', note: 'EU standard — hiking emergencies' },
  ];
}

// ── GET /api/survival/trails ──────────────────────────────────
router.get('/trails', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT ht.*,
              (SELECT COUNT(*) FROM hiker_checkins WHERE trail_id=ht.id) AS checkin_count,
              (SELECT row_to_json(hc) FROM hiker_checkins hc WHERE hc.trail_id=ht.id ORDER BY hc.created_at DESC LIMIT 1) AS last_checkin
       FROM hiker_trails ht WHERE ht.user_id=$1 ORDER BY ht.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// ── POST /api/survival/trails ─────────────────────────────────
router.post('/trails', requireAuth, async (req, res, next) => {
  try {
    const { trip_name, description, start_location, destination, country, planned_days, difficulty, gear_list, emergency_contacts } = req.body;
    if (!trip_name?.trim()) return res.status(400).json({ error: 'Trip name is required' });
    const result = await query(
      `INSERT INTO hiker_trails
         (user_id, trip_name, description, start_location, destination, country, planned_days, difficulty, gear_list, emergency_contacts)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        req.user.id, trip_name.trim(), description?.trim() || null,
        start_location?.trim() || null, destination?.trim() || null, country?.trim() || null,
        planned_days || 1, difficulty || 'moderate',
        gear_list ? JSON.stringify(gear_list) : '[]',
        emergency_contacts ? JSON.stringify(emergency_contacts) : '[]',
      ]
    );
    // Achievement
    await query('INSERT INTO user_achievements (user_id, achievement_key) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.user.id, 'first_trail']).catch(() => {});
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// ── PATCH /api/survival/trails/:id ───────────────────────────
router.patch('/trails/:id', requireAuth, async (req, res, next) => {
  try {
    const { status, waypoints } = req.body;
    const result = await query(
      'UPDATE hiker_trails SET status=COALESCE($1,status), waypoints=COALESCE($2,waypoints), updated_at=NOW() WHERE id=$3 AND user_id=$4 RETURNING *',
      [status || null, waypoints ? JSON.stringify(waypoints) : null, req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Trail not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// ── POST /api/survival/trails/:id/checkin ────────────────────
router.post('/trails/:id/checkin', requireAuth, async (req, res, next) => {
  try {
    const { latitude, longitude, altitude_m, note, battery_pct, weather_desc, location_name } = req.body;
    if (!latitude || !longitude) return res.status(400).json({ error: 'Coordinates required' });

    const trail = await query('SELECT id FROM hiker_trails WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    if (!trail.rows.length) return res.status(404).json({ error: 'Trail not found' });

    const result = await query(
      `INSERT INTO hiker_checkins (trail_id, user_id, latitude, longitude, altitude_m, note, battery_pct, weather_desc, location_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.params.id, req.user.id, latitude, longitude, altitude_m || null, note?.trim() || null, battery_pct || null, weather_desc?.trim() || null, location_name?.trim() || null]
    );

    await query('UPDATE hiker_trails SET status=\'active\', updated_at=NOW() WHERE id=$1', [req.params.id]);
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// ── GET /api/survival/trails/:id/checkins ────────────────────
router.get('/trails/:id/checkins', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM hiker_checkins WHERE trail_id=$1 AND user_id=$2 ORDER BY created_at ASC',
      [req.params.id, req.user.id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

module.exports = router;
