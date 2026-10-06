/**
 * desain3d/bangun - model 3D prosedural (three.js) tiap jenis benda Desain 3D Ruang AV.
 *
 *   index      buatModel (pengirim per jenis) & sesuaikanTinggi
 *   dasar      primitif bersama & Konteks pembangun
 *   permukaan  tekstur bahan (kayu, kain, gril, logam berlubang)
 *   tekstur    tekstur kanvas (lantai, konten layar, isi rack, cahaya)
 *   display / audio / konferensi / furnitur / lampu / venue / mapping  - pembangun per kelompok
 *
 * THREE dioper sebagai parameter (bukan di-import) supaya three.js tidak ikut bundel halaman
 * lain - three dimuat dinamis oleh Desain3D.tsx. Model dibangun dengan alas di y = 0; bagian
 * yang menyentuh lantai / plafon diberi userData.peran dan disesuaikan sesuaikanTinggi().
 */
import type * as T from 'three';
import { type Benda, type Jenis, warnaSah } from '../inti';
import type { Bahan, Konteks } from './dasar';
import { bangunMic, bangunRak, bangunSpeaker, bangunSpeakerPlafon, bangunTouchpanel } from './audio';
import { bangunLayar, bangunLed, bangunProyektor, bangunTvIfp, bangunVideowall } from './display';
import { bangunKursi, bangunMeja } from './furnitur';
import { bangunKamera, bangunLift } from './konferensi';
import { bangunLampu } from './lampu';
import { bangunBidang, bangunModel, bangunObjek } from './mapping';
import { bangunPanggung, bangunTribun } from './venue';

export { kotak, batang } from './dasar';
export { sandaran } from './furnitur';
export { standfloor } from './display';
export { teksturDindingAksen } from './permukaan';

/** Pembangun tiap jenis benda - satu fungsi per jenis, dikelompokkan per berkas. */
const PEMBANGUN: Record<Jenis, (k: Konteks) => void> = {
  videowall: bangunVideowall,
  tv: bangunTvIfp,
  ifp: bangunTvIfp,
  led: bangunLed,
  layar: bangunLayar,
  proyektor: bangunProyektor,
  meja: bangunMeja,
  kursi: bangunKursi,
  speaker: bangunSpeaker,
  'speaker-plafon': bangunSpeakerPlafon,
  mic: bangunMic,
  touchpanel: bangunTouchpanel,
  rak: bangunRak,
  lampu: bangunLampu,
  kamera: bangunKamera,
  lift: bangunLift,
  tribun: bangunTribun,
  panggung: bangunPanggung,
  bidang: bangunBidang,
  objek: bangunObjek,
  model: bangunModel,
};

/**
 * Model satu benda. Titik asal = tengah tapak, alas di y = 0; sumbu +z = arah
 * hadap. Semua mesh memberi & menerima bayangan.
 */
export function buatModel(b: Benda, bahan: Bahan): T.Group {
  const { THREE } = bahan;
  const g = new THREE.Group();
  const muka = (w: number, h: number, z: number, y: number) => {
    const tex = bahan.layar(b);
    const m = tex
      ? new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
      : new THREE.MeshStandardMaterial({ color: 0x0b1220, roughness: 0.25, metalness: 0.4 });
    const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); o.position.set(0, y, z); return o;
  };
  //  Warna utama pilihan engineer (badan/bezel/rangka/kain/permukaan); tanpa pilihan = warna bawaan model.
  const warnaB = warnaSah(b.warna);
  const W = (bawaan: number) => (warnaB ? new THREE.Color(warnaB).getHex() : bawaan);
  const WS = (bawaan: string) => warnaB ?? bawaan;

  PEMBANGUN[b.jenis]({ THREE, g, b, bahan, muka, warnaB, W, WS });
  g.traverse(o => { if ((o as T.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}


/**
 * Terapkan ketinggian: grup di y = elev; kaki memanjang ke lantai, tiang ke
 * plafon, alas troli tetap di lantai. Murah - dipanggil tiap frame seret.
 */
export function sesuaikanTinggi(g: T.Object3D, b: Benda, plafon: number) {
  g.position.y = b.elev;
  for (const o of g.children) {
    const peran = o.userData.peran as string | undefined;
    if (!peran) continue;
    if (peran === 'lantai') { o.position.y = -b.elev; o.visible = b.elev > 0.05; continue; }
    if (peran === 'kaki') {
      //  userData.bawah = pangkal kaki di atas lantai (mis. tiang standfloor mulai dari percabangan kaki A).
      const bawah = Math.min((o.userData.bawah as number | undefined) ?? 0, b.elev + (o.userData.atas as number) - 0.05);
      const panjang = b.elev + (o.userData.atas as number) - Math.max(0, bawah);
      o.position.y = -b.elev + Math.max(0, bawah); o.scale.y = Math.max(0.001, panjang); o.visible = b.elev > 0.05 || bawah > 0;
    } else if (peran === 'tiang') {
      const panjang = plafon - b.elev - b.h;
      o.position.y = b.h; o.scale.y = Math.max(0.001, panjang); o.visible = panjang > 0.02;
    } else if (peran === 'plafon') {
      //  Pelat yang menempel di plafon (bracket proyektor).
      o.position.y = plafon - b.elev; o.visible = plafon - b.elev - b.h > 0.02;
    }
  }
}
