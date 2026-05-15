import { Component, useEffect, useRef, useState } from 'react';

const API = import.meta.env.VITE_API_BASE_URL || '/api';
const FALLBACK = 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=400&q=80';

// ── Error Boundary ────────────────────────────────────────────
class ErrorBoundary extends Component {
  state = { err: null };
  static getDerivedStateFromError(e) { return { err: e.message }; }
  render() {
    if (this.state.err) return (
      <div className="max-w-md mx-auto mt-20 p-8 bg-zinc-900 border border-zinc-800 rounded-2xl text-center">
        <p className="text-sm text-zinc-500 uppercase tracking-widest mb-2">Error</p>
        <p className="text-zinc-300 mb-6">{this.state.err}</p>
        <button onClick={() => this.setState({ err: null })} className="px-5 py-2 bg-green-500 text-black text-sm font-bold rounded-lg hover:bg-green-400 transition-colors">Reload</button>
      </div>
    );
    return this.props.children;
  }
}

// ── Wikipedia image (5s timeout) ──────────────────────────────
const imgCache = {};
function usePlantImage(plant) {
  const [src, setSrc] = useState(plant.image_url || null);
  useEffect(() => {
    const name = plant.scientific_name || plant.common_name;
    if (!name) return;
    if (name in imgCache) { if (imgCache[name]) setSrc(imgCache[name]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name.replace(/ /g, '_'))}`, { signal: ctrl.signal })
      .then(r => r.json()).then(d => { const u = d?.thumbnail?.source || null; imgCache[name] = u; if (u) setSrc(u); })
      .catch(() => { imgCache[name] = null; }).finally(() => clearTimeout(t));
    return () => ctrl.abort();
  }, [plant.scientific_name, plant.common_name]);
  return src;
}

// ── Shared UI atoms ───────────────────────────────────────────
const Card = ({ children, className = '', onClick }) => (
  <div onClick={onClick} className={`bg-zinc-900 border border-zinc-800 rounded-xl ${onClick ? 'cursor-pointer hover:border-zinc-700 transition-colors' : ''} ${className}`}>{children}</div>
);

const Badge = ({ children, color = 'zinc' }) => {
  const colors = { zinc: 'bg-zinc-800 text-zinc-400', green: 'bg-green-500/10 text-green-400 border border-green-500/20', blue: 'bg-blue-500/10 text-blue-400 border border-blue-500/20', amber: 'bg-amber-500/10 text-amber-400 border border-amber-500/20', purple: 'bg-purple-500/10 text-purple-400 border border-purple-500/20', red: 'bg-red-500/10 text-red-400 border border-red-500/20' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[color] || colors.zinc}`}>{children}</span>;
};

const SectionLabel = ({ children }) => <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">{children}</p>;

// ── Navigation ────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'home',     label: 'Home' },
  { id: 'scan',     label: 'Identify' },
  { id: 'library',  label: 'My Plants' },
  { id: 'diagnose', label: 'Diagnose' },
  { id: 'tools',    label: 'Tools' },
];

function Navbar({ active, onNav }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 bg-zinc-950/95 border-b border-zinc-800 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
        <button onClick={() => onNav('home')} className="font-display font-extrabold text-lg text-white tracking-tight">
          Flora<span className="text-green-500">IQ</span>
        </button>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map(n => (
            <button key={n.id} onClick={() => onNav(n.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${active === n.id ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'}`}>
              {n.label}
            </button>
          ))}
        </nav>

        <button onClick={() => onNav('scan')} className="hidden md:flex items-center gap-2 px-4 py-1.5 bg-green-500 hover:bg-green-400 text-black text-sm font-bold rounded-lg transition-colors">
          Scan Plant
        </button>

        {/* Mobile hamburger */}
        <button className="md:hidden text-zinc-400 p-2" onClick={() => setMenuOpen(v => !v)}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 4h14M2 9h14M2 14h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-zinc-800 bg-zinc-950 px-4 py-2">
          {NAV_ITEMS.map(n => (
            <button key={n.id} onClick={() => { onNav(n.id); setMenuOpen(false); }}
              className={`block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium mb-1 ${active === n.id ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}>
              {n.label}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}

// ── Plant Library Card ────────────────────────────────────────
function PlantCard({ plant }) {
  const [open, setOpen] = useState(false);
  const img = usePlantImage(plant);
  return (
    <Card onClick={() => setOpen(v => !v)}>
      <div className="aspect-video overflow-hidden rounded-t-xl bg-zinc-800">
        <img src={img || FALLBACK} alt={plant.common_name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" onError={e => { e.target.src = FALLBACK; }} />
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-zinc-100 text-sm">{plant.common_name}</h3>
        <p className="text-xs text-zinc-500 italic mb-2">{plant.scientific_name}</p>
        <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">{plant.care_summary}</p>

        <div className="flex flex-wrap gap-1.5 mt-3">
          {plant.sunlight && <Badge color="amber">{plant.sunlight.split(',')[0]}</Badge>}
          {plant.soil && <Badge>{plant.soil.split(',')[0]}</Badge>}
        </div>

        {open && (
          <div className="mt-4 pt-4 border-t border-zinc-800 flex flex-col gap-3">
            {[
              { label: 'Watering', value: plant.watering },
              { label: 'Fertilizer', value: plant.fertilizer },
              { label: 'Disease', value: plant.disease, red: true },
              { label: 'Pest', value: plant.pest, amber: true },
              { label: 'Uses', value: plant.uses },
              { label: 'Habitat', value: plant.habitat },
            ].filter(r => r.value).map(r => (
              <div key={r.label}>
                <p className={`text-xs font-bold uppercase tracking-wide mb-0.5 ${r.red ? 'text-red-400' : r.amber ? 'text-amber-400' : 'text-zinc-500'}`}>{r.label}</p>
                <p className="text-xs text-zinc-300 leading-relaxed">{r.value}</p>
              </div>
            ))}
            <div className="flex gap-2 pt-1 flex-wrap">
              {[
                { label: 'Wikipedia', href: `https://en.wikipedia.org/wiki/${encodeURIComponent((plant.scientific_name || plant.common_name).replace(/ /g,'_'))}` },
                { label: 'GBIF', href: `https://www.gbif.org/species/search?q=${encodeURIComponent(plant.scientific_name || plant.common_name)}` },
                { label: 'iNaturalist', href: `https://www.inaturalist.org/taxa/search?q=${encodeURIComponent(plant.scientific_name || plant.common_name)}` },
              ].map(l => (
                <a key={l.label} href={l.href} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                  className="text-xs text-zinc-500 hover:text-zinc-300 underline underline-offset-2 transition-colors">
                  {l.label} ↗
                </a>
              ))}
            </div>
          </div>
        )}
        <p className="text-xs text-zinc-600 mt-3 text-center">{open ? 'Collapse ↑' : 'View details ↓'}</p>
      </div>
    </Card>
  );
}

// ── Scan Result ───────────────────────────────────────────────
function ScanResult({ scan, examplePhoto }) {
  const [activeTab, setActiveTab] = useState('overview');
  const tax = scan.taxonomy || {};
  const morph = scan.morphology || {};

  const stype = (scan.subject_type || scan.plant_type || 'plant').toLowerCase();
  const isAnimal = /insect|spider|bird|mammal|reptile|amphibian|fish/.test(stype);
  const isMushroom = /mushroom|fung/.test(stype);
  const isPlant = !isAnimal && !isMushroom;

  const name = scan.common_name || scan.plant_name || 'Unknown';
  const typeLabel = (scan.subject_type || scan.plant_type || 'organism').replace(/_/g, ' ');

  const tab2 = isMushroom ? { id: 'safety',    label: 'Safety'    }
             : isAnimal   ? { id: 'behavior',  label: 'Behavior'  }
             :               { id: 'pathology', label: 'Pathology' };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    tab2,
    { id: 'ecology',  label: 'Ecology'  },
    { id: 'research', label: 'Research' },
  ];

  const keyFacts = isAnimal ? [
    { label: 'Pest Status',  value: scan.pest_status },
    { label: 'Diet',         value: scan.diet?.slice(0, 100) },
    { label: 'Habitat',      value: scan.habitat?.slice(0, 100) },
    { label: 'Life Cycle',   value: scan.life_cycle?.slice(0, 100) },
  ] : isMushroom ? [
    { label: 'Edibility',    value: scan.edibility },
    { label: 'Toxicity',     value: scan.toxicity?.slice(0, 100) },
    { label: 'Habitat',      value: scan.habitat?.slice(0, 100) },
    { label: 'Spore Print',  value: morph.spore_print },
  ] : [
    { label: 'Disease',      value: scan.disease },
    { label: 'Fertilizer',   value: scan.fertilizer },
    { label: 'Soil',         value: scan.soil_advice },
    { label: 'Climate',      value: scan.weather_advice },
  ];

  const tab2Sections = isAnimal ? [
    { title: 'Behavior',           body: scan.behavior },
    { title: 'Diet & Feeding',     body: scan.diet },
    { title: 'Life Cycle',         body: scan.life_cycle },
    { title: 'Pest Control Methods', body: scan.control_methods },
  ] : isMushroom ? [
    { title: 'Edibility & Preparation', body: scan.edibility, warn: false },
    { title: 'Toxicity',                body: scan.toxicity,  warn: !!scan.toxicity },
    { title: 'Look-alike Species',      body: scan.lookalikes, warn: !!scan.lookalikes },
    { title: 'Safety Warning',          body: scan.safety_warning, warn: !!scan.safety_warning },
  ] : [
    { title: 'Pathogen & Disease',              body: scan.disease_pathology || (scan.disease && scan.disease !== 'No visible disease' ? scan.disease : 'No disease visible in this image.') },
    { title: 'Integrated Management Protocol', body: scan.treatment || 'No treatment required.' },
    { title: 'Pest Threats',                   body: scan.pest || 'No major pests identified.' },
  ];

  const badgeColor = isAnimal ? 'blue' : isMushroom ? 'amber' : 'green';

  return (
    <Card>
      {examplePhoto && (
        <div className="relative">
          <img src={examplePhoto} alt={name} className="w-full h-52 object-cover rounded-t-xl" onError={e => { e.target.parentElement.style.display = 'none'; }} />
          <span className="absolute bottom-2 right-2 text-xs bg-black/60 text-white/70 px-2 py-0.5 rounded">Reference · iNaturalist</span>
        </div>
      )}

      {/* Safety banner — shown at top for toxic/mushroom identifications */}
      {scan.safety_warning && (
        <div className="mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
          <p className="text-xs font-bold text-red-400 uppercase tracking-wide mb-1">Safety Warning</p>
          <p className="text-sm text-red-300 leading-relaxed">{scan.safety_warning}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 p-5 border-b border-zinc-800">
        <div>
          <Badge color={badgeColor}>{typeLabel}</Badge>
          <h2 className="font-display font-extrabold text-xl text-white mt-1.5">{name}</h2>
          {scan.scientific_name && <p className="text-sm text-zinc-500 italic mt-0.5">{scan.scientific_name}</p>}
        </div>
        <div className="text-center border border-zinc-700 rounded-xl p-3 min-w-18 bg-zinc-800/50 shrink-0">
          <p className="text-xs text-zinc-500 mb-1">Confidence</p>
          <p className="text-2xl font-bold text-green-400">{((scan.confidence || 0) * 100).toFixed(0)}%</p>
        </div>
      </div>

      {/* Taxonomy */}
      {Object.values(tax).some(Boolean) && (
        <div className="px-5 py-3 border-b border-zinc-800 bg-zinc-900/50">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Taxonomy</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
            {['kingdom','phylum','class','order','family','genus','species'].filter(k => tax[k]).map(k => (
              <div key={k} className="flex gap-2 items-baseline">
                <span className="text-xs text-zinc-600 uppercase w-14 shrink-0">{k}</span>
                <span className="text-xs text-zinc-300 italic">{tax[k]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 px-5">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`py-2.5 px-3 text-xs font-semibold uppercase tracking-wide border-b-2 -mb-px transition-colors ${activeTab === t.id ? 'border-green-500 text-green-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div>
          <div className="grid grid-cols-2 divide-x divide-y divide-zinc-800 border-b border-zinc-800">
            {keyFacts.map(c => (
              <div key={c.label} className="p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-1">{c.label}</p>
                <p className="text-sm text-zinc-300 leading-relaxed">{c.value || '—'}</p>
              </div>
            ))}
          </div>

          {/* Description / Care summary */}
          {(scan.description || scan.care_summary) && (
            <div className="p-5 border-b border-zinc-800">
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-2">
                {isPlant ? 'Scientific Care Protocol' : 'Description'}
              </p>
              <p className="text-sm text-zinc-300 leading-relaxed">{scan.description || scan.care_summary}</p>
            </div>
          )}

          {/* Morphology — renders whatever keys the AI returned */}
          {Object.entries(morph).filter(([, v]) => v).length > 0 && (
            <div className="p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-3">Physical Characteristics</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(morph).filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="bg-zinc-800/40 rounded-lg p-3">
                    <p className="text-xs font-bold uppercase text-zinc-500 mb-1">{k}</p>
                    <p className="text-sm text-zinc-300 leading-relaxed">{v}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Pathology / Behavior / Safety */}
      {activeTab === tab2.id && (
        <div className="divide-y divide-zinc-800">
          {tab2Sections.filter(s => s.body).map(s => (
            <div key={s.title} className={`p-5 ${s.warn ? 'bg-red-500/5' : ''}`}>
              <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${s.warn ? 'text-red-400' : 'text-zinc-500'}`}>{s.title}</p>
              <p className="text-sm text-zinc-300 leading-relaxed">{s.body}</p>
            </div>
          ))}
          {tab2Sections.every(s => !s.body) && (
            <p className="p-5 text-center text-zinc-500 text-sm">No data for this section.</p>
          )}
        </div>
      )}

      {/* Tab: Ecology */}
      {activeTab === 'ecology' && (
        <div className="divide-y divide-zinc-800">
          {[
            { title: 'Geographic Distribution',   body: scan.distribution },
            { title: 'Habitat',                    body: scan.habitat },
            { title: 'Ecological Role',            body: scan.ecology },
            { title: 'Ethnobotany & Cultural Uses',body: scan.ethnobotany },
            { title: 'Economic Importance',        body: scan.economic_importance },
            { title: 'Conservation Status',        body: scan.conservation_status },
          ].filter(s => s.body).map(s => (
            <div key={s.title} className="p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-2">{s.title}</p>
              <p className="text-sm text-zinc-300 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Research */}
      {activeTab === 'research' && (
        <div className="p-5 space-y-4">
          {scan.research_notes && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-2">Research Notes</p>
              <p className="text-sm text-zinc-300 leading-relaxed">{scan.research_notes}</p>
            </div>
          )}
          {scan.lookalikes && !isMushroom && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-2">Look-alike Species</p>
              <p className="text-sm text-zinc-300 leading-relaxed">{scan.lookalikes}</p>
            </div>
          )}
          {scan.scientific_name && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-3">External Databases</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Google Scholar', href: `https://scholar.google.com/scholar?q=${encodeURIComponent(scan.scientific_name)}` },
                  { label: 'GBIF Records',   href: `https://www.gbif.org/species/search?q=${encodeURIComponent(scan.scientific_name)}` },
                  { label: 'iNaturalist',    href: `https://www.inaturalist.org/taxa/search?q=${encodeURIComponent(scan.scientific_name)}` },
                  { label: 'Kew POWO',       href: `https://powo.science.kew.org/taxon/search?q=${encodeURIComponent(scan.scientific_name)}` },
                  { label: 'Wikipedia',      href: `https://en.wikipedia.org/wiki/${encodeURIComponent(scan.scientific_name.split(' ').slice(0, 2).join('_'))}` },
                  { label: 'OpenAlex Papers',href: `https://openalex.org/works?search=${encodeURIComponent(scan.scientific_name)}` },
                ].map(l => (
                  <a key={l.label} href={l.href} target="_blank" rel="noreferrer"
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-xs font-medium text-zinc-300 transition-colors">
                    {l.label} ↗
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Search Results ────────────────────────────────────────────
const TYPE_COLOR = { plant:'green', tree:'green', grass:'green', crop:'green', weed:'amber', insect:'blue', spider:'blue', bird:'purple', fungi:'amber', mushroom:'amber', other:'zinc' };

function SearchResults({ results, onClose }) {
  const { local = [], organisms = [], gbif = [], powo = [], inat = [], papers = [], wiki } = results;
  const total = local.length + organisms.length + gbif.length + powo.length + inat.length;

  if (!total && !papers.length && !wiki) return (
    <div className="text-center py-12">
      <p className="text-zinc-500 text-sm">No results found. Try the scientific name or a different spelling.</p>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">
          <span className="text-white font-semibold">{total.toLocaleString()}</span> species found · {papers.length} papers · local DB: {(local.length + organisms.length).toLocaleString()}
        </p>
        <button onClick={onClose} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Clear results</button>
      </div>

      {/* Wikipedia */}
      {wiki && (
        <a href={wiki.url} target="_blank" rel="noreferrer"
          className="flex gap-4 p-4 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl transition-colors no-underline text-inherit">
          {wiki.thumbnail && <img src={wiki.thumbnail} alt={wiki.title} className="w-20 h-20 object-cover rounded-lg shrink-0" />}
          <div>
            <Badge color="blue">Wikipedia</Badge>
            <h3 className="font-semibold text-white mt-1 mb-1">{wiki.title}</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">{wiki.extract?.slice(0, 280)}{wiki.extract?.length > 280 ? '…' : ''}</p>
          </div>
        </a>
      )}

      {/* Local organisms DB (insects, birds, fungi, etc.) */}
      {organisms.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <SectionLabel>FloraIQ Local Database</SectionLabel>
            <Badge color="green">{organisms.length} results</Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {organisms.map(o => {
              const color = TYPE_COLOR[o.subject_type] || 'zinc';
              const inatId = o.external_id?.startsWith('inat:') ? o.external_id.replace('inat:','') : null;
              const gbifKey = o.external_id?.startsWith('gbif:') ? o.external_id.replace('gbif:','') : null;
              const href = inatId
                ? `https://www.inaturalist.org/taxa/${inatId}`
                : gbifKey
                  ? `https://www.gbif.org/species/${gbifKey}`
                  : `https://en.wikipedia.org/wiki/${encodeURIComponent((o.scientific_name||'').replace(/ /g,'_'))}`;
              return (
                <a key={o.id} href={href} target="_blank" rel="noreferrer"
                  className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl overflow-hidden transition-colors no-underline text-inherit">
                  <div className="aspect-square bg-zinc-800 overflow-hidden">
                    {o.image_url
                      ? <img src={o.image_url} alt={o.common_name || o.scientific_name} className="w-full h-full object-cover" onError={e => { e.target.style.display='none'; }} />
                      : <div className="w-full h-full flex items-center justify-center text-zinc-600 text-2xl">🔬</div>}
                  </div>
                  <div className="p-3">
                    <Badge color={color}>{o.subject_type}</Badge>
                    <p className="text-xs font-semibold text-zinc-200 leading-tight mt-1">{o.common_name || o.scientific_name}</p>
                    <p className="text-xs text-zinc-500 italic mt-0.5">{o.scientific_name}</p>
                    {o.family && <p className="text-xs text-zinc-600 mt-0.5">Family: {o.family}</p>}
                    {o.observations_count > 0 && (
                      <p className="text-xs text-zinc-600 mt-0.5">{o.observations_count >= 1000 ? `${(o.observations_count/1000).toFixed(0)}k` : o.observations_count} obs.</p>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* iNaturalist photo grid */}
      {inat.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <SectionLabel>iNaturalist — Community Observations</SectionLabel>
            <Badge color="green">{inat.length} results</Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {inat.map(t => (
              <a key={t.id} href={`https://www.inaturalist.org/taxa/${t.id}`} target="_blank" rel="noreferrer"
                className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl overflow-hidden transition-colors block no-underline text-inherit">
                <div className="aspect-square bg-zinc-800 overflow-hidden">
                  {t.photo
                    ? <img src={t.photo} alt={t.common_name} className="w-full h-full object-cover" onError={e => { e.target.style.display='none'; }} />
                    : <div className="w-full h-full flex items-center justify-center text-2xl text-zinc-600">🌿</div>}
                </div>
                <div className="p-3">
                  <p className="text-xs font-semibold text-zinc-200 leading-tight">{t.common_name}</p>
                  <p className="text-xs text-zinc-500 italic mt-0.5">{t.scientific_name}</p>
                  {t.observations_count > 0 && (
                    <p className="text-xs text-zinc-600 mt-1">{t.observations_count >= 1000 ? `${(t.observations_count/1000).toFixed(0)}k` : t.observations_count} observations</p>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Research Papers */}
      {papers.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <SectionLabel>Research Papers — OpenAlex</SectionLabel>
            <Badge color="purple">{papers.length} papers</Badge>
          </div>
          <div className="space-y-2">
            {papers.map((p, i) => (
              <a key={i} href={p.oa_url || (p.doi ? `https://doi.org/${p.doi.replace('https://doi.org/','')}` : '#')} target="_blank" rel="noreferrer"
                className="flex items-start gap-3 p-4 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl transition-colors no-underline text-inherit">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <Badge color="purple">Journal Article</Badge>
                    {p.is_oa && <Badge color="amber">Open Access</Badge>}
                    {p.year && <Badge>{p.year}</Badge>}
                  </div>
                  <p className="text-sm font-semibold text-zinc-100 leading-snug mb-1">{p.title}</p>
                  <p className="text-xs text-zinc-500">
                    {p.first_author && <span>{p.first_author}</span>}
                    {p.first_author && p.journal && <span> — </span>}
                    {p.journal && <em>{p.journal}</em>}
                  </p>
                </div>
                <span className="text-zinc-600 text-sm shrink-0">↗</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* GBIF */}
      {gbif.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <SectionLabel>GBIF — 2.7 Billion Occurrence Records</SectionLabel>
            <Badge color="blue">{gbif.length} results</Badge>
          </div>
          <div className="space-y-2">
            {gbif.map(p => (
              <a key={p.key} href={`https://www.gbif.org/species/${p.gbif_key}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-3 p-3.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl transition-colors no-underline text-inherit">
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-zinc-100">{p.common_name}</p>
                    <p className="text-xs text-zinc-500 italic">{p.scientific_name}</p>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                    {['kingdom','phylum','class','order','family'].filter(k => p[k]).map(k => (
                      <span key={k} className="text-xs text-zinc-600"><span className="text-zinc-700 uppercase">{k[0]}</span> {p[k]}</span>
                    ))}
                  </div>
                </div>
                <Badge color="blue">GBIF</Badge>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Kew POWO */}
      {powo.length > 0 && (
        <div>
          <SectionLabel>Kew Gardens — Plants of the World Online</SectionLabel>
          <div className="space-y-2">
            {powo.map(p => (
              <a key={p.fqId} href={p.url} target="_blank" rel="noreferrer"
                className="flex items-center justify-between p-3.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl transition-colors no-underline text-inherit">
                <div>
                  <p className="text-sm font-semibold text-zinc-100">{p.common_name}</p>
                  <p className="text-xs text-zinc-500 italic">{p.scientific_name}</p>
                </div>
                <Badge color="amber">Kew</Badge>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Local */}
      {local.length > 0 && (
        <div>
          <SectionLabel>Your Plant Library</SectionLabel>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {local.map(p => (
              <div key={p.id} className="flex items-center gap-3 p-3.5 bg-zinc-900 border border-zinc-800 rounded-xl">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-zinc-100">{p.common_name}</p>
                  <p className="text-xs text-zinc-500 italic">{p.scientific_name}</p>
                  {p.habitat && <p className="text-xs text-zinc-600 mt-0.5">{p.habitat.split(',')[0]}</p>}
                </div>
                <Badge color="green">Library</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── AI Chatbot ────────────────────────────────────────────────
function Chatbot() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([
    { role: 'bot', text: "I'm FloraIQ's AI botanist. Ask me about plant care, disease, taxonomy, soil science, or agricultural research." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, open]);

  async function send(e) {
    e.preventDefault();
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    setMsgs(p => [...p, { role: 'user', text: q }]);
    setLoading(true);
    try {
      const r = await fetch(`${API}/chat/public`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q }) });
      const d = await r.json();
      setMsgs(p => [...p, { role: 'bot', text: d.answer || 'No answer received.' }]);
    } catch {
      setMsgs(p => [...p, { role: 'bot', text: 'Connection error. Check the server.' }]);
    } finally { setLoading(false); }
  }

  const quick = ['What NPK ratio for tomatoes?', 'Fusarium wilt symptoms?', 'How does mycorrhizae work?', 'Optimal pH for rice?'];

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-400 text-black text-sm font-bold rounded-full shadow-lg transition-colors">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 3.5A1.5 1.5 0 013.5 2h9A1.5 1.5 0 0114 3.5v7A1.5 1.5 0 0112.5 12H9l-3 3v-3H3.5A1.5 1.5 0 012 10.5v-7z" fill="currentColor"/></svg>
        {open ? 'Close' : 'Plant Expert'}
      </button>

      {open && (
        <div className="w-80 bg-zinc-900 border border-zinc-700 rounded-2xl overflow-hidden shadow-2xl flex flex-col" style={{ maxHeight: '500px' }}>
          <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900">
            <p className="font-display font-extrabold text-sm text-white">FloraIQ Plant Expert</p>
            <p className="text-xs text-zinc-500">AI Botanist · Research-grade answers</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {msgs.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${m.role === 'user' ? 'bg-green-500 text-black rounded-br-sm' : 'bg-zinc-800 text-zinc-200 rounded-bl-sm'}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2 items-center px-3 py-2 bg-zinc-800 rounded-2xl rounded-bl-sm w-fit">
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
              </div>
            )}
            <div ref={endRef} />
          </div>
          {msgs.length <= 1 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5">
              {quick.map(q => <button key={q} onClick={() => setInput(q)} className="text-xs px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-full text-zinc-400 transition-colors">{q}</button>)}
            </div>
          )}
          <form onSubmit={send} className="flex gap-2 p-3 border-t border-zinc-800">
            <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask about any plant…" disabled={loading}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-500 transition-colors" />
            <button type="submit" disabled={!input.trim() || loading} className="px-3 py-2 bg-green-500 disabled:opacity-40 hover:bg-green-400 text-black text-sm font-bold rounded-lg transition-colors">→</button>
          </form>
        </div>
      )}
    </div>
  );
}

// ── Tool: Water Calculator ────────────────────────────────────
function WaterCalculator({ onBack }) {
  const [type, setType] = useState('vegetable');
  const [size, setSize] = useState('medium');
  const [climate, setClimate] = useState('temperate');
  const [result, setResult] = useState(null);

  const DATA = {
    succulent:  { small: { arid: ['21 days','50 ml'], temperate: ['14 days','75 ml'], tropical: ['10 days','60 ml'] }, medium: { arid: ['21 days','150 ml'], temperate: ['14 days','200 ml'], tropical: ['10 days','180 ml'] }, large: { arid: ['21 days','400 ml'], temperate: ['14 days','500 ml'], tropical: ['10 days','450 ml'] } },
    vegetable:  { small: { arid: ['2 days','200 ml'], temperate: ['2 days','300 ml'], tropical: ['1 day','400 ml'] }, medium: { arid: ['2 days','500 ml'], temperate: ['2 days','700 ml'], tropical: ['1 day','1 L'] }, large: { arid: ['3 days','1.2 L'], temperate: ['2 days','1.8 L'], tropical: ['1 day','2.5 L'] } },
    herb:       { small: { arid: ['3 days','100 ml'], temperate: ['2 days','150 ml'], tropical: ['1 day','200 ml'] }, medium: { arid: ['3 days','250 ml'], temperate: ['2 days','350 ml'], tropical: ['1 day','500 ml'] }, large: { arid: ['3 days','600 ml'], temperate: ['2 days','900 ml'], tropical: ['1 day','1.2 L'] } },
    tropical:   { small: { arid: ['5 days','100 ml'], temperate: ['4 days','150 ml'], tropical: ['3 days','200 ml'] }, medium: { arid: ['5 days','300 ml'], temperate: ['4 days','400 ml'], tropical: ['3 days','500 ml'] }, large: { arid: ['5 days','800 ml'], temperate: ['4 days','1 L'], tropical: ['3 days','1.5 L'] } },
    grass:      { small: { arid: ['3 days','2 L/m²'], temperate: ['4 days','3 L/m²'], tropical: ['2 days','4 L/m²'] }, medium: { arid: ['3 days','2 L/m²'], temperate: ['4 days','3 L/m²'], tropical: ['2 days','4 L/m²'] }, large: { arid: ['3 days','2 L/m²'], temperate: ['4 days','3 L/m²'], tropical: ['2 days','4 L/m²'] } },
    tree:       { small: { arid: ['7 days','500 ml'], temperate: ['5 days','750 ml'], tropical: ['4 days','1 L'] }, medium: { arid: ['10 days','2 L'], temperate: ['7 days','3 L'], tropical: ['5 days','4 L'] }, large: { arid: ['14 days','10 L'], temperate: ['10 days','15 L'], tropical: ['7 days','20 L'] } },
  };

  const sel = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-500 transition-colors appearance-none';

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <button onClick={onBack} className="text-xs text-green-400 hover:text-green-300 mb-4 flex items-center gap-1">← Back to Tools</button>
        <h1 className="font-display font-extrabold text-2xl text-white">Watering Calculator</h1>
        <p className="text-sm text-zinc-400 mt-1 leading-relaxed">Calculate the optimal irrigation schedule based on plant type, container volume, and climate zone.</p>
      </div>
      <div className="space-y-4">
        {[
          { label: 'Plant Type', id: 'type', val: type, set: setType, opts: [['vegetable','Vegetable / Crop'],['herb','Herb'],['succulent','Succulent / Cactus'],['tropical','Tropical Plant'],['grass','Grass / Lawn'],['tree','Tree / Shrub']] },
          { label: 'Container / Area', id: 'size', val: size, set: setSize, opts: [['small','Small (pot ≤ 20 cm / ≤ 1 m²)'],['medium','Medium (pot 20–40 cm / 1–5 m²)'],['large','Large (pot > 40 cm / > 5 m²)']] },
          { label: 'Climate Zone', id: 'climate', val: climate, set: setClimate, opts: [['temperate','Temperate (15–25 °C)'],['tropical','Tropical / Humid (> 25 °C)'],['arid','Arid / Dry (< 15 °C or low humidity)']] },
        ].map(f => (
          <div key={f.id}>
            <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-1.5">{f.label}</label>
            <select value={f.val} onChange={e => f.set(e.target.value)} className={sel}>
              {f.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        ))}
        <button onClick={() => setResult(DATA[type]?.[size]?.[climate] || null)} className="w-full py-2.5 bg-green-500 hover:bg-green-400 text-black font-bold text-sm rounded-lg transition-colors">Calculate Schedule</button>
      </div>
      {result && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="grid grid-cols-2 divide-x divide-zinc-800">
            <div className="p-5"><p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Frequency</p><p className="text-xl font-bold text-green-400">Every {result[0]}</p></div>
            <div className="p-5"><p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Amount</p><p className="text-xl font-bold text-green-400">{result[1]}</p></div>
          </div>
          <div className="px-5 py-4 border-t border-zinc-800 bg-zinc-800/30">
            <p className="text-xs text-zinc-400 leading-relaxed">Always verify by checking soil moisture 2–3 cm deep before watering. Adjust for rainfall, season, and plant health. Root zone moisture consistency is more important than a fixed schedule.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tool: Light Meter Guide ───────────────────────────────────
function LightMeterGuide({ onBack }) {
  const levels = [
    { lux: '50,000+ lux', label: 'Direct Sunlight', color: '#fbbf24', plants: 'Cacti, succulents, most vegetables (tomato, pepper, eggplant), fruit trees, sunflower, corn', tip: 'South-facing outdoor or unshaded greenhouse' },
    { lux: '10,000–50,000 lux', label: 'Bright Indirect', color: '#fb923c', plants: 'Most flowering plants, citrus, herbs (basil, rosemary), orchids, cannabis sativa', tip: 'Near a window with light shade or east/west-facing' },
    { lux: '1,000–10,000 lux', label: 'Medium Indirect', color: '#4ade80', plants: 'Philodendron, pothos, snake plant, peace lily, ferns, shade-tolerant crops', tip: 'A few meters from a bright window or north-facing' },
    { lux: '100–1,000 lux', label: 'Low Light', color: '#60a5fa', plants: 'Cast iron plant, ZZ plant, some dracaena, moss', tip: 'Interior rooms — augment with full-spectrum grow lights' },
    { lux: '< 100 lux', label: 'Very Low / Artificial', color: '#a1a1aa', plants: 'No species survive long-term without supplemental lighting', tip: 'LED grow lights 2700–6500K, 15–30 cm above foliage' },
  ];
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <button onClick={onBack} className="text-xs text-green-400 hover:text-green-300 mb-4 flex items-center gap-1">← Back to Tools</button>
        <h1 className="font-display font-extrabold text-2xl text-white">Light Requirements Guide</h1>
        <p className="text-sm text-zinc-400 mt-1 leading-relaxed">Photon flux density (lux / PPFD) is a fundamental variable in plant cultivation. Use a lux meter app or quantum sensor to measure your growing environment precisely.</p>
      </div>
      <div className="space-y-3">
        {levels.map((l, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex">
            <div className="w-1 shrink-0" style={{ background: l.color }} />
            <div className="p-4 flex-1">
              <div className="flex items-center gap-3 mb-2">
                <code className="text-xs font-mono" style={{ color: l.color }}>{l.lux}</code>
                <p className="text-sm font-semibold text-zinc-100">{l.label}</p>
              </div>
              <p className="text-xs text-zinc-400 mb-1"><span className="text-zinc-500 font-medium">Plants: </span>{l.plants}</p>
              <p className="text-xs text-zinc-500">{l.tip}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-zinc-800/50 border border-zinc-800 rounded-xl p-4">
        <p className="text-xs text-zinc-300 leading-relaxed"><span className="font-bold text-zinc-200">PPFD Note: </span>For precision cultivation, measure in μmol/m²/s. Most vegetables require 400–600 μmol/m²/s; fruiting crops need 600–1,000+ μmol/m²/s during peak growth phases.</p>
      </div>
    </div>
  );
}

// ── Tool: Repotting Guide ─────────────────────────────────────
function RepottingGuide({ onBack }) {
  const signs = [
    { title: 'Roots from drainage holes', desc: 'Primary indicator of root-bound status — the plant has exhausted available substrate volume.' },
    { title: 'Water drains straight through', desc: 'Hydrophobic substrate or root mat prevents retention — nutrient uptake is severely impaired.' },
    { title: 'Plant height ≥ 2× pot diameter', desc: 'Poor height-to-pot ratio causes instability and limits vegetative growth potential.' },
    { title: 'Yellowing despite fertilization', desc: 'Root restriction limits nutrient absorption. Repotting stimulates feeder root regeneration.' },
    { title: 'Over 2 years in same pot', desc: 'Substrate breakdown, salt accumulation, and nutrient depletion — especially critical for fast growers.' },
  ];
  const steps = [
    'Water thoroughly 24–48 h before repotting to minimize transplant shock and improve root extraction.',
    'Select a pot 5–7 cm larger in diameter. Oversizing promotes anaerobic conditions and root rot.',
    'Use species-appropriate substrate: gritty 60% inorganic mix for succulents, peat/perlite for tropicals, loam-based for trees.',
    'Gently remove the plant, tease circling roots, and trim dead or mushy roots with sterile pruning scissors.',
    'Position at the same soil depth. Backfill, firm gently, and drench with a root stimulant (seaweed extract or diluted phosphorus).',
    'Keep in shade for 5–7 days post-repotting. Resume full fertilization after 4 weeks.',
  ];
  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <button onClick={onBack} className="text-xs text-green-400 hover:text-green-300 mb-4 flex items-center gap-1">← Back to Tools</button>
        <h1 className="font-display font-extrabold text-2xl text-white">Repotting Guide</h1>
        <p className="text-sm text-zinc-400 mt-1 leading-relaxed">Repotting at the correct time and using the right substrate significantly improves root architecture, nutrient uptake, and overall plant vigour.</p>
      </div>
      <div>
        <SectionLabel>Signs Your Plant Needs Repotting</SectionLabel>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-800">
          {signs.map((s, i) => (
            <div key={i} className="flex gap-3 p-4">
              <div className="w-5 h-5 rounded-full bg-zinc-700 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold text-zinc-300">{i + 1}</div>
              <div>
                <p className="text-sm font-semibold text-zinc-200">{s.title}</p>
                <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <SectionLabel>Step-by-Step Protocol</SectionLabel>
        <div className="space-y-2">
          {steps.map((s, i) => (
            <div key={i} className="flex gap-3 p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
              <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center shrink-0 text-xs font-bold text-black">{i + 1}</div>
              <p className="text-sm text-zinc-300 leading-relaxed">{s}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Tools & More Page ─────────────────────────────────────────
const ID_TOOLS = [
  { id: 'weed',     label: 'Weed ID',      sub: 'Control & Prevent' },
  { id: 'allergen', label: 'Allergen ID',   sub: 'Identify & Watch Out' },
  { id: 'toxic',    label: 'Toxic ID',      sub: 'Spot & Stay Safe' },
  { id: 'tree',     label: 'Tree ID',       sub: 'Recognize & Explore' },
  { id: 'grass',    label: 'Grass ID',      sub: 'Classify Species' },
  { id: 'insect',   label: 'Insect ID',     sub: 'Discover & Classify' },
  { id: 'bird',     label: 'Bird ID',       sub: 'Observe & Learn' },
  { id: 'ring',     label: 'Tree-ring ID',  sub: 'Analyze Growth' },
];

const PREMIUM = [
  { title: 'Enhanced Plant ID',        desc: 'Identify species with full taxonomy (Kingdom→Species), morphology, and distribution data from 4 global databases.' },
  { title: 'Comprehensive Diagnosis',  desc: 'Pathogen-level disease ID with causal organism, infection mechanism, symptom progression, and treatment protocol.' },
  { title: 'Weed & Toxic Plant ID',    desc: 'Identify weeds, allergens, and toxic species to protect your garden, research subjects, and livestock.' },
  { title: 'Multi-Domain ID Tools',    desc: 'Identify birds, insects, trees, tree rings, grass species, and allergens — beyond just plants.' },
  { title: 'Expanded Care Tools',      desc: 'Science-based Watering Calculator, Light Meter Guide, and Repotting Protocol with lux values and NPK data.' },
  { title: 'Research Papers',          desc: 'Search and access peer-reviewed journal articles from OpenAlex, the world\'s largest open academic database.' },
  { title: 'AI Plant Advisor',         desc: 'Research-grade AI responses from a simulated senior botanist, plant pathologist, and agricultural scientist.' },
  { title: 'Unlimited History',        desc: 'All scanned photos stored with full AI analysis, taxonomy, and pathology report — no time limits.' },
];

function ToolsPage({ onScan, onToolPage }) {
  return (
    <div className="space-y-10">
      {/* Care Tools */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-extrabold text-lg text-white">FloraIQ Tools</h2>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: 'finder',  label: 'Plant Finder',  action: () => onScan('finder') },
            { id: 'diagnose',label: 'Diagnose',       action: () => onToolPage('diagnose') },
            { id: 'water',   label: 'Water Calc',     action: () => onToolPage('water') },
            { id: 'light',   label: 'Light Meter',    action: () => onToolPage('light') },
            { id: 'repot',   label: 'Repotting',      action: () => onToolPage('repot') },
            { id: 'advisor', label: 'AI Advisor',     action: () => {} },
          ].map(t => (
            <button key={t.id} onClick={t.action}
              className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 text-center flex flex-col items-center gap-2 transition-colors cursor-pointer">
              <span className="text-xs font-semibold text-zinc-300">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ID Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-extrabold text-lg text-white">FloraIQ ID</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {ID_TOOLS.map(t => (
            <button key={t.id} onClick={() => onScan(t.id)}
              className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 text-left transition-colors">
              <p className="text-sm font-semibold text-zinc-100">{t.label}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{t.sub}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Premium list */}
      <div>
        <h2 className="font-display font-extrabold text-lg text-white mb-4">Premium Features</h2>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800">
          {PREMIUM.map((f, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-4 hover:bg-zinc-800/40 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-100">{f.title}</p>
                <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{f.desc}</p>
              </div>
              <span className="text-zinc-600 text-lg shrink-0">›</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Scan mode config ─────────────────────────────────────────
const SCAN_MODES = [
  { id: 'default',  label: 'Auto-detect' },
  { id: 'plant',    label: 'Plant' },
  { id: 'insect',   label: 'Insect' },
  { id: 'bird',     label: 'Bird' },
  { id: 'mushroom', label: 'Mushroom' },
  { id: 'weed',     label: 'Weed' },
  { id: 'diagnose', label: 'Disease' },
  { id: 'tree',     label: 'Tree' },
];

// ── Main App ──────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState('home');
  const [tool, setTool] = useState(null);
  const [file, setFile] = useState(null);
  const [scan, setScan] = useState(null);
  const [exPhoto, setExPhoto] = useState(null);
  const [toolHint, setToolHint] = useState('');
  const [history, setHistory] = useState([]);
  const [library, setLibrary] = useState([]);
  const [libFilter, setLibFilter] = useState('');
  const [libTotal, setLibTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [scanMode, setScanMode] = useState('default');
  const [dragOver, setDragOver] = useState(false);
  const [libCat, setLibCat] = useState('All');

  useEffect(() => { loadHistory(); loadLibrary(); }, []);

  async function loadHistory() {
    try { const r = await fetch(`${API}/scans/public`); setHistory(await r.json()); } catch {}
  }
  async function loadLibrary(search = '') {
    try {
      const p = new URLSearchParams({ limit: 200 });
      if (search) p.set('search', search);
      const r = await fetch(`${API}/plants?${p}`);
      const d = await r.json();
      setLibrary(d.items || []);
      setLibTotal(d.total || 0);
    } catch {}
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true); setResults(null);
    try { const r = await fetch(`${API}/search?q=${encodeURIComponent(query.trim())}`); setResults(await r.json()); }
    catch { setResults({ local:[], organisms:[], gbif:[], powo:[], inat:[], papers:[], wiki:null }); }
    finally { setSearching(false); }
  }

  function handleDrop(e) {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer?.files?.[0];
    if (f?.type.startsWith('image/')) { setFile(f); setScan(null); setExPhoto(null); setTab('scan'); }
  }

  async function handleScan(e) {
    e.preventDefault();
    if (!file) return;
    setLoading(true); setError(''); setScan(null); setExPhoto(null);
    const form = new FormData();
    form.append('photo', file);
    form.append('mode', scanMode);
    try {
      const r = await fetch(`${API}/scans/public`, { method: 'POST', body: form });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Scan failed');
      setScan(d.result);
      setExPhoto(d.example_photo || null);
      setHistory(p => [d, ...p].slice(0, 10));
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  function goScan(toolId) {
    const hints = {
      weed:     'Weed identification — invasiveness, herbicide resistance, integrated management',
      toxic:    'Toxic organism identification — compounds, symptoms, emergency guidance',
      tree:     'Tree species ID — bark, leaf, wood properties, forest ecology',
      grass:    'Grass/graminoid species — agronomic classification, growth habit',
      allergen: 'Allergenic species — proteins, pollen season, exposure risk',
      insect:   'Insect identification — pest status, damage type, life cycle, control methods',
      bird:     'Bird species ID — plumage, behavior, migration, diet, nesting',
      ring:     'Tree-ring analysis (dendrochronology) — growth patterns, age estimation',
      diagnose: 'Plant disease diagnosis — pathogen ID, infection mechanism, treatment protocol',
      finder:   'Plant species identification — full taxonomy, morphology, care protocol',
    };
    const modes = {
      weed: 'weed', toxic: 'toxic', tree: 'tree', grass: 'grass',
      allergen: 'allergen', insect: 'insect', bird: 'bird',
      ring: 'tree', diagnose: 'diagnose', finder: 'plant',
    };
    setToolHint(hints[toolId] || '');
    setScanMode(modes[toolId] || 'default');
    setTool(null);
    setTab('scan');
  }

  function goToolPage(id) {
    if (id === 'diagnose') { setTab('diagnose'); return; }
    setTool(id);
    setTab('tools');
  }

  const LIB_CATS = ['All','Indoor','Outdoor','Herbs','Vegetables','Fruits','Trees','Tropical','Medicinal','Succulents','Flowers','Grasses'];
  const libFiltered = library.filter(p => {
    const blob = [p.common_name, p.scientific_name, p.habitat, p.uses, p.soil, p.sunlight, p.care_summary].join(' ').toLowerCase();
    const matchCat  = libCat === 'All' || blob.includes(libCat.toLowerCase());
    const matchText = !libFilter || blob.includes(libFilter.toLowerCase());
    return matchCat && matchText;
  });

  // ── Tab renders ───────────────────────────────────────────────

  const HomeTab = (
    <div>
      {/* ── HERO ─────────────────────────────────────────── */}
      <div className="relative -mx-4 md:-mx-6 px-6 md:px-10 pt-14 pb-16 mb-12 overflow-hidden border-b border-zinc-800/60">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950" />
        <div className="absolute -top-10 right-0 w-96 h-96 bg-green-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-green-500/4 rounded-full blur-2xl pointer-events-none" />
        <div className="relative max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full mb-6">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
            <span className="text-xs font-semibold text-green-400">GBIF · iNaturalist · Kew Gardens · OpenAlex</span>
          </div>
          <h1 className="font-display font-extrabold text-4xl md:text-5xl text-white leading-[1.1] mb-4">
            Identify any plant,<br />insect, bird or fungi<br /><span className="text-green-400">instantly.</span>
          </h1>
          <p className="text-zinc-400 text-sm md:text-base leading-relaxed mb-8 max-w-md">
            Research-grade biological identification for students, botanists, and researchers.
            Full taxonomy, disease diagnosis, and peer-reviewed literature — free.
          </p>
          <div className="flex gap-3 flex-wrap">
            <button onClick={() => setTab('scan')}
              className="flex items-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl transition-colors text-sm shadow-lg shadow-green-500/20">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="13" r="3" stroke="currentColor" strokeWidth="2"/></svg>
              Scan a Photo
            </button>
            <button onClick={() => setTab('library')}
              className="px-6 py-3 bg-zinc-800/80 hover:bg-zinc-700 text-white font-medium rounded-xl border border-zinc-700 transition-colors text-sm">
              Plant Library
            </button>
          </div>
        </div>
      </div>

      {/* ── STATS ─────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 mb-12">
        {[
          { n: '2.7B+',  label: 'Occurrence Records', sub: 'via GBIF backbone' },
          { n: '35k+',   label: 'Plant Species',       sub: 'identified & indexed' },
          { n: '12',     label: 'Organism Types',      sub: 'plants to birds' },
        ].map(s => (
          <div key={s.n} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 md:p-5 text-center">
            <p className="font-display font-extrabold text-2xl md:text-3xl text-green-400">{s.n}</p>
            <p className="text-xs font-semibold text-zinc-300 mt-1">{s.label}</p>
            <p className="text-xs text-zinc-600 mt-0.5 hidden md:block">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── SEARCH ───────────────────────────────────────── */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>Search Species Database</SectionLabel>
          <span className="text-xs text-zinc-600 hidden md:block">iNat · GBIF · Kew · OpenAlex · Wikipedia</span>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input type="text" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Plant, insect, bird, disease — e.g. Solanum lycopersicum, monarch butterfly…"
            className="flex-1 bg-zinc-900 border border-zinc-800 focus:border-green-600/40 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors" />
          <button type="submit" disabled={searching}
            className="px-5 py-3 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black text-sm font-bold rounded-xl transition-colors whitespace-nowrap">
            {searching ? '…' : 'Search'}
          </button>
        </form>
        {searching && <p className="text-xs text-zinc-600 mt-2">Searching iNaturalist · GBIF · Kew · OpenAlex · Wikipedia…</p>}
      </div>

      {results && <SearchResults results={results} onClose={() => setResults(null)} />}

      {!results && (
        <>
          {/* ── HOW IT WORKS ─────────────────────────────── */}
          <div className="mb-12">
            <SectionLabel>How FloraIQ Works</SectionLabel>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { n: '01', title: 'Upload Any Photo',   desc: 'Plant, insect, bird, mushroom, weed, or diseased leaf. Any photo from any angle.' },
                { n: '02', title: 'AI + 4 Databases',   desc: 'Cross-referenced against GBIF (2.7B records), iNaturalist, Kew Gardens, and Wikipedia in seconds.' },
                { n: '03', title: 'Research Output',    desc: 'Full taxonomy, disease pathology, care protocol, distribution data, and peer-reviewed papers.' },
              ].map(s => (
                <div key={s.n} className="relative bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-6 overflow-hidden group transition-colors">
                  <p className="absolute top-4 right-5 font-display font-extrabold text-5xl text-zinc-800 select-none group-hover:text-zinc-700 transition-colors">{s.n}</p>
                  <div className="w-8 h-8 rounded-xl bg-green-500/10 border border-green-500/20 mb-4" />
                  <p className="font-semibold text-zinc-100 mb-2">{s.title}</p>
                  <p className="text-sm text-zinc-500 leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── IDENTIFY GRID ─────────────────────────────── */}
          <div className="mb-12">
            <div className="flex items-center justify-between mb-3">
              <SectionLabel>What Can FloraIQ Identify?</SectionLabel>
              <button onClick={() => setTab('tools')} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">All tools →</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { id: 'finder',   label: 'Plants & Crops',  desc: 'Taxonomy + care protocol' },
                { id: 'insect',   label: 'Insects',         desc: 'Pest status + lifecycle' },
                { id: 'bird',     label: 'Birds',           desc: 'Species + migration' },
                { id: 'tree',     label: 'Trees',           desc: 'Species + forest ecology' },
                { id: 'weed',     label: 'Weeds',           desc: 'ID + herbicide resistance' },
                { id: 'toxic',    label: 'Toxic Species',   desc: 'Compounds + safety' },
                { id: 'mushroom', label: 'Mushrooms',       desc: 'Edibility + lookalikes' },
                { id: 'diagnose', label: 'Plant Diseases',  desc: 'Pathogen + treatment' },
              ].map(t => (
                <button key={t.id} onClick={() => goScan(t.id)}
                  className="group bg-zinc-900 border border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/60 rounded-2xl p-4 text-left transition-all">
                  <p className="text-sm font-semibold text-zinc-200 group-hover:text-white transition-colors">{t.label}</p>
                  <p className="text-xs text-zinc-500 mt-1 leading-tight">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* ── RECENT SCANS ──────────────────────────────── */}
          {history.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <SectionLabel>Recent Identifications</SectionLabel>
                <button onClick={() => { setFile(null); setScan(null); setTab('scan'); }} className="text-xs text-green-400 hover:text-green-300 transition-colors">+ New scan</button>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                {history.slice(0, 4).map(item => {
                  const name = item.result?.common_name || item.result?.plant_name || 'Unknown';
                  const stype = item.result?.subject_type || 'plant';
                  return (
                    <div key={item.id} className="flex gap-3 p-4 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl transition-colors">
                      <img src={item.url || FALLBACK} alt="" className="w-14 h-14 object-cover rounded-xl shrink-0 bg-zinc-800" onError={e => { e.target.src = FALLBACK; }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <p className="text-sm font-semibold text-zinc-100 truncate">{name}</p>
                          <Badge color={TYPE_COLOR[stype] || 'zinc'}>{stype}</Badge>
                        </div>
                        <p className="text-xs text-zinc-600">{new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                        <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed">{item.result?.description || item.result?.care_summary}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  const ScanTab = (
    <div className="grid md:grid-cols-2 gap-8 items-start">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-green-400 mb-3">Universal Identifier</p>
        <h1 className="font-display font-extrabold text-3xl text-white leading-tight mb-3">Identify anything.<br />Research-grade analysis.</h1>
        <p className="text-sm text-zinc-400 leading-relaxed">Upload a photo — plants, insects, birds, mushrooms, weeds, or trees. Get full taxonomy, morphology, behavior, pathology, distribution data, and research notes.</p>
      </div>
      <div className="space-y-4">
        <form onSubmit={handleScan} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
          {toolHint && (
            <div className="bg-green-500/8 border border-green-500/20 rounded-lg px-4 py-2.5">
              <p className="text-xs font-semibold text-green-400">{toolHint}</p>
            </div>
          )}
          <label htmlFor="photo-input" className="flex gap-4 items-center p-5 bg-zinc-800 border border-dashed border-zinc-600 hover:border-zinc-500 rounded-xl cursor-pointer transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-zinc-500 shrink-0"><path d="M21 19V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" fill="currentColor"/></svg>
            <div>
              <p className="text-sm font-semibold text-zinc-200">{file ? file.name : 'Upload plant photo'}</p>
              <p className="text-xs text-zinc-500">JPG, PNG, HEIC · max 10 MB</p>
            </div>
          </label>
          <input id="photo-input" type="file" accept="image/*" className="hidden" onChange={e => { setFile(e.target.files?.[0] || null); setToolHint(''); }} />
          <button type="submit" disabled={!file || loading} className="w-full py-2.5 bg-green-500 hover:bg-green-400 disabled:opacity-40 text-black font-bold text-sm rounded-lg transition-colors">
            {loading ? 'Analyzing…' : 'Scan & Analyze'}
          </button>
          {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5 text-sm text-red-400">{error}</div>}
        </form>
        {scan && <ScanResult scan={scan} examplePhoto={exPhoto} />}
      </div>
    </div>
  );

  const LibraryTab = (
    <div>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-green-400 mb-1">Plant Repository</p>
        <h1 className="font-display font-extrabold text-2xl text-white">My Plants — Learning Library</h1>
        <p className="text-sm text-zinc-500 mt-1">{libTotal} species · Click any card to expand disease, pest &amp; habitat data</p>
      </div>
      <input type="text" placeholder="Filter by name, habitat, or use (e.g. 'medicinal', 'tropical', 'grass')…" value={libFilter}
        onChange={e => setLibFilter(e.target.value)}
        className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-600 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors mb-6" />
      {libFiltered.length === 0
        ? <p className="text-zinc-500 text-sm text-center py-12">No plants match your filter.</p>
        : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{libFiltered.map(p => <PlantCard key={p.id} plant={p} />)}</div>}
      <p className="text-xs text-zinc-600 text-center mt-8 pt-6 border-t border-zinc-800">
        Showing {libFiltered.length} of {libTotal} plants · For billions of species use the Search tab — powered by iNaturalist, GBIF &amp; Kew Gardens
      </p>
    </div>
  );

  const DiagnoseTab = (
    <div>
      <div className="mb-6">
        <h1 className="font-display font-extrabold text-2xl text-white">Plant Diagnosis</h1>
        <p className="text-sm text-zinc-500 mt-1">AI-powered pathological analysis — upload a photo to identify diseases, pests, and toxic species</p>
      </div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800">
        {[
          { title: 'Disease Diagnosis',   desc: 'Upload a photo of a symptomatic plant. AI identifies the causal pathogen (fungal/bacterial/viral/abiotic), describes infection mechanism, symptom progression, and prescribes an integrated management protocol.', action: 'diagnose' },
          { title: 'Weed Identification', desc: 'Identify weed species with scientific names, growth habits, allelopathic properties, and herbicide resistance profiles. Essential for integrated weed management (IWM).', action: 'weed' },
          { title: 'Toxic Plant Check',   desc: 'Identify toxic compounds, affected organ systems, and toxicity thresholds. Covers alkaloids, glycosides, oxalates, saponins, and secondary metabolites harmful to humans or livestock.', action: 'toxic' },
          { title: 'Pest Identification', desc: 'Identify pest species with scientific names, damage type (chewing/sucking/mining/boring), economic threshold, and recommended biological and chemical control measures.', action: 'insect' },
        ].map((f, i) => (
          <button key={i} onClick={() => goScan(f.action)} className="flex items-center gap-4 w-full text-left px-5 py-4 hover:bg-zinc-800/40 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-zinc-100">{f.title}</p>
              <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{f.desc}</p>
            </div>
            <span className="text-zinc-600 text-lg shrink-0">›</span>
          </button>
        ))}
      </div>
    </div>
  );

  const ToolsTab = () => {
    if (tool === 'water') return <WaterCalculator onBack={() => setTool(null)} />;
    if (tool === 'light') return <LightMeterGuide onBack={() => setTool(null)} />;
    if (tool === 'repot') return <RepottingGuide onBack={() => setTool(null)} />;
    return <ToolsPage onScan={goScan} onToolPage={goToolPage} />;
  };

  const views = { home: HomeTab, scan: ScanTab, library: LibraryTab, diagnose: DiagnoseTab, tools: <ToolsTab /> };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-bg text-zinc-100">
        <Navbar active={tab} onNav={t => { setTab(t); if (t !== 'tools') setTool(null); }} />
        <main className="max-w-5xl mx-auto px-4 md:px-6 py-8 pb-20">
          {views[tab] || views.home}
        </main>
        <Chatbot />
      </div>
    </ErrorBoundary>
  );
}
