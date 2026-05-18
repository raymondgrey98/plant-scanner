/**
 * FloraIQ Landscape Intelligence API
 *
 * Upload a photo of ANY landscape/environment and get:
 * - Environment type, climate zone, likely hemisphere and region
 * - Camping safety score with hazard breakdown
 * - Wild food sources and foraging opportunities visible
 * - Natural dangers: predators, toxic plants, disaster risks
 * - Sun/shadow navigation hints (hemisphere, time of day indicator)
 * - Water source assessment
 * - Environmental damage report
 * - Cooking and harvesting guide for identified plants
 *
 * Uses EXIF GPS (if present) + AI vision for regional intelligence.
 */

const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const { query } = require('../db');
const { optionalAuth } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { extractLocation } = require('../utils/exif');
const { uploadImage, isCloudinaryEnabled, deleteLocalFile } = require('../utils/cloudinary');

const router  = express.Router();
const upload  = multer({ dest: 'uploads/landscape/', limits: { fileSize: 15 * 1024 * 1024 } });

// ── Providers (same chain as gemini.js) ──────────────────────────
const GEMINI_API_KEY   = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY   = process.env.OPENAI_API_KEY;
const CLAUDE_API_KEY   = process.env.ANTHROPIC_API_KEY;
const OPENROUTER_KEY   = process.env.OPENROUTER_API_KEY;

const MIME_BY_EXT = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
function mimeFor(fp) { return MIME_BY_EXT[path.extname(fp).toLowerCase()] || 'image/jpeg'; }

function buildLandscapePrompt(geoHint) {
  const geoContext = geoHint
    ? `The photo was taken at or near: ${geoHint}. Use this to refine regional details.`
    : 'No GPS data available — infer region from visual clues only.';

  return `You are FloraIQ's Environmental Intelligence Engine. Analyze this landscape or environment photo like an expert field ecologist, survival instructor, and environmental scientist combined.

${geoContext}

Your task is to extract MAXIMUM intelligence from this single image — think of it as nature OSINT. A hiker, farmer, or villager who has never done research is depending on this analysis.

ANALYZE:
1. Terrain and vegetation visible to identify the exact environment type
2. Sun angle, shadow direction, and vegetation type to determine hemisphere and approximate season
3. Climate zone from plant species, soil colour, moisture indicators
4. Likely geographic region/country from flora characteristics
5. Camping suitability and specific safety concerns
6. ALL visible plant types — are any edible, medicinal, or toxic?
7. What wildlife (predators, insects, reptiles) typically inhabits this environment
8. Water source assessment — streams, rainfall indicators, dew collection opportunities
9. Natural disaster risks for this terrain type
10. Environmental damage visible — deforestation, erosion, pollution
11. Survival resources visible — materials for shelter, fire, cordage, signaling
12. Cooking and harvesting methods for any wild edibles identified
13. Navigation hints from sun/shadows/vegetation/terrain

Reply ONLY with a valid JSON object:
{
  "environment_type": "tropical_rainforest|cloud_forest|montane|coastal|mangrove|grassland|savanna|desert|arctic_tundra|temperate_forest|boreal_taiga|wetland_swamp|agricultural|riverine|urban_edge|volcanic|karst_limestone",
  "environment_label": "Human-readable environment name e.g. Tropical montane cloud forest",
  "hemisphere": "northern|southern|equatorial|unclear",
  "hemisphere_confidence": 0.85,
  "hemisphere_reasoning": "Explain visual clues: sun position, shadow direction, vegetation seasonality, fern orientation",
  "climate_zone": "tropical|subtropical|mediterranean|temperate|continental|subarctic|arctic|arid_desert|semi_arid",
  "likely_region": "Most probable geographic region e.g. Southeast Asia highlands, Amazon basin, Appalachian mountains",
  "likely_countries": ["country1", "country2"],
  "season_indicator": "wet_season|dry_season|spring|summer|autumn|winter|year_round|unclear",
  "altitude_estimate": "e.g. lowland (<500m), mid-elevation (500-1500m), high altitude (>1500m)",
  "camping_safety_score": 7,
  "camping_safety_label": "SAFE|CAUTION|RISKY|DANGEROUS",
  "camping_pros": ["List of positive factors for camping here"],
  "camping_cons": ["List of risks or challenges"],
  "immediate_hazards": ["List any visible immediate dangers"],
  "wildlife_dangers": {
    "predators": "Description of likely apex predators in this ecosystem",
    "venomous": "Likely venomous snakes, spiders, insects for this region",
    "insects": "Mosquitoes, ticks, biting flies — disease vectors present",
    "other": "Any other wildlife risk e.g. hippos near water, bear country"
  },
  "visible_plants": [
    {
      "description": "Visual description of plant",
      "likely_species": "Most probable species or family",
      "edible": true,
      "edible_parts": "leaves, fruit, root, bark",
      "how_to_harvest": "When and how to harvest safely",
      "how_to_cook": "Preparation method — boiling, roasting, raw, drying",
      "medicinal_use": "Traditional medicinal application if any",
      "toxic_risk": "null or description of toxic parts/compounds",
      "survival_value": "high|medium|low|none"
    }
  ],
  "wild_food_sources": {
    "plants": "Description of foraging opportunities visible",
    "fungi": "Likely mushroom types for this environment and season",
    "insects": "Edible insects likely present (grubs, crickets, ants, etc.)",
    "small_game": "Huntable small animals if survival situation",
    "water_plants": "Aquatic edibles if water visible"
  },
  "water_assessment": {
    "sources_visible": true,
    "water_description": "Streams, rivers, rain collection, dew, plant transpiration bags",
    "purification_needed": true,
    "purification_methods": "Boiling, solar disinfection, plant-based filtration",
    "waterborne_risks": "Leptospirosis, cholera, giardia risk level for this region"
  },
  "fire_resources": {
    "available": true,
    "tinder": "Dry materials visible for fire starting",
    "fuel": "Firewood availability assessment",
    "fire_hazard": "Risk of uncontrolled fire in this environment"
  },
  "shelter_resources": "Natural shelter materials available: large leaves, bamboo, vines, caves, rock overhangs",
  "navigation_hints": {
    "sun_position": "Describe sun/shadow in image for direction estimation",
    "vegetation_clues": "Moss on north side, ferns face equator, etc.",
    "terrain_clues": "River flow direction, slope aspect, valley orientation",
    "landmark_features": "Notable terrain visible for waypoint navigation"
  },
  "natural_disaster_risks": {
    "landslide_risk": "low|medium|high — reasoning",
    "flood_risk": "low|medium|high — reasoning",
    "wildfire_risk": "low|medium|high — reasoning",
    "cyclone_typhoon_risk": "low|medium|high — reasoning",
    "earthquake_volcanic": "low|medium|high — reasoning",
    "lightning_risk": "low|medium|high — reasoning"
  },
  "environmental_assessment": {
    "damage_visible": false,
    "damage_types": "Deforestation, erosion, pollution, invasive species visible",
    "biodiversity_estimate": "high|medium|low|degraded",
    "conservation_concern": "Description of any conservation issues visible",
    "human_impact": "Description of human activity evidence in the image"
  },
  "survival_priority_actions": ["Prioritized list of actions for a stranded hiker in this environment"],
  "cooking_methods_available": {
    "fire_cooking": "Rock boiling, spit roasting, earth oven, ash baking",
    "no_fire_methods": "Solar cooking, fermentation, raw preparation, sun drying",
    "preservation": "Smoking, drying, salt if coastal, fermentation"
  },
  "indigenous_knowledge_note": "Any traditional indigenous practices known for this region and environment type",
  "emergency_signal_options": "Visible clearing for signal fire, reflective surfaces, high ground for phone signal",
  "overall_assessment": "2-3 sentence summary of this environment for a first-time visitor with no prior knowledge"
}`;
}

// ── Gemini landscape analysis ────────────────────────────────────
async function analyzeWithGemini(filePath, prompt) {
  if (!GEMINI_API_KEY) return null;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const imageData = fs.readFileSync(filePath).toString('base64');
  const mime = mimeFor(filePath);
  const body = {
    contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: mime, data: imageData } }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
  };
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}`);
  const d = await r.json();
  const parts = d.candidates?.[0]?.content?.parts || [];
  const text = parts.find(p => p.text && !p.thought)?.text || parts[0]?.text || '';
  const match = text.match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : null;
}

async function analyzeWithOpenAI(filePath, prompt) {
  if (!OPENAI_API_KEY) return null;
  const imageData = fs.readFileSync(filePath).toString('base64');
  const mime = mimeFor(filePath);
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const body = {
    model,
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: `data:${mime};base64,${imageData}`, detail: 'high' } }] }],
    max_tokens: 8192, temperature: 0.3,
  };
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` }, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}`);
  const d = await r.json();
  const text = d.choices?.[0]?.message?.content || '';
  const match = text.match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : null;
}

async function analyzeWithClaude(filePath, prompt) {
  if (!CLAUDE_API_KEY) return null;
  const imageData = fs.readFileSync(filePath).toString('base64');
  const mime = mimeFor(filePath);
  const model = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';
  const body = {
    model, max_tokens: 8192,
    messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: mime, data: imageData } }, { type: 'text', text: prompt }] }],
  };
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01', 'x-api-key': CLAUDE_API_KEY }, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Claude ${r.status}`);
  const d = await r.json();
  const text = d.content?.[0]?.text || '';
  const match = text.match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : null;
}

async function analyzeWithOpenRouter(filePath, prompt) {
  if (!OPENROUTER_KEY) return null;
  const imageData = fs.readFileSync(filePath).toString('base64');
  const mime = mimeFor(filePath);
  const visionModels = [
    process.env.OPENROUTER_VISION_MODEL || 'nvidia/nemotron-nano-12b-v2-vl:free',
    'google/gemma-4-31b-it:free',
    'google/gemma-4-26b-a4b-it:free',
  ];
  for (const model of visionModels) {
    try {
      const body = {
        model,
        messages: [{ role: 'user', content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${mime};base64,${imageData}` } },
        ]}],
        max_tokens: 4096, temperature: 0.3,
      };
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENROUTER_KEY}`, 'HTTP-Referer': 'https://floraiq.app', 'X-Title': 'FloraIQ' },
        body: JSON.stringify(body),
      });
      if (r.status === 429) { logger.warn(`OpenRouter vision rate limited on ${model}`); continue; }
      if (!r.ok) { logger.warn(`OpenRouter vision ${model} returned ${r.status}`); continue; }
      const d = await r.json();
      const text = d.choices?.[0]?.message?.content || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch (e) { logger.warn(`OpenRouter vision ${model} error: ${e.message}`); }
  }
  return null;
}

async function runLandscapeChain(filePath, geoHint) {
  const prompt = buildLandscapePrompt(geoHint);
  const providers = [
    { name: 'Gemini',      fn: () => analyzeWithGemini(filePath, prompt) },
    { name: 'OpenAI',      fn: () => analyzeWithOpenAI(filePath, prompt) },
    { name: 'Claude',      fn: () => analyzeWithClaude(filePath, prompt) },
    { name: 'OpenRouter',  fn: () => analyzeWithOpenRouter(filePath, prompt) },
  ];
  for (const provider of providers) {
    try {
      const result = await provider.fn();
      if (result) { logger.info(`Landscape analysis via ${provider.name}`); return { ...result, provider: provider.name }; }
    } catch (e) { logger.warn(`${provider.name} landscape failed: ${e.message}`); }
  }
  throw new Error('All AI providers failed for landscape analysis');
}

// ── GET /api/landscape/cooking-guide/:plant ──────────────────────
router.get('/cooking-guide/:plant', async (req, res) => {
  try {
    const plant = decodeURIComponent(req.params.plant);
    const lang = req.lang || 'en';

    const prompt = `You are FloraIQ's Ethnobotanical Cooking and Harvesting Expert. Provide a complete guide for: "${plant}"

This guide is for people who may have no modern kitchen equipment — hikers, campers, rural villagers, and survival situations.

Reply ONLY with valid JSON:
{
  "plant_name": "${plant}",
  "edible_parts": [
    {
      "part": "leaves|fruit|root|bark|flower|seed|stem|shoot",
      "season_to_harvest": "When in the year to harvest this part",
      "how_to_identify_ripe": "Visual/tactile signs of ripeness or harvest readiness",
      "how_to_harvest": "Step-by-step harvesting technique to avoid damaging plant",
      "how_to_prepare": "Cleaning, processing before cooking",
      "cooking_methods": [
        { "method": "Boiling", "instructions": "Step by step", "time_minutes": 10, "result": "What you get" },
        { "method": "Roasting on fire", "instructions": "Step by step", "time_minutes": 5, "result": "What you get" },
        { "method": "Raw", "instructions": "Safe to eat raw?", "time_minutes": 0, "result": "Taste and texture" },
        { "method": "Sun drying / preservation", "instructions": "How to preserve for later", "time_minutes": 0, "result": "Shelf life" }
      ],
      "nutritional_value": "Key nutrients in this part",
      "taste_profile": "Describe the taste and texture",
      "toxic_if_raw": false,
      "toxic_parts_nearby": "Parts of THIS plant that are NOT safe to eat",
      "safety_notes": "Important warnings"
    }
  ],
  "survival_cooking_without_fire": "How to prepare this plant without any fire or tools",
  "traditional_recipes": [
    {
      "name": "Recipe name",
      "origin": "Country or culture",
      "ingredients_wild": "Other wild ingredients that can be foraged",
      "steps": "Simple step-by-step instructions",
      "serves": 2
    }
  ],
  "medicinal_preparation": {
    "tea": "How to make medicinal tea from this plant",
    "poultice": "How to make a poultice for wounds/inflammation",
    "tincture": "How to make alcohol extract if alcohol available",
    "raw_application": "Direct topical use"
  },
  "preservation_methods": ["Sun drying", "Smoking", "Fermentation", "Salting if coastal"],
  "companion_wild_plants": "Other wild plants commonly found nearby that are also useful",
  "cultural_significance": "Traditional uses across different cultures and regions",
  "caution": "Critical warnings before consuming"
}`;

    // Use text-only AI chain
    const result = await callTextAI(prompt, lang);
    res.json(result);
  } catch (e) {
    logger.error('Cooking guide error', { message: e.message });
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/landscape/analyze ──────────────────────────────────
router.post('/analyze', optionalAuth, upload.single('image'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'Image file required' });

  try {
    // Extract EXIF GPS from photo
    let locationData = {};
    let geoHint = null;
    try {
      locationData = await extractLocation(file.path) || {};
      if (locationData.country || locationData.city) {
        geoHint = [locationData.street, locationData.city, locationData.state, locationData.country].filter(Boolean).join(', ');
      }
    } catch { }

    // Run landscape AI analysis
    const analysis = await runLandscapeChain(file.path, geoHint);

    // Merge geo data from EXIF
    const result = {
      ...analysis,
      latitude: locationData.latitude || null,
      longitude: locationData.longitude || null,
      altitude_m: locationData.altitude_m || null,
      exif_country: locationData.country || null,
      exif_city: locationData.city || null,
      exif_state: locationData.state || null,
      exif_street: locationData.street || null,
      analyzed_at: new Date().toISOString(),
    };

    // Upload to cloud if configured
    if (isCloudinaryEnabled()) {
      try {
        result.cloud_url = await uploadImage(file.path, 'landscape');
      } catch { }
    }

    // Store analysis in DB if user is logged in
    if (req.user) {
      try {
        await query(`
          INSERT INTO landscape_analyses
            (user_id, image_url, environment_type, environment_label, hemisphere, climate_zone,
             likely_region, camping_safety_score, camping_safety_label, latitude, longitude,
             country, city, analysis_json, created_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
          ON CONFLICT DO NOTHING
        `, [
          req.user.id,
          result.cloud_url || null,
          result.environment_type || 'unknown',
          result.environment_label || 'Unknown',
          result.hemisphere || 'unclear',
          result.climate_zone || 'unknown',
          result.likely_region || null,
          result.camping_safety_score || null,
          result.camping_safety_label || 'UNKNOWN',
          result.latitude,
          result.longitude,
          result.exif_country || result.likely_countries?.[0] || null,
          result.exif_city || null,
          JSON.stringify(result),
        ]);
      } catch { }
    }

    // Clean up local file
    deleteLocalFile(file.path);

    res.json(result);
  } catch (e) {
    deleteLocalFile(file?.path);
    logger.error('Landscape analysis failed', { message: e.message });
    res.status(500).json({ error: e.message || 'Landscape analysis failed' });
  }
});

// ── GET /api/landscape/history ───────────────────────────────────
router.get('/history', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Auth required' });
  try {
    const { rows } = await query(
      `SELECT id, image_url, environment_type, environment_label, hemisphere, climate_zone,
              likely_region, camping_safety_score, camping_safety_label,
              latitude, longitude, country, city, created_at
       FROM landscape_analyses WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/landscape/region-intel/:region ──────────────────────
router.get('/region-intel/:region', async (req, res) => {
  const region = decodeURIComponent(req.params.region);
  try {
    const prompt = `You are FloraIQ's Regional Intelligence Database. Provide comprehensive environmental intelligence for: "${region}"

This is for travelers, hikers, and people who have done NO prior research on this area.

Reply ONLY with valid JSON:
{
  "region": "${region}",
  "environment_type": "Description of dominant environment types",
  "climate": "Climate type and seasonal patterns",
  "best_camping_months": ["month1", "month2"],
  "dangerous_months": ["month name and why"],
  "apex_predators": [{ "animal": "", "habitat": "", "avoidance": "", "attack_response": "" }],
  "venomous_creatures": [{ "creature": "", "venom_type": "", "first_aid": "", "antivenom_available": true }],
  "toxic_plants": [{ "plant": "", "toxic_compounds": "", "symptoms": "", "look_alikes": "" }],
  "edible_wild_plants": [{ "plant": "", "parts": "", "season": "", "how_to_prepare": "" }],
  "edible_mushrooms": [{ "mushroom": "", "season": "", "caution": "" }],
  "water_sources": "Description of typical water access and quality",
  "natural_disasters": {
    "earthquake": "Risk level and type",
    "typhoon_cyclone": "Season and intensity typical",
    "flood": "Flood-prone areas and seasons",
    "landslide": "Risk factors and seasons",
    "volcano": "Active volcanoes if any",
    "drought": "Drought risk"
  },
  "indigenous_tribes": "Names and territories of indigenous peoples and their knowledge of the land",
  "emergency_contacts": { "police": "", "ambulance": "", "coast_guard": "", "rescue": "" },
  "nearest_hospitals": "Guidance on accessing medical care",
  "useful_survival_knowledge": ["Local survival tips specific to this region"],
  "cultural_taboos": ["Important cultural rules regarding nature and land"],
  "navigation_landmarks": "Notable terrain features useful for navigation without GPS"
}`;

    const result = await callTextAI(prompt, 'en');
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Text-only AI chain ───────────────────────────────────────────
async function callTextAI(prompt, lang) {
  // Try Gemini text
  if (GEMINI_API_KEY) {
    try {
      const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      const body = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 8192 } };
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (r.ok) {
        const d = await r.json();
        const parts = d.candidates?.[0]?.content?.parts || [];
        const text = parts.find(p => p.text && !p.thought)?.text || parts[0]?.text || '';
        const match = text.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
      }
    } catch { }
  }
  // Try OpenAI text
  if (OPENAI_API_KEY) {
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify({ model: process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 8192, temperature: 0.4 }),
      });
      if (r.ok) {
        const d = await r.json();
        const text = d.choices?.[0]?.message?.content || '';
        const match = text.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
      }
    } catch { }
  }
  // Try OpenRouter (text mode — free fallback, try multiple models)
  if (OPENROUTER_KEY) {
    const textModels = [
      process.env.OPENROUTER_TEXT_MODEL || 'google/gemma-4-31b-it:free',
      'deepseek/deepseek-v4-flash:free',
      'qwen/qwen3-coder:free',
    ];
    for (const model of textModels) {
      try {
        const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${OPENROUTER_KEY}`,
            'HTTP-Referer': 'https://floraiq.app',
            'X-Title': 'FloraIQ',
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: 'You are an expert botanist and survival instructor. Always reply with valid JSON only — no markdown, no explanation, just the JSON object.' },
              { role: 'user', content: prompt },
            ],
            max_tokens: 4096,
            temperature: 0.3,
          }),
        });
        if (r.status === 429) { logger.warn(`OpenRouter text rate limited on ${model}`); continue; }
        if (!r.ok) { logger.warn(`OpenRouter text ${model} returned ${r.status}`); continue; }
        const d = await r.json();
        const text = d.choices?.[0]?.message?.content || '';
        const match = text.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
      } catch (e) { logger.warn(`OpenRouter text ${model} error: ${e.message}`); }
    }
    throw new Error('AI rate limited. Try again in 1 minute, or add a GEMINI_API_KEY to .env for unlimited free requests.');
  }
  throw new Error('No AI key configured. Add GEMINI_API_KEY (free at aistudio.google.com) to your .env file.');
}

module.exports = router;
