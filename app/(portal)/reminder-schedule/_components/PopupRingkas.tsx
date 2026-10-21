'use client';
/**
 * app/reminder-schedule/_components/PopupRingkas.tsx
 *
 * Empat popup yang dipindahkan keluar dari page.tsx - keempatnya hanya menyentuh 4-7 nilai dari halaman
 * induknya. Syarat tampilnya ikut di dalam masing-masing komponen, sehingga page.tsx cukup memanggilnya.
 *
 * Kerangka: Modal bersama + pola persetujuan bersama (components/shared/Persetujuan.tsx) - dulu tiap popup
 * berkepala gradasi kuning / merah sendiri, berbeda dengan menu lain.
 */
import { KotakInfo, Modal, ModalSetujui, TombolModal, kelasIsianPersetujuan as kelasIsian } from '@/components/shared';
import { bisaDiklik } from '@/components/shared/bisaDiklik';
import { PriorityBadge, StatusBadge, CategoryBadge } from './Badges';
import { Reminder, formatDate } from './shared';
import { triggersProjectProgress } from '@/lib/project-progress-sync';

function Baris({ label, children, tebal }: { label: string; children: React.ReactNode; tebal?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-500 text-xs">{label}</span>
      <span className={`text-right ${tebal ? 'font-bold text-slate-800' : 'font-semibold text-slate-700'}`}>{children}</span>
    </div>
  );
}

export function KonfirmasiApproveInternal({
  internalApproveTarget, internalApproveSaving, setInternalApproveTarget, handleInternalApprove,
}: {
  internalApproveTarget: Reminder | null;
  internalApproveSaving: boolean;
  setInternalApproveTarget: (r: Reminder | null) => void;
  handleInternalApprove: (r: Reminder) => void;
}) {
  if (!(internalApproveTarget)) return null;
  const t = internalApproveTarget as Reminder & { progress_start_date?: string | null; progress_target_date?: string | null };
  return (
    <ModalSetujui buka onTutup={() => setInternalApproveTarget(null)} judul="Setujui Request?" keterangan="Diteruskan ke Admin/Manager untuk ditugaskan"
      lapisan="atas" labelAksi="Setujui & Teruskan" sibuk={internalApproveSaving} onSetujui={() => handleInternalApprove(internalApproveTarget)}>
      <div className="rounded-kontrol border border-slate-200 bg-slate-50 p-3 space-y-1.5 text-sm">
        <Baris label="Project" tebal>{t.project_name}</Baris>
        <Baris label="Sales">{t.sales_name}{t.sales_division ? ` · ${t.sales_division}` : ''}</Baris>
        <Baris label="Kategori">{t.category}</Baris>
        {t.product && <Baris label="Product">{t.product}</Baris>}
        <Baris label="Lokasi">{t.address || '-'}</Baris>
        <Baris label="Tanggal">{formatDate(t.due_date)}{t.due_time ? ` · ${t.due_time}` : ''}</Baris>
        {/* Usulan timeline dari Sales - ditampilkan supaya Sales Internal tahu rentang yang diajukan sebelum
            meneruskan ke Admin. Penetapannya milik Admin saat menugaskan (draft Project Progress lahir di situ). */}
        {triggersProjectProgress(t.category) && (
          <Baris label="Timeline Pengerjaan">
            {t.progress_start_date || t.progress_target_date
              ? `${t.progress_start_date ? formatDate(t.progress_start_date) : '—'} → ${t.progress_target_date ? formatDate(t.progress_target_date) : '—'}`
              : 'Belum diusulkan'}
          </Baris>
        )}
      </div>
    </ModalSetujui>
  );
}


export function ModalHapus({
  showDeleteModal, deleteTarget, deleteConfirmText, setDeleteConfirmText, setShowDeleteModal, setDeleteTarget, handleDelete,
}: {
  showDeleteModal: boolean;
  deleteTarget: Reminder | null;
  deleteConfirmText: string;
  setDeleteConfirmText: (v: string) => void;
  setShowDeleteModal: (v: boolean) => void;
  setDeleteTarget: (r: Reminder | null) => void;
  handleDelete: () => void;
}) {
  if (!(showDeleteModal && deleteTarget)) return null;
  const batal = () => { setShowDeleteModal(false); setDeleteTarget(null); setDeleteConfirmText(''); };
  return (
    <Modal buka onTutup={batal} judul="Hapus Reminder" keterangan={`${deleteTarget.project_name} · ${deleteTarget.category}`} lapisan="atas" tutupDiLuar={false}
      footer={<>
        <TombolModal onClick={batal}>Batal</TombolModal>
        <TombolModal jenis="bahaya" onClick={handleDelete} disabled={deleteConfirmText !== 'HAPUS'}>Hapus Permanen</TombolModal>
      </>}>
      <div className="space-y-4">
        <KotakInfo nada="bahaya"><strong>Tindakan ini tidak dapat dibatalkan.</strong> Reminder ini dihapus permanen dari database.</KotakInfo>
        <div>
          <label htmlFor="f-reminder-schedule-components-popupringkas-1" className="block text-xs font-bold text-slate-700 mb-1.5">
            Ketik <span className="font-mono bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">HAPUS</span> untuk konfirmasi
          </label>
          <input id="f-reminder-schedule-components-popupringkas-1" type="text" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)}
            placeholder="Ketik HAPUS di sini..." className={kelasIsian} />
        </div>
      </div>
    </Modal>
  );
}

function KartuReminder({ r, onBuka, lencana, warnaGaris }: { r: Reminder; onBuka: () => void; lencana?: React.ReactNode; warnaGaris?: string }) {
  return (
    <div {...bisaDiklik(onBuka)} className="rounded-kontrol p-3 border cursor-pointer bg-white hover:bg-slate-50 transition-all"
      style={{ borderColor: warnaGaris ? warnaGaris + '66' : '#e2e8f0' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            {lencana}
            <CategoryBadge category={r.category} />
            {!lencana && <PriorityBadge priority={r.priority} />}
          </div>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <p className="font-bold text-sm text-slate-800 truncate">{(r.project_name || '').trim() || ((r as any).title || '').trim() || '—'}</p>
          {r.address && <p className="text-xs text-slate-500 mt-0.5">{r.address}</p>}
        </div>
        <div className="flex-shrink-0 text-right">
          <StatusBadge status={r.status} />
          <p className="text-[11px] text-slate-500 mt-1">{formatDate(r.due_date)}</p>
        </div>
      </div>
    </div>
  );
}


export function PopupNotifikasi({
  showNotificationPopup, myReminders, setShowNotificationPopup, setDetailReminder,
}: {
  showNotificationPopup: boolean;
  myReminders: Reminder[];
  setShowNotificationPopup: (v: boolean) => void;
  setDetailReminder: (r: Reminder | null) => void;
}) {
  if (!(showNotificationPopup)) return null;
  const tutup = () => setShowNotificationPopup(false);
  return (
    <Modal buka onTutup={tutup} judul="Reminder Kamu" keterangan={`${myReminders.length} reminder aktif yang ditugaskan ke kamu`}
      footer={<TombolModal onClick={tutup}>Tutup</TombolModal>}>
      <div className="space-y-2">
        {myReminders.map(r => <KartuReminder key={r.id} r={r} onBuka={() => { setDetailReminder(r); tutup(); }} />)}
      </div>
    </Modal>
  );
}


export function PopupLonceng({
  showBellPopup, myActiveReminders, perluAksiSaya, setShowBellPopup, setDetailReminder,
}: {
  showBellPopup: boolean;
  myActiveReminders: Reminder[];
  perluAksiSaya: { r: Reminder; alasan: string; warna: string }[];
  setShowBellPopup: (v: boolean) => void;
  setDetailReminder: (r: Reminder | null) => void;
}) {
  if (!(showBellPopup)) return null;
  const tutup = () => setShowBellPopup(false);
  //  Dipecah per alasan: "5 aktif" tidak memberi tahu apakah ada yang menunggu diputuskan atau semuanya
  //  tinggal dikerjakan - padahal itu bedanya mendesak dan tidak.
  const n = (a: string) => perluAksiSaya.filter(x => x.alasan === a).length;
  const ringkas = [
    n('Perlu kamu tugaskan ke tim') && `${n('Perlu kamu tugaskan ke tim')} perlu ditugaskan`,
    n('Menunggu persetujuan kamu') && `${n('Menunggu persetujuan kamu')} perlu persetujuan`,
    n('Perlu review kamu') && `${n('Perlu review kamu')} perlu review`,
    n('Dikerjakan kamu') && `${n('Dikerjakan kamu')} dikerjakan kamu`,
  ].filter(Boolean).join(' · ') || 'Tidak ada yang menunggu';
  return (
    <Modal buka onTutup={tutup} judul="Perlu Tindakan Kamu" keterangan={ringkas}
      footer={<TombolModal onClick={tutup}>Tutup</TombolModal>}>
      <div className="space-y-2">
        {myActiveReminders.length === 0 ? (
          <p className="text-center py-10 text-slate-500 font-semibold">Tidak ada reminder aktif.</p>
        ) : perluAksiSaya.map(({ r, alasan, warna }) => (
          //  Alasan ditaruh PALING DEPAN: yang dicari orang saat membuka lonceng adalah "saya harus apa".
          <KartuReminder key={r.id} r={r} warnaGaris={warna} onBuka={() => { setDetailReminder(r); tutup(); }}
            lencana={<span className="px-2 py-0.5 rounded-full text-[11px] font-bold text-white" style={{ background: warna }}>{alasan}</span>} />
        ))}
      </div>
    </Modal>
  );
}
