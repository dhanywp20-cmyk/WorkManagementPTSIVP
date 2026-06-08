'use client';
// ─── Incentive PTS — Tab: Projects ───────────────────────────────────────────

import { IncentiveProject } from './types';
import { Badge, fmtRp, fmtDate, fmtPeriode } from './shared';
import { ViewIconBtn, EditIconBtn, CompleteIconBtn, ActionGroup } from '@/components/shared/ActionIcons';

interface Props {
  filteredProjects: IncentiveProject[];
  totalProjects: number;
  totalBiaya: number;
  isAdmin: boolean;
  canInputBiaya: boolean;
  onView: (p: IncentiveProject) => void;
  onSetBackup: (p: IncentiveProject) => void;
  onInputBiaya: (p: IncentiveProject) => void;
  onMarkPaid: (p: IncentiveProject) => void;
}

// Backup icon button — same style as ActionIcons
function BackupIconBtn({ onClick, title }: { onClick: () => void; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title ?? 'Set Tim Backup'}
      className="inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-all duration-150 bg-white border-slate-200 text-sky-500 hover:bg-sky-50 hover:border-sky-300 hover:shadow-sm"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    </button>
  );
}

export function ProjectsTab({
  filteredProjects,
  totalProjects,
  totalBiaya,
  isAdmin,
  canInputBiaya,
  onView,
  onSetBackup,
  onInputBiaya,
  onMarkPaid,
}: Props) {
  const thCls =
    'px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider border border-gray-200';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.10),rgba(139,92,246,0.07))' }}>
              <th className={`${thCls} w-10`}>No</th>
              <th className={`${thCls} min-w-[180px]`}>Project Name</th>
              <th className={`${thCls} w-[140px]`}>Kategori</th>
              <th className={`${thCls} w-[140px]`}>Handler</th>
              <th className={`${thCls} w-[130px]`}>Sales</th>
              <th className={`${thCls} w-[110px]`}>Tanggal</th>
              <th className={`${thCls} w-[130px]`}>No. COS Project</th>
              <th className="px-3 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider border border-gray-200 w-[150px]">
                Nominal Cadangan
              </th>
              <th className={`${thCls} w-[120px] text-center`}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-16 text-center border border-gray-200">
                  <p className="text-4xl mb-3">📭</p>
                  <p className="text-gray-500 font-medium">Belum ada project incentive</p>
                  <p className="text-gray-400 text-xs mt-1">
                    Data otomatis muncul dari Reminder Schedule kategori Training / Konfigurasi &amp; Training yang sudah selesai
                  </p>
                </td>
              </tr>
            ) : (
              filteredProjects.map((proj, idx) => {
                const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-indigo-50/30';
                const cellCls = `border border-gray-200 px-3 py-2.5 ${rowBg}`;
                return (
                  <tr key={proj.id} className="hover:bg-indigo-50/60 transition-colors group">
                    <td className={`${cellCls} text-xs text-gray-400 font-medium text-center`}>{idx + 1}</td>
                    <td className={cellCls}>
                      <p className="font-semibold text-gray-800 text-sm leading-snug">{proj.project_name}</p>
                      {proj.address && (
                        <p className="text-[11px] text-gray-400 mt-0.5 truncate max-w-[220px]">📍 {proj.address}</p>
                      )}
                    </td>
                    <td className={cellCls}>
                      <Badge color="purple" square>{proj.category}</Badge>
                    </td>
                    <td className={cellCls}>
                      <p className="text-sm font-medium text-gray-700">{proj.handler_name}</p>
                      {proj.backup_names.length > 0 && (
                        <p className="text-[11px] text-gray-400 mt-0.5">+{proj.backup_names.length} backup</p>
                      )}
                    </td>
                    <td className={cellCls}>
                      {proj.sales_name ? (
                        <>
                          <p className="text-sm text-gray-700">{proj.sales_name}</p>
                          {proj.sales_division && (
                            <p className="text-[11px] text-gray-400">{proj.sales_division}</p>
                          )}
                        </>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className={cellCls}>
                      <p className="text-sm text-gray-600">{fmtDate(proj.due_date)}</p>
                      <p className="text-[11px] text-gray-400">{fmtPeriode(proj.periode)}</p>
                    </td>
                    <td className={cellCls}>
                      {proj.cos_project_no ? (
                        <span className="text-sm font-mono font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          {proj.cos_project_no}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className={`${cellCls} text-right`}>
                      {proj.biaya_cadangan > 0 ? (
                        <p className="font-bold text-indigo-600 text-sm">{fmtRp(proj.biaya_cadangan)}</p>
                      ) : (
                        <span className="text-gray-300 text-xs">Belum diinput</span>
                      )}
                    </td>
                    <td className={`${cellCls} text-center`}>
                      <ActionGroup>
                        <ViewIconBtn onClick={() => onView(proj)} title="Lihat detail" />
                        {isAdmin && (
                          <BackupIconBtn onClick={() => onSetBackup(proj)} title="Set Tim Backup" />
                        )}
                        {canInputBiaya && proj.status === 'pending' && (
                          <EditIconBtn
                            onClick={() => onInputBiaya(proj)}
                            title={proj.biaya_cadangan > 0 ? 'Edit biaya cadangan' : 'Input biaya cadangan'}
                          />
                        )}
                        {isAdmin && proj.status === 'pending' && proj.biaya_cadangan > 0 && (
                          <CompleteIconBtn onClick={() => onMarkPaid(proj)} title="Tandai lunas" />
                        )}
                      </ActionGroup>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {filteredProjects.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between bg-gray-50">
          <span className="text-xs text-gray-400">
            Menampilkan {filteredProjects.length} dari {totalProjects} project
          </span>
          <span className="text-xs text-gray-400">
            Total: <strong className="text-indigo-600">{fmtRp(totalBiaya)}</strong>
          </span>
        </div>
      )}
    </div>
  );
}
