'use client';
/**
 * Kamera: arah pandang, pas ke layar, zoom, putar, fokus benda / kursi penonton.
 * Bagian dari Desain3D.tsx (Tools Team) - lihat struktur di desain3d/README.md.
 */
import { useEffect } from 'react';
import { ruangDari } from '../inti';
import type { KeadaanDesain } from '../useKeadaanDesain';
import { ARAH_SUDUT, type Sudut } from './tipe';
import { posisiPas, terbangKe } from './kamera';


export function useKamera(K: KeadaanDesain) {
  const { analisis, batas, benda, fokusRuang, kameraSiap, kotakRuang, mesin, pasSetelahTemplate, pilih, ruang, setTampilan, siap, sudutRef } = K;
  //  Setelah template dipasang: pas-kan kamera ke ruangan BARU (dipanggil dari efek supaya ukuran ruangnya sudah yang baru).
  useEffect(() => {
    if (!pasSetelahTemplate.current || !siap) return;
    pasSetelahTemplate.current = false;
    pasKeLayar('semua');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruang, siap]);
  // ── Kamera ──
  /** Titik pusat & kotak batas untuk dipas ke kanvas: semua ruang atau satu ruang. */
  const fokusKotak = (fk: 'semua' | number) => {
    const { THREE } = mesin.current!;
    const k = fk === 'semua' ? null : kotakRuang[fk] ?? null;
    const x0 = k ? k.x0 : 0, x1 = k ? k.x0 + k.p : batas.x, z1 = k ? k.l : batas.z, t = k ? k.t : batas.t;
    return { target: new THREE.Vector3((x0 + x1) / 2, Math.min(1.2, t * 0.4), z1 / 2), kotak: new THREE.Box3(new THREE.Vector3(x0, 0, 0), new THREE.Vector3(x1, t, z1)) };
  };

  const kameraKe = (sudut: Sudut | 'kursi', fk: 'semua' | number = fokusRuang, langsung = false) => {
    const m = mesin.current; if (!m) return;
    sudutRef.current = sudut;
    if (sudut === 'kursi') {
      // Mata penonton (1,2 m) di kursi terpilih atau penonton terjauh, menatap display di ruang yang sama.
      const sel = benda.find(b => b.id === pilih && b.jenis === 'kursi');
      const ri = sel ? ruangDari(ruang, sel.x) : fk === 'semua' ? 0 : fk;
      const a = analisis.find(x => x.ri === ri) ?? analisis[0];
      const k = kotakRuang[ri] ?? kotakRuang[0];
      const p = sel ? { x: sel.x, z: sel.z } : a?.terjauhP ?? { x: k.x0 + k.p / 2, z: k.l - 0.5 };
      const target = a ? new m.THREE.Vector3(a.d.x, a.d.elev + a.d.h / 2, a.d.z) : new m.THREE.Vector3(k.x0 + k.p / 2, 1.2, 0);
      terbangKe(m, new m.THREE.Vector3(p.x, 1.2, p.z), target, langsung);
      return;
    }
    const { target, kotak } = fokusKotak(fk);
    terbangKe(m, posisiPas(m, target, new m.THREE.Vector3(...ARAH_SUDUT[sudut]).normalize(), kotak), target, langsung);
  };

  const pilihSudut = (sudut: Sudut | 'kursi', fk: 'semua' | number = fokusRuang) => {
    setTampilan(sudut === 'kursi' ? 'kursi' : sudut === 'atas' ? 'atas' : '3d');
    kameraKe(sudut, fk);
  };

  /** Pas seluruh ruangan (atau ruang terfokus) ke kanvas dari arah kamera sekarang. */
  const pasKeLayar = (fk: 'semua' | number = fokusRuang) => {
    const m = mesin.current; if (!m) return;
    const { target, kotak } = fokusKotak(fk);
    terbangKe(m, posisiPas(m, target, m.kamera.position.clone().sub(m.orbit.target).normalize(), kotak), target);
  };

  const zoom = (faktor: number) => {
    const m = mesin.current; if (!m) return;
    const jauh = m.kamera.position.clone().sub(m.orbit.target);
    jauh.setLength(Math.min(m.orbit.maxDistance, Math.max(m.orbit.minDistance, jauh.length() * faktor)));
    terbangKe(m, m.orbit.target.clone().add(jauh), m.orbit.target.clone());
  };

  const putarKamera = (derajat: number) => {
    const m = mesin.current; if (!m) return;
    const jauh = m.kamera.position.clone().sub(m.orbit.target).applyAxisAngle(new m.THREE.Vector3(0, 1, 0), (derajat * Math.PI) / 180);
    terbangKe(m, m.orbit.target.clone().add(jauh), m.orbit.target.clone());
  };

  /** Dekatkan kamera ke benda terpilih (arah pandang tetap). */
  const fokusBenda = () => {
    const m = mesin.current; const o = pilih ? m?.cache.get(pilih)?.obj : null;
    if (!m || !o) return;
    const kotak = new m.THREE.Box3().setFromObject(o);
    const target = kotak.getCenter(new m.THREE.Vector3());
    kotak.expandByScalar(0.5);
    terbangKe(m, posisiPas(m, target, m.kamera.position.clone().sub(m.orbit.target).normalize(), kotak, 1.15), target);
  };

  //  Pertama kali: perspektif seluruh ruangan. Ukuran ruang berubah: pas ulang
  //  dari arah kamera yang sedang dipakai (sudut pilihan pengguna tidak hilang).
  useEffect(() => {
    if (!siap) return;
    if (!kameraSiap.current) { kameraSiap.current = true; kameraKe('iso', 'semua', true); return; }
    if (sudutRef.current === 'kursi') kameraKe('kursi'); else pasKeLayar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batas.x, batas.z, batas.t, siap]);

  return { fokusBenda, fokusKotak, kameraKe, pasKeLayar, pilihSudut, putarKamera, zoom };
}
