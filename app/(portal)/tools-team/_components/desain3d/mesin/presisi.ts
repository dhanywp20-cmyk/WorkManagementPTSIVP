/**
 * desain3d/mesin/presisi.ts - efek presisi di kanvas: snap gizmo (geser per langkah grid, putar per sudut),
 * grid lantai saat snap aktif, dan garis penggaris + label jarak. Aturannya di inti/presisi.ts.
 */
import type * as T from 'three';
import { formatPanjang, type GarisPenggaris, jarakGrid, type Kotak, rincianGaris, type Snap, type Titik } from '../inti';
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
