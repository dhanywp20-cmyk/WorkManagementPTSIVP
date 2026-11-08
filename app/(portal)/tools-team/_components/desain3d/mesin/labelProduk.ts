import type * as T from 'three';
import type { Mesin } from './tipe';

export interface KotakLayar { l: number; t: number; r: number; b: number }

const WARNA_GARIS = '#64748b';
const JARAK = [3, 10, 18];

const tumpang = (a: KotakLayar, b: KotakLayar) =>
  Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));

export function pilihTempatLabel(ax: number, ay: number, w: number, h: number, arah: -1 | 1, benda: KotakLayar[], label: KotakLayar[]): { dx: number; dy: number } | null {
  const v = arah;
  const arahCoba: [number, number][] = [[0, v], [1, v], [-1, v], [1, 0], [-1, 0], [1, -v], [-1, -v], [0, -v]];
  let terbaik: { dx: number; dy: number; biaya: number } | null = null;
  for (const j of JARAK) for (const [ux, uy] of arahCoba) {
    const miring = ux && uy ? 0.75 : 1;
    const dx = ux * (j * miring + w / 2), dy = uy * (j * miring + h / 2);
    const k = { l: ax + dx - w / 2, r: ax + dx + w / 2, t: ay + dy - h / 2, b: ay + dy + h / 2 };
    const kenaLabel = label.reduce((s, x) => s + tumpang(k, x), 0);
    const biaya = kenaLabel * 50 + benda.reduce((s, x) => s + tumpang(k, x), 0) + j * 0.5;
    if (kenaLabel === 0 && biaya === j * 0.5) return { dx, dy };
    if (kenaLabel === 0 && (!terbaik || biaya < terbaik.biaya)) terbaik = { dx, dy, biaya };
  }
  for (const x of benda) {
    if (ax < x.l || ax > x.r || ay < x.t || ay > x.b) continue;
    for (const [dx, dy] of [[0, x.t - ay - h / 2 - 3], [0, x.b - ay + h / 2 + 3], [x.l - ax - w / 2 - 3, 0], [x.r - ax + w / 2 + 3, 0]]) {
      const k = { l: ax + dx - w / 2, r: ax + dx + w / 2, t: ay + dy - h / 2, b: ay + dy + h / 2 };
      if (label.some(y => tumpang(k, y) > 0)) continue;
      const biaya = benda.reduce((s, y) => s + tumpang(k, y), 0) + Math.hypot(dx, dy) * 0.5;
      if (!terbaik || biaya < terbaik.biaya) terbaik = { dx, dy, biaya };
    }
  }
  return terbaik ? { dx: terbaik.dx, dy: terbaik.dy } : null;
}

export function buatLabelProduk(m: Mesin, teks: string, pos: T.Vector3, arah: -1 | 1): T.Object3D {
  const luar = document.createElement('div');
  luar.dataset.produk = '1'; luar.dataset.arah = String(arah);
  luar.style.cssText = 'width:0;height:0;pointer-events:none';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '1'); svg.setAttribute('height', '1');
  svg.style.cssText = 'position:absolute;left:0;top:0;overflow:visible';
  svg.innerHTML = `<line x1="0" y1="0" x2="0" y2="0" stroke="${WARNA_GARIS}" stroke-width="1"/><circle cx="0" cy="0" r="1.8" fill="${WARNA_GARIS}"/>`;
  const isi = document.createElement('div');
  isi.dataset.isi = '1'; isi.textContent = teks;
  isi.style.cssText = `position:absolute;left:0;top:${arah * 10}px;transform:translate(-50%,-50%);font:600 9.5px system-ui,sans-serif;line-height:1.25;padding:0 5px;border-radius:999px;white-space:nowrap;color:#0f172a;background:rgba(255,255,255,.92);border:1px solid #cbd5e1`;
  luar.append(svg, isi);
  const o = new m.CSS2DObject(luar); o.position.copy(pos);
  return o;
}

let tandaLalu = '';
const tertata = new WeakSet<HTMLElement>();
export function tataLabelProduk(m: Mesin, wadah: HTMLElement, terpakai: KotakLayar[]) {
  const daftar = [...wadah.querySelectorAll<HTMLElement>('[data-produk]')].filter(el => el.style.display !== 'none');
  const kv = m.renderer.domElement;
  const kanvas = kv.getBoundingClientRect();
  const v = new m.THREE.Vector3();
  const penghalang = (m.penghalangLabel ?? []).map((sudut): KotakLayar => {
    const xs: number[] = [], ys: number[] = [];
    for (const p of sudut) { v.copy(p).project(m.kamera); xs.push(kanvas.left + ((v.x + 1) / 2) * kanvas.width); ys.push(kanvas.top + ((1 - v.y) / 2) * kanvas.height); }
    return { l: Math.min(...xs), r: Math.max(...xs), t: Math.min(...ys), b: Math.max(...ys) };
  });
  const tanda = `${m.kamera.matrixWorld.elements.map(x => x.toFixed(3)).join()}|${kv.clientWidth}x${kv.clientHeight}|${daftar.length}|${m.cache.size}|${penghalang.map(p => Math.round(p.l + p.t)).join()}`;
  if (tanda === tandaLalu && daftar.every(el => tertata.has(el))) return;
  tandaLalu = tanda;
  const label = [...terpakai];
  for (const el of daftar) {
    const isi = el.querySelector<HTMLElement>('[data-isi]'), garis = el.querySelector('line');
    if (!isi || !garis) continue;
    tertata.add(el);
    const a = el.getBoundingClientRect(), w = isi.offsetWidth, h = isi.offsetHeight;
    const t = pilihTempatLabel(a.left, a.top, w, h, el.dataset.arah === '1' ? 1 : -1, penghalang, label);
    el.style.visibility = t ? 'visible' : 'hidden';
    if (!t) continue;
    isi.style.left = `${t.dx}px`; isi.style.top = `${t.dy}px`;
    el.dataset.ox = String(t.dx); el.dataset.oy = String(t.dy);
    label.push({ l: a.left + t.dx - w / 2, r: a.left + t.dx + w / 2, t: a.top + t.dy - h / 2, b: a.top + t.dy + h / 2 });
    const gx = Math.max(t.dx - w / 2, Math.min(0, t.dx + w / 2)), gy = Math.max(t.dy - h / 2, Math.min(0, t.dy + h / 2));
    garis.setAttribute('x2', String(gx)); garis.setAttribute('y2', String(gy));
  }
}
