import { useState, useEffect } from 'react';
import { RefreshCw, PlayCircle, AlertTriangle } from 'lucide-react';
import api from '../services/api';

export default function Visualizations() {
  const [loading, setLoading] = useState(false);
  const [initialRun, setInitialRun] = useState(true);
  const [shapAvailable, setShapAvailable] = useState(null); // null=checking, true/false
  const [shapStatusMsg, setShapStatusMsg] = useState('');
  const [error, setError] = useState('');

  const [plots, setPlots] = useState({
    beeswarm: null,
    bar: null,
    force: null,
    waterfall: null,
    decision: null
  });

  const [depFeature, setDepFeature] = useState('T50');
  const [depPlot, setDepPlot] = useState(null);
  const [depLoading, setDepLoading] = useState(false);
  const [depInteraction, setDepInteraction] = useState('');

  const features = [
    'setting_1','setting_2','T24','T30','T50','P15','P30',
    'Nf','Nc','Ps30','phi','NRf','NRc','BPR','htBleed','W31','W32'
  ];

  // Check SHAP availability on mount
  useEffect(() => {
    api.get('/viz/shap/status')
      .then(({ data }) => {
        setShapAvailable(data.shap_available);
        setShapStatusMsg(data.message);
      })
      .catch(() => {
        setShapAvailable(false);
        setShapStatusMsg('Could not reach server. Ensure the backend is running.');
      });
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    setInitialRun(false);
    setError('');
    setPlots({ beeswarm: null, bar: null, force: null, waterfall: null, decision: null });
    setDepPlot(null);
    setDepInteraction('');

    try {
      const { data } = await api.get('/viz/shap');
      setPlots(data);
      await fetchDependencePlot(depFeature);
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail || err.message;
      if (status === 503) {
        setError('SHAP is not available on the server. The model may not support TreeExplainer, or the pickle version is mismatched. Check the server log for details.');
      } else {
        setError(`Failed to generate SHAP plots: ${detail}`);
      }
      console.error("SHAP plots error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDependencePlot = async (feature) => {
    setDepLoading(true);
    setDepFeature(feature);
    setDepPlot(null);
    try {
      const { data } = await api.get(`/viz/shap/dependence?feature=${feature}`);
      setDepPlot(data.image);
      setDepInteraction(data.interaction_feature);
    } catch (err) {
      console.error("Dependence plot error:", err);
    } finally {
      setDepLoading(false);
    }
  };

  const PlotCard = ({ title, subtitle, badge, badgeColor, imgData, isLoading }) => (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl hover:border-accent/40 transition-colors flex flex-col">
      <div className="p-4 border-b border-border flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-text">{title}</h3>
          <p className="text-xs text-muted mt-1 leading-relaxed">{subtitle}</p>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border ${badgeColor}`}>
          {badge}
        </span>
      </div>
      <div className="p-4 flex-1 flex items-center justify-center bg-card2/30 min-h-[250px]">
        {isLoading ? (
          <div className="w-full h-full min-h-[250px] rounded-lg bg-gradient-to-r from-card2 via-[#263045] to-card2 bg-[length:200%_100%] animate-[shimmer_1.5s_infinite]"></div>
        ) : imgData ? (
          <img src={imgData} alt={title} className="w-full h-auto rounded-lg object-contain" />
        ) : (
          <div className="text-muted text-sm flex flex-col items-center gap-2">
            <span>Click "Generate AI Explanations" to compute</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto p-6 relative">
      <div className="max-w-7xl mx-auto space-y-8 pb-12">

        {/* Header Hero */}
        <div className="text-center py-8 px-4 relative">
          <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 px-4 py-1.5 rounded-full text-xs font-semibold text-accent uppercase tracking-wide mb-4">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
            </span>
            Explainable AI
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3 bg-gradient-to-br from-text via-accent to-purple bg-clip-text text-transparent">
            SHAP Feature Analysis
          </h1>
          <p className="text-muted max-w-2xl mx-auto mb-8">
            Understand exactly how each sensor drives the model's Remaining Useful Life predictions — globally and for individual engine cycles.
          </p>

          {/* SHAP not available banner */}
          {shapAvailable === false && (
            <div className="mb-6 flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 rounded-xl px-5 py-3 max-w-xl mx-auto text-sm text-left">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{shapStatusMsg}</span>
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="mb-6 flex items-start gap-3 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-5 py-3 max-w-xl mx-auto text-sm text-left">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={loading || shapAvailable === false}
            className="group relative inline-flex items-center justify-center px-8 py-3.5 text-base font-bold text-white transition-all duration-200 bg-gradient-to-r from-accent to-purple border border-transparent rounded-xl shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:shadow-[0_0_40px_rgba(139,92,246,0.5)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                Computing SHAP values (~10s)...
              </>
            ) : (
              <>
                <PlayCircle className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                {initialRun ? 'Generate AI Explanations' : 'Regenerate Explanations'}
              </>
            )}
          </button>

          {shapAvailable === false && (
            <p className="mt-3 text-xs text-muted">
              SHAP is unavailable — fix the server-side model/SHAP issue first.
            </p>
          )}
        </div>

        {/* Global Section */}
        <div>
          <h2 className="text-xs font-bold text-muted uppercase tracking-widest flex items-center gap-4 mb-4">
            Global Explanations
            <div className="flex-1 h-px bg-border"></div>
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PlotCard
              title="🐝 Beeswarm Summary Plot"
              subtitle="Shows how each feature impacts predictions across all samples. Colour = feature value."
              badge="Global"
              badgeColor="bg-purple/10 text-purple border-purple/20"
              imgData={plots.beeswarm}
              isLoading={loading}
            />
            <PlotCard
              title="📊 Bar Plot"
              subtitle="Mean absolute SHAP values ranked by global importance — the most impactful sensors."
              badge="Global"
              badgeColor="bg-purple/10 text-purple border-purple/20"
              imgData={plots.bar}
              isLoading={loading}
            />
          </div>
        </div>

        {/* Local Section */}
        <div>
          <h2 className="text-xs font-bold text-muted uppercase tracking-widest flex items-center gap-4 mb-4 mt-8">
            Local Explanations (Cycle 75)
            <div className="flex-1 h-px bg-border"></div>
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PlotCard
              title="⚡ Force Plot"
              subtitle="Shows how the top features push the RUL prediction above or below the baseline."
              badge="Local"
              badgeColor="bg-success/10 text-success border-success/20"
              imgData={plots.force}
              isLoading={loading}
            />
            <PlotCard
              title="💧 Waterfall Plot"
              subtitle="Step-by-step breakdown of a single prediction."
              badge="Local"
              badgeColor="bg-success/10 text-success border-success/20"
              imgData={plots.waterfall}
              isLoading={loading}
            />
          </div>
          <div className="mt-6">
            <PlotCard
              title="🧭 Decision Plot"
              subtitle="Cumulative feature contributions traced from base value to final prediction."
              badge="Local Trace"
              badgeColor="bg-success/10 text-success border-success/20"
              imgData={plots.decision}
              isLoading={loading}
            />
          </div>
        </div>

        {/* Dependence Plot */}
        <div>
          <h2 className="text-xs font-bold text-muted uppercase tracking-widest flex items-center gap-4 mb-4 mt-8">
            Feature Interaction
            <div className="flex-1 h-px bg-border"></div>
          </h2>
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-4 bg-card2/50">
              <div>
                <h3 className="font-semibold text-text">🔗 Dependence Plot</h3>
                <p className="text-xs text-muted mt-1">Relationship between a raw sensor value and its SHAP impact on RUL.</p>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-muted">Select Feature:</label>
                <select
                  value={depFeature}
                  onChange={(e) => fetchDependencePlot(e.target.value)}
                  disabled={loading || depLoading || initialRun || shapAvailable === false}
                  className="bg-bg border border-border text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-accent disabled:opacity-50"
                >
                  {features.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>

            <div className="p-4 flex items-center justify-center min-h-[300px]">
              {loading || depLoading ? (
                <div className="w-full h-full min-h-[300px] rounded-lg bg-gradient-to-r from-card2 via-[#263045] to-card2 bg-[length:200%_100%] animate-[shimmer_1.5s_infinite]"></div>
              ) : depPlot ? (
                <div className="w-full text-center">
                  <img src={depPlot} alt="Dependence Plot" className="w-full max-w-3xl mx-auto h-auto rounded-lg object-contain" />
                  <p className="mt-3 text-xs text-muted italic">
                    Auto-detected strongest interaction: <span className="text-accent font-mono">{depInteraction}</span>
                  </p>
                </div>
              ) : (
                <div className="text-muted text-sm">
                  {shapAvailable === false ? 'SHAP unavailable on server.' : 'Waiting for global generation...'}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}