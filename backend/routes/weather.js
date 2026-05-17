const express = require('express');
const { query } = require('../db');

const router = express.Router();
const OWM_KEY = process.env.OPENWEATHER_API_KEY;

function fetchWithTimeout(url, ms = 8000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return fetch(url, { signal: c.signal }).finally(() => clearTimeout(t));
}

// ── Shared weather fetcher ─────────────────────────────────────
async function getWeatherData(lat, lon) {
  const cacheKey = `weather:${lat.toFixed(2)}:${lon.toFixed(2)}`;
  const cached   = await query('SELECT data_json, cached_at FROM weather_cache WHERE cache_key=$1', [cacheKey]);
  if (cached.rows.length && (Date.now() - new Date(cached.rows[0].cached_at)) < 30 * 60 * 1000) {
    return cached.rows[0].data_json;
  }

  if (!OWM_KEY) {
    // Fallback: open-meteo (no key required)
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,uv_index_max,sunrise,sunset&timezone=auto&forecast_days=7`;
    const res  = await fetchWithTimeout(url);
    if (!res.ok) throw new Error('Weather API unavailable');
    const data = await res.json();

    const cw  = data.current_weather || {};
    const daily = data.daily || {};
    const result = {
      source: 'open-meteo',
      current: {
        temp_c: cw.temperature,
        wind_kph: cw.windspeed,
        weather_code: cw.weathercode,
        is_day: cw.is_day,
      },
      forecast: (daily.time || []).map((d, i) => ({
        date:         d,
        temp_max_c:   daily.temperature_2m_max?.[i],
        temp_min_c:   daily.temperature_2m_min?.[i],
        rain_mm:      daily.precipitation_sum?.[i],
        uv_index:     daily.uv_index_max?.[i],
        sunrise:      daily.sunrise?.[i],
        sunset:       daily.sunset?.[i],
      })),
    };

    await query(
      'INSERT INTO weather_cache (cache_key, data_json) VALUES ($1,$2) ON CONFLICT (cache_key) DO UPDATE SET data_json=$2, cached_at=NOW()',
      [cacheKey, result]
    ).catch(() => {});
    return result;
  }

  // OpenWeatherMap
  const [current, forecast] = await Promise.all([
    fetchWithTimeout(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric`),
    fetchWithTimeout(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric&cnt=40`),
  ]);
  if (!current.ok) throw new Error(`OpenWeatherMap error ${current.status}`);
  const cData = await current.json();
  const fData = forecast.ok ? await forecast.json() : null;

  const result = {
    source: 'openweathermap',
    current: {
      temp_c:      cData.main?.temp,
      feels_like_c:cData.main?.feels_like,
      humidity_pct:cData.main?.humidity,
      pressure_hpa:cData.main?.pressure,
      wind_kph:    cData.wind?.speed ? cData.wind.speed * 3.6 : null,
      wind_dir:    cData.wind?.deg,
      description: cData.weather?.[0]?.description,
      icon:        cData.weather?.[0]?.icon,
      visibility_km: cData.visibility ? cData.visibility / 1000 : null,
      uv_index:    null,
      sunrise:     cData.sys?.sunrise ? new Date(cData.sys.sunrise * 1000).toISOString() : null,
      sunset:      cData.sys?.sunset  ? new Date(cData.sys.sunset  * 1000).toISOString() : null,
    },
    forecast: fData?.list?.slice(0, 24).map(f => ({
      datetime:     f.dt_txt,
      temp_c:       f.main?.temp,
      description:  f.weather?.[0]?.description,
      rain_3h_mm:   f.rain?.['3h'] || 0,
      wind_kph:     f.wind?.speed ? f.wind.speed * 3.6 : null,
    })) || [],
    city: cData.name,
  };

  await query(
    'INSERT INTO weather_cache (cache_key, data_json) VALUES ($1,$2) ON CONFLICT (cache_key) DO UPDATE SET data_json=$2, cached_at=NOW()',
    [cacheKey, result]
  ).catch(() => {});
  return result;
}

// ── Build plant care advice from weather data ──────────────────
function buildPlantAdvice(weather) {
  const advice = [];
  const c = weather.current || {};
  const temp = c.temp_c;
  const humidity = c.humidity_pct;
  const wind = c.wind_kph;

  if (temp !== undefined) {
    if (temp > 35) advice.push({ level: 'warning', msg: 'Extreme heat — water plants early morning, apply mulch to retain moisture, shade sensitive plants.' });
    else if (temp < 5) advice.push({ level: 'warning', msg: 'Near freezing — protect frost-sensitive plants, bring potted plants indoors.' });
    else if (temp < 0) advice.push({ level: 'danger',  msg: 'Frost/freeze conditions — most plants need protection or will suffer damage.' });
    else if (temp >= 20 && temp <= 28) advice.push({ level: 'good', msg: 'Ideal growing temperature. Good day for transplanting, fertilizing, and general care.' });
  }
  if (humidity !== undefined) {
    if (humidity > 85) advice.push({ level: 'warning', msg: 'Very high humidity — monitor for fungal diseases. Improve air circulation around plants.' });
    else if (humidity < 30) advice.push({ level: 'warning', msg: 'Very dry air — increase watering frequency. Mist indoor plants if needed.' });
  }
  if (wind !== undefined && wind > 50) {
    advice.push({ level: 'warning', msg: 'Strong winds — stake tall plants, protect young seedlings, delay pesticide application.' });
  }

  // Forecast rain check
  const nextRain = (weather.forecast || []).slice(0, 8).find(f => (f.rain_3h_mm || f.rain_mm) > 0);
  if (nextRain) {
    advice.push({ level: 'info', msg: `Rain expected around ${nextRain.datetime || nextRain.date} — hold off on irrigation and avoid fertilizing just before rain.` });
  } else {
    advice.push({ level: 'info', msg: 'No rain in the short-term forecast — maintain regular irrigation schedule.' });
  }

  return advice;
}

// ── Survival weather assessment ───────────────────────────────
function buildSurvivalAdvice(weather) {
  const advice = [];
  const c = weather.current || {};
  const temp = c.temp_c;

  if (temp !== undefined) {
    if (temp < 0)  advice.push({ level: 'danger',  msg: 'FREEZING: Hypothermia risk. Insulate shelter, stay dry, high-calorie food critical.' });
    else if (temp < 10) advice.push({ level: 'warning', msg: 'Cold: Wear layers, avoid getting wet. Watch for hypothermia symptoms.' });
    else if (temp > 38) advice.push({ level: 'danger',  msg: 'EXTREME HEAT: Heat stroke risk. Seek shade, hydrate constantly, rest during midday.' });
    else if (temp > 32) advice.push({ level: 'warning', msg: 'Hot: Stay hydrated, avoid exertion between 11am–3pm, look for shade.' });
    else advice.push({ level: 'good', msg: 'Comfortable temperature for outdoor survival activities.' });
  }

  const wind = c.wind_kph;
  if (wind > 60) advice.push({ level: 'danger',  msg: 'Dangerous winds — secure shelter, avoid tall trees, do not attempt river crossings.' });
  else if (wind > 30) advice.push({ level: 'warning', msg: 'Strong winds — reinforce shelter, cold wind chill effect, protect fire.' });

  const humidity = c.humidity_pct;
  if (humidity > 90) advice.push({ level: 'warning', msg: 'Very humid — fungal growth on food, damp bedding risk. Elevate camp from ground.' });

  return advice;
}

// ── GET /api/weather?lat=&lon= ────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    if (!isFinite(lat) || !isFinite(lon)) return res.status(400).json({ error: 'lat and lon are required numeric values' });
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return res.status(400).json({ error: 'Invalid coordinates' });

    const weather      = await getWeatherData(lat, lon);
    const plant_advice = buildPlantAdvice(weather);
    const survival_advice = buildSurvivalAdvice(weather);

    // Reverse geocode location name
    let location_name = null;
    try {
      const geoRes = await fetchWithTimeout(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, 6000);
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        const a = geoData.address || {};
        location_name = [a.city || a.town || a.village, a.state, a.country].filter(Boolean).join(', ');
      }
    } catch { /* skip geo on timeout */ }

    res.json({ weather, plant_advice, survival_advice, location_name, lat, lon });
  } catch (err) { next(err); }
});

module.exports = router;
