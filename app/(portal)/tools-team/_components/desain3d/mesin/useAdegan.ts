'use client';
/**
 * Isi adegan: ruangan, benda (bangun ulang yang berubah), gizmo, alat bantu, cahaya & bayangan.
 * Bagian dari Desain3D.tsx (Tools Team) - lihat struktur di desain3d/README.md.
 */
import { buatModel, sesuaikanTinggi } from '../bangun';
import { aturNyalaLampu } from '../bangun/tekstur';
import { teksturKonten } from '../bangun/konten';
import { nyalaLampu, tandaBentuk } from '../inti';
import type { KeadaanDesain } from '../useKeadaanDesain';
import { useEffect } from 'react';
import type * as T from 'three';
import { bangunRuangan } from '../bangun/ruangan';
import { gambarAlatBantu } from './alatBantu';
import { gambarBayangan } from './bayangan';


export function useAdegan(K: KeadaanDesain) {
  const { gambarTekstur, versiTekstur, pilihLain, analisis, bayangan, benda, detailBlending, gambarLayar, gridSinar, garisUkur, jangkau, kabel, kerucut, kotakRuang, labelProduk, mesin, modeGizmo, modelImpor, pilih, plafonDi, ruang, setInfoBlending, siap, sinar, sudutNyaman, tampilBlending, tampilKabel, tampilShare, tampilan, teksturBayang, ukur, versiGambar } = K;
  // ── Ruangan: lantai bertekstur + 4 dinding per ruang ──
  //  Dinding hanya terlihat dari sisi dalam (FrontSide), jadi dinding yang
  //  membelakangi kamera otomatis "tembus" seperti denah rumah boneka.
  useEffect(() => {
    const m = mesin.current; if (!m || !siap) return;
    bangunRuangan(m.THREE, m.grupRuang, ruang, k => gambarTekstur.current.get(k));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruang, siap, versiTekstur]);

  // ── Benda: bangun ulang hanya yang bentuknya berubah ──
  useEffect(() => {
    const m = mesin.current; if (!m || !siap) return;
    const { THREE, grupBenda, cache } = m;
    const ada = new Set(benda.map(b => b.id));
    //  Model lama dibuang BESERTA geometri & materialnya - tanpa ini memori GPU
    //  bertambah tiap kali ukuran/bentuk benda diubah (model dibangun ulang).
    //  Gambar unggahan tidak ikut dilepas: ia dipakai ulang model berikutnya.
    const unggahan = new Set(gambarLayar.current.values());
    const buang = (o: T.Object3D) => o.traverse(x => {
      const mesh = x as T.Mesh;
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const mt of mats) {
        for (const v of Object.values(mt)) if (v instanceof THREE.Texture && !unggahan.has(v)) v.dispose();
        mt.dispose();
      }
    });
    for (const [id, c] of cache) if (!ada.has(id)) { grupBenda.remove(c.obj); buang(c.obj); cache.delete(id); }
    for (const b of benda) {
      const tanda = `${tandaBentuk(b)}|${versiGambar}`;
      let c = cache.get(b.id);
      if (!c || c.tanda !== tanda) {
        if (c) { grupBenda.remove(c.obj); buang(c.obj); }
        const obj = buatModel(b, {
          THREE,
          layar: x => (x.konten === 'mati' ? null : x.konten === 'gambar' ? gambarLayar.current.get(x.id) ?? null : teksturKonten(THREE, x)),
          model: k => modelImpor.current.get(k) ?? null,
        });
        obj.userData.id = b.id;
        grupBenda.add(obj);
        c = { obj, tanda }; cache.set(b.id, c);
      }
      c.obj.position.set(b.x, b.elev, b.z);
      c.obj.rotation.y = (b.rot * Math.PI) / 180;
      sesuaikanTinggi(c.obj, b, plafonDi(b.x));
      if (b.jenis === 'lampu') aturNyalaLampu(c.obj, nyalaLampu(b, ruang));
    }
    // Sorotan benda terpilih (kotak batas tipis).
    grupBenda.children.filter(o => o.userData.sorot).forEach(o => { grupBenda.remove(o); buang(o); });
    const terpilih = pilih ? cache.get(pilih)?.obj : null;
    if (terpilih) {
      const s = new THREE.BoxHelper(terpilih, 0x2563eb); s.userData.sorot = true; grupBenda.add(s);
    }
    for (const id of pilihLain) {
      const o = cache.get(id)?.obj; if (!o) continue;
      const s = new THREE.BoxHelper(o, 0x60a5fa); s.userData.sorot = true; grupBenda.add(s);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [benda, pilih, pilihLain, siap, ruang, versiGambar]);

  // ── Gizmo menempel ke benda terpilih ──
  useEffect(() => {
    const m = mesin.current; if (!m || !siap) return;
    const o = pilih ? m.cache.get(pilih)?.obj : null;
    if (o && tampilan !== 'kursi') {
      m.gizmo.attach(o);
      m.gizmo.setMode(modeGizmo);
      m.gizmo.showX = modeGizmo === 'translate'; m.gizmo.showZ = modeGizmo === 'translate'; m.gizmo.showY = true;
    } else m.gizmo.detach();
  }, [pilih, modeGizmo, siap, tampilan, benda]);

  // ── Alat bantu: label ukuran, garis jarak terjauh, kerucut sudut pandang ──
  useEffect(() => {
    const m = mesin.current; if (!m || !siap) return;
    gambarAlatBantu(m, { analisis, benda, garisUkur, jangkau, kabel, kerucut, kotakRuang, labelProduk, plafonDi, ruang, sinar, sudutNyaman, tampilKabel, tampilShare, ukur, tampilBlending, detailBlending, gridSinar, setInfoBlending });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analisis, ukur, garisUkur, labelProduk, kerucut, sinar, siap, kotakRuang, benda, ruang, sudutNyaman, jangkau, tampilKabel, tampilShare, kabel, tampilBlending, detailBlending, gridSinar]);
  // ── Tingkat cahaya ruangan ──
  useEffect(() => {
    const m = mesin.current; if (!m || !siap) return;
    const f = { terang: 1, redup: 0.45, gelap: 0.12 }[ruang.cahaya ?? 'terang'];
    m.lampu.matahari.intensity = 1.6 * f; m.lampu.langit.intensity = 0.35 * f;
    (m.scene as T.Scene & { environmentIntensity: number }).environmentIntensity = Math.max(0.1, f);
  }, [ruang.cahaya, siap]);

  // ── Bayangan lembut & cahaya layar ──
  //  Lampu arah adegan berada di depan-atas, jadi display yang menempel dinding hanya menjatuhkan
  //  bayangan setebal celah bracket (beberapa cm) - nyaris tak terlihat. Di sini ditambahkan bayangan
  //  lembut (seperti cahaya ruangan dari atas) di dinding belakang display, bayangan kontak di lantai
  //  untuk standfloor, dan pendar cahaya layar yang menyala ke lantai di depannya.
  useEffect(() => {
    const m = mesin.current; if (!m || !siap) return;
    gambarBayangan(m, { bayangan, benda, kotakRuang, ruang, teksturBayang });
  }, [benda, ruang, siap, bayangan, kotakRuang]);
}
