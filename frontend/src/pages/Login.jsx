import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Activity, Eye, EyeOff, AlertCircle, ArrowLeft, Lock } from 'lucide-react';

const BASE_URL = 'http://127.0.0.1:8000';

export default function Login() {
  const navigate  = useNavigate();
  const [form,    setForm]    = useState({ username: '', password: '' });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw,  setShowPw]  = useState(false);

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password) {
      setError('Please enter both username and password.'); return;
    }
    setLoading(true); setError('');
    try {
      const res  = await fetch(`${BASE_URL}/api/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username: form.username.trim(), password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || 'Invalid credentials.'); return; }
      localStorage.setItem('token',    data.access_token);
      localStorage.setItem('username', data.username);
      navigate('/dashboard', { replace: true });
    } catch {
      setError('Cannot connect to server. Make sure the backend is running on port 8000.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6"
         style={{ background: 'linear-gradient(140deg, #020617 0%, #0c1a2e 55%, #071428 100%)' }}>

      <div className="w-full max-w-sm">

        {/* Back link */}
        <Link to="/"
              className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm
                         transition-colors mb-8 w-fit">
          <ArrowLeft size={14}/> Back to sign in
        </Link>

        {/* Card */}
        <div className="bg-white rounded-3xl p-8 shadow-2xl"
             style={{ boxShadow: '0 30px 70px rgba(0,0,0,.45)' }}>

          <div className="text-center mb-7">
            <div className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-slate-100">
              <Lock size={20} className="text-slate-500"/>
            </div>
            <h2 className="text-xl font-black text-slate-800 mb-1">Administrator Login</h2>
            <p className="text-slate-400 text-xs">For system administrator access only</p>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 mb-5">
              <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0"/>
              <p className="text-red-700 text-xs">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Username
              </label>
              <input name="username" value={form.username} onChange={handleChange}
                placeholder="admin"
                className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800
                           placeholder:text-slate-400 focus:outline-none focus:border-sky-500 transition-colors"
                autoComplete="username" autoFocus/>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <input name="password" value={form.password} onChange={handleChange}
                  type={showPw ? 'text' : 'password'}
                  placeholder="Enter password"
                  className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 pr-12 text-sm text-slate-800
                             placeholder:text-slate-400 focus:outline-none focus:border-sky-500 transition-colors"
                  autoComplete="current-password"/>
                <button type="button" onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl font-black text-white text-sm transition-all shadow-lg
                         disabled:opacity-60 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0"
              style={{ background: loading ? '#94a3b8' : 'linear-gradient(135deg,#0ea5e9,#0284c7)',
                       boxShadow: loading ? 'none' : '0 4px 16px rgba(14,165,233,.35)' }}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-[10px] text-slate-300 mt-5 leading-relaxed">
            This login is for system administrators only.<br/>
            Regular users should sign in with Google.
          </p>
        </div>

        <p className="text-center mt-4 text-[11px] text-white/20">
          AEROSENSE Predictive Maintenance System
        </p>
      </div>
    </div>
  );
}
