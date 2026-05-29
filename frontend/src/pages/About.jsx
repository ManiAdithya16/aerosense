import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ShieldAlert, Cpu, Database, BrainCircuit, Rocket, BarChart2, ArrowRight } from 'lucide-react';
import api from '../services/api';

export default function About() {
  const [perf, setPerf] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get('/xgboost-metrics')
      .then(({ data }) => { if (!cancelled) setPerf(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="h-full overflow-y-auto p-6 flex flex-col gap-6">
      
      {/* Header section */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2">About AEROSENSE</h2>
          <p className="text-muted text-lg">Predictive Maintenance & Telemetry Analysis Engine</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main description */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-8 shadow-xl relative overflow-hidden flex flex-col justify-center">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Rocket size={160} />
          </div>
          <div className="relative z-10 space-y-6">
            <div className="w-16 h-16 bg-gradient-to-br from-accent to-purple rounded-2xl flex items-center justify-center shadow-[0_0_40px_rgba(59,130,246,0.3)] mb-6">
              <Activity size={32} className="text-white" />
            </div>
            
            <p className="text-lg text-text/90 leading-relaxed">
              AEROSENSE is a predictive maintenance platform specifically modeled for NASA turbofan jet engines. By leveraging cutting-edge machine learning and real-time sensor telemetry, it forecasts the Remaining Useful Life (RUL) of critical propulsion systems.
            </p>
            <p className="text-lg text-text/90 leading-relaxed">
              Our models analyze complex thermodynamic data—such as pressures, temperatures, and bypass ratios—to detect subtle degradation signatures before failure events occur. This allows engineers to systematically schedule preventative maintenance, ensuring maximum operational safety.
            </p>
          </div>
        </div>

        {/* Core Technologies */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-xl flex flex-col gap-4">
          <h3 className="font-bold text-lg border-b border-border/50 pb-3 mb-2 flex items-center gap-2">
            <Cpu size={18} className="text-accent" /> Base Technologies
          </h3>
          
          <div className="flex items-start gap-3 p-3 rounded-xl bg-card2/50 border border-border/30 hover:border-purple/30 transition-colors">
            <div className="mt-1 flex-shrink-0">
              <BrainCircuit size={18} className="text-purple" />
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-1 text-text">XGBoost & Regression</h4>
              <p className="text-xs text-muted leading-relaxed">Advanced ensemble methods tailored to forecast exact cycles until system failure based on historical progression data.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-card2/50 border border-border/30 hover:border-warning/30 transition-colors">
            <div className="mt-1 flex-shrink-0">
              <ShieldAlert size={18} className="text-warning" />
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-1 text-text">SHAP Explainability</h4>
              <p className="text-xs text-muted leading-relaxed">Real-time Shapley Additive Explanations decompose predictions to show exactly which sensor features drive component risk.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-card2/50 border border-border/30 hover:border-success/30 transition-colors">
            <div className="mt-1 flex-shrink-0">
              <Database size={18} className="text-success" />
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-1 text-text">C-MAPSS Telemetry</h4>
              <p className="text-xs text-muted leading-relaxed">Trained on authenticated NASA datasets containing multidimensional operational condition metrics and sensor matrices.</p>
            </div>
          </div>
          
        </div>
      </div>

      {/* Model Performance summary */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
              <BarChart2 size={18} className="text-accent"/>
            </div>
            <div>
              <h3 className="font-bold text-lg text-text">Model Performance</h3>
              <p className="text-xs text-muted mt-0.5">XGBoost Regressor · NASA C-MAPSS FD001 test set</p>
            </div>
          </div>
          <Link to="/xgboost-model"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-white text-xs font-bold shadow-md hover:opacity-90 active:scale-95 transition-all">
            View Full Model Report <ArrowRight size={13}/>
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'RMSE',       value: perf ? perf.rmse.toFixed(2)       : '—', unit: 'cyc',   accent: 'text-sky-600'    },
            { label: 'MAE',        value: perf ? perf.mae.toFixed(2)        : '—', unit: 'cyc',   accent: 'text-sky-600'    },
            { label: 'R² Score',   value: perf ? perf.r2.toFixed(4)         : '—', unit: '',      accent: 'text-green-600'  },
            { label: 'NASA Score', value: perf ? perf.nasa_score.toFixed(2) : '—', unit: '',      accent: 'text-purple'     },
          ].map((m) => (
            <div key={m.label} className="bg-card2/50 border border-border/30 rounded-xl p-3 text-center">
              <p className="text-[10px] text-muted uppercase tracking-wider font-bold">{m.label}</p>
              <p className={`text-2xl font-black font-mono mt-1 ${m.accent}`}>
                {m.value}
                {m.unit && <span className="text-[10px] text-muted font-normal ml-1">{m.unit}</span>}
              </p>
            </div>
          ))}
        </div>

        {!perf && (
          <p className="text-[11px] text-muted italic mt-4 text-center">
            Metrics will populate once the backend is reachable.
          </p>
        )}
      </div>

    </div>
  );
}
