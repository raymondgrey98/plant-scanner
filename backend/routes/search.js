const express = require('express');
const { query } = require('../db');

const router = express.Router();

function fetchWithTimeout(url, ms = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

// ── Local full-text search across plants + organisms tables ───────
async function localFTS(q) {
  const safeFts = q.replace(/[^a-zA-Z0-9\s\-\.]/g, ' ').trim().split(/\s+/).join(' & ');
  const likeQ = `%${q}%`;

  const [plantsResult, organismsResult] = await Promise.allSettled([
    // Plants: prefer FTS, fallback to ILIKE
    query(
      `SELECT id, common_name, scientific_name, care_summary, watering, fertilizer,
              sunlight, soil, image_url, habitat, disease, pest, uses,
              'plant' AS subject_type, NULL AS family, NULL AS genus,
              NULL AS description, NULL AS observations_count,
              COALESCE(ts_rank(search_vec, plainto_tsquery('english', $1)), 0) AS rank
       FROM plants
       WHERE search_vec @@ plainto_tsquery('english', $1)
          OR common_name ILIKE $2 OR scientific_name ILIKE $2
          OR habitat ILIKE $2 OR uses ILIKE $2
       ORDER BY rank DESC, common_name
       LIMIT 12`,
      [safeFts, likeQ]
    ),
    // Organisms: FTS + ILIKE fallback, all types
    query(
      `SELECT id, common_name, scientific_name, subject_type, family, genus,
              description, habitat, image_url, source, external_id,
              observations_count, uses, NULL AS care_summary,
              COALESCE(ts_rank(search_vec, plainto_tsquery('english', $1)), 0) AS rank
       FROM organisms
       WHERE search_vec @@ plainto_tsquery('english', $1)
          OR common_name ILIKE $2 OR scientific_name ILIKE $2
          OR family ILIKE $2 OR genus ILIKE $2
       ORDER BY rank DESC, observations_count DESC NULLS LAST
       LIMIT 20`,
      [safeFts, likeQ]
    ),
  ]);

  const plantRows     = plantsResult.status   === 'fulfilled' ? plantsResult.value.rows   : [];
  const organismRows  = organismsResult.status === 'fulfilled' ? organismsResult.value.rows : [];
  return { plantRows, organismRows };
}

router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ local: [], organisms: [], gbif: [], powo: [], inat: [], papers: [], wiki: null });

    const wikiTitle = q.replace(/ /g, '_');

    const [ftsResult, gbifRes, powoRes, inatRes, papersRes, wikiRes] = await Promise.allSettled([
      localFTS(q),
      fetchWithTimeout(`https://api.gbif.org/v1/species/search?q=${encodeURIComponent(q)}&kingdom=Plantae&rank=SPECIES&limit=20`),
      fetchWithTimeout(`https://powo.science.kew.org/api/2/search?q=${encodeURIComponent(q)}&perPage=10`),
      fetchWithTimeout(`https://api.inaturalist.org/v1/taxa/search?q=${encodeURIComponent(q)}&rank=species&per_page=12&is_active=true&locale=en`),
      fetchWithTimeout(`https://api.openalex.org/works?search=${encodeURIComponent(q)}&filter=type:journal-article&per-page=8&select=title,doi,publication_year,primary_location,authorships,open_access&mailto=floraiq@research.org`),
      fetchWithTimeout(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`),
    ]);

    const { plantRows: local = [], organismRows: organisms = [] } =
      ftsResult.status === 'fulfilled' ? ftsResult.value : {};

    let gbif = [];
    if (gbifRes.status === 'fulfilled' && gbifRes.value.ok) {
      const d = await gbifRes.value.json();
      gbif = (d.results || []).map((s) => ({
        key: s.key,
        scientific_name: s.canonicalName || s.scientificName,
        common_name: s.vernacularNames?.[0]?.vernacularName || s.canonicalName,
        family: s.family,
        kingdom: s.kingdom,
        phylum: s.phylum,
        class: s.class,
        order: s.order,
        genus: s.genus,
        source: 'gbif',
        gbif_key: s.key,
      }));
    }

    let powo = [];
    if (powoRes.status === 'fulfilled' && powoRes.value.ok) {
      const d = await powoRes.value.json();
      powo = (d.results || []).map((p) => ({
        fqId: p.fqId,
        scientific_name: p.name,
        common_name: p.synonymOf?.name || p.name,
        source: 'powo',
        url: `https://powo.science.kew.org/taxon/${p.fqId}`,
      }));
    }

    let inat = [];
    if (inatRes.status === 'fulfilled' && inatRes.value.ok) {
      const d = await inatRes.value.json();
      inat = (d.results || []).map((t) => ({
        id: t.id,
        scientific_name: t.name,
        common_name: t.preferred_common_name || t.name,
        rank: t.rank,
        photo: t.default_photo?.medium_url || null,
        wikipedia_url: t.wikipedia_url,
        iconic_taxon: t.iconic_taxon_name,
        observations_count: t.observations_count,
        source: 'inat',
      }));
    }

    let papers = [];
    if (papersRes.status === 'fulfilled' && papersRes.value.ok) {
      const d = await papersRes.value.json();
      papers = (d.results || [])
        .filter(w => w.title)
        .map((w) => ({
          title: w.title,
          doi: w.doi,
          year: w.publication_year,
          journal: w.primary_location?.source?.display_name || null,
          first_author: w.authorships?.[0]?.author?.display_name || null,
          is_oa: w.open_access?.is_oa || false,
          oa_url: w.open_access?.oa_url || null,
        }));
    }

    let wiki = null;
    if (wikiRes.status === 'fulfilled' && wikiRes.value.ok) {
      const d = await wikiRes.value.json();
      if (d.type !== 'disambiguation' && d.extract) {
        wiki = {
          title: d.title,
          extract: d.extract,
          thumbnail: d.thumbnail?.source || null,
          url: d.content_urls?.desktop?.page || null,
        };
      }
    }

    res.json({
      local,
      organisms,
      gbif,
      powo,
      inat,
      papers,
      wiki,
      total: local.length + organisms.length + gbif.length + powo.length + inat.length,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
