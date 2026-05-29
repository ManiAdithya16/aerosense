import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';
import {
  Send, Activity, ShieldAlert, Cpu,
  AlertTriangle, CheckCircle, AlertCircle, XCircle,
  Calendar, Zap, Wind, Thermometer, Gauge, Radio, Copy, Clock
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import api from '../services/api';

// ── Constants ─────────────────────────────────────────────────────────────────
const TIP = {
  backgroundColor: 'var(--color-card)',
  borderColor:     'var(--color-border)',
  borderRadius:    '8px',
  fontSize:        '11px',
  color:           'var(--color-text)',
};

const ALERT_META = {
  CRITICAL: { bg:'bg-red-50',    border:'border-red-400',    text:'text-red-600',    dot:'bg-red-500',    Icon:XCircle,       pulse:true  },
  WARNING:  { bg:'bg-orange-50', border:'border-orange-400', text:'text-orange-600', dot:'bg-orange-500', Icon:AlertTriangle, pulse:true  },
  CAUTION:  { bg:'bg-yellow-50', border:'border-yellow-400', text:'text-yellow-700', dot:'bg-yellow-400', Icon:AlertCircle,   pulse:false },
  NORMAL:   { bg:'bg-green-50',  border:'border-green-400',  text:'text-green-600',  dot:'bg-green-500',  Icon:CheckCircle,   pulse:false },
};
const am = (lv) => ALERT_META[lv] ?? ALERT_META.NORMAL;
const rulColor = (r) => r > 100 ? 'text-green-600' : r > 60 ? 'text-yellow-600' : r > 30 ? 'text-orange-500' : 'text-red-600';

// ── Pure CSS health ring ──────────────────────────────────────────────────────
const HealthRing = memo(function HealthRing({ score }) {
  const pct   = Math.max(0, Math.min(100, score || 0));
  const color  = pct > 70 ? '#16a34a' : pct > 40 ? '#d97706' : '#dc2626';
  const dash   = 2 * Math.PI * 28;
  const offset = dash * (1 - pct / 100);
  return (
    <div className="relative flex items-center justify-center" style={{ width: 80, height: 80 }}>
      <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="40" cy="40" r="28" fill="none" stroke="var(--color-border)" strokeWidth="8"/>
        <circle cx="40" cy="40" r="28" fill="none" stroke={color} strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={dash} strokeDashoffset={offset}
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}/>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-lg font-black font-mono leading-none" style={{ color }}>{pct.toFixed(0)}</span>
        <span className="text-[9px] text-muted">/100</span>
      </div>
    </div>
  );
});

// ── Simple bar grid for component health ─────────────────────────────────────
const ComponentBars = memo(function ComponentBars({ components }) {
  if (!components?.length) return null;
  return (
    <div className="grid grid-cols-3 gap-2">
      {components.map(c => {
        const pct = c.health;
        const color = pct > 70 ? '#16a34a' : pct > 40 ? '#d97706' : '#dc2626';
        return (
          <div key={c.component} className="bg-card2 border border-border rounded-xl p-2.5">
            <p className="text-[9px] font-bold text-muted uppercase truncate">{c.component}</p>
            <p className="text-sm font-black font-mono mt-0.5" style={{ color }}>{pct}</p>
            <div className="h-1.5 bg-card rounded-full mt-1.5 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color,
                             transition: 'width 0.5s ease' }}/>
            </div>
            <p className="text-[8px] mt-0.5" style={{ color }}>{c.status}</p>
          </div>
        );
      })}
    </div>
  );
});

// ── Alert Banner ──────────────────────────────────────────────────────────────
const AlertBanner = memo(function AlertBanner({ alert }) {
  if (!alert) return null;
  const s = am(alert.level);
  return (
    <div className={`${s.bg} border-2 ${s.border} rounded-xl px-4 py-3 flex items-center gap-3`}>
      <div className={`p-1.5 rounded-lg bg-white/60 ${s.pulse ? 'animate-pulse' : ''}`}>
        <s.Icon size={18} className={s.text}/>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-[9px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full
                            text-white ${s.dot.replace('bg-','bg-')}`}>{alert.level}</span>
        </div>
        <p className={`text-xs font-medium leading-snug ${s.text}`}>{alert.action}</p>
      </div>
      <p className="text-[9px] text-muted font-mono shrink-0">{new Date().toLocaleTimeString()}</p>
    </div>
  );
});

// ── Fleet engine card ─────────────────────────────────────────────────────────
const EngineCard = memo(function EngineCard({ engine, isActive, onClick }) {
  const s = am(engine.alert_level);
  const rul = engine.rul != null ? engine.rul.toFixed(0) : '--';
  const pct = engine.rul != null ? Math.min(100, (engine.rul / 125) * 100) : 0;
  const barColor = engine.alert_level === 'CRITICAL' ? '#dc2626'
                 : engine.alert_level === 'WARNING'  ? '#ea580c'
                 : engine.alert_level === 'CAUTION'  ? '#ca8a04' : '#16a34a';
  return (
    <button onClick={onClick}
      className={`flex-1 rounded-xl text-left transition-all duration-200 overflow-hidden
        ${isActive ? 'shadow-lg ring-2 ring-offset-1' : 'shadow-sm hover:shadow-md hover:-translate-y-0.5'}`}
      style={{
        backgroundColor: 'var(--color-card)',
        border: `1.5px solid ${isActive ? barColor : 'var(--color-border)'}`,
        ringColor: barColor,
      }}>

      {/* Coloured top accent bar */}
      <div className="h-1 w-full" style={{ backgroundColor: barColor }}/>

      <div className="p-3">
        {/* Engine ID + status icon */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] font-black tracking-widest font-mono"
                style={{ color: 'var(--color-muted)' }}>{engine.engine_id}</span>
          <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${s.bg} ${s.text}`}>
            {engine.alert_level}
          </span>
        </div>

        {/* RUL value */}
        <div className="flex items-baseline gap-1 mb-2">
          <span className="text-2xl font-black font-mono leading-none" style={{ color: barColor }}>{rul}</span>
          <span className="text-[10px] font-semibold" style={{ color: 'var(--color-muted)' }}>cyc</span>
        </div>

        {/* Progress bar */}
        <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
          <div className="h-full rounded-full transition-all duration-700"
               style={{ width: `${pct}%`, backgroundColor: barColor }}/>
        </div>
      </div>
    </button>
  );
});

// ── Flight Conditions strip ───────────────────────────────────────────────────
const FlightConditions = memo(function FlightConditions({ conditions }) {
  if (!conditions) return null;
  const items = [
    { Icon: Wind,        label: 'Altitude', value: (conditions.altitude_ft || 35000).toLocaleString(), unit: 'ft'  },
    { Icon: Gauge,       label: 'Phase',    value: conditions.phase || 'Cruise',                       unit: ''    },
    { Icon: Thermometer, label: 'OAT',      value: `${conditions.oat_celsius || '-56'}`,               unit: '°C'  },
    { Icon: Activity,    label: 'Thrust',   value: `${conditions.thrust_setting_pct || 88}`,           unit: '%'   },
    { Icon: Zap,         label: 'Mach',     value: conditions.mach || '0.85',                          unit: ''    },
  ];
  return (
    <div className="rounded-xl border overflow-hidden shadow-sm"
         style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
      <div className="flex items-stretch">

        {/* Left badge */}
        <div className="flex flex-col items-center justify-center px-4 shrink-0"
             style={{ background: 'linear-gradient(160deg,#0ea5e9 0%,#0369a1 100%)', minWidth: 64 }}>
          <span className="text-xl mb-0.5">✈️</span>
          <span className="text-[8px] font-black text-white/90 uppercase tracking-widest">Flight</span>
        </div>

        {/* Stats */}
        {items.map(({ Icon, label, value, unit }, i) => (
          <div key={label}
               className="flex-1 flex flex-col items-center justify-center py-3 px-2 transition-colors hover:bg-card2"
               style={{ borderLeft: '1px solid var(--color-border)' }}>
            <div className="flex items-center gap-1 mb-1">
              <Icon size={11} className="text-sky-500"/>
              <span className="text-[9px] font-bold uppercase tracking-wider"
                    style={{ color: 'var(--color-muted)' }}>{label}</span>
            </div>
            <p className="text-sm font-black font-mono leading-none" style={{ color: 'var(--color-text)' }}>
              {value}
              {unit && <span className="text-[10px] font-semibold ml-0.5" style={{ color: 'var(--color-muted)' }}>{unit}</span>}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
});

// ── Health Trend Panel ────────────────────────────────────────────────────────
const HealthTrendPanel = memo(function HealthTrendPanel({ trend }) {
  if (!trend || (trend.snapshot_history?.length ?? 0) < 2) return null;
  const zones = [
    { label: 'Warning',  v: trend.cycles_to_warning,  c: 'text-yellow-600' },
    { label: 'Critical', v: trend.cycles_to_critical, c: 'text-orange-600' },
    { label: 'Failure',  v: trend.cycles_to_failure,  c: 'text-red-600' },
  ];
  const tcColor = trend.trend_color === 'red' ? 'text-red-600'
                : trend.trend_color === 'green' ? 'text-green-600' : 'text-yellow-600';
  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm text-text flex items-center gap-2">
          <Activity size={14} className="text-sky-500"/> Health Trend
        </h3>
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border
          ${trend.confidence === 'High' ? 'border-green-300 bg-green-50 text-green-700'
          : trend.confidence === 'Medium' ? 'border-yellow-300 bg-yellow-50 text-yellow-700'
          : 'border-slate-200 bg-slate-50 text-muted'}`}>
          {trend.confidence} Confidence
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="flex flex-col items-center bg-card2 rounded-xl py-3 border border-border">
          <p className="text-[8px] text-muted uppercase mb-2">Health Score</p>
          <HealthRing score={trend.health_score}/>
        </div>

        <div className="flex flex-col gap-2">
          <div className="bg-card2 rounded-lg p-2 border border-border">
            <p className="text-[8px] text-muted uppercase">Degradation</p>
            <p className="text-sm font-black font-mono text-orange-500 mt-0.5">
              {trend.degradation_rate.toFixed(3)}
              <span className="text-[9px] text-muted font-normal ml-1">RUL/cyc</span>
            </p>
          </div>
          <div className="bg-card2 rounded-lg p-2 border border-border">
            <p className="text-[8px] text-muted uppercase">Trend</p>
            <p className={`text-xs font-bold mt-0.5 ${tcColor}`}>{trend.trend_label}</p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-[8px] text-muted uppercase font-bold">Cycles to danger</p>
          {zones.map(z => (
            <div key={z.label} className="bg-card2 rounded-lg px-2.5 py-1.5 flex justify-between border border-border">
              <span className="text-[9px] text-muted">{z.label}</span>
              <span className={`text-[9px] font-bold font-mono ${z.c}`}>
                {z.v === 0 ? 'NOW' : z.v != null ? `${z.v}` : '--'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="h-28">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trend.snapshot_history} margin={{ top:4, right:16, bottom:0, left:-20 }}>
            <defs>
              <linearGradient id="tG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#0284c7" stopOpacity={0.18}/>
                <stop offset="95%" stopColor="#0284c7" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false}/>
            <XAxis dataKey="cycle" stroke="var(--color-muted)" fontSize={9} tickLine={false} axisLine={false}/>
            <YAxis stroke="var(--color-muted)" fontSize={9} tickLine={false} axisLine={false} domain={['auto','auto']}/>
            <Tooltip contentStyle={TIP} formatter={v => [`${v} cyc`, 'RUL']}/>
            <ReferenceLine y={60} stroke="#d97706" strokeDasharray="3 3" strokeWidth={1}/>
            <ReferenceLine y={30} stroke="#dc2626" strokeDasharray="3 3" strokeWidth={1}/>
            <Area type="monotone" dataKey="rul" stroke="#0284c7" strokeWidth={2}
                  fill="url(#tG)" dot={false} isAnimationActive={false}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

// ── Sensor Anomaly Panel ──────────────────────────────────────────────────────
const SensorAnomalyPanel = memo(function SensorAnomalyPanel({ anomalies }) {
  if (!anomalies?.length) return null;
  const top5 = anomalies.slice(0, 5);
  const critCount = anomalies.filter(a => a.status === 'CRITICAL').length;
  const devColor = (s) => s === 'CRITICAL' ? '#dc2626' : s === 'HIGH' ? '#ea580c'
                        : s === 'ELEVATED' ? '#ca8a04' : '#16a34a';
  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm text-text flex items-center gap-2">
          <ShieldAlert size={14} className="text-yellow-500"/> Sensor Anomalies
        </h3>
        {critCount > 0
          ? <span className="text-[9px] bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full font-bold">{critCount} Critical</span>
          : <span className="text-[9px] bg-green-50 text-green-600 border border-green-200 px-2 py-0.5 rounded-full font-bold">All Normal</span>
        }
      </div>
      <div className="space-y-2">
        {top5.map(s => (
          <div key={s.sensor} className="grid grid-cols-12 gap-2 items-center py-1 px-2 rounded-lg hover:bg-card2 transition-colors">
            <span className="col-span-1 text-base">{s.badge}</span>
            <div className="col-span-3">
              <p className="text-xs font-bold font-mono text-text">{s.sensor}</p>
              <p className="text-[8px] text-muted truncate">{s.label}</p>
            </div>
            <p className="col-span-2 text-right text-xs font-black font-mono" style={{ color: devColor(s.status) }}>
              {s.value}<span className="text-[8px] text-muted font-normal ml-0.5">{s.unit}</span>
            </p>
            <div className="col-span-4">
              <div className="h-1.5 bg-card2 rounded-full overflow-hidden border border-border">
                <div className="h-full rounded-full" style={{ width: `${s.pct_dev}%`, backgroundColor: devColor(s.status) }}/>
              </div>
              <p className="text-[8px] text-muted mt-0.5">{s.status} · {s.deviation.toFixed(1)}σ</p>
            </div>
            <p className="col-span-2 text-[8px] text-muted text-right">{s.lo}–{s.hi}</p>
          </div>
        ))}
      </div>
    </div>
  );
});

// ── Maintenance Panel ─────────────────────────────────────────────────────────
const MaintenancePanel = memo(function MaintenancePanel({ maintenance, alert: al }) {
  if (!maintenance) return null;
  const urgent = al?.level === 'CRITICAL' || al?.level === 'WARNING';
  return (
    <div className={`bg-card border-2 ${urgent ? 'border-orange-300' : 'border-border'} rounded-xl p-4 shadow-sm`}>
      <h3 className="font-bold text-sm text-text flex items-center gap-2 mb-3">
        <Calendar size={14} className="text-sky-500"/> Maintenance Schedule
      </h3>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { label: 'Failure In',      main: maintenance.days_until_failure,        sub: 'days',   color: rulColor(maintenance.rul_cycles) },
          { label: 'Maint. Deadline', main: maintenance.maintenance_recommended_by, sub: `${maintenance.days_until_maintenance}d left`, color: 'text-text' },
          { label: 'Failure Date',    main: maintenance.estimated_failure_date,     sub: `${maintenance.flights_per_day} flights/day`, color: 'text-text' },
        ].map(c => (
          <div key={c.label} className="bg-card2 rounded-lg p-2.5 text-center border border-border">
            <p className="text-[8px] text-muted uppercase tracking-wider mb-1">{c.label}</p>
            <p className={`text-sm font-black font-mono leading-tight ${c.color}`}>{c.main}</p>
            <p className="text-[8px] text-muted mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>
      <div className="h-1.5 bg-card2 rounded-full overflow-hidden border border-border">
        <div className={`h-full rounded-full transition-all duration-700
          ${al?.level === 'CRITICAL' ? 'bg-red-500 w-full'
          : al?.level === 'WARNING'  ? 'bg-orange-500 w-3/4'
          : al?.level === 'CAUTION'  ? 'bg-yellow-400 w-1/2' : 'bg-green-500 w-1/4'}`}/>
      </div>
    </div>
  );
});

// ── Pilot QRH ────────────────────────────────────────────────────────────────
const QRH = {
  CRITICAL: { bg:'bg-red-700', border:'border-red-500', text:'text-white', badgeBg:'bg-red-900', badge:'EMERGENCY',
    steps:['THRUST LEVER — REDUCE 15% IMMEDIATELY','DECLARE PAN-PAN TO ATC — report engine degradation','DIVERT — identify nearest suitable airport','ENGINE INSTRUMENTS — monitor T50, P30 and N1 continuously'] },
  WARNING:  { bg:'bg-orange-600', border:'border-orange-400', text:'text-white', badgeBg:'bg-orange-800', badge:'ABNORMAL',
    steps:['THRUST — reduce 8%, monitor for further degradation','SENSOR WATCH — observe T50 and P30 trends each cycle','MAINTENANCE CONTROL — notify; declare AOG if RUL drops below 30'] },
  CAUTION:  { bg:'bg-yellow-500', border:'border-yellow-300', text:'text-yellow-950', badgeBg:'bg-yellow-700', badge:'ADVISORY',
    steps:['MONITOR — log T50 and P30 readings each cycle','MAINTENANCE — schedule inspection at next station'] },
};

const PilotActionPanel = memo(function PilotActionPanel({ alert }) {
  const level = alert?.level;
  const q = QRH[level];
  if (!q) return null;
  return (
    <div className={`${q.bg} border-2 ${q.border} rounded-xl px-4 py-3 shadow-lg`}>
      <div className="flex items-center gap-2 mb-2">
        <Radio size={14} className={q.text}/>
        <span className={`font-black text-xs tracking-wide ${q.text}`}>PILOT ACTION — QRH</span>
        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${q.badgeBg} ${q.text} ml-auto`}>{q.badge}</span>
      </div>
      <ol className="space-y-1">
        {q.steps.map((step, i) => (
          <li key={i} className={`flex items-start gap-2 text-xs font-semibold ${q.text}`}>
            <span className={`shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black ${q.badgeBg}`}>{i+1}</span>
            <span className="leading-snug">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
});

// ── What-If Simulator ─────────────────────────────────────────────────────────
const WhatIfSimulator = memo(function WhatIfSimulator({ trend, currentRul }) {
  const [extra, setExtra] = useState(10);
  if (!trend || !currentRul) return null;
  const rate = trend.degradation_rate || 0.1;
  const proj = Math.max(0, currentRul - rate * extra);
  const getLevel = r => r < 30 ? 'CRITICAL' : r < 60 ? 'WARNING' : r < 100 ? 'CAUTION' : 'NORMAL';
  const curLev  = getLevel(currentRul);
  const projLev = getLevel(proj);
  const s = am(projLev);
  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
      <h3 className="font-bold text-sm text-text flex items-center gap-2 mb-3">
        <Zap size={14} className="text-violet-500"/> What-If Simulator
      </h3>
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs text-muted">Additional cycles without maintenance</span>
          <span className="text-lg font-black text-accent font-mono">{extra}</span>
        </div>
        <input type="range" min={1} max={80} value={extra} onChange={e => setExtra(+e.target.value)}
               className="w-full h-2 rounded-full appearance-none cursor-pointer"
               style={{ accentColor: 'var(--color-accent)' }}/>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className={`${am(curLev).bg} border ${am(curLev).border} rounded-xl p-3 text-center`}>
          <p className="text-[9px] text-muted uppercase mb-1">Now</p>
          <p className={`text-xl font-black font-mono ${am(curLev).text}`}>{currentRul.toFixed(1)}</p>
          <p className="text-[8px] text-muted">cyc RUL</p>
        </div>
        <div className={`${s.bg} border-2 ${s.border} rounded-xl p-3 text-center`}>
          <p className="text-[9px] text-muted uppercase mb-1">After {extra} cycles</p>
          <p className={`text-xl font-black font-mono ${s.text}`}>{proj.toFixed(1)}</p>
          <p className="text-[8px] text-muted">cyc RUL</p>
        </div>
      </div>
      {projLev !== curLev && projLev !== 'NORMAL' && (
        <div className="bg-red-50 border border-red-300 rounded-lg px-3 py-2 flex items-start gap-2">
          <AlertTriangle size={13} className="text-red-500 mt-0.5 shrink-0"/>
          <p className="text-red-700 text-xs">Status escalates: <strong>{curLev} → {projLev}</strong></p>
        </div>
      )}
    </div>
  );
});

// ── Failure Mode Panel ────────────────────────────────────────────────────────
const FailureModePanel = memo(function FailureModePanel({ modes }) {
  if (!modes?.length) return null;
  const barColor = p => p > 60 ? '#dc2626' : p > 35 ? '#ea580c' : '#d97706';
  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
      <h3 className="font-bold text-sm text-text flex items-center gap-2 mb-3">
        <ShieldAlert size={14} className="text-red-500"/> Failure Mode Analysis
      </h3>
      <div className="space-y-3">
        {modes.map((m, i) => (
          <div key={m.id} className="border border-border rounded-lg p-3 bg-card2">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div>
                <p className="text-xs font-bold text-text">{m.name}</p>
                <p className="text-[9px] text-muted">{m.description}</p>
              </div>
              <p className="text-lg font-black font-mono shrink-0" style={{ color: barColor(m.confidence_pct) }}>
                {m.confidence_pct.toFixed(0)}%
              </p>
            </div>
            <div className="h-1.5 bg-card rounded-full overflow-hidden mb-1.5">
              <div className="h-full rounded-full" style={{ width: `${m.confidence_pct}%`, backgroundColor: barColor(m.confidence_pct) }}/>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[9px] font-bold bg-card border border-border text-text px-1.5 py-0.5 rounded-full">{m.component}</span>
              {m.implicated_sensors.map(s => (
                <span key={s} className="text-[8px] font-mono bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded-full">{s}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

// ── Component Health ──────────────────────────────────────────────────────────
const ComponentHealth = memo(function ComponentHealth({ components, overall }) {
  if (!components?.length) return null;
  const color = overall > 70 ? '#16a34a' : overall > 40 ? '#d97706' : '#dc2626';
  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm text-text flex items-center gap-2">
          <Activity size={14} className="text-sky-500"/> Component Health
        </h3>
        {overall != null && (
          <span className="text-lg font-black font-mono" style={{ color }}>
            {overall.toFixed(0)}<span className="text-xs text-muted font-normal">/100</span>
          </span>
        )}
      </div>
      <ComponentBars components={components}/>
    </div>
  );
});

// ── SHAP bar ──────────────────────────────────────────────────────────────────
const ShapPanel = memo(function ShapPanel({ shapData }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
      <h3 className="font-bold text-sm text-text flex items-center gap-2 mb-3">
        <ShieldAlert size={14} className="text-yellow-500"/> Real-time SHAP Risk Factors
      </h3>
      <div className="h-40">
        {shapData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={shapData} layout="vertical" margin={{ top:0, right:12, bottom:0, left:16 }}>
              <XAxis type="number" hide/>
              <YAxis dataKey="feature" type="category" stroke="var(--color-muted)"
                     fontSize={11} width={55} tickLine={false} axisLine={false}/>
              <Tooltip contentStyle={TIP} formatter={v => [v.toFixed(4), 'SHAP']}/>
              <Bar dataKey="value" radius={[0,5,5,0]} isAnimationActive={false} maxBarSize={16}>
                {shapData.map((e, i) => <Cell key={i} fill={e.value > 0 ? '#16a34a' : '#dc2626'}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-muted text-sm">Waiting for SHAP…</div>
        )}
      </div>
    </div>
  );
});

// ── MAIN DASHBOARD ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [live, setLive] = useState({
    rul: 150, cycle: 0, alert: null, maintenance: null, trend: null,
    anomalies: [], flightConditions: null, shapData: [], payload: null,
  });
  const chartBuf = useRef([]);
  const [chartData, setChartData] = useState([]);

  const [engines,      setEngines]      = useState([]);
  const [activeEngine, setActiveEngine] = useState('FD001-A');
  const [engLoading,   setEngLoading]   = useState(true);
  const [wsStatus,     setWsStatus]     = useState('Connecting…');

  const [failModes,   setFailModes]   = useState([]);
  const [compHealth,  setCompHealth]  = useState({ components: [], overall: null });
  const lastFetchCycle = useRef(-1);

  const [messages, setMessages] = useState([{
    role: 'ai',
    content: '**AEROSENSE Online.** I have full access to live sensor telemetry, SHAP risk factors, health trend, anomaly data, flight conditions, alerts, and maintenance schedule. Ask anything.',
  }]);
  const [input,    setInput]    = useState('');
  const [chatBusy, setChatBusy] = useState(false);

  const messagesRef  = useRef(null);
  const wsRef        = useRef(null);
  const reconTimer   = useRef(null);
  const unmounted    = useRef(false);
  const sendMsgRef   = useRef(null);

  // WebSocket
  const connectWS = useCallback(() => {
    if (unmounted.current || (wsRef.current && wsRef.current.readyState < 2)) return;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${location.host}/ws/simulate`);
    wsRef.current = ws;
    ws.onopen  = () => { if (!unmounted.current) setWsStatus('Connected'); };
    ws.onclose = () => {
      if (unmounted.current) return;
      setWsStatus('Reconnecting…');
      reconTimer.current = setTimeout(() => { if (!unmounted.current) connectWS(); }, 3000);
    };
    ws.onerror = () => ws.close();
    ws.onmessage = ({ data: raw }) => {
      if (unmounted.current) return;
      try {
        const msg = JSON.parse(raw);
        if (msg.error || msg.cycle === undefined) return;

        const rul   = +msg.RUL.toFixed(1);
        const cycle = msg.cycle;
        const shap  = msg.shap_scores
          ? Object.entries(msg.shap_scores)
              .map(([f, v]) => ({ feature: f, value: v }))
              .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
              .slice(0, 5)
          : [];

        setLive({ rul, cycle, alert: msg.alert || null, maintenance: msg.maintenance || null,
                  trend: msg.health_trend || null, anomalies: msg.anomalies || [],
                  flightConditions: msg.flight_conditions || null, shapData: shap, payload: msg });

        chartBuf.current = [...chartBuf.current.slice(-49), { cycle, rul }];
        if (cycle % 3 === 0) setChartData([...chartBuf.current]);

        if (msg.alert && (msg.alert.level === 'CRITICAL' || msg.alert.level === 'WARNING'))
          api.post('/alerts/log', { engine_id: 'FD001-A', rul: msg.RUL, alert_level: msg.alert.level, cycle }).catch(() => {});
      } catch {}
    };
  }, []);

  useEffect(() => {
    unmounted.current = false;
    const t = setTimeout(connectWS, 120);
    return () => {
      unmounted.current = true;
      clearTimeout(t);
      clearTimeout(reconTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connectWS]);

  // Fleet status — every 30s
  useEffect(() => {
    const load = async () => {
      try { const r = await api.get('/engines/status'); setEngines(r.data.engines || []); }
      catch {} finally { setEngLoading(false); }
    };
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, []);

  // Failure modes + component health — every 5 cycles
  useEffect(() => {
    const cycle = live.cycle;
    if (!activeEngine || cycle === undefined) return;
    if (cycle === lastFetchCycle.current || cycle % 5 !== 0) return;
    lastFetchCycle.current = cycle;
    api.get(`/failure/classify?engine_id=${activeEngine}`)
      .then(r => setFailModes(r.data.modes || []))
      .catch(() => {});
    api.get(`/engine/component_health?engine_id=${activeEngine}`)
      .then(r => setCompHealth({ components: r.data.components || [], overall: r.data.overall_health }))
      .catch(() => {});
  }, [live.cycle, activeEngine]);

  // Prefill from Emergency QRH
  useEffect(() => {
    const prefill = sessionStorage.getItem('aerosense_prefill');
    if (prefill) {
      sessionStorage.removeItem('aerosense_prefill');
      const t = setTimeout(() => { if (sendMsgRef.current) sendMsgRef.current(prefill); }, 2500);
      return () => clearTimeout(t);
    }
  }, []);

  // Scroll chat to bottom on new messages (only scrolls the messages container)
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  // Chat send
  const sendMessage = useCallback(async (queryText) => {
    const q = queryText.trim();
    if (!q || chatBusy) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: q }]);
    setChatBusy(true);
    try {
      const { rul, cycle, alert, maintenance, trend, flightConditions, payload } = live;
      const ctx = { ...(payload || {}), cycle, RUL: rul, engine_id: activeEngine,
                    top_features: payload?.top_features ?? {}, shap_scores: payload?.shap_scores ?? {},
                    sensors: payload?.sensors ?? {}, alert: alert ?? {},
                    maintenance: maintenance ?? {}, health_trend: trend ?? {},
                    flight_conditions: flightConditions ?? {} };
      const res = await api.post('/chat', { query: q, context: ctx });
      setMessages(prev => [...prev, { role: 'ai', content: res.data.response, followups: res.data.followups || [] }]);
    } catch {
      setMessages(prev => [...prev, { role: 'ai', content: 'Communication error with AEROSENSE mainframe.', followups: [] }]);
    } finally {
      setChatBusy(false);
    }
  }, [chatBusy, live, activeEngine]);

  sendMsgRef.current = sendMessage;

  const { rul, cycle, alert, maintenance, trend, anomalies, flightConditions, shapData } = live;

  return (
    <div className="flex gap-4 p-4 overflow-hidden" style={{ height: '100vh', backgroundColor: 'var(--color-bg)' }}>

      {/* ── Left: scrollable telemetry panels ─────────────────────────── */}
      <div className="flex-1 min-w-0 overflow-y-auto flex flex-col gap-3 pb-4">

        <AlertBanner alert={alert}/>
        <PilotActionPanel alert={alert}/>

        {/* Fleet */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9px] text-muted uppercase tracking-widest font-bold">Fleet Status</p>
            {!engLoading && engines.length > 0 && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-200">
                {engines.length} engines monitored
              </span>
            )}
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(engines.length, 4)}, 1fr)` }}>
            {engLoading
              ? [1,2,3,4].map(i => <div key={i} className="bg-card border border-border rounded-xl h-24 animate-pulse"/>)
              : engines.map(eng => (
                  <EngineCard key={eng.engine_id} engine={eng}
                              isActive={eng.engine_id === activeEngine}
                              onClick={() => setActiveEngine(eng.engine_id)}/>
                ))
            }
          </div>
        </div>

        <FlightConditions conditions={flightConditions}/>

        {/* Live RUL chart */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-base font-black text-text flex items-center gap-2">
                <Activity size={15} className="text-sky-500"/> Live Telemetry
              </h2>
              <p className="text-[10px] text-muted flex items-center gap-1.5 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${wsStatus === 'Connected' ? 'bg-green-500' : 'bg-red-500'}`}/>
                {wsStatus}
              </p>
            </div>
            <div className="flex gap-2">
              <div className="bg-card2 border border-border px-3 py-1.5 rounded-lg flex items-center gap-2">
                <Cpu size={12} className="text-sky-500"/>
                <div>
                  <p className="text-[8px] text-muted uppercase">Engine</p>
                  <p className="text-xs font-black font-mono text-text">{activeEngine}</p>
                </div>
              </div>
              <div className="bg-card2 border border-border px-3 py-1.5 rounded-lg flex items-center gap-2">
                <Activity size={12} className="text-green-500"/>
                <div>
                  <p className="text-[8px] text-muted uppercase">RUL</p>
                  <p className={`text-sm font-black font-mono ${rulColor(rul)}`}>
                    {rul.toFixed(1)} <span className="text-[9px] text-muted font-normal">cyc</span>
                  </p>
                </div>
                <Link to="/xgboost-model"
                      className="text-[8px] font-black uppercase tracking-wider bg-sky-50 text-sky-700
                                 border border-sky-200 hover:bg-sky-100 px-2 py-0.5 rounded-full transition-colors">
                  Model
                </Link>
              </div>
            </div>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top:4, right:8, bottom:0, left:-15 }}>
                <defs>
                  <linearGradient id="rG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#0284c7" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false}/>
                <XAxis dataKey="cycle" stroke="var(--color-muted)" fontSize={11} tickLine={false} axisLine={false}/>
                <YAxis stroke="var(--color-muted)" fontSize={11} tickLine={false} axisLine={false} domain={[0,220]}/>
                <ReferenceLine y={100} stroke="#16a34a" strokeDasharray="4 4" strokeWidth={1}/>
                <ReferenceLine y={60}  stroke="#d97706" strokeDasharray="4 4" strokeWidth={1}/>
                <ReferenceLine y={30}  stroke="#dc2626" strokeDasharray="4 4" strokeWidth={1}/>
                <Tooltip contentStyle={TIP} formatter={v => [`${v} cycles`, 'Predicted RUL']}/>
                <Area type="monotone" dataKey="rul" stroke="#0284c7" strokeWidth={2.5}
                      fill="url(#rG)" isAnimationActive={false} dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <HealthTrendPanel trend={trend}/>
        <WhatIfSimulator trend={trend} currentRul={rul}/>
        <SensorAnomalyPanel anomalies={anomalies}/>
        <MaintenancePanel maintenance={maintenance} alert={alert}/>
        <ShapPanel shapData={shapData}/>
        <FailureModePanel modes={failModes}/>
        <ComponentHealth components={compHealth.components} overall={compHealth.overall}/>
      </div>

      {/* ── Right: AI chat panel (full height, no scroll on outer page) ── */}
      <div className="flex flex-col bg-card border border-border rounded-xl shadow-lg overflow-hidden"
           style={{ width: '380px', flexShrink: 0 }}>

        {/* Chat header */}
        <div className="shrink-0 px-4 py-3 border-b border-border bg-card2 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-sky-700
                          flex items-center justify-center shadow-md shrink-0">
            <Zap size={13} className="text-white"/>
          </div>
          <div className="flex-1">
            <h3 className="font-black text-sm text-text">AEROSENSE AI</h3>
            <p className="text-[9px] text-muted">Gemini · Live telemetry context</p>
          </div>
          <span className="flex items-center gap-1 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500"/>
            <span className="text-[9px] text-green-600 font-bold">LIVE</span>
          </span>
        </div>

        {/* Messages */}
        <div ref={messagesRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'ai' && (
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-sky-400 to-sky-700
                                flex items-center justify-center shadow shrink-0 mb-1">
                  <Zap size={9} className="text-white"/>
                </div>
              )}
              <div className={`max-w-[88%] rounded-xl px-3 py-2.5 text-xs leading-relaxed shadow-sm ${
                msg.role === 'user'
                  ? 'bg-sky-600 text-white rounded-br-none'
                  : 'bg-card2 border border-border text-text rounded-bl-none'}`}>
                {msg.role === 'user' ? msg.content : (
                  <>
                    <div className="prose prose-xs max-w-none" style={{ color: 'var(--color-text)' }}>
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                    <button onClick={() => navigator.clipboard?.writeText(msg.content)}
                            className="mt-1.5 flex items-center gap-1 text-[8px] text-muted hover:text-sky-500 transition-colors">
                      <Copy size={8}/> Copy
                    </button>
                    {msg.followups?.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border flex flex-col gap-1">
                        {msg.followups.map((q, fi) => (
                          <button key={fi} type="button" onClick={() => sendMessage(q)} disabled={chatBusy}
                                  className="text-left text-[10px] text-sky-700 font-medium px-2.5 py-1.5 rounded-lg
                                             bg-sky-50 border border-sky-200 hover:bg-sky-100 transition-colors
                                             disabled:opacity-40 leading-snug">
                            {q}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}

          {chatBusy && (
            <div className="flex items-end gap-2">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-sky-400 to-sky-700
                              flex items-center justify-center shadow shrink-0">
                <Zap size={9} className="text-white"/>
              </div>
              <div className="bg-card2 border border-border rounded-xl rounded-bl-none px-3 py-2.5 flex items-center gap-1.5">
                <span className="text-[9px] text-muted">Analyzing…</span>
                {[0, 0.2, 0.4].map((d, i) => (
                  <div key={i} className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-bounce"
                       style={{ animationDelay: `${d}s` }}/>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Context bar */}
        {cycle > 0 && (
          <div className="shrink-0 px-3 py-1.5 border-t border-border bg-sky-50 flex items-center gap-2 text-[9px] text-muted">
            <Clock size={8} className="text-sky-400"/>
            <span>Cycle {cycle}</span>
            <span className="opacity-40">·</span>
            <span className={rulColor(rul)}>RUL {rul.toFixed(1)}</span>
            <span className="opacity-40">·</span>
            <span className={alert ? am(alert.level).text : 'text-muted'}>{alert?.level ?? '—'}</span>
          </div>
        )}

        {/* Input */}
        <div className="shrink-0 p-3 border-t border-border bg-card">
          <form onSubmit={e => { e.preventDefault(); sendMessage(input); }} className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about engine health…"
              autoComplete="off"
              className="flex-1 bg-card2 border-2 border-border rounded-lg py-2 px-3 text-xs
                         focus:outline-none focus:border-sky-500 transition-colors text-text placeholder:text-muted"
              disabled={chatBusy}
            />
            <button type="submit" disabled={!input.trim() || chatBusy}
                    className="shrink-0 p-2 bg-sky-600 text-white rounded-lg disabled:opacity-40
                               hover:bg-sky-700 active:scale-95 transition-all">
              <Send size={14}/>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
