require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { insertScan, listScans } = require('./db');
const { analyzePlant } = require('./gemini');

const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safeExt = path.extname(file.originalname).toLowerCase() || '.jpg';
    const stamp = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, stamp + safeExt);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));

app.post('/api/scan', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No photo uploaded' });

  try {
    const result = await analyzePlant(req.file.path);
    const id = insertScan({ filename: req.file.filename, ...result });
    res.json({
      id,
      filename: req.file.filename,
      url: `/uploads/${req.file.filename}`,
      ...result,
    });
  } catch (err) {
    console.error('scan error:', err);
    res.status(500).json({ error: err.message || 'Scan failed' });
  }
});

app.get('/api/history', (_req, res) => {
  const rows = listScans().map((r) => ({ ...r, url: `/uploads/${r.filename}` }));
  res.json(rows);
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(400).json({ error: err.message || 'Bad request' });
});

app.listen(PORT, () => {
  console.log(`Plant Scanner listening on http://localhost:${PORT}`);
});
