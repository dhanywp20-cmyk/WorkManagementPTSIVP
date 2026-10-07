/**
 * desain3d/mesin/teksCahaya.ts - Tulisan hitam kecil yang tercetak DI CAHAYA gambar proyektor, seperti
 * simulator proyektor pabrikan: keterangan (nama, jarak lensa -> bidang, ukuran gambar, lux pusat) di
 * pojok kiri atas & lux di tiap pojok gambar. Tulisan menempel di bidang (ikut melengkung, mengecil bila
 * dilihat dari jauh) - bukan label yang melayang.
 *
 * Tiap blok tulisan = tekstur kecil (tajam, hemat memori) yang dipetakan lewat uv gambar (0..1) hanya ke
 * sel bidang gambar yang dilaluinya; di luar blok tekstur bening (uv dijepit di tepi bening).
 */
import type * as T from 'three';
import type { Mesin } from './tipe';

/** Satu blok tulisan; x, y = pojok kiri atasnya, w, h = ukurannya - pecahan lebar / tinggi gambar (y dari atas). */
export interface BlokTeks { x: number; y: number; w: number; h: number; baris: string[]; kanan?: boolean; tebalPertama?: boolean }

/** Tinggi huruf = pecahan tinggi gambar (kecil: terbaca bila kamera didekatkan, seperti tulisan sungguhan). */
export const TINGGI_HURUF = 0.032;

function tekstur(THREE: Mesin['THREE'], b: BlokTeks): T.CanvasTexture {
  const W = b.baris.length > 1 ? 1024 : 512, H = Math.max(16, Math.round((W * b.h * 9) / (b.w * 16)));
  const kv = document.createElement('canvas'); kv.width = W; kv.height = H;
  const g = kv.getContext('2d')!;
  const uk = Math.round((H * TINGGI_HURUF) / b.h), tepi = 3;
  g.textBaseline = 'top'; g.textAlign = b.kanan ? 'right' : 'left';
  g.fillStyle = 'rgba(17,17,17,0.92)';
  b.baris.forEach((t, i) => {
    g.font = `${b.tebalPertama && !i ? 700 : 500} ${uk}px system-ui, sans-serif`;
    g.fillText(t, b.kanan ? W - tepi : tepi, tepi + i * uk * 1.28);
  });
  const tx = new THREE.CanvasTexture(kv);
  tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8;
  //  uv gambar (0..1, v ke atas) -> blok ini.
  tx.repeat.set(1 / b.w, 1 / b.h);
  tx.offset.set(-b.x / b.w, -(1 - b.y - b.h) / b.h);
  return tx;
}

/**
 * Gambar blok-blok tulisan di bidang gambar satu proyektor. `pos` & `uv` = sel bidang gambar (6 titik per
 * sel, dari mesin/sinar.ts).
 */
export function gambarTeksCahaya(m: Mesin, pos: number[], uv: number[], blok: BlokTeks[]) {
  const { THREE, grupBantu } = m;
  for (const b of blok) {
    const u0 = b.x, u1 = b.x + b.w, v0 = 1 - b.y - b.h, v1 = 1 - b.y;
    const p: number[] = [], t: number[] = [];
    for (let q = 0; q < uv.length / 12; q++) {
      let uMin = 1, uMaks = 0, vMin = 1, vMaks = 0;
      for (let k = 0; k < 6; k++) {
        const uu = uv[q * 12 + k * 2], vv = uv[q * 12 + k * 2 + 1];
        uMin = Math.min(uMin, uu); uMaks = Math.max(uMaks, uu); vMin = Math.min(vMin, vv); vMaks = Math.max(vMaks, vv);
      }
      if (uMaks < u0 || uMin > u1 || vMaks < v0 || vMin > v1) continue;
      for (let k = 0; k < 18; k++) p.push(pos[q * 18 + k]);
      for (let k = 0; k < 12; k++) t.push(uv[q * 12 + k]);
    }
    if (!p.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(t, 2));
    const tulisan = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      map: tekstur(THREE, b), transparent: true, depthWrite: false, toneMapped: false,
      //  Hanya sisi depan (menghadap lensa / penonton): dari balik dinding tulisan tidak tampil terbalik.
      side: THREE.FrontSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }));
    tulisan.renderOrder = 3; grupBantu.add(tulisan);
  }
}
