'use client';

import { LayarGalat } from '@/components/shared/LayarGalat';

/**
 * Batas galat modul portal. Letaknya DI DALAM KerangkaPortal, jadi header, sidebar, dan menu bawah
 * tetap tampil saat satu modul gagal render - pengguna bisa pindah ke menu lain tanpa muat ulang.
 */
export default function GalatModul({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <LayarGalat error={error} reset={reset} />;
}
