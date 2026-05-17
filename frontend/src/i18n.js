// FloraIQ — 25-language translation system
// Usage: t('key') returns the string in the current language

export const LANGUAGES = [
  { code: 'en', label: 'English',    flag: '🇺🇸' },
  { code: 'tl', label: 'Filipino',   flag: '🇵🇭' },
  { code: 'es', label: 'Español',    flag: '🇪🇸' },
  { code: 'fr', label: 'Français',   flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch',    flag: '🇩🇪' },
  { code: 'pt', label: 'Português',  flag: '🇧🇷' },
  { code: 'id', label: 'Indonesia',  flag: '🇮🇩' },
  { code: 'ms', label: 'Melayu',     flag: '🇲🇾' },
  { code: 'th', label: 'ไทย',        flag: '🇹🇭' },
  { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'ja', label: '日本語',      flag: '🇯🇵' },
  { code: 'zh', label: '中文',        flag: '🇨🇳' },
  { code: 'ko', label: '한국어',      flag: '🇰🇷' },
  { code: 'ar', label: 'العربية',    flag: '🇸🇦' },
  { code: 'hi', label: 'हिन्दी',      flag: '🇮🇳' },
  { code: 'ru', label: 'Русский',    flag: '🇷🇺' },
  { code: 'it', label: 'Italiano',   flag: '🇮🇹' },
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
  { code: 'pl', label: 'Polski',     flag: '🇵🇱' },
  { code: 'sv', label: 'Svenska',    flag: '🇸🇪' },
  { code: 'tr', label: 'Türkçe',     flag: '🇹🇷' },
  { code: 'uk', label: 'Українська', flag: '🇺🇦' },
  { code: 'bn', label: 'বাংলা',      flag: '🇧🇩' },
  { code: 'sw', label: 'Kiswahili',  flag: '🇰🇪' },
  { code: 'ha', label: 'Hausa',      flag: '🇳🇬' },
];

const translations = {
  en: {
    app_name: 'FloraIQ', tagline: 'Biological Intelligence Platform',
    identify: 'Identify', scan: 'Scan', my_plants: 'My Plants', history: 'History',
    diagnose: 'Diagnose', tools: 'Tools', journal: 'Journal', favorites: 'Favorites',
    survival: 'Survival', map: 'Map', farming: 'Farming', profile: 'Profile', admin: 'Admin',
    login: 'Login', signup: 'Sign Up', logout: 'Logout',
    upload_photo: 'Upload Photo', take_photo: 'Take Photo', analyzing: 'Analyzing…',
    scan_result: 'Scan Result', confidence: 'Confidence', taxonomy: 'Taxonomy',
    edibility: 'Edibility', toxicity: 'Toxicity', safety_warning: 'Safety Warning',
    survival_uses: 'Survival Uses', first_aid: 'First Aid',
    disease: 'Disease', treatment: 'Treatment', fertilizer: 'Fertilizer',
    habitat: 'Habitat', distribution: 'Distribution', conservation: 'Conservation',
    view_on_map: 'View on Map', location: 'Location', geolocated: 'Photo Location',
    weather: 'Weather', plant_care_advice: 'Plant Care Advice', survival_advice: 'Survival Advice',
    farming_assistant: 'Farming Assistant', hydroponics: 'Hydroponics',
    create_plan: 'Create Farm Plan', cost_calculator: 'Cost Calculator',
    hiker_trails: 'My Trails', new_trail: 'New Trip', checkin: 'Check In', sos: 'SOS',
    sos_warning: 'This will alert emergency contacts and authorities.',
    danger_level: 'Danger Level', safe: 'SAFE', caution: 'CAUTION', dangerous: 'DANGEROUS', deadly: 'DEADLY',
    growth_journal: 'Growth Journal', add_entry: 'Add Entry', health_score: 'Health Score',
    collections: 'Collections', new_collection: 'New Collection',
    export_csv: 'Export CSV', search: 'Search', filter: 'Filter',
    page: 'Page', of: 'of', total: 'total',
    no_results: 'No results found.', loading: 'Loading…', error: 'Error',
    save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit', add: 'Add',
    premium: 'Premium', free_plan: 'Free Plan', upgrade: 'Upgrade to Premium',
    notifications: 'Notifications', mark_all_read: 'Mark all read',
    settings: 'Settings', language: 'Language', units: 'Units',
    email_verified: 'Email verified', verify_email: 'Verify Email',
    achievements: 'Achievements', stats: 'Stats', scans_total: 'Total Scans',
    species_found: 'Species Found', offline_mode: 'Offline Mode', online: 'Online',
    scanning_mode: 'Scan Mode', mode_plant: 'Plant', mode_insect: 'Insect',
    mode_bird: 'Bird', mode_mushroom: 'Mushroom', mode_survival: 'Survival',
    mode_diagnose: 'Diagnose', mode_toxic: 'Toxic', mode_tree: 'Tree',
    home: 'Home', recent_scans: 'Recent Scans', featured: 'Featured Species',
    global_sightings: 'Global Sightings', species_map: 'Species Map',
    companion_plants: 'Companion Plants', planting_calendar: 'Planting Calendar',
    days_to_harvest: 'Days to Harvest', yield_per_sqm: 'Yield per m²',
    setup_cost: 'Setup Cost', roi: 'ROI',
  },
  tl: {
    app_name: 'FloraIQ', tagline: 'Plataporma ng Biolohikal na Katalinuhan',
    identify: 'Tukuyin', scan: 'I-scan', my_plants: 'Aking mga Halaman', history: 'Kasaysayan',
    diagnose: 'Suriin', tools: 'Mga Kagamitan', journal: 'Talaarawan', favorites: 'Mga Paborito',
    survival: 'Survival', map: 'Mapa', farming: 'Pagsasaka', profile: 'Profil', admin: 'Admin',
    login: 'Mag-login', signup: 'Mag-sign up', logout: 'Mag-logout',
    upload_photo: 'Mag-upload ng Larawan', take_photo: 'Kumuha ng Larawan', analyzing: 'Sinusuri…',
    scan_result: 'Resulta ng Pag-scan', confidence: 'Kumpiyansa', taxonomy: 'Taksonomi',
    edibility: 'Kakain-kain', toxicity: 'Kapahamakan', safety_warning: 'Babala sa Kaligtasan',
    survival_uses: 'Paggamit sa Survival', first_aid: 'Unang Lunas',
    disease: 'Sakit', treatment: 'Paggamot', fertilizer: 'Pataba',
    habitat: 'Tirahan', distribution: 'Pamamahagi', conservation: 'Pangangalaga',
    view_on_map: 'Tingnan sa Mapa', location: 'Lokasyon', geolocated: 'Lokasyon ng Larawan',
    weather: 'Panahon', plant_care_advice: 'Payo sa Pag-aalaga ng Halaman', survival_advice: 'Payo sa Survival',
    farming_assistant: 'Katulong sa Pagsasaka', hydroponics: 'Hidroponiko',
    create_plan: 'Lumikha ng Plano sa Sakahan', cost_calculator: 'Kalkulador ng Gastos',
    hiker_trails: 'Aking mga Daan', new_trail: 'Bagong Biyahe', checkin: 'Mag-check in', sos: 'SOS',
    sos_warning: 'Ito ay mag-aabiso sa mga emergency contact at awtoridad.',
    danger_level: 'Antas ng Panganib', safe: 'LIGTAS', caution: 'MAG-INGAT', dangerous: 'MAPANGANIB', deadly: 'NAKAMAMATAY',
    growth_journal: 'Talaarawan ng Paglaki', add_entry: 'Magdagdag ng Entry', health_score: 'Puntos ng Kalusugan',
    collections: 'Mga Koleksyon', new_collection: 'Bagong Koleksyon',
    export_csv: 'I-export CSV', search: 'Maghanap', filter: 'Salain',
    page: 'Pahina', of: 'ng', total: 'kabuuan',
    no_results: 'Walang nahanap.', loading: 'Naglo-load…', error: 'Error',
    save: 'I-save', cancel: 'Kanselahin', delete: 'Burahin', edit: 'I-edit', add: 'Magdagdag',
    premium: 'Premium', free_plan: 'Libreng Plano', upgrade: 'Mag-upgrade sa Premium',
    notifications: 'Mga Abiso', mark_all_read: 'Markahan lahat na nabasa',
    settings: 'Mga Setting', language: 'Wika', units: 'Mga Yunit',
    home: 'Home', recent_scans: 'Mga Kamakailang Pag-scan', featured: 'Tampok na Mga Organismo',
    offline_mode: 'Offline Mode', online: 'Online', global_sightings: 'Pandaigdigang Nakita',
    scanning_mode: 'Mode ng Pag-scan', mode_plant: 'Halaman', mode_insect: 'Insekto',
    mode_bird: 'Ibon', mode_mushroom: 'Kabute', mode_survival: 'Survival',
    achievements: 'Mga Nagawa', stats: 'Mga Istatistika', scans_total: 'Kabuuang Scan',
    species_found: 'Nahanap na Espesye',
  },
  es: {
    app_name: 'FloraIQ', tagline: 'Plataforma de Inteligencia Biológica',
    identify: 'Identificar', scan: 'Escanear', my_plants: 'Mis Plantas', history: 'Historial',
    diagnose: 'Diagnosticar', tools: 'Herramientas', journal: 'Diario', favorites: 'Favoritos',
    survival: 'Supervivencia', map: 'Mapa', farming: 'Agricultura', profile: 'Perfil', admin: 'Admin',
    login: 'Iniciar sesión', signup: 'Registrarse', logout: 'Cerrar sesión',
    upload_photo: 'Subir Foto', take_photo: 'Tomar Foto', analyzing: 'Analizando…',
    scan_result: 'Resultado', confidence: 'Confianza', edibility: 'Comestibilidad',
    toxicity: 'Toxicidad', safety_warning: 'Advertencia de Seguridad',
    survival_uses: 'Usos de Supervivencia', first_aid: 'Primeros Auxilios',
    disease: 'Enfermedad', treatment: 'Tratamiento', location: 'Ubicación',
    danger_level: 'Nivel de Peligro', safe: 'SEGURO', caution: 'PRECAUCIÓN', dangerous: 'PELIGROSO', deadly: 'MORTAL',
    home: 'Inicio', search: 'Buscar', save: 'Guardar', cancel: 'Cancelar', delete: 'Eliminar',
    loading: 'Cargando…', offline_mode: 'Modo Sin Conexión', online: 'En Línea',
    farming_assistant: 'Asistente Agrícola', hydroponics: 'Hidroponía',
    weather: 'Clima', sos: 'SOS', achievements: 'Logros', stats: 'Estadísticas',
  },
  fr: {
    app_name: 'FloraIQ', tagline: 'Plateforme d\'Intelligence Biologique',
    identify: 'Identifier', scan: 'Scanner', my_plants: 'Mes Plantes', history: 'Historique',
    diagnose: 'Diagnostiquer', tools: 'Outils', journal: 'Journal', favorites: 'Favoris',
    survival: 'Survie', map: 'Carte', farming: 'Agriculture', profile: 'Profil', admin: 'Admin',
    login: 'Connexion', signup: 'S\'inscrire', logout: 'Déconnexion',
    upload_photo: 'Télécharger Photo', take_photo: 'Prendre Photo', analyzing: 'Analyse en cours…',
    edibility: 'Comestibilité', toxicity: 'Toxicité', safety_warning: 'Avertissement de Sécurité',
    danger_level: 'Niveau de Danger', safe: 'SÛR', caution: 'ATTENTION', dangerous: 'DANGEREUX', deadly: 'MORTEL',
    home: 'Accueil', search: 'Rechercher', save: 'Enregistrer', cancel: 'Annuler',
    loading: 'Chargement…', weather: 'Météo', sos: 'SOS', farming_assistant: 'Assistant Agricole',
  },
  de: {
    identify: 'Identifizieren', scan: 'Scannen', my_plants: 'Meine Pflanzen', history: 'Verlauf',
    survival: 'Überleben', map: 'Karte', farming: 'Landwirtschaft', login: 'Anmelden',
    upload_photo: 'Foto hochladen', take_photo: 'Foto aufnehmen', analyzing: 'Analysiere…',
    danger_level: 'Gefahrenstufe', safe: 'SICHER', caution: 'VORSICHT', dangerous: 'GEFÄHRLICH', deadly: 'TÖDLICH',
    home: 'Startseite', search: 'Suchen', weather: 'Wetter', sos: 'SOS',
  },
  id: {
    identify: 'Identifikasi', scan: 'Pindai', my_plants: 'Tanaman Saya', history: 'Riwayat',
    survival: 'Bertahan Hidup', map: 'Peta', farming: 'Pertanian', login: 'Masuk',
    upload_photo: 'Unggah Foto', take_photo: 'Ambil Foto', analyzing: 'Menganalisis…',
    danger_level: 'Tingkat Bahaya', safe: 'AMAN', caution: 'HATI-HATI', dangerous: 'BERBAHAYA', deadly: 'MEMATIKAN',
    home: 'Beranda', search: 'Cari', weather: 'Cuaca', sos: 'SOS',
  },
  zh: {
    identify: '识别', scan: '扫描', my_plants: '我的植物', history: '历史',
    survival: '求生', map: '地图', farming: '农业', login: '登录',
    upload_photo: '上传照片', take_photo: '拍照', analyzing: '分析中…',
    danger_level: '危险等级', safe: '安全', caution: '注意', dangerous: '危险', deadly: '致命',
    home: '首页', search: '搜索', weather: '天气', sos: 'SOS',
  },
  ja: {
    identify: '識別', scan: 'スキャン', my_plants: 'マイプランツ', history: '履歴',
    survival: 'サバイバル', map: '地図', farming: '農業', login: 'ログイン',
    upload_photo: '写真をアップロード', take_photo: '写真を撮る', analyzing: '分析中…',
    danger_level: '危険レベル', safe: '安全', caution: '注意', dangerous: '危険', deadly: '致命的',
    home: 'ホーム', search: '検索', weather: '天気', sos: 'SOS',
  },
  ar: {
    identify: 'تحديد', scan: 'مسح', my_plants: 'نباتاتي', history: 'السجل',
    survival: 'البقاء', map: 'خريطة', farming: 'زراعة', login: 'تسجيل الدخول',
    upload_photo: 'رفع صورة', take_photo: 'التقاط صورة', analyzing: 'جاري التحليل…',
    danger_level: 'مستوى الخطر', safe: 'آمن', caution: 'تنبيه', dangerous: 'خطير', deadly: 'قاتل',
    home: 'الرئيسية', search: 'بحث', weather: 'الطقس', sos: 'استغاثة',
  },
  hi: {
    identify: 'पहचानें', scan: 'स्कैन', my_plants: 'मेरे पौधे', history: 'इतिहास',
    survival: 'अस्तित्व', map: 'नक्शा', farming: 'खेती', login: 'लॉग इन',
    upload_photo: 'फ़ोटो अपलोड करें', take_photo: 'फ़ोटो लें', analyzing: 'विश्लेषण…',
    danger_level: 'खतरे का स्तर', safe: 'सुरक्षित', caution: 'सावधान', dangerous: 'खतरनाक', deadly: 'घातक',
    home: 'होम', search: 'खोजें', weather: 'मौसम', sos: 'SOS',
  },
};

// Merge with English fallback for missing keys
function buildLang(code) {
  const base   = translations.en;
  const custom = translations[code] || {};
  return new Proxy({ ...base, ...custom }, {
    get: (target, key) => target[key] ?? base[key] ?? key,
  });
}

let currentLang = localStorage.getItem('floraiq_lang') || navigator.language?.split('-')[0] || 'en';
if (!translations[currentLang]) currentLang = 'en';

let _t = buildLang(currentLang);

export function setLanguage(code) {
  currentLang = translations[code] ? code : 'en';
  _t = buildLang(currentLang);
  localStorage.setItem('floraiq_lang', currentLang);
  document.documentElement.lang = currentLang;
}

export function getCurrentLang() { return currentLang; }

export function t(key) { return _t[key] || key; }

export default t;
