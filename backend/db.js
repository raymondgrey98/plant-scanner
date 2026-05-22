const { Pool } = require('pg');
const { generatePlantRows } = require('./data/plant-seed');
const { generateOrganismRows } = require('./data/organism-seed');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon') || process.env.DATABASE_SSL === 'true'
    ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('[db] Unexpected pool error:', err.message);
});

async function initDb() {
  // ── Core tables ───────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id                  SERIAL PRIMARY KEY,
      email               TEXT UNIQUE NOT NULL,
      password_hash       TEXT NOT NULL,
      full_name           TEXT,
      bio                 TEXT,
      avatar_url          TEXT,
      role                TEXT NOT NULL DEFAULT 'user',
      is_verified         BOOLEAN NOT NULL DEFAULT FALSE,
      is_banned           BOOLEAN NOT NULL DEFAULT FALSE,
      stripe_customer_id  TEXT,
      subscription_status TEXT NOT NULL DEFAULT 'free',
      subscription_end    TIMESTAMPTZ,
      scan_count          INTEGER NOT NULL DEFAULT 0,
      last_login          TIMESTAMPTZ,
      created_at          TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS plants (
      id              SERIAL PRIMARY KEY,
      scientific_name TEXT,
      common_name     TEXT,
      care_summary    TEXT,
      watering        TEXT,
      fertilizer      TEXT,
      sunlight        TEXT,
      soil            TEXT,
      propagation     TEXT,
      uses            TEXT,
      image_url       TEXT,
      habitat         TEXT,
      disease         TEXT,
      pest            TEXT,
      search_vec      TSVECTOR,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS scans (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
      plant_id    INTEGER REFERENCES plants(id) ON DELETE SET NULL,
      filename    TEXT NOT NULL,
      cloud_url   TEXT,
      result_json JSONB NOT NULL,
      score       REAL DEFAULT 0,
      mode        TEXT DEFAULT 'default',
      is_public   BOOLEAN DEFAULT FALSE,
      view_count  INTEGER DEFAULT 0,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id              SERIAL PRIMARY KEY,
      user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
      scan_id         INTEGER REFERENCES scans(id) ON DELETE SET NULL,
      title           TEXT NOT NULL,
      channel         TEXT NOT NULL DEFAULT 'email',
      destination     TEXT NOT NULL,
      cron_expression TEXT NOT NULL,
      active          BOOLEAN NOT NULL DEFAULT TRUE,
      last_sent       TIMESTAMPTZ,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
      question   TEXT NOT NULL,
      response   JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // ── Organisms table ───────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS organisms (
      id                  SERIAL PRIMARY KEY,
      common_name         TEXT,
      scientific_name     TEXT NOT NULL,
      subject_type        TEXT NOT NULL DEFAULT 'plant',
      kingdom             TEXT,
      phylum              TEXT,
      taxon_class         TEXT,
      taxon_order         TEXT,
      family              TEXT,
      genus               TEXT,
      description         TEXT,
      habitat             TEXT,
      distribution        TEXT,
      uses                TEXT,
      toxicity            TEXT,
      behavior            TEXT,
      conservation_status TEXT,
      image_url           TEXT,
      source              TEXT NOT NULL DEFAULT 'gbif',
      external_id         TEXT UNIQUE,
      observations_count  INTEGER DEFAULT 0,
      created_at          TIMESTAMPTZ DEFAULT NOW(),
      search_vec          TSVECTOR
    );
    CREATE INDEX IF NOT EXISTS idx_organisms_search ON organisms USING GIN(search_vec);
    CREATE INDEX IF NOT EXISTS idx_organisms_type   ON organisms(subject_type);
    CREATE INDEX IF NOT EXISTS idx_organisms_family ON organisms(family);
  `);

  // ── Growth journal ────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS growth_journal (
      id              SERIAL PRIMARY KEY,
      user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title           TEXT NOT NULL,
      plant_name      TEXT,
      scientific_name TEXT,
      notes           TEXT,
      height_cm       REAL,
      health_score    INTEGER CHECK (health_score BETWEEN 1 AND 10),
      photo_url       TEXT,
      tags            TEXT[],
      weather_at_time TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_journal_user ON growth_journal(user_id);
    CREATE INDEX IF NOT EXISTS idx_journal_created ON growth_journal(created_at DESC);
  `);

  // ── Favorites ─────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS favorites (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
      plant_id    INTEGER REFERENCES plants(id) ON DELETE CASCADE,
      organism_id INTEGER REFERENCES organisms(id) ON DELETE CASCADE,
      scan_id     INTEGER REFERENCES scans(id) ON DELETE CASCADE,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_fav_plant    ON favorites(user_id, plant_id)    WHERE plant_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_fav_organism ON favorites(user_id, organism_id) WHERE organism_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_fav_scan     ON favorites(user_id, scan_id)     WHERE scan_id IS NOT NULL;
  `);

  // ── Collections ───────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS collections (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      description TEXT,
      cover_url   TEXT,
      is_public   BOOLEAN DEFAULT FALSE,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS collection_items (
      id            SERIAL PRIMARY KEY,
      collection_id INTEGER REFERENCES collections(id) ON DELETE CASCADE,
      plant_id      INTEGER REFERENCES plants(id) ON DELETE CASCADE,
      organism_id   INTEGER REFERENCES organisms(id) ON DELETE CASCADE,
      scan_id       INTEGER REFERENCES scans(id) ON DELETE CASCADE,
      added_at      TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_collection_items ON collection_items(collection_id);
  `);

  // ── Auth tokens ───────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
      token      TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_refresh_token ON refresh_tokens(token);

    CREATE TABLE IF NOT EXISTS password_resets (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
      token      TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used       BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS email_verifications (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
      token      TEXT UNIQUE NOT NULL,
      verified   BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // ── Notifications ─────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
      type       TEXT NOT NULL DEFAULT 'info',
      title      TEXT NOT NULL,
      message    TEXT,
      link       TEXT,
      read       BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_notif_user_unread ON notifications(user_id, read);
  `);

  // ── Plant notes ───────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS plant_notes (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
      scan_id    INTEGER REFERENCES scans(id) ON DELETE CASCADE,
      note       TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_notes_scan ON plant_notes(scan_id);
  `);

  // ── Achievements ──────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_achievements (
      id              SERIAL PRIMARY KEY,
      user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
      achievement_key TEXT NOT NULL,
      earned_at       TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, achievement_key)
    );
  `);

  // ── User settings ─────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id              INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      email_notifications  BOOLEAN DEFAULT TRUE,
      scan_privacy         TEXT DEFAULT 'private',
      default_scan_mode    TEXT DEFAULT 'default',
      timezone             TEXT DEFAULT 'UTC',
      units                TEXT DEFAULT 'metric',
      language             TEXT DEFAULT 'en',
      updated_at           TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // ── Scan social ───────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS scan_likes (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
      scan_id    INTEGER REFERENCES scans(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, scan_id)
    );

    CREATE TABLE IF NOT EXISTS scan_comments (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
      scan_id    INTEGER REFERENCES scans(id) ON DELETE CASCADE,
      comment    TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_scan_comments ON scan_comments(scan_id);
  `);

  // ── Audit log ─────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action     TEXT NOT NULL,
      resource   TEXT,
      ip_address TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
  `);

  // ── Weather cache ─────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS weather_cache (
      id        SERIAL PRIMARY KEY,
      cache_key TEXT UNIQUE NOT NULL,
      data_json JSONB NOT NULL,
      cached_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // ── Species sightings (geo-tagged scan locations) ─────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS species_sightings (
      id              SERIAL PRIMARY KEY,
      scan_id         INTEGER REFERENCES scans(id) ON DELETE CASCADE,
      user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
      scientific_name TEXT,
      common_name     TEXT,
      subject_type    TEXT,
      latitude        REAL NOT NULL,
      longitude       REAL NOT NULL,
      altitude_m      REAL,
      accuracy_m      REAL,
      country         TEXT,
      country_code    TEXT,
      state           TEXT,
      city            TEXT,
      street          TEXT,
      location_name   TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_sightings_coords   ON species_sightings(latitude, longitude);
    CREATE INDEX IF NOT EXISTS idx_sightings_species  ON species_sightings(scientific_name);
    CREATE INDEX IF NOT EXISTS idx_sightings_type     ON species_sightings(subject_type);
    CREATE INDEX IF NOT EXISTS idx_sightings_country  ON species_sightings(country);
  `);

  // ── Add geolocation columns to scans if missing ───────────────
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='scans' AND column_name='latitude') THEN
        ALTER TABLE scans ADD COLUMN latitude    REAL;
        ALTER TABLE scans ADD COLUMN longitude   REAL;
        ALTER TABLE scans ADD COLUMN altitude_m  REAL;
        ALTER TABLE scans ADD COLUMN country     TEXT;
        ALTER TABLE scans ADD COLUMN country_code TEXT;
        ALTER TABLE scans ADD COLUMN state       TEXT;
        ALTER TABLE scans ADD COLUMN city        TEXT;
        ALTER TABLE scans ADD COLUMN street      TEXT;
        ALTER TABLE scans ADD COLUMN location_name TEXT;
      END IF;
    END $$;
  `);

  // ── Hiker trails + safety ─────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS hiker_trails (
      id              SERIAL PRIMARY KEY,
      user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
      trip_name       TEXT NOT NULL,
      description     TEXT,
      start_location  TEXT,
      destination     TEXT,
      country         TEXT,
      planned_days    INTEGER DEFAULT 1,
      difficulty      TEXT DEFAULT 'moderate',
      status          TEXT NOT NULL DEFAULT 'planning',
      is_emergency    BOOLEAN DEFAULT FALSE,
      emergency_at    TIMESTAMPTZ,
      emergency_note  TEXT,
      waypoints       JSONB DEFAULT '[]',
      gear_list       JSONB DEFAULT '[]',
      emergency_contacts JSONB DEFAULT '[]',
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_trails_user   ON hiker_trails(user_id);
    CREATE INDEX IF NOT EXISTS idx_trails_status ON hiker_trails(status);

    CREATE TABLE IF NOT EXISTS hiker_checkins (
      id           SERIAL PRIMARY KEY,
      trail_id     INTEGER REFERENCES hiker_trails(id) ON DELETE CASCADE,
      user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
      latitude     REAL NOT NULL,
      longitude    REAL NOT NULL,
      altitude_m   REAL,
      accuracy_m   REAL,
      location_name TEXT,
      note         TEXT,
      battery_pct  INTEGER,
      weather_desc TEXT,
      photo_url    TEXT,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_checkins_trail ON hiker_checkins(trail_id);
    CREATE INDEX IF NOT EXISTS idx_checkins_user  ON hiker_checkins(user_id);
  `);

  // ── Farming / crop plans ──────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS crop_plans (
      id               SERIAL PRIMARY KEY,
      user_id          INTEGER REFERENCES users(id) ON DELETE CASCADE,
      plan_name        TEXT NOT NULL,
      location         TEXT,
      latitude         REAL,
      longitude        REAL,
      country          TEXT,
      climate_zone     TEXT,
      plot_size_sqm    REAL,
      soil_type        TEXT,
      water_source     TEXT,
      budget_usd       REAL,
      is_hydroponic    BOOLEAN DEFAULT FALSE,
      crops_json       JSONB DEFAULT '[]',
      schedule_json    JSONB DEFAULT '[]',
      ai_advice        TEXT,
      cost_estimate    REAL,
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      updated_at       TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_cropplans_user ON crop_plans(user_id);
  `);

  // ── Survival logs ─────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS survival_logs (
      id           SERIAL PRIMARY KEY,
      user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
      trail_id     INTEGER REFERENCES hiker_trails(id) ON DELETE SET NULL,
      scan_id      INTEGER REFERENCES scans(id) ON DELETE SET NULL,
      event_type   TEXT NOT NULL,
      latitude     REAL,
      longitude    REAL,
      data_json    JSONB,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_survival_user ON survival_logs(user_id);
  `);

  // ── Alter existing tables to add new columns if missing ───────
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='plants' AND column_name='disease') THEN
        ALTER TABLE plants ADD COLUMN disease TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='plants' AND column_name='pest') THEN
        ALTER TABLE plants ADD COLUMN pest TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='scans' AND column_name='cloud_url') THEN
        ALTER TABLE scans ADD COLUMN cloud_url TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='scans' AND column_name='mode') THEN
        ALTER TABLE scans ADD COLUMN mode TEXT DEFAULT 'default';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='scans' AND column_name='is_public') THEN
        ALTER TABLE scans ADD COLUMN is_public BOOLEAN DEFAULT FALSE;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='scans' AND column_name='view_count') THEN
        ALTER TABLE scans ADD COLUMN view_count INTEGER DEFAULT 0;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='role') THEN
        ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_verified') THEN
        ALTER TABLE users ADD COLUMN is_verified BOOLEAN NOT NULL DEFAULT FALSE;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_banned') THEN
        ALTER TABLE users ADD COLUMN is_banned BOOLEAN NOT NULL DEFAULT FALSE;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='full_name') THEN
        ALTER TABLE users ADD COLUMN full_name TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='bio') THEN
        ALTER TABLE users ADD COLUMN bio TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='avatar_url') THEN
        ALTER TABLE users ADD COLUMN avatar_url TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='scan_count') THEN
        ALTER TABLE users ADD COLUMN scan_count INTEGER NOT NULL DEFAULT 0;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='last_login') THEN
        ALTER TABLE users ADD COLUMN last_login TIMESTAMPTZ;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='subscription_end') THEN
        ALTER TABLE users ADD COLUMN subscription_end TIMESTAMPTZ;
      END IF;
    END $$;
  `);

  await pool.query(`
    ALTER TABLE chat_messages ALTER COLUMN user_id DROP NOT NULL;
  `).catch(() => {});

  // ── Full-text search triggers on plants ───────────────────────
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

    DROP TRIGGER IF EXISTS plants_fts_trig ON plants;
    CREATE TRIGGER plants_fts_trig
      BEFORE INSERT OR UPDATE ON plants
      FOR EACH ROW EXECUTE FUNCTION _plants_fts();

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

  // ── Seed plants ───────────────────────────────────────────────
  const existing = await pool.query('SELECT COUNT(*) AS count FROM plants');
  if (Number(existing.rows[0].count) === 0) {
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

  // ── Seed organisms ────────────────────────────────────────────
  const orgExisting = await pool.query('SELECT COUNT(*) AS count FROM organisms');
  if (Number(orgExisting.rows[0].count) === 0) {
    const orgRows = generateOrganismRows();
    for (const r of orgRows) {
      const searchText = [r.common_name, r.scientific_name, r.family, r.genus, r.description, r.habitat, r.uses]
        .filter(Boolean).join(' ');
      await pool.query(
        `INSERT INTO organisms
           (common_name, scientific_name, subject_type, kingdom, phylum, taxon_class,
            taxon_order, family, genus, description, habitat, uses, image_url,
            source, external_id, observations_count, search_vec)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
                 to_tsvector('english', $17))
         ON CONFLICT (external_id) DO NOTHING`,
        [
          r.common_name, r.scientific_name, r.subject_type,
          r.kingdom, r.phylum, r.taxon_class, r.taxon_order,
          r.family, r.genus, r.description, r.habitat, r.uses,
          r.image_url, r.source, r.external_id, r.observations_count,
          searchText,
        ]
      );
    }
  }

  // ── Landscape intelligence analyses ──────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS landscape_analyses (
      id                    SERIAL PRIMARY KEY,
      user_id               INTEGER REFERENCES users(id) ON DELETE SET NULL,
      image_url             TEXT,
      environment_type      TEXT,
      environment_label     TEXT,
      hemisphere            TEXT,
      climate_zone          TEXT,
      likely_region         TEXT,
      camping_safety_score  INTEGER,
      camping_safety_label  TEXT,
      latitude              REAL,
      longitude             REAL,
      country               TEXT,
      city                  TEXT,
      analysis_json         JSONB,
      created_at            TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_landscape_user   ON landscape_analyses(user_id);
    CREATE INDEX IF NOT EXISTS idx_landscape_loc    ON landscape_analyses(latitude, longitude);
    CREATE INDEX IF NOT EXISTS idx_landscape_env    ON landscape_analyses(environment_type);
  `);

  // ── Farm Operations ───────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS farm_fields (
      id             SERIAL PRIMARY KEY,
      user_id        INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name           TEXT NOT NULL,
      acreage        REAL,
      soil_type      TEXT,
      last_soil_test DATE,
      notes          TEXT,
      created_at     TIMESTAMPTZ DEFAULT NOW(),
      updated_at     TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_farm_fields_user ON farm_fields(user_id);

    CREATE TABLE IF NOT EXISTS farm_rotation (
      id          SERIAL PRIMARY KEY,
      field_id    INTEGER REFERENCES farm_fields(id) ON DELETE CASCADE,
      season      TEXT NOT NULL,
      crop_name   TEXT NOT NULL,
      crop_family TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(field_id, season, crop_family)
    );
    CREATE INDEX IF NOT EXISTS idx_farm_rotation_field ON farm_rotation(field_id);

    CREATE TABLE IF NOT EXISTS farm_plantings (
      id              SERIAL PRIMARY KEY,
      user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
      field_id        INTEGER REFERENCES farm_fields(id) ON DELETE SET NULL,
      season          TEXT,
      crop_name       TEXT NOT NULL,
      variety         TEXT,
      seed_lot        TEXT,
      planned_date    DATE,
      actual_date     DATE,
      seed_rate       REAL,
      days_to_maturity INTEGER,
      target_yield_kg REAL,
      status          TEXT NOT NULL DEFAULT 'planned',
      notes           TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_farm_plantings_user  ON farm_plantings(user_id);
    CREATE INDEX IF NOT EXISTS idx_farm_plantings_field ON farm_plantings(field_id);

    CREATE TABLE IF NOT EXISTS farm_inventory (
      id                 SERIAL PRIMARY KEY,
      user_id            INTEGER REFERENCES users(id) ON DELETE CASCADE,
      category           TEXT NOT NULL,
      name               TEXT NOT NULL,
      quantity           REAL NOT NULL DEFAULT 0,
      unit               TEXT,
      reorder_point      REAL NOT NULL DEFAULT 0,
      daily_usage        REAL,
      lead_time_days     INTEGER,
      preferred_supplier TEXT,
      last_price_usd     REAL,
      expiry_date        DATE,
      notes              TEXT,
      created_at         TIMESTAMPTZ DEFAULT NOW(),
      updated_at         TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_farm_inventory_user ON farm_inventory(user_id);

    CREATE TABLE IF NOT EXISTS farm_equipment (
      id                   SERIAL PRIMARY KEY,
      user_id              INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name                 TEXT NOT NULL,
      make_model           TEXT,
      hours_current        REAL DEFAULT 0,
      service_interval_hrs REAL,
      next_service_date    DATE,
      insurance_renewal    DATE,
      notes                TEXT,
      created_at           TIMESTAMPTZ DEFAULT NOW(),
      updated_at           TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_farm_equipment_user ON farm_equipment(user_id);

    CREATE TABLE IF NOT EXISTS farm_equipment_log (
      id               SERIAL PRIMARY KEY,
      equipment_id     INTEGER REFERENCES farm_equipment(id) ON DELETE CASCADE,
      user_id          INTEGER REFERENCES users(id) ON DELETE CASCADE,
      log_type         TEXT NOT NULL DEFAULT 'maintenance',
      description      TEXT,
      hours_at_service REAL,
      parts_json       JSONB DEFAULT '[]',
      cost_usd         REAL,
      downtime_hrs     REAL,
      created_at       TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_farm_equip_log ON farm_equipment_log(equipment_id);

    CREATE TABLE IF NOT EXISTS farm_tasks (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
      field_id    INTEGER REFERENCES farm_fields(id) ON DELETE SET NULL,
      title       TEXT NOT NULL,
      description TEXT,
      due_date    TIMESTAMPTZ,
      assigned_to TEXT,
      status      TEXT NOT NULL DEFAULT 'pending',
      priority    TEXT NOT NULL DEFAULT 'medium',
      est_hours   REAL,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_farm_tasks_user   ON farm_tasks(user_id);
    CREATE INDEX IF NOT EXISTS idx_farm_tasks_status ON farm_tasks(status);

    CREATE TABLE IF NOT EXISTS farm_harvests (
      id               SERIAL PRIMARY KEY,
      user_id          INTEGER REFERENCES users(id) ON DELETE CASCADE,
      field_id         INTEGER REFERENCES farm_fields(id) ON DELETE SET NULL,
      planting_id      INTEGER REFERENCES farm_plantings(id) ON DELETE SET NULL,
      crop_name        TEXT NOT NULL,
      start_date       DATE,
      end_date         DATE,
      area_acres       REAL,
      yield_kg         REAL,
      moisture_pct     REAL,
      grade            TEXT,
      storage_location TEXT,
      notes            TEXT,
      created_at       TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_farm_harvests_user  ON farm_harvests(user_id);
    CREATE INDEX IF NOT EXISTS idx_farm_harvests_field ON farm_harvests(field_id);
  `);

  // ── Cooking guides cache ──────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cooking_guides (
      id           SERIAL PRIMARY KEY,
      plant_name   TEXT UNIQUE NOT NULL,
      guide_json   JSONB NOT NULL,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_cooking_plant ON cooking_guides(plant_name);
  `);

  // ── ARGUS intel feed ──────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS argus_intel (
      id         SERIAL PRIMARY KEY,
      category   TEXT NOT NULL,
      title      TEXT NOT NULL,
      summary    TEXT NOT NULL,
      source     TEXT NOT NULL DEFAULT 'argus',
      url        TEXT DEFAULT '',
      ts         TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_argus_category ON argus_intel(category);
    CREATE INDEX IF NOT EXISTS idx_argus_created  ON argus_intel(created_at DESC);
  `);

  console.log('[db] Database initialized successfully');
}

async function query(text, params) {
  return pool.query(text, params);
}

module.exports = { initDb, query, pool };
