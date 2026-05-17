const express  = require('express');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const { query }                                                              = require('../db');
const { createToken, createRefreshToken, verifyRefreshToken, requireAuth }   = require('../middleware/auth');
const {
  sendWelcomeEmail, sendVerificationEmail, sendPasswordResetEmail,
} = require('../utils/email');

const router = express.Router();

// ── POST /api/auth/signup ─────────────────────────────────────
router.post('/signup', async (req, res, next) => {
  try {
    const { email, password, full_name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    if (password.length < 8)  return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const result = await query(
      'INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id, email, full_name, subscription_status, role, is_verified',
      [email.toLowerCase().trim(), hashedPassword, full_name?.trim() || null]
    );
    const user         = result.rows[0];
    const token        = createToken(user);
    const refreshToken = createRefreshToken(user);
    const expiresAt    = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await query('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1,$2,$3)', [user.id, refreshToken, expiresAt]);
    await query('INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [user.id]);
    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    // Send verification email + welcome
    const verifyToken = crypto.randomBytes(32).toString('hex');
    await query('INSERT INTO email_verifications (user_id, token) VALUES ($1,$2)', [user.id, verifyToken]);
    sendVerificationEmail(email, verifyToken).catch(() => {});
    sendWelcomeEmail(email, full_name).catch(() => {});

    // Welcome notification
    await query(
      'INSERT INTO notifications (user_id, type, title, message) VALUES ($1,$2,$3,$4)',
      [user.id, 'welcome', 'Welcome to FloraIQ!', 'Start by scanning your first plant, insect, or bird.']
    );

    res.status(201).json({ user: { id: user.id, email: user.email, full_name: user.full_name, subscription_status: user.subscription_status, role: user.role, is_verified: user.is_verified }, token, refreshToken });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    next(err);
  }
});

// ── POST /api/auth/login ──────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const result = await query(
      'SELECT id, email, password_hash, full_name, avatar_url, subscription_status, subscription_end, role, is_verified, is_banned, scan_count FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (user.is_banned) return res.status(403).json({ error: 'Account suspended. Contact support@floraiq.app' });

    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const token        = createToken(user);
    const refreshToken = createRefreshToken(user);
    const expiresAt    = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await query('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1,$2,$3)', [user.id, refreshToken, expiresAt]);

    const { password_hash, ...safeUser } = user;
    res.json({ user: safeUser, token, refreshToken });
  } catch (err) { next(err); }
});

// ── POST /api/auth/refresh ────────────────────────────────────
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

    let payload;
    try { payload = verifyRefreshToken(refreshToken); }
    catch { return res.status(401).json({ error: 'Invalid or expired refresh token' }); }

    const stored = await query(
      'SELECT * FROM refresh_tokens WHERE token=$1 AND expires_at > NOW()',
      [refreshToken]
    );
    if (!stored.rows.length) return res.status(401).json({ error: 'Refresh token not found or expired' });

    const userResult = await query(
      'SELECT id, email, full_name, avatar_url, subscription_status, role, is_verified, is_banned FROM users WHERE id=$1',
      [payload.userId]
    );
    const user = userResult.rows[0];
    if (!user || user.is_banned) return res.status(401).json({ error: 'Account not accessible' });

    // Rotate refresh token
    await query('DELETE FROM refresh_tokens WHERE token=$1', [refreshToken]);
    const newRefreshToken = createRefreshToken(user);
    const expiresAt       = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await query('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1,$2,$3)', [user.id, newRefreshToken, expiresAt]);

    res.json({ token: createToken(user), refreshToken: newRefreshToken });
  } catch (err) { next(err); }
});

// ── POST /api/auth/logout ─────────────────────────────────────
router.post('/logout', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await query('DELETE FROM refresh_tokens WHERE token=$1', [refreshToken]);
    }
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── GET /api/auth/me ──────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  const unread = await query('SELECT COUNT(*) AS count FROM notifications WHERE user_id=$1 AND read=FALSE', [req.user.id]);
  res.json({ user: req.user, unreadNotifications: Number(unread.rows[0].count) });
});

// ── PUT /api/auth/profile ─────────────────────────────────────
router.put('/profile', requireAuth, async (req, res, next) => {
  try {
    const { full_name, bio, avatar_url } = req.body;
    const result = await query(
      'UPDATE users SET full_name=COALESCE($1,full_name), bio=COALESCE($2,bio), avatar_url=COALESCE($3,avatar_url) WHERE id=$4 RETURNING id, email, full_name, bio, avatar_url, subscription_status, role, is_verified, scan_count',
      [full_name?.trim() || null, bio?.trim() || null, avatar_url?.trim() || null, req.user.id]
    );
    res.json({ user: result.rows[0] });
  } catch (err) { next(err); }
});

// ── PUT /api/auth/settings ────────────────────────────────────
router.put('/settings', requireAuth, async (req, res, next) => {
  try {
    const { email_notifications, scan_privacy, default_scan_mode, timezone, units, language } = req.body;
    await query(
      `INSERT INTO user_settings (user_id, email_notifications, scan_privacy, default_scan_mode, timezone, units, language, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
       ON CONFLICT (user_id) DO UPDATE
         SET email_notifications = COALESCE($2, user_settings.email_notifications),
             scan_privacy        = COALESCE($3, user_settings.scan_privacy),
             default_scan_mode   = COALESCE($4, user_settings.default_scan_mode),
             timezone            = COALESCE($5, user_settings.timezone),
             units               = COALESCE($6, user_settings.units),
             language            = COALESCE($7, user_settings.language),
             updated_at          = NOW()`,
      [req.user.id, email_notifications ?? null, scan_privacy || null, default_scan_mode || null, timezone || null, units || null, language || null]
    );
    const result = await query('SELECT * FROM user_settings WHERE user_id=$1', [req.user.id]);
    res.json({ settings: result.rows[0] });
  } catch (err) { next(err); }
});

// ── GET /api/auth/settings ────────────────────────────────────
router.get('/settings', requireAuth, async (req, res, next) => {
  try {
    await query('INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [req.user.id]);
    const result = await query('SELECT * FROM user_settings WHERE user_id=$1', [req.user.id]);
    res.json({ settings: result.rows[0] });
  } catch (err) { next(err); }
});

// ── POST /api/auth/change-password ────────────────────────────
router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'Both passwords are required' });
    if (new_password.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });

    const result = await query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
    const valid  = await bcrypt.compare(current_password, result.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(new_password, 12);
    await query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.user.id]);
    await query('DELETE FROM refresh_tokens WHERE user_id=$1', [req.user.id]);
    await query('INSERT INTO audit_log (user_id, action, resource) VALUES ($1,$2,$3)', [req.user.id, 'password_change', 'auth']);
    res.json({ success: true, message: 'Password changed. All other sessions have been logged out.' });
  } catch (err) { next(err); }
});

// ── POST /api/auth/forgot-password ───────────────────────────
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const result = await query('SELECT id FROM users WHERE email=$1', [email.toLowerCase().trim()]);
    // Always respond OK to prevent email enumeration
    if (!result.rows.length) return res.json({ message: 'If that email exists, a reset link has been sent.' });

    const userId = result.rows[0].id;
    const token  = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await query('UPDATE password_resets SET used=TRUE WHERE user_id=$1 AND used=FALSE', [userId]);
    await query('INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1,$2,$3)', [userId, token, expiry]);
    await sendPasswordResetEmail(email, token);

    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) { next(err); }
});

// ── POST /api/auth/reset-password ────────────────────────────
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, new_password } = req.body;
    if (!token || !new_password) return res.status(400).json({ error: 'Token and new password are required' });
    if (new_password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const result = await query(
      'SELECT user_id FROM password_resets WHERE token=$1 AND used=FALSE AND expires_at > NOW()',
      [token]
    );
    if (!result.rows.length) return res.status(400).json({ error: 'Reset token is invalid or has expired' });

    const userId = result.rows[0].user_id;
    const hash   = await bcrypt.hash(new_password, 12);
    await query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, userId]);
    await query('UPDATE password_resets SET used=TRUE WHERE token=$1', [token]);
    await query('DELETE FROM refresh_tokens WHERE user_id=$1', [userId]);
    await query('INSERT INTO audit_log (user_id, action) VALUES ($1,$2)', [userId, 'password_reset']);

    res.json({ success: true, message: 'Password reset successfully. Please log in.' });
  } catch (err) { next(err); }
});

// ── POST /api/auth/verify-email ───────────────────────────────
router.post('/verify-email', async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Verification token required' });

    const result = await query(
      'SELECT user_id FROM email_verifications WHERE token=$1 AND verified=FALSE',
      [token]
    );
    if (!result.rows.length) return res.status(400).json({ error: 'Invalid or already-used verification token' });

    const userId = result.rows[0].user_id;
    await query('UPDATE users SET is_verified=TRUE WHERE id=$1', [userId]);
    await query('UPDATE email_verifications SET verified=TRUE WHERE token=$1', [token]);
    await query('INSERT INTO user_achievements (user_id, achievement_key) VALUES ($1,$2) ON CONFLICT DO NOTHING', [userId, 'email_verified']);

    res.json({ success: true, message: 'Email verified successfully!' });
  } catch (err) { next(err); }
});

// ── POST /api/auth/resend-verification ───────────────────────
router.post('/resend-verification', requireAuth, async (req, res, next) => {
  try {
    if (req.user.is_verified) return res.status(400).json({ error: 'Email is already verified' });
    await query('DELETE FROM email_verifications WHERE user_id=$1', [req.user.id]);
    const token = crypto.randomBytes(32).toString('hex');
    await query('INSERT INTO email_verifications (user_id, token) VALUES ($1,$2)', [req.user.id, token]);
    await sendVerificationEmail(req.user.email, token);
    res.json({ success: true, message: 'Verification email sent.' });
  } catch (err) { next(err); }
});

// ── GET /api/auth/achievements ────────────────────────────────
router.get('/achievements', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      'SELECT achievement_key, earned_at FROM user_achievements WHERE user_id=$1 ORDER BY earned_at DESC',
      [req.user.id]
    );
    res.json({ achievements: result.rows });
  } catch (err) { next(err); }
});

// ── GET /api/auth/stats ───────────────────────────────────────
router.get('/stats', requireAuth, async (req, res, next) => {
  try {
    const [scans, journal, favorites, collections] = await Promise.all([
      query('SELECT COUNT(*) AS total, COUNT(DISTINCT (result_json->>\'subject_type\')) AS unique_types FROM scans WHERE user_id=$1', [req.user.id]),
      query('SELECT COUNT(*) AS total FROM growth_journal WHERE user_id=$1', [req.user.id]),
      query('SELECT COUNT(*) AS total FROM favorites WHERE user_id=$1', [req.user.id]),
      query('SELECT COUNT(*) AS total FROM collections WHERE user_id=$1', [req.user.id]),
    ]);
    res.json({
      scans:         Number(scans.rows[0].total),
      unique_types:  Number(scans.rows[0].unique_types),
      journal:       Number(journal.rows[0].total),
      favorites:     Number(favorites.rows[0].total),
      collections:   Number(collections.rows[0].total),
      member_since:  req.user.created_at,
    });
  } catch (err) { next(err); }
});

module.exports = router;
