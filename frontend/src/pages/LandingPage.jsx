import { useState, useEffect, useRef, useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  Activity, Zap, Brain, BarChart2, ShieldAlert,
  Users, Database, Cpu, CheckCircle, AlertCircle, Rocket
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
//  Replace with your Google Cloud Console OAuth 2.0 Client ID.
//  Steps:
//    1. Go to console.cloud.google.com → select / create a project
//    2. APIs & Services → Credentials → Create OAuth 2.0 Client ID
//    3. Application type: Web application
//    4. Authorized JavaScript origins: http://localhost:5173
//    5. Copy the Client ID and paste it below.
// ─────────────────────────────────────────────────────────────────────────────
const GOOGLE_CLIENT_ID = '196141075698-9mhu769ccg5uj3qpfdpusjs0m4sjs4hk.apps.googleusercontent.com';

const FEATURES = [
  { Icon: Zap,        text: 'Real-time RUL prediction via WebSocket simulation' },
  { Icon: Brain,      text: 'SHAP explainability — see exactly why the model predicts' },
  { Icon: BarChart2,  text: '5 ML models: XGBoost, LightGBM, RF, GBR, Stacking Ensemble' },
  { Icon: Database,   text: 'NASA C-MAPSS FD001 — 20,531 training rows · 100 test engines' },
  { Icon: ShieldAlert,text: 'Sensor anomaly detection & Emergency QRH procedures' },
  { Icon: Cpu,        text: 'Gemini AI assistant with live telemetry context' },
];

const STATS = [
  { value: '19.06', unit: 'RMSE', desc: 'cycles — XGBoost best' },
  { value: '0.74',  unit: 'R²',   desc: 'coefficient of determination' },
  { value: '5',     unit: 'Models', desc: 'compared side-by-side' },
];

const TECH = ['XGBoost', 'LightGBM', 'SHAP', 'FastAPI', 'React', 'Gemini AI', 'SQLite'];

// ── Small helpers ─────────────────────────────────────────────────────────────
function GoogleButton({ btnRef, loading }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2.5 h-11">
        <div className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"/>
        <span className="text-sm text-slate-500 font-medium">Signing in…</span>
      </div>
    );
  }
  return <div ref={btnRef} className="flex justify-center min-h-[44px]"/>;
}

function ConfigNotice({ onDevLogin, devLoading }) {
  return (
    <div className="space-y-3">
      {/* Dev login button */}
      <button
        onClick={onDevLogin}
        disabled={devLoading}
        className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl font-semibold text-sm
                   transition-all border-2 border-slate-200 text-slate-700 hover:border-sky-400
                   hover:bg-sky-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {devLoading ? (
          <>
            <div className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"/>
            <span>Signing in…</span>
          </>
        ) : (
          <>
            <span className="text-lg">🚀</span>
            <span>Continue as Demo User</span>
          </>
        )}
      </button>

      {/* Config notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-[11px] text-amber-800 space-y-1">
        <p className="font-bold flex items-center gap-1.5">
          <AlertCircle size={11}/> Google Sign-In not yet configured
        </p>
        <p className="text-amber-700 leading-relaxed">
          Use <span className="font-bold">Continue as Demo User</span> to test now.
          To enable Google login, replace{' '}
          <code className="bg-amber-100 px-1 rounded font-mono">YOUR_GOOGLE_CLIENT_ID</code>{' '}
          in <code className="bg-amber-100 px-1 rounded font-mono">LandingPage.jsx</code>.
        </p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate();

  // Redirect immediately if already authenticated
  if (localStorage.getItem('token')) {
    return <Navigate to="/dashboard" replace />;
  }

  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const [devLoading, setDevLoading] = useState(false);
  const [mounted,    setMounted]    = useState(false);
  const btnRef        = useRef(null);
  const googleInitRef = useRef(false);
  const isConfigured  = GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

  // Fade-in on mount
  useEffect(() => { const t = setTimeout(() => setMounted(true), 60); return () => clearTimeout(t); }, []);

  // Dev/demo login — works without Google OAuth configured
  const handleDevLogin = useCallback(async () => {
    setDevLoading(true);
    setError('');
    try {
      const res  = await fetch('/api/auth/dev-login', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || 'Dev login failed.'); return; }
      localStorage.setItem('token',    data.access_token);
      localStorage.setItem('username', data.username);
      navigate('/dashboard', { replace: true });
    } catch {
      setError('Cannot connect to server. Make sure the backend is running on port 8000.');
    } finally { setDevLoading(false); }
  }, [navigate]);

  // Called by Google after the user picks an account
  const handleCredential = useCallback(async (response) => {
    setLoading(true);
    setError('');
    try {
      const res  = await fetch('/api/auth/google', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || 'Sign-in failed. Please try again.');
        return;
      }
      localStorage.setItem('token',    data.access_token);
      localStorage.setItem('username', data.username);
      if (data.picture) localStorage.setItem('user_picture', data.picture);
      if (data.name)    localStorage.setItem('user_name',    data.name);
      navigate('/dashboard', { replace: true });
    } catch {
      setError('Cannot connect to the server. Make sure the backend is running on port 8000.');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  // Render the official Google button
  const initGoogle = useCallback(() => {
    if (!window.google || googleInitRef.current || !btnRef.current) return;
    googleInitRef.current = true;
    window.google.accounts.id.initialize({
      client_id:           GOOGLE_CLIENT_ID,
      callback:            handleCredential,
      auto_select:         false,
      cancel_on_tap_outside: true,
      ux_mode:             'popup',
    });
    window.google.accounts.id.renderButton(btnRef.current, {
      theme:          'outline',
      size:           'large',
      shape:          'rectangular',
      width:          300,
      logo_alignment: 'left',
      text:           'signin_with',
    });
  }, [handleCredential]);

  useEffect(() => {
    if (!isConfigured) return;
    if (window.google) { initGoogle(); return; }
    const s     = document.createElement('script');
    s.src       = 'https://accounts.google.com/gsi/client';
    s.async     = true;
    s.defer     = true;
    s.onload    = initGoogle;
    document.head.appendChild(s);
    return () => { s.remove(); googleInitRef.current = false; };
  }, [isConfigured, initGoogle]);

  return (
    <div
      className="min-h-screen flex flex-col lg:flex-row select-none"
      style={{
        background: 'linear-gradient(140deg, #020617 0%, #0c1a2e 55%, #071428 100%)',
        transition: 'opacity 0.5s ease',
        opacity: mounted ? 1 : 0,
      }}
    >
      {/* ════════════════════ LEFT — Branding ════════════════════ */}
      <div className="lg:w-[58%] flex flex-col justify-between p-8 lg:px-16 lg:py-12 text-white">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
               style={{ background: 'linear-gradient(135deg,#0ea5e9,#0284c7)', boxShadow: '0 0 28px rgba(14,165,233,.45)' }}>
            <Activity size={20} className="text-white"/>
          </div>
          <span className="text-2xl font-black tracking-tight">
            AERO<span style={{ color: '#38bdf8' }}>SENSE</span>
          </span>
          <span className="ml-2 text-[9px] font-bold tracking-widest uppercase border border-white/20
                           rounded-full px-2.5 py-1 text-white/50">v2.0</span>
        </div>

        {/* Hero */}
        <div className="py-10 lg:py-0">
          <p className="text-sky-400 text-[11px] font-bold tracking-[0.22em] uppercase mb-4">
            NASA C-MAPSS · Turbofan Predictive Maintenance
          </p>
          <h1 className="text-4xl lg:text-[3.2rem] font-black leading-[1.1] mb-5">
            Predict.<br/>
            Protect.<br/>
            <span style={{
              background: 'linear-gradient(90deg,#38bdf8,#818cf8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>Perform.</span>
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed max-w-[480px] mb-8">
            An end-to-end predictive maintenance platform for NASA turbofan engines —
            combining real-time sensor telemetry, advanced machine learning, and
            SHAP-powered explainability to forecast engine failure before it happens.
          </p>

          {/* Feature list */}
          <ul className="space-y-2.5 mb-10">
            {FEATURES.map(({ Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                     style={{ background: 'rgba(14,165,233,.12)', border: '1px solid rgba(14,165,233,.25)' }}>
                  <Icon size={12} style={{ color: '#38bdf8' }}/>
                </div>
                <span className="text-sm text-slate-300">{text}</span>
              </li>
            ))}
          </ul>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 max-w-[440px]">
            {STATS.map(({ value, unit, desc }) => (
              <div key={unit} className="rounded-xl p-3.5"
                   style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)' }}>
                <p className="text-2xl font-black font-mono" style={{ color: '#38bdf8' }}>{value}</p>
                <p className="text-[10px] font-bold text-white/50 uppercase tracking-wider mt-0.5">{unit}</p>
                <p className="text-[9px] text-white/30 mt-0.5 leading-tight">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tech stack footer */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-white/25 uppercase tracking-wider font-bold mr-1">Built with</span>
          {TECH.map(t => (
            <span key={t} className="text-[10px] text-white/35 border border-white/10 rounded-full px-2 py-0.5">{t}</span>
          ))}
        </div>
      </div>

      {/* ════════════════════ RIGHT — Sign-in Card ════════════════════ */}
      <div className="lg:w-[42%] flex items-center justify-center p-6 py-10 lg:py-12">
        <div className="w-full max-w-[360px]">

          {/* Card */}
          <div className="bg-white rounded-3xl p-8 shadow-2xl"
               style={{ boxShadow: '0 30px 70px rgba(0,0,0,.45), 0 0 0 1px rgba(255,255,255,.08)' }}>

            {/* Icon + heading */}
            <div className="text-center mb-7">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                   style={{ background: 'linear-gradient(135deg,#0ea5e9,#0284c7)', boxShadow: '0 10px 28px rgba(14,165,233,.4)' }}>
                <Rocket size={24} className="text-white"/>
              </div>
              <h2 className="text-[1.6rem] font-black text-slate-800 mb-1 tracking-tight">Welcome</h2>
              <p className="text-slate-400 text-[13px] leading-snug">
                Sign in to access the AEROSENSE<br/>predictive maintenance dashboard
              </p>
            </div>

            {/* Error banner */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5
                              flex items-start gap-2 text-sm text-red-700">
                <AlertCircle size={14} className="shrink-0 mt-0.5 text-red-500"/>
                <span>{error}</span>
              </div>
            )}

            {/* Divider */}
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px flex-1 bg-slate-100"/>
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                Continue with Google
              </span>
              <div className="h-px flex-1 bg-slate-100"/>
            </div>

            {/* Google button or dev-mode notice */}
            {isConfigured
              ? <GoogleButton btnRef={btnRef} loading={loading}/>
              : <ConfigNotice onDevLogin={handleDevLogin} devLoading={devLoading}/>
            }

            {/* What you get */}
            <div className="mt-6 space-y-2">
              {[
                'Real-time engine health monitoring',
                'AI-powered RUL forecasting',
                'Personalized maintenance alerts',
              ].map(item => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle size={12} className="text-green-500 shrink-0"/>
                  <span className="text-[11px] text-slate-500">{item}</span>
                </div>
              ))}
            </div>

            {/* Privacy note */}
            <p className="text-center text-[10px] text-slate-300 mt-6 leading-relaxed">
              By signing in you agree to AEROSENSE terms of use.<br/>
              We only store your Google email and display name.
            </p>
          </div>

          {/* Admin back-door link */}
          <p className="text-center mt-5 text-[11px] text-white/25">
            Administrator?{' '}
            <a href="/admin-login"
               className="text-white/40 hover:text-white/65 underline underline-offset-2 transition-colors">
              Password login
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
