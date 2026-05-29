import { useNavigate } from 'react-router-dom';
import { ShieldAlert, AlertTriangle, CheckCircle, ChevronRight, Radio, Zap } from 'lucide-react';

const PROCEDURES = [
  {
    id: 'compressor_surge',
    name: 'Compressor Surge / Stall',
    component: 'HPC',
    severity: 'EMERGENCY',
    icao: 'MAYDAY',
    color: 'border-red-400',
    bg: 'bg-red-50',
    badge: 'bg-red-500',
    sensors: ['T30↑', 'P30↓', 'Nc↓', 'Ps30↓'],
    symptoms: 'Rapid rise in T30, drop in P30 and Ps30, surge/bang audible, possible compressor stall',
    steps: [
      'THRUST LEVER — REDUCE TO IDLE',
      'ENGINE ANTI-ICE — ON',
      'AUTOTHROTTLE — DISCONNECT',
      'ALTITUDE — DESCEND if compressor temperature remains elevated',
      'DECLARE MAYDAY — "Mayday Mayday Mayday, [callsign], compressor surge, [intentions]"',
      'NEAREST AIRPORT — DIVERT IMMEDIATELY',
      'If surge continues: ENGINE SHUTDOWN CHECKLIST — EXECUTE',
    ],
    continue: 'Do NOT continue flight. Declare MAYDAY and divert.',
    question: 'Compressor surge detected on T30 and P30. What are my immediate actions?',
  },
  {
    id: 'turbine_blade_wear',
    name: 'HPT Turbine Blade Wear',
    component: 'HPT',
    severity: 'ABNORMAL',
    icao: 'PAN-PAN',
    color: 'border-orange-400',
    bg: 'bg-orange-50',
    badge: 'bg-orange-500',
    sensors: ['T50↑↑', 'Ps30↑', 'W31↑'],
    symptoms: 'Gradual EGT/T50 rise, increased HPT cooling flow (W31), reduced thrust efficiency',
    steps: [
      'THRUST — REDUCE 10% to lower T50',
      'ENGINE PARAMETERS — MONITOR T50 every cycle',
      'MAINTENANCE CONTROL — NOTIFY via ACARS: "HPT blade wear suspected, T50 elevated, RUL [X] cycles"',
      'DECLARE PAN-PAN — if T50 exceeds 1 450 °R',
      'DIVERSION AIRPORTS — ASSESS within fuel range',
      'AVOID — high-power settings (takeoff thrust, go-around) if possible',
    ],
    continue: 'Can continue if T50 stable and RUL > 60 cycles. Declare PAN-PAN if T50 rising.',
    question: 'T50 is rising and W31 is elevated. Is this turbine blade wear? What should I do?',
  },
  {
    id: 'seal_degradation',
    name: 'Turbine Seal Degradation',
    component: 'LPT',
    severity: 'ABNORMAL',
    icao: 'PAN-PAN',
    color: 'border-orange-400',
    bg: 'bg-orange-50',
    badge: 'bg-orange-500',
    sensors: ['T50↑', 'W31↑', 'W32↑', 'htBleed↑'],
    symptoms: 'T50 elevated, excess cooling flow in W31 and W32, increased bleed enthalpy',
    steps: [
      'THRUST — REDUCE 8%',
      'BLEED AIR — REDUCE cabin bleed extraction if possible',
      'MONITOR — W31, W32 and T50 trend each cycle',
      'MAINTENANCE CONTROL — NOTIFY of seal degradation indicators',
      'PLAN — Schedule inspection at next available station',
      'IF T50 > 1 440 °R: DECLARE PAN-PAN and divert',
    ],
    continue: 'Continue with caution if T50 stable. Schedule maintenance at next station.',
    question: 'W31, W32 and T50 are all elevated. Is this seal degradation? What are my options?',
  },
  {
    id: 'bearing_wear',
    name: 'Bearing Wear / Rotor Imbalance',
    component: 'Rotor',
    severity: 'ABNORMAL',
    icao: 'PAN-PAN',
    color: 'border-yellow-400',
    bg: 'bg-yellow-50',
    badge: 'bg-yellow-500',
    sensors: ['Nf↓', 'Nc↓', 'NRf↓', 'NRc↓'],
    symptoms: 'Fan and core speed declining, possible vibration, RPM instability',
    steps: [
      'THRUST — HOLD STEADY, do not increase',
      'AUTOTHROTTLE — DISCONNECT; manage thrust manually',
      'MONITOR — N1/N2 for speed fluctuations',
      'VIBRATION — if felt in airframe, treat as engine failure imminent',
      'DECLARE PAN-PAN — "Possible rotor bearing degradation, [intentions]"',
      'DIVERT — to nearest suitable airport with long runway',
      'IF speed drops below idle: ENGINE SHUTDOWN CHECKLIST',
    ],
    continue: 'Do NOT continue to destination. Divert at earliest opportunity.',
    question: 'Nf and Nc are dropping. What does this indicate and what are the immediate steps?',
  },
  {
    id: 'combustion_instability',
    name: 'Combustion Instability',
    component: 'Combustor',
    severity: 'ADVISORY',
    icao: 'Advisory',
    color: 'border-yellow-400',
    bg: 'bg-yellow-50',
    badge: 'bg-yellow-400',
    sensors: ['phi↑↑', 'T50↑', 'htBleed↓'],
    symptoms: 'Excess fuel flow (phi high), T50 fluctuations, possible flameout risk at extremes',
    steps: [
      'FUEL CONTROL — CHECK, ensure fuel flow within limits',
      'THRUST — STABILIZE, avoid rapid power changes',
      'ALTITUDE — AVOID extreme altitude changes that affect fuel mixture',
      'MONITOR — phi and T50 for 5 cycles',
      'MAINTENANCE — Log fuel flow anomaly for inspection at next stop',
      'IF phi continues rising: NOTIFY maintenance, consider early landing',
    ],
    continue: 'Continue monitoring. Land at next scheduled stop; notify maintenance.',
    question: 'Fuel flow ratio phi is very high. Is this combustion instability and is it safe to continue?',
  },
  {
    id: 'fan_fod',
    name: 'Fan Blade Damage (FOD)',
    component: 'Fan',
    severity: 'EMERGENCY',
    icao: 'MAYDAY',
    color: 'border-red-400',
    bg: 'bg-red-50',
    badge: 'bg-red-500',
    sensors: ['BPR↓↓', 'Nf↓', 'NRf↓', 'P15↓'],
    symptoms: 'BPR drops sharply, fan speed loss, bypass duct pressure drop, possible bang/vibration at ingestion',
    steps: [
      'THRUST LEVER — REDUCE TO IDLE IMMEDIATELY',
      'ASSESS — If vibration severe: ENGINE SHUTDOWN CHECKLIST',
      'DECLARE MAYDAY — "Mayday, suspected FOD/fan blade damage, [callsign]"',
      'DIVERT — IMMEDIATELY to nearest airport',
      'ATC — Request priority handling and emergency services on standby',
      'CABIN CREW — BRIEF for emergency landing',
      'ENGINE — Do NOT advance thrust; maintain idle or shut down',
    ],
    continue: 'Do NOT continue. Declare MAYDAY and land as soon as possible.',
    question: 'BPR has dropped sharply and Nf is falling. Is this FOD? What do I do right now?',
  },
  {
    id: 'hpt_creep',
    name: 'HPT Blade Creep / Elongation',
    component: 'HPT',
    severity: 'EMERGENCY',
    icao: 'MAYDAY',
    color: 'border-red-500',
    bg: 'bg-red-50',
    badge: 'bg-red-700',
    sensors: ['T50↑↑↑', 'Ps30↑↑', 'W31↑', 'htBleed↑'],
    symptoms: 'Very high T50 (>1 450 °R), Ps30 spiking, cooling over-demand — blade may contact casing',
    steps: [
      'THRUST — REDUCE TO MINIMUM IMMEDIATELY',
      'DECLARE MAYDAY — "Mayday, critical HPT over-temperature, [callsign]"',
      'DIVERT — nearest airport with full emergency services',
      'IF blade rub suspected (vibration + loud noise): ENGINE SHUTDOWN NOW',
      'ATC — Report emergency; request longest runway available',
      'CABIN CREW — Prepare for emergency evacuation on landing',
      'AFTER LANDING — Do NOT shut down until brakes are set; expedite evacuation',
    ],
    continue: 'IMMEDIATE DIVERSION. This is a catastrophic failure precursor.',
    question: 'T50 is critically high at over 1450 and Ps30 is also elevated. Is HPT creep occurring?',
  },
];

const SEVERITY_STYLE = {
  EMERGENCY: { bg:'bg-red-600',   text:'text-white', icon: '🚨' },
  ABNORMAL:  { bg:'bg-orange-500',text:'text-white', icon: '⚠️' },
  ADVISORY:  { bg:'bg-yellow-400',text:'text-yellow-950', icon: '📋' },
};

export default function EmergencyProcedures() {
  const navigate = useNavigate();

  const askAerosense = (question) => {
    sessionStorage.setItem('aerosense_prefill', question);
    navigate('/dashboard');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center shadow-md">
            <ShieldAlert size={20} className="text-white"/>
          </div>
          <div>
            <h1 className="text-2xl font-black text-text">Emergency Quick Reference Handbook</h1>
            <p className="text-muted text-sm">Aviation-standard QRH procedures for NASA turbofan engine failure modes</p>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-3 mt-4 flex items-start gap-3">
          <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0"/>
          <p className="text-red-800 text-xs leading-relaxed">
            <strong>SIMULATION USE ONLY.</strong> These procedures are derived from FAA Turbofan Malfunction Recognition guidelines
            and ICAO emergency procedures for educational and simulation purposes. Always follow your airline's actual Operations Manual (OM-B) and Quick Reference Handbook.
          </p>
        </div>
      </div>

      {/* Severity legend */}
      <div className="flex gap-3 mb-6 flex-wrap">
        {Object.entries(SEVERITY_STYLE).map(([sev, st]) => (
          <div key={sev} className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${st.bg} ${st.text} text-xs font-black`}>
            <span>{st.icon}</span> {sev}
          </div>
        ))}
        <p className="text-muted text-xs self-center ml-2">Click "Ask AEROSENSE" to get live analysis for your current engine data</p>
      </div>

      {/* QRH Cards grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {PROCEDURES.map(proc => {
          const sev = SEVERITY_STYLE[proc.severity] || SEVERITY_STYLE.ADVISORY;
          return (
            <div key={proc.id} className={`bg-card border-2 ${proc.color} rounded-2xl overflow-hidden shadow-sm flex flex-col`}>

              {/* Card header */}
              <div className={`${proc.bg} px-5 py-4 border-b border-border`}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <h3 className="font-black text-base text-text">{proc.name}</h3>
                    <p className="text-xs text-muted mt-0.5">Component: <strong>{proc.component}</strong></p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full text-white ${proc.badge}`}>
                      {sev.icon} {proc.severity}
                    </span>
                    <span className="text-[10px] font-bold text-muted border border-border px-2 py-0.5 rounded-full bg-card">
                      📡 {proc.icao}
                    </span>
                  </div>
                </div>

                {/* Sensor signatures */}
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  <span className="text-[9px] text-muted uppercase font-bold">Sensor Signatures:</span>
                  {proc.sensors.map(s => (
                    <span key={s} className="text-[10px] font-bold font-mono bg-card border border-border px-1.5 py-0.5 rounded-full text-text">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* Symptoms */}
              <div className="px-5 py-3 border-b border-border bg-card2/50">
                <p className="text-[10px] text-muted uppercase font-bold mb-1">Recognition</p>
                <p className="text-xs text-text leading-relaxed">{proc.symptoms}</p>
              </div>

              {/* Steps */}
              <div className="px-5 py-4 flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <Radio size={12} className="text-accent"/>
                  <p className="text-[10px] text-muted uppercase font-bold tracking-wider">Immediate Actions</p>
                </div>
                <ol className="space-y-2">
                  {proc.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-accent/10 border border-accent/20 text-accent text-[9px] font-black flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-xs text-text leading-snug font-medium">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Continue flight decision */}
              <div className={`px-5 py-3 border-t border-border ${proc.bg}`}>
                <div className="flex items-start gap-2">
                  {proc.severity === 'ADVISORY'
                    ? <CheckCircle size={13} className="text-green-600 mt-0.5 shrink-0"/>
                    : <AlertTriangle size={13} className="text-red-500 mt-0.5 shrink-0"/>}
                  <p className="text-[10px] leading-snug font-semibold text-text">
                    <strong>Flight Decision:</strong> {proc.continue}
                  </p>
                </div>
              </div>

              {/* Ask AEROSENSE button */}
              <div className="px-5 py-3 border-t border-border bg-card">
                <button onClick={() => askAerosense(proc.question)}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold hover:bg-sky-700 active:scale-95 transition-all shadow-md shadow-sky-200">
                  <Zap size={12}/> Ask AEROSENSE about this failure
                  <ChevronRight size={12}/>
                </button>
              </div>

            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted mt-8 pb-4">
        AEROSENSE Emergency QRH · Based on FAA AC 33.75 + ICAO Doc 9137 · For simulation and training use only
      </p>
    </div>
  );
}
