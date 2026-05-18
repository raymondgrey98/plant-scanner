/**
 * FloraIQ Database Module
 * Supports both PostgreSQL and in-memory mode for development
 */

// In-memory storage for demo mode (no database required)
const inMemoryScans = [];

// Check if we should use in-memory mode
const useMemoryMode = !process.env.DATABASE_URL;

if (useMemoryMode) {
  console.log('[db] Using in-memory storage (demo mode). Set DATABASE_URL for persistent storage.');
}

const pool = useMemoryMode ? null : new (require('pg').Pool)({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon') ? { rejectUnauthorized: false } : false,
});

// Initialize database table if using PostgreSQL
async function initDb() {
  if (useMemoryMode) {
    console.log('[db] In-memory mode active — no database initialization needed');
    return;
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS scans (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL,
        plant_name TEXT,
        disease TEXT,
        fertilizer TEXT,
        soil_advice TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('[db] Database initialized successfully');
  } catch (err) {
    console.error('[db] Init error:', err.message);
  }
}

// Initialize on module load
initDb();

module.exports = {
  // PostgreSQL query method (only available if DATABASE_URL is set)
  query: useMemoryMode 
    ? () => { throw new Error('Database not available in memory mode'); }
    : (text, params) => pool.query(text, params),

  pool: pool,

  // insertScan - works in both modes
  insertScan: async (row) => {
    if (useMemoryMode) {
      const newScan = {
        id: inMemoryScans.length + 1,
        filename: row.filename,
        plant_name: row.plant_name || 'Unknown',
        disease: row.disease || 'Unknown',
        fertilizer: row.fertilizer || 'Unknown',
        soil_advice: row.soil_advice || 'Unknown',
        created_at: new Date().toISOString()
      };
      inMemoryScans.push(newScan);
      return { rows: [newScan] };
    } else {
      return pool.query(
        'INSERT INTO scans (filename, plant_name, disease, fertilizer, soil_advice) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [row.filename, row.plant_name, row.disease, row.fertilizer, row.soil_advice]
      );
    }
  },

  // listScans - works in both modes
  listScans: async () => {
    if (useMemoryMode) {
      // Return a copy sorted by newest first
      return [...inMemoryScans].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 20);
    } else {
      const result = await pool.query('SELECT * FROM scans ORDER BY created_at DESC LIMIT 20');
      return result.rows;
    }
  },
};