'use client';
import { Modal, TombolModal, KotakInfo, LabelIsian, ModalSetujui, PilihPenugasan, TombolSetujui, kelasIsianPersetujuan as kelasIsian } from '@/components/shared';
import { triggersProjectProgress } from '@/lib/project-progress-sync';
import type { Reminder, TeamUser, SupervisorCandidate } from './shared';
import { formatDate } from './shared';

/**
 * Modal Setujui & Tugaskan (Admin/Manager) dan Tugaskan (Supervisor). State & handler tetap di page.tsx,
 * komponen di sini murni presentasional. Kerangka & tombol: pola persetujuan bersama
 * (components/shared/Persetujuan.tsx) - sama dengan Ticketing & Request Design Project.
 */

function RingkasanRequest({ r, labelJadwal }: { r: Reminder; labelJadwal: string }) {
  return (
    <KotakInfo judul="Request dari Sales">
      <p className="text-sm font-bold text-slate-800">{r.sales_name}{r.sales_division ? ` · ${r.sales_division}` : ''}</p>
      <p>{r.address || '-'} · {r.category}</p>
      <p>{labelJadwal}: {formatDate(r.due_date)} {r.due_time}</p>
    </KotakInfo>
  );
}

// ── SETUJUI & TUGASKAN (Admin/Manager) ──

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
  const adaSupervisor = approveSupervisors.length > 0;
  return (
    <Modal buka onTutup={onClose} judul="Setujui & Tugaskan Request" keterangan={approveTarget.project_name} lapisan="atas"
      footer={<>
        <TombolModal onClick={onBatal} disabled={approveSaving}>Batal</TombolModal>
        <TombolModal jenis="utama" onClick={handleApproveAssign} disabled={approveSaving || !approveAssignTo}>
          {approveSaving ? 'Menyimpan...' : adaSupervisor ? 'Tugaskan Langsung (lewati Supervisor)' : 'Setujui & Tugaskan'}
        </TombolModal>
      </>}>
      <div className="space-y-4">
        <RingkasanRequest r={approveTarget} labelJadwal="Usulan" />

        {approveBatchSiblings.length > 0 && (
          <KotakInfo>
            Request ini bagian dari <strong>{approveBatchSiblings.length + 1} hari</strong> yang diminta sekaligus
            ({[approveTarget.due_date, ...approveBatchSiblings.map(s => s.due_date)].sort().map(formatDate).join(', ')}).
            Semua tanggal ikut disetujui &amp; ditugaskan ke handler yang sama.
          </KotakInfo>
        )}

        {/* Lewat Supervisor - jalur UTAMA, sesuai tipe produk */}
        {adaSupervisor && (
          <KotakInfo nada="awas" judul="Rekomendasi: lewat Supervisor">
            <p className="mb-2">
              Tipe produk <strong>{approveTarget.product_type || '-'}</strong> → Tim{' '}
              <strong>{Array.from(new Set(approveSupervisors.map(s => s.team_type))).join(' & ')}</strong>.
              Supervisor <strong>{approveSupervisors.map(s => s.full_name).join(', ')}</strong> menerima WA untuk menugaskan anggota tim atau mengerjakan sendiri.
            </p>
            <TombolSetujui onClick={handleApproveRoute} disabled={approveRouteSaving} className="w-full">
              {approveRouteSaving ? 'Memproses...' : 'Setujui & Teruskan ke Supervisor'}
            </TombolSetujui>
          </KotakInfo>
        )}

        {/* Tugaskan langsung - manual/fallback (tipe produk belum ter-mapping, atau tanpa lewat Supervisor) */}
        <PilihPenugasan nilai={approveAssignTo} onUbah={setApproveAssignTo} wajib={!adaSupervisor}
          label={adaSupervisor ? 'Atau tugaskan langsung ke' : 'Tugaskan ke'} kosong="- Pilih anggota Team PTS -"
          pilihan={[
            { v: 'SELF_MANAGER', l: 'Saya (Manager) kerjakan sendiri - Supervisor & tim penuh' },
            //  Sudah disaring bolehDitugaskanOleh di page.tsx - Manager hanya untuk Admin.
            ...teamUsers.map(u => ({ v: u.username, l: u.full_name })),
          ]} />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <LabelIsian htmlFor="f-rs-setujui-tanggal">Tanggal (opsional ubah)</LabelIsian>
            <input id="f-rs-setujui-tanggal" type="date" value={approveDate || approveTarget.due_date} onChange={e => setApproveDate(e.target.value)} className={kelasIsian} />
          </div>
          <div>
            <LabelIsian htmlFor="f-rs-setujui-waktu">Waktu (opsional ubah)</LabelIsian>
            <input id="f-rs-setujui-waktu" type="time" value={approveTime || approveTarget.due_time} onChange={e => setApproveTime(e.target.value)} className={kelasIsian} />
          </div>
        </div>

        {/* Timeline Project Progress - hanya kategori pemicu. Terisi dari usulan Sales; admin boleh
            membetulkan sebelum draft lokasi dibuat. */}
        {triggersProjectProgress(approveTarget.category) && (
          <KotakInfo judul="Timeline Project Progress">
            <p className="mb-2">
              {approveStart || approveTarget2
                ? 'Diusulkan Sales - ubah bila perlu.'
                : 'Sales tidak mengusulkan timeline. Isi di sini, atau lengkapi menyusul di Project Progress.'}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <LabelIsian htmlFor="f-rs-setujui-mulai">Mulai pengerjaan</LabelIsian>
                <input id="f-rs-setujui-mulai" type="date" value={approveStart} onChange={e => setApproveStart(e.target.value)} className={kelasIsian} />
              </div>
              <div>
                <LabelIsian htmlFor="f-rs-setujui-target">Target selesai</LabelIsian>
                <input id="f-rs-setujui-target" type="date" value={approveTarget2} min={approveStart || undefined} onChange={e => setApproveTarget2(e.target.value)} className={kelasIsian} />
              </div>
            </div>
          </KotakInfo>
        )}

        <KotakInfo nada="baik">
          WA notifikasi otomatis dikirim ke <strong>Team PTS IVP</strong> yang ditugaskan dan ke <strong>Sales</strong> yang request bahwa jadwalnya sudah disetujui.
        </KotakInfo>
      </div>
    </Modal>
  );
}

// ── TUGASKAN TIM (Supervisor) ──

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
    <ModalSetujui buka onTutup={onClose} judul="Tugaskan Tim" keterangan={supervisorAssignTarget.project_name} lapisan="atas" labelAksi="Tugaskan"
      onSetujui={handleSupervisorAssignConfirm} sibuk={supervisorAssignSaving} bisaKirim={!!supervisorAssignTo}>
      <div className="space-y-4">
        <RingkasanRequest r={supervisorAssignTarget} labelJadwal="Jadwal" />
        {supervisorAssignBatchSiblings.length > 0 && (
          <KotakInfo>
            Bagian dari <strong>{supervisorAssignBatchSiblings.length + 1} hari</strong> yang diminta sekaligus - semua tanggal ikut ditugaskan ke orang yang sama.
          </KotakInfo>
        )}
        <PilihPenugasan nilai={supervisorAssignTo} onUbah={setSupervisorAssignTo} pilihan={[
          { v: 'SELF', l: 'Saya kerjakan sendiri (tim penuh/sibuk)', grup: 'Saya' },
          //  Manager dikecualikan - bukan anggota tim biasa yang ditugaskan oleh Supervisor.
          ...teamUsers.filter(u => u.team_type === currentUser?.team_type && u.username !== currentUser?.username && u.jabatan !== 'Manager')
            .map(u => ({ v: u.username, l: u.full_name, grup: 'Anggota Tim' })),
        ]} />
        <KotakInfo nada="baik">WA notifikasi otomatis dikirim ke yang ditugaskan (kecuali kamu sendiri) dan ke Sales yang request.</KotakInfo>
      </div>
    </ModalSetujui>
  );
}
