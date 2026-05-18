const express = require('express');
const router  = express.Router();

const SOS_PROMPT = `You are an emergency survival AI. A person in the field needs immediate life-safety help.
Analyze this image and GPS location for any life-threatening hazard (venomous snake, toxic plant, toxic mushroom, dangerous animal, environmental threat).

RESPOND ONLY WITH VALID JSON. No markdown. No explanation. Just JSON:
{
  "risk_level": "CRITICAL|WARNING|SAFE",
  "organism": "exact common name of what you see",
  "scientific_name": "scientific name or null",
  "threat_category": "venomous|toxic|environmental|safe|unknown",
  "immediate_action": "The single most important thing to do RIGHT NOW in plain language",
  "first_aid_steps": [
    "Step 1: first immediate action",
    "Step 2: second action",
    "Step 3: third action"
  ],
  "emergency_numbers": {
    "primary": "911",
    "secondary": "112",
    "local_note": "specific poison control or SAR number for this region"
  },
  "do_not": "Critical things NOT to do (e.g., DO NOT cut/suck venom, DO NOT induce vomiting)",
  "youtube_query": "specific YouTube search for emergency first aid for this exact threat",
  "time_critical": true,
  "notes": "brief urgent medical or safety note"
}

Adapt emergency_numbers to the user's GPS location. For Malaysia: 999, Bomba 994. Philippines: 911, 143. Indonesia: 119. UK: 999. Australia: 000. Otherwise default 911/112.`;

function extractBase64(dataUrl) {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error('Invalid image format — must be data URL');
  return { mimeType: m[1], base64: m[2] };
}

function parseJson(text) {
  const m = text.match(/\{[\s\S]*\}/);
  const json = JSON.parse(m ? m[0] : text);
  // Ensure required fields
  if (!json.risk_level) json.risk_level = 'WARNING';
  if (!Array.isArray(json.first_aid_steps) || json.first_aid_steps.length === 0) {
    json.first_aid_steps = ['Move to safety immediately', 'Call emergency services', 'Monitor for symptoms'];
  }
  if (!json.emergency_numbers) {
    json.emergency_numbers = { primary: '911', secondary: '112', local_note: 'Call local emergency services' };
  }
  return json;
}

async function scanWithGemini(base64, mimeType, prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url   = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res   = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64 } }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
    }),
  });
  if (!res.ok) return null;
  const data  = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  for (const part of parts) { if (part.text && !part.thought) return part.text; }
  return parts[0]?.text || null;
}

async function scanWithOpenAI(base64, mimeType, prompt) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' } },
      ]}],
      max_tokens: 1024, temperature: 0.1,
    }),
  });
  if (!res.ok) return null;
  return (await res.json()).choices?.[0]?.message?.content || null;
}

async function scanWithClaude(base64, mimeType, prompt) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
        { type: 'text', text: prompt },
      ]}],
    }),
  });
  if (!res.ok) return null;
  return (await res.json()).content?.[0]?.text || null;
}

// POST /api/sos/scan — emergency multimodal hazard identification
router.post('/scan', async (req, res) => {
  try {
    const { image, lat, lng } = req.body;
    if (!image) return res.status(400).json({ error: 'Image required' });

    const { mimeType, base64 } = extractBase64(image);

    const locationCtx = lat && lng
      ? `\nUser GPS: ${parseFloat(lat).toFixed(5)}, ${parseFloat(lng).toFixed(5)}. Time: ${new Date().toUTCString()}.`
      : '';
    const prompt = SOS_PROMPT + locationCtx;

    const providers = [
      { name: 'Gemini',  fn: () => scanWithGemini(base64, mimeType, prompt) },
      { name: 'OpenAI',  fn: () => scanWithOpenAI(base64, mimeType, prompt) },
      { name: 'Claude',  fn: () => scanWithClaude(base64, mimeType, prompt) },
    ];

    for (const p of providers) {
      try {
        const text = await p.fn();
        if (text) {
          console.log(`[sos] Provider: ${p.name}`);
          return res.json(parseJson(text));
        }
      } catch (e) { console.warn(`[sos] ${p.name} failed: ${e.message}`); }
    }

    res.status(503).json({ error: 'All AI providers failed. Call emergency services: 911 / 112 / 999' });
  } catch (err) {
    console.error('[sos] scan error:', err.message);
    res.status(500).json({ error: err.message || 'SOS scan failed' });
  }
});

module.exports = router;
