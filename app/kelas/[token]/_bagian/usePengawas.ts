'use client';

/**
 * Pengawas quiz di perangkat peserta: pindah tab/aplikasi, keluar jendela (split screen / jendela
 * lain), dan salin/tempel/klik kanan (sekaligus diblokir). Tiap kejadian dilaporkan ke server
 * (dicatat atomik + log waktu) - angka di layar admin berasal dari server, bukan dari peramban.
 */
import { useEffect, useRef, useState } from 'react';
import { LABEL_PELANGGARAN, type JenisPelanggaran } from '@/lib/kelas-eksternal';
import { laporPelanggaran, type HasilLapor } from './api';

/** Salin/tempel beruntun (mis. tahan Ctrl+C) dihitung satu kali per 2 detik. */
const JEDA_SALIN_MS = 2000;
/** blur yang diikuti tab tersembunyi dalam waktu ini = pindah tab, bukan keluar jendela. */
const JEDA_BLUR_MS = 400;

export interface Peringatan { jenis: JenisPelanggaran; label: string; total: number | null; batas: number | null }

export function usePengawas({ kelas, aktif, onBatasTercapai }: {
  kelas: string; aktif: boolean; onBatasTercapai: () => void;
}) {
  const [peringatan, setPeringatan] = useState<Peringatan | null>(null);
  const batasRef = useRef(onBatasTercapai);
  useEffect(() => { batasRef.current = onBatasTercapai; }, [onBatasTercapai]);

  useEffect(() => {
    if (!aktif) return;
    let tersembunyi = false;
    let terakhirSalin = 0;
    let tundaBlur: number | undefined;
    let sembunyiPeringatan: number | undefined;

    const lapor = async (jenis: JenisPelanggaran) => {
      const r: HasilLapor | null = await laporPelanggaran(kelas, jenis);
      setPeringatan({ jenis, label: LABEL_PELANGGARAN[jenis], total: r?.total ?? null, batas: r?.batas ?? null });
      window.clearTimeout(sembunyiPeringatan);
      sembunyiPeringatan = window.setTimeout(() => setPeringatan(null), 6000);
      if (r?.kirimOtomatis) batasRef.current();
    };

    const onVisibility = () => {
      if (document.hidden) {
        tersembunyi = true;
        window.clearTimeout(tundaBlur);
        void lapor('pindah_tab');
      } else {
        tersembunyi = false;
      }
    };
    const onBlur = () => {
      window.clearTimeout(tundaBlur);
      tundaBlur = window.setTimeout(() => {
        if (!tersembunyi && !document.hidden && !document.hasFocus()) void lapor('keluar_jendela');
      }, JEDA_BLUR_MS);
    };
    const onSalin = (e: Event) => {
      e.preventDefault();
      const kini = Date.now();
      if (kini - terakhirSalin < JEDA_SALIN_MS) return;
      terakhirSalin = kini;
      void lapor('salin_tempel');
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    for (const ev of ['copy', 'cut', 'paste', 'contextmenu'] as const) document.addEventListener(ev, onSalin);
    return () => {
      window.clearTimeout(tundaBlur);
      window.clearTimeout(sembunyiPeringatan);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      for (const ev of ['copy', 'cut', 'paste', 'contextmenu'] as const) document.removeEventListener(ev, onSalin);
    };
  }, [kelas, aktif]);

  return { peringatan, tutupPeringatan: () => setPeringatan(null) };
}
