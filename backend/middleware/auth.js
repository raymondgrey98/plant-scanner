const jwt = require('jsonwebtoken');
const { query } = require('../db');

const JWT_SECRET         = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_refresh';

if (!JWT_SECRET) throw new Error('JWT_SECRET is required in .env');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const result = await query(
      'SELECT id, email, full_name, avatar_url, role, subscription_status, subscription_end, scan_count, is_verified, is_banned FROM users WHERE id = $1',
      [payload.userId]
    );
    if (!result.rows.length) return res.status(401).json({ error: 'User not found' });
    const user = result.rows[0];
    if (user.is_banned) return res.status(403).json({ error: 'Account suspended. Contact support.' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

async function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return next();
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const result = await query(
      'SELECT id, email, full_name, avatar_url, role, subscription_status, scan_count, is_verified FROM users WHERE id = $1 AND is_banned = FALSE',
      [payload.userId]
    );
    if (result.rows.length) req.user = result.rows[0];
  } catch { /* continue without auth */ }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

function requirePremium(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  const isPremium = req.user.subscription_status === 'premium';
  const notExpired = !req.user.subscription_end || new Date(req.user.subscription_end) > new Date();
  if (!isPremium || !notExpired) {
    return res.status(402).json({
      error: 'Premium subscription required',
      upgrade_url: '/pricing',
    });
  }
  next();
}

function createToken(user) {
  return jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '15m' });
}

function createRefreshToken(user) {
  return jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, { expiresIn: '30d' });
}

function verifyRefreshToken(token) {
  return jwt.verify(token, JWT_REFRESH_SECRET);
}

module.exports = { requireAuth, optionalAuth, requireAdmin, requirePremium, createToken, createRefreshToken, verifyRefreshToken };
