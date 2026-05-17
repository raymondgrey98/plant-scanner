const express = require('express');
const { query }                    = require('../db');
const { requireAuth, requireAdmin }= require('../middleware/auth');
const { sendBanNotificationEmail } = require('../utils/email');

const router = express.Router();
router.use(requireAuth, requireAdmin);

// ── GET /api/admin/stats ──────────────────────────────────────
router.get('/stats', async (_req, res, next) => {
  try {
    const [users, scans, plants, orgs, sightings, trails, premiums, journals] = await Promise.all([
      query('SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE created_at > NOW()-INTERVAL\'7d\') AS new_week FROM users'),
      query('SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE created_at > NOW()-INTERVAL\'24h\') AS today FROM scans'),
      query('SELECT COUNT(*) AS total FROM plants'),
      query('SELECT COUNT(*) AS total FROM organisms'),
      query('SELECT COUNT(*) AS total FROM species_sightings'),
      query('SELECT COUNT(*) AS total FROM hiker_trails'),
      query('SELECT COUNT(*) AS total FROM users WHERE subscription_status=\'premium\''),
      query('SELECT COUNT(*) AS total FROM growth_journal'),
    ]);

    const topScans = await query(
      `SELECT result_json->>'subject_type' AS type, COUNT(*) AS count
       FROM scans GROUP BY type ORDER BY count DESC LIMIT 10`
    );

    const dailyScans = await query(
      `SELECT DATE(created_at) AS day, COUNT(*) AS count
       FROM scans WHERE created_at > NOW()-INTERVAL'30d'
       GROUP BY day ORDER BY day ASC`
    );

    const topCountries = await query(
      `SELECT country, COUNT(*) AS count FROM species_sightings
       WHERE country IS NOT NULL GROUP BY country ORDER BY count DESC LIMIT 15`
    );

    res.json({
      users:        { total: Number(users.rows[0].total), new_week: Number(users.rows[0].new_week) },
      scans:        { total: Number(scans.rows[0].total), today: Number(scans.rows[0].today) },
      plants:       Number(plants.rows[0].total),
      organisms:    Number(orgs.rows[0].total),
      sightings:    Number(sightings.rows[0].total),
      trails:       Number(trails.rows[0].total),
      premium:      Number(premiums.rows[0].total),
      journals:     Number(journals.rows[0].total),
      scan_types:   topScans.rows,
      daily_scans:  dailyScans.rows,
      top_countries: topCountries.rows,
    });
  } catch (err) { next(err); }
});

// ── GET /api/admin/users ──────────────────────────────────────
router.get('/users', async (req, res, next) => {
  try {
    const page   = Math.max(1, Number(req.query.page || 1));
    const limit  = Math.min(Number(req.query.limit || 50), 200);
    const offset = (page - 1) * limit;
    const search = req.query.search?.trim() || null;

    const params     = search ? [`%${search}%`, limit, offset] : [limit, offset];
    const whereSearch = search ? 'WHERE email ILIKE $1 OR full_name ILIKE $1' : '';
    const limitParam  = search ? '$2' : '$1';
    const offsetParam = search ? '$3' : '$2';

    const [rows, total] = await Promise.all([
      query(
        `SELECT id, email, full_name, role, subscription_status, scan_count,
                is_verified, is_banned, last_login, created_at
         FROM users ${whereSearch} ORDER BY created_at DESC LIMIT ${limitParam} OFFSET ${offsetParam}`,
        params
      ),
      query(`SELECT COUNT(*) AS total FROM users ${whereSearch}`, search ? [`%${search}%`] : []),
    ]);

    res.json({ items: rows.rows, page, limit, total: Number(total.rows[0].total) });
  } catch (err) { next(err); }
});

// ── PUT /api/admin/users/:id/ban ──────────────────────────────
router.put('/users/:id/ban', async (req, res, next) => {
  try {
    const { reason } = req.body;
    const result = await query(
      'UPDATE users SET is_banned=TRUE WHERE id=$1 RETURNING id, email, full_name',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    const u = result.rows[0];
    sendBanNotificationEmail(u.email, reason).catch(() => {});
    await query('INSERT INTO audit_log (user_id, action, resource) VALUES ($1,$2,$3)', [req.user.id, 'ban_user', `user:${req.params.id}`]);
    res.json({ success: true, user: u });
  } catch (err) { next(err); }
});

// ── PUT /api/admin/users/:id/unban ────────────────────────────
router.put('/users/:id/unban', async (req, res, next) => {
  try {
    const result = await query(
      'UPDATE users SET is_banned=FALSE WHERE id=$1 RETURNING id, email',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    await query('INSERT INTO audit_log (user_id, action, resource) VALUES ($1,$2,$3)', [req.user.id, 'unban_user', `user:${req.params.id}`]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── PUT /api/admin/users/:id/role ─────────────────────────────
router.put('/users/:id/role', async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'Role must be user or admin' });
    const result = await query('UPDATE users SET role=$1 WHERE id=$2 RETURNING id, email, role', [role, req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    await query('INSERT INTO audit_log (user_id, action, resource) VALUES ($1,$2,$3)', [req.user.id, `set_role_${role}`, `user:${req.params.id}`]);
    res.json({ success: true, user: result.rows[0] });
  } catch (err) { next(err); }
});

// ── PUT /api/admin/users/:id/premium ─────────────────────────
router.put('/users/:id/premium', async (req, res, next) => {
  try {
    const days    = Number(req.body.days || 30);
    const endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const result  = await query(
      'UPDATE users SET subscription_status=\'premium\', subscription_end=$1 WHERE id=$2 RETURNING id, email',
      [endDate, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    await query('INSERT INTO notifications (user_id, type, title, message) VALUES ($1,$2,$3,$4)',
      [req.params.id, 'premium', 'Premium granted!', `Admin has granted you Premium access for ${days} days.`]).catch(() => {});
    res.json({ success: true, ends_at: endDate });
  } catch (err) { next(err); }
});

// ── DELETE /api/admin/scans/:id ───────────────────────────────
router.delete('/scans/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM scans WHERE id=$1', [req.params.id]);
    await query('INSERT INTO audit_log (user_id, action, resource) VALUES ($1,$2,$3)', [req.user.id, 'delete_scan', `scan:${req.params.id}`]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── GET /api/admin/audit ──────────────────────────────────────
router.get('/audit', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT al.*, u.email FROM audit_log al
       LEFT JOIN users u ON u.id=al.user_id
       ORDER BY al.created_at DESC LIMIT 200`
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// ── GET /api/admin/emergency-trails ──────────────────────────
router.get('/emergency-trails', async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT ht.*, u.email, u.full_name,
              (SELECT row_to_json(hc) FROM hiker_checkins hc WHERE hc.trail_id=ht.id ORDER BY hc.created_at DESC LIMIT 1) AS last_checkin
       FROM hiker_trails ht
       JOIN users u ON u.id=ht.user_id
       WHERE ht.is_emergency=TRUE OR ht.status='sos'
       ORDER BY ht.emergency_at DESC NULLS LAST`
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

module.exports = router;
