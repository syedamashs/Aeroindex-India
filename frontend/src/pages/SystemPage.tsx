import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { useApp } from '@/context/AppContext';
import { computePipelineStats, getValidObservations, getObservations } from '@/data/analytics';
import { getDataSource } from '@/data/datasource';
import { formatNumber } from '@/data/random';
import {
  Database, Filter, Sparkles, Copy, GitCompareArrows, Scale, BarChart3,
  Server, ArrowRight, Zap, CheckCircle2, AlertTriangle, Code2, Shield, TrendingUp, Layers,
} from 'lucide-react';

const VALIDATION_RULES = [
  { rule: 'Fare Range', desc: '₹1,500 - ₹25,000', status: 'active' },
  { rule: 'Required Fields', desc: 'route, airline, date, fare', status: 'active' },
  { rule: 'Date Format', desc: 'YYYY-MM-DD format', status: 'active' },
  { rule: 'Booking Window', desc: '1-365 days in advance', status: 'active' },
  { rule: 'Airline Code', desc: 'Valid 2-letter code', status: 'active' },
  { rule: 'Route Exists', desc: 'Cross-check monitored routes', status: 'active' },
  { rule: 'Duplicate Detection', desc: 'Hash-based deduplication', status: 'active' },
  { rule: 'Outlier Detection', desc: '3-sigma price boundaries', status: 'active' },
];

const DATA_QUALITY_ALERTS = [
  { type: 'High Duplication Rate', severity: 'warning', threshold: '> 5%', message: 'Duplicate observations detected in recent batch' },
  { type: 'Invalid Records Spike', severity: 'alert', threshold: '> 10%', message: 'Unusual number of invalid records detected' },
  { type: 'Data Freshness', severity: 'info', threshold: '< 24h', message: 'Data source last updated 12 hours ago' },
  { type: 'Quality Decline', severity: 'warning', threshold: 'Previous < 95%', message: 'Data quality has declined by 2.1% this month' },
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

  // Calculate data quality metrics
  const allObs = getObservations();
  const validObs = getValidObservations();
  const invalidObs = allObs.filter((o) => o.status === 'invalid').length;
  const duplicateObs = allObs.filter((o) => o.status === 'duplicate').length;
  const duplicatePercentage = (duplicateObs / allObs.length) * 100;

  // Fare statistics
  const fareValues = validObs.map((o) => o.totalFare);
  const minFare = Math.min(...fareValues);
  const maxFare = Math.max(...fareValues);
  const avgFare = Math.round(fareValues.reduce((a, b) => a + b, 0) / fareValues.length);

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

      {/* Data Quality & Validation */}
      <Card
        title="Data Quality Metrics & Validation"
        subtitle="Complete data pipeline quality assurance"
        className="mb-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-success-50 to-emerald-50 rounded-lg p-4 border border-success-200">
            <CheckCircle2 className="w-5 h-5 text-success-600 mb-2" />
            <p className="text-sm text-slate-600">Valid Observations</p>
            <p className="text-3xl font-mono font-bold text-success-700 mt-1">{validObs.toLocaleString('en-IN')}</p>
            <p className="text-xs text-slate-500 mt-2">✓ {((validObs / allObs.length) * 100).toFixed(1)}% quality</p>
          </div>

          <div className="bg-gradient-to-br from-danger-50 to-red-50 rounded-lg p-4 border border-danger-200">
            <AlertTriangle className="w-5 h-5 text-danger-600 mb-2" />
            <p className="text-sm text-slate-600">Invalid Observations</p>
            <p className="text-3xl font-mono font-bold text-danger-700 mt-1">{invalidObs.toLocaleString('en-IN')}</p>
            <p className="text-xs text-slate-500 mt-2">✗ {((invalidObs / allObs.length) * 100).toFixed(1)}% of total</p>
          </div>

          <div className="bg-gradient-to-br from-warning-50 to-amber-50 rounded-lg p-4 border border-warning-200">
            <Copy className="w-5 h-5 text-warning-600 mb-2" />
            <p className="text-sm text-slate-600">Duplicate Observations</p>
            <p className="text-3xl font-mono font-bold text-warning-700 mt-1">{duplicateObs.toLocaleString('en-IN')}</p>
            <p className="text-xs text-slate-500 mt-2">⊗ {duplicatePercentage.toFixed(1)}% duplicated</p>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-4 border border-blue-200">
            <Sparkles className="w-5 h-5 text-blue-600 mb-2" />
            <p className="text-sm text-slate-600">Total Observations</p>
            <p className="text-3xl font-mono font-bold text-blue-700 mt-1">{allObs.length.toLocaleString('en-IN')}</p>
            <p className="text-xs text-slate-500 mt-2">📊 Complete dataset</p>
          </div>
        </div>

        {/* Fare Statistics */}
        <div className="border-t border-slate-100 pt-6 mb-6">
          <h4 className="text-sm font-semibold text-navy-900 mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4" />Fare Value Distribution</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">Minimum Fare</p>
              <p className="text-xl font-mono font-bold text-navy-900">₹{minFare.toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">Maximum Fare</p>
              <p className="text-xl font-mono font-bold text-navy-900">₹{maxFare.toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">Average Fare</p>
              <p className="text-xl font-mono font-bold text-navy-900">₹{avgFare.toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">Fare Range</p>
              <p className="text-xl font-mono font-bold text-navy-900">₹{(maxFare - minFare).toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>

        {/* Validation Rules */}
        <div className="border-t border-slate-100 pt-6">
          <h4 className="text-sm font-semibold text-navy-900 mb-4 flex items-center gap-2"><Shield className="w-4 h-4" />Validation Rules Applied</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {VALIDATION_RULES.map((v) => (
              <div key={v.rule} className="bg-gradient-to-br from-success-50 to-emerald-50 rounded-lg p-3 border border-success-200">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-navy-900">{v.rule}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{v.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Data Quality Alerts */}
      <Card title="Data Quality Alerts" subtitle="Real-time quality monitoring & warnings" className="mb-6">
        <div className="space-y-3">
          {DATA_QUALITY_ALERTS.map((alert, i) => {
            const severityColor = 
              alert.severity === 'alert' ? 'border-danger-200 bg-danger-50' :
              alert.severity === 'warning' ? 'border-warning-200 bg-warning-50' :
              'border-blue-200 bg-blue-50';
            const iconColor = 
              alert.severity === 'alert' ? 'text-danger-600' :
              alert.severity === 'warning' ? 'text-warning-600' :
              'text-blue-600';
            return (
              <div key={i} className={`rounded-lg p-4 border ${severityColor}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <Shield className={`w-4 h-4 ${iconColor} mt-0.5 flex-shrink-0`} />
                    <div>
                      <p className="font-medium text-navy-900">{alert.type}</p>
                      <p className="text-sm text-slate-600 mt-1">{alert.message}</p>
                      <p className="text-xs text-slate-500 mt-2">Threshold: {alert.threshold}</p>
                    </div>
                  </div>
                  <span className={`badge text-xs font-medium whitespace-nowrap ${
                    alert.severity === 'alert' ? 'bg-danger-500/10 text-danger-600' :
                    alert.severity === 'warning' ? 'bg-warning-500/10 text-warning-600' :
                    'bg-blue-500/10 text-blue-600'
                  }`}>
                    {alert.severity.toUpperCase()}
                  </span>
                </div>
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
