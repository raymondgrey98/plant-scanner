const form = document.getElementById('scan-form');
const photoInput = document.getElementById('photo');
const fileLabelText = document.getElementById('file-label-text');
const preview = document.getElementById('preview');
const scanBtn = document.getElementById('scan-btn');
const statusEl = document.getElementById('status');
const resultSection = document.getElementById('result');
const rPlant = document.getElementById('r-plant');
const rDisease = document.getElementById('r-disease');
const rFertilizer = document.getElementById('r-fertilizer');
const rSoil = document.getElementById('r-soil');
const historyEl = document.getElementById('history');

photoInput.addEventListener('change', () => {
  const file = photoInput.files[0];
  if (!file) {
    preview.hidden = true;
    scanBtn.disabled = true;
    fileLabelText.textContent = 'Choose a plant photo';
    return;
  }
  fileLabelText.textContent = file.name;
  preview.src = URL.createObjectURL(file);
  preview.hidden = false;
  scanBtn.disabled = false;
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!photoInput.files[0]) return;

  const fd = new FormData();
  fd.append('photo', photoInput.files[0]);

  scanBtn.disabled = true;
  statusEl.textContent = 'Analyzing photo...';
  resultSection.hidden = true;

  try {
    const res = await fetch('/api/scan', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Scan failed');

    rPlant.textContent = data.plant_name;
    rDisease.textContent = data.disease;
    rFertilizer.textContent = data.fertilizer;
    rSoil.textContent = data.soil_advice;
    resultSection.hidden = false;
    statusEl.textContent = '';
    loadHistory();
  } catch (err) {
    statusEl.textContent = 'Error: ' + err.message;
  } finally {
    scanBtn.disabled = false;
  }
});

async function loadHistory() {
  try {
    const res = await fetch('/api/history');
    const rows = await res.json();
    historyEl.innerHTML = '';
    if (!rows.length) {
      historyEl.innerHTML = '<li class="empty">No scans yet.</li>';
      return;
    }
    for (const row of rows) {
      const li = document.createElement('li');
      li.className = 'history-item';
      li.innerHTML = `
        <img src="${row.url}" alt="" />
        <div>
          <strong>${escapeHtml(row.plant_name || 'unknown')}</strong>
          <span class="muted">${escapeHtml(row.disease || '')}</span>
          <time>${new Date(row.created_at).toLocaleString()}</time>
        </div>
      `;
      historyEl.appendChild(li);
    }
  } catch (err) {
    historyEl.innerHTML = `<li class="empty">Could not load history: ${escapeHtml(err.message)}</li>`;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

loadHistory();
