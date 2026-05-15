const fs = require('fs');
const path = require('path');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
  throw new Error('OPENROUTER_API_KEY is missing. Add it to your .env file.');
}

const MODEL = 'nvidia/nemotron-nano-12b-v2-vl:free';
const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
};

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_BY_EXT[ext] || 'image/jpeg';
}

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
  default:  'Identify whatever organism is in the photo — plant, insect, bird, mushroom, weed, or other. Provide full scientific detail appropriate to the organism type.',
};

function buildPrompt(mode) {
  const hint = MODE_HINTS[mode] || MODE_HINTS.default;

  return `You are FloraIQ's universal biological identification engine — an expert combining botany, entomology, ornithology, mycology, plant pathology, and ecology. Analyze the uploaded photo and identify the primary organism with full scientific rigor.

${hint}

Reply ONLY with a valid JSON object. Fill all fields relevant to the organism type; set irrelevant fields to null:
{
  "common_name": "Primary common name",
  "scientific_name": "Full scientific name with authority — e.g. Lucilia caesar (Linnaeus, 1758)",
  "subject_type": "plant|tree|shrub|herb|grass|crop|weed|succulent|aquatic|mushroom|fungi|insect|spider|bird|mammal|reptile|amphibian|fish|other",
  "confidence": 0.93,
  "taxonomy": {
    "kingdom": "e.g. Animalia or Plantae or Fungi",
    "phylum": "e.g. Arthropoda or Tracheophyta",
    "class": "e.g. Insecta or Magnoliopsida",
    "order": "e.g. Diptera or Solanales",
    "family": "e.g. Calliphoridae or Solanaceae",
    "genus": "e.g. Lucilia or Solanum",
    "species": "e.g. caesar or lycopersicum"
  },
  "description": "Comprehensive scientific description — key identification features, distinguishing characteristics, size, coloration, and appearance",
  "morphology": {
    "For plants use keys: habit, leaf, stem, root, flower, fruit": null,
    "For insects use keys: head, thorax, abdomen, wings, legs, antennae": null,
    "For birds use keys: plumage, beak, wingspan, tail, legs": null,
    "For mushrooms use keys: cap, gills, stem, flesh, spore_print": null
  },
  "habitat": "Preferred natural habitat and microhabitat description",
  "distribution": "Native range and global distribution; altitude range if applicable",
  "ecology": "Ecological role, trophic level, key species interactions, mycorrhizal/symbiotic associations",
  "behavior": "Behavioral traits — feeding behavior, reproduction strategy, activity patterns, social organization (animals/insects/birds) — null for plants",
  "diet": "Diet and specific food sources (for animals) — null for plants",
  "life_cycle": "Life cycle stages, duration, reproduction method",
  "edibility": "Edibility status and safe preparation methods — null if not relevant",
  "toxicity": "Toxic compounds with names, mechanism of action, affected organ systems, danger level — null if not toxic",
  "lookalikes": "Similar species easily confused — critical safety detail for mushrooms and toxic organisms",
  "safety_warning": "CRITICAL safety warnings only: do-not-eat, venomous, causes severe reaction, invasive pest — null if safe",
  "pest_status": "Pest classification (minor/significant/major), economic impact, host plants affected (for insects and weeds) — null for plant subjects",
  "control_methods": "Integrated management: cultural, biological, and chemical controls with specific agents (for pests/weeds/diseases) — null if not applicable",
  "disease": "Plant disease name if visible — e.g. 'Early Blight (Alternaria solani)' — 'No visible disease' for healthy plants — null for animal subjects",
  "disease_pathology": "Causal organism, infection mechanism, symptom progression, conducive conditions (diseased plants only) — null otherwise",
  "treatment": "Full integrated disease/pest management protocol with specific active ingredients, timing, and rates — null if not applicable",
  "pest": "Plant pest threats with scientific names, damage type, economic threshold (for plants only) — null for animal subjects",
  "fertilizer": "NPK ratio and micronutrients, application rate and timing (for cultivated plants) — null for wild organisms",
  "soil_advice": "Soil classification, optimal pH, drainage class, organic matter requirements (for plants) — null otherwise",
  "weather_advice": "USDA hardiness zone, optimal temperature range (°C), rainfall requirement (mm), frost/drought tolerance (for plants) — null otherwise",
  "care_summary": "Evidence-based cultivation protocol written for researchers and botanists (for cultivated plants) — null for wild organisms",
  "economic_importance": "Agricultural, ecological, commercial, or pharmaceutical significance",
  "ethnobotany": "Traditional medicinal uses, edible preparations, cultural significance",
  "conservation_status": "IUCN Red List category (LC/NT/VU/EN/CR/EW/EX) and CITES appendix if applicable",
  "research_notes": "Notable findings from peer-reviewed literature, current research areas, open questions"
}

IMPORTANT: The morphology value must be a JSON object with organism-appropriate keys — not the example text above. Omit keys that don't apply.`;
}

async function callOpenRouter(messages) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: MODEL, messages }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

async function analyzeImage(filePath, mode = 'default') {
  const bytes = fs.readFileSync(filePath);
  const base64 = bytes.toString('base64');
  const mimeType = mimeFor(filePath);

  const messages = [
    {
      role: 'user',
      content: [
        { type: 'text', text: buildPrompt(mode) },
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
      ],
    },
  ];

  const text = await callOpenRouter(messages);

  let parsed;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch (_) {
    parsed = {};
  }

  // Clean morphology — remove instruction-text keys the AI mistakenly copies
  let morphology = parsed.morphology ?? {};
  if (typeof morphology === 'object') {
    const badKeyPattern = /for (plants|insects|birds|mushrooms) use keys/i;
    morphology = Object.fromEntries(
      Object.entries(morphology).filter(([k, v]) => v && !badKeyPattern.test(k))
    );
  }

  const name = parsed.common_name ?? parsed.plant_name ?? 'Unknown';

  return {
    // backward-compat aliases
    plant_name:          name,
    plant_type:          parsed.subject_type ?? parsed.plant_type ?? 'unknown',
    // canonical fields
    common_name:         name,
    subject_type:        parsed.subject_type ?? parsed.plant_type ?? 'unknown',
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
  };
}

// backward-compat alias
const analyzePlant = (filePath) => analyzeImage(filePath, 'default');

async function chatWithPlantExpert(question) {
  const messages = [
    {
      role: 'user',
      content: `You are FloraIQ's biological intelligence system — a senior botanist, plant pathologist, entomologist, ornithologist, and agricultural scientist. Provide scientifically accurate, detailed answers with proper terminology. Reference peer-reviewed findings where relevant. Use specific values (pH ranges, temperatures in °C, NPK ratios, concentrations, taxonomic names) rather than vague recommendations. Answer questions about plants, insects, birds, mushrooms, fungi, ecology, and agricultural science.

Question: ${question}`,
    },
  ];
  return callOpenRouter(messages);
}

module.exports = { analyzeImage, analyzePlant, chatWithPlantExpert };
