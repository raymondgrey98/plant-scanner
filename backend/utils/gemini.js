/**
 * FloraIQ Multi-Model AI Engine
 * Priority chain: Google Gemini → OpenAI GPT-4o → Anthropic Claude → OpenRouter (free fallback)
 * Automatically retries the next provider if one fails or is unconfigured.
 */

const fs   = require('fs');
const path = require('path');

// ── Provider credentials ──────────────────────────────────────
const GEMINI_API_KEY    = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY    = process.env.OPENAI_API_KEY;
const CLAUDE_API_KEY    = process.env.ANTHROPIC_API_KEY;
const OPENROUTER_KEY    = process.env.OPENROUTER_API_KEY;

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png',  '.webp': 'image/webp',
  '.heic': 'image/heic', '.heif': 'image/heif',
};
function mimeFor(fp) { return MIME_BY_EXT[path.extname(fp).toLowerCase()] || 'image/jpeg'; }

// ── Scan mode hints ───────────────────────────────────────────
const MODE_HINTS = {
  plant:    'Focus on plant/crop identification, morphology, disease status, and agricultural care protocol.',
  tree:     'Focus on tree species identification, bark texture, leaf/needle morphology, wood properties, and forest ecology.',
  grass:    'Focus on grass or graminoid species identification, growth habit, agronomic classification, and pasture use.',
  weed:     'Focus on weed identification, invasiveness, allelopathic properties, herbicide resistance, and integrated weed management.',
  mushroom: 'Focus on mushroom/fungi identification. CRITICAL: include detailed edibility status, all toxic compounds present, and look-alike species with safety warnings.',
  insect:   'Focus on insect identification, order and family, pest status, feeding/damage type, economic threshold, complete life cycle, and biological/chemical control methods.',
  bird:     'Focus on bird species identification, plumage description (male/female if dimorphic), behavioral traits, diet, migration pattern, nesting habits, and IUCN status.',
  allergen: 'Focus on identifying allergenic plant or pollen species, allergenic proteins, allergy season timing, and exposure risk assessment.',
  toxic:    'Focus on identifying toxic plant, mushroom, or organism. CRITICAL: specify toxic compounds with names, affected organ systems, lethal dose if known, symptom timeline, and emergency first-aid guidance.',
  diagnose: 'Focus on plant disease diagnosis — identify the causal pathogen (kingdom, genus species), infection mechanism, symptom progression, conducive environmental conditions, and full integrated management protocol.',
  spider:   'Focus on spider identification, venom classification, web type, danger level to humans, and first-aid for bites.',
  survival: 'SURVIVAL MODE: You are helping a hiker/camper in a remote environment. For EVERY organism identify: 1) Is it edible? How to prepare it safely? 2) Is it dangerous/toxic? What are symptoms? 3) What is the immediate danger level (0-10)? 4) Any medicinal uses? 5) Can it be used as a survival resource (fire, shelter, water collection)? Prioritise life-safety information above all else.',
  default:  'Identify whatever organism is in the photo — plant, insect, bird, mushroom, weed, or other. Provide full scientific detail appropriate to the organism type.',
};

function buildPrompt(mode) {
  const hint = MODE_HINTS[mode] || MODE_HINTS.default;
  return `You are FloraIQ's universal biological identification engine — an expert combining botany, entomology, ornithology, mycology, plant pathology, and ecology. Analyze the uploaded photo and identify the primary organism with full scientific rigor.

${hint}

Reply ONLY with a valid JSON object. Fill all fields relevant to the organism type; set irrelevant fields to null:
{
  "common_name": "Primary common name",
  "scientific_name": "Full scientific name with authority",
  "subject_type": "plant|tree|shrub|herb|grass|crop|weed|succulent|aquatic|mushroom|fungi|insect|spider|bird|mammal|reptile|amphibian|fish|other",
  "confidence": 0.93,
  "taxonomy": { "kingdom": "", "phylum": "", "class": "", "order": "", "family": "", "genus": "", "species": "" },
  "description": "Comprehensive scientific description",
  "morphology": {},
  "habitat": "Preferred natural habitat",
  "distribution": "Native range and global distribution",
  "ecology": "Ecological role and key interactions",
  "behavior": "Behavioral traits (animals) — null for plants",
  "diet": "Diet (animals) — null for plants",
  "life_cycle": "Life cycle stages",
  "edibility": "Edibility status and safe preparation — CRITICAL for survival mode",
  "toxicity": "Toxic compounds, mechanism, organ systems affected — null if not toxic",
  "lookalikes": "Similar species easily confused — critical for mushrooms",
  "safety_warning": "CRITICAL safety warnings only — null if safe",
  "danger_level": 0,
  "survival_uses": "Survival uses: fire starting, shelter, water collection, cordage, medicine — null if none",
  "first_aid": "Emergency first aid if poisoned or stung — null if not applicable",
  "pest_status": "Pest classification (for insects/weeds) — null for plant subjects",
  "control_methods": "Integrated management — null if not applicable",
  "disease": "Plant disease name if visible — null for animal subjects",
  "disease_pathology": "Causal organism, infection mechanism — null otherwise",
  "treatment": "Full integrated disease/pest management protocol — null if not applicable",
  "pest": "Plant pest threats (for plants only) — null for animal subjects",
  "fertilizer": "NPK ratio and micronutrients (for cultivated plants) — null for wild organisms",
  "soil_advice": "Soil classification, optimal pH, drainage class — null otherwise",
  "weather_advice": "USDA hardiness zone, optimal temperature range, rainfall — null otherwise",
  "care_summary": "Evidence-based cultivation protocol — null for wild organisms",
  "economic_importance": "Agricultural, ecological, commercial significance",
  "ethnobotany": "Traditional medicinal uses, cultural significance",
  "conservation_status": "IUCN Red List category",
  "research_notes": "Notable peer-reviewed findings",
  "hydroponics_suitable": true,
  "hydroponics_notes": "Notes on growing hydroponically — null if not applicable",
  "companion_plants": "Good companion plants (for cultivated species) — null otherwise",
  "harvest_time_days": null
}

IMPORTANT: The morphology value must be a JSON object with organism-appropriate keys. Omit keys that don't apply.`;
}

// ── Providers ─────────────────────────────────────────────────

async function tryGemini(base64, mimeType, prompt) {
  if (!GEMINI_API_KEY) return null;
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const url   = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  const body  = {
    contents: [{ parts: [
      { text: prompt },
      { inline_data: { mime_type: mimeType, data: base64 } },
    ]}],
    generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
  };
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) { const t = await res.text(); throw new Error(`Gemini ${res.status}: ${t.slice(0,200)}`); }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

async function tryOpenAI(base64, mimeType, prompt) {
  if (!OPENAI_API_KEY) return null;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' } },
      ]}],
      max_tokens: 4096, temperature: 0.2,
    }),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`OpenAI ${res.status}: ${t.slice(0,200)}`); }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || null;
}

async function tryClaude(base64, mimeType, prompt) {
  if (!CLAUDE_API_KEY) return null;
  const model = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': CLAUDE_API_KEY, 'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model, max_tokens: 4096,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
        { type: 'text', text: prompt },
      ]}],
    }),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`Claude ${res.status}: ${t.slice(0,200)}`); }
  const data = await res.json();
  return data.content?.[0]?.text || null;
}

async function tryOpenRouter(base64, mimeType, prompt) {
  if (!OPENROUTER_KEY) return null;
  const model = process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free';
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENROUTER_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
      ]}],
    }),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`OpenRouter ${res.status}: ${t.slice(0,200)}`); }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || null;
}

// ── Text-only providers (for chat) ────────────────────────────
async function tryGeminiText(messages) {
  if (!GEMINI_API_KEY) return null;
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const url   = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  const contents = messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents }) });
  if (!res.ok) throw new Error(`Gemini text ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

async function tryOpenAIText(messages) {
  if (!OPENAI_API_KEY) return null;
  const model = process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, max_tokens: 2048, temperature: 0.3 }),
  });
  if (!res.ok) throw new Error(`OpenAI text ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || null;
}

async function tryOpenRouterText(messages) {
  if (!OPENROUTER_KEY) return null;
  const model = process.env.OPENROUTER_TEXT_MODEL || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free';
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENROUTER_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages }),
  });
  if (!res.ok) throw new Error(`OpenRouter text ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || null;
}

// ── Chain runner ──────────────────────────────────────────────
async function runImageChain(base64, mimeType, prompt) {
  const providers = [
    { name: 'Gemini',      fn: () => tryGemini(base64, mimeType, prompt) },
    { name: 'OpenAI',      fn: () => tryOpenAI(base64, mimeType, prompt) },
    { name: 'Claude',      fn: () => tryClaude(base64, mimeType, prompt) },
    { name: 'OpenRouter',  fn: () => tryOpenRouter(base64, mimeType, prompt) },
  ];
  for (const p of providers) {
    try {
      const result = await p.fn();
      if (result) { console.log(`[ai] Used provider: ${p.name}`); return result; }
    } catch (err) {
      console.warn(`[ai] ${p.name} failed: ${err.message}`);
    }
  }
  throw new Error('All AI providers failed or are unconfigured. Set at least one API key.');
}

async function runTextChain(messages) {
  const providers = [
    { name: 'Gemini',     fn: () => tryGeminiText(messages) },
    { name: 'OpenAI',     fn: () => tryOpenAIText(messages) },
    { name: 'OpenRouter', fn: () => tryOpenRouterText(messages) },
  ];
  for (const p of providers) {
    try {
      const result = await p.fn();
      if (result) return result;
    } catch (err) {
      console.warn(`[ai] text ${p.name} failed: ${err.message}`);
    }
  }
  throw new Error('All text AI providers failed or are unconfigured.');
}

// ── Parse and normalise AI response ──────────────────────────
function parseResult(text) {
  let parsed = {};
  try {
    const m = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : text);
  } catch { /* return empty */ }

  let morphology = parsed.morphology ?? {};
  if (typeof morphology === 'object') {
    const bad = /for (plants|insects|birds|mushrooms) use keys/i;
    morphology = Object.fromEntries(Object.entries(morphology).filter(([k, v]) => v && !bad.test(k)));
  }

  const name = parsed.common_name ?? parsed.plant_name ?? 'Unknown';
  return {
    plant_name:          name,
    plant_type:          parsed.subject_type ?? 'unknown',
    common_name:         name,
    subject_type:        parsed.subject_type ?? 'unknown',
    scientific_name:     parsed.scientific_name      ?? null,
    confidence:          Number(parsed.confidence    ?? 0),
    taxonomy:            parsed.taxonomy             ?? {},
    morphology,
    description:         parsed.description          ?? null,
    behavior:            parsed.behavior             ?? null,
    diet:                parsed.diet                 ?? null,
    life_cycle:          parsed.life_cycle           ?? null,
    edibility:           parsed.edibility            ?? null,
    toxicity:            parsed.toxicity             ?? null,
    lookalikes:          parsed.lookalikes           ?? null,
    safety_warning:      parsed.safety_warning       ?? null,
    danger_level:        Number(parsed.danger_level  ?? 0),
    survival_uses:       parsed.survival_uses        ?? null,
    first_aid:           parsed.first_aid            ?? null,
    pest_status:         parsed.pest_status          ?? null,
    control_methods:     parsed.control_methods      ?? null,
    disease:             parsed.disease              ?? null,
    disease_pathology:   parsed.disease_pathology    ?? null,
    treatment:           parsed.treatment            ?? null,
    pest:                parsed.pest                 ?? null,
    fertilizer:          parsed.fertilizer           ?? null,
    soil_advice:         parsed.soil_advice          ?? null,
    weather_advice:      parsed.weather_advice       ?? null,
    care_summary:        parsed.care_summary         ?? null,
    distribution:        parsed.distribution         ?? null,
    ecology:             parsed.ecology              ?? null,
    ethnobotany:         parsed.ethnobotany          ?? null,
    economic_importance: parsed.economic_importance  ?? null,
    habitat:             parsed.habitat              ?? null,
    research_notes:      parsed.research_notes       ?? null,
    conservation_status: parsed.conservation_status  ?? null,
    hydroponics_suitable:parsed.hydroponics_suitable ?? null,
    hydroponics_notes:   parsed.hydroponics_notes    ?? null,
    companion_plants:    parsed.companion_plants     ?? null,
    harvest_time_days:   parsed.harvest_time_days    ?? null,
  };
}

// ── Public API ────────────────────────────────────────────────
async function analyzeImage(filePath, mode = 'default') {
  const bytes    = fs.readFileSync(filePath);
  const base64   = bytes.toString('base64');
  const mimeType = mimeFor(filePath);
  const prompt   = buildPrompt(mode);
  const text     = await runImageChain(base64, mimeType, prompt);
  return parseResult(text);
}

const analyzePlant = (fp) => analyzeImage(fp, 'default');

async function analyzeSurvival(filePath) {
  return analyzeImage(filePath, 'survival');
}

async function chatWithPlantExpert(question, context = '', language = 'en') {
  const langNote = language !== 'en' ? `\nIMPORTANT: Reply in ${getLanguageName(language)}.` : '';
  const messages = [{
    role: 'user',
    content: `You are FloraIQ's biological intelligence system — a senior botanist, plant pathologist, entomologist, ornithologist, agricultural scientist, and wilderness survival expert. Provide scientifically accurate, detailed answers with proper terminology. Reference peer-reviewed findings where relevant. Use specific values (pH ranges, temperatures in °C, NPK ratios, concentrations, taxonomic names) rather than vague recommendations. Answer questions about plants, insects, birds, mushrooms, fungi, ecology, agricultural science, survival, and hydroponics.${context ? '\n\nContext: ' + context : ''}${langNote}\n\nQuestion: ${question}`,
  }];
  return runTextChain(messages);
}

async function getFarmingAdvice(params, language = 'en') {
  const langNote = language !== 'en' ? `\nReply in ${getLanguageName(language)}.` : '';
  const messages = [{
    role: 'user',
    content: `You are an expert agricultural consultant, hydroponics engineer, and crop planner. Based on the following parameters, provide detailed, actionable farming advice:

Location: ${params.location || 'Unknown'}
Climate zone: ${params.climate_zone || 'Unknown'}
Plot size: ${params.plot_size_sqm ? params.plot_size_sqm + ' m²' : 'Unknown'}
Soil type: ${params.soil_type || 'Unknown'}
Water source: ${params.water_source || 'Unknown'}
Budget (USD): ${params.budget_usd || 'Unknown'}
Is hydroponic: ${params.is_hydroponic ? 'Yes' : 'No'}
Desired crops: ${params.desired_crops || 'Any suitable crops'}
Season: ${params.season || 'Current season'}

Provide a JSON response with:
{
  "recommended_crops": [{ "name": "", "scientific_name": "", "yield_per_sqm_kg": 0, "days_to_harvest": 0, "difficulty": "easy|medium|hard", "notes": "" }],
  "planting_calendar": [{ "month": "", "action": "", "crops": [] }],
  "soil_preparation": "",
  "water_requirements": "",
  "fertilizer_plan": "",
  "estimated_yield_kg": 0,
  "cost_breakdown": { "seeds": 0, "soil_amendments": 0, "tools": 0, "irrigation": 0, "total": 0 },
  "hydroponic_setup": ${params.is_hydroponic ? '{ "system_type": "", "nutrients": "", "ph_range": "", "setup_cost": 0, "notes": "" }' : 'null'},
  "companion_planting": "",
  "pest_prevention": "",
  "harvest_tips": "",
  "market_potential": "",
  "summary": ""
}${langNote}`,
  }];
  const text = await runTextChain(messages);
  try {
    const m = text.match(/\{[\s\S]*\}/);
    return JSON.parse(m ? m[0] : text);
  } catch {
    return { summary: text };
  }
}

async function getSurvivalGuide(params, language = 'en') {
  const langNote = language !== 'en' ? `\nReply in ${getLanguageName(language)}.` : '';
  const messages = [{
    role: 'user',
    content: `You are a wilderness survival expert and emergency response consultant. Provide a survival guide for the following situation:

Location type: ${params.location_type || 'Forest/jungle'}
Country/Region: ${params.region || 'Unknown'}
Season: ${params.season || 'Unknown'}
Group size: ${params.group_size || 1}
Duration (days): ${params.days || 1}
Emergency: ${params.is_emergency ? 'YES - EMERGENCY' : 'No'}
Injury/condition: ${params.injury || 'None'}

Respond with a JSON object:
{
  "immediate_priorities": ["", ""],
  "water_sources": "",
  "edible_plants_region": [{ "name": "", "how_to_identify": "", "how_to_prepare": "" }],
  "dangerous_plants_region": [{ "name": "", "warning": "" }],
  "dangerous_animals": [{ "name": "", "danger": "", "first_aid": "" }],
  "shelter_building": "",
  "fire_starting": "",
  "navigation": "",
  "signaling_rescue": "",
  "first_aid_priorities": "",
  "sos_message": "",
  "local_emergency_numbers": "",
  "survival_tips": ["", ""]
}${langNote}`,
  }];
  const text = await runTextChain(messages);
  try {
    const m = text.match(/\{[\s\S]*\}/);
    return JSON.parse(m ? m[0] : text);
  } catch {
    return { immediate_priorities: [text] };
  }
}

function getLanguageName(code) {
  const names = {
    en:'English', es:'Spanish', fr:'French', de:'German', pt:'Portuguese',
    ja:'Japanese', zh:'Chinese', ko:'Korean', ar:'Arabic', hi:'Hindi',
    tl:'Filipino/Tagalog', id:'Indonesian', ms:'Malay', th:'Thai', vi:'Vietnamese',
    ru:'Russian', it:'Italian', nl:'Dutch', pl:'Polish', sv:'Swedish',
    no:'Norwegian', da:'Danish', fi:'Finnish', tr:'Turkish', uk:'Ukrainian',
  };
  return names[code] || 'English';
}

module.exports = { analyzeImage, analyzePlant, analyzeSurvival, chatWithPlantExpert, getFarmingAdvice, getSurvivalGuide };
