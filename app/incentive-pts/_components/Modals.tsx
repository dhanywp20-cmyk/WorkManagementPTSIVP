'use client';
// ─── Incentive PTS — Modals (View / Biaya / Backup / Paid) ───────────────────

import { IncentiveProject, IncentiveDisbursement, IncentiveSetting, User } from './types';
import { Badge, fmtRp, fmtPct, fmtDate, fmtPeriode, inputCls, btnPrimary } from './shared';

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
}: ViewModalProps) {
  void onMarkPaid;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div
          className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-3 flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.06),rgba(139,92,246,0.04))' }}
        >
          <div>
            <Badge color="purple" square>{project.category}</Badge>
            <h3 className="font-bold text-gray-800 text-base leading-snug mt-1.5">{project.project_name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {fmtDate(project.due_date)} · {fmtPeriode(project.periode)}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none flex-shrink-0 mt-0.5">✕</button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {/* Assign + Jadwal */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Assign To</p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
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
              <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">📋 Informasi Project</p>
            </div>
            <div className="divide-y divide-gray-100">
              {project.product && (
                <InfoRow icon="📦" label="Product / Unit" value={project.product} />
              )}
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
                    <p className="font-mono font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 inline-block text-sm mt-0.5">
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
              <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">💰 Biaya & Distribusi Incentive</p>
            </div>
            {project.biaya_cadangan > 0 ? (
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between bg-indigo-50 rounded-lg px-3 py-2.5 border border-indigo-100">
                  <p className="text-sm text-indigo-700 font-semibold">Biaya Cadangan</p>
                  <p className="text-base font-bold text-indigo-600">{fmtRp(project.biaya_cadangan)}</p>
                </div>
                {disbursements.map((d) => (
                  <div key={d.id} className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm border ${d.role_type === 'handler' ? 'bg-indigo-50 border-indigo-200' : 'bg-blue-50 border-blue-200'}`}>
                    <div className="flex items-center gap-2">
                      <span>{d.role_type === 'handler' ? '⭐' : '🤝'}</span>
                      <span className="font-semibold text-gray-700">{d.person_name}</span>
                      <Badge color={d.role_type === 'handler' ? 'indigo' : 'blue'}>{d.role_type}</Badge>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-500 text-xs mr-2">{fmtPct(d.pct)}</span>
                      <span className="font-bold text-gray-800">{fmtRp(d.amount_rp)}</span>
                    </div>
                  </div>
                ))}
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
            <button onClick={onInputBiaya} className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold text-white hover:opacity-90`} style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
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
  biayaInput: string;
  cosInput: string;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onBiayaChange: (v: string) => void;
  onCosChange: (v: string) => void;
}

export function BiayaModal({
  project, settings, biayaInput, cosInput, saving,
  onClose, onSave, onBiayaChange, onCosChange,
}: BiayaModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h3 className="font-bold text-gray-800 text-lg">
          {project.biaya_cadangan > 0 ? '✏️ Edit Biaya Cadangan' : '💵 Input Biaya Cadangan'}
        </h3>
        <div className="bg-indigo-50 rounded-xl p-3 text-sm">
          <p className="font-semibold text-indigo-700">{project.project_name}</p>
          <p className="text-indigo-500 text-xs">{project.category} · Handler: {project.handler_name}</p>
        </div>
        {settings && (
          <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 space-y-1">
            <p>⭐ Handler ({project.handler_name}): <strong className="text-gray-700">{fmtPct(settings.handler_pct)}</strong></p>
            {project.backup_names.length > 0 ? (
              <p>🤝 Backup ({project.backup_names.length} orang): <strong className="text-gray-700">{project.backup_names.join(', ')}</strong></p>
            ) : (
              <p className="text-amber-600">⚠️ Belum ada backup — 100% ke handler</p>
            )}
          </div>
        )}
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
            <div className="mt-2 p-3 bg-indigo-50 rounded-xl space-y-1 text-xs">
              <p className="font-semibold text-indigo-700">Preview distribusi:</p>
              <p>⭐ {project.handler_name}: <strong>{fmtRp(parseFloat(biayaInput) * settings.handler_pct / 100)}</strong> ({fmtPct(settings.handler_pct)})</p>
              {project.backup_names.map((b) => (
                <p key={b}>🤝 {b}: <strong>{fmtRp(parseFloat(biayaInput) * settings.backup_pct / 100 / project.backup_names.length)}</strong> ({fmtPct(settings.backup_pct / project.backup_names.length)})</p>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">Batal</button>
          <button onClick={onSave} disabled={saving} className={`flex-1 ${btnPrimary}`} style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
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
  settings: IncentiveSetting | null;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onToggle: (name: string, checked: boolean) => void;
}

export function BackupModal({
  project, teamUsers, backupSelected, settings, saving,
  onClose, onSave, onToggle,
}: BackupModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h3 className="font-bold text-gray-800 text-lg">🤝 Set Tim Backup</h3>
        <div className="bg-blue-50 rounded-xl p-3 text-sm">
          <p className="font-semibold text-blue-700">{project.project_name}</p>
          <p className="text-blue-500 text-xs">Handler: {project.handler_name}</p>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {teamUsers
            .filter((u) => u.full_name !== project.handler_name)
            .map((u) => (
              <label
                key={u.username}
                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-colors ${
                  backupSelected.includes(u.full_name)
                    ? 'bg-blue-50 border-blue-300'
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <input
                  type="checkbox"
                  checked={backupSelected.includes(u.full_name)}
                  onChange={(e) => onToggle(u.full_name, e.target.checked)}
                  className="w-4 h-4 rounded accent-blue-600"
                />
                <div>
                  <p className="text-sm font-semibold text-gray-700">{u.full_name}</p>
                  <p className="text-xs text-gray-400">{u.jabatan ?? u.team_type ?? u.role}</p>
                </div>
              </label>
            ))}
        </div>
        {backupSelected.length > 0 && settings && (
          <p className="text-xs text-blue-600 bg-blue-50 rounded-xl px-3 py-2">
            🤝 {backupSelected.length} orang backup · masing-masing{' '}
            {fmtPct(settings.backup_pct / backupSelected.length)} dari biaya cadangan
          </p>
        )}
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">Batal</button>
          <button onClick={onSave} disabled={saving} className={`flex-1 ${btnPrimary}`} style={{ background: 'linear-gradient(135deg,#0ea5e9,#0284c7)' }}>
            {saving ? 'Menyimpan...' : '💾 Simpan Backup'}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center text-3xl mx-auto">✅</div>
        <h3 className="font-bold text-gray-800 text-lg">Tandai Lunas?</h3>
        <p className="text-sm text-gray-500">
          Project <strong className="text-gray-700">{project.project_name}</strong> akan ditandai sebagai{' '}
          <strong className="text-emerald-600">LUNAS</strong> dengan total incentive{' '}
          <strong className="text-indigo-600">{fmtRp(project.biaya_cadangan)}</strong>.
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
