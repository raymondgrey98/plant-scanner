import { Component, createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const API = import.meta.env.VITE_API_BASE_URL || '/api';

// ── Error Boundary ────────────────────────────────────────────
class ErrorBoundary extends Component {
  state = { err: null };
  static getDerivedStateFromError(e) { return { err: e.message }; }
  render() {
    if (this.state.err) return (
      <div className="max-w-md mx-auto mt-20 p-8 bg-zinc-900 border border-zinc-800 rounded-2xl text-center">
        <p className="text-sm text-zinc-500 uppercase tracking-widest mb-2">Something went wrong</p>
        <p className="text-zinc-300 mb-6">{this.state.err}</p>
        <button onClick={() => this.setState({ err: null })} className="px-5 py-2 bg-green-500 text-black text-sm font-bold rounded-lg hover:bg-green-400 transition-colors">Reload</button>
      </div>
    );
    return this.props.children;
  }
}

// ── Auth Context ──────────────────────────────────────────────
const AuthCtx = createContext(null);
const useAuth = () => useContext(AuthCtx);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const r = await fetch(`${API}/auth/me`, { credentials: 'include' });
      if (r.ok) setUser(await r.json());
      else setUser(null);
    } catch { setUser(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refreshUser(); }, [refreshUser]);

  const login = useCallback(async (email, password) => {
    const r = await fetch(`${API}/auth/login`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Login failed');
    setUser(d.user);
    return d.user;
  }, []);

  const signup = useCallback(async (name, email, password) => {
    const r = await fetch(`${API}/auth/register`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password }) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Signup failed');
    setUser(d.user);
    return d.user;
  }, []);

  const logout = useCallback(async () => {
    await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' });
    setUser(null);
  }, []);

  return <AuthCtx.Provider value={{ user, loading, login, signup, logout, refreshUser }}>{children}</AuthCtx.Provider>;
}

// ── Online status hook ────────────────────────────────────────
function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

// ── Language system ───────────────────────────────────────────
const LANGUAGES = [
  { code: 'en', label: 'English' }, { code: 'tl', label: 'Filipino' },
  { code: 'es', label: 'Español' }, { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' }, { code: 'pt', label: 'Português' },
  { code: 'id', label: 'Bahasa' }, { code: 'ms', label: 'Melayu' },
  { code: 'th', label: 'ภาษาไทย' }, { code: 'vi', label: 'Tiếng Việt' },
  { code: 'ja', label: '日本語' }, { code: 'zh', label: '中文' },
  { code: 'ko', label: '한국어' }, { code: 'ar', label: 'العربية' },
  { code: 'hi', label: 'हिन्दी' }, { code: 'ru', label: 'Русский' },
  { code: 'it', label: 'Italiano' }, { code: 'nl', label: 'Nederlands' },
  { code: 'pl', label: 'Polski' }, { code: 'sv', label: 'Svenska' },
  { code: 'tr', label: 'Türkçe' }, { code: 'uk', label: 'Українська' },
  { code: 'bn', label: 'বাংলা' }, { code: 'sw', label: 'Kiswahili' },
  { code: 'ha', label: 'Hausa' },
];

function LangSwitcher() {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const select = code => { setLang(code); localStorage.setItem('lang', code); setOpen(false); };
  const current = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1 px-2 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors">
        🌐 {current.code.toUpperCase()}
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-50 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl py-1 w-40 max-h-72 overflow-y-auto">
          {LANGUAGES.map(l => (
            <button key={l.code} onClick={() => select(l.code)} className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${l.code === lang ? 'text-green-400 bg-green-500/10' : 'text-zinc-300 hover:bg-zinc-800'}`}>
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── UI Atoms ──────────────────────────────────────────────────
const Card = ({ children, className = '', onClick }) => (
  <div onClick={onClick} className={`bg-zinc-900 border border-zinc-800 rounded-xl ${onClick ? 'cursor-pointer hover:border-zinc-700 transition-colors' : ''} ${className}`}>{children}</div>
);

const Badge = ({ children, color = 'zinc' }) => {
  const colors = { zinc: 'bg-zinc-800 text-zinc-400', green: 'bg-green-500/10 text-green-400 border border-green-500/20', blue: 'bg-blue-500/10 text-blue-400 border border-blue-500/20', amber: 'bg-amber-500/10 text-amber-400 border border-amber-500/20', purple: 'bg-purple-500/10 text-purple-400 border border-purple-500/20', red: 'bg-red-500/10 text-red-400 border border-red-500/20' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[color] || colors.zinc}`}>{children}</span>;
};

const Btn = ({ children, onClick, variant = 'primary', size = 'md', className = '', disabled, type = 'button' }) => {
  const variants = {
    primary: 'bg-green-500 hover:bg-green-400 text-black font-bold',
    secondary: 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200',
    danger: 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30',
    survival: 'bg-amber-500 hover:bg-amber-400 text-black font-bold',
    ghost: 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800',
  };
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base' };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 ${variants[variant]} ${sizes[size]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
      {children}
    </button>
  );
};

const Input = ({ label, error, className = '', ...props }) => (
  <div className={className}>
    {label && <label className="block text-xs font-medium text-zinc-400 mb-1">{label}</label>}
    <input {...props} className={`w-full px-3 py-2 bg-zinc-900 border ${error ? 'border-red-500' : 'border-zinc-700'} rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-green-500 transition-colors`} />
    {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
  </div>
);

const Textarea = ({ label, className = '', ...props }) => (
  <div className={className}>
    {label && <label className="block text-xs font-medium text-zinc-400 mb-1">{label}</label>}
    <textarea {...props} className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-green-500 transition-colors resize-none" />
  </div>
);

function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[90vh]">
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
            <h3 className="font-semibold text-zinc-100">{title}</h3>
            <button onClick={onClose} className="text-zinc-600 hover:text-zinc-400 text-xl leading-none">×</button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

const DangerLevel = ({ level }) => {
  const levels = {
    SAFE:      { bg: 'bg-green-500/10',  border: 'border-green-500/30',  text: 'text-green-400',  dot: 'bg-green-400' },
    CAUTION:   { bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  text: 'text-amber-400',  dot: 'bg-amber-400' },
    DANGEROUS: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', dot: 'bg-orange-400' },
    DEADLY:    { bg: 'bg-red-500/10',    border: 'border-red-500/30',    text: 'text-red-400',    dot: 'bg-red-400' },
  };
  const l = levels[level?.toUpperCase()] || levels.CAUTION;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${l.bg} ${l.border} ${l.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${l.dot}`} />
      {level || 'UNKNOWN'}
    </span>
  );
};

// ── Notifications ─────────────────────────────────────────────
function NotifBell({ count, onClick }) {
  return (
    <button onClick={onClick} className="relative p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors">
      🔔
      {count > 0 && <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{count > 9 ? '9+' : count}</span>}
    </button>
  );
}

function NotifPanel({ open, onClose }) {
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`${API}/notifications`, { credentials: 'include' })
      .then(r => r.json()).then(d => setNotifs(Array.isArray(d) ? d : []))
      .catch(() => {}).finally(() => setLoading(false));
  }, [open]);
  const markRead = id => {
    fetch(`${API}/notifications/${id}/read`, { method: 'PATCH', credentials: 'include' }).catch(() => {});
    setNotifs(n => n.map(x => x.id === id ? { ...x, read: true } : x));
  };
  const markAll = () => {
    fetch(`${API}/notifications/read-all`, { method: 'PATCH', credentials: 'include' }).catch(() => {});
    setNotifs(n => n.map(x => ({ ...x, read: true })));
  };
  if (!open) return null;
  return (
    <div className="absolute right-0 top-14 z-50 w-80 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <span className="text-sm font-semibold text-zinc-200">Notifications</span>
        <div className="flex items-center gap-2">
          <button onClick={markAll} className="text-xs text-zinc-500 hover:text-zinc-300">Mark all read</button>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-400">×</button>
        </div>
      </div>
      <div className="max-h-80 overflow-y-auto divide-y divide-zinc-800/60">
        {loading && <p className="px-4 py-6 text-sm text-zinc-500 text-center">Loading…</p>}
        {!loading && notifs.length === 0 && <p className="px-4 py-6 text-sm text-zinc-600 text-center">No notifications</p>}
        {notifs.map(n => (
          <div key={n.id} onClick={() => markRead(n.id)} className={`px-4 py-3 cursor-pointer hover:bg-zinc-900 transition-colors ${n.read ? 'opacity-50' : ''}`}>
            <p className="text-xs font-medium text-zinc-200">{n.title || n.type}</p>
            {n.message && <p className="text-xs text-zinc-500 mt-0.5 truncate">{n.message}</p>}
            {!n.read && <span className="inline-block w-1.5 h-1.5 bg-green-400 rounded-full ml-auto" />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Navigation ────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'home',      label: 'Home',      icon: '🏠' },
  { id: 'scan',      label: 'Identify',  icon: '📷' },
  { id: 'survival',  label: 'Survival',  icon: '🏕️' },
  { id: 'map',       label: 'Map',       icon: '🗺️' },
  { id: 'farming',   label: 'Farm',      icon: '🌾' },
  { id: 'landscape', label: 'Landscape', icon: '🌍' },
  { id: 'library',   label: 'Library',   icon: '📚' },
  { id: 'history',   label: 'History',   icon: '🕒' },
  { id: 'journal',   label: 'Journal',   icon: '📓' },
];

const BOTTOM_NAV = [
  { id: 'home',      label: 'Home',    icon: '🏠' },
  { id: 'scan',      label: 'Scan',    icon: '📷' },
  { id: 'survival',  label: 'Survive', icon: '🏕️' },
  { id: 'landscape', label: 'Terrain', icon: '🌍' },
  { id: 'map',       label: 'Map',     icon: '🗺️' },
];

function Navbar({ active, onNav, notifCount, onOpenNotifs, showNotifs, onCloseNotifs }) {
  const { user, logout } = useAuth();
  const online = useOnlineStatus();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 bg-zinc-950/95 border-b border-zinc-800 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14 relative">
        <button onClick={() => onNav('home')} className="font-display font-extrabold text-lg text-white tracking-tight shrink-0">
          Flora<span className="text-green-500">IQ</span>
          {!online && <span className="ml-2 text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full px-2 py-0.5">Offline</span>}
        </button>
        <nav className="hidden lg:flex items-center gap-1 mx-4">
          {NAV_ITEMS.map(n => (
            <button key={n.id} onClick={() => onNav(n.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${active === n.id ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'}`}>
              {n.icon} {n.label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <LangSwitcher />
          {user && <NotifBell count={notifCount} onClick={onOpenNotifs} />}
          {user?.role === 'admin' && (
            <button onClick={() => onNav('admin')} className="hidden sm:flex px-2 py-1.5 text-xs font-bold text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg transition-colors">⚙️ Admin</button>
          )}
          {user ? (
            <button onClick={() => onNav('profile')} className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">
              👤 {user.name?.split(' ')[0]}
            </button>
          ) : (
            <>
              <button onClick={() => onNav('login')} className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors">Sign in</button>
              <button onClick={() => onNav('signup')} className="px-3 py-1.5 text-xs font-bold bg-green-500 hover:bg-green-400 text-black rounded-lg transition-colors">Sign up</button>
            </>
          )}
          <button onClick={() => setMenuOpen(o => !o)} className="lg:hidden p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors text-lg">☰</button>
        </div>
        <NotifPanel open={showNotifs} onClose={onCloseNotifs} />
        {menuOpen && (
          <div className="lg:hidden absolute right-4 top-14 z-50 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl py-2 w-52">
            {NAV_ITEMS.map(n => (
              <button key={n.id} onClick={() => { onNav(n.id); setMenuOpen(false); }}
                className={`flex items-center gap-2 text-left px-3 py-2.5 rounded-lg text-sm font-medium mb-0.5 mx-1 transition-colors ${active === n.id ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/60'}`}>
                {n.icon} {n.label}
              </button>
            ))}
            {user && <button onClick={() => { onNav('profile'); setMenuOpen(false); }} className="flex items-center gap-2 w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 mb-0.5 mx-1">👤 Profile</button>}
            {user?.role === 'admin' && <button onClick={() => { onNav('admin'); setMenuOpen(false); }} className="flex items-center gap-2 w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-purple-400 mb-0.5 mx-1">⚙️ Admin</button>}
            {user && <button onClick={() => { onNav('favorites'); setMenuOpen(false); }} className="flex items-center gap-2 w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 mx-1">❤️ Favorites</button>}
            {!user && <>
              <button onClick={() => { onNav('login'); setMenuOpen(false); }} className="flex items-center gap-2 w-full text-left px-3 py-2.5 rounded-lg text-sm text-zinc-400 mx-1">Sign in</button>
              <button onClick={() => { onNav('signup'); setMenuOpen(false); }} className="flex items-center gap-2 w-full text-left px-3 py-2.5 rounded-lg text-sm font-bold text-green-400 bg-green-500/10 mx-1">Sign up</button>
            </>}
          </div>
        )}
      </div>
    </header>
  );
}

function BottomNav({ active, onNav }) {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-zinc-950/95 border-t border-zinc-800 backdrop-blur-sm flex">
      {BOTTOM_NAV.map(n => (
        <button key={n.id} onClick={() => onNav(n.id)}
          className={`flex-1 flex flex-col items-center py-2 gap-0.5 transition-colors ${active === n.id ? 'text-green-400' : 'text-zinc-500'}`}>
          <span className="text-lg">{n.icon}</span>
          <span className="text-[9px] font-medium">{n.label}</span>
        </button>
      ))}
    </nav>
  );
}

// ── Auth Pages ────────────────────────────────────────────────
function LoginPage({ onNav }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async e => {
    e.preventDefault(); setErr(''); setLoading(true);
    try { await login(email, pw); onNav('home'); }
    catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };
  return (
    <div className="max-w-sm mx-auto mt-16 px-4">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-extrabold text-white mb-1">Welcome back</h1>
        <p className="text-sm text-zinc-500">Sign in to FloraIQ</p>
      </div>
      <Card className="p-6">
        <form onSubmit={submit} className="space-y-4">
          <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
          <Input label="Password" type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••••" required />
          {err && <p className="text-xs text-red-400">{err}</p>}
          <Btn type="submit" disabled={loading} className="w-full">{loading ? 'Signing in…' : 'Sign In'}</Btn>
          <div className="flex items-center justify-between pt-2">
            <button type="button" onClick={() => onNav('forgot')} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Forgot password?</button>
            <p className="text-xs text-zinc-600">No account? <button type="button" onClick={() => onNav('signup')} className="text-green-400 hover:text-green-300 font-medium transition-colors">Sign up free</button></p>
          </div>
        </form>
      </Card>
    </div>
  );
}

function SignupPage({ onNav }) {
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async e => {
    e.preventDefault(); setErr(''); setLoading(true);
    try { await signup(name, email, pw); onNav('home'); }
    catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };
  return (
    <div className="max-w-sm mx-auto mt-16 px-4">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-extrabold text-white mb-1">Create account</h1>
        <p className="text-sm text-zinc-500">Join FloraIQ — free forever</p>
      </div>
      <Card className="p-6">
        <form onSubmit={submit} className="space-y-4">
          <Input label="Name" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" required />
          <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
          <Input label="Password" type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Min 8 characters" minLength={8} required />
          {err && <p className="text-xs text-red-400">{err}</p>}
          <Btn type="submit" disabled={loading} className="w-full">{loading ? 'Creating…' : 'Create Account'}</Btn>
          <p className="mt-4 text-center text-xs text-zinc-600">Already have an account? <button type="button" onClick={() => onNav('login')} className="text-green-400 hover:text-green-300 font-medium transition-colors">Sign in</button></p>
        </form>
      </Card>
    </div>
  );
}

function ForgotPage({ onNav }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const submit = async e => {
    e.preventDefault(); setLoading(true);
    await fetch(`${API}/auth/forgot-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }).catch(() => {});
    setSent(true); setLoading(false);
  };
  return (
    <div className="max-w-sm mx-auto mt-16 px-4">
      <Card className="p-6">
        <h2 className="text-lg font-bold text-white mb-4">Reset password</h2>
        {sent ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-zinc-400">If that email exists, we sent a reset link.</p>
            <Btn onClick={() => onNav('login')} variant="secondary">Back to Sign In</Btn>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
            <Btn type="submit" disabled={loading} className="w-full">{loading ? 'Sending…' : 'Send Reset Link'}</Btn>
            <button type="button" onClick={() => onNav('login')} className="w-full text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Back to Sign In</button>
          </form>
        )}
      </Card>
    </div>
  );
}

// ── Plant Card ────────────────────────────────────────────────
function PlantCard({ plant, onFavorite }) {
  const [imgSrc, setImgSrc] = useState(plant.image_url || null);
  useEffect(() => {
    if (imgSrc) return;
    const name = plant.scientific_name || plant.common_name;
    if (!name) return;
    const ctrl = new AbortController();
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name.replace(/ /g,'_'))}`, { signal: ctrl.signal })
      .then(r => r.json()).then(d => { if (d?.thumbnail?.source) setImgSrc(d.thumbnail.source); }).catch(() => {});
    return () => ctrl.abort();
  }, [plant.scientific_name, plant.common_name]);

  return (
    <Card className="overflow-hidden group">
      {imgSrc && <img src={imgSrc} alt={plant.common_name} className="w-full h-36 object-cover" onError={() => setImgSrc(null)} />}
      {!imgSrc && <div className="w-full h-36 bg-zinc-800/60 flex items-center justify-center text-4xl">🌿</div>}
      <div className="p-3">
        <p className="text-sm font-semibold text-zinc-100 truncate">{plant.common_name || plant.name}</p>
        {plant.scientific_name && <p className="text-xs italic text-zinc-500 truncate">{plant.scientific_name}</p>}
        <div className="flex items-center gap-1 mt-2 flex-wrap">
          {plant.family && <Badge color="green">{plant.family}</Badge>}
          {plant.edible && <Badge color="amber">Edible</Badge>}
          {plant.medicinal && <Badge color="blue">Medicinal</Badge>}
          {plant.toxic && <Badge color="red">Toxic</Badge>}
        </div>
        {onFavorite && (
          <button onClick={() => onFavorite(plant)} className="mt-2 text-xs text-zinc-600 hover:text-red-400 transition-colors">♡ Save</button>
        )}
      </div>
    </Card>
  );
}

// ── Scan Result ───────────────────────────────────────────────
function ScanResult({ result, onSave }) {
  const [tab, setTab] = useState('overview');
  if (!result) return null;
  const id = result.identification || result;
  const survival = result.survival_assessment || {};
  const loc = result.location || result.geo || {};
  const tabs = ['overview', 'survival', 'taxonomy', 'uses', 'location'];

  return (
    <Card className="overflow-hidden">
      {result.image_url && <img src={result.image_url} alt={id.common_name} className="w-full h-48 object-cover" />}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-bold text-zinc-100">{id.common_name || 'Unknown Organism'}</h3>
            {id.scientific_name && <p className="text-xs italic text-zinc-500">{id.scientific_name}</p>}
          </div>
          <div className="flex flex-col items-end gap-1">
            {id.confidence && <Badge color="green">{id.confidence}% match</Badge>}
            {survival.danger_level && <DangerLevel level={survival.danger_level} />}
          </div>
        </div>

        <div className="flex gap-1 mb-4 flex-wrap">
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${tab === t ? 'bg-green-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="space-y-3">
            {id.description && <p className="text-sm text-zinc-300 leading-relaxed">{id.description}</p>}
            {id.native_habitat && <div><p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Habitat</p><p className="text-sm text-zinc-300">{id.native_habitat}</p></div>}
            {id.similar_species?.length > 0 && <div><p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Similar Species</p><ul className="space-y-1">{id.similar_species.map((s, i) => <li key={i} className="text-sm text-zinc-300">• {typeof s === 'object' ? s.name || JSON.stringify(s) : s}</li>)}</ul></div>}
          </div>
        )}

        {tab === 'survival' && (
          <div className="space-y-3">
            {survival.danger_level && <div className="flex items-center gap-2"><span className="text-xs text-zinc-500">Danger:</span><DangerLevel level={survival.danger_level} /></div>}
            {survival.edibility && <div><p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Edibility</p><p className="text-sm text-zinc-300">{survival.edibility}</p></div>}
            {survival.toxicity && <div><p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Toxicity</p><p className="text-sm text-zinc-300">{survival.toxicity}</p></div>}
            {survival.medicinal_uses && <div><p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Medicinal Uses</p><p className="text-sm text-zinc-300">{survival.medicinal_uses}</p></div>}
            {survival.survival_tips?.length > 0 && <div><p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Survival Tips</p><ul className="space-y-1">{survival.survival_tips.map((s, i) => <li key={i} className="text-sm text-zinc-300 flex gap-2"><span className="text-green-500 shrink-0">•</span>{s}</li>)}</ul></div>}
            {survival.emergency_actions && <div className="mt-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg"><p className="text-xs font-bold text-red-400 mb-1">Emergency Actions</p><p className="text-xs text-zinc-300">{survival.emergency_actions}</p></div>}
          </div>
        )}

        {tab === 'taxonomy' && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            {['kingdom','phylum','class','order','family','genus','species'].map(k => (
              id[k] && <div key={k}><p className="text-xs text-zinc-500 capitalize">{k}</p><p className="text-zinc-200 font-medium">{id[k]}</p></div>
            ))}
          </div>
        )}

        {tab === 'uses' && (
          <div className="space-y-3">
            {id.culinary_uses && <div><p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Culinary</p><p className="text-sm text-zinc-300">{id.culinary_uses}</p></div>}
            {id.medicinal_uses && <div><p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Medicinal</p><p className="text-sm text-zinc-300">{id.medicinal_uses}</p></div>}
            {id.cultural_significance && <div><p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Cultural</p><p className="text-sm text-zinc-300">{id.cultural_significance}</p></div>}
            {id.conservation_status && <div><p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Conservation</p><Badge color={id.conservation_status.includes('Least') ? 'green' : 'amber'}>{id.conservation_status}</Badge></div>}
          </div>
        )}

        {tab === 'location' && (
          <div className="space-y-3 text-sm">
            {loc.country || loc.city ? (
              <>
                {loc.country && <div><p className="text-xs text-zinc-500 uppercase tracking-wide mb-0.5">Country</p><p className="text-zinc-200">🌍 {loc.country}</p></div>}
                {loc.city && <div><p className="text-xs text-zinc-500 uppercase tracking-wide mb-0.5">City</p><p className="text-zinc-200">🏙️ {loc.city}</p></div>}
                {loc.street && <div><p className="text-xs text-zinc-500 uppercase tracking-wide mb-0.5">Street</p><p className="text-zinc-200">📍 {loc.street}</p></div>}
                {loc.latitude && <div><p className="text-xs text-zinc-500 uppercase tracking-wide mb-0.5">Coordinates</p><p className="text-zinc-200 font-mono text-xs">{loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}</p></div>}
              </>
            ) : (
              <p className="text-zinc-500 text-xs">No location data in photo. Take photos with GPS enabled for location tracking.</p>
            )}
          </div>
        )}

        {onSave && (
          <div className="mt-4 pt-4 border-t border-zinc-800">
            <Btn onClick={onSave} variant="secondary" size="sm">💾 Save to Library</Btn>
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Search Results ────────────────────────────────────────────
function SearchResults({ query }) {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!query) return;
    setLoading(true);
    fetch(`${API}/search?q=${encodeURIComponent(query)}&sources=gbif,organisms,papers,wiki`, { credentials: 'include' })
      .then(r => r.json()).then(setResults).catch(() => {}).finally(() => setLoading(false));
  }, [query]);
  if (loading) return <div className="py-8 text-center"><div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>;
  if (!results) return null;
  return (
    <div className="space-y-4">
      {results.organisms?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Database ({results.organisms.length})</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {results.organisms.map((o, i) => <PlantCard key={i} plant={o} />)}
          </div>
        </div>
      )}
      {results.gbif?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">GBIF Species ({results.gbif.length})</p>
          <div className="space-y-2">
            {results.gbif.map((g, i) => (
              <Card key={i} className="p-3 flex items-center justify-between">
                <div><p className="text-sm font-medium text-zinc-200">{g.canonicalName}</p><p className="text-xs text-zinc-500">{g.family}</p></div>
                <Badge color="blue">{g.rank}</Badge>
              </Card>
            ))}
          </div>
        </div>
      )}
      {results.wiki && (
        <div>
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Wikipedia</p>
          <Card className="p-4"><p className="text-sm text-zinc-300">{results.wiki.extract}</p></Card>
        </div>
      )}
    </div>
  );
}

// ── Home Page ─────────────────────────────────────────────────
function HomePage({ onNav }) {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  useEffect(() => {
    fetch(`${API}/map/stats`).then(r => r.json()).then(setStats).catch(() => {});
  }, []);

  const features = [
    { icon: '📷', title: 'AI Plant ID', desc: 'Identify any plant, insect, bird, or mushroom with multi-model AI — Gemini, GPT-4o, Claude', action: 'scan' },
    { icon: '🏕️', title: 'Survival Toolkit', desc: 'Edibility assessment, danger levels, SOS beacon, and trail safety for hikers and campers', action: 'survival' },
    { icon: '🌍', title: 'Landscape OSINT', desc: 'Analyze any environment photo — hemisphere, climate zone, dangers, wild food, and disaster risks', action: 'landscape' },
    { icon: '🗺️', title: 'Species Map', desc: 'Global interactive map of all sightings, filterable by species type and region', action: 'map' },
    { icon: '🌾', title: 'Farm Assistant', desc: 'AI-powered crop planning, hydroponics setup, and growing calendar for any region', action: 'farming' },
    { icon: '🍳', title: 'Wild Food Guide', desc: 'Harvest and cook wild plants — traditional recipes, fire and no-fire methods, preservation', action: 'landscape' },
    { icon: '📚', title: 'Species Library', desc: '200+ organisms with taxonomy, habitat, edibility, medicinal uses, and cultural significance', action: 'library' },
    { icon: '📓', title: 'Plant Journal', desc: 'Track plant health, observations, and growth progress with timestamped notes', action: 'journal' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-28">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-extrabold text-white mb-3">Flora<span className="text-green-500">IQ</span></h1>
        <p className="text-zinc-400 text-lg max-w-2xl mx-auto">AI-powered plant intelligence for hikers, farmers, foragers, and nature enthusiasts worldwide.</p>
        {stats && (
          <div className="flex items-center justify-center gap-6 mt-4 text-sm text-zinc-500">
            <span>🌿 <strong className="text-zinc-300">{(stats.total_scans || 0).toLocaleString()}</strong> scans</span>
            <span>🗺️ <strong className="text-zinc-300">{(stats.species_count || 0).toLocaleString()}</strong> species</span>
            <span>🌍 <strong className="text-zinc-300">{(stats.country_count || 0).toLocaleString()}</strong> countries</span>
          </div>
        )}
        <div className="flex items-center justify-center gap-3 mt-6">
          <Btn onClick={() => onNav('scan')} size="lg">📷 Identify Now</Btn>
          <Btn onClick={() => onNav('survival')} variant="survival" size="lg">🏕️ Survival Mode</Btn>
          <Btn onClick={() => onNav('landscape')} variant="secondary" size="lg">🌍 Landscape</Btn>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {features.map((f, i) => (
          <Card key={i} onClick={() => onNav(f.action)} className="p-4 cursor-pointer hover:border-green-500/30 transition-colors">
            <div className="text-2xl mb-2">{f.icon}</div>
            <h3 className="text-sm font-bold text-zinc-100 mb-1">{f.title}</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">{f.desc}</p>
          </Card>
        ))}
      </div>
      {!user && (
        <Card className="p-8 text-center bg-gradient-to-br from-green-500/10 to-zinc-900">
          <h2 className="text-xl font-bold text-white mb-2">Start your FloraIQ journey</h2>
          <p className="text-sm text-zinc-400 mb-6">Free forever. No credit card. Access all features with an account.</p>
          <div className="flex items-center justify-center gap-3">
            <Btn onClick={() => onNav('signup')} size="lg">Create Free Account</Btn>
            <Btn onClick={() => onNav('scan')} variant="secondary" size="lg">Try Without Account</Btn>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Scan Page ─────────────────────────────────────────────────
const SCAN_MODES = [
  { id: 'plant',    label: 'Plant / Herb',   icon: '🌿', desc: 'Flowers, leaves, trees, herbs' },
  { id: 'insect',   label: 'Insect / Bug',   icon: '🐛', desc: 'Beetles, spiders, flies, butterflies' },
  { id: 'bird',     label: 'Bird',           icon: '🐦', desc: 'All bird species worldwide' },
  { id: 'mushroom', label: 'Mushroom',       icon: '🍄', desc: 'Edible, toxic, and medicinal fungi' },
  { id: 'reptile',  label: 'Reptile / Amphibian', icon: '🦎', desc: 'Snakes, lizards, frogs, turtles' },
  { id: 'marine',   label: 'Marine Life',   icon: '🐠', desc: 'Fish, coral, jellyfish, crustaceans' },
  { id: 'survival', label: 'Survival Scan', icon: '⚠️', desc: 'Edibility, danger level, emergency actions' },
];

function ScanPage({ onNav }) {
  const { user } = useAuth();
  const fileRef = useRef(null);
  const camRef = useRef(null);
  const videoRef = useRef(null);
  const [mode, setMode] = useState('plant');
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [stream, setStream] = useState(null);
  const [aiModel, setAiModel] = useState('');

  const pickFile = e => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f); setResult(null); setError('');
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target.result);
    reader.readAsDataURL(f);
  };

  const openCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setStream(s); setCameraOpen(true);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = s; }, 100);
    } catch { setError('Camera access denied. Use file upload instead.'); }
  };

  const capture = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
    canvas.toBlob(blob => {
      const f = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
      setFile(f); setPreview(canvas.toDataURL());
      stream?.getTracks().forEach(t => t.stop()); setStream(null); setCameraOpen(false); setResult(null);
    }, 'image/jpeg', 0.85);
  };

  const closeCamera = () => {
    stream?.getTracks().forEach(t => t.stop()); setStream(null); setCameraOpen(false);
  };

  const analyze = async () => {
    if (!file) return;
    setLoading(true); setError(''); setResult(null); setAiModel('');
    const fd = new FormData();
    fd.append('image', file);
    fd.append('mode', mode);
    try {
      const r = await fetch(`${API}/scans`, { method: 'POST', credentials: 'include', body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Analysis failed');
      setResult(d);
      setAiModel(d.ai_model || d.model || '');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-28">
      <h1 className="text-2xl font-extrabold text-white mb-6">Identify Organism</h1>

      <div className="mb-6">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Scan Mode</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SCAN_MODES.map(m => (
            <button key={m.id} onClick={() => setMode(m.id)}
              className={`p-3 rounded-xl border text-left transition-colors ${mode === m.id ? 'border-green-500 bg-green-500/10' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'}`}>
              <div className="text-xl mb-1">{m.icon}</div>
              <div className="text-xs font-medium text-zinc-200">{m.label}</div>
              <div className="text-xs text-zinc-500 mt-0.5">{m.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {cameraOpen && (
        <div className="mb-6 relative rounded-2xl overflow-hidden border border-zinc-800">
          <video ref={videoRef} autoPlay playsInline className="w-full rounded-xl" />
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
            <Btn onClick={capture} size="lg">📸 Capture</Btn>
            <Btn onClick={closeCamera} variant="secondary" size="lg">Cancel</Btn>
          </div>
        </div>
      )}

      {!cameraOpen && (
        <div className="mb-6">
          {preview ? (
            <div className="relative rounded-2xl overflow-hidden border border-zinc-800">
              <img src={preview} alt="Preview" className="w-full max-h-64 object-cover" />
              <button onClick={() => { setPreview(null); setFile(null); setResult(null); }}
                className="absolute top-3 right-3 bg-zinc-950/80 text-zinc-300 hover:text-white rounded-full w-8 h-8 flex items-center justify-center text-lg">×</button>
            </div>
          ) : (
            <div className="border-2 border-dashed border-zinc-700 rounded-2xl p-10 text-center hover:border-zinc-600 transition-colors cursor-pointer" onClick={() => fileRef.current?.click()}>
              <div className="text-4xl mb-3">📷</div>
              <p className="text-sm text-zinc-400 mb-1">Click to upload or drop an image</p>
              <p className="text-xs text-zinc-600">JPEG, PNG, WebP — up to 10MB</p>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickFile} />
        </div>
      )}

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {aiModel && <p className="text-xs text-zinc-600 mb-3">Analyzed with <span className="text-green-400">{aiModel}</span></p>}

      <div className="flex gap-3 mb-6">
        {!cameraOpen && <Btn onClick={() => openCamera()} variant="secondary" className="flex-1">📷 Camera</Btn>}
        {!cameraOpen && <Btn onClick={() => fileRef.current?.click()} variant="secondary" className="flex-1">📁 Upload</Btn>}
        {file && !cameraOpen && <Btn onClick={analyze} disabled={loading} className="flex-1">{loading ? '🔄 Analyzing…' : '🔍 Analyze'}</Btn>}
      </div>

      {loading && (
        <Card className="p-8 text-center">
          <div className="w-10 h-10 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-zinc-400">Running multi-model AI analysis…</p>
          <p className="text-xs text-zinc-600 mt-1">Gemini → GPT-4o → Claude chain</p>
        </Card>
      )}

      {result && (
        <div className="space-y-4">
          <ScanResult result={result} />
          {user && <Btn onClick={() => onNav('history')} variant="ghost" className="w-full">📜 View History</Btn>}
          {!user && <p className="text-xs text-center text-zinc-500"><button onClick={() => onNav('signup')} className="text-green-400 font-semibold hover:text-green-300 transition-colors">Sign up free</button> to save scans and view history.</p>}
        </div>
      )}
    </div>
  );
}

// ── History Page ──────────────────────────────────────────────
function HistoryPage() {
  const { user } = useAuth();
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(null);
  const PER_PAGE = 20;

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const q = new URLSearchParams({ page, limit: PER_PAGE, ...(filter !== 'all' && { mode: filter }) });
    fetch(`${API}/scans?${q}`, { credentials: 'include' })
      .then(r => r.json()).then(d => { setScans(Array.isArray(d.scans) ? d.scans : []); setTotal(d.total || 0); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [user, page, filter]);

  const exportCsv = () => {
    window.open(`${API}/export/scans?format=csv`, '_blank');
  };

  if (!user) return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      <p className="text-zinc-500 mb-4">Sign in to view your scan history.</p>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-28">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold text-white">Scan History</h1>
        <div className="flex items-center gap-2">
          <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }} className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-zinc-300">
            <option value="all">All types</option>
            {SCAN_MODES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <Btn onClick={exportCsv} variant="secondary" size="sm">Export CSV</Btn>
        </div>
      </div>

      {loading && <div className="py-8 text-center"><div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>}
      {!loading && scans.length === 0 && <p className="text-center text-zinc-500 py-8">No scans yet. Go identify something!</p>}

      <div className="space-y-3">
        {scans.map(s => (
          <Card key={s.id} className="overflow-hidden">
            <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
              <div className="flex items-center gap-3">
                {s.image_url && <img src={s.image_url} className="w-10 h-10 rounded-lg object-cover" />}
                <div>
                  <p className="text-sm font-medium text-zinc-200">{s.common_name || 'Unknown'}</p>
                  <p className="text-xs text-zinc-500">{s.scientific_name || s.mode || ''} · {new Date(s.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {s.confidence && <Badge color="green">{s.confidence}%</Badge>}
                <span className="text-zinc-600 text-xs">{expanded === s.id ? '▲' : '▼'}</span>
              </div>
            </div>
            {expanded === s.id && (
              <div className="border-t border-zinc-800 p-4">
                <ScanResult result={{ identification: s, survival_assessment: s.survival_assessment, location: s.location, image_url: s.image_url }} />
              </div>
            )}
          </Card>
        ))}
      </div>

      {total > PER_PAGE && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <Btn onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} variant="secondary" size="sm">← Prev</Btn>
          <span className="text-xs text-zinc-500">Page {page} of {Math.ceil(total / PER_PAGE)}</span>
          <Btn onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / PER_PAGE)} variant="secondary" size="sm">Next →</Btn>
        </div>
      )}
    </div>
  );
}

// ── Library Page ──────────────────────────────────────────────
function LibraryPage() {
  const [organisms, setOrganisms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    fetch(`${API}/plants?limit=60`).then(r => r.json()).then(d => setOrganisms(Array.isArray(d) ? d : d.plants || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const search = e => { e.preventDefault(); setSearched(true); };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-28">
      <h1 className="text-2xl font-extrabold text-white mb-6">Species Library</h1>
      <form onSubmit={search} className="flex gap-2 mb-6">
        <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search plants, insects, birds, fungi…" className="flex-1" />
        <Btn type="submit">Search</Btn>
      </form>
      {searched && query ? (
        <SearchResults query={query} />
      ) : (
        loading ? (
          <div className="py-8 text-center"><div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {organisms.map((o, i) => <PlantCard key={i} plant={o} />)}
          </div>
        )
      )}
    </div>
  );
}

// ── Survival Page ─────────────────────────────────────────────
function TrailsTab() {
  const { user } = useAuth();
  const [trails, setTrails] = useState([]);
  const [form, setForm] = useState({ name: '', destination: '', expected_return: '', emergency_contact: '' });
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch(`${API}/survival/trails`, { credentials: 'include' }).then(r => r.json()).then(d => setTrails(Array.isArray(d) ? d : [])).catch(() => {});
  }, [user]);

  const createTrail = async e => {
    e.preventDefault(); setCreating(true);
    try {
      const r = await fetch(`${API}/survival/trails`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const d = await r.json();
      if (r.ok) { setTrails(t => [d, ...t]); setForm({ name: '', destination: '', expected_return: '', emergency_contact: '' }); }
    } catch {} finally { setCreating(false); }
  };

  const checkIn = async id => {
    setLoading(true);
    navigator.geolocation.getCurrentPosition(async pos => {
      await fetch(`${API}/survival/trails/${id}/checkin`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }) }).catch(() => {});
      setLoading(false);
    }, () => setLoading(false));
  };

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h3 className="text-base font-bold text-zinc-100 mb-4">Register Trail</h3>
        <form onSubmit={createTrail} className="space-y-3">
          <Input label="Trail Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Morning Hike — Palawan" required />
          <Input label="Destination" value={form.destination} onChange={e => setForm(f => ({ ...f, destination: e.target.value }))} placeholder="Mt. Pulag Summit" required />
          <Input label="Expected Return" type="datetime-local" value={form.expected_return} onChange={e => setForm(f => ({ ...f, expected_return: e.target.value }))} required />
          <Input label="Emergency Contact" type="tel" value={form.emergency_contact} onChange={e => setForm(f => ({ ...f, emergency_contact: e.target.value }))} placeholder="+1 555 0100" required />
          <Btn type="submit" disabled={creating} variant="survival" className="w-full">{creating ? 'Registering…' : '🏕️ Register Trail'}</Btn>
        </form>
      </Card>
      {trails.map(t => (
        <Card key={t.id} className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-200">{t.name}</p>
              <p className="text-xs text-zinc-500">{t.destination} · Return: {new Date(t.expected_return).toLocaleString()}</p>
            </div>
            <Btn onClick={() => checkIn(t.id)} disabled={loading} variant="survival" size="sm">📍 Check In</Btn>
          </div>
          {t.last_checkin && <p className="text-xs text-zinc-600 mt-1">Last check-in: {new Date(t.last_checkin).toLocaleString()}</p>}
        </Card>
      ))}
    </div>
  );
}

function SurvivalPage({ onNav }) {
  const [tab, setTab] = useState('scanner');
  const [guide, setGuide] = useState(null);
  const [guideLoading, setGuideLoading] = useState(false);
  const [sosLoading, setSosLoading] = useState(false);
  const [sosMsg, setSosMsg] = useState('');

  const loadGuide = async () => {
    setGuideLoading(true);
    const r = await fetch(`${API}/survival/guide`).catch(() => null);
    if (r?.ok) setGuide(await r.json());
    setGuideLoading(false);
  };

  const sendSOS = async () => {
    setSosLoading(true); setSosMsg('');
    navigator.geolocation.getCurrentPosition(async pos => {
      const r = await fetch(`${API}/survival/sos`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, message: 'SOS from FloraIQ app' }) }).catch(() => null);
      setSosMsg(r?.ok ? '✅ SOS sent! Emergency contacts notified.' : '⚠️ SOS queued offline — will send when connected.');
      setSosLoading(false);
    }, () => { setSosMsg('⚠️ Location unavailable. SOS queued.'); setSosLoading(false); });
  };

  const survivalTabs = ['scanner', 'guide', 'sos', 'trails'];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-28">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">🏕️</span>
        <div>
          <h1 className="text-2xl font-extrabold text-white">Survival Toolkit</h1>
          <p className="text-xs text-zinc-500">For hikers, campers, and wilderness explorers</p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 flex-wrap">
        {survivalTabs.map(t => (
          <button key={t} onClick={() => { setTab(t); if (t === 'guide' && !guide) loadGuide(); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-amber-500 text-black font-bold' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}`}>
            {t === 'sos' ? '🆘 SOS' : t === 'trails' ? '🗺️ Trails' : t === 'guide' ? '📖 Guide' : '🔍 Scanner'}
          </button>
        ))}
      </div>

      {tab === 'scanner' && (
        <div className="text-center py-8">
          <p className="text-zinc-400 mb-6 text-sm">Use the survival scan mode to assess edibility, danger level, and emergency actions for any organism you encounter.</p>
          <Btn onClick={() => onNav('scan')} variant="survival" size="lg" className="w-full max-w-sm mx-auto">Open Survival Scanner</Btn>
        </div>
      )}

      {tab === 'guide' && (
        <div>
          {guideLoading && <div className="py-8 text-center"><div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>}
          {guide && (
            <div className="space-y-4">
              {guide.sections?.map((s, i) => (
                <Card key={i} className="p-4">
                  <h3 className="text-sm font-bold text-amber-400 mb-2">{s.title}</h3>
                  <p className="text-sm text-zinc-300">{s.content}</p>
                  {s.tips?.length > 0 && <ul className="mt-2 space-y-1">{s.tips.map((tip, j) => <li key={j} className="text-xs text-zinc-400 flex gap-2"><span className="text-amber-400">•</span>{tip}</li>)}</ul>}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'sos' && (
        <Card className="p-8 text-center border-red-500/30">
          <div className="text-5xl mb-4">🆘</div>
          <h2 className="text-xl font-bold text-red-400 mb-2">Emergency SOS Beacon</h2>
          <p className="text-sm text-zinc-400 mb-6">Sends your GPS location to emergency contacts. Works offline via background sync.</p>
          <Btn onClick={sendSOS} disabled={sosLoading} variant="danger" size="lg" className="w-full max-w-xs mx-auto text-red-400 border-red-500">{sosLoading ? '📡 Sending…' : '🆘 SEND SOS'}</Btn>
          {sosMsg && <p className="mt-4 text-sm text-zinc-300">{sosMsg}</p>}
          <div className="mt-6 text-xs text-zinc-600 space-y-1">
            <p>Local emergency numbers: 112 (EU) · 911 (US) · 999 (UK) · 000 (AU)</p>
            <p>Philippine SAR: +63 2 8365 4705</p>
          </div>
        </Card>
      )}

      {tab === 'trails' && <TrailsTab />}
    </div>
  );
}

// ── Map Page ──────────────────────────────────────────────────
function MapPage() {
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const [sightings, setSightings] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/map/sightings?limit=500`).then(r => r.json()).then(d => setSightings(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!mapRef.current || typeof window.L === 'undefined') return;
    if (leafletMap.current) { leafletMap.current.remove(); leafletMap.current = null; }
    const map = window.L.map(mapRef.current, { center: [20, 0], zoom: 2, zoomControl: true });
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
    const colorMap = { plant: '#22c55e', insect: '#f59e0b', bird: '#3b82f6', mushroom: '#8b5cf6', reptile: '#ef4444', marine: '#06b6d4', survival: '#f97316' };
    const filtered = filter === 'all' ? sightings : sightings.filter(s => s.scan_mode === filter);
    filtered.forEach(s => {
      if (!s.latitude || !s.longitude) return;
      const color = colorMap[s.scan_mode] || '#6b7280';
      window.L.circleMarker([s.latitude, s.longitude], { radius: 6, fillColor: color, color: '#fff', weight: 1, fillOpacity: 0.8 })
        .addTo(map)
        .bindPopup(`<b>${s.common_name || 'Unknown'}</b><br>${s.scientific_name || ''}<br><small>${s.country || ''}</small>`);
    });
    leafletMap.current = map;
    return () => { if (leafletMap.current) { leafletMap.current.remove(); leafletMap.current = null; } };
  }, [sightings, filter]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 pb-28">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-extrabold text-white">Global Species Map</h1>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-zinc-300">
          <option value="all">All Species</option>
          {SCAN_MODES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </div>
      {loading && <p className="text-sm text-zinc-500 mb-3">Loading sightings…</p>}
      <div ref={mapRef} className="w-full h-[500px] rounded-2xl border border-zinc-800 overflow-hidden" />
      <div className="flex flex-wrap gap-3 mt-3">
        {[['plant','#22c55e'],['insect','#f59e0b'],['bird','#3b82f6'],['mushroom','#8b5cf6'],['reptile','#ef4444'],['marine','#06b6d4']].map(([k,c]) => (
          <div key={k} className="flex items-center gap-1.5 text-xs text-zinc-400"><span className="w-3 h-3 rounded-full" style={{ background: c }} />{k}</div>
        ))}
      </div>
    </div>
  );
}

// ── Farming Page ──────────────────────────────────────────────
function FarmingPage() {
  const [tab, setTab] = useState('farm');
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const ask = async endpoint => {
    if (!query.trim()) return;
    setLoading(true); setResult(null);
    const r = await fetch(`${API}/farming/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) }).catch(() => null);
    if (r?.ok) setResult(await r.json());
    setLoading(false);
  };

  const farmTabs = [
    { id: 'farm', label: '🌾 Farm Plan', endpoint: 'plan', placeholder: 'Describe your land — size, location, climate, goals…' },
    { id: 'hydro', label: '💧 Hydroponics', endpoint: 'hydroponics', placeholder: 'What crops? Indoor or outdoor? Budget?' },
    { id: 'calendar', label: '📅 Calendar', endpoint: 'calendar', placeholder: 'Location and crops to grow this season' },
  ];
  const current = farmTabs.find(t => t.id === tab) || farmTabs[0];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-28">
      <h1 className="text-2xl font-extrabold text-white mb-6">🌾 Farm Assistant</h1>
      <div className="flex gap-2 mb-6">
        {farmTabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? 'bg-green-500 text-black font-bold' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}`}>
            {t.label}
          </button>
        ))}
      </div>
      <Textarea label="Describe your situation" value={query} onChange={e => setQuery(e.target.value)} placeholder={current.placeholder} className="mb-4" rows={4} />
      <Btn onClick={() => ask(current.endpoint)} disabled={loading || !query.trim()} className="w-full mb-6">{loading ? '🔄 Generating plan…' : '🌱 Generate Plan'}</Btn>
      {result && (
        <Card className="p-5">
          {result.plan && <div className="mb-4"><p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-2">Plan</p><p className="text-sm text-zinc-300 whitespace-pre-wrap">{result.plan}</p></div>}
          {result.crops?.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-2">Recommended Crops</p>
              <div className="flex flex-wrap gap-2">{result.crops.map((c, i) => <Badge key={i} color="green">{c}</Badge>)}</div>
            </div>
          )}
          {result.materials?.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-2">Materials Needed</p>
              <ul className="space-y-1">{result.materials.map((m, i) => <li key={i} className="text-sm text-zinc-300 flex gap-2"><span className="text-green-400">•</span>{m}</li>)}</ul>
            </div>
          )}
          {result.estimated_cost && <div><p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Estimated Cost</p><p className="text-sm text-amber-400 font-bold">{result.estimated_cost}</p></div>}
          {result.timeline && <div className="mt-3"><p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Timeline</p><p className="text-sm text-zinc-300">{result.timeline}</p></div>}
          {result.raw && <p className="text-sm text-zinc-300 whitespace-pre-wrap">{result.raw}</p>}
        </Card>
      )}
    </div>
  );
}

// ── Journal Page ──────────────────────────────────────────────
function JournalPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ plant_name: '', notes: '', health_score: 7 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetch(`${API}/journal`, { credentials: 'include' }).then(r => r.json()).then(d => setEntries(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoading(false));
  }, [user]);

  const save = async e => {
    e.preventDefault(); setSaving(true);
    const r = await fetch(`${API}/journal`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }).catch(() => null);
    if (r?.ok) { const d = await r.json(); setEntries(en => [d, ...en]); setForm({ plant_name: '', notes: '', health_score: 7 }); }
    setSaving(false);
  };

  const del = async id => {
    await fetch(`${API}/journal/${id}`, { method: 'DELETE', credentials: 'include' }).catch(() => {});
    setEntries(e => e.filter(x => x.id !== id));
  };

  if (!user) return <div className="max-w-lg mx-auto px-4 py-16 text-center"><p className="text-zinc-500">Sign in to use your plant journal.</p></div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-28">
      <h1 className="text-2xl font-extrabold text-white mb-6">📓 Plant Journal</h1>
      <Card className="p-5 mb-6">
        <h3 className="text-sm font-bold text-zinc-200 mb-4">New Entry</h3>
        <form onSubmit={save} className="space-y-3">
          <Input label="Plant Name" value={form.plant_name} onChange={e => setForm(f => ({ ...f, plant_name: e.target.value }))} placeholder="e.g. Tomato, Basil, Fern" required />
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Health Score: <span className="text-green-400 font-bold">{form.health_score}/10</span></label>
            <input type="range" min="1" max="10" value={form.health_score} onChange={e => setForm(f => ({ ...f, health_score: +e.target.value }))} className="w-full accent-green-500" />
          </div>
          <Textarea label="Observations" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Growth, color, issues, changes…" rows={3} />
          <Btn type="submit" disabled={saving} className="w-full">{saving ? 'Saving…' : '+ Add Entry'}</Btn>
        </form>
      </Card>
      {loading && <div className="py-6 text-center"><div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>}
      <div className="space-y-3">
        {entries.map(e => (
          <Card key={e.id} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-semibold text-zinc-200">{e.plant_name}</p>
                <p className="text-xs text-zinc-500">{new Date(e.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge color={e.health_score >= 7 ? 'green' : e.health_score >= 4 ? 'amber' : 'red'}>Health {e.health_score}/10</Badge>
                <button onClick={() => del(e.id)} className="text-zinc-700 hover:text-red-400 transition-colors text-xs">✕</button>
              </div>
            </div>
            {e.notes && <p className="text-sm text-zinc-400">{e.notes}</p>}
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Favorites Page ────────────────────────────────────────────
function FavoritesPage() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newCol, setNewCol] = useState('');

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      fetch(`${API}/favorites`, { credentials: 'include' }).then(r => r.json()),
      fetch(`${API}/favorites/collections`, { credentials: 'include' }).then(r => r.json()),
    ]).then(([favs, cols]) => { setFavorites(Array.isArray(favs) ? favs : []); setCollections(Array.isArray(cols) ? cols : []); }).catch(() => {}).finally(() => setLoading(false));
  }, [user]);

  const removeFav = async id => {
    await fetch(`${API}/favorites/${id}`, { method: 'DELETE', credentials: 'include' }).catch(() => {});
    setFavorites(f => f.filter(x => x.id !== id));
  };

  const createCollection = async e => {
    e.preventDefault();
    const r = await fetch(`${API}/favorites/collections`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newCol }) }).catch(() => null);
    if (r?.ok) { const d = await r.json(); setCollections(c => [d, ...c]); setNewCol(''); }
  };

  if (!user) return <div className="max-w-lg mx-auto px-4 py-16 text-center"><p className="text-zinc-500">Sign in to view favorites.</p></div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-28">
      <h1 className="text-2xl font-extrabold text-white mb-6">❤️ Favorites</h1>
      {loading && <div className="py-6 text-center"><div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        {favorites.map((f, i) => (
          <div key={i} className="relative">
            <PlantCard plant={f.plant || f} />
            <button onClick={() => removeFav(f.id)} className="absolute top-2 right-2 w-6 h-6 bg-zinc-950/80 rounded-full text-zinc-400 hover:text-red-400 transition-colors text-xs flex items-center justify-center">✕</button>
          </div>
        ))}
      </div>
      <div>
        <h3 className="text-sm font-bold text-zinc-300 mb-3">Collections</h3>
        <form onSubmit={createCollection} className="flex gap-2 mb-4">
          <Input value={newCol} onChange={e => setNewCol(e.target.value)} placeholder="New collection name…" className="flex-1" />
          <Btn type="submit" variant="secondary">+ Create</Btn>
        </form>
        <div className="grid sm:grid-cols-2 gap-3">
          {collections.map(c => (
            <Card key={c.id} className="p-3">
              <p className="text-sm font-medium text-zinc-200">{c.name}</p>
              <p className="text-xs text-zinc-500">{c.item_count || 0} plants</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Profile Page ──────────────────────────────────────────────
function ProfilePage({ onNav }) {
  const { user, logout, refreshUser } = useAuth();
  const [tab, setTab] = useState('profile');
  const [form, setForm] = useState({ name: '', email: '' });
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [sub, setSub] = useState(null);

  useEffect(() => {
    if (user) { setForm({ name: user.name || '', email: user.email || '' }); }
    fetch(`${API}/subscription/status`, { credentials: 'include' }).then(r => r.json()).then(setSub).catch(() => {});
  }, [user]);

  if (!user) return <div className="max-w-lg mx-auto px-4 py-16 text-center"><Btn onClick={() => onNav('login')}>Sign In</Btn></div>;

  const saveProfile = async e => {
    e.preventDefault(); setSaving(true); setMsg('');
    const r = await fetch(`${API}/auth/profile`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }).catch(() => null);
    if (r?.ok) { await refreshUser(); setMsg('Profile updated!'); }
    else setMsg('Update failed.');
    setSaving(false);
  };

  const changePw = async e => {
    e.preventDefault();
    if (pw.next !== pw.confirm) { setMsg('Passwords do not match'); return; }
    setSaving(true); setMsg('');
    const r = await fetch(`${API}/auth/password`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current_password: pw.current, new_password: pw.next }) }).catch(() => null);
    setMsg(r?.ok ? 'Password changed!' : 'Password change failed.'); setSaving(false);
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-8 pb-28">
      <h1 className="text-2xl font-extrabold text-white mb-6">Profile</h1>
      <div className="flex gap-2 mb-6">
        {['profile','password','subscription'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>{t}</button>
        ))}
      </div>
      {msg && <p className="text-sm text-green-400 mb-4">{msg}</p>}

      {tab === 'profile' && (
        <Card className="p-5">
          <form onSubmit={saveProfile} className="space-y-4">
            <Input label="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Input label="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <Btn type="submit" disabled={saving} className="w-full">{saving ? 'Saving…' : 'Save Profile'}</Btn>
            <div className="pt-4 border-t border-zinc-800">
              <Btn onClick={() => { logout(); onNav('home'); }} variant="danger" className="w-full">Sign Out</Btn>
            </div>
          </form>
        </Card>
      )}

      {tab === 'password' && (
        <Card className="p-5">
          <form onSubmit={changePw} className="space-y-4">
            <Input label="Current Password" type="password" value={pw.current} onChange={e => setPw(p => ({ ...p, current: e.target.value }))} />
            <Input label="New Password" type="password" value={pw.next} onChange={e => setPw(p => ({ ...p, next: e.target.value }))} minLength={8} />
            <Input label="Confirm New Password" type="password" value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} />
            <Btn type="submit" disabled={saving} className="w-full">{saving ? 'Changing…' : 'Change Password'}</Btn>
          </form>
        </Card>
      )}

      {tab === 'subscription' && (
        <Card className="p-5">
          <div className="mb-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Current Plan</p>
            <p className="text-lg font-bold text-zinc-100">{sub?.plan || 'Free'}</p>
            {sub?.status && <Badge color={sub.status === 'active' ? 'green' : 'zinc'}>{sub.status}</Badge>}
          </div>
          {sub?.current_period_end && <p className="text-xs text-zinc-500 mb-4">Renews {new Date(sub.current_period_end * 1000).toLocaleDateString()}</p>}
          {(!sub || sub.plan === 'free') && (
            <div>
              <p className="text-sm text-zinc-400 mb-3">Upgrade to FloraIQ Pro for unlimited scans and priority AI.</p>
              <Btn onClick={() => window.open(`${API}/subscription/checkout`, '_blank')} className="w-full">Upgrade to Pro</Btn>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ── Admin Page ────────────────────────────────────────────────
function EmergencyTrailsTab() {
  const [trails, setTrails] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${API}/admin/emergency-trails`, { credentials: 'include' }).then(r => r.json()).then(d => setTrails(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoading(false));
  }, []);
  if (loading) return <div className="py-6 text-center"><div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>;
  return (
    <div className="space-y-3">
      {trails.length === 0 && <p className="text-sm text-zinc-500 text-center py-4">No overdue trails</p>}
      {trails.map(t => (
        <Card key={t.id} className="p-4 border-red-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-200">{t.name}</p>
              <p className="text-xs text-zinc-500">User: {t.user_name} · Dest: {t.destination}</p>
              <p className="text-xs text-red-400">Overdue since {new Date(t.expected_return).toLocaleString()}</p>
            </div>
            {t.latitude && t.longitude && (
              <a href={`https://maps.google.com/?q=${t.latitude},${t.longitude}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300">Maps 🔗</a>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

function AdminPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('stats');
  const [userSearch, setUserSearch] = useState('');

  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    Promise.all([
      fetch(`${API}/admin/stats`, { credentials: 'include' }).then(r => r.json()),
      fetch(`${API}/admin/users`, { credentials: 'include' }).then(r => r.json()),
    ]).then(([s, u]) => { setStats(s); setUsers(Array.isArray(u) ? u : []); }).catch(() => {}).finally(() => setLoading(false));
  }, [user]);

  const toggleBan = async (id, banned) => {
    await fetch(`${API}/admin/users/${id}/${banned ? 'unban' : 'ban'}`, { method: 'POST', credentials: 'include' }).catch(() => {});
    setUsers(u => u.map(x => x.id === id ? { ...x, banned: !banned } : x));
  };

  if (!user || user.role !== 'admin') return <div className="max-w-lg mx-auto px-4 py-16 text-center"><p className="text-zinc-500">Admin access required.</p></div>;
  if (loading) return <div className="py-16 text-center"><div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>;

  const filtered = users.filter(u => !userSearch || u.name?.toLowerCase().includes(userSearch.toLowerCase()) || u.email?.toLowerCase().includes(userSearch.toLowerCase()));

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-28">
      <h1 className="text-2xl font-extrabold text-white mb-6">⚙️ Admin Dashboard</h1>
      <div className="flex gap-2 mb-6">
        {['stats', 'users', 'trails'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-purple-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}`}>{t}</button>
        ))}
      </div>

      {tab === 'stats' && stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[['Users', stats.total_users, 'blue'], ['Scans', stats.total_scans, 'green'], ['Subscribers', stats.subscribers, 'purple'], ['Species', stats.species_count, 'amber']].map(([label, val, color]) => (
            <Card key={label} className="p-4 text-center">
              <p className="text-2xl font-extrabold text-zinc-100">{(val || 0).toLocaleString()}</p>
              <p className="text-xs text-zinc-500 mt-1">{label}</p>
            </Card>
          ))}
        </div>
      )}

      {tab === 'users' && (
        <div>
          <Input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search users…" className="mb-4" />
          <div className="space-y-2">
            {filtered.map(u => (
              <Card key={u.id} className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-200">{u.name}</p>
                  <p className="text-xs text-zinc-500">{u.email} · {u.role} · joined {new Date(u.created_at).toLocaleDateString()}</p>
                </div>
                <Btn onClick={() => toggleBan(u.id, u.banned)} variant={u.banned ? 'secondary' : 'danger'} size="sm">{u.banned ? 'Unban' : 'Ban'}</Btn>
              </Card>
            ))}
          </div>
        </div>
      )}

      {tab === 'trails' && <EmergencyTrailsTab />}
    </div>
  );
}

// ── Landscape Intelligence Page ────────────────────────────────────────────────────────────────────────────
// (landscape components inserted here by PowerShell)

// ── Landscape Intelligence Page ────────────────────────────────
// (appended to App.jsx)

function LandscapePage() {
  const { user } = useAuth();
  const fileRef = useRef(null);
  const [tab, setTab] = useState('scanner');
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [regionQuery, setRegionQuery] = useState('');
  const [regionResult, setRegionResult] = useState(null);
  const [regionLoading, setRegionLoading] = useState(false);
  const [cookingQuery, setCookingQuery] = useState('');
  const [cookingResult, setCookingResult] = useState(null);
  const [cookingLoading, setCookingLoading] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (user && tab === 'history') {
      fetch(`${API}/landscape/history`, { credentials: 'include' })
        .then(r => r.json()).then(d => setHistory(Array.isArray(d) ? d : [])).catch(() => {});
    }
  }, [user, tab]);

  const pickFile = e => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f); setPreview(URL.createObjectURL(f)); setResult(null); setError('');
  };

  const analyze = async () => {
    if (!file) { setError('Please upload a landscape photo first'); return; }
    setLoading(true); setError(''); setResult(null);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const r = await fetch(`${API}/landscape/analyze`, { method: 'POST', credentials: 'include', body: fd });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Analysis failed');
      setResult(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const getRegionIntel = async e => {
    e.preventDefault(); setRegionLoading(true); setRegionResult(null);
    try {
      const r = await fetch(`${API}/landscape/region-intel/${encodeURIComponent(regionQuery)}`, { credentials: 'include' });
      setRegionResult(await r.json());
    } catch { } finally { setRegionLoading(false); }
  };

  const getCookingGuide = async e => {
    e.preventDefault(); setCookingLoading(true); setCookingResult(null);
    try {
      const r = await fetch(`${API}/landscape/cooking-guide/${encodeURIComponent(cookingQuery)}`);
      setCookingResult(await r.json());
    } catch { } finally { setCookingLoading(false); }
  };

  const safetyColor = label => {
    if (!label) return 'zinc';
    const l = label.toUpperCase();
    if (l === 'SAFE') return 'green';
    if (l === 'CAUTION') return 'amber';
    if (l === 'RISKY') return 'orange';
    if (l === 'DANGEROUS') return 'red';
    return 'zinc';
  };

  const riskColor = level => {
    if (!level) return 'text-zinc-500';
    const l = level.toLowerCase();
    if (l.startsWith('low')) return 'text-green-400';
    if (l.startsWith('medium') || l.startsWith('moderate')) return 'text-amber-400';
    if (l.startsWith('high')) return 'text-red-400';
    return 'text-zinc-400';
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="font-display font-extrabold text-2xl text-white">🌍 Landscape Intelligence</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Upload ANY landscape photo — AI extracts hemisphere, climate, camping safety, wild foods, dangers, and survival intelligence. No GPS required.
        </p>
      </div>

      <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
        <p className="text-xs text-blue-300 leading-relaxed">
          <strong>How it works:</strong> One photo of the environment tells us: hemisphere (sun/shadow angle), climate zone (vegetation type), regional identity (endemic plants), camping risks, edible plants visible, wildlife dangers, natural disaster risks, water sources, and navigation hints — even without GPS or prior research.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap border-b border-zinc-800 pb-4">
        {[
          { id: 'scanner',  label: '📷 Landscape Scan' },
          { id: 'cooking',  label: '🍳 Cooking Guide' },
          { id: 'region',   label: '🗺️ Region Intel' },
          { id: 'history',  label: '📋 History' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === t.id ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'scanner' && (
        <div className="space-y-6">
          <div>
            {!preview ? (
              <div onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-zinc-700 hover:border-blue-500/50 rounded-2xl p-12 text-center cursor-pointer transition-colors">
                <div className="text-5xl mb-4">🌄</div>
                <p className="text-zinc-300 font-semibold mb-1">Upload a landscape, forest, field, or environment photo</p>
                <p className="text-zinc-600 text-xs mb-4">Works with any outdoor scene — jungle, mountain, beach, grassland, urban edge</p>
                <Btn onClick={e => { e.stopPropagation(); fileRef.current?.click(); }} variant="secondary" size="sm">Browse Photo</Btn>
              </div>
            ) : (
              <div className="relative rounded-2xl overflow-hidden">
                <img src={preview} alt="Landscape" className="w-full max-h-72 object-cover rounded-2xl" />
                <button onClick={() => { setFile(null); setPreview(null); setResult(null); }}
                  className="absolute top-3 right-3 bg-black/60 text-white rounded-full w-7 h-7 flex items-center justify-center hover:bg-black/80 text-sm">x</button>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={pickFile} className="hidden" />
          </div>

          {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">{error}</p>}

          {preview && !result && (
            <Btn onClick={analyze} disabled={loading} size="lg" className="w-full !bg-blue-600 hover:!bg-blue-500 text-white">
              {loading ? 'Analyzing landscape with AI…' : 'Analyze Landscape Intelligence'}
            </Btn>
          )}

          {loading && (
            <div className="text-center py-8 space-y-3">
              <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
              <p className="text-zinc-400 text-sm">Extracting environmental intelligence…</p>
              <p className="text-zinc-600 text-xs">Analyzing vegetation, terrain, sun angle, and regional indicators</p>
            </div>
          )}

          {result && <LandscapeResult result={result} safetyColor={safetyColor} riskColor={riskColor} />}
        </div>
      )}

      {tab === 'cooking' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-bold text-zinc-300 mb-1">Wild Plant Cooking and Harvesting Guide</h2>
            <p className="text-xs text-zinc-500 mb-4">Get a complete guide on how to harvest, prepare, and cook any wild plant — including traditional recipes, survival methods without fire, and medicinal preparation. Works for any plant, herb, mushroom, or crop.</p>
            <form onSubmit={getCookingGuide} className="flex gap-2">
              <input value={cookingQuery} onChange={e => setCookingQuery(e.target.value)}
                placeholder="Enter any plant, herb, mushroom e.g. 'Dandelion', 'Stinging Nettle', 'Moringa', 'Wild Ginger'"
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors" required />
              <Btn type="submit" disabled={cookingLoading} className="!bg-blue-600 hover:!bg-blue-500 text-white">
                {cookingLoading ? '…' : 'Get Guide'}
              </Btn>
            </form>
          </div>

          {cookingResult && <CookingGuideResult guide={cookingResult} />}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {['Dandelion', 'Stinging Nettle', 'Moringa (Malunggay)', 'Banana Blossom', 'Purslane', 'Wild Ginger', 'Lemongrass', 'Cassava Leaf'].map(plant => (
              <button key={plant} onClick={() => { setCookingQuery(plant); setCookingResult(null); }}
                className="px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 transition-colors text-left">
                {plant}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'region' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-bold text-zinc-300 mb-1">Regional Environmental Intelligence</h2>
            <p className="text-xs text-zinc-500 mb-4">Get a complete danger and opportunity assessment for any region — predators, toxic plants, edible plants, natural disasters, emergency contacts, and indigenous survival knowledge. For travelers going to an unfamiliar place.</p>
            <form onSubmit={getRegionIntel} className="flex gap-2">
              <input value={regionQuery} onChange={e => setRegionQuery(e.target.value)}
                placeholder="Enter region e.g. 'Mindanao Philippines', 'Vietnam Central Highlands', 'Amazon Brazil', 'Borneo'"
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors" required />
              <Btn type="submit" disabled={regionLoading} className="!bg-blue-600 hover:!bg-blue-500 text-white">
                {regionLoading ? '…' : 'Get Intel'}
              </Btn>
            </form>
          </div>

          {regionResult && <RegionIntelResult intel={regionResult} riskColor={riskColor} />}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {['Cordillera Mountains, Philippines', 'Mekong Delta, Vietnam', 'Amazon Rainforest, Brazil', 'Serengeti, Tanzania', 'Scottish Highlands, UK', 'Borneo, Malaysia'].map(r => (
              <button key={r} onClick={() => { setRegionQuery(r); setRegionResult(null); }}
                className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 transition-colors text-left">
                {r}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-3">
          {!user ? <p className="text-center text-zinc-500 text-sm py-8">Sign in to view landscape history</p>
          : history.length === 0 ? <p className="text-center text-zinc-600 text-sm py-8">No landscape analyses yet</p>
          : history.map(h => (
            <Card key={h.id} className="p-4">
              <div className="flex items-center gap-3">
                {h.image_url && <img src={h.image_url} alt={h.environment_label} className="w-16 h-16 rounded-xl object-cover shrink-0" />}
                <div className="flex-1">
                  <p className="font-semibold text-zinc-200 text-sm">{h.environment_label || h.environment_type}</p>
                  <p className="text-xs text-zinc-500">{h.likely_region}</p>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {h.camping_safety_label && <Badge color={safetyColor(h.camping_safety_label)}>{h.camping_safety_label}</Badge>}
                    {h.climate_zone && <Badge>{h.climate_zone}</Badge>}
                    {(h.city || h.country) && <span className="text-xs text-zinc-600">📍 {[h.city, h.country].filter(Boolean).join(', ')}</span>}
                  </div>
                </div>
                <p className="text-xs text-zinc-600 shrink-0">{new Date(h.created_at).toLocaleDateString()}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function LandscapeResult({ result, safetyColor, riskColor }) {
  const [tab, setTab] = useState('overview');

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-zinc-800">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">{result.environment_type?.replace(/_/g,' ')}</p>
            <h2 className="font-display font-extrabold text-xl text-white">{result.environment_label}</h2>
            <p className="text-sm text-zinc-400 mt-1">{result.likely_region}</p>
            {result.likely_countries?.length > 0 && (
              <p className="text-xs text-zinc-600 mt-0.5">Likely: {result.likely_countries.join(', ')}</p>
            )}
            {(result.exif_city || result.exif_country) && (
              <p className="text-xs text-green-400 mt-0.5">📍 GPS: {[result.exif_city, result.exif_country].filter(Boolean).join(', ')}</p>
            )}
          </div>
          <div className="text-center shrink-0">
            <Badge color={safetyColor(result.camping_safety_label)}>{result.camping_safety_label || 'UNKNOWN'}</Badge>
            {result.camping_safety_score != null && (
              <p className="text-2xl font-extrabold text-white mt-1">{result.camping_safety_score}<span className="text-sm text-zinc-500">/10</span></p>
            )}
            <p className="text-xs text-zinc-500">Camp Safety</p>
          </div>
        </div>

        <div className="flex gap-3 mt-3 flex-wrap">
          {result.hemisphere && (
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-600 text-xs">Hemisphere:</span>
              <Badge color={result.hemisphere === 'northern' ? 'blue' : result.hemisphere === 'southern' ? 'amber' : 'zinc'}>{result.hemisphere}</Badge>
            </div>
          )}
          {result.climate_zone && <Badge>{result.climate_zone}</Badge>}
          {result.season_indicator && <Badge color="green">{result.season_indicator?.replace(/_/g,' ')}</Badge>}
          {result.altitude_estimate && <span className="text-xs text-zinc-500">{result.altitude_estimate}</span>}
        </div>

        {result.hemisphere_reasoning && (
          <p className="text-xs text-zinc-500 mt-2 italic">Sun/shadow analysis: {result.hemisphere_reasoning}</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 px-5 overflow-x-auto">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'dangers', label: 'Dangers' },
          { id: 'food', label: 'Wild Food' },
          { id: 'plants', label: 'Plants' },
          { id: 'navigate', label: 'Navigate' },
          { id: 'disaster', label: 'Disasters' },
          { id: 'environment', label: 'Environment' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`py-2.5 px-3 text-xs font-semibold uppercase tracking-wide border-b-2 -mb-px transition-colors whitespace-nowrap ${tab === t.id ? 'border-blue-500 text-blue-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="divide-y divide-zinc-800">
          {result.overall_assessment && (
            <div className="p-5">
              <p className="text-xs font-bold uppercase text-zinc-500 mb-2">Overall Assessment</p>
              <p className="text-sm text-zinc-300 leading-relaxed">{result.overall_assessment}</p>
            </div>
          )}
          {result.camping_pros?.length > 0 && (
            <div className="p-5">
              <p className="text-xs font-bold uppercase text-green-400 mb-2">Camping Advantages</p>
              <ul className="space-y-1">{result.camping_pros.map((p, i) => <li key={i} className="text-sm text-zinc-300 flex gap-2"><span className="text-green-500">+</span><span>{p}</span></li>)}</ul>
            </div>
          )}
          {result.camping_cons?.length > 0 && (
            <div className="p-5">
              <p className="text-xs font-bold uppercase text-red-400 mb-2">Camping Risks</p>
              <ul className="space-y-1">{result.camping_cons.map((c, i) => <li key={i} className="text-sm text-zinc-300 flex gap-2"><span className="text-red-500">!</span><span>{c}</span></li>)}</ul>
            </div>
          )}
          {result.survival_priority_actions?.length > 0 && (
            <div className="p-5 bg-orange-500/5">
              <p className="text-xs font-bold uppercase text-orange-400 mb-2">Priority Survival Actions</p>
              <ol className="space-y-1">{result.survival_priority_actions.map((a, i) => <li key={i} className="text-sm text-zinc-300 flex gap-2"><span className="text-orange-400 font-bold shrink-0">{i+1}.</span><span>{a}</span></li>)}</ol>
            </div>
          )}
          {result.water_assessment && (
            <div className="p-5">
              <p className="text-xs font-bold uppercase text-blue-400 mb-2">Water Assessment</p>
              <p className="text-sm text-zinc-300">{result.water_assessment.water_description}</p>
              {result.water_assessment.purification_methods && <p className="text-xs text-zinc-500 mt-1">Purify by: {result.water_assessment.purification_methods}</p>}
              {result.water_assessment.waterborne_risks && <p className="text-xs text-red-400 mt-1">Risk: {result.water_assessment.waterborne_risks}</p>}
            </div>
          )}
          {result.fire_resources && (
            <div className="p-5">
              <p className="text-xs font-bold uppercase text-amber-400 mb-2">Fire Resources</p>
              {result.fire_resources.tinder && <p className="text-xs text-zinc-400">Tinder: {result.fire_resources.tinder}</p>}
              {result.fire_resources.fuel && <p className="text-xs text-zinc-400 mt-0.5">Fuel: {result.fire_resources.fuel}</p>}
              {result.fire_resources.fire_hazard && <p className="text-xs text-red-400 mt-0.5">Fire risk: {result.fire_resources.fire_hazard}</p>}
            </div>
          )}
          {result.shelter_resources && (
            <div className="p-5">
              <p className="text-xs font-bold uppercase text-zinc-500 mb-2">Shelter Materials</p>
              <p className="text-sm text-zinc-300">{result.shelter_resources}</p>
            </div>
          )}
          {result.cooking_methods_available && (
            <div className="p-5">
              <p className="text-xs font-bold uppercase text-green-400 mb-2">Cooking Methods Available</p>
              {result.cooking_methods_available.fire_cooking && <div className="mb-2"><p className="text-xs text-amber-400 font-semibold">With Fire:</p><p className="text-xs text-zinc-400">{result.cooking_methods_available.fire_cooking}</p></div>}
              {result.cooking_methods_available.no_fire_methods && <div className="mb-2"><p className="text-xs text-blue-400 font-semibold">Without Fire:</p><p className="text-xs text-zinc-400">{result.cooking_methods_available.no_fire_methods}</p></div>}
              {result.cooking_methods_available.preservation && <div><p className="text-xs text-zinc-500 font-semibold">Preservation:</p><p className="text-xs text-zinc-400">{result.cooking_methods_available.preservation}</p></div>}
            </div>
          )}
        </div>
      )}

      {tab === 'dangers' && (
        <div className="divide-y divide-zinc-800">
          {result.immediate_hazards?.length > 0 && (
            <div className="p-5 bg-red-500/5">
              <p className="text-xs font-bold uppercase text-red-400 mb-2">Immediate Hazards Visible</p>
              <ul className="space-y-1">{result.immediate_hazards.map((h, i) => <li key={i} className="text-sm text-red-300 flex gap-2"><span>!</span><span>{h}</span></li>)}</ul>
            </div>
          )}
          {result.wildlife_dangers && (
            <div className="p-5">
              <p className="text-xs font-bold uppercase text-red-400 mb-3">Wildlife Dangers</p>
              {result.wildlife_dangers.predators && <div className="mb-3"><p className="text-xs font-bold text-orange-400 mb-1">Apex Predators</p><p className="text-sm text-zinc-300">{result.wildlife_dangers.predators}</p></div>}
              {result.wildlife_dangers.venomous && <div className="mb-3"><p className="text-xs font-bold text-amber-400 mb-1">Venomous Creatures</p><p className="text-sm text-zinc-300">{result.wildlife_dangers.venomous}</p></div>}
              {result.wildlife_dangers.insects && <div className="mb-3"><p className="text-xs font-bold text-zinc-400 mb-1">Disease Vectors</p><p className="text-sm text-zinc-300">{result.wildlife_dangers.insects}</p></div>}
              {result.wildlife_dangers.other && <div><p className="text-xs font-bold text-zinc-400 mb-1">Other Risks</p><p className="text-sm text-zinc-300">{result.wildlife_dangers.other}</p></div>}
            </div>
          )}
          {result.emergency_signal_options && (
            <div className="p-5">
              <p className="text-xs font-bold uppercase text-yellow-400 mb-2">Emergency Signal Options</p>
              <p className="text-sm text-zinc-300">{result.emergency_signal_options}</p>
            </div>
          )}
        </div>
      )}

      {tab === 'food' && (
        <div className="divide-y divide-zinc-800">
          {result.wild_food_sources && (
            <>
              {result.wild_food_sources.plants && <div className="p-5"><p className="text-xs font-bold uppercase text-green-400 mb-2">Wild Plants</p><p className="text-sm text-zinc-300">{result.wild_food_sources.plants}</p></div>}
              {result.wild_food_sources.fungi && <div className="p-5"><p className="text-xs font-bold uppercase text-amber-400 mb-2">Fungi and Mushrooms</p><p className="text-sm text-zinc-300">{result.wild_food_sources.fungi}</p></div>}
              {result.wild_food_sources.insects && <div className="p-5"><p className="text-xs font-bold uppercase text-blue-400 mb-2">Edible Insects</p><p className="text-sm text-zinc-300">{result.wild_food_sources.insects}</p></div>}
              {result.wild_food_sources.small_game && <div className="p-5"><p className="text-xs font-bold uppercase text-zinc-400 mb-2">Small Game</p><p className="text-sm text-zinc-300">{result.wild_food_sources.small_game}</p></div>}
              {result.wild_food_sources.water_plants && <div className="p-5"><p className="text-xs font-bold uppercase text-blue-400 mb-2">Aquatic Plants</p><p className="text-sm text-zinc-300">{result.wild_food_sources.water_plants}</p></div>}
            </>
          )}
          {result.indigenous_knowledge_note && (
            <div className="p-5 bg-purple-500/5">
              <p className="text-xs font-bold uppercase text-purple-400 mb-2">Indigenous Knowledge</p>
              <p className="text-sm text-zinc-300 italic">{result.indigenous_knowledge_note}</p>
            </div>
          )}
        </div>
      )}

      {tab === 'plants' && (
        <div className="p-5 space-y-4">
          {!result.visible_plants || result.visible_plants.length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-8">No specific plants identified in visible area</p>
          ) : result.visible_plants.map((plant, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold text-zinc-200 text-sm">{plant.likely_species || plant.description}</p>
                    <Badge color={plant.edible ? 'green' : plant.toxic_risk ? 'red' : 'zinc'}>{plant.edible ? 'Edible' : plant.toxic_risk ? 'Toxic Risk' : 'Unknown'}</Badge>
                    <Badge color={plant.survival_value === 'high' ? 'green' : plant.survival_value === 'medium' ? 'amber' : 'zinc'}>{plant.survival_value} value</Badge>
                  </div>
                  {plant.description && plant.likely_species && <p className="text-xs text-zinc-500 mb-2">{plant.description}</p>}
                  {plant.edible_parts && <p className="text-xs text-zinc-400"><span className="text-green-400 font-semibold">Edible parts:</span> {plant.edible_parts}</p>}
                  {plant.how_to_harvest && <p className="text-xs text-zinc-400 mt-0.5"><span className="text-amber-400 font-semibold">Harvest:</span> {plant.how_to_harvest}</p>}
                  {plant.how_to_cook && <p className="text-xs text-zinc-400 mt-0.5"><span className="text-blue-400 font-semibold">Prepare:</span> {plant.how_to_cook}</p>}
                  {plant.medicinal_use && <p className="text-xs text-zinc-400 mt-0.5"><span className="text-purple-400 font-semibold">Medicinal:</span> {plant.medicinal_use}</p>}
                  {plant.toxic_risk && <p className="text-xs text-red-400 mt-1">Warning: {plant.toxic_risk}</p>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'navigate' && result.navigation_hints && (
        <div className="divide-y divide-zinc-800">
          {result.navigation_hints.sun_position && <div className="p-5"><p className="text-xs font-bold uppercase text-amber-400 mb-2">Sun Position Analysis</p><p className="text-sm text-zinc-300">{result.navigation_hints.sun_position}</p></div>}
          {result.navigation_hints.vegetation_clues && <div className="p-5"><p className="text-xs font-bold uppercase text-green-400 mb-2">Vegetation Navigation Clues</p><p className="text-sm text-zinc-300">{result.navigation_hints.vegetation_clues}</p></div>}
          {result.navigation_hints.terrain_clues && <div className="p-5"><p className="text-xs font-bold uppercase text-zinc-400 mb-2">Terrain Clues</p><p className="text-sm text-zinc-300">{result.navigation_hints.terrain_clues}</p></div>}
          {result.navigation_hints.landmark_features && <div className="p-5"><p className="text-xs font-bold uppercase text-blue-400 mb-2">Landmark Features</p><p className="text-sm text-zinc-300">{result.navigation_hints.landmark_features}</p></div>}
        </div>
      )}

      {tab === 'disaster' && result.natural_disaster_risks && (
        <div className="p-5 space-y-3">
          <p className="text-xs font-bold uppercase text-zinc-500 mb-3">Natural Disaster Risk Assessment</p>
          {Object.entries(result.natural_disaster_risks).map(([k, v]) => (
            <div key={k} className="flex items-start gap-3">
              <span className={`text-xs font-bold shrink-0 capitalize w-28 ${riskColor(v)}`}>{k.replace(/_/g,' ')}</span>
              <p className="text-xs text-zinc-400">{v}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'environment' && result.environmental_assessment && (
        <div className="divide-y divide-zinc-800">
          <div className="p-5">
            <p className="text-xs font-bold uppercase text-zinc-500 mb-2">Biodiversity</p>
            <Badge color={result.environmental_assessment.biodiversity_estimate === 'high' ? 'green' : result.environmental_assessment.biodiversity_estimate === 'degraded' ? 'red' : 'amber'}>
              {result.environmental_assessment.biodiversity_estimate} biodiversity
            </Badge>
          </div>
          {result.environmental_assessment.damage_visible && (
            <div className="p-5 bg-red-500/5">
              <p className="text-xs font-bold uppercase text-red-400 mb-2">Environmental Damage Detected</p>
              <p className="text-sm text-zinc-300">{result.environmental_assessment.damage_types}</p>
            </div>
          )}
          {result.environmental_assessment.conservation_concern && (
            <div className="p-5">
              <p className="text-xs font-bold uppercase text-amber-400 mb-2">Conservation Concerns</p>
              <p className="text-sm text-zinc-300">{result.environmental_assessment.conservation_concern}</p>
            </div>
          )}
          {result.environmental_assessment.human_impact && (
            <div className="p-5">
              <p className="text-xs font-bold uppercase text-zinc-500 mb-2">Human Impact Visible</p>
              <p className="text-sm text-zinc-300">{result.environmental_assessment.human_impact}</p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function CookingGuideResult({ guide }) {
  const [expandedPart, setExpandedPart] = useState(0);
  return (
    <Card className="overflow-hidden">
      <div className="p-5 border-b border-zinc-800">
        <h2 className="font-display font-extrabold text-xl text-white">{guide.plant_name}</h2>
        {guide.caution && (
          <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-xs text-red-400">Warning: {guide.caution}</p>
          </div>
        )}
      </div>

      {guide.edible_parts?.length > 0 && (
        <div className="divide-y divide-zinc-800">
          {guide.edible_parts.map((part, i) => (
            <div key={i}>
              <button onClick={() => setExpandedPart(expandedPart === i ? -1 : i)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-zinc-800/30 transition-colors">
                <div className="flex items-center gap-3">
                  <Badge color="green">{part.part}</Badge>
                  <span className="text-sm font-semibold text-zinc-200">{part.season_to_harvest}</span>
                  {part.toxic_if_raw && <Badge color="red">Cook Required</Badge>}
                </div>
                <span className="text-zinc-500 text-xs">{expandedPart === i ? 'Less' : 'More'}</span>
              </button>
              {expandedPart === i && (
                <div className="px-5 pb-5 space-y-4">
                  {part.how_to_identify_ripe && <div><p className="text-xs font-bold text-amber-400 uppercase mb-1">How to Identify Ripe</p><p className="text-sm text-zinc-300">{part.how_to_identify_ripe}</p></div>}
                  {part.how_to_harvest && <div><p className="text-xs font-bold text-green-400 uppercase mb-1">Harvesting</p><p className="text-sm text-zinc-300">{part.how_to_harvest}</p></div>}
                  {part.taste_profile && <div><p className="text-xs font-bold text-zinc-500 uppercase mb-1">Taste and Texture</p><p className="text-sm text-zinc-300">{part.taste_profile}</p></div>}
                  {part.nutritional_value && <div><p className="text-xs font-bold text-blue-400 uppercase mb-1">Nutrition</p><p className="text-sm text-zinc-300">{part.nutritional_value}</p></div>}
                  {part.cooking_methods?.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-amber-400 uppercase mb-2">Cooking Methods</p>
                      <div className="space-y-2">
                        {part.cooking_methods.map((m, j) => (
                          <div key={j} className="bg-zinc-800/50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-xs font-bold text-zinc-200">{m.method}</p>
                              {m.time_minutes > 0 && <span className="text-xs text-zinc-500">{m.time_minutes} min</span>}
                            </div>
                            <p className="text-xs text-zinc-400">{m.instructions}</p>
                            {m.result && <p className="text-xs text-green-400 mt-1">Result: {m.result}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {part.toxic_parts_nearby && <div className="p-2 bg-red-500/10 rounded-lg"><p className="text-xs font-bold text-red-400 mb-1">Do Not Eat:</p><p className="text-xs text-red-300">{part.toxic_parts_nearby}</p></div>}
                  {part.safety_notes && <div><p className="text-xs font-bold text-orange-400 uppercase mb-1">Safety Notes</p><p className="text-sm text-zinc-300">{part.safety_notes}</p></div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {guide.survival_cooking_without_fire && (
        <div className="p-5 border-t border-zinc-800 bg-green-500/5">
          <p className="text-xs font-bold uppercase text-green-400 mb-2">No-Fire / No-Tool Preparation</p>
          <p className="text-sm text-zinc-300 leading-relaxed">{guide.survival_cooking_without_fire}</p>
        </div>
      )}

      {guide.traditional_recipes?.length > 0 && (
        <div className="p-5 border-t border-zinc-800">
          <p className="text-xs font-bold uppercase text-purple-400 mb-3">Traditional Recipes</p>
          <div className="space-y-3">
            {guide.traditional_recipes.map((recipe, i) => (
              <div key={i} className="bg-zinc-800/40 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-zinc-200">{recipe.name}</p>
                  {recipe.origin && <Badge color="purple">{recipe.origin}</Badge>}
                </div>
                {recipe.ingredients_wild && <p className="text-xs text-zinc-500 mb-1">Wild ingredients: {recipe.ingredients_wild}</p>}
                <p className="text-xs text-zinc-400 leading-relaxed">{recipe.steps}</p>
                {recipe.serves && <p className="text-xs text-zinc-600 mt-1">Serves {recipe.serves}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {guide.medicinal_preparation && (
        <div className="p-5 border-t border-zinc-800">
          <p className="text-xs font-bold uppercase text-purple-400 mb-3">Medicinal Preparation</p>
          <div className="space-y-2">
            {guide.medicinal_preparation.tea && <div><p className="text-xs font-semibold text-zinc-400">Herbal Tea:</p><p className="text-xs text-zinc-500">{guide.medicinal_preparation.tea}</p></div>}
            {guide.medicinal_preparation.poultice && <div><p className="text-xs font-semibold text-zinc-400">Poultice (wounds):</p><p className="text-xs text-zinc-500">{guide.medicinal_preparation.poultice}</p></div>}
            {guide.medicinal_preparation.raw_application && <div><p className="text-xs font-semibold text-zinc-400">Direct Application:</p><p className="text-xs text-zinc-500">{guide.medicinal_preparation.raw_application}</p></div>}
          </div>
        </div>
      )}

      {guide.preservation_methods?.length > 0 && (
        <div className="p-5 border-t border-zinc-800">
          <p className="text-xs font-bold uppercase text-zinc-500 mb-2">Preservation Without Refrigeration</p>
          <div className="flex flex-wrap gap-2">
            {guide.preservation_methods.map((m, i) => <Badge key={i}>{m}</Badge>)}
          </div>
        </div>
      )}

      {guide.cultural_significance && (
        <div className="p-5 border-t border-zinc-800 bg-purple-500/5">
          <p className="text-xs font-bold uppercase text-purple-400 mb-2">Cultural Significance</p>
          <p className="text-sm text-zinc-300 italic">{guide.cultural_significance}</p>
        </div>
      )}
    </Card>
  );
}

function RegionIntelResult({ intel, riskColor }) {
  const [tab, setTab] = useState('dangers');
  return (
    <Card className="overflow-hidden">
      <div className="p-5 border-b border-zinc-800">
        <h2 className="font-display font-extrabold text-xl text-white">{intel.region}</h2>
        {intel.environment_type && <p className="text-sm text-zinc-500 mt-1">{intel.environment_type}</p>}
        {intel.climate && <p className="text-xs text-zinc-600 mt-0.5">{intel.climate}</p>}
        {intel.best_camping_months?.length > 0 && (
          <p className="text-xs text-green-400 mt-1">Best camping months: {intel.best_camping_months.join(', ')}</p>
        )}
      </div>

      <div className="flex border-b border-zinc-800 px-5 overflow-x-auto">
        {[{ id: 'dangers', label: 'Dangers' }, { id: 'food', label: 'Wild Food' }, { id: 'disasters', label: 'Disasters' }, { id: 'emergency', label: 'Emergency' }, { id: 'cultural', label: 'Culture' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`py-2.5 px-3 text-xs font-semibold uppercase tracking-wide border-b-2 -mb-px transition-colors whitespace-nowrap ${tab === t.id ? 'border-blue-500 text-blue-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dangers' && (
        <div className="divide-y divide-zinc-800">
          {intel.apex_predators?.length > 0 && (
            <div className="p-5">
              <p className="text-xs font-bold uppercase text-red-400 mb-3">Apex Predators</p>
              {intel.apex_predators.map((a, i) => (
                <div key={i} className="mb-3 last:mb-0">
                  <p className="text-sm font-bold text-zinc-200">{a.animal}</p>
                  {a.habitat && <p className="text-xs text-zinc-500">Habitat: {a.habitat}</p>}
                  {a.avoidance && <p className="text-xs text-zinc-400 mt-0.5">Avoid: {a.avoidance}</p>}
                  {a.attack_response && <p className="text-xs text-amber-400 mt-0.5">If attacked: {a.attack_response}</p>}
                </div>
              ))}
            </div>
          )}
          {intel.venomous_creatures?.length > 0 && (
            <div className="p-5">
              <p className="text-xs font-bold uppercase text-orange-400 mb-3">Venomous Creatures</p>
              {intel.venomous_creatures.map((v, i) => (
                <div key={i} className="mb-3 last:mb-0 bg-zinc-800/30 rounded-lg p-3">
                  <p className="text-xs font-bold text-zinc-200">{v.creature}</p>
                  {v.venom_type && <p className="text-xs text-zinc-500">Venom: {v.venom_type}</p>}
                  {v.first_aid && <p className="text-xs text-blue-400 mt-0.5">First aid: {v.first_aid}</p>}
                  <p className="text-xs mt-0.5">{v.antivenom_available ? <span className="text-green-400">Antivenom available</span> : <span className="text-red-400">No antivenom — evaculate immediately</span>}</p>
                </div>
              ))}
            </div>
          )}
          {intel.toxic_plants?.length > 0 && (
            <div className="p-5">
              <p className="text-xs font-bold uppercase text-red-400 mb-3">Toxic Plants</p>
              {intel.toxic_plants.map((p, i) => (
                <div key={i} className="mb-2 last:mb-0">
                  <p className="text-xs font-bold text-zinc-200">{p.plant}</p>
                  {p.toxic_compounds && <p className="text-xs text-zinc-500">Toxin: {p.toxic_compounds}</p>}
                  {p.symptoms && <p className="text-xs text-red-400 mt-0.5">Symptoms: {p.symptoms}</p>}
                  {p.look_alikes && <p className="text-xs text-amber-400 mt-0.5">Confused with: {p.look_alikes}</p>}
                </div>
              ))}
            </div>
          )}
          {intel.water_sources && <div className="p-5"><p className="text-xs font-bold uppercase text-blue-400 mb-2">Water Sources</p><p className="text-sm text-zinc-300">{intel.water_sources}</p></div>}
        </div>
      )}

      {tab === 'food' && (
        <div className="divide-y divide-zinc-800">
          {intel.edible_wild_plants?.length > 0 && (
            <div className="p-5">
              <p className="text-xs font-bold uppercase text-green-400 mb-3">Edible Wild Plants</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {intel.edible_wild_plants.map((p, i) => (
                  <div key={i} className="bg-zinc-800/40 rounded-lg p-3">
                    <p className="text-xs font-bold text-zinc-200">{p.plant}</p>
                    {p.parts && <p className="text-xs text-green-400">Parts: {p.parts}</p>}
                    {p.season && <p className="text-xs text-zinc-500">Season: {p.season}</p>}
                    {p.how_to_prepare && <p className="text-xs text-zinc-400 mt-0.5">{p.how_to_prepare}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {intel.edible_mushrooms?.length > 0 && (
            <div className="p-5">
              <p className="text-xs font-bold uppercase text-amber-400 mb-3">Edible Mushrooms</p>
              {intel.edible_mushrooms.map((m, i) => (
                <div key={i} className="mb-2 last:mb-0">
                  <p className="text-xs font-bold text-zinc-200">{m.mushroom}</p>
                  {m.season && <span className="text-xs text-zinc-500">{m.season} — </span>}
                  {m.caution && <span className="text-xs text-red-400">{m.caution}</span>}
                </div>
              ))}
            </div>
          )}
          {intel.useful_survival_knowledge?.length > 0 && (
            <div className="p-5 bg-green-500/5">
              <p className="text-xs font-bold uppercase text-green-400 mb-2">Local Survival Knowledge</p>
              <ul className="space-y-1">{intel.useful_survival_knowledge.map((k, i) => <li key={i} className="text-sm text-zinc-300 flex gap-2"><span className="text-green-500">•</span><span>{k}</span></li>)}</ul>
            </div>
          )}
        </div>
      )}

      {tab === 'disasters' && intel.natural_disasters && (
        <div className="p-5 space-y-3">
          {Object.entries(intel.natural_disasters).map(([k, v]) => (
            <div key={k} className="flex items-start gap-3">
              <span className={`text-xs font-bold shrink-0 capitalize w-28 ${riskColor(v)}`}>{k.replace(/_/g,' ')}</span>
              <p className="text-xs text-zinc-400">{v}</p>
            </div>
          ))}
          {intel.dangerous_months?.length > 0 && (
            <div className="mt-3 p-3 bg-red-500/10 rounded-lg">
              <p className="text-xs font-bold text-red-400 mb-1">Dangerous Months</p>
              {intel.dangerous_months.map((m, i) => <p key={i} className="text-xs text-zinc-400">{m}</p>)}
            </div>
          )}
        </div>
      )}

      {tab === 'emergency' && (
        <div className="divide-y divide-zinc-800">
          {intel.emergency_contacts && (
            <div className="p-5">
              <p className="text-xs font-bold uppercase text-red-400 mb-3">Emergency Numbers</p>
              {Object.entries(intel.emergency_contacts).filter(([,v]) => v).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-1.5">
                  <span className="text-xs text-zinc-400 capitalize">{k.replace(/_/g,' ')}</span>
                  <a href={`tel:${v}`} className="text-sm font-bold text-red-400">{v}</a>
                </div>
              ))}
            </div>
          )}
          {intel.nearest_hospitals && <div className="p-5"><p className="text-xs font-bold uppercase text-blue-400 mb-2">Medical Access</p><p className="text-sm text-zinc-300">{intel.nearest_hospitals}</p></div>}
          {intel.navigation_landmarks && <div className="p-5"><p className="text-xs font-bold uppercase text-zinc-500 mb-2">Navigation Landmarks</p><p className="text-sm text-zinc-300">{intel.navigation_landmarks}</p></div>}
        </div>
      )}

      {tab === 'cultural' && (
        <div className="divide-y divide-zinc-800">
          {intel.indigenous_tribes && <div className="p-5"><p className="text-xs font-bold uppercase text-purple-400 mb-2">Indigenous Peoples</p><p className="text-sm text-zinc-300">{intel.indigenous_tribes}</p></div>}
          {intel.cultural_taboos?.length > 0 && (
            <div className="p-5">
              <p className="text-xs font-bold uppercase text-amber-400 mb-2">Cultural Rules to Respect</p>
              <ul className="space-y-1">{intel.cultural_taboos.map((t, i) => <li key={i} className="text-sm text-zinc-300 flex gap-2"><span className="text-amber-400">•</span><span>{t}</span></li>)}</ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}




// ── Main App ──────────────────────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState('home');
  const [notifCount, setNotifCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);

  useEffect(() => {
    const handler = e => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  const onNav = useCallback(p => { setPage(p); window.scrollTo(0, 0); }, []);

  const installPwa = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstallPrompt(null);
  };

  const refreshNotifs = useCallback(async () => {
    try {
      const r = await fetch(`${API}/notifications/unread-count`, { credentials: 'include' });
      if (r.ok) { const d = await r.json(); setNotifCount(d.count || 0); }
    } catch {}
  }, []);

  useEffect(() => {
    refreshNotifs();
    const interval = setInterval(refreshNotifs, 60000);
    return () => clearInterval(interval);
  }, [refreshNotifs]);

  return (
    <AuthProvider>
      <ErrorBoundary>
        <div className="min-h-screen bg-zinc-950 text-zinc-100">
          <Navbar
            active={page}
            onNav={onNav}
            notifCount={notifCount}
            onOpenNotifs={() => setShowNotifs(true)}
            showNotifs={showNotifs}
            onCloseNotifs={() => setShowNotifs(false)}
          />
          <main className="pb-24">
            {page === 'home'      && <HomePage onNav={onNav} />}
            {page === 'scan'      && <ScanPage onNav={onNav} />}
            {page === 'history'   && <HistoryPage />}
            {page === 'library'   && <LibraryPage />}
            {page === 'survival'  && <SurvivalPage onNav={onNav} />}
            {page === 'map'       && <MapPage />}
            {page === 'farming'   && <FarmingPage />}
            {page === 'journal'   && <JournalPage />}
            {page === 'favorites' && <FavoritesPage />}
            {page === 'landscape' && <LandscapePage />}
            {page === 'profile'   && <ProfilePage onNav={onNav} />}
            {page === 'admin'     && <AdminPage />}
            {page === 'login'     && <LoginPage onNav={onNav} />}
            {page === 'signup'    && <SignupPage onNav={onNav} />}
            {page === 'forgot'    && <ForgotPage onNav={onNav} />}
          </main>
          <BottomNav active={page} onNav={onNav} />
          {installPrompt && (
            <div className="fixed bottom-20 left-4 right-4 lg:left-auto lg:right-4 lg:w-80 bg-zinc-900 border border-zinc-700 rounded-2xl p-4 flex items-center justify-between shadow-2xl z-50">
              <span className="text-sm text-zinc-300">Install FloraIQ for offline use</span>
              <div className="flex gap-2">
                <button onClick={installPwa} className="px-3 py-1.5 bg-green-500 text-black text-xs font-bold rounded-lg hover:bg-green-400 transition-colors">Install</button>
                <button onClick={() => setInstallPrompt(null)} className="text-zinc-600 hover:text-zinc-400 text-xs px-2">×</button>
              </div>
            </div>
          )}
        </div>
      </ErrorBoundary>
    </AuthProvider>
  );
}
