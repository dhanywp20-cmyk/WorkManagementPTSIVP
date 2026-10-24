'use client';

/** ModalHapusRequest - hapus satu request (ketik HAPUS). Semua keadaan tetap milik induk. Kerangka: Modal bersama. */
import { KotakInfo, Modal, TombolModal, kelasIsianPersetujuan as kelasIsian } from '@/components/shared';
import { ProjectRequest } from './shared';

export interface ModalHapusRequestProps {
  deleteConfirmText: string;
  deleteModal: { open: boolean; req: ProjectRequest | null; };
  deleting: boolean;
  handleDeleteConfirm: () => Promise<void>;
  setDeleteConfirmText: import("react").Dispatch<import("react").SetStateAction<string>>;
  setDeleteModal: import("react").Dispatch<import("react").SetStateAction<{ open: boolean; req: ProjectRequest | null; }>>;
}

export function ModalHapusRequest({ deleteConfirmText, deleteModal, deleting, handleDeleteConfirm, setDeleteConfirmText, setDeleteModal }: ModalHapusRequestProps) {
  if (!deleteModal.open || !deleteModal.req) return null;
  const batal = () => { setDeleteModal({ open: false, req: null }); setDeleteConfirmText(''); };
  return (
    <Modal buka onTutup={() => { if (!deleting) batal(); }} judul="Hapus Request" keterangan={`${deleteModal.req.project_name} · ${deleteModal.req.requester_name}`}
      lapisan="atas" tutupDiLuar={false}
      footer={<>
        <TombolModal onClick={batal} disabled={deleting}>Batal</TombolModal>
        <TombolModal jenis="bahaya" onClick={() => { void handleDeleteConfirm(); }} disabled={deleteConfirmText !== 'HAPUS' || deleting}>{deleting ? 'Menghapus...' : 'Hapus Permanen'}</TombolModal>
      </>}>
      <div className="space-y-4">
        <KotakInfo nada="awas">Tidak bisa dibatalkan - pesan &amp; lampiran request ikut terhapus.</KotakInfo>
        <div>
          <label htmlFor="f-require-hapus-konfirmasi" className="block text-xs font-bold text-slate-700 mb-1.5">
            Ketik <span className="font-mono bg-rose-100 text-rose-700 px-1 rounded">HAPUS</span> untuk konfirmasi
          </label>
          <input id="f-require-hapus-konfirmasi" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)}
            placeholder="Ketik HAPUS di sini..." autoFocus className={kelasIsian} />
        </div>
      </div>
    </Modal>
  );
}
