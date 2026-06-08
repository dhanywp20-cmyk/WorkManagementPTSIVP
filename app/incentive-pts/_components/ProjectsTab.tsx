'use client';
// ─── Incentive PTS — Tab: Projects ───────────────────────────────────────────

import { IncentiveProject } from './types';
import { Badge, fmtRp, fmtDate, fmtPeriode } from './shared';

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
              <th className={`${thCls} w-[140px] text-center`}>Status</th>
              <th className={`${thCls} w-[160px] text-center`}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-16 text-center border border-gray-200">
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
                      <Badge
                        color={proj.status === 'paid' ? 'green' : proj.biaya_cadangan > 0 ? 'amber' : 'gray'}
                        square
                      >
                        {proj.status === 'paid'
                          ? '✅ Lunas'
                          : proj.biaya_cadangan > 0
                          ? '⏳ Pending'
                          : '⚪ Belum ada biaya'}
                      </Badge>
                    </td>
                    <td className={`${cellCls} text-center`}>
                      <div className="flex items-center justify-center gap-1 flex-nowrap">
                        <button
                          onClick={() => onView(proj)}
                          className="px-2 py-1 rounded text-xs font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 transition-colors whitespace-nowrap"
                          title="Lihat detail"
                        >
                          👁 View
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => onSetBackup(proj)}
                            className="px-2 py-1 rounded text-xs font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 transition-colors"
                            title="Set backup"
                          >
                            🤝
                          </button>
                        )}
                        {canInputBiaya && proj.status === 'pending' && (
                          <button
                            onClick={() => onInputBiaya(proj)}
                            className="px-2 py-1 rounded text-xs font-semibold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                            title={proj.biaya_cadangan > 0 ? 'Edit biaya' : 'Input biaya'}
                          >
                            {proj.biaya_cadangan > 0 ? '✏️' : '💵'}
                          </button>
                        )}
                        {isAdmin && proj.status === 'pending' && proj.biaya_cadangan > 0 && (
                          <button
                            onClick={() => onMarkPaid(proj)}
                            className="px-2 py-1 rounded text-xs font-semibold bg-green-50 text-green-600 hover:bg-green-100 border border-green-200 transition-colors"
                            title="Tandai lunas"
                          >
                            ✅
                          </button>
                        )}
                      </div>
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
