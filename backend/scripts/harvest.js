/**
 * FloraIQ Data Harvester — 10 Sources
 *
 * Sources:
 *   1. iNaturalist     — photos, common names, observations
 *   2. GBIF            — 2.7B occurrence backbone
 *   3. OBIS            — Ocean Biodiversity Information System (marine)
 *   4. Catalogue of Life (COL) — authoritative taxonomy
 *   5. ALA             — Atlas of Living Australia
 *   6. iDigBio         — digitized museum specimens (USA)
 *   7. Xeno-canto      — birds (recordings + taxonomy)
 *   8. WORMS           — World Register of Marine Species
 *   9. Open Tree of Life (OTL) — phylogenetic taxonomy
 *  10. BOLD Systems    — Barcode of Life (insects, fish, birds)
 *
 * Usage:
 *   node backend/scripts/harvest.js              # all types, 5000 each
 *   node backend/scripts/harvest.js plant 10000
 *   node backend/scripts/harvest.js insect 10000
 *   node backend/scripts/harvest.js bird 5000
 *   node backend/scripts/harvest.js fungi 5000
 *   node backend/scripts/harvest.js marine 5000
 *   node backend/scripts/harvest.js all 100000
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon') ? { rejectUnauthorized: false } : false,
});

// ── Helpers ───────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchJSON(url, options = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, ...options });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJSONPost(url, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ── Insert rows into organisms table ─────────────────────────
async function insertBatch(rows) {
  if (!rows.length) return 0;
  let inserted = 0;
  for (const r of rows) {
    if (!r.scientific_name) continue;
    const searchText = [r.common_name, r.scientific_name, r.family, r.genus, r.description, r.habitat, r.uses]
      .filter(Boolean).join(' ');
    try {
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
          r.image_url, r.source, r.external_id, r.observations_count || 0,
          searchText,
        ]
      );
      inserted++;
    } catch (_) { /* skip */ }
  }
  return inserted;
}

// ─────────────────────────────────────────────────────────────
// SOURCE 1: iNaturalist
// ─────────────────────────────────────────────────────────────
const INAT_GROUPS = {
  plant:   'Plantae',
  insect:  'Insecta',
  bird:    'Aves',
  fungi:   'Fungi',
  spider:  'Arachnida',
  weed:    'Plantae',
  marine:  'Actinopterygii',
  mammal:  'Mammalia',
  reptile: 'Reptilia',
};

async function harvestInat(subjectType, iconicTaxa, limit) {
  const perPage = 200;
  const pages = Math.ceil(limit / perPage);
  let total = 0;
  process.stdout.write(`  [iNat/${subjectType}] `);
  for (let page = 1; page <= pages; page++) {
    try {
      const p = new URLSearchParams({
        rank: 'species', per_page: perPage, page,
        order_by: 'observations_count', order: 'desc',
        photos: 'true', locale: 'en',
        iconic_taxa: iconicTaxa,
      });
      const data = await fetchJSON(`https://api.inaturalist.org/v1/taxa?${p}`);
      const results = data.results || [];
      if (!results.length) break;
      const rows = results.map(t => {
        const tax = (t.ancestors || []).reduce((a, x) => {
          if (x.rank === 'kingdom') a.kingdom = x.name;
          if (x.rank === 'phylum')  a.phylum  = x.name;
          if (x.rank === 'class')   a.taxon_class = x.name;
          if (x.rank === 'order')   a.taxon_order = x.name;
          if (x.rank === 'family')  a.family  = x.name;
          if (x.rank === 'genus')   a.genus   = x.name;
          return a;
        }, {});
        return {
          common_name: t.preferred_common_name || null,
          scientific_name: t.name,
          subject_type: subjectType,
          kingdom: tax.kingdom || null, phylum: tax.phylum || null,
          taxon_class: tax.taxon_class || null, taxon_order: tax.taxon_order || null,
          family: tax.family || null, genus: tax.genus || null,
          description: t.wikipedia_summary?.slice(0, 500) || null,
          habitat: null, uses: null,
          image_url: t.default_photo?.medium_url || null,
          source: 'inat', external_id: `inat:${t.id}`,
          observations_count: t.observations_count || 0,
        };
      });
      const n = await insertBatch(rows);
      total += n;
      process.stdout.write(`${n} `);
      await sleep(700);
    } catch (e) {
      process.stdout.write(`[err] `);
      await sleep(2000);
    }
  }
  console.log(`→ ${total}`);
  return total;
}

// ─────────────────────────────────────────────────────────────
// SOURCE 2: GBIF
// ─────────────────────────────────────────────────────────────
const GBIF_CONFIGS = {
  plant:   { kingdom: 'Plantae' },
  insect:  { kingdom: 'Animalia', class: 'Insecta' },
  bird:    { kingdom: 'Animalia', class: 'Aves' },
  fungi:   { kingdom: 'Fungi' },
  spider:  { kingdom: 'Animalia', class: 'Arachnida' },
  mammal:  { kingdom: 'Animalia', class: 'Mammalia' },
  reptile: { kingdom: 'Animalia', class: 'Reptilia' },
  marine:  { kingdom: 'Animalia', phylum: 'Chordata', class: 'Actinopterygii' },
};

async function harvestGbif(subjectType, config, limit) {
  const batchSize = 300;
  const batches = Math.ceil(limit / batchSize);
  let total = 0;
  process.stdout.write(`  [GBIF/${subjectType}] `);
  for (let i = 0; i < batches; i++) {
    try {
      const p = new URLSearchParams({ rank: 'SPECIES', status: 'ACCEPTED', limit: batchSize, offset: i * batchSize });
      Object.entries(config).forEach(([k, v]) => p.set(k, v));
      const data = await fetchJSON(`https://api.gbif.org/v1/species/search?${p}`);
      const results = data.results || [];
      if (!results.length) break;
      const rows = results.map(s => {
        const vern = s.vernacularNames?.find(v => v.language === 'eng') || s.vernacularNames?.[0];
        return {
          common_name: vern?.vernacularName || s.canonicalName || null,
          scientific_name: s.canonicalName || s.scientificName,
          subject_type: subjectType,
          kingdom: s.kingdom || null, phylum: s.phylum || null,
          taxon_class: s.class || null, taxon_order: s.order || null,
          family: s.family || null, genus: s.genus || null,
          description: null, habitat: null, uses: null, image_url: null,
          source: 'gbif', external_id: `gbif:${s.key}`,
          observations_count: 0,
        };
      });
      const n = await insertBatch(rows);
      total += n;
      process.stdout.write(`${n} `);
      await sleep(200);
    } catch (e) {
      process.stdout.write(`[err] `);
      await sleep(2000);
    }
  }
  console.log(`→ ${total}`);
  return total;
}

// ─────────────────────────────────────────────────────────────
// SOURCE 3: OBIS — Ocean Biodiversity Information System
// ─────────────────────────────────────────────────────────────
async function harvestObis(subjectType, taxonName, limit) {
  const size = Math.min(limit, 1000);
  let total = 0;
  let offset = 0;
  process.stdout.write(`  [OBIS/${subjectType}] `);
  while (offset < limit) {
    try {
      const data = await fetchJSON(
        `https://api.obis.org/v3/taxon/search?scientificname=${encodeURIComponent(taxonName)}&size=${size}&offset=${offset}`
      );
      const results = data.results || [];
      if (!results.length) break;
      const rows = results.map(t => ({
        common_name: t.vernacularName || null,
        scientific_name: t.scientificName || t.species || null,
        subject_type: subjectType,
        kingdom: t.kingdom || null, phylum: t.phylum || null,
        taxon_class: t.class || null, taxon_order: t.order || null,
        family: t.family || null, genus: t.genus || null,
        description: null, habitat: 'Marine/aquatic environment', uses: null,
        image_url: null, source: 'obis',
        external_id: `obis:${t.taxonID || t.scientificName}`,
        observations_count: t.records || 0,
      })).filter(r => r.scientific_name);
      const n = await insertBatch(rows);
      total += n;
      offset += size;
      process.stdout.write(`${n} `);
      await sleep(500);
    } catch (e) {
      process.stdout.write(`[err] `);
      break;
    }
  }
  console.log(`→ ${total}`);
  return total;
}

// ─────────────────────────────────────────────────────────────
// SOURCE 4: Catalogue of Life (COL)
// ─────────────────────────────────────────────────────────────
async function harvestCOL(subjectType, kingdom, limit) {
  let total = 0;
  let offset = 0;
  const batchSize = 500;
  process.stdout.write(`  [COL/${subjectType}] `);
  while (offset < limit) {
    try {
      const p = new URLSearchParams({
        rank: 'species', status: 'accepted',
        limit: batchSize, offset,
      });
      if (kingdom) p.set('q', kingdom);
      const data = await fetchJSON(`https://api.catalogueoflife.org/dataset/COL/nameusage/search?${p}`);
      const results = data.result || [];
      if (!results.length) break;
      const rows = results.map(r => ({
        common_name: r.vernacularNames?.[0]?.name || null,
        scientific_name: r.name?.scientificName || r.label || null,
        subject_type: subjectType,
        kingdom: r.classification?.find(c => c.rank === 'kingdom')?.name || null,
        phylum:  r.classification?.find(c => c.rank === 'phylum')?.name  || null,
        taxon_class: r.classification?.find(c => c.rank === 'class')?.name  || null,
        taxon_order: r.classification?.find(c => c.rank === 'order')?.name  || null,
        family:  r.classification?.find(c => c.rank === 'family')?.name  || null,
        genus:   r.name?.genus || null,
        description: null, habitat: null, uses: null, image_url: null,
        source: 'col', external_id: `col:${r.id}`,
        observations_count: 0,
      })).filter(r => r.scientific_name);
      const n = await insertBatch(rows);
      total += n;
      offset += batchSize;
      process.stdout.write(`${n} `);
      await sleep(400);
    } catch (e) {
      process.stdout.write(`[err] `);
      break;
    }
  }
  console.log(`→ ${total}`);
  return total;
}

// ─────────────────────────────────────────────────────────────
// SOURCE 5: ALA — Atlas of Living Australia
// ─────────────────────────────────────────────────────────────
async function harvestALA(subjectType, kingdom, limit) {
  let total = 0;
  let startIndex = 0;
  const pageSize = 500;
  process.stdout.write(`  [ALA/${subjectType}] `);
  while (startIndex < limit) {
    try {
      const p = new URLSearchParams({
        q: `kingdom:${kingdom}`,
        rows: pageSize, start: startIndex,
        fl: 'species,scientificName,vernacularName,kingdom,phylum,class,order,family,genus,taxonRank',
        fq: 'taxonRank:species',
        wt: 'json',
      });
      const data = await fetchJSON(`https://biocache.ala.org.au/ws/occurrences/search?${p}`);
      const results = data.occurrences || [];
      if (!results.length) break;
      const seen = new Set();
      const rows = results
        .filter(r => r.scientificName && !seen.has(r.scientificName) && seen.add(r.scientificName))
        .map(r => ({
          common_name: r.vernacularName || null,
          scientific_name: r.scientificName,
          subject_type: subjectType,
          kingdom: r.kingdom || null, phylum: r.phylum || null,
          taxon_class: r.classs || null, taxon_order: r.order || null,
          family: r.family || null, genus: r.genus || null,
          description: null, habitat: 'Australia', uses: null, image_url: null,
          source: 'ala', external_id: `ala:${r.scientificName?.replace(/ /g, '_')}`,
          observations_count: 0,
        }));
      const n = await insertBatch(rows);
      total += n;
      startIndex += pageSize;
      process.stdout.write(`${n} `);
      await sleep(500);
    } catch (e) {
      process.stdout.write(`[err] `);
      break;
    }
  }
  console.log(`→ ${total}`);
  return total;
}

// ─────────────────────────────────────────────────────────────
// SOURCE 6: iDigBio — Digitized Museum Specimens
// ─────────────────────────────────────────────────────────────
async function harvestIdigbio(subjectType, kingdom, limit) {
  let total = 0;
  let offset = 0;
  const pageSize = 100;
  process.stdout.write(`  [iDigBio/${subjectType}] `);
  while (offset < limit) {
    try {
      const data = await fetchJSONPost('https://search.idigbio.org/v2/search/records', {
        rq: { kingdom: kingdom.toLowerCase() },
        limit: pageSize,
        offset,
        fields: ['scientificname', 'commonname', 'kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'specificepithet'],
      });
      const items = data.items || [];
      if (!items.length) break;
      const seen = new Set();
      const rows = items
        .map(i => i.data || {})
        .filter(d => d.scientificname && !seen.has(d.scientificname) && seen.add(d.scientificname))
        .map(d => ({
          common_name: d.commonname || null,
          scientific_name: d.scientificname,
          subject_type: subjectType,
          kingdom: d.kingdom || null, phylum: d.phylum || null,
          taxon_class: d.class || null, taxon_order: d.order || null,
          family: d.family || null, genus: d.genus || null,
          description: null, habitat: null, uses: null, image_url: null,
          source: 'idigbio', external_id: `idigbio:${d.scientificname?.replace(/ /g, '_')}`,
          observations_count: 0,
        }));
      const n = await insertBatch(rows);
      total += n;
      offset += pageSize;
      process.stdout.write(`${n} `);
      await sleep(300);
    } catch (e) {
      process.stdout.write(`[err] `);
      break;
    }
  }
  console.log(`→ ${total}`);
  return total;
}

// ─────────────────────────────────────────────────────────────
// SOURCE 7: Xeno-canto — Birds (recordings + taxonomy)
// ─────────────────────────────────────────────────────────────
async function harvestXenocanto(limit) {
  let total = 0;
  let page = 1;
  process.stdout.write(`  [Xeno-canto/bird] `);
  while (total < limit) {
    try {
      const data = await fetchJSON(`https://xeno-canto.org/api/2/recordings?query=type:song&page=${page}`);
      const recordings = data.recordings || [];
      if (!recordings.length) break;
      const seen = new Set();
      const rows = recordings
        .filter(r => r.sp && !seen.has(r.sp) && seen.add(r.sp))
        .map(r => ({
          common_name: r.en || null,
          scientific_name: `${r.gen} ${r.sp}`.trim(),
          subject_type: 'bird',
          kingdom: 'Animalia', phylum: 'Chordata',
          taxon_class: 'Aves', taxon_order: null,
          family: r.family || null, genus: r.gen || null,
          description: null,
          habitat: r.loc ? `Recorded in ${r.cnt}` : null,
          uses: null, image_url: null,
          source: 'xenocanto', external_id: `xenocanto:${r.gen}_${r.sp}`,
          observations_count: 0,
        })).filter(r => r.scientific_name?.trim().length > 2);
      const n = await insertBatch(rows);
      total += n;
      page++;
      process.stdout.write(`${n} `);
      await sleep(800);
      if (!data.numPages || page > data.numPages) break;
    } catch (e) {
      process.stdout.write(`[err] `);
      break;
    }
  }
  console.log(`→ ${total}`);
  return total;
}

// ─────────────────────────────────────────────────────────────
// SOURCE 8: WORMS — World Register of Marine Species
// ─────────────────────────────────────────────────────────────
const WORMS_GROUPS = [
  'Pisces', 'Crustacea', 'Mollusca', 'Echinodermata',
  'Cnidaria', 'Porifera', 'Annelida', 'Bryozoa',
];

async function harvestWorms(limit) {
  let total = 0;
  const perGroup = Math.ceil(limit / WORMS_GROUPS.length);
  process.stdout.write(`  [WORMS/marine] `);
  for (const group of WORMS_GROUPS) {
    let offset = 0;
    const batchSize = Math.min(perGroup, 500);
    let groupDone = 0;
    while (groupDone < perGroup) {
      try {
        const data = await fetchJSON(
          `https://www.marinespecies.org/rest/AphiaRecordsByMatchNames?scientificnames[]=${encodeURIComponent(group)}&marine_only=true`
        );
        if (!data || !Array.isArray(data) || !data[0]?.length) break;
        const results = data[0] || [];
        const rows = results.map(r => ({
          common_name: r.vernacularNames?.[0]?.vernacular || null,
          scientific_name: r.scientificname || r.valid_name || null,
          subject_type: 'marine',
          kingdom: r.kingdom || 'Animalia', phylum: r.phylum || null,
          taxon_class: r.class || null, taxon_order: r.order || null,
          family: r.family || null, genus: r.genus || null,
          description: null,
          habitat: 'Marine environment',
          uses: null, image_url: null,
          source: 'worms', external_id: `worms:${r.AphiaID || r.scientificname}`,
          observations_count: 0,
        })).filter(r => r.scientific_name);
        const n = await insertBatch(rows);
        total += n;
        groupDone += n;
        process.stdout.write(`${n} `);
        break; // WORMS doesn't support bulk pagination the same way
      } catch (e) {
        process.stdout.write(`[err] `);
        break;
      }
    }
    await sleep(400);
  }

  // Bulk supplement via GBIF marine
  const marineBatch = await harvestGbif('marine', { kingdom: 'Animalia', phylum: 'Chordata', class: 'Actinopterygii' }, Math.floor(limit / 2));
  total += marineBatch;
  return total;
}

// ─────────────────────────────────────────────────────────────
// SOURCE 9: Open Tree of Life — Taxonomy supplement
// ─────────────────────────────────────────────────────────────
const OTL_NAMES = [
  'Quercus', 'Rosa', 'Pinus', 'Acacia', 'Eucalyptus',
  'Apis', 'Papilio', 'Carabus', 'Bombus', 'Vespa',
  'Turdus', 'Falco', 'Accipiter', 'Cygnus', 'Columba',
  'Amanita', 'Boletus', 'Cantharellus', 'Ganoderma', 'Pleurotus',
  'Cyperus', 'Amaranthus', 'Chenopodium', 'Rumex', 'Convolvulus',
];

async function harvestOTL(subjectType) {
  let total = 0;
  process.stdout.write(`  [OTL/${subjectType}] `);
  for (const name of OTL_NAMES) {
    try {
      const data = await fetchJSONPost('https://api.opentreeoflife.org/v3/tnrs/autocomplete', {
        name, context_name: 'All life',
      });
      const results = Array.isArray(data) ? data : [];
      const rows = results
        .filter(r => r.unique_name)
        .map(r => ({
          common_name: null,
          scientific_name: r.unique_name || r.name,
          subject_type: subjectType,
          kingdom: null, phylum: null, taxon_class: null, taxon_order: null,
          family: null, genus: name,
          description: null, habitat: null, uses: null, image_url: null,
          source: 'otl', external_id: `otl:${r.ott_id || r.unique_name}`,
          observations_count: 0,
        }));
      const n = await insertBatch(rows);
      total += n;
      await sleep(200);
    } catch (_) {}
  }
  process.stdout.write(`→ ${total}\n`);
  return total;
}

// ─────────────────────────────────────────────────────────────
// SOURCE 10: BOLD Systems — Barcode of Life
// ─────────────────────────────────────────────────────────────
const BOLD_TAXA = {
  insect: ['Lepidoptera', 'Coleoptera', 'Diptera', 'Hymenoptera', 'Hemiptera'],
  bird:   ['Passeriformes', 'Accipitriformes', 'Columbiformes'],
  marine: ['Actinopterygii', 'Chondrichthyes'],
  plant:  ['Poaceae', 'Fabaceae', 'Asteraceae', 'Orchidaceae'],
};

async function harvestBold(subjectType, limit) {
  const taxa = BOLD_TAXA[subjectType] || BOLD_TAXA.insect;
  let total = 0;
  const perTaxon = Math.ceil(limit / taxa.length);
  process.stdout.write(`  [BOLD/${subjectType}] `);
  for (const taxon of taxa) {
    try {
      const data = await fetchJSON(
        `https://boldsystems.org/index.php/API_Public/specimen?taxon=${encodeURIComponent(taxon)}&format=json`
      );
      const records = data?.bold_records?.specimens?.specimen || [];
      const arr = Array.isArray(records) ? records : [records];
      const seen = new Set();
      const rows = arr
        .filter(s => s?.taxonomy?.species?.taxon?.name && !seen.has(s.taxonomy.species.taxon.name) && seen.add(s.taxonomy.species.taxon.name))
        .slice(0, perTaxon)
        .map(s => {
          const tax = s.taxonomy || {};
          return {
            common_name: null,
            scientific_name: tax.species?.taxon?.name || null,
            subject_type: subjectType,
            kingdom: tax.kingdom?.taxon?.name || null,
            phylum:  tax.phylum?.taxon?.name  || null,
            taxon_class: tax.class?.taxon?.name || null,
            taxon_order: tax.order?.taxon?.name || null,
            family:  tax.family?.taxon?.name  || null,
            genus:   tax.genus?.taxon?.name   || null,
            description: null, habitat: s.collection_event?.habitat || null,
            uses: null, image_url: null,
            source: 'bold', external_id: `bold:${tax.species?.taxon?.name?.replace(/ /g, '_')}`,
            observations_count: 0,
          };
        }).filter(r => r.scientific_name);
      const n = await insertBatch(rows);
      total += n;
      process.stdout.write(`${n} `);
      await sleep(600);
    } catch (e) {
      process.stdout.write(`[err] `);
    }
  }
  console.log(`→ ${total}`);
  return total;
}

// ─────────────────────────────────────────────────────────────
// ORCHESTRATOR
// ─────────────────────────────────────────────────────────────
const HARVEST_PLAN = {
  plant: async (limit) => {
    let t = 0;
    console.log('── Plants ──');
    t += await harvestInat('plant',  'Plantae', Math.floor(limit * 0.3));
    t += await harvestGbif('plant',  GBIF_CONFIGS.plant, Math.floor(limit * 0.4));
    t += await harvestCOL('plant',   'Plantae', Math.floor(limit * 0.2));
    t += await harvestALA('plant',   'Plantae', Math.floor(limit * 0.1));
    t += await harvestBold('plant', Math.floor(limit * 0.1));
    return t;
  },
  insect: async (limit) => {
    let t = 0;
    console.log('── Insects ──');
    t += await harvestInat('insect', 'Insecta',  Math.floor(limit * 0.3));
    t += await harvestGbif('insect', GBIF_CONFIGS.insect, Math.floor(limit * 0.4));
    t += await harvestCOL('insect',  'Insecta',  Math.floor(limit * 0.1));
    t += await harvestIdigbio('insect', 'Animalia', Math.floor(limit * 0.1));
    t += await harvestBold('insect', Math.floor(limit * 0.2));
    return t;
  },
  bird: async (limit) => {
    let t = 0;
    console.log('── Birds ──');
    t += await harvestInat('bird', 'Aves', Math.floor(limit * 0.3));
    t += await harvestGbif('bird', GBIF_CONFIGS.bird, Math.floor(limit * 0.3));
    t += await harvestXenocanto(Math.floor(limit * 0.2));
    t += await harvestBold('bird', Math.floor(limit * 0.1));
    t += await harvestALA('bird', 'Aves', Math.floor(limit * 0.1));
    return t;
  },
  fungi: async (limit) => {
    let t = 0;
    console.log('── Fungi ──');
    t += await harvestInat('fungi', 'Fungi', Math.floor(limit * 0.4));
    t += await harvestGbif('fungi', GBIF_CONFIGS.fungi, Math.floor(limit * 0.4));
    t += await harvestCOL('fungi', 'Fungi', Math.floor(limit * 0.2));
    return t;
  },
  spider: async (limit) => {
    let t = 0;
    console.log('── Spiders ──');
    t += await harvestInat('spider', 'Arachnida', Math.floor(limit * 0.5));
    t += await harvestGbif('spider', GBIF_CONFIGS.spider, Math.floor(limit * 0.5));
    return t;
  },
  marine: async (limit) => {
    let t = 0;
    console.log('── Marine ──');
    t += await harvestObis('marine', 'Animalia', Math.floor(limit * 0.3));
    t += await harvestWorms(Math.floor(limit * 0.4));
    t += await harvestIdigbio('marine', 'Animalia', Math.floor(limit * 0.3));
    return t;
  },
  mammal: async (limit) => {
    let t = 0;
    console.log('── Mammals ──');
    t += await harvestInat('mammal', 'Mammalia', Math.floor(limit * 0.5));
    t += await harvestGbif('mammal', GBIF_CONFIGS.mammal, Math.floor(limit * 0.5));
    return t;
  },
  reptile: async (limit) => {
    let t = 0;
    console.log('── Reptiles ──');
    t += await harvestInat('reptile', 'Reptilia', Math.floor(limit * 0.5));
    t += await harvestGbif('reptile', GBIF_CONFIGS.reptile, Math.floor(limit * 0.5));
    return t;
  },
};

async function main() {
  const typeArg  = process.argv[2] || 'all';
  const limitArg = parseInt(process.argv[3] || '5000', 10);

  const types = typeArg === 'all' ? Object.keys(HARVEST_PLAN) : [typeArg];

  if (!types.every(t => HARVEST_PLAN[t])) {
    console.error(`Unknown type. Valid: ${Object.keys(HARVEST_PLAN).join(', ')}, all`);
    process.exit(1);
  }

  const perType = typeArg === 'all' ? Math.ceil(limitArg / types.length) : limitArg;

  console.log(`\nFloraIQ Harvester — ${limitArg.toLocaleString()} records × ${types.join(', ')}`);
  console.log('Sources: iNaturalist · GBIF · OBIS · COL · ALA · iDigBio · Xeno-canto · WORMS · OTL · BOLD\n');

  let grand = 0;
  for (const type of types) {
    const n = await HARVEST_PLAN[type](perType);
    grand += n;
    await sleep(1000);
  }

  // Supplement with cross-source taxonomy from OTL
  console.log('\n── Open Tree of Life supplement ──');
  grand += await harvestOTL('plant');

  const rows = await pool.query(
    'SELECT subject_type, COUNT(*) FROM organisms GROUP BY subject_type ORDER BY COUNT(*) DESC'
  );
  console.log('\n── Database totals ──');
  rows.rows.forEach(r => console.log(`  ${r.subject_type.padEnd(12)} ${Number(r.count).toLocaleString()}`));

  const total = await pool.query('SELECT COUNT(*) FROM organisms');
  console.log(`\n  TOTAL organisms: ${Number(total.rows[0].count).toLocaleString()}`);
  const plants = await pool.query('SELECT COUNT(*) FROM plants');
  console.log(`  TOTAL plants:    ${Number(plants.rows[0].count).toLocaleString()}`);
  console.log(`\nHarvested ${grand.toLocaleString()} new records. Done.\n`);

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
