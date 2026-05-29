import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Activity, History, BarChart2, Sun, Moon, LogOut, Bell, Thermometer, ShieldAlert, User } from 'lucide-react';

export default function Layout() {
  const navigate = useNavigate();

  // ── Dark / Light toggle ──────────────────────────────────────────────────
  // Reads saved preference from localStorage, defaults to light
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(prev => !prev);

  // ── Auth ─────────────────────────────────────────────────────────────────
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('user_picture');
    localStorage.removeItem('user_name');
    navigate('/');
  };

  const username = localStorage.getItem('username') || 'admin';

  const navItems = [
    { to: '/dashboard',      Icon: Activity,    label: 'Live Monitor'        },
    { to: '/history',        Icon: History,     label: 'History Analysis'    },
    { to: '/visualizations', Icon: BarChart2,   label: 'Visualizations'      },
    { to: '/xgboost-model',  Icon: BarChart2,   label: 'Models & Performance'},
    { to: '/alerts',         Icon: Bell,        label: 'Alert Center'        },
    { to: '/heatmap',        Icon: Thermometer, label: 'Sensor Heatmap'      },
    { to: '/emergency',      Icon: ShieldAlert, label: 'Emergency QRH'       },
  ];

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor:'var(--color-bg)' }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="w-64 flex flex-col h-screen border-r shrink-0"
             style={{ backgroundColor:'var(--color-card)', borderColor:'var(--color-border)' }}>

        {/* Logo — fixed at top */}
        <div className="flex items-center gap-3 px-5 py-5 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center shadow-md">
            <Activity size={16} className="text-white"/>
          </div>
          <span className="text-lg font-black tracking-tight" style={{color:'var(--color-text)'}}>
            AERO<span style={{color:'var(--color-accent)'}}>SENSE</span>
          </span>
        </div>

        {/* Nav links — scrollable, fills remaining space */}
        <nav className="flex flex-col gap-1 px-3 flex-1 min-h-0 overflow-y-auto pb-2">
          {navItems.map(({ to, Icon, label }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150
                ${isActive
                  ? 'bg-accent text-white shadow-md'
                  : 'hover:bg-card2 text-muted hover:text-text'}`
              }
            >
              <Icon size={16}/>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom section — always visible, never pushed off-screen */}
        <div className="shrink-0 px-3 pb-4 pt-2 border-t" style={{borderColor:'var(--color-border)'}}>

          {/* Theme toggle */}
          <button onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all hover:bg-card2 mb-1.5"
            style={{color:'var(--color-muted)'}}>
            {isDark
              ? <><Sun  size={16} className="text-yellow-400"/> Light Mode</>
              : <><Moon size={16} className="text-indigo-400"/> Dark Mode</>
            }
          </button>

          {/* User — click to open profile */}
          <button onClick={() => navigate('/profile')}
                  className="w-full px-3 py-2.5 rounded-xl flex items-center gap-3 mb-1.5 transition-all hover:opacity-80"
                  style={{backgroundColor:'var(--color-card2)'}}>
            {(() => {
              const pic = localStorage.getItem('user_picture');
              return pic
                ? <img src={pic} alt="avatar" className="w-7 h-7 rounded-full object-cover shrink-0"/>
                : <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                    <span className="text-xs font-black" style={{color:'var(--color-accent)'}}>
                      {username[0].toUpperCase()}
                    </span>
                  </div>;
            })()}
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-bold truncate" style={{color:'var(--color-text)'}}>{username}</p>
              <p className="text-[10px]" style={{color:'var(--color-success)'}}>● Authorized</p>
            </div>
            <User size={12} style={{color:'var(--color-muted)'}} className="shrink-0"/>
          </button>

          {/* Logout */}
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all border hover:bg-red-50 dark:hover:bg-red-950/30"
            style={{color:'var(--color-danger)',borderColor:'var(--color-danger)'}}>
            <LogOut size={16}/> Logout
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto" style={{backgroundColor:'var(--color-bg)'}}>
        <Outlet/>
      </main>
    </div>
  );
}
