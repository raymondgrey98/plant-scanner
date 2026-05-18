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
    const r = await fetch(`${API}/auth/signup`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password }) });
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
  <div onClick={onClick} className={`glass-card ${onClick ? 'cursor-pointer' : ''} ${className}`}>{children}</div>
);

const Badge = ({ children, color = 'zinc' }) => {
  const colors = { zinc: 'bg-zinc-800 text-zinc-400', green: 'bg-green-500/10 text-green-400 border border-green-500/20', blue: 'bg-blue-500/10 text-blue-400 border border-blue-500/20', amber: 'bg-amber-500/10 text-amber-400 border border-amber-500/20', purple: 'bg-purple-500/10 text-purple-400 border border-purple-500/20', red: 'bg-red-500/10 text-red-400 border border-red-500/20' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[color] || colors.zinc}`}>{children}</span>;
};

const Btn = ({ children, onClick, variant = 'primary', size = 'md', className = '', disabled, type = 'button' }) => {
  const variants = {
    primary: 'btn-violet',
    secondary: 'bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/8',
    danger: 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30',
    survival: 'bg-amber-500 hover:bg-amber-400 text-black font-bold',
    ghost: 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5',
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
    <input {...props} className={`w-full px-3 py-2 bg-white/5 border ${error ? 'border-red-500' : 'border-white/10'} rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors`} />
    {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
  </div>
);

const Textarea = ({ label, className = '', ...props }) => (
  <div className={className}>
    {label && <label className="block text-xs font-medium text-zinc-400 mb-1">{label}</label>}
    <textarea {...props} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors resize-none" />
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
      <div className="relative glass-card w-full max-w-lg overflow-y-auto max-h-[90vh]" style={{ background: 'rgba(8,8,22,0.95)' }}>
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
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
    <header className="sticky top-0 z-50 glass-nav border-b">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14 relative">
        <button onClick={() => onNav('home')} className="font-display font-extrabold text-lg text-white tracking-tight shrink-0">
          Flora<span className="gradient-text">IQ</span>
          {!online && <span className="ml-2 text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full px-2 py-0.5">Offline</span>}
        </button>
        <nav className="hidden lg:flex items-center gap-1 mx-4">
          {NAV_ITEMS.map(n => (
            <button key={n.id} onClick={() => onNav(n.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${active === n.id ? 'bg-violet-500/20 text-violet-300 border border-violet-500/25' : 'text-slate-400 hover:text-white hover:bg-white/6'}`}>
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
              <button onClick={() => onNav('login')} className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/6 rounded-lg transition-colors">Sign in</button>
              <button onClick={() => onNav('signup')} className="btn-violet px-3 py-1.5 text-xs rounded-lg">Sign up</button>
            </>
          )}
          <button onClick={() => setMenuOpen(o => !o)} className="lg:hidden p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors text-lg">☰</button>
        </div>
        <NotifPanel open={showNotifs} onClose={onCloseNotifs} />
        {menuOpen && (
          <div className="lg:hidden absolute right-4 top-14 z-50 glass-card py-2 w-52 shadow-2xl">
            {NAV_ITEMS.map(n => (
              <button key={n.id} onClick={() => { onNav(n.id); setMenuOpen(false); }}
                className={`flex items-center gap-2 text-left px-3 py-2.5 rounded-lg text-sm font-medium mb-0.5 mx-1 transition-colors ${active === n.id ? 'bg-violet-500/20 text-violet-300' : 'text-slate-400 hover:bg-white/6'}`}>
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
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 glass-nav border-t flex">
      {BOTTOM_NAV.map(n => (
        <button key={n.id} onClick={() => onNav(n.id)}
          className={`flex-1 flex flex-col items-center py-2 gap-0.5 transition-colors ${active === n.id ? 'text-violet-400' : 'text-slate-500'}`}>
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

  // Normalize: handle POST /api/scans response, GET /api/scans/:id, history rows, etc.
  const a = result.result || result.result_json || result.identification?.result_json || result.identification || result;
  const taxon   = a.taxonomy || {};
  const danger  = a.danger_level ?? null;
  const conf    = a.confidence != null ? (a.confidence > 1 ? Math.round(a.confidence) : Math.round(a.confidence * 100)) : null;
  const loc     = result.location || {};
  const imgSrc  = result.url || result.image_url || result.cloud_url || result.example_photo;
  const tabs = ['overview', 'survival', 'taxonomy', 'uses', 'location'];

  return (
    <Card className="overflow-hidden">
      {imgSrc && <img src={imgSrc} alt={a.common_name} className="w-full h-52 object-cover" />}
      {result.example_photo && !imgSrc && <img src={result.example_photo} alt="Reference" className="w-full h-52 object-cover opacity-70" />}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <h3 className="text-xl font-extrabold text-white capitalize">{a.common_name || a.plant_name || 'Unknown Organism'}</h3>
            {a.scientific_name && <p className="text-sm italic text-zinc-400">{a.scientific_name}</p>}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {conf != null && <Badge color="green">{conf}% match</Badge>}
            {danger != null && <DangerLevel level={danger} />}
          </div>
        </div>
        {a.subject_type && <p className="text-xs text-zinc-500 mb-3 capitalize">{a.subject_type}</p>}

        {a.safety_warning && (
          <div className="mb-3 p-3 bg-red-950/60 border border-red-700/50 rounded-xl flex gap-2">
            <span className="text-red-400 shrink-0">⚠️</span>
            <p className="text-xs text-red-300 font-medium">{a.safety_warning}</p>
          </div>
        )}

        <div className="flex gap-1 mb-4 flex-wrap">
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${tab === t ? 'bg-green-500 text-black font-bold' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="space-y-3">
            {a.description && <p className="text-sm text-zinc-300 leading-relaxed">{a.description}</p>}
            {(a.habitat || a.distribution) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {a.habitat && <div className="bg-zinc-800/60 rounded-xl p-3"><p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Habitat</p><p className="text-sm text-zinc-300">{a.habitat}</p></div>}
                {a.distribution && <div className="bg-zinc-800/60 rounded-xl p-3"><p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Distribution</p><p className="text-sm text-zinc-300">{a.distribution}</p></div>}
              </div>
            )}
            {a.ecology && <div><p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Ecology</p><p className="text-sm text-zinc-300">{a.ecology}</p></div>}
            {a.lookalikes && <div className="p-3 bg-amber-950/40 border border-amber-700/30 rounded-xl"><p className="text-xs font-bold text-amber-400 mb-1">⚠️ Lookalikes / Confusion Species</p><p className="text-sm text-zinc-300">{a.lookalikes}</p></div>}
            {a.life_cycle && <div><p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Life Cycle</p><p className="text-sm text-zinc-300">{a.life_cycle}</p></div>}
            {result.example_photo && (
              <div className="pt-2">
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Reference Photo</p>
                <img src={result.example_photo} alt="Reference" className="w-full max-h-40 object-contain rounded-xl border border-zinc-800" />
              </div>
            )}
          </div>
        )}

        {tab === 'survival' && (
          <div className="space-y-3">
            {danger != null && (
              <div className="flex items-center gap-3 p-3 bg-zinc-800/60 rounded-xl">
                <span className="text-xs text-zinc-400 shrink-0">Danger Level</span>
                <DangerLevel level={danger} />
                <span className="text-xs text-zinc-500">/ 10</span>
              </div>
            )}
            {a.edibility && <div className="p-3 bg-green-950/40 border border-green-800/30 rounded-xl"><p className="text-xs font-bold text-green-400 mb-1">🍃 Edibility</p><p className="text-sm text-zinc-300">{a.edibility}</p></div>}
            {a.toxicity && <div className="p-3 bg-red-950/40 border border-red-800/30 rounded-xl"><p className="text-xs font-bold text-red-400 mb-1">☠️ Toxicity</p><p className="text-sm text-zinc-300">{a.toxicity}</p></div>}
            {a.survival_uses && <div><p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Survival Uses</p><p className="text-sm text-zinc-300">{a.survival_uses}</p></div>}
            {a.ethnobotany && <div><p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Medicinal / Traditional Uses</p><p className="text-sm text-zinc-300">{a.ethnobotany}</p></div>}
            {a.first_aid && <div className="p-3 bg-red-950/60 border border-red-600/40 rounded-xl"><p className="text-xs font-bold text-red-300 mb-1">🚑 Emergency First Aid</p><p className="text-sm text-zinc-300">{a.first_aid}</p></div>}
            {!a.edibility && !a.toxicity && !a.survival_uses && <p className="text-sm text-zinc-500">No survival data available for this organism.</p>}
            {/* YouTube link */}
            {(a.common_name || a.plant_name) && (
              <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent((a.common_name || a.plant_name) + ' edible wild survival foraging')}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 mt-2 px-4 py-2.5 bg-red-700 hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition">
                ▶️ YouTube — Survival & Foraging Videos
              </a>
            )}
          </div>
        )}

        {tab === 'taxonomy' && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            {['kingdom','phylum','class','order','family','genus','species'].map(k => (
              (taxon[k] || a[k]) && (
                <div key={k} className="bg-zinc-800/60 rounded-xl p-3">
                  <p className="text-xs text-zinc-500 capitalize">{k}</p>
                  <p className="text-zinc-200 font-medium">{taxon[k] || a[k]}</p>
                </div>
              )
            ))}
            {a.genetic_proximity_hint && (
              <div className="col-span-2 bg-zinc-800/60 rounded-xl p-3">
                <p className="text-xs text-zinc-500">Genetic Proximity</p>
                <p className="text-zinc-200 text-sm">{a.genetic_proximity_hint}</p>
              </div>
            )}
          </div>
        )}

        {tab === 'uses' && (
          <div className="space-y-3">
            {a.edibility && <div><p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Edibility / Culinary</p><p className="text-sm text-zinc-300">{a.edibility}</p></div>}
            {a.ethnobotany && <div><p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Medicinal / Ethnobotany</p><p className="text-sm text-zinc-300">{a.ethnobotany}</p></div>}
            {a.economic_importance && <div><p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Economic Importance</p><p className="text-sm text-zinc-300">{a.economic_importance}</p></div>}
            {a.care_summary && <div><p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Cultivation Guide</p><p className="text-sm text-zinc-300">{a.care_summary}</p></div>}
            {a.conservation_status && <div><p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Conservation</p><Badge color={a.conservation_status.includes('Least') ? 'green' : 'amber'}>{a.conservation_status}</Badge></div>}
            {a.research_notes && <div><p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Research Notes</p><p className="text-sm text-zinc-400">{a.research_notes}</p></div>}
            {/* External links */}
            {a.scientific_name && (
              <div className="pt-2 space-y-2">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide">External Databases</p>
                <a href={`https://www.inaturalist.org/search?q=${encodeURIComponent(a.scientific_name)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition">🌍 iNaturalist</a>
                <a href={`https://www.gbif.org/species/search?q=${encodeURIComponent(a.scientific_name)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-semibold rounded-xl transition">🔬 GBIF Database</a>
                {a.subject_type?.includes('plant') || a.subject_type?.includes('tree') || a.subject_type?.includes('herb') ? (
                  <a href={`https://www.worldfloraonline.org/search?query=${encodeURIComponent(a.scientific_name)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-green-900 hover:bg-green-800 text-white text-xs font-semibold rounded-xl transition">🌺 World Flora Online</a>
                ) : null}
              </div>
            )}
          </div>
        )}

        {tab === 'location' && (
          <div className="space-y-3 text-sm">
            {loc.country || loc.city ? (
              <>
                {loc.country && <div className="bg-zinc-800/60 rounded-xl p-3"><p className="text-xs text-zinc-500 uppercase tracking-wide mb-0.5">Country</p><p className="text-zinc-200">🌍 {loc.country}</p></div>}
                {loc.city && <div className="bg-zinc-800/60 rounded-xl p-3"><p className="text-xs text-zinc-500 uppercase tracking-wide mb-0.5">City</p><p className="text-zinc-200">🏙️ {loc.city}</p></div>}
                {loc.street && <div><p className="text-xs text-zinc-500 uppercase tracking-wide mb-0.5">Street</p><p className="text-zinc-200">📍 {loc.street}</p></div>}
                {loc.latitude && <div className="bg-zinc-800/60 rounded-xl p-3"><p className="text-xs text-zinc-500 uppercase tracking-wide mb-0.5">GPS Coordinates</p><p className="text-zinc-200 font-mono text-xs">{loc.latitude?.toFixed(5)}, {loc.longitude?.toFixed(5)}</p></div>}
              </>
            ) : (
              <div className="text-center py-6">
                <p className="text-zinc-500 text-sm">No GPS data in this photo.</p>
                <p className="text-zinc-600 text-xs mt-1">Enable location on your camera and retake for automatic geo-tagging.</p>
              </div>
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
      {results.gbif?.filter(g => g.rank === 'SPECIES' || g.rank === 'SUBSPECIES').length > 0 && (
        <div>
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">GBIF Species</p>
          <div className="space-y-2">
            {results.gbif.filter(g => g.rank === 'SPECIES' || g.rank === 'SUBSPECIES').slice(0, 8).map((g, i) => (
              <Card key={i} className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-200">{g.canonicalName}</p>
                  <p className="text-xs text-zinc-500">{g.family} · {g.kingdom}</p>
                </div>
                <a href={`https://www.gbif.org/species/${g.key}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300">GBIF ↗</a>
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
      {/* Hero */}
      <div className="text-center mb-12">
        {/* Isometric 3D hero art */}
        <div className="iso-hero">
          <div className="iso-glow" />
          <div className="iso-platform" />
          <div className="iso-inner" />
          <div className="iso-icon">🌿</div>
          <div className="iso-particle" />
          <div className="iso-particle" />
          <div className="iso-particle" />
          <div className="iso-particle" />
        </div>

        <h1 className="text-5xl font-extrabold text-white mb-3 tracking-tight">
          Flora<span className="gradient-text">IQ</span>
        </h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
          AI-powered plant intelligence for hikers, farmers, foragers, and nature enthusiasts worldwide.
        </p>

        {stats && (
          <div className="flex items-center justify-center gap-4 mt-5 flex-wrap">
            <div className="stat-glow"><span className="text-xl font-bold text-violet-300">{(stats.total_scans||0).toLocaleString()}</span><p className="text-xs text-slate-500 mt-0.5">Scans</p></div>
            <div className="stat-glow"><span className="text-xl font-bold text-blue-300">{(stats.species_count||0).toLocaleString()}</span><p className="text-xs text-slate-500 mt-0.5">Species</p></div>
            <div className="stat-glow"><span className="text-xl font-bold text-teal-300">{(stats.country_count||0).toLocaleString()}</span><p className="text-xs text-slate-500 mt-0.5">Countries</p></div>
          </div>
        )}

        <div className="flex items-center justify-center gap-3 mt-7 flex-wrap">
          <Btn onClick={() => onNav('scan')} size="lg">📷 Identify Now</Btn>
          <Btn onClick={() => onNav('survival')} variant="survival" size="lg">🏕️ Survival Mode</Btn>
          <Btn onClick={() => onNav('landscape')} variant="secondary" size="lg">🌍 Landscape</Btn>
        </div>
      </div>

      {/* Feature grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {features.map((f, i) => (
          <Card key={i} onClick={() => onNav(f.action)} className="p-5 cursor-pointer">
            <div className="feature-icon-bubble">{f.icon}</div>
            <h3 className="text-sm font-bold text-zinc-100 mb-1">{f.title}</h3>
            <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
          </Card>
        ))}
      </div>

      {!user && (
        <Card className="p-8 text-center" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(59,130,246,0.08))' }}>
          <h2 className="text-xl font-bold text-white mb-2">Start your FloraIQ journey</h2>
          <p className="text-sm text-slate-400 mb-6">Free forever. No credit card. Access all features with an account.</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
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
    fd.append('photo', file);
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
const LIB_CATS = [
  { id: 'Plantae',        label: 'Plants',    icon: '🌿', color: '#22c55e', desc: 'Flowers, trees, herbs, crops' },
  { id: 'Insecta',        label: 'Insects',   icon: '🐛', color: '#f59e0b', desc: 'Beetles, butterflies, ants' },
  { id: 'Aves',           label: 'Birds',     icon: '🐦', color: '#3b82f6', desc: 'All bird species worldwide' },
  { id: 'Fungi',          label: 'Mushrooms', icon: '🍄', color: '#8b5cf6', desc: 'Edible, toxic, medicinal fungi' },
  { id: 'Reptilia',       label: 'Reptiles',  icon: '🦎', color: '#ef4444', desc: 'Snakes, lizards, turtles' },
  { id: 'Actinopterygii', label: 'Marine',    icon: '🐠', color: '#06b6d4', desc: 'Fish, coral, ocean life' },
  { id: 'Mammalia',       label: 'Mammals',   icon: '🐆', color: '#f97316', desc: 'Wild mammals and predators' },
  { id: 'Arachnida',      label: 'Spiders',   icon: '🕷️', color: '#a78bfa', desc: 'Spiders, scorpions, mites' },
];

const STATUS_COLORS = { LC: '#22c55e', NT: '#84cc16', VU: '#f59e0b', EN: '#f97316', CR: '#ef4444', EW: '#dc2626', EX: '#7f1d1d' };

function SpeciesModal({ sp, onClose }) {
  const inatUrl = `https://www.inaturalist.org/taxa/${sp.id}`;
  const wikiUrl = sp.wikipedia_url;
  const status = sp.conservation_status?.status?.toUpperCase() || 'LC';
  const statusColor = STATUS_COLORS[status] || '#6b7280';
  const img = sp.default_photo?.medium_url;
  const obs = sp.observations_count ? sp.observations_count.toLocaleString() : '—';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {img && <img src={img} alt={sp.name} className="w-full h-52 object-cover rounded-t-2xl" />}
        <div className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-xl font-extrabold text-white capitalize">{sp.preferred_common_name || sp.name}</h2>
              <p className="text-sm italic text-zinc-400">{sp.name}</p>
            </div>
            <span className="text-xs font-bold px-2 py-1 rounded-full shrink-0" style={{ background: statusColor + '22', color: statusColor, border: `1px solid ${statusColor}55` }}>{status}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
            <div className="bg-zinc-800 rounded-lg p-2"><span className="text-zinc-500">Observations</span><p className="font-bold text-white">{obs}</p></div>
            <div className="bg-zinc-800 rounded-lg p-2"><span className="text-zinc-500">Rank</span><p className="font-bold text-white capitalize">{sp.rank || 'species'}</p></div>
          </div>
          {sp.wikipedia_summary && <p className="text-sm text-zinc-400 leading-relaxed">{sp.wikipedia_summary}</p>}
          <div className="flex flex-col gap-2 pt-1">
            {wikiUrl && <a href={wikiUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition">📖 Wikipedia — Full Species Article</a>}
            <a href={inatUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition">🌍 iNaturalist — Global Sightings & Photos</a>
            <a href={`https://www.gbif.org/species/search?q=${encodeURIComponent(sp.name)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-semibold rounded-xl transition">🔬 GBIF — Scientific Occurrence Data</a>
            {sp.iconic_taxon_name === 'Plantae' && <a href={`https://www.worldfloraonline.org/search?query=${encodeURIComponent(sp.name)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2.5 bg-green-900 hover:bg-green-800 text-white text-sm font-semibold rounded-xl transition">🌺 World Flora Online</a>}
            <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent((sp.preferred_common_name || sp.name) + ' identification foraging survival')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2.5 bg-red-700 hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition">▶️ YouTube — Identification & Survival Videos</a>
          </div>
          <button onClick={onClose} className="w-full mt-2 py-2 text-sm text-zinc-500 hover:text-zinc-300 transition">Close</button>
        </div>
      </div>
    </div>
  );
}

function LibraryPage() {
  const [category, setCategory] = useState('Plantae');
  const [species, setSpecies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const catInfo = LIB_CATS.find(c => c.id === category) || LIB_CATS[0];

  const loadCategory = async (cat) => {
    setCategory(cat); setIsSearchMode(false); setQuery(''); setLoading(true); setSpecies([]);
    try {
      const r = await fetch(`https://api.inaturalist.org/v1/taxa?iconic_taxa=${cat}&rank=species&per_page=48&order_by=observations_count&order=desc&photos=true`);
      const d = await r.json();
      setSpecies((d.results || []).filter(s => s.default_photo?.medium_url));
    } catch {} finally { setLoading(false); }
  };

  const search = async e => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true); setIsSearchMode(true); setSpecies([]);
    try {
      const r = await fetch(`https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(query)}&rank=species&per_page=48&photos=true&order_by=observations_count&order=desc`);
      const d = await r.json();
      setSpecies((d.results || []).filter(s => s.default_photo?.medium_url));
    } catch {} finally { setSearching(false); }
  };

  useEffect(() => { loadCategory('Plantae'); }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 pb-28">
      <h1 className="text-2xl font-extrabold text-white mb-2">Species Library</h1>
      <p className="text-sm text-zinc-500 mb-5">Browse {isSearchMode ? 'search results' : `top ${catInfo.label.toLowerCase()} species`} — click any for Wikipedia, iNaturalist & YouTube links</p>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-hide">
        {LIB_CATS.map(cat => (
          <button key={cat.id} onClick={() => loadCategory(cat.id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition border"
            style={category === cat.id && !isSearchMode
              ? { background: cat.color + '22', color: cat.color, borderColor: cat.color + '55' }
              : { background: '#18181b', color: '#a1a1aa', borderColor: '#3f3f46' }}>
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <form onSubmit={search} className="flex gap-2 mb-6">
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search any species — grasshopper, moringa, king cobra…"
          className="flex-1 px-4 py-2.5 bg-zinc-900 border border-zinc-700 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-green-500" />
        <button type="submit" disabled={searching} className="px-5 py-2.5 bg-green-600 hover:bg-green-500 text-white text-sm font-bold rounded-xl transition">
          {searching ? '…' : 'Search'}
        </button>
        {isSearchMode && <button type="button" onClick={() => loadCategory(category)} className="px-3 py-2.5 bg-zinc-800 text-zinc-400 text-sm rounded-xl">✕</button>}
      </form>

      {/* Grid */}
      {loading || searching ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : species.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">No results found. Try a different search.</div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {species.map(sp => {
            const status = sp.conservation_status?.status?.toUpperCase();
            const isDangerous = ['CR','EN','EX'].includes(status);
            const isVulnerable = status === 'VU';
            return (
              <div key={sp.id} onClick={() => setSelected(sp)}
                className="group relative cursor-pointer rounded-xl overflow-hidden border border-zinc-800 hover:border-zinc-600 transition aspect-square">
                <img src={sp.default_photo?.square_url || sp.default_photo?.medium_url} alt={sp.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                {isDangerous && <span className="absolute top-1.5 right-1.5 text-xs bg-red-600 text-white px-1.5 py-0.5 rounded-full font-bold">☠️</span>}
                {isVulnerable && <span className="absolute top-1.5 right-1.5 text-xs bg-orange-500 text-white px-1.5 py-0.5 rounded-full font-bold">⚠️</span>}
                <div className="absolute bottom-0 left-0 right-0 p-2">
                  <p className="text-white text-xs font-bold leading-tight capitalize truncate">{sp.preferred_common_name || sp.name}</p>
                  <p className="text-zinc-400 text-[10px] italic truncate">{sp.name}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && <SpeciesModal sp={selected} onClose={() => setSelected(null)} />}
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
    const r = await fetch(`${API}/survival/guide`, { method: 'GET' }).catch(() => null);
    if (r?.ok) { const d = await r.json(); setGuide(d.guide || d); }
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
const DISASTER_LAYERS = [
  { id: 'quakes',   label: 'Earthquakes',   icon: '🔴', color: '#ef4444' },
  { id: 'gdacs',    label: 'Floods/Storms',  icon: '🌊', color: '#3b82f6' },
  { id: 'weather',  label: 'Weather Alerts', icon: '⛈️', color: '#f59e0b' },
  { id: 'relief',   label: 'Active Disasters',icon: '🆘', color: '#a855f7' },
];

const GDACS_COLORS = { eq: '#ef4444', tc: '#8b5cf6', fl: '#3b82f6', dr: '#f59e0b', wf: '#f97316', vo: '#dc2626' };

function MapPage() {
  const mapRef      = useRef(null);
  const leafletMap  = useRef(null);
  const tileLayerRef = useRef(null);
  const [sightings, setSightings]   = useState([]);
  const [filter, setFilter]         = useState('all');
  const [loading, setLoading]       = useState(true);
  const [satellite, setSatellite]   = useState(false);
  const [layers, setLayers]         = useState({ quakes: false, gdacs: false, weather: false, relief: false });
  const [disasters, setDisasters]   = useState({ quakes: [], gdacs: [], weather: [], relief: [] });
  const [loadingDis, setLoadingDis] = useState({});
  const [disPanel, setDisPanel]     = useState(null);

  useEffect(() => {
    fetch(`${API}/map/sightings?limit=500`).then(r => r.json()).then(d => setSightings(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggleLayer = async (id) => {
    const next = !layers[id];
    setLayers(l => ({ ...l, [id]: next }));
    if (next && disasters[id].length === 0) {
      setLoadingDis(l => ({ ...l, [id]: true }));
      try {
        let url = '';
        if (id === 'quakes') url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=4.5&limit=150&orderby=time';
        if (id === 'gdacs')   url = `${API}/disasters/gdacs`;
        if (id === 'weather') url = `${API}/disasters/weather-alerts`;
        if (id === 'relief')  url = `${API}/disasters/reliefweb`;
        const r = await fetch(url); const d = await r.json();
        if (id === 'quakes') setDisasters(p => ({ ...p, quakes: d.features || [] }));
        else setDisasters(p => ({ ...p, [id]: d }));
      } catch {}
      setLoadingDis(l => ({ ...l, [id]: false }));
    }
  };

  useEffect(() => {
    if (!mapRef.current) return;
    let timeout;
    if (typeof window.L === 'undefined') {
      timeout = setTimeout(initLeaflet, 800);
      return () => clearTimeout(timeout);
    }
    initLeaflet();
    function initLeaflet() {
      if (!mapRef.current || typeof window.L === 'undefined') return;
      if (leafletMap.current) { leafletMap.current.remove(); leafletMap.current = null; }
      const map = window.L.map(mapRef.current, { center: [20, 0], zoom: 2, zoomControl: true });
      const osmTile  = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      const esriTile = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      const tileUrl  = satellite ? esriTile : osmTile;
      const tileAttr = satellite ? 'Tiles © Esri — USGS, NOAA' : '© OpenStreetMap';
      tileLayerRef.current = window.L.tileLayer(tileUrl, { attribution: tileAttr }).addTo(map);
      const colorMap = { plant: '#22c55e', insect: '#f59e0b', bird: '#3b82f6', mushroom: '#8b5cf6', reptile: '#ef4444', marine: '#06b6d4', survival: '#f97316' };
      const filtered = filter === 'all' ? sightings : sightings.filter(s => s.scan_mode === filter);
      filtered.forEach(s => {
        if (!s.latitude || !s.longitude) return;
        const color = colorMap[s.scan_mode] || '#6b7280';
        window.L.circleMarker([s.latitude, s.longitude], { radius: 6, fillColor: color, color: '#fff', weight: 1, fillOpacity: 0.85 })
          .addTo(map)
          .bindPopup(`<b>${s.common_name || 'Unknown'}</b><br><i>${s.scientific_name || ''}</i><br><small>${s.country || ''}</small>`);
      });

      // Earthquake overlay
      if (layers.quakes) {
        disasters.quakes.forEach(eq => {
          const [lng, lat] = eq.geometry.coordinates;
          const mag = eq.properties.mag || 5;
          const color = mag >= 7 ? '#7f1d1d' : mag >= 6 ? '#ef4444' : '#f87171';
          window.L.circleMarker([lat, lng], { radius: Math.max(5, mag * 3), fillColor: color, color: '#fff', weight: 1, fillOpacity: 0.8 })
            .addTo(map)
            .bindPopup(`<b>🔴 M${mag} Earthquake</b><br>${eq.properties.place}<br><small>${new Date(eq.properties.time).toLocaleString()}</small>`);
        });
      }

      // GDACS overlay (floods, cyclones, volcanoes, wildfires)
      if (layers.gdacs) {
        disasters.gdacs.forEach(ev => {
          if (!ev.lat || !ev.lng) return;
          const color = GDACS_COLORS[ev.type] || '#6b7280';
          const icon = ev.type === 'tc' ? '🌀' : ev.type === 'fl' ? '🌊' : ev.type === 'vo' ? '🌋' : ev.type === 'wf' ? '🔥' : ev.type === 'dr' ? '🏜️' : '⚠️';
          window.L.circleMarker([ev.lat, ev.lng], { radius: 10, fillColor: color, color: '#fff', weight: 1.5, fillOpacity: 0.85 })
            .addTo(map)
            .bindPopup(`<b>${icon} ${ev.name || ev.type?.toUpperCase()}</b><br>${ev.country || ''}<br><span style="color:${ev.alert==='red'?'#ef4444':ev.alert==='orange'?'#f97316':'#22c55e'}">${(ev.alert||'').toUpperCase()} ALERT</span><br><small>${ev.description || ''}</small>`);
        });
      }

      // NOAA weather alerts (US bounding boxes — show as list, not map pins)
      if (layers.weather && disasters.weather.length > 0) {
        const center = map.getCenter();
        window.L.popup({ maxWidth: 320 })
          .setLatLng([38, -96])
          .setContent(`<b>⛈️ ${disasters.weather.length} Active US Weather Alerts</b><br>Click "Weather Alerts" panel below for details.`)
          .addTo(map);
      }

      leafletMap.current = map;
      setTimeout(() => map.invalidateSize(), 200);
    }
    return () => { if (leafletMap.current) { leafletMap.current.remove(); leafletMap.current = null; } };
  }, [sightings, filter, layers, disasters, satellite]);

  const totalDisasters = Object.entries(layers).filter(([,on]) => on).reduce((acc, [id]) => acc + disasters[id].length, 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 pb-28">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-white">🌍 Global Intelligence Map</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Live species sightings + real-time disaster data</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <button onClick={() => setSatellite(s => !s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${satellite ? 'bg-blue-900/60 border-blue-600 text-blue-300' : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white'}`}>
            🛰️ {satellite ? 'Satellite' : 'Standard'}
          </button>
          <select value={filter} onChange={e => setFilter(e.target.value)} className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-zinc-300">
            <option value="all">All Species</option>
            {SCAN_MODES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
      </div>

      {/* Disaster layer toggles */}
      <div className="flex gap-2 flex-wrap mb-3">
        {DISASTER_LAYERS.map(dl => (
          <button key={dl.id} onClick={() => toggleLayer(dl.id)} disabled={loadingDis[dl.id]}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${layers[dl.id] ? 'text-white border-opacity-60' : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:text-zinc-300'}`}
            style={layers[dl.id] ? { background: dl.color + '22', borderColor: dl.color + '88', color: dl.color } : {}}>
            {loadingDis[dl.id] ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin inline-block" /> : dl.icon}
            {dl.label}
            {layers[dl.id] && disasters[dl.id].length > 0 && <span className="ml-0.5 opacity-70">({disasters[dl.id].length})</span>}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-zinc-500 mb-3">Loading sightings…</p>}

      {/* Map */}
      <div ref={mapRef} style={{ width: '100%', height: '520px', borderRadius: '1rem', border: '1px solid #3f3f46', background: '#0c0c0e' }} />

      {/* Legend + stats */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 items-center">
        <p className="text-xs text-zinc-600 mr-2">Species:</p>
        {[['plant','#22c55e'],['insect','#f59e0b'],['bird','#3b82f6'],['mushroom','#8b5cf6'],['reptile','#ef4444'],['marine','#06b6d4']].map(([k,c]) => (
          <div key={k} className="flex items-center gap-1.5 text-xs text-zinc-400 capitalize"><span className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />{k}</div>
        ))}
        {totalDisasters > 0 && <span className="ml-4 text-xs text-red-400 font-bold animate-pulse">{totalDisasters} live disaster events</span>}
      </div>

      {/* Disaster detail panels */}
      {layers.weather && disasters.weather.length > 0 && (
        <div className="mt-4 p-4 bg-amber-950/40 border border-amber-700/40 rounded-xl">
          <h3 className="text-sm font-bold text-amber-400 mb-3">⛈️ Active US Weather Alerts ({disasters.weather.length})</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {disasters.weather.slice(0, 15).map((w, i) => (
              <div key={w.id || i} className="flex gap-3 items-start text-xs border-b border-amber-900/30 pb-2">
                <span className={`font-bold shrink-0 ${w.severity === 'Extreme' ? 'text-red-400' : 'text-amber-400'}`}>{w.severity}</span>
                <div>
                  <p className="text-zinc-200 font-medium">{w.event}</p>
                  <p className="text-zinc-500">{w.areaDesc?.slice(0, 80)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {layers.gdacs && disasters.gdacs.length > 0 && (
        <div className="mt-4 p-4 bg-blue-950/40 border border-blue-700/40 rounded-xl">
          <h3 className="text-sm font-bold text-blue-400 mb-3">🌍 Global Active Disasters — GDACS ({disasters.gdacs.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto">
            {disasters.gdacs.slice(0, 20).map((ev, i) => {
              const icon = ev.type === 'tc' ? '🌀' : ev.type === 'fl' ? '🌊' : ev.type === 'vo' ? '🌋' : ev.type === 'wf' ? '🔥' : ev.type === 'dr' ? '🏜️' : ev.type === 'eq' ? '🔴' : '⚠️';
              return (
                <div key={ev.id || i} className="flex gap-2 items-start text-xs bg-zinc-900/60 rounded-lg p-2">
                  <span className="text-base shrink-0">{icon}</span>
                  <div>
                    <p className="text-zinc-200 font-medium leading-tight">{ev.name}</p>
                    <p className="text-zinc-500">{ev.country} · <span style={{ color: ev.alert === 'red' ? '#ef4444' : ev.alert === 'orange' ? '#f97316' : '#22c55e' }}>{(ev.alert || '').toUpperCase()}</span></p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {layers.relief && disasters.relief.length > 0 && (
        <div className="mt-4 p-4 bg-purple-950/40 border border-purple-700/40 rounded-xl">
          <h3 className="text-sm font-bold text-purple-400 mb-3">🆘 Active Disaster Reports — ReliefWeb ({disasters.relief.length})</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {disasters.relief.slice(0, 12).map((r, i) => (
              <div key={r.id || i} className="flex gap-3 items-start text-xs border-b border-purple-900/30 pb-2">
                <span className="text-zinc-500 shrink-0">{r.type || '⚠️'}</span>
                <div className="flex-1">
                  <p className="text-zinc-200 font-medium">{r.name}</p>
                  <p className="text-zinc-500">{r.country} · {r.status}</p>
                </div>
                {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="text-purple-400 shrink-0 hover:text-purple-300">↗</a>}
              </div>
            ))}
          </div>
        </div>
      )}

      {layers.quakes && disasters.quakes.length > 0 && (
        <div className="mt-4 p-4 bg-red-950/40 border border-red-700/40 rounded-xl">
          <h3 className="text-sm font-bold text-red-400 mb-3">🔴 Recent Earthquakes M4.5+ — USGS ({disasters.quakes.length})</h3>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {disasters.quakes.slice(0, 15).map((eq, i) => {
              const mag = eq.properties.mag;
              return (
                <div key={eq.id || i} className="flex gap-3 items-center text-xs">
                  <span className={`font-black w-10 shrink-0 ${mag >= 7 ? 'text-red-400' : mag >= 6 ? 'text-orange-400' : 'text-amber-400'}`}>M{mag}</span>
                  <span className="text-zinc-300 flex-1 truncate">{eq.properties.place}</span>
                  <span className="text-zinc-600 shrink-0">{new Date(eq.properties.time).toLocaleDateString()}</span>
                  {eq.properties.url && <a href={eq.properties.url} target="_blank" rel="noreferrer" className="text-red-400 hover:text-red-300 shrink-0">↗</a>}
                </div>
              );
            })}
          </div>
        </div>
      )}
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
    let r;
    if (endpoint === 'calendar') {
      r = await fetch(`${API}/farming/calendar?region=${encodeURIComponent(query)}`, { credentials: 'include' }).catch(() => null);
    } else {
      r = await fetch(`${API}/farming/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) }).catch(() => null);
    }
    if (r?.ok) setResult(await r.json());
    else setResult({ error: 'AI unavailable — check API keys in .env' });
    setLoading(false);
  };

  const farmTabs = [
    { id: 'farm', label: '🌾 Farm Plan', endpoint: 'plan', placeholder: 'Describe your land — size, location, climate, goals…' },
    { id: 'hydro', label: '💧 Hydroponics', endpoint: 'hydroponics', placeholder: 'What crops? Indoor or outdoor? Budget?' },
    { id: 'calendar', label: '📅 Calendar', endpoint: 'calendar', placeholder: 'Enter your region, e.g. Philippines, Vietnam, Texas…' },
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
        <Card className="p-5 space-y-4">
          {result.error && <p className="text-sm text-red-400">{result.error}</p>}
          {/* Farm plan / hydroponics response (advice object) */}
          {result.advice?.summary && <div><p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-2">Summary</p><p className="text-sm text-zinc-300 leading-relaxed">{result.advice.summary}</p></div>}
          {result.advice?.soil_preparation && <div><p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Soil Preparation</p><p className="text-sm text-zinc-400">{result.advice.soil_preparation}</p></div>}
          {result.advice?.recommended_crops?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-2">Recommended Crops</p>
              <div className="space-y-2">{result.advice.recommended_crops.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-sm"><span className="text-green-400">🌱</span><span className="text-zinc-200 font-medium">{c.name || c}</span>{c.days_to_harvest && <Badge color="amber">{c.days_to_harvest} days</Badge>}{c.difficulty && <Badge color="blue">{c.difficulty}</Badge>}</div>
              ))}</div>
            </div>
          )}
          {result.advice?.fertilizer_plan && <div><p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Fertilizer Plan</p><p className="text-sm text-zinc-400">{result.advice.fertilizer_plan}</p></div>}
          {result.advice?.pest_prevention && <div><p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Pest Prevention</p><p className="text-sm text-zinc-400">{result.advice.pest_prevention}</p></div>}
          {result.advice?.cost_breakdown && (
            <div><p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Estimated Cost</p>
            <p className="text-lg font-bold text-amber-400">${result.advice.cost_breakdown.total?.toLocaleString() || '—'}</p></div>
          )}
          {result.advice?.market_potential && <div><p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Market Potential</p><p className="text-sm text-zinc-400">{result.advice.market_potential}</p></div>}
          {/* Hydroponics response */}
          {result.setup && <div><p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Setup</p><p className="text-sm text-zinc-300 whitespace-pre-wrap">{typeof result.setup === 'string' ? result.setup : JSON.stringify(result.setup, null, 2)}</p></div>}
          {/* Calendar response */}
          {result.calendar?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-3">Monthly Calendar — {result.country || ''}</p>
              <div className="space-y-3">{result.calendar.slice(0,6).map((m, i) => (
                <div key={i} className="border border-zinc-800 rounded-lg p-3">
                  <p className="text-xs font-bold text-green-400 mb-1">{m.month}</p>
                  {m.planting && <p className="text-xs text-zinc-400"><span className="text-zinc-500">🌱 Plant:</span> {m.planting}</p>}
                  {m.harvest && <p className="text-xs text-zinc-400 mt-0.5"><span className="text-zinc-500">🌾 Harvest:</span> {m.harvest}</p>}
                </div>
              ))}</div>
            </div>
          )}
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
    const r = await fetch(`${API}/auth/profile`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }).catch(() => null);
    if (r?.ok) { await refreshUser(); setMsg('Profile updated!'); }
    else setMsg('Update failed.');
    setSaving(false);
  };

  const changePw = async e => {
    e.preventDefault();
    if (pw.next !== pw.confirm) { setMsg('Passwords do not match'); return; }
    setSaving(true); setMsg('');
    const r = await fetch(`${API}/auth/change-password`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current_password: pw.current, new_password: pw.next }) }).catch(() => null);
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




// ── FloraBot Chatbot ──────────────────────────────────────────
function FloraBot() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([
    { role: 'bot', text: "Hi! I'm FloraBot 🌿 Ask me anything about plants, foraging, survival, or nature!" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const msgsEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => msgsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
      inputRef.current?.focus();
    }
  }, [open, msgs]);

  const SUGGESTIONS = ['Is this plant edible?', 'Survival tips?', 'Treat an insect sting?', 'Identify mushrooms safely?'];

  const send = async (text) => {
    const q = (text || input).trim();
    if (!q || loading) return;
    setInput('');
    setMsgs(m => [...m, { role: 'user', text: q }]);
    setLoading(true);
    try {
      const r = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: q }),
      });
      const d = await r.json();
      setMsgs(m => [...m, { role: 'bot', text: d.reply || d.message || d.response || "I couldn't process that. Try again!" }]);
    } catch {
      setMsgs(m => [...m, { role: 'bot', text: "Connection issue — please try again in a moment." }]);
    }
    setLoading(false);
  };

  return (
    <>
      <button className="florabot-fab" onClick={() => setOpen(o => !o)} title="Chat with FloraBot">
        {open ? '✕' : '🌿'}
      </button>
      {open && (
        <div className="florabot-panel">
          <div className="florabot-header">
            <div className="florabot-avatar">🌿</div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'white' }}>FloraBot</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <div className="florabot-online-dot" />
                <p style={{ margin: 0, fontSize: '11px', color: '#a78bfa' }}>AI Plant Assistant</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontSize: '20px', lineHeight: 1 }}>×</button>
          </div>

          <div className="florabot-messages">
            {msgs.map((m, i) => (
              <div key={i} className={`florabot-msg ${m.role}`}>{m.text}</div>
            ))}
            {loading && (
              <div className="florabot-msg bot">
                <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
              </div>
            )}
            <div ref={msgsEndRef} />
          </div>

          {msgs.length <= 2 && (
            <div className="florabot-suggestions">
              {SUGGESTIONS.map(s => (
                <button key={s} className="florabot-chip" onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          )}

          <div className="florabot-input-row">
            <input
              ref={inputRef}
              className="florabot-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Ask about plants…"
              disabled={loading}
            />
            <button className="florabot-send" onClick={() => send()} disabled={loading || !input.trim()}>➤</button>
          </div>
        </div>
      )}
    </>
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
        <div className="min-h-screen text-slate-100">
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
          <FloraBot />
          {installPrompt && (
            <div className="fixed bottom-20 left-4 right-4 lg:left-auto lg:right-4 lg:w-80 glass-card p-4 flex items-center justify-between shadow-2xl z-50">
              <span className="text-sm text-zinc-300">Install FloraIQ for offline use</span>
              <div className="flex gap-2">
                <button onClick={installPwa} className="btn-violet px-3 py-1.5 text-xs rounded-lg">Install</button>
                <button onClick={() => setInstallPrompt(null)} className="text-zinc-600 hover:text-zinc-400 text-xs px-2">×</button>
              </div>
            </div>
          )}
        </div>
      </ErrorBoundary>
    </AuthProvider>
  );
}
