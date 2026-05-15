const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data.json');

function load() {
  if (!fs.existsSync(DB_PATH)) return { scans: [], nextId: 1 };
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    return { scans: [], nextId: 1 };
  }
}

function save(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function insertScan(row) {
  const data = load();
  const id = data.nextId++;
  data.scans.push({
    id,
    filename: row.filename,
    plant_name: row.plant_name ?? null,
    disease: row.disease ?? null,
    fertilizer: row.fertilizer ?? null,
    soil_advice: row.soil_advice ?? null,
    raw_response: row.raw_response ?? null,
    created_at: new Date().toISOString(),
  });
  save(data);
  return id;
}

function listScans() {
  const data = load();
  return [...data.scans]
    .sort((a, b) => b.id - a.id)
    .slice(0, 20)
    .map(({ raw_response, ...rest }) => rest);
}

module.exports = { insertScan, listScans };
