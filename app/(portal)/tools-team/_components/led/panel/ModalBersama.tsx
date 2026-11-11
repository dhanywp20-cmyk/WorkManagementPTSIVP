'use client';
import { f } from '../../bersama/ui';
import { FileLED } from '../FileLED';
import { svgPosterKoneksi } from '../koneksi/svg';
import { useBukaDariTautan } from '../useBukaDariTautan';
import { EditorReferensiLED } from '../referensi/EditorReferensiLED';
import type { AlatLED } from './alat';

export function ModalBersama({ a }: { a: AlatLED }) {
  const { bukaRef, customer, dataKoneksi, fileAktif, fileMode, h, isian, koneksi, labelLED, n, project, refLED, riwayat, setBukaRef, setFileAktif, setFileMode, terapkan, u } = a.K;
  type Isian = AlatLED['K']['isian'];
  const bukaFile = (data: Record<string, unknown>, file: Parameters<typeof setFileAktif>[0]) => {
    terapkan(data as Partial<Isian>); riwayat.mulaiBaru({ ...isian, ...(data as Partial<Isian>) }); setFileAktif(file);
  };
  useBukaDariTautan(bukaFile);
  return (
    <>
      <EditorReferensiLED {...refLED} buka={bukaRef} onTutup={() => setBukaRef(false)} />
      <FileLED mode={fileMode} onTutup={() => setFileMode(null)} isian={isian}
        ringkasan={{ project, customer, kode: labelLED.slice(0, 30), lebarM: h.lebarM, tinggiM: h.tinggiM, resX: h.resX, resY: h.resY, jumlahCab: h.jumlahCab, screen: n }}
        namaAwal={[project, customer].filter(Boolean).join(' - ') || `LED ${u.kode} ${f(h.lebarM)}×${f(h.tinggiM)} m`}
        svgKoneksi={() => svgPosterKoneksi(dataKoneksi, koneksi, 'Screen Connection LED', [project || 'Tanpa nama project', customer].filter(Boolean).join(' — '))}
        fileAktif={fileAktif} onTersimpan={setFileAktif} onBuka={bukaFile} />
    </>
  );
}
