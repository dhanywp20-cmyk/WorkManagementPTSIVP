/**
 * lib/kelompok.ts - kelompok kerja: seluruh isi lib/kelompok-inti.ts + hook React-nya.
 *
 * Inti (data, pemuatan, penyimpanan, aturan) dipisah ke lib/kelompok-inti.ts tanpa
 * React, supaya modul server (lib/teams.ts lewat DIWAYPI) bisa memakainya - route
 * Next.js menolak modul yang mengimpor useState. Komponen tetap mengimpor dari sini.
 */
import { useEffect, useState } from 'react';
import { dengarKelompok, kelompokCabang, kelompokPTS, kelompokPTSDitugaskan, lingkupManager, muatKelompok,
  semuaKelompok, type Kelompok, type LingkupManager } from './kelompok-inti';

export * from './kelompok-inti';

// Jembatan React

function usePakai<T>(ambil: () => T): T {
  const [nilai, setNilai] = useState<T>(ambil);
  useEffect(() => {
    const segarkan = () => setNilai(ambil());
    const lepas = dengarKelompok(segarkan);
    void muatKelompok().then(segarkan);
    return lepas;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return nilai;
}

export function useKelompok(): Kelompok[] { return usePakai(semuaKelompok); }
export function useKelompokPTS(): Kelompok[] { return usePakai(kelompokPTS); }
export function useKelompokPTSDitugaskan(): Kelompok[] { return usePakai(kelompokPTSDitugaskan); }
export function useKelompokCabang(): Kelompok[] { return usePakai(kelompokCabang); }
export function useLingkupManager(): LingkupManager { return usePakai(lingkupManager); }
