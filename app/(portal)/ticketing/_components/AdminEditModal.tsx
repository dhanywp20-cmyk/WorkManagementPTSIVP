'use client';
import { Modal, TombolModal, AdminEditFields } from '@/components/shared';
import type { Ticket, TeamMember } from './shared';
import { bolehReroute, TICKET_ADMIN_FIELDS } from './shared';
import { IkonTeks } from '@/components/shared/Ikon';

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
    <Modal buka onTutup={() => { if (!adminEditSaving) onClose(); }} judul="Edit Detail & Alihkan" keterangan={adminEditTicket.project_name} ukuran="xl" lapisan="atas" tutupDiLuar={false}
      footer={<>
        <TombolModal onClick={onClose} disabled={adminEditSaving}>Batal</TombolModal>
        <TombolModal jenis="utama" onClick={simpanAdminEdit} disabled={adminEditSaving}>{adminEditSaving ? 'Menyimpan...' : 'Simpan Perubahan'}</TombolModal>
      </>}>
          <div className="space-y-5">
            {/* ── Re-route ── */}
            <div className="rounded-xl p-4" style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)' }}>
              <p className="text-[11px] font-bold text-amber-700 uppercase tracking-widest mb-2"><IkonTeks nama="🔀" />Alihkan Pekerjaan</p>
              {bolehReroute(adminEditTicket) ? (
                <>
                  <select aria-label="— Biarkan seperti sekarang —" value={adminRerouteTo} onChange={e => setAdminRerouteTo(e.target.value)}
                    className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm bg-white outline-hidden focus:ring-2 focus:ring-amber-200">
                    <option value="">— Biarkan seperti sekarang —</option>
                    <option value="SELF">Saya kerjakan sendiri</option>
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
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2"><IkonTeks nama="✏" />Detail Ticket</p>
              <AdminEditFields fields={TICKET_ADMIN_FIELDS} value={adminEditForm} disabled={adminEditSaving}
                onChange={(k, v) => setAdminEditForm(prev => ({ ...prev, [k]: v }))} />
            </div>

            <p className="text-[11px] text-slate-500">
              Setiap perubahan tercatat di Audit Trail lengkap dengan nilai sebelum dan sesudahnya,
              dan diberitahukan ke yang menangani lewat WA.
            </p>
          </div>
    </Modal>
  );
}
