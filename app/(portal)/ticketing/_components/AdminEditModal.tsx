'use client';
import { Modal, TombolModal } from '@/components/shared';
import { Ikon } from '@/components/shared/Ikon';
import { BRAND_OPTIONS, type Brand } from '@/lib/brand-routing';
import { namaSemuaKelompokTim } from '@/lib/kelompok/inti';
import type { Ticket, TeamMember, User } from './shared';
import { bolehReroute } from './shared';
import type { NewTicketForm } from './NewTicketModal';
import { KolomInfoTiket } from './tiket-baru/KolomInfoTiket';
import { KolomBarangKeluhan } from './tiket-baru/KolomBarangKeluhan';
import { KolomPenugasanTiket } from './tiket-baru/KolomPenugasanTiket';

const GAYA_PILIH = { background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" };
const LABEL = "block text-[11px] font-bold mb-1.5 tracking-widest uppercase";

const teks = (v: unknown) => (v === null || v === undefined ? '' : String(v));

/**
 * Edit Detail & Alihkan — memakai tata letak yang sama dengan "Buat Ticket Baru",
 * semua kolom terisi dari data ticket. "Tugaskan ke" kosong = handler tetap.
 */
export function AdminEditModal({
  adminEditTicket, adminRerouteTo, setAdminRerouteTo, adminEditSaving,
  supervisorMembers, teamPTSMembers, adminEditForm, setAdminEditForm,
  simpanAdminEdit, onClose, users, currentUser,
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
  users: User[];
  currentUser: User | null;
}) {
  const f = adminEditForm;
  const form: NewTicketForm = {
    project_name: teks(f.project_name), address: teks(f.address), customer_phone: teks(f.customer_phone),
    sales_name: teks(f.sales_name), sales_division: teks(f.sales_division), sales_user_id: (f.sales_user_id as string | null) ?? null,
    sn_unit: teks(f.sn_unit), product: teks(f.product), issue_case: teks(f.issue_case), description: teks(f.description),
    assign_name: adminRerouteTo, date: teks(f.date).slice(0, 10), status: teks(f.status), current_team: teks(f.current_team),
    photo: (f.photo as File | null) ?? null, reminder_id: null, brand: (teks(f.brand) || undefined) as Brand | undefined,
  };
  const set = (patch: Partial<NewTicketForm>) => {
    const { assign_name, ...sisa } = patch;
    if (assign_name !== undefined) setAdminRerouteTo(assign_name);
    if (Object.keys(sisa).length) setAdminEditForm(prev => ({ ...prev, ...sisa }));
  };
  const ubah = (k: string, v: string) => setAdminEditForm(prev => ({ ...prev, [k]: v }));
  const tanpaAksi = () => {};

  const handlerSekarang = adminEditTicket.assign_name
    || (adminEditTicket.routing_status === 'supervisor_assign' ? 'menunggu assign Supervisor' : '');

  const pengaturanAdmin = (
    <div>
      <div className="flex items-center gap-2 pb-2 border-b pt-2 mb-3" style={{ borderColor: "rgba(0,0,0,0.1)" }}>
        <span className="text-lg"><Ikon nama="⚙" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
        <span className="text-sm font-bold tracking-wide text-slate-700">Status &amp; Prioritas</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {([
          ['status', 'Status', ['Waiting Approval', 'Pending', 'Call', 'Onsite', 'In Progress', 'Pending Action', 'Solved', 'Rejected']],
          ['priority', 'Prioritas', ['Low', 'Medium', 'High', 'Critical']],
          ['current_team', 'Team Penanganan', namaSemuaKelompokTim()],
        ] as [string, string, string[]][]).map(([k, label, opsi]) => {
          const nilai = teks(f[k]);
          const pilihan = nilai && !opsi.includes(nilai) ? [nilai, ...opsi] : opsi;
          return (
            <div key={k}>
              <label className={LABEL} style={{ color: "#94a3b8" }}>{label}</label>
              <select aria-label={label} value={nilai} onChange={e => ubah(k, e.target.value)} disabled={adminEditSaving}
                className="w-full rounded-xl px-3 py-2.5 text-sm text-slate-800 outline-hidden focus:ring-2 focus:ring-red-500/40" style={GAYA_PILIH}>
                <option value="">— pilih —</option>
                {pilihan.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          );
        })}
        <div>
          <label className={LABEL} style={{ color: "#94a3b8" }}>Brand</label>
          <select aria-label="Brand" value={teks(f.brand)} onChange={e => ubah('brand', e.target.value)} disabled={adminEditSaving}
            className="w-full rounded-xl px-3 py-2.5 text-sm text-slate-800 outline-hidden focus:ring-2 focus:ring-red-500/40" style={GAYA_PILIH}>
            <option value="">— pilih —</option>
            {BRAND_OPTIONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </div>
      </div>
    </div>
  );

  return (
    <Modal buka onTutup={() => { if (!adminEditSaving) onClose(); }} judul="Edit Detail & Alihkan"
      keterangan={`${adminEditTicket.project_name} · perubahan tercatat di Audit Trail & dikabari ke yang menangani lewat WA`}
      ukuran="penuh" lapisan="atas" tutupDiLuar={false}
      footer={<>
        <TombolModal onClick={onClose} disabled={adminEditSaving}>Batal</TombolModal>
        <TombolModal jenis="utama" onClick={simpanAdminEdit} disabled={adminEditSaving}>{adminEditSaving ? 'Menyimpan...' : 'Simpan Perubahan'}</TombolModal>
      </>}>
      <fieldset disabled={adminEditSaving} className="grid grid-cols-1 satulayar:grid-cols-3 gap-5 min-w-0">
        <KolomInfoTiket
          form={form} set={set} modeEdit projectType="new" isExternalGuest={false}
          galatCari={null} handleQueryChange={tanpaAksi} pencarianDibatasi={false} reminderQuery="" reminderResults={[]}
          reminderSearching={false} selectReminder={tanpaAksi} selectedReminder={null} setSelectedReminder={tanpaAksi} switchProjectType={tanpaAksi}
        />
        <KolomBarangKeluhan form={form} set={set} modeEdit />
        <KolomPenugasanTiket
          canAssignDirect currentUser={currentUser} externalSalesUsers={[]} form={form} isInternalSalesGuest={false}
          set={set} supervisorMembers={supervisorMembers} teamPTSMembers={teamPTSMembers} users={users}
          edit={{
            bolehReroute: bolehReroute(adminEditTicket), handlerSekarang, statusTicket: adminEditTicket.status,
            fotoSekarang: adminEditTicket.photo_url ?? null, tambahan: pengaturanAdmin,
          }}
        />
      </fieldset>
    </Modal>
  );
}
