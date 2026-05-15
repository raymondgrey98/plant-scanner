require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');

const { initDb } = require('./db');
const authRoutes = require('./routes/auth');
const plantRoutes = require('./routes/plants');
const scanRoutes = require('./routes/scans');
const chatRoutes = require('./routes/chat');
const subscriptionRoutes = require('./routes/subscription');
const reminderRoutes = require('./routes/reminders');
const searchRoutes = require('./routes/search');
const { startReminderScheduler } = require('./utils/reminders');

const PORT = process.env.PORT || 3001;
const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const scanLimit = rateLimit({ windowMs: 60_000, max: 10, message: { error: 'Too many scans. Try again in a minute.' } });
const chatLimit = rateLimit({ windowMs: 60_000, max: 20, message: { error: 'Too many messages. Try again in a minute.' } });

app.use('/api/auth', authRoutes);
app.use('/api/plants', plantRoutes);
app.use('/api/scans', scanLimit, scanRoutes);
app.use('/api/chat', chatLimit, chatRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/search', searchRoutes);

app.get('/api/status', (_req, res) => {
  res.json({ status: 'ok', name: 'Plant ID Pro backend' });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

initDb()
  .then(() => {
    startReminderScheduler();
    app.listen(PORT, () => {
      console.log(`Plant ID Pro backend listening on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Database initialization failed', err);
    process.exit(1);
  });
