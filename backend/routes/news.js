const express = require('express');
const router  = express.Router();

const CACHE = new Map(); // { key: { ts, articles } }
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function cached(key) {
  const c = CACHE.get(key);
  return c && Date.now() - c.ts < CACHE_TTL ? c.articles : null;
}
function store(key, articles) {
  CACHE.set(key, { ts: Date.now(), articles });
}

// ── GET /api/news?q=wildlife&limit=15 ─────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const q     = (req.query.q || 'wildlife nature').trim();
    const limit = Math.min(parseInt(req.query.limit) || 15, 30);
    const cacheKey = `${q}:${limit}`;

    const hit = cached(cacheKey);
    if (hit) return res.json({ articles: hit, source: 'cache' });

    const articles = await fetchNews(q, limit);
    store(cacheKey, articles);
    res.json({ articles, source: 'live' });
  } catch (err) { next(err); }
});

async function fetchNews(q, limit) {
  const articles = [];

  // ── Source 1: NewsData.io (free tier, no key needed for basic) ─
  if (process.env.NEWSDATA_API_KEY) {
    try {
      const url = `https://newsdata.io/api/1/news?apikey=${process.env.NEWSDATA_API_KEY}&q=${encodeURIComponent(q)}&language=en&category=science,environment&size=${limit}`;
      const r = await fetchJson(url, 4000);
      (r.results || []).forEach(a => articles.push({
        title:       a.title,
        description: a.description,
        url:         a.link,
        image:       a.image_url || null,
        source:      a.source_id || 'NewsData',
        publishedAt: a.pubDate,
      }));
    } catch { /* skip */ }
  }

  // ── Source 2: GNews (free tier — 100 req/day) ─────────────────
  if (articles.length < limit && process.env.GNEWS_API_KEY) {
    try {
      const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=en&max=${limit}&token=${process.env.GNEWS_API_KEY}`;
      const r = await fetchJson(url, 4000);
      (r.articles || []).forEach(a => articles.push({
        title:       a.title,
        description: a.description,
        url:         a.url,
        image:       a.image || null,
        source:      a.source?.name || 'GNews',
        publishedAt: a.publishedAt,
      }));
    } catch { /* skip */ }
  }

  // ── Source 3: GDELT (always free, no key, global real-time news)
  if (articles.length < limit) {
    try {
      const gdeltQ = encodeURIComponent(q);
      const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${gdeltQ}&mode=artlist&maxrecords=${limit}&format=json&timespan=3d&sort=datedesc`;
      const r = await fetchJson(url, 6000);
      ((r.articles) || []).forEach(a => articles.push({
        title:       a.title,
        description: null,
        url:         a.url,
        image:       a.socialimage || null,
        source:      a.domain || 'GDELT',
        publishedAt: a.seendate ? parseGdeltDate(a.seendate) : null,
      }));
    } catch { /* skip */ }
  }

  // ── Source 4: RSS via rss2json (BBC Science / Nature) ─────────
  if (articles.length < limit) {
    try {
      const feeds = [
        'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml',
        'https://rss.nytimes.com/services/xml/rss/nyt/Science.xml',
      ];
      for (const feed of feeds) {
        if (articles.length >= limit) break;
        const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed)}&count=10`;
        const r = await fetchJson(url, 4000);
        (r.items || []).forEach(i => articles.push({
          title:       i.title,
          description: i.description?.replace(/<[^>]*>/g, '').slice(0, 200) || null,
          url:         i.link,
          image:       i.enclosure?.link || i.thumbnail || null,
          source:      r.feed?.title || 'RSS',
          publishedAt: i.pubDate,
        }));
      }
    } catch { /* skip */ }
  }

  // Deduplicate by URL and return up to limit
  const seen = new Set();
  return articles.filter(a => {
    if (!a.url || seen.has(a.url)) return false;
    seen.add(a.url); return true;
  }).slice(0, limit);
}

function fetchJson(url, timeout = 5000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  return fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'FloraIQ/2.0' } })
    .then(r => { clearTimeout(timer); return r.json(); })
    .catch(e => { clearTimeout(timer); throw e; });
}

function parseGdeltDate(s) {
  // GDELT format: "20240315T120000Z"
  try {
    return new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T${s.slice(9,11)}:${s.slice(11,13)}:00Z`).toISOString();
  } catch { return null; }
}

module.exports = router;
