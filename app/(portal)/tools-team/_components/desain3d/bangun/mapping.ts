/**
 * desain3d/bangun/mapping.ts - Mapping: bidang / layar mapping, objek mapping (bentuk dasar & siluet gambar), model 3D impor.
 * Model dibangun dengan alas di y = 0; ketinggian (elev) diterapkan lewat posisi grup.
 */
import type * as T from 'three';
import { type Benda, ukuranBidang } from '../inti';
import { batang, type Konteks, kotak, mat } from './dasar';

/**
 * Bidang mapping: potongan silinder tegak (jari-jari R, busur). Lengkung = cekung, pusat
 * kelengkungan di depan (sisi penonton, +z); cembung = pusat di belakang; busur 360 = pilar.
 * Permukaan putih doff dua sisi, lis atas-bawah, tiang penyangga dari lantai bila melayang.
 */
function bidangMapping(THREE: typeof T, g: T.Group, b: Benda, warna: number) {
  const lis = mat(THREE, 0x1f2227, { metalness: 0.4, roughness: 0.5 });
  if (b.bentukBidang === 'datar') {
    //  Screen datar: permukaan doff + bingkai tipis + dua kaki penyangga di belakang.
    const { w } = ukuranBidang(b), muka = new THREE.Mesh(new THREE.PlaneGeometry(w, b.h), new THREE.MeshStandardMaterial({ color: warna, roughness: 0.92, metalness: 0, side: THREE.DoubleSide }));
    muka.position.set(0, b.h / 2, 0.02); g.add(muka);
    const r = 0.02;
    for (const [x, y, lw, lh] of [[0, 0, w, r], [0, b.h, w, r], [-w / 2, b.h / 2, r, b.h], [w / 2, b.h / 2, r, b.h]] as const) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(lw + r, lh + r, 0.04), lis); m.position.set(x, y, 0); g.add(m);
    }
    for (const x of [-w * 0.35, w * 0.35]) g.add(batang(THREE, 0.05, 0.05, lis, x, -0.05, 'kaki', b.h * 0.5));
    return;
  }
  const { R, busur, d } = ukuranBidang(b);
  const t = (busur * Math.PI) / 180, cembung = b.bentukBidang === 'cembung';
  const mulai = cembung ? -t / 2 : Math.PI - t / 2, zPusat = cembung ? d / 2 - R : R - d / 2;
  const seg = Math.max(24, Math.round(busur / 2.5));
  const geo = new THREE.CylinderGeometry(R, R, b.h, seg, 1, true, mulai, t);
  geo.translate(0, b.h / 2, zPusat);
  g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: warna, roughness: 0.92, metalness: 0, side: THREE.DoubleSide })));
  const busurTitik = (y: number) => {
    const n = Math.max(8, Math.round(busur / 4)), p: T.Vector3[] = [];
    for (let i = 0; i <= n; i++) { const a = mulai + (t * i) / n; p.push(new THREE.Vector3(R * Math.sin(a), y, zPusat + R * Math.cos(a))); }
    return p;
  };
  for (const y of [0, b.h]) g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(busurTitik(y), busur >= 360), Math.max(16, Math.round(busur / 3)), 0.02, 6, busur >= 360), lis));
  if (busur >= 360) {
    const tutup = new THREE.Mesh(new THREE.CircleGeometry(R, 48), new THREE.MeshStandardMaterial({ color: warna, roughness: 0.9 }));
    tutup.rotation.x = -Math.PI / 2; tutup.position.set(0, b.h, zPusat); g.add(tutup);
  }
  //  Tiang penyangga di belakang permukaan (sisi luar lengkung) bila tidak berdiri di lantai.
  if (busur < 360) {
    for (const f of [0.08, 0.5, 0.92]) {
      const a = mulai + t * f, luar = cembung ? -0.06 : 0.06;
      const x = (R + luar) * Math.sin(a), z = zPusat + (R + luar) * Math.cos(a);
      g.add(batang(THREE, 0.05, 0.05, lis, x, z, 'kaki', b.h * 0.5));
    }
  }
}

/**
 * Objek mapping (lihat model.ts BentukObjek): bentuk dasar mengisi kotak w×h×d, alas di y = 0.
 * 'gambar' = siluet dari kontur ternormalisasi, diekstrusi setebal d; foto (bila ada) hanya di
 * permukaan depan - samping & belakang polos supaya sinar proyektor tetap terbaca.
 */
function objekMapping(THREE: typeof T, g: T.Group, b: Benda, warna: number, foto: T.Texture | null) {
  const bahanPolos = new THREE.MeshStandardMaterial({ color: warna, roughness: 0.85, metalness: 0 });
  const pasang = (geo: T.BufferGeometry, m: T.Material = bahanPolos) => { g.add(new THREE.Mesh(geo, m)); return geo; };
  const { w, h, d } = b;
  switch (b.bentukObjek ?? 'kotak') {
    case 'kotak': pasang(new THREE.BoxGeometry(w, h, d)).translate(0, h / 2, 0); return;
    case 'silinder': pasang(new THREE.CylinderGeometry(0.5, 0.5, 1, 48)).scale(w, h, d).translate(0, h / 2, 0); return;
    case 'bola': pasang(new THREE.SphereGeometry(0.5, 48, 32)).scale(w, h, d).translate(0, h / 2, 0); return;
    case 'kerucut': pasang(new THREE.ConeGeometry(0.5, 1, 48)).scale(w, h, d).translate(0, h / 2, 0); return;
    case 'kubah': {
      pasang(new THREE.SphereGeometry(0.5, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2)).scale(w, h * 2, d);
      pasang(new THREE.CircleGeometry(0.5, 48)).rotateX(Math.PI / 2).scale(w, 1, d);
      return;
    }
    case 'piramida': {
      //  Kerucut 4 sisi diputar 45° -> alas persegi 1 × 1 sebelum diskala.
      pasang(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1)).rotateY(Math.PI / 4).scale(w, h, d).translate(0, h / 2, 0);
      return;
    }
    case 'prisma': {
      const segi = new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0, 1)]);
      pasang(new THREE.ExtrudeGeometry(segi, { depth: 1, bevelEnabled: false })).translate(0, 0, -0.5).scale(w, h, d);
      return;
    }
    case 'gambar': {
      const bentuk = bentukDariKontur(THREE, b);
      if (!bentuk.length) { pasang(new THREE.BoxGeometry(w, h, d)).translate(0, h / 2, 0); return; }
      //  Ekstrusi di ruang 0..1 lalu diskala ke ukuran nyata: tepi kontur = tepi kotak w×h.
      pasang(new THREE.ExtrudeGeometry(bentuk, { depth: 1, bevelEnabled: false, curveSegments: 1 }))
        .translate(-0.5, 0, -0.5).scale(w, h, d);
      if (foto) {
        //  ShapeGeometry memberi UV = koordinat bentuk (0..1) = UV foto yang sudah dipotong ke kotak objek.
        const muka = new THREE.MeshStandardMaterial({ map: foto, roughness: 0.8, metalness: 0 });
        pasang(new THREE.ShapeGeometry(bentuk, 1), muka).translate(-0.5, 0, 0).scale(w, h, 1).translate(0, 0, d / 2 + 0.002);
      }
      return;
    }
  }
}

/** THREE.Shape dari kontur tersimpan (koordinat 0..1). Kontur rusak = tanpa bentuk (jatuh ke kotak). */
function bentukDariKontur(THREE: typeof T, b: Benda): T.Shape[] {
  const titik = (p: number[]) => { const v: T.Vector2[] = []; for (let i = 0; i + 1 < p.length; i += 2) v.push(new THREE.Vector2(p[i], p[i + 1])); return v; };
  return (b.kontur ?? []).filter(k => Array.isArray(k?.l) && k.l.length >= 6).map(k => {
    const s = new THREE.Shape(titik(k.l));
    for (const hl of k.h ?? []) if (hl.length >= 6) s.holes.push(new THREE.Path(titik(hl)));
    return s;
  });
}

/** bidang */
export function bangunBidang({ THREE, g, b, W }: Konteks) {
  bidangMapping(THREE, g, b, W(0xf3f4f6));
}

/** objek */
export function bangunObjek({ THREE, g, b, bahan, W }: Konteks) {
  objekMapping(THREE, g, b, W(0xe5e7eb), b.konten === 'gambar' ? bahan.layar(b) : null);
}

/** model */
export function bangunModel({ THREE, g, b, bahan }: Konteks) {
  const asli = b.modelKunci ? bahan.model(b.modelKunci) : null;
  if (asli) {
    //  Putar tegak (file Z-up) lewat pembungkus, supaya model aslinya di memori tidak ikut berubah.
    //  (Rotasi bawaan file - mis. koreksi Z-up dari ColladaLoader - tetap utuh di dalam pembungkus.)
    const salinan = new THREE.Group(), putar = new THREE.Group();
    putar.rotation.x = (-(b.putarModel ?? 0) * Math.PI) / 180;
    putar.add(asli.clone(true)); salinan.add(putar);
    //  Skala agar muat di kotak w×h×d, alas di y = 0.
    const kotakB = new THREE.Box3().setFromObject(salinan);
    const s = kotakB.getSize(new THREE.Vector3());
    const k = Math.min(b.w / Math.max(1e-3, s.x), b.h / Math.max(1e-3, s.y), b.d / Math.max(1e-3, s.z));
    salinan.scale.multiplyScalar(k);
    const k2 = new THREE.Box3().setFromObject(salinan); const c = k2.getCenter(new THREE.Vector3());
    salinan.position.sub(new THREE.Vector3(c.x, k2.min.y, c.z));
    g.add(salinan);
  } else {
    g.add(kotak(THREE, b.w, b.h, b.d, mat(THREE, 0xa855f7, { transparent: true, opacity: 0.5 }), 0, b.h / 2, 0));
  }
}
