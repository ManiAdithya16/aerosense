import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Activity, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';

const BASE_URL = 'http://127.0.0.1:8000';

export default function Register() {
  const navigate  = useNavigate();
  const [form,    setForm]    = useState({ username:'', email:'', password:'', confirm:'' });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw,  setShowPw]  = useState(false);

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.email.trim() || !form.password) {
      setError('All fields are required.'); return;
    }
    if (form.username.trim().length < 3) {
      setError('Username must be at least 3 characters.'); return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.'); return;
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match.'); return;
    }
    if (!form.email.includes('@')) {
      setError('Please enter a valid email address.'); return;
    }

    setLoading(true); setError('');
    try {
      const res = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: form.username.trim(), email: form.email.trim(), password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || 'Registration failed. Please try again.'); return; }
      localStorage.setItem('token',    data.access_token);
      localStorage.setItem('username', data.username);
      navigate('/dashboard', { replace: true });
    } catch {
      setError('Cannot connect to server. Make sure the backend is running on port 8000.');
    } finally { setLoading(false); }
  };

  // Password strength indicator
  const pwStrength = (() => {
    const pw = form.password;
    if (!pw) return { label:'', color:'', width:'0%' };
    if (pw.length < 6) return { label:'Too short', color:'bg-red-400', width:'25%' };
    if (pw.length < 8) return { label:'Weak', color:'bg-orange-400', width:'50%' };
    if (pw.length < 12) return { label:'Good', color:'bg-yellow-400', width:'75%' };
    return { label:'Strong', color:'bg-green-500', width:'100%' };
  })();

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 40%, #0c4a6e 100%)' }}>

      {/* Left — Branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
            <Activity size={22} className="text-white"/>
          </div>
          <span className="text-2xl font-black tracking-tight">AERO<span className="text-sky-200">SENSE</span></span>
        </div>

        <div>
          <h1 className="text-5xl font-black leading-tight mb-4">
            Join the<br/>future of<br/>aviation AI.
          </h1>
          <p className="text-sky-200 text-lg leading-relaxed max-w-md">
            Create your account and get instant access to real-time engine health monitoring,
            SHAP explainability, and AI-powered predictive maintenance.
          </p>
        </div>

        <div className="space-y-3">
          {['Real-time RUL prediction using XGBoost','SHAP explainability for every prediction',
            'Multi-engine fleet monitoring','Voice-enabled AI assistant'].map(f=>(
            <div key={f} className="flex items-center gap-3">
              <CheckCircle size={18} className="text-sky-300 shrink-0"/>
              <span className="text-sky-100 text-sm">{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right — Register Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8">

          <div className="flex lg:hidden items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-xl bg-sky-500 flex items-center justify-center">
              <Activity size={16} className="text-white"/>
            </div>
            <span className="text-xl font-black text-slate-800">AERO<span className="text-sky-500">SENSE</span></span>
          </div>

          <h2 className="text-2xl font-black text-slate-800 mb-1">Create account</h2>
          <p className="text-slate-500 text-sm mb-6">Join AEROSENSE — it's free</p>

          {error && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5">
              <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0"/>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Username</label>
              <input name="username" value={form.username} onChange={handleChange}
                placeholder="Choose a username (min 3 chars)"
                className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400
                           focus:outline-none focus:border-sky-500 transition-colors"
                autoFocus/>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Email</label>
              <input name="email" type="email" value={form.email} onChange={handleChange}
                placeholder="your@email.com"
                className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400
                           focus:outline-none focus:border-sky-500 transition-colors"/>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Password</label>
              <div className="relative">
                <input name="password" value={form.password} onChange={handleChange}
                  type={showPw ? 'text' : 'password'}
                  placeholder="Min 6 characters"
                  className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 pr-12 text-sm text-slate-800 placeholder:text-slate-400
                             focus:outline-none focus:border-sky-500 transition-colors"/>
                <button type="button" onClick={()=>setShowPw(p=>!p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {showPw ? <EyeOff size={18}/> : <Eye size={18}/>}
                </button>
              </div>
              {form.password && (
                <div className="mt-2">
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-300 ${pwStrength.color}`}
                         style={{width:pwStrength.width}}/>
                  </div>
                  <p className={`text-[10px] mt-1 font-semibold ${
                    pwStrength.label==='Strong'?'text-green-600':pwStrength.label==='Good'?'text-yellow-600':'text-orange-600'}`}>
                    {pwStrength.label}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Confirm Password</label>
              <input name="confirm" value={form.confirm} onChange={handleChange}
                type="password" placeholder="Re-enter your password"
                className={`w-full border-2 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400
                            focus:outline-none transition-colors ${
                  form.confirm && form.confirm !== form.password ? 'border-red-300 focus:border-red-400' :
                  form.confirm && form.confirm === form.password ? 'border-green-400 focus:border-green-500' :
                  'border-slate-200 focus:border-sky-500'}`}/>
              {form.confirm && form.confirm === form.password && (
                <p className="text-green-600 text-[10px] mt-1 font-semibold flex items-center gap-1">
                  <CheckCircle size={10}/> Passwords match
                </p>
              )}
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-xl font-black text-white text-sm transition-all shadow-lg shadow-sky-200
                         disabled:opacity-60 disabled:cursor-not-allowed hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
              style={{background: loading ? '#94a3b8' : 'linear-gradient(135deg, #0ea5e9, #0284c7)'}}>
              {loading ? 'Creating account…' : 'Create Account →'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <p className="text-slate-500 text-sm">
              Already have an account?{' '}
              <Link to="/login" className="text-sky-600 font-bold hover:text-sky-700 transition-colors">
                Sign in
              </Link>
            </p>
          </div>

          <p className="text-center text-xs text-slate-400 mt-4">
            NASA AEROSENSE · Predictive Maintenance System
          </p>
        </div>
      </div>
    </div>
  );
}
