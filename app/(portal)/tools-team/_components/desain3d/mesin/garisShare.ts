/**
 * desain3d/mesin/garisShare.ts - Share layar NIRKABEL di kanvas: garis putus-putus melengkung dari
 * dongle WyreStorm / laptop + dongle / HP / tablet ke display, LED, layar atau proyektor tujuannya,
 * cincin kecil di sumber & tujuan, dan ikon 📶 di puncak busur (keterangan hanya di tooltip).
 * Jalur & busur dihitung di inti/perangkat.ts (jalurShare).
 */
import { type Benda, jalurShare, titikTujuan } from '../inti';
import type { Mesin } from './tipe';

const WARNA = 0x0891b2;

export function gambarShare(m: Mesin, benda: Benda[]) {
  const { THREE, grupBantu, CSS2DObject } = m;
  const garis = new THREE.LineDashedMaterial({ color: WARNA, dashSize: 0.08, gapSize: 0.05, depthTest: false, transparent: true, opacity: 0.95 });
  const cincin = new THREE.MeshBasicMaterial({ color: WARNA, transparent: true, opacity: 0.85, depthTest: false, side: THREE.DoubleSide });
  for (const j of jalurShare(benda)) {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(j.titik.map(t => new THREE.Vector3(...t))), garis);
    l.computeLineDistances(); l.renderOrder = 3; grupBantu.add(l);
    //  Cincin "sinyal" mendatar di atas sumber & tegak di depan tujuan.
    const s = new THREE.Mesh(new THREE.RingGeometry(0.035, 0.045, 32), cincin);
    s.rotation.x = -Math.PI / 2; s.position.set(...j.titik[0]); s.renderOrder = 3; grupBantu.add(s);
    const t = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.075, 32), cincin);
    t.position.set(...titikTujuan(j.ke)); t.rotation.y = (j.ke.rot * Math.PI) / 180; t.renderOrder = 3; grupBantu.add(t);
    //  Ikon di puncak busur; nama sumber -> tujuan hanya muncul saat kursor di atasnya.
    const el = document.createElement('div');
    el.textContent = '📶';
    el.title = `${j.dari.nama} → ${j.ke.nama} (share nirkabel)`;
    el.style.cssText = 'font-size:14px;line-height:1;padding:3px;border-radius:999px;background:#fff;border:1.5px solid #0891b2;box-shadow:0 1px 3px rgba(0,0,0,.25);cursor:help;pointer-events:auto';
    const o = new CSS2DObject(el); o.position.set(...j.titik[Math.floor(j.titik.length / 2)]); grupBantu.add(o);
  }
}
