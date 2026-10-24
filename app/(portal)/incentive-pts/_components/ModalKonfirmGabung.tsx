'use client';

/** ModalKonfirmGabung - gabungkan beberapa jadwal jadi satu proyek insentif. Semua keadaan tetap milik induk. Kerangka: Modal bersama. */
import { KotakInfo, Modal, TombolModal } from '@/components/shared';
import { type KandidatGabung } from './calc';

export interface ModalKonfirmGabungProps {
  jalankanGabung: () => Promise<void>;
  konfirmGabung: KandidatGabung | null;
  menggabung: boolean;
  setKonfirmGabung: import("react").Dispatch<import("react").SetStateAction<KandidatGabung | null>>;
}

export function ModalKonfirmGabung({ jalankanGabung, konfirmGabung, menggabung, setKonfirmGabung }: ModalKonfirmGabungProps) {
  if (!konfirmGabung) return null;
  const tutup = () => { if (!menggabung) setKonfirmGabung(null); };
  return (
    <Modal buka onTutup={tutup} judul="Gabungkan jadi satu proyek?" keterangan={konfirmGabung.nama}
      footer={<>
        <TombolModal onClick={tutup} disabled={menggabung}>Batal</TombolModal>
        <TombolModal jenis="utama" onClick={() => { void jalankanGabung(); }} disabled={menggabung}>{menggabung ? 'Menggabungkan...' : 'Ya, Gabungkan'}</TombolModal>
      </>}>
      <div className="space-y-3 text-[13px] leading-relaxed">
        <div className="rounded-kontrol bg-slate-50 border border-slate-200 divide-y divide-slate-200">
          {konfirmGabung.anggota.map((a, i) => (
            <div key={i} className="px-3 py-2 flex justify-between gap-3">
              <span className="text-slate-700">{a.category ?? '-'}</span>
              <span className="text-slate-500 text-right">{a.assign_name ?? '-'} · {a.due_date}</span>
            </div>
          ))}
        </div>
        <p className="text-slate-700">Setelah digabung, keduanya dihitung <b>satu proyek dengan satu pool nominal</b>.</p>
        <KotakInfo nada="awas">
          Bila penangannya berbeda, yang satu menjadi <b>PIC</b> dan yang lain masuk sebagai <b>Support</b> - bagiannya mengecil,
          tapi tidak hilang. Yang hilang adalah pool kedua yang memang seharusnya tidak ada.
        </KotakInfo>
        <p className="text-slate-500 text-[12px]">Kalau ini sebenarnya dua kontrak berbeda, tekan Batal dan biarkan terpisah.</p>
      </div>
    </Modal>
  );
}
