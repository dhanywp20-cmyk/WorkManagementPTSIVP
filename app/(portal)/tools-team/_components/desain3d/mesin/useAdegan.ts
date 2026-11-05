'use client';
import { buatModel, sesuaikanTinggi } from '../bangun';
import { aturNyalaLampu } from '../bangun/tekstur';
import { teksturKonten } from '../bangun/konten';
import { nyalaLampu, tandaBentuk } from '../inti';
import type { KeadaanDesain } from '../useKeadaanDesain';
import { useEffect } from 'react';
import type * as T from 'three';
import { bangunRuangan } from '../bangun/ruangan';
import { aturSnapGizmo, gambarGridSnap, gambarJarakDinding, gambarPenggaris } from './presisi';
import { penggarisSah, ruangDari, tampilDi } from '../inti';
import { gambarAlatBantu } from './alatBantu';
import { gambarBayangan } from './bayangan';
import { aturTeksTersembunyi } from './label';
import { aturCahayaRuang } from './proyektorNyata';

export function useAdegan(K: KeadaanDesain) {
  const { sinarNyata, sembunyiTeks, jarakDinding, teksSinar, setUkuranCahaya, sembunyiGolongan, snap, titikUkur, setRuang, gambarTekstur, versiTekstur, pilihLain, analisis, bayangan, benda, detailBlending, gambarLayar, gridSinar, garisUkur, jangkau, kabel, kerucut, kotakRuang, labelProduk, mesin, modeGizmo, modelImpor, pilih, plafonDi, ruang, setInfoBlending, siap, sinar, sudutNyaman, tampilBlending, tampilKabel, tampilShare, tampilan, teksturBayang, ukur, versiGambar } = K;
  useEffect(() => {
    const m = mesin.current; if (!m || !siap) return;
    bangunRuangan(m.THREE, m.grupRuang, ruang, k => gambarTekstur.current.get(k));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruang, siap, versiTekstur]);

  useEffect(() => {
    const m = mesin.current; if (!m || !siap) return;
    const { THREE, grupBenda, cache } = m;
    const ada = new Set(benda.map(b => b.id));
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
    const layarPolos = sinar && sinarNyata;
    for (const b of benda) {
      const tanda = `${tandaBentuk(b)}|${versiGambar}${b.jenis === 'layar' ? `|${layarPolos}` : ''}`;
      let c = cache.get(b.id);
      if (!c || c.tanda !== tanda) {
        if (c) { grupBenda.remove(c.obj); buang(c.obj); }
        const obj = buatModel(b, {
          THREE,
          layar: x => (x.konten === 'mati' || (x.jenis === 'layar' && layarPolos) ? null : x.konten === 'gambar' ? gambarLayar.current.get(x.id) ?? null : teksturKonten(THREE, x)),
          model: k => modelImpor.current.get(k) ?? null,
        });
        obj.userData.id = b.id;
        grupBenda.add(obj);
        c = { obj, tanda }; cache.set(b.id, c);
      }
      c.obj.visible = tampilDi(b, sembunyiGolongan);
      c.obj.position.set(b.x, b.elev, b.z);
      c.obj.rotation.y = (b.rot * Math.PI) / 180;
      sesuaikanTinggi(c.obj, b, plafonDi(b.x));
      if (b.jenis === 'lampu') aturNyalaLampu(c.obj, nyalaLampu(b, ruang));
    }
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
  }, [benda, pilih, pilihLain, siap, ruang, versiGambar, sembunyiGolongan, sinar, sinarNyata]);

  useEffect(() => {
    const m = mesin.current; if (!m || !siap) return;
    const o = pilih ? m.cache.get(pilih)?.obj : null;
    if (o && tampilan !== 'kursi' && !benda.find(b => b.id === pilih)?.terkunci) {
      m.gizmo.attach(o);
      m.gizmo.setMode(modeGizmo);
      m.gizmo.showX = modeGizmo === 'translate'; m.gizmo.showZ = modeGizmo === 'translate'; m.gizmo.showY = true;
    } else m.gizmo.detach();
    aturSnapGizmo(m, snap);
  }, [pilih, modeGizmo, siap, tampilan, benda, snap]);

  useEffect(() => {
    const m = mesin.current; if (!m || !siap) return;
    gambarGridSnap(m, kotakRuang, snap);
  }, [kotakRuang, snap, siap, mesin]);
  useEffect(() => {
    const m = mesin.current; if (!m || !siap) return;
    gambarPenggaris(m, penggarisSah(ruang.penggaris), titikUkur, id => setRuang(r => ({ ...r, penggaris: (r.penggaris ?? []).filter(g => g.id !== id) })));
  }, [ruang.penggaris, titikUkur, siap, mesin, setRuang]);
  useEffect(() => {
    const m = mesin.current; if (!m || !siap) return;
    const b = jarakDinding && !pilihLain.length ? benda.find(x => x.id === pilih) ?? null : null;
    gambarJarakDinding(m, b, b ? kotakRuang[ruangDari(ruang, b.x)] ?? null : null);
  }, [pilih, pilihLain, benda, kotakRuang, ruang, jarakDinding, siap, mesin]);
  useEffect(() => {
    const m = mesin.current; if (!m || !siap) return;
    aturTeksTersembunyi(m, sembunyiTeks);
  }, [sembunyiTeks, siap, mesin]);

  useEffect(() => {
    const m = mesin.current; if (!m || !siap) return;
    aturCahayaRuang(m, { f: { terang: 1, redup: 0.45, gelap: 0.12 }[ruang.cahaya ?? 'terang'] });
  }, [ruang.cahaya, siap]);

  useEffect(() => {
    const m = mesin.current; if (!m || !siap) return;
    const gambar = () => gambarAlatBantu(m, { analisis, benda: sembunyiGolongan.length ? benda.filter(b => tampilDi(b, sembunyiGolongan)) : benda, garisUkur, jangkau, kabel, kerucut, kotakRuang, labelProduk, plafonDi, ruang, sinar, sudutNyaman, tampilKabel, tampilShare, ukur, tampilBlending, detailBlending, gridSinar, teksSinar: teksSinar && !sembunyiTeks, setInfoBlending, setUkuranCahaya, tampilan, sinarNyata, gambarLayar });
    m.kasarPaksa = true;
    try { gambar(); } finally { m.kasarPaksa = false; }
    const rinci = setTimeout(gambar, 300);
    return () => clearTimeout(rinci);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analisis, ukur, garisUkur, labelProduk, kerucut, sinar, siap, kotakRuang, benda, ruang, sudutNyaman, jangkau, tampilKabel, tampilShare, kabel, tampilBlending, detailBlending, gridSinar, teksSinar, sembunyiTeks, sembunyiGolongan, tampilan, sinarNyata, versiGambar]);
  useEffect(() => {
    const m = mesin.current; if (!m || !siap) return;
    gambarBayangan(m, { bayangan, benda, kotakRuang, ruang, teksturBayang });
  }, [benda, ruang, siap, bayangan, kotakRuang]);
}
