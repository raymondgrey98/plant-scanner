const express = require('express');
const router = express.Router();

// Proxy disaster APIs to avoid browser CORS issues

// GET /api/disasters/earthquakes — USGS real-time (no key)
router.get('/earthquakes', async (_req, res) => {
  try {
    const r = await fetch('https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=4.5&limit=150&orderby=time');
    const d = await r.json();
    res.json(d.features?.map(f => ({
      id: f.id, type: 'earthquake',
      lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0],
      magnitude: f.properties.mag, place: f.properties.place,
      time: f.properties.time, url: f.properties.url,
      alert: f.properties.alert,
    })) || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/disasters/gdacs — all disaster types (floods, cyclones, volcanoes, wildfires)
router.get('/gdacs', async (_req, res) => {
  try {
    const r = await fetch('https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=EQ,TC,FL,DR,WF,VO&alertlevel=&limit=100', {
      headers: { Accept: 'application/json', 'User-Agent': 'FloraIQ/2.0' },
    });
    if (!r.ok) throw new Error(`GDACS ${r.status}`);
    const d = await r.json();
    const events = (d.features || []).map(f => ({
      id: f.properties?.eventid, type: f.properties?.eventtype?.toLowerCase(),
      lat: f.geometry?.coordinates?.[1], lng: f.geometry?.coordinates?.[0],
      name: f.properties?.eventname || f.properties?.eventtype,
      alert: f.properties?.alertlevel?.toLowerCase(),
      date: f.properties?.fromdate,
      country: f.properties?.countryname,
      description: f.properties?.htmldescription?.replace(/<[^>]*>/g, '').slice(0, 200),
    })).filter(e => e.lat && e.lng);
    res.json(events);
  } catch (e) {
    // fallback: return empty so map still works
    res.json([]);
  }
});

// GET /api/disasters/weather — NOAA active weather alerts (US)
router.get('/weather-alerts', async (_req, res) => {
  try {
    const r = await fetch('https://api.weather.gov/alerts/active?status=actual&message_type=alert&severity=Extreme,Severe', {
      headers: { 'User-Agent': 'FloraIQ/2.0 (floraiq.app)', Accept: 'application/geo+json' },
    });
    if (!r.ok) throw new Error(`NOAA ${r.status}`);
    const d = await r.json();
    res.json((d.features || []).slice(0, 50).map(f => ({
      id: f.id, type: 'weather',
      event: f.properties?.event,
      headline: f.properties?.headline,
      description: f.properties?.description?.slice(0, 300),
      severity: f.properties?.severity,
      urgency: f.properties?.urgency,
      onset: f.properties?.onset,
      expires: f.properties?.expires,
      areaDesc: f.properties?.areaDesc,
    })));
  } catch (e) { res.json([]); }
});

// GET /api/disasters/reliefweb — global flood/tsunami/disaster reports
router.get('/reliefweb', async (_req, res) => {
  try {
    const body = JSON.stringify({
      limit: 50, sort: ['date:desc'],
      fields: { include: ['name', 'date', 'type', 'country', 'status', 'glide', 'url'] },
      filter: { field: 'status', value: ['alert', 'ongoing'] },
    });
    const r = await fetch('https://api.reliefweb.int/v1/disasters?appname=floraiq', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
    });
    const d = await r.json();
    res.json((d.data || []).map(item => ({
      id: item.id,
      name: item.fields?.name,
      type: item.fields?.type?.[0]?.name,
      country: item.fields?.country?.[0]?.name,
      date: item.fields?.date?.created,
      status: item.fields?.status,
      url: item.fields?.url,
    })));
  } catch (e) { res.json([]); }
});

module.exports = router;
