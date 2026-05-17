const fs   = require('fs');
const path = require('path');

const LOG_DIR  = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');
const ERR_FILE = path.join(LOG_DIR, 'error.log');

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const LEVELS = { error: 0, warn: 1, info: 2, http: 3, debug: 4 };
const COLORS = { error: '\x1b[31m', warn: '\x1b[33m', info: '\x1b[32m', http: '\x1b[36m', debug: '\x1b[35m', reset: '\x1b[0m' };

const currentLevel = LEVELS[process.env.LOG_LEVEL] ?? (process.env.NODE_ENV === 'production' ? LEVELS.info : LEVELS.debug);

function formatLine(level, message, meta) {
  const ts   = new Date().toISOString();
  const metaStr = meta ? ' ' + JSON.stringify(meta) : '';
  return `[${ts}] [${level.toUpperCase().padEnd(5)}] ${message}${metaStr}`;
}

function writeToFile(file, line) {
  try { fs.appendFileSync(file, line + '\n'); } catch { /* disk write failure — non-fatal */ }
}

function log(level, message, meta) {
  if (LEVELS[level] > currentLevel) return;
  const line = formatLine(level, message, meta);
  const color = COLORS[level] || '';
  console.log(`${color}${line}${COLORS.reset}`);
  writeToFile(LOG_FILE, line);
  if (level === 'error') writeToFile(ERR_FILE, line);
}

const logger = {
  error: (msg, meta) => log('error', msg, meta),
  warn:  (msg, meta) => log('warn',  msg, meta),
  info:  (msg, meta) => log('info',  msg, meta),
  http:  (msg, meta) => log('http',  msg, meta),
  debug: (msg, meta) => log('debug', msg, meta),
};

function httpLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const ms     = Date.now() - start;
    const status = res.statusCode;
    const color  = status >= 500 ? COLORS.error : status >= 400 ? COLORS.warn : COLORS.http;
    const line   = formatLine('http', `${req.method} ${req.originalUrl} ${status} ${ms}ms`);
    console.log(`${color}${line}${COLORS.reset}`);
    writeToFile(LOG_FILE, line);
  });
  next();
}

module.exports = { logger, httpLogger };
