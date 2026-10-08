/** Semua yang dibutuhkan panel Desain 3D: keadaan + hook engine (lihat Desain3D.tsx). */
import type { KeadaanDesain } from '../useKeadaanDesain';
import type { useKamera } from '../mesin/useKamera';
import type { useAksiDesain } from '../aksi/useAksiDesain';
import type { useProdukTim } from '../simpan/useProdukTim';
import type { useEkspor } from '../ekspor/useEkspor';
import type { useSimpanDesain } from '../simpan/useSimpanDesain';

export interface AlatDesain {
  K: KeadaanDesain;
  kamera: ReturnType<typeof useKamera>;
  aksi: ReturnType<typeof useAksiDesain>;
  produk: ReturnType<typeof useProdukTim>;
  ekspor: ReturnType<typeof useEkspor>;
  simpan: ReturnType<typeof useSimpanDesain>;
}
