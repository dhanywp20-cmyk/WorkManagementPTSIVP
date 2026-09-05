'use client';
import { ModalPortal } from '@/components/shared';
import { triggersProjectProgress } from '@/lib/project-progress-sync';
import type { Reminder, TeamUser, SupervisorCandidate } from './shared';
import { formatDate } from './shared';

/**
 * Modal Approve & Assign (Admin/Manager) dan Assign Tim (Supervisor) -
 * dipindah dari app/reminder-schedule/page.tsx apa adanya (JSX identik).
 * State & handler tetap di page.tsx, komponen di sini murni presentasional.
 */

// ── APPROVE & ASSIGN (Admin/Manager) ──

export function ApproveAssignModal({
  approveTarget, approveBatchSiblings, approveAssignTo, setApproveAssignTo,
  approveDate, setApproveDate, approveTime, setApproveTime,
  approveSupervisors, approveRouteSaving, handleApproveRoute,
  approveStart, setApproveStart, approveTarget2, setApproveTarget2,
  approveSaving, handleApproveAssign, teamUsers, onClose, onBatal,
}: {
  approveTarget: Reminder;
  approveBatchSiblings: Reminder[];
  approveAssignTo: string;
  setApproveAssignTo: (v: string) => void;
  approveDate: string;
  setApproveDate: (v: string) => void;
  approveTime: string;
  setApproveTime: (v: string) => void;
  approveSupervisors: SupervisorCandidate[];
  approveRouteSaving: boolean;
  handleApproveRoute: () => void;
  approveStart: string;
  setApproveStart: (v: string) => void;
  approveTarget2: string;
  setApproveTarget2: (v: string) => void;
  approveSaving: boolean;
  handleApproveAssign: () => void;
  teamUsers: TeamUser[];
  onClose: () => void;
  onBatal: () => void;
}) {
  return (
    <ModalPortal>
      <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1100] p-4"
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
          style={{ animation: 'scale-in 0.25s ease-out', border: '2px solid rgba(34,197,94,0.4)' }}>
          {/* Header */}
          <div className="px-6 py-5 flex items-center justify-between"
            style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)' }}>
            <div>
              <h3 className="text-lg font-bold text-white">✅ Approve & Assign Request</h3>
              <p className="text-green-200/80 text-xs mt-0.5 truncate max-w-[300px]">{approveTarget.project_name}</p>
            </div>
            <button aria-label="Tutup" onClick={onClose}
              className="bg-white/15 hover:bg-white/25 text-white p-2 rounded-lg transition-all">
              <svg aria-hidden="true" focusable="false" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-6 space-y-4">
            {/* Info request */}
            <div className="rounded-xl p-3 space-y-1"
              style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)' }}>
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Request dari Sales</p>
              <p className="text-sm font-bold text-slate-800">{approveTarget.sales_name}{approveTarget.sales_division ? ` · ${approveTarget.sales_division}` : ''}</p>
              <p className="text-xs text-slate-500">📍 {approveTarget.address || '-'} · 🏷️ {approveTarget.category}</p>
              <p className="text-xs text-slate-500">📅 Usulan: {formatDate(approveTarget.due_date)} {approveTarget.due_time}</p>
            </div>

            {approveBatchSiblings.length > 0 && (
              <div className="rounded-xl p-3 flex items-start gap-2"
                style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)' }}>
                <span className="text-base flex-shrink-0">🗓️</span>
                <p className="text-xs text-indigo-700 leading-relaxed">
                  Request ini bagian dari <strong>{approveBatchSiblings.length + 1} hari</strong> yang diminta sekaligus
                  ({[approveTarget.due_date, ...approveBatchSiblings.map(s => s.due_date)].sort().map(formatDate).join(', ')}).
                  Semua tanggal akan ikut disetujui &amp; di-assign ke handler yang sama.
                </p>
              </div>
            )}

            {/* Route ke Supervisor — jalur UTAMA, sesuai tipe produk */}
            {approveSupervisors.length > 0 && (
              <div className="rounded-xl p-4" style={{ background: 'rgba(245,158,11,0.08)', border: '1.5px solid rgba(245,158,11,0.3)' }}>
                <p className="text-xs font-bold text-amber-700 mb-1">🎯 Route ke Supervisor (Rekomendasi)</p>
                <p className="text-[11px] text-amber-600 mb-3">
                  Tipe produk <strong>{approveTarget.product_type || '-'}</strong> → Tim{' '}
                  <strong>{Array.from(new Set(approveSupervisors.map(s => s.team_type))).join(' & ')}</strong>.
                  Supervisor <strong>{approveSupervisors.map(s => s.full_name).join(', ')}</strong> akan di-WA untuk assign ke anggota tim atau kerjakan sendiri.
                </p>
                <button onClick={handleApproveRoute} disabled={approveRouteSaving}
                  className="w-full py-2.5 rounded-xl font-bold text-sm text-white transition-all flex items-center justify-center gap-2 hover:scale-[1.02] disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                  {approveRouteSaving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  🎯 Approve & Route ke Supervisor
                </button>
              </div>
            )}

            {/* Assign to Team — manual/fallback (dipakai jika tipe produk belum ter-mapping,
                atau admin ingin assign langsung tanpa lewat Supervisor) */}
            <div>
              <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: '#94a3b8' }}>
                {approveSupervisors.length > 0 ? 'Atau Assign Langsung Manual' : 'Assign ke Team PTS *'}
              </label>
              <select aria-label="-- Pilih Anggota Team PTS --"
                value={approveAssignTo}
                onChange={e => setApproveAssignTo(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all text-slate-800 focus:ring-2 focus:ring-green-500/40"
                style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.12)' }}>
                <option value="">-- Pilih Anggota Team PTS --</option>
                <option value="SELF_MANAGER">🙋 Saya (Manager) kerjakan sendiri — Supervisor &amp; tim penuh</option>
                {teamUsers.filter(u => u.jabatan !== 'Manager').map(u => <option key={u.id} value={u.username}>{u.full_name}</option>)}
              </select>
            </div>

            {/* Konfirmasi / ubah tanggal */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: '#94a3b8' }}>
                  Tanggal (opsional ubah)
                </label>
                <input type="date"
                  value={approveDate || approveTarget.due_date}
                  onChange={e => setApproveDate(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-500/40 text-slate-800"
                  style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.12)' }} />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: '#94a3b8' }}>
                  Waktu (opsional ubah)
                </label>
                <input type="time"
                  value={approveTime || approveTarget.due_time}
                  onChange={e => setApproveTime(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-500/40 text-slate-800"
                  style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.12)' }} />
              </div>
            </div>

            {/* Timeline Project Progress — hanya kategori pemicu.
                Terisi dari usulan Sales; admin boleh membetulkan sebelum
                draft lokasi dibuat. */}
            {triggersProjectProgress(approveTarget.category) && (
              <div className="rounded-xl p-3" style={{ background: 'rgba(8,145,178,0.07)', border: '1px solid rgba(8,145,178,0.25)' }}>
                <p className="text-xs font-bold mb-2" style={{ color: '#0e7490' }}>
                  📊 Timeline Project Progress
                </p>
                <p className="text-[11px] mb-2.5" style={{ color: '#0891b2' }}>
                  {approveStart || approveTarget2
                    ? 'Diusulkan Sales — ubah bila perlu.'
                    : 'Sales tidak mengusulkan timeline. Isi di sini, atau lengkapi menyusul di Project Progress.'}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold mb-1 tracking-widest uppercase" style={{ color: '#94a3b8' }}>
                      Mulai Pengerjaan
                    </label>
                    <input type="date" value={approveStart}
                      onChange={e => setApproveStart(e.target.value)}
                      className="w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500/40 text-slate-800"
                      style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.12)' }} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold mb-1 tracking-widest uppercase" style={{ color: '#94a3b8' }}>
                      Target Selesai
                    </label>
                    <input type="date" value={approveTarget2} min={approveStart || undefined}
                      onChange={e => setApproveTarget2(e.target.value)}
                      className="w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500/40 text-slate-800"
                      style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.12)' }} />
                  </div>
                </div>
              </div>
            )}

            {/* Info WA */}
            <div className="rounded-xl p-3 flex items-start gap-2"
              style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)' }}>
              <span className="text-base flex-shrink-0">💬</span>
              <p className="text-[11px] text-green-700 leading-relaxed">
                WA notifikasi akan otomatis dikirim ke <strong>Team PTS IVP</strong> yang di-assign dan ke <strong>Sales</strong> yang request bahwa jadwalnya sudah disetujui.
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-1">
              <button onClick={onBatal}
                className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all"
                style={{ background: '#f8fafc', color: '#64748b', border: '1px solid rgba(0,0,0,0.12)' }}>
                Batal
              </button>
              <button
                onClick={handleApproveAssign}
                disabled={approveSaving || !approveAssignTo}
                className="flex-[2] text-white py-3 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: '0 4px 14px rgba(22,163,74,0.35)' }}>
                {approveSaving
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Menyimpan...</>
                  : approveSupervisors.length > 0 ? <>✅ Assign Langsung (lewati Supervisor)</> : <>✅ Approve &amp; Assign</>
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

// ── ASSIGN TIM (Supervisor) ──

export function SupervisorAssignModal({
  supervisorAssignTarget, supervisorAssignBatchSiblings,
  supervisorAssignTo, setSupervisorAssignTo,
  teamUsers, currentUser, supervisorAssignSaving, handleSupervisorAssignConfirm, onClose,
}: {
  supervisorAssignTarget: Reminder;
  supervisorAssignBatchSiblings: Reminder[];
  supervisorAssignTo: string;
  setSupervisorAssignTo: (v: string) => void;
  teamUsers: TeamUser[];
  currentUser: TeamUser | null;
  supervisorAssignSaving: boolean;
  handleSupervisorAssignConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <ModalPortal>
      <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1100] p-4"
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
          style={{ animation: 'scale-in 0.25s ease-out', border: '2px solid rgba(245,158,11,0.4)' }}>
          <div className="px-6 py-5 flex items-center justify-between" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
            <div>
              <h3 className="text-lg font-bold text-white">🎯 Assign Tim</h3>
              <p className="text-amber-100/90 text-xs mt-0.5 truncate max-w-[300px]">{supervisorAssignTarget.project_name}</p>
            </div>
            <button aria-label="Tutup" onClick={onClose}
              className="bg-white/15 hover:bg-white/25 text-white p-2 rounded-lg transition-all">
              <svg aria-hidden="true" focusable="false" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="p-6 space-y-4">
            <div className="rounded-xl p-3 space-y-1" style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)' }}>
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Request dari Sales</p>
              <p className="text-sm font-bold text-slate-800">{supervisorAssignTarget.sales_name}{supervisorAssignTarget.sales_division ? ` · ${supervisorAssignTarget.sales_division}` : ''}</p>
              <p className="text-xs text-slate-500">📍 {supervisorAssignTarget.address || '-'} · 🏷️ {supervisorAssignTarget.category}</p>
              <p className="text-xs text-slate-500">📅 Jadwal: {formatDate(supervisorAssignTarget.due_date)} {supervisorAssignTarget.due_time}</p>
            </div>

            {supervisorAssignBatchSiblings.length > 0 && (
              <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)' }}>
                <span className="text-base flex-shrink-0">🗓️</span>
                <p className="text-xs text-indigo-700 leading-relaxed">
                  Bagian dari <strong>{supervisorAssignBatchSiblings.length + 1} hari</strong> yang diminta sekaligus — semua tanggal akan ikut di-assign ke orang yang sama.
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: '#94a3b8' }}>Assign ke *</label>
              <select aria-label="-- Pilih --" value={supervisorAssignTo} onChange={e => setSupervisorAssignTo(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all text-slate-800 focus:ring-2 focus:ring-amber-500/40"
                style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.12)' }}>
                <option value="">-- Pilih --</option>
                <option value="SELF">🙋 Saya kerjakan sendiri (tim penuh/sibuk)</option>
                <optgroup label="Anggota Tim">
                  {/* Manager dikecualikan — bukan anggota tim biasa yang di-assign tugas oleh Supervisor */}
                  {teamUsers.filter(u => u.team_type === currentUser?.team_type && u.username !== currentUser?.username && u.jabatan !== 'Manager').map(u => (
                    <option key={u.id} value={u.username}>{u.full_name}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)' }}>
              <span className="text-base flex-shrink-0">💬</span>
              <p className="text-[11px] text-green-700 leading-relaxed">
                WA notifikasi otomatis dikirim ke yang di-assign (kecuali kamu sendiri) dan ke Sales yang request.
              </p>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={onClose}
                className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all"
                style={{ background: '#f8fafc', color: '#64748b', border: '1px solid rgba(0,0,0,0.12)' }}>Batal</button>
              <button onClick={handleSupervisorAssignConfirm} disabled={supervisorAssignSaving || !supervisorAssignTo}
                className="flex-[2] text-white py-3 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', boxShadow: '0 4px 14px rgba(245,158,11,0.35)' }}>
                {supervisorAssignSaving
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Menyimpan...</>
                  : <>🎯 Assign</>
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
