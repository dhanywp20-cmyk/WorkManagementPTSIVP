'use client';
// ─── Incentive PTS — Tab: Rekap Incentive ────────────────────────────────────

import { IncentiveProject, IncentiveDisbursement, RekapItem, User } from './types';
import { Badge, fmtRp, fmtPct } from './shared';

interface Props {
  rekapData: RekapItem[];
  disbursements: IncentiveDisbursement[];
  projects: IncentiveProject[];
  filterPeriode: string;
  isTeamPTS: boolean;
  isAdmin: boolean;
  currentUser: User | null;
  filterLabel: string;
  onExport: () => void;
}

export function RekapTab({
  rekapData,
  disbursements,
  projects,
  filterPeriode,
  isTeamPTS,
  isAdmin,
  currentUser,
  filterLabel,
  onExport,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-800">📊 Rekap Incentive Per Orang</h2>
          <div className="flex items-center gap-2">
            {filterLabel !== 'Semua Periode' && filterLabel !== 'Semua Tahun' && filterLabel !== 'Semua' && (
              <Badge color="blue">{filterLabel}</Badge>
            )}
            <button
              onClick={onExport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}
            >
              Export Excel
            </button>
          </div>
        </div>

        {rekapData.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-4xl mb-3">📊</p>
            <p className="text-gray-500">Belum ada data rekap untuk periode ini</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {rekapData.map((r, i) => {
              // Team user only sees their own data
              if (isTeamPTS && !isAdmin && r.person_name !== currentUser?.full_name) return null;

              const personDisb = disbursements.filter(
                (d) =>
                  d.person_name === r.person_name &&
                  (filterPeriode === 'all' || d.periode === filterPeriode)
              );

              return (
                <div key={r.person_name} className="px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-bold text-gray-800">{r.person_name}</p>
                        <p className="text-xs text-gray-400">
                          {r.handler_count}× handler · {r.backup_count}× backup
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-indigo-600">{fmtRp(r.total_rp)}</p>
                      <p className="text-xs text-gray-400">{r.count} project</p>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1.5">
                    {personDisb.map((d) => {
                      const proj = projects.find((p) => p.id === d.project_id);
                      return (
                        <div
                          key={d.id}
                          className="flex items-center justify-between text-xs bg-gray-50 rounded-xl px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <span>{d.role_type === 'handler' ? '⭐' : '🤝'}</span>
                            <span className="text-gray-700 font-medium">{proj?.project_name ?? '-'}</span>
                            <Badge color={d.role_type === 'handler' ? 'purple' : 'blue'}>{d.role_type}</Badge>
                            {proj?.status === 'paid' && <Badge color="green">Lunas</Badge>}
                          </div>
                          <div className="text-right">
                            <span className="text-gray-500 mr-2">{fmtPct(d.pct)}</span>
                            <span className="font-bold text-gray-800">{fmtRp(d.amount_rp)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
