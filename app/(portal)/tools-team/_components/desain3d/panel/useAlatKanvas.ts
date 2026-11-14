'use client';
import { useEffect } from 'react';
import { MAKS_PENGGARIS, titikSnap } from '../inti';
import type { AlatDesain } from './alat';

export type AlatAktif = 'pilih' | 'banyak' | 'ukur';

const diIsian = (e: KeyboardEvent) => (e.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable="true"], [role=dialog]');

export function useAlatKanvas(a: AlatDesain) {
  const { daftarKanvas, setDaftarKanvas, alatKanvas, bukaSisi, hanyaLihat, klikUkurRef, modeBanyak, modeGizmo, setAlatKanvas, setModeBanyak, setModeGizmo,
    setPilih, setPilihLain, setRuang, setSnap, setTitikUkur, snap, terpilih, titikUkur } = a.K;
  const ukur = alatKanvas === 'ukur';
  const aktif: AlatAktif = ukur ? 'ukur' : modeBanyak ? 'banyak' : 'pilih';

  useEffect(() => {
    if (!ukur) { klikUkurRef.current = null; return; }
    klikUkurRef.current = p => {
      const t = titikSnap(p, snap);
      if (!titikUkur) { setTitikUkur(t); return; }
      setTitikUkur(null);
      if (Math.hypot(t[0] - titikUkur[0], t[1] - titikUkur[1], t[2] - titikUkur[2]) < 0.005) return;
      setRuang(r => ({ ...r, penggaris: [...(r.penggaris ?? []), { id: `u${Date.now().toString(36)}`, a: titikUkur, b: t }].slice(-MAKS_PENGGARIS) }));
    };
    return () => { klikUkurRef.current = null; };
  }, [ukur, snap, titikUkur, klikUkurRef, setRuang, setTitikUkur]);

  const pilihAlat = (x: AlatAktif) => {
    if (x === 'ukur') { setPilih(null); setPilihLain([]); setModeBanyak(false); setAlatKanvas('ukur'); return; }
    setAlatKanvas('pilih'); setTitikUkur(null); setModeBanyak(x === 'banyak');
  };

  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || diIsian(e)) return;
      const k = e.key.toLowerCase();
      if (k === 'escape') { if (ukur && titikUkur) setTitikUkur(null); else if (aktif !== 'pilih') pilihAlat('pilih'); }
      else if (k === 'v') pilihAlat('pilih');
      else if (k === 'm') pilihAlat(ukur ? 'pilih' : 'ukur');
      else if (k === 'l') setDaftarKanvas(!daftarKanvas);
      else if (k === 'g') setSnap({ ...snap, aktif: !snap.aktif });
      else if (k === 'a' && !hanyaLihat) bukaSisi('tambah');
      else if (k === 'r' && terpilih) setModeGizmo(modeGizmo === 'translate' ? 'rotate' : 'translate');
    };
    window.addEventListener('keydown', tekan);
    return () => window.removeEventListener('keydown', tekan);
  });

  return { aktif, pilihAlat, ukur };
}
