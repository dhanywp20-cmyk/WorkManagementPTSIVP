'use client';

/** ModalHapusTahapan - hapus tahapan pencairan satu proyek. Semua keadaan tetap milik induk. Kerangka: Modal bersama. */
import { KotakInfo, Modal, TombolModal, kelasIsianPersetujuan as kelasIsian } from '@/components/shared';
import { IncentiveProjectRow, IncentiveTranche } from './calc';

export interface ModalHapusTahapanProps {
  hapusTahapan: IncentiveProjectRow | null;
  jalankanHapusTahapan: () => Promise<void>;
  ketikHapusTahapan: string;
  membatalkan: boolean;
  setHapusTahapan: import("react").Dispatch<import("react").SetStateAction<IncentiveProjectRow | null>>;
  setKetikHapusTahapan: import("react").Dispatch<import("react").SetStateAction<string>>;
  tranches: (IncentiveTranche & { project: IncentiveProjectRow; })[];
}

export function ModalHapusTahapan({ hapusTahapan, jalankanHapusTahapan, ketikHapusTahapan, membatalkan, setHapusTahapan, setKetikHapusTahapan, tranches }: ModalHapusTahapanProps) {
  if (!hapusTahapan) return null;
  const punya = tranches.filter(t => t.project_id === hapusTahapan.id);
  const paid = punya.filter(t => t.status === 'paid').length;
  const kunci = 'HAPUS TAHAPAN';
  const tutup = () => { setHapusTahapan(null); setKetikHapusTahapan(''); };
  return (
    <Modal buka onTutup={tutup} judul="Hapus Tahapan Pencairan" keterangan={hapusTahapan.project_name} lapisan="maks" tutupDiLuar={false}
      footer={<>
        <TombolModal onClick={tutup}>Tutup</TombolModal>
        <TombolModal jenis="bahaya" onClick={() => { void jalankanHapusTahapan(); }} disabled={membatalkan || paid > 0 || ketikHapusTahapan.trim().toUpperCase() !== kunci}>
          {membatalkan ? 'Memproses...' : 'Hapus Tahapan'}
        </TombolModal>
      </>}>
      <div className="space-y-3">
        <p className="text-sm text-slate-600">{punya.length} tahapan berikut pembagiannya akan dihapus. Sesudah itu nominal pool bisa disunting lagi dan tahapannya dibuat ulang.</p>
        {paid > 0 ? (
          <KotakInfo nada="bahaya">
            <strong>Ditolak</strong> - {paid} tahapan sudah berstatus Paid. Tahap yang uangnya sudah keluar tidak boleh dihapus dari sini; itu perkara koreksi pembukuan.
          </KotakInfo>
        ) : (
          <>
            <KotakInfo nada="awas">Yang dihapus hanya tahapan &amp; pembagiannya. Data proyeknya sendiri - nominal, BAST, mode, PIC - tidak disentuh.</KotakInfo>
            <div>
              <label htmlFor="f-incentive-hapus-tahapan" className="block text-xs font-bold text-slate-700 mb-1.5">
                Ketik <span className="font-mono bg-rose-100 text-rose-700 px-1 rounded-sm">{kunci}</span> untuk melanjutkan
              </label>
              <input id="f-incentive-hapus-tahapan" type="text" value={ketikHapusTahapan} autoFocus onChange={e => setKetikHapusTahapan(e.target.value)} placeholder={kunci} className={kelasIsian} />
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
