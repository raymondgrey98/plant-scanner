const { Pool } = require('pg');
const { generatePlantRows } = require('./data/plant-seed');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      stripe_customer_id TEXT,
      subscription_status TEXT NOT NULL DEFAULT 'free',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS plants (
      id SERIAL PRIMARY KEY,
      scientific_name TEXT,
      common_name TEXT,
      care_summary TEXT,
      watering TEXT,
      fertilizer TEXT,
      sunlight TEXT,
      soil TEXT,
      propagation TEXT,
      uses TEXT,
      image_url TEXT,
      habitat TEXT,
      disease TEXT,
      pest TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS scans (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      plant_id INTEGER REFERENCES plants(id) ON DELETE SET NULL,
      filename TEXT NOT NULL,
      result_json JSONB NOT NULL,
      score REAL DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      scan_id INTEGER REFERENCES scans(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      channel TEXT NOT NULL DEFAULT 'email',
      destination TEXT NOT NULL,
      cron_expression TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      last_sent TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      question TEXT NOT NULL,
      response JSONB NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='plants' AND column_name='disease') THEN
        ALTER TABLE plants ADD COLUMN disease TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='plants' AND column_name='pest') THEN
        ALTER TABLE plants ADD COLUMN pest TEXT;
      END IF;
    END $$;
  `);

  await pool.query(`
    ALTER TABLE chat_messages ALTER COLUMN user_id DROP NOT NULL;
  `);

  // ── Organisms table (all non-plant types + harvested species) ─────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS organisms (
      id               SERIAL PRIMARY KEY,
      common_name      TEXT,
      scientific_name  TEXT NOT NULL,
      subject_type     TEXT NOT NULL DEFAULT 'plant',
      kingdom          TEXT,
      phylum           TEXT,
      taxon_class      TEXT,
      taxon_order      TEXT,
      family           TEXT,
      genus            TEXT,
      description      TEXT,
      habitat          TEXT,
      distribution     TEXT,
      uses             TEXT,
      toxicity         TEXT,
      behavior         TEXT,
      conservation_status TEXT,
      image_url        TEXT,
      source           TEXT NOT NULL DEFAULT 'gbif',
      external_id      TEXT UNIQUE,
      observations_count INTEGER DEFAULT 0,
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      search_vec       TSVECTOR
    );
    CREATE INDEX IF NOT EXISTS idx_organisms_search  ON organisms USING GIN(search_vec);
    CREATE INDEX IF NOT EXISTS idx_organisms_type    ON organisms(subject_type);
    CREATE INDEX IF NOT EXISTS idx_organisms_family  ON organisms(family);
  `);

  // ── Full-text search on plants table ─────────────────────────────
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='plants' AND column_name='search_vec'
      ) THEN
        ALTER TABLE plants ADD COLUMN search_vec TSVECTOR;
      END IF;
    END $$;
  `);

  await pool.query(`
    CREATE OR REPLACE FUNCTION _plants_fts() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      NEW.search_vec := to_tsvector('english',
        coalesce(NEW.common_name,'')    || ' ' ||
        coalesce(NEW.scientific_name,'')|| ' ' ||
        coalesce(NEW.habitat,'')        || ' ' ||
        coalesce(NEW.uses,'')           || ' ' ||
        coalesce(NEW.disease,'')        || ' ' ||
        coalesce(NEW.pest,'')           || ' ' ||
        coalesce(NEW.care_summary,'')
      );
      RETURN NEW;
    END $$;
  `);

  await pool.query(`
    DROP TRIGGER IF EXISTS plants_fts_trig ON plants;
    CREATE TRIGGER plants_fts_trig
      BEFORE INSERT OR UPDATE ON plants
      FOR EACH ROW EXECUTE FUNCTION _plants_fts();
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_plants_search ON plants USING GIN(search_vec);
    UPDATE plants
    SET search_vec = to_tsvector('english',
      coalesce(common_name,'')    || ' ' ||
      coalesce(scientific_name,'')|| ' ' ||
      coalesce(habitat,'')        || ' ' ||
      coalesce(uses,'')           || ' ' ||
      coalesce(disease,'')        || ' ' ||
      coalesce(pest,'')           || ' ' ||
      coalesce(care_summary,'')
    ) WHERE search_vec IS NULL;
  `);

  const existing = await pool.query('SELECT COUNT(*) AS count FROM plants');
  const count = Number(existing.rows[0].count);
  if (count === 0) {
    const rows = generatePlantRows();
    const values = rows.map((_, i) =>
      `($${i*13+1},$${i*13+2},$${i*13+3},$${i*13+4},$${i*13+5},$${i*13+6},$${i*13+7},$${i*13+8},$${i*13+9},$${i*13+10},$${i*13+11},$${i*13+12},$${i*13+13})`
    ).join(', ');
    const params = rows.flatMap((p) => [
      p.scientific_name, p.common_name, p.care_summary, p.watering,
      p.fertilizer, p.sunlight, p.soil, p.propagation, p.uses,
      p.image_url, p.habitat, p.disease, p.pest,
    ]);
    await pool.query(
      `INSERT INTO plants (scientific_name,common_name,care_summary,watering,fertilizer,sunlight,soil,propagation,uses,image_url,habitat,disease,pest) VALUES ${values}`,
      params
    );
  }
}

async function query(text, params) {
  return pool.query(text, params);
}

module.exports = { initDb, query };
