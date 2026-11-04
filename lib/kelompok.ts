import { useEffect, useState } from 'react';
import { dengarKelompok, kelompokCabang, kelompokPTS, kelompokPTSDitugaskan, lingkupManager, muatKelompok,
  semuaKelompok, type Kelompok, type LingkupManager } from './kelompok-inti';

export * from './kelompok-inti';

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
