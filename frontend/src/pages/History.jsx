import { useState, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine
} from 'recharts';
import { Upload, Activity, Download, FileText, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import api from '../services/api';

const TIP_STYLE = { backgroundColor:'var(--color-card)', borderColor:'var(--color-border)', borderRadius:'8px', fontSize:'11px', color:'var(--color-text)' };

const rulColor = (r) => r > 100 ? '#16a34a' : r > 60 ? '#d97706' : r > 30 ? '#ea580c' : '#dc2626';
const alertBg  = (level) =>
  level==='CRITICAL' ? 'bg-red-50 text-red-700 border-red-200' :
  level==='WARNING'  ? 'bg-orange-50 text-orange-700 border-orange-200' :
  level==='CAUTION'  ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                       'bg-green-50 text-green-700 border-green-200';

export default function History() {
  const [results,   setResults]   = useState(null);
  const [filename,  setFilename]  = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [dragging,  setDragging]  = useState(false);
  const inputRef = useRef();

  const processFile = async (file) => {
    if (!file) return;
    setFilename(file.name);
    setError('');
    setLoading(true);
    setResults(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post('/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResults(res.data);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Upload failed. Make sure the file is a valid NASA C-MAPSS format CSV/TXT.');
    } finally { setLoading(false); }
  };

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  // Summary stats
  const stats = results ? (() => {
    const ruls = results.data.map(d => d.RUL);
    const avgRul   = (ruls.reduce((a,b)=>a+b,0)/ruls.length).toFixed(1);
    const minRul   = Math.min(...ruls).toFixed(1);
    const maxRul   = Math.max(...ruls).toFixed(1);
    const critical = results.data.filter(d => d.alert_level === 'CRITICAL').length;
    const warning  = results.data.filter(d => d.alert_level === 'WARNING').length;
    const normal   = results.data.filter(d => d.alert_level === 'NORMAL').length;
    return { avgRul, minRul, maxRul, critical, warning, normal };
  })() : null;

  // Download results as CSV
  const downloadCSV = () => {
    if (!results) return;
    const header = 'Cycle,RUL,Status,Alert Level,Action\n';
    const rows = results.data.map(d =>
      `${d.cycle},${d.RUL.toFixed(1)},${d.status},${d.alert_level},"${d.alert_action}"`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `aerosense_report_${filename}.csv`; a.click();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-text flex items-center gap-3">
          <Activity size={24} className="text-accent"/> History Analysis
        </h1>
        <p className="text-muted text-sm mt-1">
          Upload historical sensor logs (CSV/TXT) for batch RUL prediction and fleet health analysis
        </p>
      </div>

      {/* Upload + Results grid */}
      <div className="grid grid-cols-2 gap-5 mb-5">

        {/* Upload Panel */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col gap-4">
          <h3 className="font-bold text-text flex items-center gap-2">
            <Upload size={16} className="text-accent"/> Upload Engine Data
          </h3>

          {/* Drop zone */}
          <div
            onDragOver={e=>{e.preventDefault();setDragging(true);}}
            onDragLeave={()=>setDragging(false)}
            onDrop={onDrop}
            onClick={()=>inputRef.current?.click()}
            className={`flex-1 border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              dragging ? 'border-accent bg-accent/5 scale-[1.01]' : 'border-border hover:border-accent/50 hover:bg-card2'}`}>
            <div className="flex flex-col items-center gap-3">
              <div className={`p-4 rounded-full ${dragging ? 'bg-accent/10' : 'bg-card2'} transition-all`}>
                <Upload size={28} className={dragging ? 'text-accent' : 'text-muted'}/>
              </div>
              <div>
                <p className="font-bold text-text">Drag & drop CSV/TXT file here</p>
                <p className="text-muted text-sm mt-1">or click to browse from your computer</p>
                <p className="text-[11px] text-muted mt-2">NASA C-MAPSS format · 26 columns</p>
              </div>
            </div>
            <input ref={inputRef} type="file" accept=".csv,.txt" className="hidden"
              onChange={e=>processFile(e.target.files[0])}/>
          </div>

          {/* Test files hint */}
          <div className="bg-card2 border border-border rounded-xl p-3">
            <p className="text-[11px] text-muted font-semibold mb-1">📂 Test files available in your project:</p>
            <div className="flex flex-wrap gap-1.5">
              {['engine_healthy.csv','engine_warning.csv','engine_critical.csv','engine_slow_burn.csv'].map(f=>(
                <span key={f} className="text-[10px] bg-accent/10 text-accent border border-accent/20 px-2 py-0.5 rounded-full font-mono">{f}</span>
              ))}
            </div>
            <p className="text-[10px] text-muted mt-1.5">Located in: <span className="font-mono">Nasa_Maintaince/test_csvs/</span></p>
          </div>

          <button
            onClick={()=>inputRef.current?.click()}
            disabled={loading}
            className="w-full py-3 bg-accent text-white rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all shadow-md">
            {loading ? '⏳ Analyzing…' : '▶ Run Batch Prediction'}
          </button>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>
          )}
        </div>

        {/* Summary Stats */}
        {stats ? (
          <div className="flex flex-col gap-4">
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-text flex items-center gap-2">
                  <FileText size={16} className="text-accent"/> Batch Analysis Results
                </h3>
                <button onClick={downloadCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-card2 border border-border text-muted hover:text-text rounded-lg text-xs font-semibold transition-all">
                  <Download size={13}/> Download CSV
                </button>
              </div>
              <p className="text-[11px] text-muted mb-4">File: <span className="font-mono text-text">{filename}</span> · {results.total_rows} readings analyzed</p>

              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  {label:'Average RUL',  val:`${stats.avgRul} cycles`, color:'text-accent'},
                  {label:'Minimum RUL',  val:`${stats.minRul} cycles`, color:'text-red-600'},
                  {label:'Maximum RUL',  val:`${stats.maxRul} cycles`, color:'text-green-600'},
                  {label:'Critical Rows',val:stats.critical,           color:'text-red-600'},
                  {label:'Warning Rows', val:stats.warning,            color:'text-orange-600'},
                  {label:'Normal Rows',  val:stats.normal,             color:'text-green-600'},
                ].map(s=>(
                  <div key={s.label} className="bg-card2 rounded-xl p-3 border border-border">
                    <p className="text-[9px] text-muted uppercase tracking-wider">{s.label}</p>
                    <p className={`text-xl font-black font-mono mt-0.5 ${s.color}`}>{s.val}</p>
                  </div>
                ))}
              </div>

              {/* Alert distribution bar */}
              <p className="text-[10px] text-muted uppercase font-bold mb-2">Alert Distribution</p>
              <div className="flex rounded-xl overflow-hidden h-5 gap-0.5">
                {stats.critical>0 && <div className="bg-red-500 flex items-center justify-center text-white text-[9px] font-bold transition-all" style={{width:`${(stats.critical/results.total_rows)*100}%`}}>{stats.critical}</div>}
                {stats.warning>0  && <div className="bg-orange-500 flex items-center justify-center text-white text-[9px] font-bold" style={{width:`${(stats.warning/results.total_rows)*100}%`}}>{stats.warning}</div>}
                {stats.normal>0   && <div className="bg-green-500 flex items-center justify-center text-white text-[9px] font-bold" style={{width:`${(stats.normal/results.total_rows)*100}%`}}>{stats.normal}</div>}
              </div>
              <div className="flex gap-3 mt-1.5 text-[10px] text-muted">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"/>Critical</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500"/>Warning</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"/>Normal</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl p-8 shadow-sm flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-card2 flex items-center justify-center mb-4">
              <Activity size={28} className="text-muted"/>
            </div>
            <p className="font-bold text-text">Upload a file to see results</p>
            <p className="text-muted text-sm mt-1">Batch analysis, health scores, and alert distribution will appear here</p>
          </div>
        )}
      </div>

      {/* RUL Bar Chart */}
      {results && (
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm mb-5">
          <h3 className="font-bold text-text flex items-center gap-2 mb-4">
            <Activity size={16} className="text-accent"/> RUL Prediction — All {results.total_rows} Readings
          </h3>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={results.data} margin={{top:4,right:8,bottom:0,left:-15}}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false}/>
                <XAxis dataKey="cycle" stroke="var(--color-muted)" fontSize={10} tickLine={false} axisLine={false}/>
                <YAxis stroke="var(--color-muted)" fontSize={10} tickLine={false} axisLine={false}/>
                <ReferenceLine y={100} stroke="#16a34a" strokeDasharray="4 4" strokeWidth={1} label={{value:'Safe',fill:'#16a34a',fontSize:9,position:'right'}}/>
                <ReferenceLine y={60}  stroke="#d97706" strokeDasharray="4 4" strokeWidth={1} label={{value:'Warn',fill:'#d97706',fontSize:9,position:'right'}}/>
                <ReferenceLine y={30}  stroke="#dc2626" strokeDasharray="4 4" strokeWidth={1} label={{value:'Crit',fill:'#dc2626',fontSize:9,position:'right'}}/>
                <Tooltip contentStyle={TIP_STYLE} formatter={v=>[`${v.toFixed(1)} cycles`,'RUL']}/>
                <Bar dataKey="RUL" radius={[3,3,0,0]} maxBarSize={20} isAnimationActive={false}>
                  {results.data.map((entry,i)=>(
                    <Cell key={i} fill={rulColor(entry.RUL)}/>
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Data Table */}
      {results && (
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-card2 flex items-center justify-between">
            <h3 className="font-bold text-text text-sm">Detailed Results</h3>
            <p className="text-muted text-xs">Showing first {Math.min(results.data.length, 50)} of {results.total_rows} rows</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-card2/50">
                  {['Cycle','Predicted RUL','Status','Alert Level','Action Required'].map(h=>(
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] text-muted uppercase tracking-wider font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {results.data.slice(0,50).map((row,i)=>(
                  <tr key={i} className="hover:bg-card2/50 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-text text-sm">#{row.cycle}</td>
                    <td className="px-4 py-2.5">
                      <span className="font-black font-mono" style={{color:rulColor(row.RUL)}}>{row.RUL.toFixed(1)}</span>
                      <span className="text-muted text-xs ml-1">cyc</span>
                    </td>
                    <td className="px-4 py-2.5 text-muted text-xs">{row.status}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${alertBg(row.alert_level)}`}>
                        {row.alert_level}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted max-w-xs">{row.alert_action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
