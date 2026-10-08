/**
 * desain3d/mesin/bayangan.ts - Bayangan lembut display di dinding/lantai, bayangan kontak speaker & standfloor, pendar cahaya layar ke lantai.
 * Dipanggil useAdegan setiap keadaan terkait berubah; isi lama dibuang dulu oleh pemanggil / fungsi ini.
 */
import { DISPLAY, pasangDari, ruangDari, tipeSpeakerDari } from '../inti';
import type * as T from 'three';
import type { KeadaanDesain } from '../useKeadaanDesain';
import type { Mesin } from './tipe';

export type KeadaanBayangan = Pick<KeadaanDesain, 'bayangan' | 'benda' | 'kotakRuang' | 'ruang' | 'teksturBayang'>;

export function gambarBayangan(m: Mesin, k: KeadaanBayangan) {
  const { THREE, grupBayang } = m;
  const { bayangan, benda, kotakRuang, ruang, teksturBayang } = k;
  grupBayang.traverse(o => {
    const mesh = o as T.Mesh; mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    mats.forEach(mt => mt.dispose());
  });
  grupBayang.clear();
  if (!bayangan) return;
  if (!teksturBayang.current) {
    const kanvas = (gambar: (g: CanvasRenderingContext2D) => void) => {
      const c = document.createElement('canvas'); c.width = c.height = 256; gambar(c.getContext('2d')!);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    };
    teksturBayang.current = {
      //  Titik bulat gelap -> transparan. Dipakai sebagai "9-slice" (lihat bayangan9): tengah tekstur = inti
      //  gelap selebar display, setengah luarnya = tepi kabur dengan lebar tetap dalam meter.
      bayang: kanvas(g => {
        const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
        gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.35, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.7, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
      }),
      cahaya: kanvas(g => {
        const gr = g.createRadialGradient(128, 40, 4, 128, 110, 150);
        gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
      }),
    };
  }
  const { bayang, cahaya } = teksturBayang.current;
  const bidang = (w: number, h: number, mt: T.Material) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), mt);
  /** Bayangan lembut persegi: inti cw x ch gelap penuh + tepi kabur selebar `kabur` m (9 kotak, UV tepi 0..0,5..1). */
  const bayangan9 = (cw: number, ch: number, kabur: number, opasitas: number) => {
    const xs = [-cw / 2 - kabur, -cw / 2, cw / 2, cw / 2 + kabur], ys = [-ch / 2 - kabur, -ch / 2, ch / 2, ch / 2 + kabur], us = [0, 0.5, 0.5, 1];
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { pos.push(xs[i], ys[j], 0); uv.push(us[i], us[j]); }
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { const a = j * 4 + i; idx.push(a, a + 1, a + 5, a, a + 5, a + 4); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
    return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: bayang, color: 0x000000, transparent: true, opacity: opasitas, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  };
  for (const d of benda) {
    //  Speaker berdiri di lantai (portable / line array tidak digantung): bayangan kontak di lantai.
    if (d.jenis === 'speaker' && d.elev < 0.05 && (tipeSpeakerDari(d) === 'kolom' || (tipeSpeakerDari(d) === 'linearray' && !d.gantung))) {
      const o = bayangan9(d.w * 0.95, d.d * 0.9, 0.18, 0.5);
      o.rotation.set(-Math.PI / 2, 0, (d.rot * Math.PI) / 180); o.position.set(d.x, 0.003, d.z); grupBayang.add(o);
      continue;
    }
    if (!DISPLAY.includes(d.jenis)) continue;
    const k = kotakRuang[ruangDari(ruang, d.x)] ?? kotakRuang[0];
    const r = (d.rot * Math.PI) / 180, hx = Math.sin(r), hz = Math.cos(r);
    const bx = d.x - hx * d.d / 2, bz = d.z - hz * d.d / 2;     // titik punggung display
    const yTengah = d.elev + d.h / 2;
    const dindingDekat = [
      { cocok: hz > 0.9, celah: bz, pos: (dy: number) => new THREE.Vector3(d.x, yTengah - dy, 0.004), rotY: 0 },
      { cocok: hz < -0.9, celah: k.l - bz, pos: (dy: number) => new THREE.Vector3(d.x, yTengah - dy, k.l - 0.004), rotY: Math.PI },
      { cocok: hx > 0.9, celah: bx - k.x0, pos: (dy: number) => new THREE.Vector3(k.x0 + 0.004, yTengah - dy, d.z), rotY: Math.PI / 2 },
      { cocok: hx < -0.9, celah: k.x0 + k.p - bx, pos: (dy: number) => new THREE.Vector3(k.x0 + k.p - 0.004, yTengah - dy, d.z), rotY: -Math.PI / 2 },
    ].find(x => x.cocok && x.celah >= -0.05 && x.celah <= 0.35);
    const stand = pasangDari(d) === 'standfloor';
    if (dindingDekat && !stand) {
      //  Cahaya ruangan dari atas-depan: bayangan jatuh sedikit di bawah display, makin jauh dari dinding
      //  makin turun & makin kabur.
      const celah = Math.max(0, dindingDekat.celah);
      const o = bayangan9(d.w + 0.02, d.h, 0.07 + celah * 0.9, 0.62 * (1 - celah / 0.5));
      o.position.copy(dindingDekat.pos(0.045 + celah * 0.8)); o.rotation.y = dindingDekat.rotY;
      grupBayang.add(o);
    }
    if (stand || d.elev < 0.25) {
      //  Bayangan kontak di lantai di bawah stand / alas.
      const o = bayangan9(d.w * 0.9, stand ? 0.55 : Math.max(0.15, d.d), 0.22, 0.45);
      o.rotation.set(-Math.PI / 2, 0, r); o.position.set(d.x - hx * 0.03, 0.003, d.z - hz * 0.03); grupBayang.add(o);
    }
    //  Cahaya layar yang menyala (bukan layar proyektor / konten mati) jatuh ke lantai di depannya.
    if (d.jenis !== 'layar' && d.konten !== 'mati') {
      const panjang = Math.min(3.5, Math.max(1.2, d.h * 2.2)), lebar = d.w * 1.7 + 0.4;
      const g = new THREE.Group(); g.position.set(d.x, 0.004, d.z); g.rotation.y = r;
      const o = bidang(lebar, panjang, new THREE.MeshBasicMaterial({
        map: cahaya, color: 0x6fa8ff, transparent: true, opacity: 0.38, depthWrite: false, blending: THREE.AdditiveBlending,
        clippingPlanes: [
          new THREE.Plane(new THREE.Vector3(1, 0, 0), -k.x0), new THREE.Plane(new THREE.Vector3(-1, 0, 0), k.x0 + k.p),
          new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), new THREE.Plane(new THREE.Vector3(0, 0, -1), k.l),
        ],
      }));
      o.rotation.x = -Math.PI / 2; o.position.z = d.d / 2 + panjang / 2; g.add(o);
      grupBayang.add(g);
    }
  }
}
