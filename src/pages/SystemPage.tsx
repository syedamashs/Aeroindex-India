import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { useApp } from '@/context/AppContext';
import { computePipelineStats } from '@/data/analytics';
import { getDataSource } from '@/data/datasource';
import { formatNumber } from '@/data/random';
import {
  Database, Filter, Sparkles, Copy, GitCompareArrows, Scale, BarChart3,
  Server, ArrowRight, Zap, CheckCircle2, AlertTriangle, Code2,
} from 'lucide-react';

const PIPELINE_STAGES = [
  { icon: Database, label: 'Source', desc: 'MockAirfareDataSource' },
  { icon: Filter, label: 'Collection', desc: 'Fetch observations' },
  { icon: CheckCircle2, label: 'Validation', desc: 'Check structure & ranges' },
  { icon: Sparkles, label: 'Cleaning', desc: 'Remove invalid records' },
  { icon: Copy, label: 'Deduplication', desc: 'Remove duplicates' },
  { icon: Scale, label: 'Normalization', desc: 'Decompose fare components' },
  { icon: BarChart3, label: 'Index Calculation', desc: 'Weighted price relatives' },
  { icon: GitCompareArrows, label: 'Analytics', desc: 'Route, airline, window' },
  { icon: Server, label: 'Dashboard', desc: 'API → UI' },
];

const API_ENDPOINTS = [
  { method: 'GET', path: '/api/index', desc: 'Monthly airfare index values' },
  { method: 'GET', path: '/api/index/trend', desc: 'Index trend over time' },
  { method: 'GET', path: '/api/routes', desc: 'All route statistics' },
  { method: 'GET', path: '/api/routes/:route', desc: 'Single route detail' },
  { method: 'GET', path: '/api/airlines', desc: 'All airline statistics' },
  { method: 'GET', path: '/api/airlines/:airline', desc: 'Single airline detail' },
  { method: 'GET', path: '/api/booking-window', desc: 'Booking window analysis' },
  { method: 'GET', path: '/api/observations', desc: 'Paginated observations' },
  { method: 'GET', path: '/api/alerts', desc: 'Detected fare alerts' },
  { method: 'GET', path: '/api/insights', desc: 'Generated policy insights' },
  { method: 'GET', path: '/api/map', desc: 'Map routes & airports' },
  { method: 'GET', path: '/api/statistics', desc: 'Dashboard summary statistics' },
];

const ARCHITECTURE_LAYERS = [
  'Data Sources',
  'Collection Layer',
  'Data Validation',
  'Cleaning & Deduplication',
  'Normalized Data Store',
  'Index Engine',
  'Analytics Engine',
  'API Layer',
  'Web Dashboard',
];

const SIDE_MODULES = ['Alerts', 'Maps', 'Policy Insights', 'Exports'];

export function SystemPage() {
  const { lastUpdate, showToast } = useApp();
  const [processing, setProcessing] = useState(false);
  const [pipelineStats, setPipelineStats] = useState(() => computePipelineStats());
  const ds = getDataSource();

  const runProcessing = () => {
    setProcessing(true);
    showToast('Data processing pipeline started...', 'info');
    setTimeout(() => {
      const stats = computePipelineStats();
      setPipelineStats(stats);
      setProcessing(false);
      showToast('Data processing complete. All records validated and indexed.', 'success');
    }, 2500);
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl lg:text-3xl text-navy-900">System & API</h1>
        <p className="text-slate-500 mt-1">Architecture, data pipeline, and API endpoints</p>
      </div>

      {/* Data Source */}
      <Card className="mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-navy-50 flex items-center justify-center">
              <Database className="w-5 h-5 text-navy-700" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-navy-900">Active Data Source</h3>
              <p className="text-sm text-slate-600 mt-1">
                <span className="font-mono font-medium text-navy-800">{ds.name}</span> —{' '}
                {ds.isLive ? 'Live source' : 'Prototype mock source (deterministic seed)'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                The DataSource interface allows swapping to LiveAirfareDataSource without changing the application.
              </p>
            </div>
          </div>
          <span className="badge bg-warning-500/10 text-warning-600">Prototype data pipeline</span>
        </div>
      </Card>

      {/* Pipeline */}
      <Card
        title="Data Pipeline"
        subtitle="Prototype simulation — visualizes the processing stages"
        action={
          <button onClick={runProcessing} disabled={processing} className="btn-primary text-xs">
            <Zap className="w-3.5 h-3.5" />
            {processing ? 'Processing...' : 'Run Data Processing'}
          </button>
        }
        className="mb-6"
      >
        <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
          {PIPELINE_STAGES.map((stage, i) => {
            const Icon = stage.icon;
            return (
              <div key={stage.label} className="flex items-center gap-2">
                <div className={`card px-3 py-2.5 text-center min-w-[110px] ${processing ? 'animate-pulse-soft border-navy-300' : ''}`}>
                  <Icon className={`w-4 h-4 mx-auto mb-1 ${processing ? 'text-navy-600' : 'text-slate-400'}`} />
                  <p className="text-xs font-medium text-navy-800">{stage.label}</p>
                  <p className="text-[10px] text-slate-400">{stage.desc}</p>
                </div>
                {i < PIPELINE_STAGES.length - 1 && <ArrowRight className="w-3 h-3 text-slate-300" />}
              </div>
            );
          })}
        </div>

        {/* Pipeline stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: 'Collected', value: formatNumber(pipelineStats.recordsCollected), icon: Database },
            { label: 'Processed', value: formatNumber(pipelineStats.recordsProcessed), icon: CheckCircle2 },
            { label: 'Duplicates', value: formatNumber(pipelineStats.duplicatesRemoved), icon: Copy },
            { label: 'Invalid', value: formatNumber(pipelineStats.invalidRecords), icon: AlertTriangle },
            { label: 'Valid Obs.', value: formatNumber(pipelineStats.validObservations), icon: CheckCircle2 },
            { label: 'Last Update', value: pipelineStats.lastUpdate.slice(11, 16), icon: Zap },
            { label: 'Quality', value: `${pipelineStats.dataQuality}%`, icon: Sparkles },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-slate-50 rounded-lg p-3 text-center">
                <Icon className="w-4 h-4 text-navy-600 mx-auto mb-1" />
                <p className="text-xs text-slate-500">{stat.label}</p>
                <p className="text-lg font-mono font-semibold text-navy-900">{stat.value}</p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Architecture */}
      <Card title="System Architecture" subtitle="End-to-end layered design" className="mb-6">
        <div className="flex flex-col items-center gap-2">
          {ARCHITECTURE_LAYERS.map((layer, i) => (
            <div key={layer} className="flex flex-col items-center">
              <div className="card px-6 py-3 text-center min-w-[260px] bg-navy-50">
                <span className="text-sm font-medium text-navy-800">{layer}</span>
              </div>
              {i < ARCHITECTURE_LAYERS.length - 1 && <ArrowRight className="w-4 h-4 text-slate-300 rotate-90 my-0.5" />}
            </div>
          ))}
        </div>
        <div className="mt-6 pt-4 border-t border-slate-100">
          <p className="text-xs font-medium text-slate-500 mb-2">Cross-cutting modules:</p>
          <div className="flex flex-wrap gap-2">
            {SIDE_MODULES.map((m) => (
              <span key={m} className="badge-navy">{m}</span>
            ))}
          </div>
        </div>
      </Card>

      {/* API Endpoints */}
      <Card title="API Endpoints" subtitle="Simulated REST API — frontend consumes these endpoints">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-th">Method</th>
                <th className="table-th">Endpoint</th>
                <th className="table-th">Description</th>
              </tr>
            </thead>
            <tbody>
              {API_ENDPOINTS.map((ep) => (
                <tr key={ep.path} className="table-row">
                  <td className="table-td">
                    <span className="badge bg-success-500/10 text-success-600 font-mono">{ep.method}</span>
                  </td>
                  <td className="table-td font-mono text-navy-800">{ep.path}</td>
                  <td className="table-td text-slate-600">{ep.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 p-3 bg-slate-50 rounded-lg flex items-start gap-2">
          <Code2 className="w-4 h-4 text-slate-400 mt-0.5" />
          <p className="text-xs text-slate-500">
            In this prototype, the API layer is implemented as an in-memory module (<span className="font-mono">src/data/api.ts</span>)
            that the frontend imports directly. In production, these would be served by a Node.js backend.
          </p>
        </div>
      </Card>
    </div>
  );
}
