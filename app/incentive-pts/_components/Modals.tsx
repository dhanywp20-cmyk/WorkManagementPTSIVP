'use client';
// ─── Incentive PTS — Modals (View / Biaya / Backup / Paid) ───────────────────

import { IncentiveProject, IncentiveDisbursement, IncentiveSetting, User } from './types';

import { Badge, fmtRp, fmtPct, fmtDate, fmtPeriode, inputCls, btnPrimary, INCENTIVE_TRIGGER_CATEGORIES } from './shared';

// ── 1. View Detail Modal ──────────────────────────────────────────────────────
interface ViewModalProps {
  project: IncentiveProject;
  disbursements: IncentiveDisbursement[];
  isAdmin: boolean;
  canInputBiaya: boolean;
  onClose: () => void;
  onSetBackup: () => void;
  onInputBiaya: () => void;
  onMarkPaid: () => void;
  onRecalculate?: () => void;
  onMarkYearPaid?: (disbId: string, year: 1 | 2 | 3) => void;
  onMarkResigned?: (disbId: string) => void;
}

export function ViewModal({
  project,
  disbursements,
  isAdmin,
  canInputBiaya,
  onClose,
  onSetBackup,
  onInputBiaya,
  onMarkPaid,
  onRecalculate,
  onMarkYearPaid,
  onMarkResigned,
}: ViewModalProps) {
  void onMarkPaid;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-full flex flex-col">
        {/* Header */}
        <div
          className="px-6 py-4 border-b border-gray-100 flex-shrink-0 relative"
          style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.06),rgba(139,92,246,0.04))' }}
        >
          <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center font-bold text-sm">✕</button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge color="purple" square>{project.category}</Badge>
              {project.mode_penyelesaian === 'onsite' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">🏢 ONSITE</span>
              )}
              {project.mode_penyelesaian === 'remote' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-700 border border-blue-200">💻 REMOTE</span>
              )}
            </div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mt-2 mb-0.5">Nama Project</p>
            <h3 className="font-bold text-gray-800 text-base leading-snug">{project.project_name}</h3>
            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mt-1.5 mb-0.5">Tanggal · Periode</p>
            <p className="text-xs text-gray-600">
              {fmtDate(project.due_date)} · {fmtPeriode(project.periode)}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {/* Assign + Jadwal */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Assign To</p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {project.handler_name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-gray-800 text-sm leading-tight">{project.handler_name}</p>
                  {project.backup_names.length > 0 && (
                    <p className="text-[11px] text-gray-400">+{project.backup_names.length} backup</p>
                  )}
                </div>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">📅 Jadwal</p>
              <p className="font-bold text-gray-800 text-sm">{fmtDate(project.due_date)}</p>
              <p className="text-xs text-gray-400 mt-0.5">Periode: {fmtPeriode(project.periode)}</p>
            </div>
          </div>

          {/* Info project */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100" style={{ background: 'rgba(99,102,241,0.05)' }}>
              <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">📋 Informasi Project</p>
            </div>
            <div className="divide-y divide-gray-100">
              <InfoRow icon="📦" label="Product / Unit" value={project.product || '—'} />
              <InfoRow
                icon="👤"
                label="Nama Sales & Divisi"
                value={`${project.sales_name ?? '—'}${project.sales_division ? ` / ${project.sales_division}` : ''}`}
              />
              {project.cos_project_no && (
                <div className="flex items-start gap-3 px-4 py-3">
                  <span className="text-base mt-0.5">🔖</span>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">No. COS Project</p>
                    <p className="font-mono font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 inline-block text-sm mt-0.5">
                      {project.cos_project_no}
                    </p>
                  </div>
                </div>
              )}
              {project.address && <InfoRow icon="📍" label="Lokasi" value={project.address} />}
              {project.pic_name && (
                <div className="flex items-start gap-3 px-4 py-3">
                  <span className="text-base mt-0.5">🙋</span>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">PIC</p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5">{project.pic_name}</p>
                    {project.pic_phone && <p className="text-xs text-gray-400 mt-0.5">📱 {project.pic_phone}</p>}
                  </div>
                </div>
              )}
              <InfoRow icon="📄" label="Deskripsi" value={project.description || '—'} />
              <div className="flex items-start gap-3 px-4 py-3 bg-amber-50/50">
                <span className="text-base mt-0.5">📝</span>
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Catatan</p>
                  <p className="text-sm text-gray-700 mt-0.5 leading-relaxed">{project.notes || '—'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Installer (Remote only) */}
          {project.mode_penyelesaian === 'remote' && project.installer_name && (
            <div className="bg-white rounded-xl border border-blue-200 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-blue-100" style={{ background: 'rgba(59,130,246,0.06)' }}>
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">💻 Installer Daerah (Remote)</p>
              </div>
              <div className="px-4 py-3 space-y-1">
                <p className="text-sm font-semibold text-gray-800">{project.installer_name}</p>
                {project.installer_daerah && <p className="text-xs text-gray-500">📍 {project.installer_daerah}</p>}
                {project.installer_incentive_pct ? (
                  <p className="text-xs text-blue-600 font-semibold mt-1">
                    Incentive: {fmtPct(project.installer_incentive_pct)}
                    {project.installer_incentive_nominal ? ` → ${fmtRp(project.installer_incentive_nominal)}` : ''}
                  </p>
                ) : null}
              </div>
            </div>
          )}

          {/* Tim Backup */}
          {project.backup_names.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100" style={{ background: 'rgba(14,165,233,0.05)' }}>
                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">🤝 Tim Backup</p>
              </div>
              <div className="px-4 py-3 flex flex-wrap gap-2">
                {project.backup_names.map((name) => (
                  <span key={name} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold">
                    🤝 {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Biaya & Distribusi */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100" style={{ background: 'rgba(99,102,241,0.05)' }}>
              <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">💰 Biaya & Distribusi Incentive</p>
            </div>
            {project.biaya_cadangan > 0 ? (
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between bg-rose-50 rounded-lg px-3 py-2.5 border border-rose-100">
                  <p className="text-sm text-rose-700 font-semibold">Biaya Cadangan</p>
                  <div className="flex items-center gap-2">
                    <p className="text-base font-bold text-rose-600">{fmtRp(project.biaya_cadangan)}</p>
                    {canInputBiaya && onRecalculate && (
                      <button
                        onClick={onRecalculate}
                        title="Hitung ulang distribusi berdasarkan formula terbaru"
                        className="text-[11px] font-semibold text-rose-400 hover:text-rose-700 border border-rose-200 hover:border-rose-400 rounded-lg px-2 py-0.5 transition-all bg-white"
                      >
                        🔄 Recalculate
                      </button>
                    )}
                  </div>
                </div>
                {disbursements.map((d) => {
                  const isInstaller = d.role_type === 'installer';
                  const isResigned  = d.member_status === 'resigned';
                  const ri = ({
                    handler:    { cls: 'bg-rose-50 border-rose-200',  icon: '⭐', label: 'PIC',        color: 'indigo'  as const },
                    backup:     { cls: 'bg-blue-50 border-blue-200',      icon: '🤝', label: 'Support',    color: 'blue'    as const },
                    installer:  { cls: 'bg-sky-50 border-sky-200',        icon: '🔧', label: 'Installer',  color: 'blue'    as const },
                    atasan:     { cls: 'bg-purple-50 border-purple-200',  icon: '👔', label: 'Manager',    color: 'purple'  as const },
                    supervisor: { cls: 'bg-purple-50 border-purple-200',  icon: '🎖️', label: 'Supervisor', color: 'purple'  as const },
                    manager:    { cls: 'bg-purple-50 border-purple-200',  icon: '👔', label: 'Manager',    color: 'purple'  as const },
                  } as Record<string, { cls: string; icon: string; label: string; color: 'indigo'|'blue'|'purple'|'gray' }>)[d.role_type]
                    ?? { cls: 'bg-gray-50 border-gray-200', icon: '•', label: d.role_type, color: 'gray' as const };
                  const y1rp = Math.round(d.amount_rp * 0.50);
                  const y2rp = Math.round(d.amount_rp * 0.35);
                  const y3rp = Math.round(d.amount_rp * 0.15);
                  const hasYearFields = d.payment_year_1_paid !== undefined;
                  return (
                    <div key={d.id} className={`rounded-lg border ${ri.cls} ${isResigned ? 'opacity-60' : ''}`}>
                      <div className="flex items-center justify-between px-3 py-2 text-sm">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{ri.icon}</span>
                          <span className="font-semibold text-gray-700">{d.person_name}</span>
                          <Badge color={ri.color}>{ri.label}</Badge>
                          {isResigned && <Badge color="red">Resign</Badge>}
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <span className="text-gray-400 text-xs mr-1">{fmtPct(d.pct)}</span>
                          <span className="font-bold text-gray-800">{fmtRp(d.amount_rp)}</span>
                        </div>
                      </div>
                      {isInstaller ? (
                        <div className="border-t border-sky-100 px-3 py-1.5 flex items-center gap-2">
                          <span className="text-[11px] text-sky-600 font-semibold">Langsung Lunas · 1× Bayar</span>
                          {project.installer_daerah && <span className="text-[10px] text-gray-400">📍 {project.installer_daerah}</span>}
                        </div>
                      ) : hasYearFields ? (
                        <div className="border-t border-opacity-40 px-3 pb-2 pt-1 space-y-1.5">
                          {([1, 2, 3] as const).map(yr => {
                            const yrRp  = yr === 1 ? y1rp : yr === 2 ? y2rp : y3rp;
                            const yrPct = yr === 1 ? 50   : yr === 2 ? 35    : 15;
                            const paid  = yr === 1 ? !!d.payment_year_1_paid : yr === 2 ? !!d.payment_year_2_paid : !!d.payment_year_3_paid;
                            return (
                              <div key={yr} className="flex items-center justify-between text-xs">
                                <span className="text-gray-500">Thn {yr} ({yrPct}%) · {fmtRp(yrRp)}</span>
                                {paid ? (
                                  <span className="text-emerald-600 font-bold text-[11px]">✓ Lunas</span>
                                ) : canInputBiaya && onMarkYearPaid && !isResigned ? (
                                  <button
                                    onClick={() => onMarkYearPaid(d.id, yr)}
                                    className="px-1.5 py-0.5 rounded text-[10px] font-bold border border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-50"
                                  >Tandai Lunas</button>
                                ) : (
                                  <span className="text-gray-300 text-[11px]">Pending</span>
                                )}
                              </div>
                            );
                          })}
                          {isAdmin && onMarkResigned && !isResigned && (
                            <div className="pt-0.5 flex justify-end">
                              <button
                                onClick={() => onMarkResigned(d.id)}
                                className="text-[10px] text-red-400 hover:text-red-600 border border-red-200 hover:border-red-300 rounded px-2 py-0.5"
                              >Tandai Resign</button>
                            </div>
                          )}
                          {d.redistributed_to && Array.isArray(d.redistributed_to) && d.redistributed_to.length > 0 && (
                            <p className="text-[10px] text-red-400 pt-0.5">Redistribusi → {(d.redistributed_to as string[]).join(', ')}</p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                {project.biaya_input_by && (
                  <p className="text-[11px] text-gray-400 px-1">
                    Diinput oleh {project.biaya_input_by} · {fmtDate(project.biaya_input_at)}
                  </p>
                )}
              </div>
            ) : (
              <div className="px-4 py-5 text-center text-sm text-gray-400">
                Biaya cadangan belum diinput
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-2 flex-shrink-0 flex-wrap">
          {isAdmin && (
            <button onClick={onSetBackup} className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold text-white hover:opacity-90`} style={{ background: 'linear-gradient(135deg,#0ea5e9,#0284c7)' }}>
              🤝 Set Backup
            </button>
          )}
          {canInputBiaya && (
            <button onClick={onInputBiaya} className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold text-white hover:opacity-90`} style={{ background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)' }}>
              {project.biaya_cadangan > 0 ? '✏️ Edit Biaya' : '💵 Input Biaya'}
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helper: info row ──────────────────────────────────────────────────────────
function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="text-base mt-0.5">{icon}</span>
      <div className="flex-1">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-semibold text-gray-800 mt-0.5 leading-relaxed">{value}</p>
      </div>
    </div>
  );
}

// ── 2. Biaya Modal ────────────────────────────────────────────────────────────
interface BiayaModalProps {
  project: IncentiveProject;
  settings: IncentiveSetting | null;
  teamUsers: User[];
  ptsAtasan?: User[];
  biayaInput: string;
  cosInput: string;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onBiayaChange: (v: string) => void;
  onCosChange: (v: string) => void;
}

export function BiayaModal({
  project, settings, teamUsers, ptsAtasan = [], biayaInput, cosInput, saving,
  onClose, onSave, onBiayaChange, onCosChange,
}: BiayaModalProps) {
  // Selaras dengan createDisbursements: atasan dari mapping grup 'PTS', fallback jabatan
  const supervisorUser = ptsAtasan.find(u => u.jabatan === 'Supervisor') ?? teamUsers.find(u => u.jabatan === 'Supervisor');
  const managerUser    = ptsAtasan.find(u => u.jabatan === 'Manager')    ?? teamUsers.find(u => u.jabatan === 'Manager');
  const supervisorIsHandler = supervisorUser?.full_name === project.handler_name;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h3 className="font-bold text-gray-800 text-lg">
          {project.biaya_cadangan > 0 ? '✏️ Edit Biaya Cadangan' : '💵 Input Biaya Cadangan'}
        </h3>
        <div className="bg-rose-50 rounded-xl p-3 text-sm">
          <p className="font-semibold text-rose-700">{project.project_name}</p>
          <p className="text-rose-500 text-xs">{project.category} · Handler: {project.handler_name}</p>
        </div>
        {settings && (() => {
          const isIncentiveCat = (INCENTIVE_TRIGGER_CATEGORIES as string[]).includes(project.category);
          const mode = project.mode_penyelesaian;
          if (isIncentiveCat) {
            if (!mode) return (
              <div className="bg-amber-50 rounded-xl p-3 text-xs text-amber-700 border border-amber-200">
                ⚠️ Mode penyelesaian (Onsite/Remote) belum dipilih. Lengkapi di reminder terlebih dahulu.
              </div>
            );
            const backupCount = project.backup_names.length;
            const managerPct = supervisorIsHandler ? 20 : 10;
            if (mode === 'onsite') {
              const picPct = backupCount === 0 ? 80 : 65;
              return (
                <div className="bg-emerald-50 rounded-xl p-3 text-xs text-gray-600 space-y-1 border border-emerald-200">
                  <p className="font-bold text-emerald-700 mb-1">🏢 Mode ONSITE — Distribusi:</p>
                  <p>⭐ {project.handler_name}: <strong>{picPct}%</strong>
                    {backupCount === 0 && <span className="text-emerald-600"> (+15% pool kosong)</span>}
                    {supervisorIsHandler && <span className="text-emerald-600"> (merangkap Supervisor)</span>}
                  </p>
                  {backupCount > 0
                    ? project.backup_names.map(n => <p key={n}>🤝 {n}: <strong>{fmtPct(15 / backupCount)}</strong></p>)
                    : <p className="text-amber-600">⚠️ Tidak ada support (pool 15% ke PIC)</p>}
                  {supervisorUser && !supervisorIsHandler && <p>🎖️ {supervisorUser.full_name} (Supervisor): <strong>10%</strong></p>}
                  <p>👔 {managerUser?.full_name ?? 'Manager PTS'}: <strong>{managerPct}%</strong>
                    {supervisorIsHandler && <span className="text-purple-600"> (+10% dari Supervisor)</span>}
                  </p>
                </div>
              );
            }
            const hasInstaller = !!project.installer_name;
            const picPct = 60 + (hasInstaller ? 0 : 10) + (backupCount === 0 ? 10 : 0);
            return (
              <div className="bg-blue-50 rounded-xl p-3 text-xs text-gray-600 space-y-1 border border-blue-200">
                <p className="font-bold text-blue-700 mb-1">💻 Mode REMOTE — Distribusi:</p>
                <p>⭐ {project.handler_name}: <strong>{picPct}%</strong>
                  {!hasInstaller && <span className="text-blue-600"> (+10% no installer)</span>}
                  {backupCount === 0 && <span className="text-blue-600"> (+10% no support)</span>}
                </p>
                {hasInstaller
                  ? <p>🔧 Installer ({project.installer_name}): <strong>10%</strong></p>
                  : <p className="text-gray-400">— Tidak ada installer</p>}
                {backupCount > 0
                  ? project.backup_names.map(n => <p key={n}>🤝 {n}: <strong>{fmtPct(10 / backupCount)}</strong></p>)
                  : <p className="text-gray-400">— Tidak ada support aktif</p>}
                {supervisorUser && !supervisorIsHandler && <p>🎖️ {supervisorUser.full_name} (Supervisor): <strong>10%</strong></p>}
                <p>👔 {managerUser?.full_name ?? 'Manager PTS'}: <strong>{managerPct}%</strong>
                  {supervisorIsHandler && <span className="text-purple-600"> (+10% dari Supervisor)</span>}
                </p>
              </div>
            );
          }
          return (
            <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 space-y-1">
              <p>⭐ Handler ({project.handler_name}): <strong className="text-gray-700">{fmtPct(settings.handler_pct)}</strong></p>
              {project.backup_names.length > 0 ? (
                <p>🤝 Backup ({project.backup_names.length} orang): <strong className="text-gray-700">{project.backup_names.join(', ')}</strong></p>
              ) : (
                <p className="text-amber-600">⚠️ Belum ada backup — 100% ke handler</p>
              )}
            </div>
          );
        })()}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            No. COS Project <span className="text-gray-400 font-normal">(opsional)</span>
          </label>
          <input type="text" value={cosInput} onChange={(e) => onCosChange(e.target.value)} placeholder="Contoh: COS-2026-001" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Biaya Cadangan (Rp)</label>
          <input
            type="text"
            value={biayaInput ? Number(biayaInput).toLocaleString('id-ID') : ''}
            onChange={(e) => onBiayaChange(e.target.value.replace(/\./g, '').replace(/[^0-9]/g, ''))}
            placeholder="Contoh: 5.000.000"
            className={inputCls}
          />
          {biayaInput && settings && (
            <div className="mt-2 p-3 bg-rose-50 rounded-xl space-y-1 text-xs">
              <p className="font-semibold text-rose-700">Preview distribusi:</p>
              {(() => {
                const base = parseFloat(biayaInput);
                if (isNaN(base) || base <= 0) return null;
                const isIncentiveCat = (INCENTIVE_TRIGGER_CATEGORIES as string[]).includes(project.category);
                const mode = project.mode_penyelesaian;
                const backupCount = project.backup_names.length;
                const amt = (pct: number) => Math.round(base * pct / 100);

                if (isIncentiveCat && mode === 'onsite') {
                  const picPct = backupCount === 0 ? 80 : 65;
                  const perBackupPct = backupCount > 0 ? 15 / backupCount : 0;
                  const mgrPct = supervisorIsHandler ? 20 : 10;
                  return (<>
                    <p>⭐ {project.handler_name}: <strong>{fmtRp(amt(picPct))}</strong> ({picPct}%)</p>
                    {project.backup_names.map(b => <p key={b}>🤝 {b}: <strong>{fmtRp(amt(perBackupPct))}</strong> ({fmtPct(perBackupPct)})</p>)}
                    {supervisorUser && !supervisorIsHandler && <p>🎖️ {supervisorUser.full_name}: <strong>{fmtRp(amt(10))}</strong> (10%)</p>}
                    <p>👔 {managerUser?.full_name ?? 'Manager'}: <strong>{fmtRp(amt(mgrPct))}</strong> ({mgrPct}%)</p>
                  </>);
                }
                if (isIncentiveCat && mode === 'remote') {
                  const hasInstaller = !!project.installer_name;
                  const picPct = 60 + (hasInstaller ? 0 : 10) + (backupCount === 0 ? 10 : 0);
                  const perSupportPct = backupCount > 0 ? 10 / backupCount : 0;
                  const mgrPct = supervisorIsHandler ? 20 : 10;
                  return (<>
                    <p>⭐ {project.handler_name}: <strong>{fmtRp(amt(picPct))}</strong> ({picPct}%)</p>
                    {hasInstaller && <p>🔧 Installer ({project.installer_name}): <strong>{fmtRp(amt(10))}</strong> (10%)</p>}
                    {project.backup_names.map(b => <p key={b}>🤝 {b}: <strong>{fmtRp(amt(perSupportPct))}</strong> ({fmtPct(perSupportPct)})</p>)}
                    {supervisorUser && !supervisorIsHandler && <p>🎖️ {supervisorUser.full_name}: <strong>{fmtRp(amt(10))}</strong> (10%)</p>}
                    <p>👔 {managerUser?.full_name ?? 'Manager'}: <strong>{fmtRp(amt(mgrPct))}</strong> ({mgrPct}%)</p>
                  </>);
                }
                // Legacy
                const backupPer = backupCount > 0 ? settings.backup_pct / backupCount : 0;
                return (<>
                  <p>⭐ {project.handler_name}: <strong>{fmtRp(amt(settings.handler_pct))}</strong> ({fmtPct(settings.handler_pct)})</p>
                  {project.backup_names.map(b => <p key={b}>🤝 {b}: <strong>{fmtRp(amt(backupPer))}</strong> ({fmtPct(backupPer)})</p>)}
                </>);
              })()}
            </div>
          )}
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">Batal</button>
          <button onClick={onSave} disabled={saving} className={`flex-1 ${btnPrimary}`} style={{ background: 'linear-gradient(135deg,#f43f5e,#8b5cf6)' }}>
            {saving ? 'Menyimpan...' : '💾 Simpan & Kalkulasi'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 3. Backup Modal ───────────────────────────────────────────────────────────
interface BackupModalProps {
  project: IncentiveProject;
  teamUsers: User[];
  backupSelected: string[];
  detectedSupport: string[];
  settings: IncentiveSetting | null;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onToggle: (name: string, checked: boolean) => void;
}

export function BackupModal({
  project, teamUsers, backupSelected, detectedSupport, settings, saving,
  onClose, onSave, onToggle,
}: BackupModalProps) {
  const isIncentiveCat = (INCENTIVE_TRIGGER_CATEGORIES as string[]).includes(project.category);
  const mode = project.mode_penyelesaian;

  // Hitung preview pct untuk info
  const backupCount = backupSelected.length;
  let supportPct = 0;
  if (isIncentiveCat && mode === 'onsite') supportPct = backupCount > 0 ? 15 / backupCount : 0;
  else if (isIncentiveCat && mode === 'remote') supportPct = backupCount > 0 ? 10 / backupCount : 0;
  else if (settings) supportPct = backupCount > 0 ? settings.backup_pct / backupCount : 0;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h3 className="font-bold text-gray-800 text-lg">🤝 Set Tim Support</h3>
        <div className="bg-blue-50 rounded-xl p-3 text-sm">
          <p className="font-semibold text-blue-700">{project.project_name}</p>
          <p className="text-blue-500 text-xs">Handler: {project.handler_name}</p>
        </div>

        {/* Info auto-detected dari Troubleshooting */}
        {detectedSupport.length > 0 ? (
          <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200">
            <p className="text-xs font-bold text-emerald-700 mb-1.5">🔍 Auto-detected dari Troubleshooting:</p>
            <div className="flex flex-wrap gap-1.5">
              {detectedSupport.map(name => (
                <span key={name} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-semibold border border-emerald-200">
                  ✓ {name}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-emerald-600 mt-1.5">Berdasarkan reminder Troubleshooting dengan nama project yang sama.</p>
          </div>
        ) : (
          <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
            <p className="text-xs text-amber-700">⚠️ Tidak ada Troubleshooting aktif untuk project ini. Pilih manual jika diperlukan.</p>
          </div>
        )}

        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {teamUsers
            .filter((u) => u.full_name !== project.handler_name)
            .map((u) => {
              const isDetected = detectedSupport.includes(u.full_name);
              const isChecked = backupSelected.includes(u.full_name);
              return (
                <label
                  key={u.username}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-colors ${
                    isChecked
                      ? isDetected
                        ? 'bg-emerald-50 border-emerald-300'
                        : 'bg-blue-50 border-blue-300'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => onToggle(u.full_name, e.target.checked)}
                    className="w-4 h-4 rounded accent-blue-600"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-700">{u.full_name}</p>
                    <p className="text-xs text-gray-400">{u.jabatan ?? u.team_type ?? u.role}</p>
                  </div>
                  {isDetected && (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">🔍 TS</span>
                  )}
                </label>
              );
            })}
        </div>

        {backupCount > 0 && (
          <div className="text-xs rounded-xl px-3 py-2 border" style={{
            background: isIncentiveCat && mode === 'onsite' ? '#f0fdf4' : isIncentiveCat && mode === 'remote' ? '#eff6ff' : '#f0f9ff',
            borderColor: isIncentiveCat && mode === 'onsite' ? '#bbf7d0' : isIncentiveCat && mode === 'remote' ? '#bfdbfe' : '#bae6fd',
            color: isIncentiveCat ? '#065f46' : '#0c4a6e',
          }}>
            🤝 {backupCount} orang support · masing-masing <strong>{fmtPct(supportPct)}</strong>
            {isIncentiveCat && mode === 'onsite' && ' dari pool 15% Onsite'}
            {isIncentiveCat && mode === 'remote' && ' dari pool 10% Remote'}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">Batal</button>
          <button onClick={onSave} disabled={saving} className={`flex-1 ${btnPrimary}`} style={{ background: 'linear-gradient(135deg,#0ea5e9,#0284c7)' }}>
            {saving ? 'Menyimpan...' : '💾 Simpan Support'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 4. Paid Confirmation Modal ────────────────────────────────────────────────
interface PaidModalProps {
  project: IncentiveProject;
  onClose: () => void;
  onConfirm: () => void;
}

export function PaidModal({ project, onClose, onConfirm }: PaidModalProps) {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center text-3xl mx-auto">✅</div>
        <h3 className="font-bold text-gray-800 text-lg">Tandai Lunas?</h3>
        <p className="text-sm text-gray-500">
          Project <strong className="text-gray-700">{project.project_name}</strong> akan ditandai sebagai{' '}
          <strong className="text-emerald-600">LUNAS</strong> dengan total incentive{' '}
          <strong className="text-rose-600">{fmtRp(project.biaya_cadangan)}</strong>.
        </p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">Batal</button>
          <button onClick={onConfirm} className={`flex-1 ${btnPrimary}`} style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
            ✅ Konfirmasi Lunas
          </button>
        </div>
      </div>
    </div>
  );
}
