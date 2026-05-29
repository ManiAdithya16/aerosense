import { useState, useEffect, useCallback, useRef } from 'react';
import { Thermometer, RefreshCw, Wifi, WifiOff, AlertTriangle, Activity, Info } from 'lucide-react';
import api from '../services/api';

const STATUS = {
  CRITICAL: { bg:'rgba(220,38,38,0.13)',  text:'#dc2626', border:'rgba(220,38,38,0.35)',  dot:'#dc2626', label:'Critical'  },
  HIGH:     { bg:'rgba(234,88,12,0.13)',  text:'#ea580c', border:'rgba(234,88,12,0.35)',  dot:'#ea580c', label:'High'      },
  ELEVATED: { bg:'rgba(202,138,4,0.12)',  text:'#ca8a04', border:'rgba(202,138,4,0.35)',  dot:'#ca8a04', label:'Elevated'  },
  NORMAL:   { bg:'rgba(22,163,74,0.11)',  text:'#16a34a', border:'rgba(22,163,74,0.35)',  dot:'#16a34a', label:'Normal'    },
  UNKNOWN:  { bg:'rgba(148,163,184,0.08)',text:'#94a3b8', border:'rgba(148,163,184,0.25)',dot:'#94a3b8', label:'N/A'       },
};

const ALERT_TAG = {
  CRITICAL: 'bg-red-100 text-red-700 border-red-300',
  WARNING:  'bg-orange-100 text-orange-700 border-orange-300',
  CAUTION:  'bg-yellow-100 text-yellow-700 border-yellow-300',
  NORMAL:   'bg-green-100 text-green-700 border-green-300',
  UNKNOWN:  'bg-slate-100 text-slate-500 border-slate-200',
};

function HoverCard({ cell }) {
  if (!cell?.anomaly) return null;
  const { anomaly, engineId, sensor } = cell;
  const st = STATUS[anomaly.status] || STATUS.UNKNOWN;
  return (
    <div className="fixed bottom-6 right-6 z-50 border-2 rounded-2xl shadow-2xl p-4 w-64 pointer-events-none"
         style={{ backgroundColor: 'var(--color-card)', borderColor: st.border }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: st.dot }}/>
        <span className="font-black text-sm" style={{ color: 'var(--color-text)' }}>{engineId} · {sensor}</span>
      </div>
      <p className="text-xs mb-3 leading-snug" style={{ color: 'var(--color-muted)' }}>{anomaly.label}</p>
      <div className="space-y-1.5 text-xs">
        {[
          ['Measured',  `${anomaly.value} ${anomaly.unit}`],
          ['Baseline',  `${anomaly.lo}–${anomaly.hi} ${anomaly.unit}`],
          ['Deviation', `${anomaly.deviation.toFixed(2)}σ from center`],
          ['Status',    anomaly.status],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <span style={{ color: 'var(--color-muted)' }}>{k}</span>
            <span className="font-bold font-mono" style={{ color: k === 'Status' ? st.text : 'var(--color-text)' }}>{v}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-card2)' }}>
          <div className="h-full rounded-full transition-all"
               style={{ width:`${anomaly.pct_dev}%`, backgroundColor: st.dot }}/>
        </div>
        <p className="text-[10px] mt-1" style={{ color: 'var(--color-muted)' }}>{anomaly.pct_dev.toFixed(0)}% deviation severity</p>
      </div>
    </div>
  );
}

export default function SensorHeatmap() {
  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [isLive,      setIsLive]      = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [countdown,   setCountdown]   = useState(8);
  const [hoveredCell, setHoveredCell] = useState(null);
  const cdRef = useRef(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const r = await api.get('/fleet/sensors');
      setData(r.data);
      setIsLive(true);
      setLastRefresh(new Date());
      setCountdown(8);
    } catch (e) {
      setIsLive(false);
      if (!silent) setError(e?.response?.data?.detail || 'Backend not reachable. Is the server running?');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const iv = setInterval(() => load(true), 8000);
    return () => clearInterval(iv);
  }, [load]);

  useEffect(() => {
    if (cdRef.current) clearInterval(cdRef.current);
    cdRef.current = setInterval(() => setCountdown(c => (c <= 1 ? 8 : c - 1)), 1000);
    return () => clearInterval(cdRef.current);
  }, [lastRefresh]);

  const engines     = data?.engines      || [];
  const sensorNames = data?.sensor_names || [];

  const fleetStats = (() => {
    if (!engines.length) return null;
    let crit = 0, high = 0, total = 0;
    engines.forEach(e => {
      Object.values(e.anomalies || {}).forEach(a => {
        total++;
        if (a.status === 'CRITICAL') crit++;
        else if (a.status === 'HIGH') high++;
      });
    });
    const health = total > 0 ? Math.round(((total - crit - high) / total) * 100) : 100;
    const worst  = [...engines].sort((a, b) => (b.alert?.urgency ?? 0) - (a.alert?.urgency ?? 0))[0];
    return { crit, high, health, worst, total };
  })();

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-text flex items-center gap-3">
            <Thermometer size={24} className="text-sky-500"/>
            Fleet Sensor Heatmap
            {(fleetStats?.crit ?? 0) > 0 && (
              <span className="text-[11px] font-black bg-red-500 text-white px-2.5 py-0.5 rounded-full animate-pulse">
                {fleetStats.crit} Critical
              </span>
            )}
          </h1>
          <p className="text-muted text-sm mt-1 flex items-center gap-2">
            {isLive
              ? <><Wifi size={12} className="text-green-500"/> Live · next refresh in {countdown}s</>
              : <><WifiOff size={12} className="text-red-500"/> Not connected</>}
            {lastRefresh && <span className="text-[11px]">· {lastRefresh.toLocaleTimeString()}</span>}
          </p>
        </div>
        <button onClick={() => load()}
          className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-xl text-sm font-bold text-muted hover:text-text transition-all shadow-sm">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/> Refresh Now
        </button>
      </div>

      {/* ── Fleet Stats ───────────────────────────────────────────────── */}
      {fleetStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label:'Fleet Health',     value:`${fleetStats.health}%`,
              color: fleetStats.health > 70 ? 'text-green-600' : fleetStats.health > 40 ? 'text-yellow-600' : 'text-red-600',
              bg:'bg-card',      icon:<Activity size={18} className="text-sky-500"/>       },
            { label:'Critical Sensors', value: fleetStats.crit,
              color:'text-red-600',    bg:'bg-red-50',    icon:<AlertTriangle size={18} className="text-red-500"/>       },
            { label:'High Deviation',   value: fleetStats.high,
              color:'text-orange-600', bg:'bg-orange-50', icon:<AlertTriangle size={18} className="text-orange-400"/>    },
            { label:'Most At-Risk',     value: fleetStats.worst?.engine_id || '—',
              color:'text-text',       bg:'bg-card',      icon:<Thermometer size={18} className="text-violet-500"/>      },
          ].map(s => (
            <div key={s.label} className={`${s.bg} border border-border rounded-2xl p-4 flex items-center gap-3 shadow-sm`}>
              <div className="p-2.5 rounded-xl bg-card shadow-sm shrink-0">{s.icon}</div>
              <div>
                <p className="text-muted text-[10px] uppercase tracking-wider font-bold">{s.label}</p>
                <p className={`text-2xl font-black font-mono leading-tight ${s.color}`}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Info strip ───────────────────────────────────────────────── */}
      <div className="bg-sky-50 border border-sky-200 rounded-2xl px-5 py-3 mb-5 flex items-center gap-3 text-sm">
        <Info size={14} className="text-sky-500 shrink-0"/>
        <p className="text-sky-800">
          Each cell shows a sensor's <strong>measured value</strong> and deviation from the
          <strong> NASA C-MAPSS baseline</strong>. Color = severity. Hover a cell for full details.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5 text-red-700 text-sm">{error}</div>
      )}

      {/* ── Heatmap ──────────────────────────────────────────────────── */}
      {loading ? (
        <div className="bg-card border border-border rounded-2xl flex items-center justify-center h-64 shadow-sm">
          <RefreshCw size={28} className="animate-spin text-muted"/>
          <span className="ml-3 text-muted font-medium">Loading fleet sensor data…</span>
        </div>
      ) : engines.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center text-muted shadow-sm">
          No data available. Check that the backend is running and CSV files are present in <code>test_csvs/</code>.
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-border bg-card2 flex items-center gap-3 flex-wrap">
            <h3 className="font-bold text-sm text-text">Sensor Deviation Grid</h3>
            <span className="text-[10px] text-muted bg-card border border-border px-2 py-0.5 rounded-full">
              {engines.length} engines · {sensorNames.length} sensors · {engines.length * sensorNames.length} readings
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="border-collapse w-full" style={{ minWidth: '820px' }}>
              <thead>
                <tr className="border-b border-border bg-card2/50">
                  {/* sticky engine header */}
                  <th className="sticky left-0 z-10 bg-card2 px-4 py-2.5 text-left text-[10px] text-muted uppercase font-bold tracking-wider border-r border-border min-w-[110px]">
                    Engine
                  </th>
                  <th className="px-3 py-2.5 text-[10px] text-muted uppercase font-bold tracking-wider text-center border-r border-border min-w-[52px]">
                    RUL
                  </th>
                  {sensorNames.map(s => (
                    <th key={s} className="px-2 py-2.5 text-[10px] text-muted font-bold tracking-wider text-center min-w-[58px]">
                      {s}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {engines.map((eng, ri) => (
                  <tr key={eng.engine_id}
                      className={ri < engines.length - 1 ? 'border-b border-border' : ''}>
                    {/* Engine label — sticky */}
                    <td className="sticky left-0 z-10 bg-card px-4 py-3 border-r border-border">
                      <p className="font-black text-xs font-mono text-text">{eng.engine_id}</p>
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full border mt-1 inline-block
                                        ${ALERT_TAG[eng.alert?.level] || ALERT_TAG.UNKNOWN}`}>
                        {eng.alert?.level || 'UNKNOWN'}
                      </span>
                    </td>
                    {/* RUL */}
                    <td className="px-3 py-3 text-center border-r border-border">
                      <span className={`text-sm font-black font-mono ${
                        (eng.rul ?? 999) < 30  ? 'text-red-600'    :
                        (eng.rul ?? 999) < 60  ? 'text-orange-500' :
                        (eng.rul ?? 999) < 100 ? 'text-yellow-600' : 'text-green-600'}`}>
                        {eng.rul != null ? eng.rul.toFixed(0) : '—'}
                      </span>
                      <p className="text-[9px] text-muted leading-none mt-0.5">cyc</p>
                    </td>
                    {/* Sensor cells */}
                    {sensorNames.map(sensor => {
                      const a  = eng.anomalies?.[sensor];
                      const st = STATUS[a?.status || 'UNKNOWN'];
                      return (
                        <td key={sensor}
                            style={{ backgroundColor: st.bg, padding: '4px 3px' }}
                            className="cursor-pointer"
                            onMouseEnter={() => setHoveredCell({ sensor, engineId: eng.engine_id, anomaly: a })}
                            onMouseLeave={() => setHoveredCell(null)}>
                          <div className="flex flex-col items-center justify-center rounded-lg py-2 px-1 transition-all"
                               style={{ border:`1px solid ${st.border}`, minHeight:'46px' }}>
                            <div className="w-2 h-2 rounded-full mb-1" style={{ backgroundColor: st.dot }}/>
                            <span className="text-[9px] font-bold font-mono leading-none" style={{ color: st.text }}>
                              {a ? a.value.toFixed(1) : '—'}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Legend ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-5 mt-4 flex-wrap">
        <span className="text-[10px] text-muted uppercase font-bold tracking-wider">Legend:</span>
        {Object.entries(STATUS).filter(([k]) => k !== 'UNKNOWN').map(([status, st]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: st.dot }}/>
            <span className="text-xs text-muted">{st.label}</span>
          </div>
        ))}
        <span className="text-[10px] text-muted ml-2 italic">
          · Cell value = sensor reading · Bands from NASA C-MAPSS baselines
        </span>
      </div>

      {/* ── Hover card ───────────────────────────────────────────────── */}
      <HoverCard cell={hoveredCell}/>
    </div>
  );
}
