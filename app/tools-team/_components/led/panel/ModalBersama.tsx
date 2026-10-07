'use client';
/** Modal bersama: editor referensi produk & buka / simpan file hitungan. */
import { f } from '../../bersama/ui';
import { FileLED } from '../FileLED';
import { EditorReferensiLED } from '../referensi/EditorReferensiLED';
import type { AlatLED } from './alat';

export function ModalBersama({ a }: { a: AlatLED }) {
  const { bukaRef, customer, fileAktif, fileMode, h, isian, labelLED, n, project, refLED, riwayat, setBukaRef, setFileAktif, setFileMode, terapkan, u } = a.K;
  type Isian = AlatLED['K']['isian'];
  return (
    <>
      <EditorReferensiLED {...refLED} buka={bukaRef} onTutup={() => setBukaRef(false)} />
      <FileLED mode={fileMode} onTutup={() => setFileMode(null)} isian={isian}
        ringkasan={{ project, customer, kode: labelLED.slice(0, 30), lebarM: h.lebarM, tinggiM: h.tinggiM, resX: h.resX, resY: h.resY, jumlahCab: h.jumlahCab, screen: n }}
        namaAwal={[project, customer].filter(Boolean).join(' - ') || `LED ${u.kode} ${f(h.lebarM)}×${f(h.tinggiM)} m`}
        fileAktif={fileAktif} onTersimpan={setFileAktif}
        onBuka={(data, file) => { terapkan(data as Partial<Isian>); riwayat.mulaiBaru({ ...isian, ...(data as Partial<Isian>) }); setFileAktif(file); }} />
    </>
  );
}
