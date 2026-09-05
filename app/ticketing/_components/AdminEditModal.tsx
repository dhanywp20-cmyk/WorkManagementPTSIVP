'use client';
import { ModalPortal, AdminEditFields } from '@/components/shared';
import type { Ticket, TeamMember } from './shared';
import { bolehReroute, TICKET_ADMIN_FIELDS } from './shared';

/**
 * Modal "Edit Detail & Re-route" (admin) - dipindah dari
 * app/ticketing/page.tsx apa adanya (JSX identik). State & handler tetap
 * di page.tsx, komponen ini murni presentasional.
 *
 * Z.overlayTop — dibuka DARI DALAM popup detail (Z.overlay).
 */
export function AdminEditModal({
  adminEditTicket, adminRerouteTo, setAdminRerouteTo, adminEditSaving,
  supervisorMembers, teamPTSMembers, adminEditForm, setAdminEditForm,
  simpanAdminEdit, onClose,
}: {
  adminEditTicket: Ticket;
  adminRerouteTo: string;
  setAdminRerouteTo: (v: string) => void;
  adminEditSaving: boolean;
  supervisorMembers: TeamMember[];
  teamPTSMembers: TeamMember[];
  adminEditForm: Record<string, unknown>;
  setAdminEditForm: (fn: (prev: Record<string, unknown>) => Record<string, unknown>) => void;
  simpanAdminEdit: () => void;
  onClose: () => void;
}) {
  return (
    <ModalPortal>
      <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1100] p-4"
        onClick={e => { if (e.target === e.currentTarget && !adminEditSaving) onClose(); }}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-full flex flex-col overflow-hidden"
          style={{ animation: 'scale-in 0.25s ease-out' }}>
          <div className="px-6 py-4 flex items-center justify-between flex-shrink-0" style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-white">🛠️ Edit Detail &amp; Re-route</h3>
              <p className="text-indigo-100/90 text-xs mt-0.5 truncate">{adminEditTicket.project_name}</p>
            </div>
            <button aria-label="Tutup" onClick={onClose} disabled={adminEditSaving}
              className="bg-white/15 hover:bg-white/25 text-white p-2 rounded-lg disabled:opacity-40">✕</button>
          </div>

          <div className="p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
            {/* ── Re-route ── */}
            <div className="rounded-xl p-4" style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)' }}>
              <p className="text-[11px] font-bold text-amber-700 uppercase tracking-widest mb-2">🔀 Alihkan Pekerjaan</p>
              {bolehReroute(adminEditTicket) ? (
                <>
                  <select aria-label="— Biarkan seperti sekarang —" value={adminRerouteTo} onChange={e => setAdminRerouteTo(e.target.value)}
                    className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-amber-200">
                    <option value="">— Biarkan seperti sekarang —</option>
                    <option value="SELF">🙋 Saya kerjakan sendiri</option>
                    {supervisorMembers.length > 0 && (
                      <optgroup label="🎯 Route ke Supervisor">
                        {supervisorMembers.map(m => <option key={`ar-sup-${m.id}`} value={`SUP::${m.id}::${m.name}`}>{m.name} (Supervisor)</option>)}
                      </optgroup>
                    )}
                    {teamPTSMembers.length > 0 && (
                      <optgroup label="👥 Assign langsung ke Tim">
                        {teamPTSMembers.map(m => <option key={`ar-tm-${m.id}`} value={m.name}>{m.name}</option>)}
                      </optgroup>
                    )}
                  </select>
                  <p className="text-[11px] text-amber-700 mt-1.5">
                    Sekarang ditangani: <strong>{adminEditTicket.assign_name || (adminEditTicket.routing_status === 'supervisor_assign' ? 'menunggu assign Supervisor' : '—')}</strong>.
                    Yang dipilih akan langsung dikabari lewat WA.
                  </p>
                </>
              ) : (
                <p className="text-xs text-amber-800">
                  Pengalihan tidak tersedia — status ticket sudah <strong>{adminEditTicket.status}</strong>,
                  artinya pengerjaannya sudah berjalan. Detail di bawah tetap bisa dibetulkan.
                </p>
              )}
            </div>

            {/* ── Edit detail ── */}
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">✏️ Detail Ticket</p>
              <AdminEditFields fields={TICKET_ADMIN_FIELDS} value={adminEditForm} disabled={adminEditSaving}
                onChange={(k, v) => setAdminEditForm(prev => ({ ...prev, [k]: v }))} />
            </div>

            <p className="text-[11px] text-slate-400">
              Setiap perubahan tercatat di Audit Trail lengkap dengan nilai sebelum dan sesudahnya,
              dan diberitahukan ke yang menangani lewat WA.
            </p>
          </div>

          <div className="px-6 py-4 flex gap-3 flex-shrink-0 border-t border-slate-100">
            <button onClick={onClose} disabled={adminEditSaving}
              className="flex-1 py-3 rounded-xl font-semibold text-sm border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40">
              Batal
            </button>
            <button onClick={simpanAdminEdit} disabled={adminEditSaving}
              className="flex-[2] text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
              {adminEditSaving
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Menyimpan...</>
                : <>💾 Simpan Perubahan</>}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
