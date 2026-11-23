'use client';
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

const SKALA_MIN = 0.7;
const LEBAR_MIN = 1024;
const TINGGI_MIN = 600;

export function useSkalaMuat(
  aktif: boolean,
  akar: RefObject<HTMLElement | null>,
  kepala: RefObject<HTMLElement | null>,
  isi: RefObject<HTMLElement | null>,
) {
  const [skala, setSkala] = useState(1);
  const skalaRef = useRef(1);

  useLayoutEffect(() => {
    const el = akar.current, wadah = isi.current;
    if (!aktif || !el || !wadah) return;
    let bingkai = 0;
    const hitung = () => {
      bingkai = 0;
      const s = skalaRef.current;
      let baru = 1;
      if (window.innerWidth >= LEBAR_MIN && window.innerHeight >= TINGGI_MIN) {
        const sedia = el.clientHeight - (kepala.current?.offsetHeight ?? 0) - 2;
        const tinggi = wadah.getBoundingClientRect().height;
        if (sedia > 0 && tinggi > 0) baru = Math.min(1, Math.max(SKALA_MIN, s * sedia / tinggi));
      }
      baru = Math.floor(baru * 1000) / 1000;
      if (Math.abs(baru - s) < 0.004) return;
      skalaRef.current = baru;
      setSkala(baru);
    };
    const jadwal = () => { if (!bingkai) bingkai = requestAnimationFrame(hitung); };
    const ro = new ResizeObserver(jadwal);
    ro.observe(el);
    ro.observe(wadah);
    window.addEventListener('resize', jadwal);
    jadwal();
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', jadwal);
      if (bingkai) cancelAnimationFrame(bingkai);
    };
  }, [aktif, akar, kepala, isi]);

  return aktif ? skala : 1;
}
