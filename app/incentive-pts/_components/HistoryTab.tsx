'use client';
// ─── Incentive PTS — Tab: History Pembayaran ─────────────────────────────────

import { IncentiveProject, IncentiveDisbursement } from './types';
import { fmtRp, fmtPct, fmtDate, fmtPeriode } from './shared';

interface Props {
  projects: IncentiveProject[];
  disbursements: IncentiveDisbursement[];
  projectMatchesFilter: (p: IncentiveProject) => boolean;
}

export function HistoryTab({ projects, disbursements, projectMatchesFilter }: Props) {
  const paidProjects = projects.filter((p) => p.status === 'paid' && projectMatchesFilter(p));

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="font-bold text-gray-800">🕒 History Pembayaran</h2>
      </div>

      {paidProjects.length === 0 ? (
        <div className="p-12 text-center">
          <p className="text-4xl mb-3">🕒</p>
          <p className="text-gray-500">Belum ada pembayaran yang diselesaikan</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {paidProjects.map((proj) => {
            const projDisb = disbursements.filter((d) => d.project_id === proj.id);
            return (
              <div key={proj.id} className="px-5 py-4">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                  <div>
                    <h3 className="font-bold text-gray-800">{proj.project_name}</h3>
                    <p className="text-xs text-gray-400">
                      Lunas: {fmtDate(proj.paid_at)} · oleh {proj.paid_by} · Periode:{' '}
                      {fmtPeriode(proj.periode)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Biaya Cadangan</p>
                    <p className="font-bold text-indigo-600">{fmtRp(proj.biaya_cadangan)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {projDisb.map((d) => (
                    <div
                      key={d.id}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs border ${
                        d.role_type === 'handler'
                          ? 'bg-indigo-50 border-indigo-200'
                          : 'bg-blue-50 border-blue-200'
                      }`}
                    >
                      <span>{d.role_type === 'handler' ? '⭐' : '🤝'}</span>
                      <span className="font-semibold text-gray-700">{d.person_name}</span>
                      <span className="text-gray-500">{fmtPct(d.pct)}</span>
                      <span className="font-bold text-emerald-600">{fmtRp(d.amount_rp)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
