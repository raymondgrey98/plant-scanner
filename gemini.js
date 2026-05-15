const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error('GEMINI_API_KEY is missing. Add it to your .env file.');
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
  generationConfig: {
    responseMimeType: 'application/json',
    temperature: 0.2,
  },
});

const PROMPT = `You are an agriculture assistant. Look at the photo of a plant and reply ONLY with a JSON object (no markdown, no commentary) containing exactly these four keys:

- "plant_name": common name + species if known
- "disease": disease or pest visible, or "none visible"
- "fertilizer": which fertilizer type and approximate dosage for a home grower
- "soil_advice": ideal soil type, pH range, and watering frequency

If the image is not a plant, set every field to "not a plant".`;

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

async function analyzePlant(filePath) {
  const bytes = fs.readFileSync(filePath);
  const imagePart = {
    inlineData: {
      data: bytes.toString('base64'),
      mimeType: mimeFor(filePath),
    },
  };

  const result = await model.generateContent([PROMPT, imagePart]);
  const text = result.response.text();

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    parsed = {
      plant_name: 'unknown',
      disease: 'unknown',
      fertilizer: 'unknown',
      soil_advice: 'unknown',
    };
  }

  return {
    plant_name: parsed.plant_name ?? 'unknown',
    disease: parsed.disease ?? 'unknown',
    fertilizer: parsed.fertilizer ?? 'unknown',
    soil_advice: parsed.soil_advice ?? 'unknown',
    raw_response: text,
  };
}

module.exports = { analyzePlant };
