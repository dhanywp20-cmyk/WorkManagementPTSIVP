/** Lembar cetak / PNG bersama kalkulator AV. */
import { bukaCetak, type Lembar, namaBerkas, type Seksi, unduhLembarPNG } from '../bersama/cetak';

export type Baris = [string, string, boolean?];

const info = (b: Baris[]) => b.map(([label, nilai, sorot]) => ({ label, nilai, sorot }));

/** Lembar cetak sederhana: masukan | hasil, plus seksi tambahan (tabel). */
export function lembarAV(judul: string, masukan: Baris[], hasil: Baris[], catatan: string, tambahan: Seksi[] = []): Lembar {
  return {
    judul, subjudul: 'Kalkulator AV · Tools Team',
    kepala: [['Tanggal', new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })]],
    seksi: [{ judul: 'Masukan & hasil', jenis: 'info', kiri: info(masukan), kanan: info(hasil) }, ...tambahan],
    catatan,
  };
}

export const aksiLembar = (l: () => Lembar, nama: string) => ({ onCetak: () => bukaCetak(l()), onPng: () => unduhLembarPNG(l(), namaBerkas(nama)) });
