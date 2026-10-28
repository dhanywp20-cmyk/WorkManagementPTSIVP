'use client';
import { Modal, TombolModal, ModalTolak, PilihPenugasan } from '@/components/shared';
import type { Ticket, TeamMember } from './shared';

/**
 * Modal-modal kecil & mandiri dari app/ticketing/page.tsx - masing-masing
 * cuma butuh satu ticket target + beberapa field lokal + satu handler
 * konfirmasi. Semua state & handler TETAP di page.tsx - komponen di sini
 * murni presentasional, dioper lewat props.
 *
 * Kerangka: Modal bersama (components/shared/Modal.tsx) & pola persetujuan bersama
 * (components/shared/Persetujuan.tsx) - dulu tiap popup di sini punya kepala bergradasi
 * & warna sendiri (oranye, kuning, merah muda, merah), berbeda dengan menu lain.
 */

const kelasIsian = 'w-full rounded-kontrol border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-300';
const kotakInfo = 'rounded-kontrol border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800';
const subjudul = (t: Ticket) => `${t.project_name} · ${t.issue_case}`;

// ── OVERDUE SETTING ──

export function OverdueSettingModal({
  overdueTargetTicket, overdueForm, setOverdueForm, saveOverdueSetting,
  onClose, punyaSettingTersimpan, onHapusSetting,
}: {
  overdueTargetTicket: Ticket;
  overdueForm: { due_hours: string };
  setOverdueForm: (v: { due_hours: string }) => void;
  saveOverdueSetting: () => void;
  onClose: () => void;
  punyaSettingTersimpan: boolean;
  onHapusSetting: () => void;
}) {
  return (
    <Modal buka onTutup={onClose} judul="Overdue Setting" keterangan={subjudul(overdueTargetTicket)} tutupDiLuar={false}
      footer={<>
        {punyaSettingTersimpan && <TombolModal jenis="bahaya" onClick={onHapusSetting} className="mr-auto">Hapus Setting</TombolModal>}
        <TombolModal onClick={onClose}>Batal</TombolModal>
        <TombolModal jenis="utama" onClick={saveOverdueSetting}>Simpan</TombolModal>
      </>}>
      <div className="space-y-4">
        <p className={kotakInfo}>Setting ini hanya terlihat oleh admin. Handler mendapat notifikasi merah ketika ticket overdue. Default: overdue setelah 48 jam bila tidak di-set manual.</p>
        <div>
          <label htmlFor="f-ticketing-overdue-jam" className="block text-xs font-bold text-slate-700 mb-1.5">Overdue setelah berapa jam?</label>
          <div className="flex items-center gap-3">
            <input id="f-ticketing-overdue-jam" type="number" min="1" value={overdueForm.due_hours} onChange={(e) => setOverdueForm({ due_hours: e.target.value })}
              className={`${kelasIsian} text-center font-bold`} />
            <span className="text-slate-600 font-semibold text-sm">jam</span>
          </div>
          <div className="flex gap-2 mt-2">
            {[24, 48, 72, 96].map((h) => (
              <button key={h} type="button" onClick={() => setOverdueForm({ due_hours: String(h) })}
                className={`flex-1 py-1 rounded-kontrol text-xs font-bold border transition-all ${overdueForm.due_hours === String(h) ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}>
                {h}j{h === 48 ? ' (default)' : ''}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2">Dihitung dari waktu ticket pertama kali dibuat.</p>
        </div>
      </div>
    </Modal>
  );
}

// ── RE-OPEN TICKET (PTS) ──
// Lapisan atas - bisa dibuka dari daftar MAUPUN dari dalam popup detail.

export function ReopenPTSModal({
  reopenTargetTicket, reopenAssignee, setReopenAssignee, reopenNotes, setReopenNotes,
  teamPTSMembers, reopenTicket, uploading, onClose,
}: {
  reopenTargetTicket: Ticket;
  reopenAssignee: string;
  setReopenAssignee: (v: string) => void;
  reopenNotes: string;
  setReopenNotes: (v: string) => void;
  teamPTSMembers: TeamMember[];
  reopenTicket: () => void;
  uploading: boolean;
  onClose: () => void;
}) {
  return (
    <Modal buka onTutup={onClose} judul="Re-open Ticket" keterangan={subjudul(reopenTargetTicket)} lapisan="atas" tutupDiLuar={false}
      footer={<>
        <TombolModal onClick={onClose} disabled={uploading}>Batal</TombolModal>
        <TombolModal jenis="utama" onClick={reopenTicket} disabled={uploading || !reopenAssignee}>{uploading ? 'Memproses...' : 'Re-open'}</TombolModal>
      </>}>
      <div className="space-y-4">
        <p className={kotakInfo}>Status akan berubah ke <strong>Pending</strong> dan activity log baru ditambahkan otomatis.</p>
        <PilihPenugasan nilai={reopenAssignee} onUbah={setReopenAssignee} kosong="- Pilih handler -"
          pilihan={teamPTSMembers.map(m => ({ v: m.name, l: m.name }))} />
        <div>
          <label htmlFor="f-ticketing-reopen-alasan" className="block text-xs font-bold text-slate-700 mb-1.5">Alasan (opsional)</label>
          <textarea id="f-ticketing-reopen-alasan" value={reopenNotes} onChange={(e) => setReopenNotes(e.target.value)} placeholder="Masalah muncul kembali..." rows={3}
            className={`${kelasIsian} resize-none`} />
        </div>
      </div>
    </Modal>
  );
}

// ── RE-OPEN SERVICES ──
// Lebih sederhana dari modal PTS di atas (sisi Services tidak punya konsep petugas).

export function ReopenServicesModal({
  reopenServicesTarget, reopeningServices, reopenServicesTicket, onClose,
}: {
  reopenServicesTarget: Ticket;
  reopeningServices: boolean;
  reopenServicesTicket: () => void;
  onClose: () => void;
}) {
  return (
    <Modal buka onTutup={() => { if (!reopeningServices) onClose(); }} judul="Re-open Services" keterangan={subjudul(reopenServicesTarget)} ukuran="sm" lapisan="atas"
      footer={<>
        <TombolModal onClick={onClose} disabled={reopeningServices}>Batal</TombolModal>
        <TombolModal jenis="utama" onClick={reopenServicesTicket} disabled={reopeningServices}>{reopeningServices ? 'Memproses...' : 'Re-open'}</TombolModal>
      </>}>
      <p className={kotakInfo}>Status Services akan kembali ke <strong>Pending</strong>. Status utama PTS tidak ikut berubah.</p>
    </Modal>
  );
}

// ── TOLAK TICKET — tidak dihapus, status Rejected + alasan ──

export function RejectModal({
  rejectTargetTicket, rejectReason, setRejectReason, uploading, confirmReject, onClose,
}: {
  rejectTargetTicket: Ticket;
  rejectReason: string;
  setRejectReason: (v: string) => void;
  uploading: boolean;
  confirmReject: () => void;
  onClose: () => void;
}) {
  return (
    <ModalTolak buka onTutup={onClose} judul="Tolak Ticket" keterangan={subjudul(rejectTargetTicket)} lapisan="atas"
      alasan={rejectReason} onAlasan={setRejectReason} onTolak={() => confirmReject()} sibuk={uploading}
      placeholder="Contoh: data tidak lengkap, isi nomor SN unit dan deskripsi masalah lebih detail...">
      <p className={kotakInfo}>Ticket <strong>tidak dihapus</strong> - tetap tersimpan dengan status &quot;Rejected&quot;. Sales dapat melihat alasan penolakan dan mengajukan ulang.</p>
    </ModalTolak>
  );
}

// ── DELETE TICKET (Admin Only) ──

export function DeleteModal({
  deleteTargetTicket, deleteConfirmText, setDeleteConfirmText, uploading, deleteTicket, onClose,
}: {
  deleteTargetTicket: Ticket;
  deleteConfirmText: string;
  setDeleteConfirmText: (v: string) => void;
  uploading: boolean;
  deleteTicket: () => void;
  onClose: () => void;
}) {
  return (
    <Modal buka onTutup={onClose} judul="Hapus Ticket" keterangan={subjudul(deleteTargetTicket)} tutupDiLuar={false}
      footer={<>
        <TombolModal onClick={onClose} disabled={uploading}>Batal</TombolModal>
        <TombolModal jenis="bahaya" onClick={deleteTicket} disabled={deleteConfirmText !== 'HAPUS' || uploading}>{uploading ? 'Menghapus...' : 'Hapus Permanen'}</TombolModal>
      </>}>
      <div className="space-y-4">
        <p className="rounded-kontrol border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-relaxed text-rose-800">
          <strong>Tindakan ini tidak dapat dibatalkan.</strong> Ticket beserta seluruh activity log dan overdue setting dihapus permanen.
        </p>
        <div>
          <label htmlFor="f-ticketing-hapus-konfirmasi" className="block text-xs font-bold text-slate-700 mb-1.5">
            Ketik <span className="font-mono bg-rose-100 text-rose-700 px-1 rounded-sm">HAPUS</span> untuk konfirmasi
          </label>
          <input id="f-ticketing-hapus-konfirmasi" type="text" value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="Ketik HAPUS di sini..." className={kelasIsian} />
        </div>
      </div>
    </Modal>
  );
}
