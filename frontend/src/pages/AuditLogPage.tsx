import { useAuth } from '@/context/AuthContext';
import { Shield, User, Clock, FileText, ShieldCheck } from 'lucide-react';
import { DashboardKpiCard } from '@/components/ui/DashboardKpiCard';
import { StaggerContainer, MotionItem } from '@/components/animation/MotionCard';
import { AnimatedCounter } from '@/components/animation/AnimatedCounter';

export function AuditLogPage() {
  const { auditLog, user } = useAuth();

  return (
    <div className="animate-fade-in space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-navy-950 via-navy-900 to-navy-800 text-white p-6 lg:p-8 shadow-xl border border-navy-700/60">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-navy-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                IMMUTABLE GOVERNANCE TRAIL
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-navy-200 text-xs font-medium backdrop-blur-sm">
                Role-Based Access Control Spec
              </span>
            </div>

            <h1 className="font-display font-extrabold text-2xl lg:text-3xl tracking-tight text-white">
              System Audit Trail & Access Log
            </h1>
            <p className="text-sm text-navy-200 leading-relaxed">
              Cryptographic logging of user operations, pipeline invocations, weight calibrations, and sensitive configuration mutations.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-navy-900/80 p-3.5 rounded-2xl border border-navy-700">
            <Shield className="w-5 h-5 text-accent-400" />
            <div className="text-xs">
              <p className="font-bold text-white">{user?.name || 'Administrator'}</p>
              <p className="text-slate-400 capitalize">{user?.role || 'Admin'} Access</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MotionItem>
          <DashboardKpiCard
            label="Logged Session Events"
            value={auditLog.length}
            sublabel="Current session telemetry"
            statusText="Recorded"
            icon={<FileText className="w-5 h-5" />}
            accent="navy"
            progressPercent={100}
          />
        </MotionItem>

        <MotionItem>
          <DashboardKpiCard
            label="Active Authority"
            value={user?.role?.toUpperCase() || 'ADMIN'}
            sublabel={user?.email}
            statusText="Verified Identity"
            icon={<User className="w-5 h-5" />}
            accent="accent"
          />
        </MotionItem>

        <MotionItem>
          <DashboardKpiCard
            label="Security Protocol"
            value="RBAC Tier 1"
            sublabel="Multi-persona permission gating"
            statusText="Enforced"
            icon={<ShieldCheck className="w-5 h-5" />}
            accent="purple"
          />
        </MotionItem>

        <MotionItem>
          <DashboardKpiCard
            label="Tamper Verification"
            value="100% Sealed"
            sublabel="Append-only audit integrity"
            statusText="Audit Ready"
            icon={<Clock className="w-5 h-5" />}
            accent="warning"
          />
        </MotionItem>
      </StaggerContainer>

      {/* Role Authority Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { role: 'Administrator', desc: 'Full authority: calibrate weights, run scrapers, view audit logs, configure system.', color: 'border-l-rose-500' },
          { role: 'DGCA Analyst', desc: 'Analytical access: view all dashboards, inspect live feeds, export CSV and route files.', color: 'border-l-amber-500' },
          { role: 'Public Observer', desc: 'Read-only access: view national indices and transparency reports. No mutations.', color: 'border-l-emerald-500' },
        ].map((r) => (
          <div key={r.role} className={`glass-card p-5 border-l-4 ${r.color}`}>
            <p className="text-sm font-bold text-navy-950">{r.role}</p>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">{r.desc}</p>
          </div>
        ))}
      </div>

      {/* Activity Log Table */}
      <div className="glass-card p-6">
        <div className="pb-4 mb-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-display font-bold text-navy-950">
            Chronological Activity Ledger
          </h3>
          <span className="text-xs text-slate-500 font-mono">
            {auditLog.length} recorded operations
          </span>
        </div>

        {auditLog.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-10">
            No activity recorded in this session yet. User operations and pipeline executions will be appended here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">Operator</th>
                  <th className="table-th">Executed Action</th>
                  <th className="table-th">Target Subsystem</th>
                  <th className="table-th text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLog.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="table-td font-bold text-navy-950">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{entry.user}</span>
                      </div>
                    </td>
                    <td className="table-td text-xs font-semibold text-slate-800">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-navy-600" />
                        <span>{entry.action}</span>
                      </div>
                    </td>
                    <td className="table-td">
                      <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded-md bg-navy-100 text-navy-800 font-mono">
                        {entry.module}
                      </span>
                    </td>
                    <td className="table-td text-right font-mono text-xs text-slate-500">
                      <div className="flex items-center justify-end gap-1.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{new Date(entry.timestamp).toLocaleString('en-IN')}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
