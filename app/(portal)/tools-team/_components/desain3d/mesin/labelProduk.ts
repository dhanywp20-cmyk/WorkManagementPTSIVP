/**
 * Label produk dengan garis penunjuk (callout): titik kecil di benda, garis tipis ke label. Posisi label
 * ditata ulang di layar tiap kali kamera / adegan berubah - dicari tempat terdekat (atas, samping, bawah)
 * yang tidak menutupi benda itu sendiri, benda lain, maupun label lain. Aturan pilih tempat: inti-nya di
 * `pilihTempatLabel` (murni, diuji di uji/desain3d-label.ts).
 */
import type * as T from 'three';
import type { Mesin } from './tipe';

export interface KotakLayar { l: number; t: number; r: number; b: number }

const WARNA_GARIS = '#64748b';
/** Jarak label dari titik benda (px) yang dicoba, dari terdekat. */
const JARAK = [14, 30, 52, 80];
/** Benda yang menutupi lebih dari porsi kanvas ini (dinding LED, bidang mapping, panggung) dianggap latar. */
const PORSI_LATAR = 0.25;

const tumpang = (a: KotakLayar, b: KotakLayar) =>
  Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));

/**
 * Tempat label (pusat, relatif titik jangkar) berukuran w × h: arah pilihan dulu (-1 = di atas, 1 = di bawah),
 * jarak terdekat dulu. Biaya = tumpang dengan label lain (sangat berat) + tumpang dengan benda. null = semua
 * calon menabrak label lain (label disembunyikan sementara).
 */
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
  return terbaik ? { dx: terbaik.dx, dy: terbaik.dy } : null;
}

/** Label produk (CSS2D): wadah 0 × 0 di titik benda berisi titik, garis & pil nama. */
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
  isi.style.cssText = `position:absolute;left:0;top:${arah * 22}px;transform:translate(-50%,-50%);font:600 9.5px system-ui,sans-serif;line-height:1.25;padding:0 5px;border-radius:999px;white-space:nowrap;color:#0f172a;background:rgba(255,255,255,.92);border:1px solid #cbd5e1`;
  luar.append(svg, isi);
  const o = new m.CSS2DObject(luar); o.position.copy(pos);
  return o;
}

/** Kotak layar tiap benda yang tampil (proyeksi kotak batasnya); benda sebesar latar diabaikan. */
function kotakBenda(m: Mesin): KotakLayar[] {
  const kv = m.renderer.domElement.getBoundingClientRect();
  const box = new m.THREE.Box3(), v = new m.THREE.Vector3();
  const hasil: KotakLayar[] = [];
  for (const { obj } of m.cache.values()) {
    if (!obj.visible) continue;
    box.setFromObject(obj);
    if (box.isEmpty()) continue;
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity, belakang = false;
    for (let i = 0; i < 8 && !belakang; i++) {
      v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(m.kamera);
      if (v.z > 1) { belakang = true; break; }
      const x = kv.left + ((v.x + 1) / 2) * kv.width, y = kv.top + ((1 - v.y) / 2) * kv.height;
      l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y);
    }
    if (belakang || (r - l) * (b - t) > kv.width * kv.height * PORSI_LATAR) continue;
    hasil.push({ l, t, r, b });
  }
  return hasil;
}

let tandaLalu = '';
/** Elemen label yang sudah pernah ditata (label baru dari pembaruan adegan selalu memicu penataan). */
const tertata = new WeakSet<HTMLElement>();
/**
 * Tata semua label produk. `terpakai` = kotak label lain yang sudah tampil (penting / mengalah). Dilewati bila
 * kamera, ukuran kanvas & daftar label tidak berubah sejak penataan terakhir.
 */
export function tataLabelProduk(m: Mesin, wadah: HTMLElement, terpakai: KotakLayar[]) {
  const daftar = [...wadah.querySelectorAll<HTMLElement>('[data-produk]')].filter(el => el.style.display !== 'none');
  const kv = m.renderer.domElement;
  const tanda = `${m.kamera.matrixWorld.elements.map(x => x.toFixed(3)).join()}|${kv.clientWidth}x${kv.clientHeight}|${daftar.length}|${m.cache.size}`;
  if (tanda === tandaLalu && daftar.every(el => tertata.has(el))) return;
  tandaLalu = tanda;
  const benda = kotakBenda(m), label = [...terpakai];
  for (const el of daftar) {
    const isi = el.querySelector<HTMLElement>('[data-isi]'), garis = el.querySelector('line');
    if (!isi || !garis) continue;
    tertata.add(el);
    const a = el.getBoundingClientRect(), w = isi.offsetWidth, h = isi.offsetHeight;
    const t = pilihTempatLabel(a.left, a.top, w, h, el.dataset.arah === '1' ? 1 : -1, benda, label);
    el.style.visibility = t ? 'visible' : 'hidden';
    if (!t) continue;
    isi.style.left = `${t.dx}px`; isi.style.top = `${t.dy}px`;
    el.dataset.ox = String(t.dx); el.dataset.oy = String(t.dy);
    label.push({ l: a.left + t.dx - w / 2, r: a.left + t.dx + w / 2, t: a.top + t.dy - h / 2, b: a.top + t.dy + h / 2 });
    //  Garis dari titik benda ke tepi pil terdekat.
    const gx = Math.max(t.dx - w / 2, Math.min(0, t.dx + w / 2)), gy = Math.max(t.dy - h / 2, Math.min(0, t.dy + h / 2));
    garis.setAttribute('x2', String(gx)); garis.setAttribute('y2', String(gy));
  }
}
