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
  maker:    'MAKER MODE: You are an Agentic AI Engineer. Analyze the biological organism and suggest a DIY electronics project (Raspberry Pi/Arduino). Include sensor requirements, autonomous logic (like AG2), and a futuristic simulation description.',
  field_analysis: 'SATELLITE/FIELD MODE: Simulate satellite data analysis for this area. Provide a synthetic NDVI health index (0.0-1.0), soil moisture estimation, nitrogen levels, and a 30-day yield forecast based on the crop’s current growth stage.',
  survival: 'SURVIVAL MODE: You are helping a hiker/camper in a remote environment. For EVERY organism identify: 1) Is it edible? How to prepare it safely? 2) Is it dangerous/toxic? What are symptoms? 3) What is the immediate danger level (0-10)? 4) Any medicinal uses? 5) Can it be used as a survival resource (fire, shelter, water collection)? Prioritise life-safety information above all else.',
  default:  'Identify whatever organism is in the photo — plant, insect, bird, mushroom, weed, or other. Provide full scientific detail appropriate to the organism type.',
};

function buildPrompt(mode) {
  const validatedMode = MODE_HINTS.hasOwnProperty(mode) ? mode : 'default';
  const hint = MODE_HINTS[validatedMode];
  
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
  "anatomy": [
    {
      "part_name": "Scientific name of part (e.g., Anther, Mycelium, Thorax)",
      "description": "Micro-level function of this part",
      "coordinates_hint": "Visual location description (e.g., center-left, base)",
      "edibility_status": "Specific edibility of THIS part",
      "botany_term": "Advanced botanical/mycological terminology",
      "survival_value": "High/Medium/Low"
    }
  ],
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
  "harvest_time_days": null,
  "pollinator_probability": {
    "likely_pollinators": ["Bees", "Hummingbirds"],
    "visual_cues": "Flower shape and UV-reflective patterns",
    "attraction_score": 0.95
  },
  "genetic_proximity_hint": "Relationship to common crops or wild relatives (e.g., 85% match to Solanum family)",
  "visual_soil_analysis": {
    "estimated_ph": "6.5-7.0",
    "texture": "sandy/loamy/clay",
    "moisture_visual": "dry/saturated",
    "nutrient_deficiency_clues": "Iron chlorosis visible in soil edge"
  },
  "field_insights": {
    "ndvi_index": 0.75,
    "estimated_yield_kg_per_ha": 0,
    "soil_moisture_pct": 0,
    "satellite_anomalies": "e.g., patchy nitrogen uptake",
    "risk_assessment": "Low/Medium/High"
  },
  "maker_project_idea": { 
    "title": "Project Name", 
    "bill_of_materials": [{ "item": "Sensor/Part Name", "purpose": "Function in project" }], 
    "logic_sketch": "Pseudocode or high-level autonomous logic flow (e.g. AG2 agent behaviors)", 
  }
}

IMPORTANT: The morphology value must be a JSON object with organism-appropriate keys. Omit keys that don't apply.`;
}

// ── Providers ─────────────────────────────────────────────────

async function tryGemini(base64, mimeType, prompt) {
  if (!GEMINI_API_KEY) return null;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
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
  // gemini-2.5-flash thinking model returns thought in parts[0], actual response in later parts
  const parts = data.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.text && !part.thought) return part.text;
  }
  return parts[0]?.text || null;
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
  const model = process.env.OPENROUTER_MODEL || 'nvidia/nemotron-nano-12b-v2-vl:free';
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
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
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
  const models = [
    process.env.OPENROUTER_TEXT_MODEL || 'google/gemma-4-31b-it:free',
    'deepseek/deepseek-v4-flash:free',
    'qwen/qwen3-coder:free',
  ];
  for (const model of models) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${OPENROUTER_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://floraiq.app', 'X-Title': 'FloraIQ' },
        body: JSON.stringify({ model, messages }),
      });
      if (res.status === 429) { console.warn(`[ai] OpenRouter text rate limited on ${model}`); continue; }
      if (!res.ok) { console.warn(`[ai] OpenRouter text ${model} returned ${res.status}`); continue; }
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || null;
      if (text) return text;
    } catch (e) { console.warn(`[ai] OpenRouter text ${model} error: ${e.message}`); }
  }
  return null;
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
    anatomy:             parsed.anatomy              ?? [],
    pollinator_probability: parsed.pollinator_probability ?? null,
    genetic_proximity_hint: parsed.genetic_proximity_hint ?? null,
    visual_soil_analysis:   parsed.visual_soil_analysis   ?? null,
    field_insights:         parsed.field_insights         ?? null,
    maker_project_idea:     parsed.maker_project_idea     ?? null,
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

// FloraIQ Platform Knowledge Base — the chatbot knows about ALL features
const FLORAIQ_FEATURES = `
FloraIQ Platform Capabilities (v2026.4):

🌿 AI & MACHINE LEARNING:
- Plant/Insect/Bird/Mushroom identification with multi-model AI (Gemini, GPT-4o, Claude)
- Disease diagnosis and treatment recommendations
- Growth tracking with photo comparison over time
- Yield estimation based on plant health analysis
- Pest identification and integrated management plans
- Soil analysis from photos (pH, texture, nutrients)
- Weather-adaptive care recommendations
- Plant compatibility and companion planting suggestions
- Invasive species detection and alerts
- Pollinator attraction scoring
- Carbon sequestration calculations

📱 MOBILE & PWA:
- Offline mode with cached AI models
- GPS location tagging for scans
- AR plant information overlay
- Voice commands ("Hey Flora, identify this plant")
- Barcode scanner for nursery tags
- Push notifications for watering/fertilizing
- Photo geotagging from EXIF data
- Batch upload for multiple plants
- Camera filters for enhanced analysis

🗺️ MAPPING & GEOLOCATION:
- Interactive global species map
- Invasive species heatmap tracking
- Community garden locator
- Climate zone overlays (USDA hardiness)
- Soil type regional maps
- Wildlife corridor mapping
- Disaster risk zones (flood/fire/drought)

👥 SOCIAL & COMMUNITY:
- Plant parent profiles and collections
- Achievement badges (Master Gardener, Compost King, etc.)
- Plant trading marketplace
- Expert Q&A forums
- Community challenges and contests
- Seed library and sharing network
- Garden journal publishing
- Mentorship programs

🏢 COMMERCIAL & PROFESSIONAL:
- Farm management dashboards
- Inventory and supply tracking
- Harvest scheduling optimization
- Organic certification documentation
- Labor time tracking
- Profit margin calculators
- Wholesale integration
- Insurance documentation tools

🔬 SCIENTIFIC & RESEARCH:
- Citizen science data contribution
- Biodiversity index calculations
- Phenology tracking (flowering/fruiting times)
- Climate change impact studies
- Pollution bioindicators
- Traditional knowledge archives
- Academic paper integration

🎮 GAMIFICATION & EDUCATION:
- Plant identification quizzes
- Virtual garden builder (3D)
- Educational courses in botany/horticulture
- Scavenger hunts for specific plants
- Medicinal plant database
- Cooking recipes from identified plants
- Children's educational mode

🏠 SMART HOME & IoT:
- Smart irrigation integration (Rachio, RainMachine)
- Soil moisture sensor synchronization
- Weather station integration
- Automated fertilizer dispensers
- Grow light controllers
- Greenhouse climate control
- Robot gardener integration (FarmBot)

📊 DATA & ANALYTICS:
- Personal plant database export
- Trend analysis and skill improvement tracking
- Cost-benefit analysis for homegrown produce
- Environmental impact reports
- Predictive analytics for pest/disease outbreaks
- Seasonal planning tools
- Market price tracking

🌍 SUSTAINABILITY:
- Seed saving guides for heirloom varieties
- Native plant restoration projects
- Carbon offset calculations
- Water conservation recommendations
- Pollinator garden certification
- Composting optimization
- Food forest and permaculture design

🚀 ADVANCED TECH:
- Satellite imagery analysis for large-scale monitoring
- Drone survey integration
- Blockchain provenance for plant origins
- AI-powered pruning advice
- Automated weed detection
- Hyperspectral imaging for nutrient deficiencies
- Vertical farm optimization
- Aquaponics system monitoring
`;

async function chatWithPlantExpert(question, context = '', language = 'en') {
  const langNote = language !== 'en' ? `\nIMPORTANT: Reply in ${getLanguageName(language)}.` : '';
  const messages = [{
    role: 'user',
    content: `You are FloraIQ's AI biological intelligence system — a senior botanist, plant pathologist, entomologist, ornithologist, agricultural scientist, wilderness survival expert, AND a knowledgeable guide to all FloraIQ platform features.

YOUR EXPERTISE:
- Provide scientifically accurate, detailed answers with proper terminology
- Reference peer-reviewed findings where relevant
- Use specific values (pH ranges, temperatures in °C, NPK ratios, concentrations, taxonomic names)
- Answer questions about plants, insects, birds, mushrooms, fungi, ecology, agricultural science, survival, and hydroponics

FLORAIQ PLATFORM KNOWLEDGE:
${FLORAIQ_FEATURES}

When users ask about features, capabilities, or "what can FloraIQ do", explain the relevant features from the list above in a helpful, enthusiastic way. Always connect feature questions back to how they help the user's gardening/farming/survival goals.

For plant science questions, provide deep technical answers. For feature questions, be promotional but honest about capabilities.

${context ? '\n\nContext: ' + context : ''}${langNote}\n\nQuestion: ${question}`,
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

/**
 * AI Growth Comparison
 * Compares a historical image with a new one to track biological progress.
 */
async function compareGrowth(oldImagePath, newImagePath, organismName) {
  const oldBase64 = fs.readFileSync(oldImagePath).toString('base64');
  const newBase64 = fs.readFileSync(newImagePath).toString('base64');
  const mimeType = mimeFor(newImagePath);

  const prompt = `You are a biological growth analyst. Compare these two photos of the same ${organismName || 'organism'}.
  Photo 1 is the past state. Photo 2 is the current state.
  Analyze changes in:
  1. Biomass/Size (e.g., "Grown approx 5cm")
  2. Health markers (e.g., "Yellowing has decreased by 20%")
  3. New features (e.g., "3 new nodes visible", "flowering has begun")
  4. Recommendations (e.g., "Increase nitrogen now")

  Reply ONLY in JSON:
  {
    "growth_detected": true,
    "delta_description": "summary of change",
    "health_change": "improved/declined/stable",
    "estimated_growth_rate": "percentage or cm",
    "new_structures": ["list", "of", "parts"],
    "alert": "any urgent care needs based on the change"
  }`;

  // Gemini 2.0 Flash supports multi-image prompts natively
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    contents: [{ parts: [
      { text: prompt },
      { inline_data: { mime_type: mimeType, data: oldBase64 } },
      { inline_data: { mime_type: mimeType, data: newBase64 } },
    ] }],
    generationConfig: { temperature: 0.2, responseMimeType: "application/json" }
  };

  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Gemini comparison ${res.status}: ${t.slice(0, 200)}`);
    }
    const data = await res.json();
    return JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || '{}');
  } catch (err) {
    console.error('[ai] compareGrowth failed:', err.message);
    return {
      growth_detected: false,
      delta_description: 'Comparison failed',
      health_change: 'unknown',
      estimated_growth_rate: null,
      new_structures: [],
      alert: err.message
    };
  }
}

module.exports = { 
  analyzeImage, analyzePlant, analyzeSurvival, 
  chatWithPlantExpert, getFarmingAdvice, getSurvivalGuide,
  compareGrowth 
};
