import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Mail, Shield, Clock, Calendar, Activity } from 'lucide-react';
import api from '../services/api';

export default function Profile() {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/auth/me')
      .then(r => setUser(r.data))
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"/>
      </div>
    );
  }
  if (!user) return null;

  const picture = localStorage.getItem('user_picture');
  const name    = localStorage.getItem('user_name');

  const fields = [
    { Icon: User,     label: 'Username',     value: user.username },
    { Icon: Mail,     label: 'Email',        value: user.email || '—' },
    { Icon: Shield,   label: 'Role',         value: user.is_admin ? 'Administrator' : 'Standard User' },
    { Icon: Clock,    label: 'Login Count',  value: `${user.login_count ?? 0} session${user.login_count !== 1 ? 's' : ''}` },
    { Icon: Calendar, label: 'Member Since', value: user.member_since ? new Date(user.member_since).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }) : '—' },
    { Icon: Clock,    label: 'Last Login',   value: user.last_login   ? new Date(user.last_login).toLocaleString('en-US',   { year:'numeric', month:'short',  day:'numeric', hour:'2-digit', minute:'2-digit' }) : '—' },
  ];

  return (
    <div className="h-full overflow-y-auto p-6" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="max-w-md mx-auto">

        {/* Back */}
        <button onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-sm font-semibold mb-6 transition-colors"
                style={{ color: 'var(--color-muted)' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--color-text)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--color-muted)'}>
          <ArrowLeft size={15}/> Back
        </button>

        {/* Card */}
        <div className="rounded-2xl border shadow-sm p-6"
             style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}>

          {/* Avatar + name */}
          <div className="flex flex-col items-center mb-6">
            {picture ? (
              <img src={picture} alt="Profile" className="w-20 h-20 rounded-full object-cover shadow-md mb-3"/>
            ) : (
              <div className="w-20 h-20 rounded-full flex items-center justify-center shadow-md mb-3"
                   style={{ background: 'linear-gradient(135deg, #0ea5e9, #0284c7)' }}>
                <span className="text-3xl font-black text-white">{user.username[0].toUpperCase()}</span>
              </div>
            )}
            <h1 className="text-xl font-black mb-1" style={{ color: 'var(--color-text)' }}>
              {name || user.username}
            </h1>
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${
              user.is_admin ? 'bg-sky-100 text-sky-700' : 'bg-green-100 text-green-700'
            }`}>
              {user.is_admin ? 'Administrator' : 'User'}
            </span>
          </div>

          {/* AEROSENSE badge */}
          <div className="flex items-center justify-center gap-2 mb-6 py-2.5 rounded-xl border"
               style={{ backgroundColor: 'var(--color-card2)', borderColor: 'var(--color-border)' }}>
            <Activity size={14} className="text-sky-500"/>
            <span className="text-xs font-bold" style={{ color: 'var(--color-text)' }}>AEROSENSE Platform</span>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500"/>
            <span className="text-xs font-bold text-green-600">Active</span>
          </div>

          {/* Info fields */}
          <div className="space-y-1">
            {fields.map(({ Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3 py-3 border-b"
                   style={{ borderColor: 'var(--color-border)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                     style={{ backgroundColor: 'var(--color-card2)' }}>
                  <Icon size={14} className="text-sky-500"/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>
                    {label}
                  </p>
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                    {value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
