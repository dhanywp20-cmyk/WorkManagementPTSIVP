/**
 * desain3d/mesin/presisi.ts - efek presisi di kanvas: snap gizmo (geser per langkah grid, putar per sudut),
 * grid lantai saat snap aktif, garis penggaris + label jarak, dan jarak benda terpilih ke dinding. Aturannya di inti/presisi.ts.
 */
import type * as T from 'three';
import { type Benda, formatPanjang, type GarisPenggaris, jarakGrid, jarakKeDinding, type Kotak, mm, rincianGaris, type Snap, sudutTapak, type Titik } from '../inti';
import type { Mesin } from './tipe';

type GizmoSnap = { setTranslationSnap?: (v: number | null) => void; setRotationSnap?: (v: number | null) => void };

/** Gizmo: geser per langkah grid & putar per sudut snap (posisi dunia, jadi benda jatuh tepat di garis grid). */
export function aturSnapGizmo(m: Mesin, snap: Snap) {
  const g = m.gizmo as unknown as GizmoSnap;
  g.setTranslationSnap?.(snap.aktif ? snap.langkah : null);
  g.setRotationSnap?.(snap.aktif ? (snap.sudut * Math.PI) / 180 : null);
}

/** Grup milik efek ini di adegan (dibuat sekali, isinya diganti tiap pembaruan). */
function grup(m: Mesin, nama: string): T.Group {
  let g = m.scene.getObjectByName(nama) as T.Group | undefined;
  if (!g) { g = new m.THREE.Group(); g.name = nama; m.scene.add(g); }
  g.traverse(o => {
    const x = o as T.Mesh & { element?: HTMLElement };
    x.geometry?.dispose();
    (Array.isArray(x.material) ? x.material : x.material ? [x.material] : []).forEach(mt => mt.dispose());
    x.element?.remove();
  });
  g.clear();
  return g;
}

/** Grid lantai tiap ruang selama snap aktif: garis tiap langkah (direnggangkan bila terlalu rapat), garis tiap 1 m lebih tegas. */
export function gambarGridSnap(m: Mesin, kotak: Kotak[], snap: Snap) {
  const g = grup(m, 'presisi-grid');
  if (!snap.aktif) return;
  const { THREE } = m;
  for (const k of kotak) {
    const j = jarakGrid(snap.langkah, Math.max(k.p, k.l));
    const tipis: number[] = [], tegas: number[] = [];
    const garis = (arr: number[], a: [number, number], b: [number, number]) => arr.push(a[0], 0.004, a[1], b[0], 0.004, b[1]);
    const meter = (v: number) => Math.abs(v - Math.round(v)) < 1e-6;
    for (let x = 0; x <= k.p + 1e-6; x += j) garis(meter(x) ? tegas : tipis, [k.x0 + x, 0], [k.x0 + x, k.l]);
    for (let z = 0; z <= k.l + 1e-6; z += j) garis(meter(z) ? tegas : tipis, [k.x0, z], [k.x0 + k.p, z]);
    for (const [arr, warna, op] of [[tipis, 0x3b82f6, 0.28], [tegas, 0x1d4ed8, 0.55]] as const) {
      if (!arr.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      const l = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: warna, transparent: true, opacity: op, depthWrite: false }));
      l.renderOrder = 1;
      g.add(l);
    }
  }
}

/** Garis penggaris tersimpan + garis yang sedang dibuat (titik pertama), dengan label panjang & tombol hapus. */
export function gambarPenggaris(m: Mesin, daftar: GarisPenggaris[], titikAwal: Titik | null, hapus: (id: string) => void) {
  const g = grup(m, 'presisi-penggaris');
  const { THREE } = m;
  const bahanGaris = new THREE.LineBasicMaterial({ color: 0xdc2626, depthTest: false });
  const bahanTitik = new THREE.MeshBasicMaterial({ color: 0xdc2626, depthTest: false });
  const titik = (p: Titik) => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), bahanTitik);
    s.position.set(...p); s.renderOrder = 5; g.add(s);
  };
  for (const gp of daftar) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...gp.a), new THREE.Vector3(...gp.b)]);
    const l = new THREE.Line(geo, bahanGaris); l.renderOrder = 5; g.add(l);
    titik(gp.a); titik(gp.b);
    const r = rincianGaris(gp);
    const el = document.createElement('div');
    el.style.cssText = 'display:flex;align-items:center;gap:4px;padding:2px 4px 2px 7px;border-radius:7px;background:#dc2626;color:#fff;font:700 11.5px system-ui,sans-serif;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.25);pointer-events:auto';
    const teks = document.createElement('span');
    teks.textContent = formatPanjang(Math.hypot(r.datar, r.tinggi));
    //  Beda ketinggian berarti: tampilkan juga jarak datar & tinggi (mis. mata penonton ke tengah layar).
    if (r.tinggi > 0.05 && r.datar > 0.05) el.title = `Datar ${formatPanjang(r.datar)} · tinggi ${formatPanjang(r.tinggi)}`;
    const x = document.createElement('button');
    x.type = 'button'; x.textContent = '✕'; x.setAttribute('aria-label', 'Hapus garis ukur');
    x.style.cssText = 'border:0;background:rgba(255,255,255,.2);color:#fff;border-radius:5px;width:16px;height:16px;line-height:16px;font-size:10px;cursor:pointer;padding:0';
    x.addEventListener('pointerdown', e => e.stopPropagation());
    x.addEventListener('click', e => { e.stopPropagation(); hapus(gp.id); });
    el.dataset.teks = teks.textContent ?? '';
    el.append(teks, x);
    const lb = new m.CSS2DObject(el);
    lb.position.set((gp.a[0] + gp.b[0]) / 2, (gp.a[1] + gp.b[1]) / 2, (gp.a[2] + gp.b[2]) / 2);
    g.add(lb);
  }
  if (titikAwal) titik(titikAwal);
}

/**
 * Jarak otomatis benda terpilih ke keempat dinding ruangnya (dan tinggi sisi bawah dari lantai untuk benda
 * dinding / gantung), seperti garis ukur software denah. Kosong bila tidak ada benda terpilih.
 */
export function gambarJarakDinding(m: Mesin, b: Benda | null, k: Kotak | null) {
  const g = grup(m, 'presisi-jarak');
  if (!b || !k || b.jenis === 'teks') return;
  const { THREE } = m;
  const bahan = new THREE.LineDashedMaterial({ color: 0x0369a1, dashSize: 0.06, gapSize: 0.04, depthTest: false });
  const j = jarakKeDinding(b, k), s = sudutTapak(b);
  const xs = s.map(p => p[0]), zs = s.map(p => p[1]);
  const y = b.elev > 0.3 ? b.elev + b.h / 2 : 0.02;
  const garis = (a: Titik, c: Titik, panjang: number) => {
    if (panjang < 0.02) return;
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...c)]);
    const l = new THREE.Line(geo, bahan); l.computeLineDistances(); l.renderOrder = 5; g.add(l);
    const el = document.createElement('div');
    el.style.cssText = 'padding:1px 6px;border-radius:6px;background:#0369a1;color:#fff;font:700 11px system-ui,sans-serif;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.25)';
    el.textContent = el.dataset.teks = `${mm(panjang)} mm`;
    const lb = new m.CSS2DObject(el);
    lb.position.set((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2);
    g.add(lb);
  };
  garis([Math.min(...xs), y, b.z], [k.x0, y, b.z], j.kiri);
  garis([Math.max(...xs), y, b.z], [k.x0 + k.p, y, b.z], j.kanan);
  garis([b.x, y, Math.min(...zs)], [b.x, y, 0], j.depan);
  garis([b.x, y, Math.max(...zs)], [b.x, y, k.l], j.belakang);
  if (b.elev > 0.05) garis([b.x, 0, Math.max(...zs) + 0.01], [b.x, b.elev, Math.max(...zs) + 0.01], b.elev);
}
