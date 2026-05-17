require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const fs         = require('fs');
const cookieParser = require('cookie-parser');
const helmet     = require('helmet');
const { rateLimit } = require('express-rate-limit');

const { initDb }                 = require('./db');
const { httpLogger, logger }     = require('./utils/logger');
const { startReminderScheduler } = require('./utils/reminders');

// ── Routes ────────────────────────────────────────────────────
const authRoutes         = require('./routes/auth');
const plantRoutes        = require('./routes/plants');
const scanRoutes         = require('./routes/scans');
const chatRoutes         = require('./routes/chat');
const subscriptionRoutes = require('./routes/subscription');
const reminderRoutes     = require('./routes/reminders');
const searchRoutes       = require('./routes/search');
const journalRoutes      = require('./routes/journal');
const favoritesRoutes    = require('./routes/favorites');
const adminRoutes        = require('./routes/admin');
const notifRoutes        = require('./routes/notifications');
const exportRoutes       = require('./routes/export');
const weatherRoutes      = require('./routes/weather');
const survivalRoutes     = require('./routes/survival');
const mapRoutes          = require('./routes/map');
const farmingRoutes      = require('./routes/farming');
const landscapeRoutes    = require('./routes/landscape');

const PORT = process.env.PORT || 3001;
const app  = express();

// ── CORS ──────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

// ── Security headers ──────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

// ── Body parsers ──────────────────────────────────────────────
app.use('/api/subscription/stripe/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

// ── Logging ───────────────────────────────────────────────────
app.use(httpLogger);

// ── i18n: expose Accept-Language for routes ───────────────────
app.use((req, _res, next) => {
  const lang = req.headers['accept-language'] || '';
  req.lang   = lang.split(',')[0].split('-')[0].toLowerCase() || 'en';
  next();
});

// ── Rate limiters ─────────────────────────────────────────────
const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20,
  message: { error: 'Too many auth attempts. Try again in 15 minutes.' },
  skipSuccessfulRequests: true,
});
const scanLimit = rateLimit({
  windowMs: 60 * 1000, max: 15,
  message: { error: 'Too many scans. Try again in a minute.' },
});
const chatLimit = rateLimit({
  windowMs: 60 * 1000, max: 30,
  message: { error: 'Too many messages. Try again in a minute.' },
});
const apiLimit = rateLimit({
  windowMs: 60 * 1000, max: 300,
  message: { error: 'Rate limit exceeded.' },
});

// ── Static uploads ────────────────────────────────────────────
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir));

// ── API routes ────────────────────────────────────────────────
app.use('/api',              apiLimit);
app.use('/api/auth',         authLimit,  authRoutes);
app.use('/api/plants',                   plantRoutes);
app.use('/api/scans',        scanLimit,  scanRoutes);
app.use('/api/chat',         chatLimit,  chatRoutes);
app.use('/api/subscription',             subscriptionRoutes);
app.use('/api/reminders',                reminderRoutes);
app.use('/api/search',                   searchRoutes);
app.use('/api/journal',                  journalRoutes);
app.use('/api/favorites',                favoritesRoutes);
app.use('/api/admin',                    adminRoutes);
app.use('/api/notifications',            notifRoutes);
app.use('/api/export',                   exportRoutes);
app.use('/api/weather',                  weatherRoutes);
app.use('/api/survival',     scanLimit,  survivalRoutes);
app.use('/api/map',                      mapRoutes);
app.use('/api/farming',                  farmingRoutes);
app.use('/api/landscape',    scanLimit,  landscapeRoutes);

// ── Health + status ───────────────────────────────────────────
app.get('/api/status', (_req, res) => {
  res.json({
    status:  'ok',
    name:    'FloraIQ API',
    version: '2.0.0',
    features: ['multi-model-ai', 'geolocation', 'survival-toolkit', 'landscape-intelligence', 'cooking-guide', 'hiker-tracking', 'farming-assistant', 'pwa-offline', 'multi-language', 'stripe', 'paypal', 'paymongo'],
    uptime:  process.uptime(),
    env:     process.env.NODE_ENV || 'development',
  });
});

app.get('/api/providers', (_req, res) => {
  res.json({
    ai: {
      gemini:      !!process.env.GEMINI_API_KEY,
      openai:      !!process.env.OPENAI_API_KEY,
      claude:      !!process.env.ANTHROPIC_API_KEY,
      openrouter:  !!process.env.OPENROUTER_API_KEY,
    },
    payments: {
      stripe:      !!process.env.STRIPE_SECRET_KEY,
      paypal:      !!process.env.PAYPAL_CLIENT_ID,
      paymongo:    !!process.env.PAYMONGO_SECRET_KEY,
    },
    storage: {
      cloudinary:  !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY),
    },
    weather: {
      openweathermap: !!process.env.OPENWEATHER_API_KEY,
      open_meteo_fallback: true,
    },
  });
});

// ── Global error handler ──────────────────────────────────────
app.use((err, req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  logger.error(`${req.method} ${req.path} — ${err.message}`, { status, stack: err.stack?.slice(0, 300) });
  res.status(status).json({
    error:   status >= 500 ? 'Internal server error' : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

// ── Start ─────────────────────────────────────────────────────
initDb()
  .then(() => {
    startReminderScheduler();
    app.listen(PORT, () => {
      logger.info(`FloraIQ API v2.0 listening on http://localhost:${PORT}`);
      logger.info(`AI providers: Gemini=${!!process.env.GEMINI_API_KEY} OpenAI=${!!process.env.OPENAI_API_KEY} Claude=${!!process.env.ANTHROPIC_API_KEY} OpenRouter=${!!process.env.OPENROUTER_API_KEY}`);
      logger.info(`Payments: Stripe=${!!process.env.STRIPE_SECRET_KEY} PayPal=${!!process.env.PAYPAL_CLIENT_ID} GCash=${!!process.env.PAYMONGO_SECRET_KEY}`);
    });
  })
  .catch((err) => {
    logger.error('Database initialization failed', { message: err.message });
    process.exit(1);
  });
