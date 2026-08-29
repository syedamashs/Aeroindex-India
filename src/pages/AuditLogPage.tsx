import { Card } from '@/components/ui/Card';
import { useAuth } from '@/context/AuthContext';
import { Shield, User, Clock, FileText } from 'lucide-react';

export function AuditLogPage() {
  const { auditLog, user } = useAuth();

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl lg:text-3xl text-navy-900">Audit Log</h1>
        <p className="text-slate-500 mt-1">User activity tracking for governance and accountability</p>
      </div>

      {/* Role info */}
      <Card className="mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-navy-50 flex items-center justify-center">
            <Shield className="w-6 h-6 text-navy-700" />
          </div>
          <div>
            <p className="text-sm text-slate-500">Current session</p>
            <p className="text-lg font-display font-semibold text-navy-900">{user?.name}</p>
            <p className="text-sm text-slate-500">{user?.email} • {user?.role}</p>
          </div>
        </div>
      </Card>

      {/* Role descriptions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          { role: 'Administrator', desc: 'Full access: manage weights, run pipeline, view audit logs, configure system.', color: 'text-danger-600' },
          { role: 'Analyst', desc: 'Analytical access: view all dashboards, export data, run comparisons.', color: 'text-warning-600' },
          { role: 'Viewer', desc: 'Read-only access: view dashboards and reports. No exports or configuration.', color: 'text-success-600' },
        ].map((r) => (
          <div key={r.role} className="card p-4">
            <p className={`text-sm font-semibold ${r.color}`}>{r.role}</p>
            <p className="text-xs text-slate-500 mt-1">{r.desc}</p>
          </div>
        ))}
      </div>

      {/* Audit table */}
      <Card title="Activity Log" subtitle={`${auditLog.length} entries`}>
        {auditLog.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">
            No activity recorded yet. Actions performed during this session will appear here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">User</th>
                  <th className="table-th">Action</th>
                  <th className="table-th">Module</th>
                  <th className="table-th">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {auditLog.map((entry) => (
                  <tr key={entry.id} className="table-row">
                    <td className="table-td">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-medium">{entry.user}</span>
                      </div>
                    </td>
                    <td className="table-td">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        {entry.action}
                      </div>
                    </td>
                    <td className="table-td">
                      <span className="badge-navy">{entry.module}</span>
                    </td>
                    <td className="table-td font-mono text-xs text-slate-500">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(entry.timestamp).toLocaleString('en-IN')}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
