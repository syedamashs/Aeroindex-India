import { useAuth } from '@/context/AuthContext';

export function AuditLogPage() {
  const { auditLog, user } = useAuth();

  return (
    <div className="space-y-6 animate-fade-in max-w-[1440px]">
      {/* 1. HEADER */}
      <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-mono tracking-widest text-slate-500">Security &amp; Governance</span>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-mono text-slate-400">AUDIT-TRAIL</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 mt-1">
            System Activity Log &amp; Governance Audit Trail
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable session event stream recording user logins, scraper triggers, and parameter calibrations
          </p>
        </div>

        <div className="text-xs font-mono text-slate-500">
          Current Operator: <span className="text-slate-800 font-semibold">{user?.email || 'analyst@aeroindex.gov.in'}</span>
        </div>
      </div>

      {/* 2. AUDIT LOG ACTIVITY TABLE */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="table-th w-44">Timestamp (IST)</th>
                <th className="table-th">User / Identity</th>
                <th className="table-th">Action Performed</th>
                <th className="table-th">Module</th>
                <th className="table-th text-center w-24">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-xs">
              {auditLog.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400 font-sans">
                    No session events recorded in current cycle.
                  </td>
                </tr>
              ) : (
                auditLog.map((entry) => (
                  <tr key={entry.id} className="table-row">
                    <td className="table-td text-slate-500 text-[11px]">
                      {new Date(entry.timestamp).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="table-td font-semibold text-slate-900">
                      {entry.user}
                    </td>
                    <td className="table-td text-slate-800 font-sans">
                      {entry.action}
                    </td>
                    <td className="table-td text-slate-600 font-sans">
                      {entry.module}
                    </td>
                    <td className="table-td text-center font-sans">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                        SUCCESS
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
