/**
 * FloraIQ Data Harvester
 * Fetches species from GBIF + iNaturalist and stores locally.
 *
 * Usage:
 *   node backend/scripts/harvest.js              # all types, 2000 each
 *   node backend/scripts/harvest.js plant 5000   # plants only
 *   node backend/scripts/harvest.js insect 2000  # insects only
 *   node backend/scripts/harvest.js bird 1000    # birds only
 *   node backend/scripts/harvest.js fungi 1000   # fungi only
 *   node backend/scripts/harvest.js weed 500     # weeds only
 *
 * Data sources:
 *   - GBIF   (gbif.org)        — species backbone, taxonomy, free, no auth
 *   - iNaturalist (inat.org)   — community photos, common names, free
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon') ? { rejectUnauthorized: false } : false,
});

// ── Organism type config ──────────────────────────────────────────
const TYPE_CONFIG = {
  plant: {
    label: 'Plants',
    gbif: { kingdom: 'Plantae', rank: 'SPECIES', status: 'ACCEPTED' },
    inat: { iconic_taxa: 'Plantae', rank: 'species' },
    subject_type: 'plant',
  },
  insect: {
    label: 'Insects',
    gbif: { kingdom: 'Animalia', class: 'Insecta', rank: 'SPECIES', status: 'ACCEPTED' },
    inat: { iconic_taxa: 'Insecta', rank: 'species' },
    subject_type: 'insect',
  },
  bird: {
    label: 'Birds',
    gbif: { kingdom: 'Animalia', class: 'Aves', rank: 'SPECIES', status: 'ACCEPTED' },
    inat: { iconic_taxa: 'Aves', rank: 'species' },
    subject_type: 'bird',
  },
  fungi: {
    label: 'Fungi',
    gbif: { kingdom: 'Fungi', rank: 'SPECIES', status: 'ACCEPTED' },
    inat: { iconic_taxa: 'Fungi', rank: 'species' },
    subject_type: 'fungi',
  },
  weed: {
    label: 'Weeds',
    gbif: { kingdom: 'Plantae', rank: 'SPECIES', status: 'ACCEPTED' },
    inat: { iconic_taxa: 'Plantae', rank: 'species', q: 'weed' },
    subject_type: 'weed',
  },
  spider: {
    label: 'Spiders',
    gbif: { kingdom: 'Animalia', class: 'Arachnida', rank: 'SPECIES', status: 'ACCEPTED' },
    inat: { iconic_taxa: 'Arachnida', rank: 'species' },
    subject_type: 'spider',
  },
};

// ── Helpers ───────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

// ── iNaturalist: batch fetch taxa by iconic taxon group ───────────
async function fetchInatBatch(config, page, perPage = 200) {
  const p = new URLSearchParams({
    rank: config.inat.rank || 'species',
    per_page: perPage,
    page,
    order_by: 'observations_count',
    order: 'desc',
    photos: 'true',
    locale: 'en',
  });
  if (config.inat.iconic_taxa) p.set('iconic_taxa', config.inat.iconic_taxa);
  if (config.inat.q) p.set('q', config.inat.q);
  const url = `https://api.inaturalist.org/v1/taxa?${p}`;
  const data = await fetchJSON(url);
  return data.results || [];
}

// ── GBIF: batch fetch species ─────────────────────────────────────
async function fetchGbifBatch(config, offset, limit = 300) {
  const p = new URLSearchParams({ rank: 'SPECIES', status: 'ACCEPTED', limit, offset });
  Object.entries(config.gbif).forEach(([k, v]) => {
    if (k !== 'rank' && k !== 'status') p.set(k, v);
  });
  const url = `https://api.gbif.org/v1/species/search?${p}`;
  const data = await fetchJSON(url);
  return data.results || [];
}

// ── Map iNaturalist taxon → organisms row ─────────────────────────
function inatToRow(t, subject_type) {
  const tax = t.ancestors?.reduce((acc, a) => {
    if (a.rank === 'kingdom')  acc.kingdom = a.name;
    if (a.rank === 'phylum')   acc.phylum  = a.name;
    if (a.rank === 'class')    acc.taxon_class = a.name;
    if (a.rank === 'order')    acc.taxon_order = a.name;
    if (a.rank === 'family')   acc.family  = a.name;
    if (a.rank === 'genus')    acc.genus   = a.name;
    return acc;
  }, {}) || {};

  return {
    common_name:        t.preferred_common_name || t.english_common_name || null,
    scientific_name:    t.name,
    subject_type,
    kingdom:            tax.kingdom || null,
    phylum:             tax.phylum  || null,
    taxon_class:        tax.taxon_class || null,
    taxon_order:        tax.taxon_order || null,
    family:             tax.family  || null,
    genus:              tax.genus   || null,
    description:        t.wikipedia_summary?.slice(0, 500) || null,
    habitat:            null,
    uses:               null,
    image_url:          t.default_photo?.medium_url || null,
    source:             'inat',
    external_id:        `inat:${t.id}`,
    observations_count: t.observations_count || 0,
  };
}

// ── Map GBIF species → organisms row ─────────────────────────────
function gbifToRow(s, subject_type) {
  const vern = s.vernacularNames?.find(v => v.language === 'eng') || s.vernacularNames?.[0];
  return {
    common_name:        vern?.vernacularName || s.canonicalName || null,
    scientific_name:    s.canonicalName || s.scientificName,
    subject_type,
    kingdom:            s.kingdom   || null,
    phylum:             s.phylum    || null,
    taxon_class:        s.class     || null,
    taxon_order:        s.order     || null,
    family:             s.family    || null,
    genus:              s.genus     || null,
    description:        null,
    habitat:            null,
    uses:               null,
    image_url:          null,
    source:             'gbif',
    external_id:        `gbif:${s.key}`,
    observations_count: 0,
  };
}

// ── Insert rows into organisms table ─────────────────────────────
async function insertBatch(rows) {
  if (!rows.length) return 0;

  const ftsExpr = (r) =>
    [r.common_name, r.scientific_name, r.family, r.genus, r.description, r.habitat, r.uses]
      .filter(Boolean).join(' ');

  let inserted = 0;
  for (const r of rows) {
    try {
      const searchText = ftsExpr(r);
      await pool.query(
        `INSERT INTO organisms
           (common_name, scientific_name, subject_type, kingdom, phylum, taxon_class,
            taxon_order, family, genus, description, habitat, uses, image_url,
            source, external_id, observations_count, search_vec)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
                 to_tsvector('english', $17))
         ON CONFLICT (external_id) DO UPDATE
           SET image_url          = COALESCE(EXCLUDED.image_url, organisms.image_url),
               common_name        = COALESCE(EXCLUDED.common_name, organisms.common_name),
               observations_count = GREATEST(EXCLUDED.observations_count, organisms.observations_count),
               search_vec         = EXCLUDED.search_vec`,
        [
          r.common_name, r.scientific_name, r.subject_type,
          r.kingdom, r.phylum, r.taxon_class, r.taxon_order,
          r.family, r.genus, r.description, r.habitat, r.uses,
          r.image_url, r.source, r.external_id, r.observations_count,
          searchText,
        ]
      );
      inserted++;
    } catch (_) { /* skip duplicates / invalid */ }
  }
  return inserted;
}

// ── Harvest from iNaturalist (primary — has photos) ───────────────
async function harvestInat(type, config, limit) {
  const perPage = 200;
  const pages = Math.ceil(limit / perPage);
  let total = 0;

  process.stdout.write(`  [iNat] ${config.label}: `);
  for (let page = 1; page <= pages; page++) {
    try {
      const taxa = await fetchInatBatch(config, page, perPage);
      if (!taxa.length) break;
      const rows = taxa.map(t => inatToRow(t, config.subject_type));
      const n = await insertBatch(rows);
      total += n;
      process.stdout.write(`${n} `);
      await sleep(600); // be polite — iNat rate limit ~100 req/min
    } catch (e) {
      process.stdout.write(`[err:${e.message.slice(0,20)}] `);
      await sleep(2000);
    }
  }
  console.log(`→ ${total} saved`);
  return total;
}

// ── Harvest from GBIF (fallback / supplement) ─────────────────────
async function harvestGbif(type, config, limit) {
  const batchSize = 300;
  const batches = Math.ceil(limit / batchSize);
  let total = 0;

  process.stdout.write(`  [GBIF] ${config.label}: `);
  for (let i = 0; i < batches; i++) {
    const offset = i * batchSize;
    try {
      const species = await fetchGbifBatch(config, offset, batchSize);
      if (!species.length) break;
      const rows = species.map(s => gbifToRow(s, config.subject_type));
      const n = await insertBatch(rows);
      total += n;
      process.stdout.write(`${n} `);
      await sleep(200); // GBIF is lenient but be polite
    } catch (e) {
      process.stdout.write(`[err:${e.message.slice(0,20)}] `);
      await sleep(2000);
    }
  }
  console.log(`→ ${total} saved`);
  return total;
}

// ── Main ──────────────────────────────────────────────────────────
async function main() {
  const typeArg  = process.argv[2] || 'all';
  const limitArg = parseInt(process.argv[3] || '2000', 10);

  const types = typeArg === 'all'
    ? Object.keys(TYPE_CONFIG)
    : [typeArg].filter(t => TYPE_CONFIG[t]);

  if (!types.length) {
    console.error(`Unknown type: ${typeArg}. Valid: ${Object.keys(TYPE_CONFIG).join(', ')}, all`);
    process.exit(1);
  }

  console.log(`\nFloraIQ Harvester — fetching ${limitArg} × ${types.join(', ')}`);
  console.log('Sources: iNaturalist (photos) + GBIF (taxonomy backbone)\n');

  let grandTotal = 0;
  for (const type of types) {
    const config = TYPE_CONFIG[type];
    console.log(`── ${config.label} ──`);
    // iNat first (has photos + common names)
    const inatTotal = await harvestInat(type, config, Math.min(limitArg, 1000));
    // GBIF supplement for extra coverage
    const gbifTotal = await harvestGbif(type, config, limitArg);
    grandTotal += inatTotal + gbifTotal;
    await sleep(1000);
  }

  // Count final totals
  const countResult = await pool.query(
    'SELECT subject_type, COUNT(*) FROM organisms GROUP BY subject_type ORDER BY COUNT(*) DESC'
  );
  console.log('\n── Database totals ──');
  countResult.rows.forEach(r => console.log(`  ${r.subject_type.padEnd(12)} ${r.count}`));

  const plantCount = await pool.query('SELECT COUNT(*) FROM plants');
  console.log(`  plants (lib)  ${plantCount.rows[0].count}`);
  console.log(`\nHarvested ${grandTotal} new species. Done.\n`);

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
