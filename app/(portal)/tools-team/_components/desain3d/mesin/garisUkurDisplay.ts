/**
 * desain3d/mesin/garisUkurDisplay.ts - Garis ukuran display (centang "Ukuran" + garis ukur): lebar di atas &
 * tinggi di kanan tiap display, ujung bertanda, angka dalam mm. Dipisah dari mesin/alatBantu.ts.
 */
import { DISPLAY, type Benda } from '../inti';
import type { Mesin } from './tipe';

export function gambarGarisUkurDisplay(m: Mesin, benda: Benda[]) {
  const { THREE, grupBantu, CSS2DObject } = m;
  const merah = new THREE.MeshBasicMaterial({ color: 0xdc2626 });
  for (const b of benda) {
    if (!DISPLAY.includes(b.jenis) || b.sembunyiUkur) continue;
    const grp = new THREE.Group();
    grp.position.set(b.x, b.elev, b.z); grp.rotation.y = (b.rot * Math.PI) / 180;
    const t = Math.max(0.01, Math.max(b.w, b.h) * 0.004), tanda = Math.max(0.1, Math.min(0.25, Math.max(b.w, b.h) * 0.035));
    const jarak = Math.max(0.1, Math.min(0.3, Math.max(b.w, b.h) * 0.04)) + (b.jenis === 'layar' ? 0.22 : 0);
    const zp = b.d / 2 + 0.03, yAtas = b.h + jarak, xKanan = b.w / 2 + Math.max(0.1, Math.min(0.3, Math.max(b.w, b.h) * 0.04));
    const balok = (w: number, h: number, x: number, y: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), merah); m.position.set(x, y, zp); grp.add(m); };
    balok(b.w, t, 0, yAtas); balok(t, tanda, -b.w / 2, yAtas); balok(t, tanda, b.w / 2, yAtas);
    balok(t, b.h, xKanan, b.h / 2); balok(tanda, t, xKanan, 0); balok(tanda, t, xKanan, b.h);
    const teks = (isi: string, x: number, y: number, tegak: boolean) => {
      const el = document.createElement('div');
      el.textContent = isi;
      el.style.cssText = `font:700 12px system-ui,sans-serif;color:#dc2626;background:rgba(255,255,255,.85);padding:${tegak ? '4px 1px' : '1px 4px'};border-radius:4px;white-space:nowrap${tegak ? ';writing-mode:vertical-rl' : ''}`;
      const o = new CSS2DObject(el); o.position.set(x, y, zp); grp.add(o);
    };
    teks(`${Math.round(b.w * 1000)} mm`, 0, yAtas + tanda * 0.9, false);
    teks(`${Math.round(b.h * 1000)} mm`, xKanan + tanda * 0.9, b.h / 2, true);
    grupBantu.add(grp);
  }
}
