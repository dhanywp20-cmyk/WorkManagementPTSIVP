import type * as T from 'three';
import type { Mesin } from './tipe';

export interface BlokTeks { x: number; y: number; w: number; h: number; baris: string[]; kanan?: boolean; tebalPertama?: boolean }

export const TINGGI_HURUF = 0.018;

export function kotakTerlihat(uv: number[]): [number, number, number, number][] {
  const hasil: [number, number, number, number][] = [];
  for (let q = 0; q < uv.length / 12; q++) {
    let uMin = 1, uMaks = 0, vMin = 1, vMaks = 0;
    for (let k = 0; k < 6; k++) {
      const uu = uv[q * 12 + k * 2], vv = uv[q * 12 + k * 2 + 1];
      uMin = Math.min(uMin, uu); uMaks = Math.max(uMaks, uu); vMin = Math.min(vMin, vv); vMaks = Math.max(vMaks, vv);
    }
    hasil.push([uMin, uMaks, vMin, vMaks]);
  }
  return hasil;
}

export function blokTerlihat(b: BlokTeks, kotak: [number, number, number, number][]): boolean {
  const e = 1e-6;
  for (let i = 0; i <= 4; i++) for (let j = 0; j <= 2; j++) {
    const u = b.x + (b.w * i) / 4, v = 1 - b.y - b.h + (b.h * j) / 2;
    if (!kotak.some(([u0, u1, v0, v1]) => u >= u0 - e && u <= u1 + e && v >= v0 - e && v <= v1 + e)) return false;
  }
  return true;
}

export function geserKeTerlihat(b: BlokTeks, kotak: [number, number, number, number][], arahX: 1 | -1, arahY: 1 | -1): BlokTeks | null {
  const LANGKAH = 0.02;
  for (let n = 0; n <= 30; n++) {
    for (let a = 0; a <= n; a++) {
      const c = { ...b, x: b.x + arahX * a * LANGKAH, y: b.y + arahY * (n - a) * LANGKAH };
      if (c.x < 0 || c.y < 0 || c.x + c.w > 1 || c.y + c.h > 1) continue;
      if (blokTerlihat(c, kotak)) return c;
    }
  }
  return null;
}

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
  tx.repeat.set(1 / b.w, 1 / b.h);
  tx.offset.set(-b.x / b.w, -(1 - b.y - b.h) / b.h);
  return tx;
}

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
      side: THREE.FrontSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }));
    tulisan.renderOrder = 3; grupBantu.add(tulisan);
  }
}

export function gambarGridCahaya(m: Mesin, pos: number[], uv: number[], warna: T.Color, kolom = 16, baris = 9) {
  const { THREE, grupBantu } = m;
  if (!pos.length) return;
  const W = 1024, H = 576;
  const kv = document.createElement('canvas'); kv.width = W; kv.height = H;
  const g = kv.getContext('2d')!;
  g.strokeStyle = `#${warna.getHexString()}`; g.lineCap = 'round';
  g.globalAlpha = 0.85; g.lineWidth = 2;
  g.beginPath();
  for (let i = 1; i < kolom; i++) { const x = (i / kolom) * W; g.moveTo(x, 0); g.lineTo(x, H); }
  for (let j = 1; j < baris; j++) { const y = (j / baris) * H; g.moveTo(0, y); g.lineTo(W, y); }
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
    map: tx, transparent: true, depthWrite: false, toneMapped: false, side: THREE.FrontSide,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  }));
  pola.renderOrder = 3; grupBantu.add(pola);
}
