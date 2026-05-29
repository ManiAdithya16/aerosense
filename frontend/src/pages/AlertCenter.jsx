import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bell, RefreshCw, XCircle, AlertTriangle, AlertCircle,
  CheckCircle, Clock, Download, Filter, Wifi, WifiOff,
  TrendingUp, Activity, Zap
} from 'lucide-react';
import api from '../services/api';

// ── helpers ───────────────────────────────────────────────────────────────────
const BADGE = {
  CRITICAL:{ bg:'bg-red-100',    text:'text-red-700',    border:'border-red-300',    dot:'bg-red-500',    Icon:XCircle,       ring:'ring-red-200'    },
  WARNING: { bg:'bg-orange-100', text:'text-orange-700', border:'border-orange-300', dot:'bg-orange-500', Icon:AlertTriangle, ring:'ring-orange-200' },
  CAUTION: { bg:'bg-yellow-100', text:'text-yellow-700', border:'border-yellow-300', dot:'bg-yellow-400', Icon:AlertCircle,   ring:'ring-yellow-200' },
  NORMAL:  { bg:'bg-green-100',  text:'text-green-700',  border:'border-green-300',  dot:'bg-green-500',  Icon:CheckCircle,   ring:'ring-green-200'  },
};
const badge = (level) => BADGE[level] ?? BADGE.NORMAL;

// Play a beep for critical alerts using Web Audio API
function playCriticalBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(); osc.stop(ctx.currentTime + 0.4);
  } catch {}
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, bg, icon, pulse }) {
  return (
    <div className={`${bg} border border-border rounded-2xl p-4 flex items-center gap-4 shadow-sm`}>
      <div className={`p-3 rounded-xl bg-card shadow-sm ${pulse ? 'animate-pulse' : ''}`}>{icon}</div>
      <div>
        <p className="text-muted text-xs uppercase tracking-wider font-bold">{label}</p>
        <p className={`text-3xl font-black font-mono ${color}`}>{value}</p>
      </div>
    </div>
  );
}

// ── Timeline Item ─────────────────────────────────────────────────────────────
function TimelineItem({ alert, isFirst }) {
  const b = badge(alert.alert_level);
  return (
    <div className="flex gap-4">
      {/* Timeline line */}
      <div className="flex flex-col items-center">
        <div className={`w-3 h-3 rounded-full border-2 border-white shadow-md ring-2 ${b.dot} ${b.ring} ${isFirst && alert.alert_level==='CRITICAL' ? 'animate-pulse' : ''}`}/>
        <div className="w-0.5 bg-border flex-1 mt-1"/>
      </div>
      {/* Content */}
      <div className={`flex-1 pb-4 ${isFirst ? 'pb-5' : ''}`}>
        <div className={`${b.bg} border ${b.border} rounded-2xl p-4 shadow-sm`}>
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${b.bg} ${b.text} ${b.border} flex items-center gap-1.5`}>
                <span className={`w-1.5 h-1.5 rounded-full ${b.dot}`}/>
                {alert.alert_level}
              </span>
              <span className="text-xs font-black font-mono text-text">{alert.engine_id || 'FD001-A'}</span>
              <span className="text-[10px] text-muted">· Cycle #{alert.cycle ?? '--'}</span>
            </div>
            <span className={`text-xl font-black font-mono shrink-0 ${
              (alert.rul??999) < 30 ? 'text-red-600' : (alert.rul??999) < 60 ? 'text-orange-600' : 'text-yellow-600'}`}>
              {alert.rul ? alert.rul.toFixed(1) : '--'}
              <span className="text-[11px] text-muted font-normal ml-1">cyc</span>
            </span>
          </div>
          <p className="text-sm text-text leading-snug">{alert.action || 'No action recorded.'}</p>
          <div className="flex items-center gap-1.5 mt-2">
            <Clock size={10} className="text-muted"/>
            <p className="text-[10px] text-muted font-mono">{alert.timestamp || '—'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MAIN ALERT CENTER ─────────────────────────────────────────────────────────
export default function AlertCenter() {
  const [alerts,      setAlerts]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [filter,      setFilter]      = useState('ALL');
  const [engineFilter,setEngineFilter]= useState('ALL');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [isLive,      setIsLive]      = useState(false);
  const prevCountRef = useRef(0);

  const load = useCallback(async (silent=false) => {
    if (!silent) setLoading(true);
    try {
      const r = await api.get('/alerts/history');
      const newAlerts = r.data.alerts || [];

      // Detect new critical alert → play sound
      if (newAlerts.length > prevCountRef.current) {
        const newest = newAlerts[0];
        if (newest?.alert_level === 'CRITICAL') playCriticalBeep();
      }
      prevCountRef.current = newAlerts.length;

      setAlerts(newAlerts);
      setLastRefresh(new Date());
      setIsLive(true);
    } catch {
      setIsLive(false);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const iv = setInterval(() => load(true), 5000);
    return () => clearInterval(iv);
  }, [autoRefresh, load]);

  // All unique engines for filter
  const engineIds = ['ALL', ...new Set(alerts.map(a => a.engine_id || 'FD001-A').filter(Boolean))];

  // Apply filters
  const filtered = alerts.filter(a => {
    const levelOk  = filter === 'ALL' || a.alert_level === filter;
    const engineOk = engineFilter === 'ALL' || (a.engine_id || 'FD001-A') === engineFilter;
    return levelOk && engineOk;
  });

  // Stats
  const stats = {
    total:    alerts.length,
    critical: alerts.filter(a => a.alert_level === 'CRITICAL').length,
    warning:  alerts.filter(a => a.alert_level === 'WARNING').length,
    engines:  new Set(alerts.map(a => a.engine_id || 'FD001-A')).size,
  };

  // Export to CSV
  const exportCSV = () => {
    const header = 'Timestamp,Engine ID,Alert Level,RUL (cycles),Cycle,Action\n';
    const rows = alerts.map(a =>
      `"${a.timestamp||''}","${a.engine_id||'FD001-A'}","${a.alert_level||''}",${a.rul?.toFixed(1)||''},${a.cycle||''},"${a.action||''}"`
    ).join('\n');
    const blob = new Blob([header+rows], {type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const el = document.createElement('a');
    el.href = url; el.download = `aerosense_alerts_${Date.now()}.csv`; el.click();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-text flex items-center gap-3">
            <Bell size={24} className="text-accent"/> Alert Center
            {stats.critical > 0 && (
              <span className="text-[11px] font-black bg-red-500 text-white px-2.5 py-0.5 rounded-full animate-pulse">
                {stats.critical} CRITICAL
              </span>
            )}
          </h1>
          <p className="text-muted text-sm mt-1 flex items-center gap-2">
            {isLive
              ? <><Wifi size={12} className="text-green-500"/> Live — auto-refreshes every 5s</>
              : <><WifiOff size={12} className="text-red-500"/> Disconnected</>}
            {lastRefresh && <span className="text-[11px]">· Last: {lastRefresh.toLocaleTimeString()}</span>}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {/* Auto-refresh toggle */}
          <button onClick={()=>setAutoRefresh(p=>!p)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold border transition-all ${
              autoRefresh ? 'bg-green-50 border-green-300 text-green-700' : 'bg-card border-border text-muted'}`}>
            <Activity size={14} className={autoRefresh ? 'animate-pulse text-green-500' : ''}/>
            {autoRefresh ? 'Live' : 'Paused'}
          </button>
          <button onClick={()=>load()}
            className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-xl text-sm font-bold text-muted hover:text-text transition-all">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/>
            Refresh
          </button>
          <button onClick={exportCSV} disabled={alerts.length===0}
            className="flex items-center gap-2 px-3 py-2 bg-accent text-white rounded-xl text-sm font-bold hover:opacity-90 transition-all disabled:opacity-40 shadow-md">
            <Download size={14}/> Export CSV
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Alerts"    value={stats.total}    color="text-accent"        bg="bg-card"        icon={<Bell size={18} className="text-accent"/>}          pulse={false}/>
        <StatCard label="Critical"        value={stats.critical} color="text-red-600"       bg="bg-red-50"      icon={<XCircle size={18} className="text-red-500"/>}       pulse={stats.critical>0}/>
        <StatCard label="Warnings"        value={stats.warning}  color="text-orange-600"    bg="bg-orange-50"   icon={<AlertTriangle size={18} className="text-orange-500"/>} pulse={false}/>
        <StatCard label="Engines Affected"value={stats.engines}  color="text-violet-600"    bg="bg-violet-50"   icon={<Zap size={18} className="text-violet-500"/>}        pulse={false}/>
      </div>

      {/* How it works — info banner */}
      <div className="bg-sky-50 border border-sky-200 rounded-2xl px-5 py-4 mb-5 flex items-start gap-3">
        <div className="p-2 bg-sky-100 rounded-xl shrink-0">
          <Activity size={16} className="text-sky-600"/>
        </div>
        <div>
          <p className="text-sky-800 font-bold text-sm">How Alert Center Works</p>
          <p className="text-sky-700 text-xs mt-0.5 leading-relaxed">
            Alerts are <strong>automatically logged</strong> by the Live Monitor when engine RUL crosses danger thresholds in real-time.
            <strong> Critical</strong> fires when RUL &lt;30 cycles. <strong>Warning</strong> fires when RUL &lt;60 cycles.
            Each alert captures the engine ID, cycle number, exact RUL, and recommended action.
            A <strong>beep sound</strong> plays when a new Critical alert arrives. Logs reset on server restart.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        <div className="flex items-center gap-1.5 text-[10px] text-muted uppercase font-bold mr-2">
          <Filter size={11}/> Filter:
        </div>
        {['ALL','CRITICAL','WARNING'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
              filter===f ? 'bg-accent text-white border-accent shadow-sm' : 'bg-card border-border text-muted hover:text-text'}`}>
            {f} {f!=='ALL'&&`(${stats[f.toLowerCase()]})`}
          </button>
        ))}
        {engineIds.length > 1 && (
          <select value={engineFilter} onChange={e=>setEngineFilter(e.target.value)}
            className="ml-2 px-3 py-1.5 rounded-full text-xs font-bold border border-border bg-card text-muted focus:outline-none focus:border-accent">
            {engineIds.map(e=><option key={e} value={e}>{e==='ALL'?'All Engines':e}</option>)}
          </select>
        )}
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="bg-card border border-border rounded-2xl flex items-center justify-center h-48">
          <RefreshCw size={24} className="animate-spin text-muted"/>
          <span className="ml-3 text-muted font-medium">Loading alert history…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl flex flex-col items-center justify-center h-56 text-center px-6">
          <CheckCircle size={48} className="text-green-400 mb-4"/>
          <p className="font-black text-text text-lg">
            {filter === 'ALL' ? 'No alerts recorded yet' : `No ${filter.toLowerCase()} alerts`}
          </p>
          <p className="text-muted text-sm mt-2 max-w-sm">
            Alerts auto-log when the Live Monitor detects Critical (&lt;30 cycles) or Warning (&lt;60 cycles) conditions.
            Start the live simulation and wait for the RUL to drop below 100 cycles.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Timeline — 2/3 width */}
          <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-sm text-text mb-5 flex items-center gap-2">
              <Clock size={14} className="text-accent"/> Alert Timeline
              <span className="text-muted text-[10px] font-normal">({filtered.length} alerts)</span>
            </h3>
            <div className="space-y-0">
              {filtered.map((a,i) => (
                <TimelineItem key={i} alert={a} isFirst={i===0}/>
              ))}
            </div>
          </div>

          {/* Right sidebar — 1/3 width */}
          <div className="flex flex-col gap-4">

            {/* Alert Level Breakdown */}
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
              <h4 className="font-bold text-xs text-muted uppercase tracking-wider mb-3">Alert Breakdown</h4>
              {[
                {level:'CRITICAL',count:stats.critical, bar:'bg-red-500'},
                {level:'WARNING', count:stats.warning,  bar:'bg-orange-500'},
                {level:'CAUTION', count:alerts.filter(a=>a.alert_level==='CAUTION').length, bar:'bg-yellow-400'},
              ].map(item => (
                <div key={item.level} className="mb-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-muted uppercase">{item.level}</span>
                    <span className="text-sm font-black text-text font-mono">{item.count}</span>
                  </div>
                  <div className="h-2 bg-card2 rounded-full overflow-hidden border border-border">
                    <div className={`h-full rounded-full transition-all duration-500 ${item.bar}`}
                         style={{width: stats.total > 0 ? `${(item.count/stats.total)*100}%` : '0%'}}/>
                  </div>
                </div>
              ))}
            </div>

            {/* Most Recent Critical */}
            {stats.critical > 0 && (() => {
              const latest = filtered.find(a => a.alert_level === 'CRITICAL');
              return latest ? (
                <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 shadow-sm">
                  <p className="text-red-700 font-black text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <XCircle size={12}/> Latest Critical
                  </p>
                  <p className="text-red-600 font-black text-2xl font-mono">{latest.rul?.toFixed(1)} <span className="text-sm font-normal">cyc</span></p>
                  <p className="text-red-700 text-xs mt-1">Engine: {latest.engine_id || 'FD001-A'}</p>
                  <p className="text-red-600 text-[10px] mt-1 font-mono">{latest.timestamp}</p>
                  <p className="text-red-700 text-xs mt-2 leading-snug border-t border-red-200 pt-2">{latest.action}</p>
                </div>
              ) : null;
            })()}

            {/* Live Status */}
            <div className={`rounded-2xl p-4 border shadow-sm ${isLive ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}/>
                <span className={`text-xs font-black ${isLive ? 'text-green-700' : 'text-red-700'}`}>
                  {isLive ? 'Auto-Refresh Active' : 'Connection Lost'}
                </span>
              </div>
              <p className={`text-[10px] ${isLive ? 'text-green-600' : 'text-red-600'}`}>
                {isLive ? `Refreshes every 5s · Sound alert on Critical` : 'Check that backend is running on port 8000'}
              </p>
              {lastRefresh && (
                <p className="text-[10px] text-muted mt-1 font-mono">
                  Last: {lastRefresh.toLocaleTimeString()}
                </p>
              )}
            </div>

            {/* Tips */}
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
              <p className="font-bold text-xs text-muted uppercase tracking-wider mb-2">Tips</p>
              <ul className="space-y-1.5 text-[11px] text-muted">
                <li className="flex items-start gap-1.5"><span className="text-accent mt-0.5">→</span>Alerts fire automatically from Live Monitor</li>
                <li className="flex items-start gap-1.5"><span className="text-red-500 mt-0.5">🔔</span>Critical alerts play a beep sound</li>
                <li className="flex items-start gap-1.5"><span className="text-accent mt-0.5">→</span>Use Export CSV for maintenance reports</li>
                <li className="flex items-start gap-1.5"><span className="text-accent mt-0.5">→</span>Filter by engine or severity level</li>
              </ul>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
