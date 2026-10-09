/**
 * desain3d/mesin/teksCahaya.ts - Tulisan & pola grid yang tercetak DI CAHAYA gambar proyektor, seperti
 * simulator proyektor pabrikan: keterangan (nama, jarak lensa -> bidang, ukuran gambar, lux pusat) di
 * pojok kiri atas & lux di tiap pojok gambar. Tulisan menempel di bidang (ikut melengkung, mengecil bila
 * dilihat dari jauh) - bukan label yang melayang. Mode grid: pola garis 16 x 9 + bingkai, diagonal & lingkaran
 * pusat (test pattern) di seluruh gambar - bentuk gambar & sambungan antar proyektor langsung terlihat.
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

/**
 * Pola grid di seluruh gambar satu proyektor (uv 0..1): 16 x 9 kotak sama sisi untuk gambar 16:9, bingkai
 * tebal, dua diagonal & lingkaran pusat - warna proyektor itu. Campuran biasa (bukan aditif) supaya garis
 * tetap terlihat di permukaan putih. Tampil dari dua sisi (pola tanpa tulisan, tidak terbaca terbalik).
 */
export function gambarGridCahaya(m: Mesin, pos: number[], uv: number[], warna: T.Color) {
  const { THREE, grupBantu } = m;
  if (!pos.length) return;
  const W = 1024, H = 576;
  const kv = document.createElement('canvas'); kv.width = W; kv.height = H;
  const g = kv.getContext('2d')!;
  g.strokeStyle = `#${warna.getHexString()}`; g.lineCap = 'round';
  g.globalAlpha = 0.85; g.lineWidth = 2;
  g.beginPath();
  for (let i = 1; i < 16; i++) { const x = (i / 16) * W; g.moveTo(x, 0); g.lineTo(x, H); }
  for (let j = 1; j < 9; j++) { const y = (j / 9) * H; g.moveTo(0, y); g.lineTo(W, y); }
  g.moveTo(0, 0); g.lineTo(W, H); g.moveTo(W, 0); g.lineTo(0, H);
  g.stroke();
  g.globalAlpha = 1; g.lineWidth = 6;
  g.strokeRect(3, 3, W - 6, H - 6);
  g.lineWidth = 3;
  g.beginPath(); g.arc(W / 2, H / 2, H * 0.12, 0, Math.PI * 2); g.stroke();
  const tx = new THREE.CanvasTexture(kv);
  tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const pola = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    map: tx, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  }));
  pola.renderOrder = 3; grupBantu.add(pola);
}
