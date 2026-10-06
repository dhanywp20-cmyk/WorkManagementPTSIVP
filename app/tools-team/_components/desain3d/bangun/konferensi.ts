/**
 * desain3d/bangun/konferensi.ts - Kamera & konferensi: kamera PTZ / AI / soundbar, paperless display lift.
 * Model dibangun dengan alas di y = 0; ketinggian (elev) diterapkan lewat posisi grup.
 */
import { blok, type Konteks, kotak, mat, papan } from './dasar';
import { teksturKain, teksturLift } from './permukaan';

/** kamera */
export function bangunKamera({ THREE, g, b, W, WS }: Konteks) {
  const tipe = b.tipeKamera ?? 'ptz';
  const kaca = new THREE.MeshPhysicalMaterial({ color: 0x0c1730, metalness: 0.2, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05 });
  const hitamKilap = mat(THREE, 0x0a0b0d, { roughness: 0.18, metalness: 0.35 });
  /** Lensa: cincin hitam mengilap + kubah kaca, menghadap +z. */
  const lensa = (r: number, x: number, y: number, z: number) => {
    const l = new THREE.Group();
    const cincin = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.04, 0.012, 32), hitamKilap); cincin.rotation.x = Math.PI / 2; l.add(cincin);
    const kubah = new THREE.Mesh(new THREE.SphereGeometry(r * 0.78, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), kaca);
    kubah.rotation.x = Math.PI / 2; kubah.position.z = 0.004; l.add(kubah);
    l.position.set(x, y, z); return l;
  };
  if (tipe === 'xbar') {
    //  Video bar: batang berlapis kain, modul kamera hitam di tengah.
    const kain = new THREE.MeshStandardMaterial({ map: teksturKain(THREE, WS('#4a4e55'), 0.05), roughness: 0.95 });
    g.add(blok(THREE, b.w, b.h, b.d, b.h * 0.42, kain, 0.01));
    const lebarModul = Math.min(0.16, b.w * 0.2);
    g.add(blok(THREE, lebarModul, b.h * 0.5, 0.012, b.h * 0.22, hitamKilap, 0.003).translateY(b.h * 0.25).translateZ(b.d / 2 + 0.001));
    for (const [x, r] of [[-0.03, 0.0075], [0, 0.011], [0.03, 0.0075]] as const) g.add(lensa(r, x * (lebarModul / 0.16), b.h / 2, b.d / 2 + 0.008));
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.0025, 8, 6), mat(THREE, 0x22c55e, { emissive: 0x22c55e, emissiveIntensity: 1 }));
    led.position.set(lebarModul * 0.38, b.h * 0.66, b.d / 2 + 0.008); g.add(led);
  } else if (tipe === 'ptz-ai') {
    //  PTZ AI: bar sensor di bawah, lengan L, kepala kotak membulat.
    const badan = mat(THREE, W(0x25282d), { roughness: 0.4, metalness: 0.35 });
    const tAlas = b.h * 0.26, sKepala = Math.min(0.09, b.h * 0.55);
    g.add(blok(THREE, b.w, tAlas, b.d, tAlas * 0.3, badan, 0.004));
    g.add(lensa(0.009, 0, tAlas / 2, b.d / 2 + 0.002));
    for (const fx of [-0.36, -0.18, 0.18, 0.36]) {
      const titik = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.004, 10), hitamKilap);
      titik.rotation.x = Math.PI / 2; titik.position.set(fx * b.w, tAlas / 2, b.d / 2 + 0.001); g.add(titik);
    }
    g.add(blok(THREE, 0.03, Math.max(0.02, b.h - tAlas - sKepala * 0.5), 0.035, 0.012, badan, 0.004).translateX(sKepala * 0.78).translateY(tAlas));
    g.add(kotak(THREE, sKepala * 0.5, 0.024, 0.03, badan, sKepala * 0.62, b.h - sKepala * 0.5, 0));
    g.add(blok(THREE, sKepala, sKepala, sKepala * 0.95, sKepala * 0.22, badan, 0.006).translateY(b.h - sKepala).translateZ(0.005));
    g.add(lensa(sKepala * 0.32, 0, b.h - sKepala / 2, sKepala * 0.475 + 0.008));
  } else {
    //  PTZ: alas kotak (strip depan hitam), garpu, kepala membulat, lensa besar.
    const abu = mat(THREE, W(0x50555d), { metalness: 0.55, roughness: 0.36 });
    const tAlas = b.h * 0.22, yKepala = tAlas + 0.03 + b.h * 0.08;
    g.add(blok(THREE, b.w, tAlas, b.d, 0.012, abu, 0.004));
    g.add(blok(THREE, b.w * 0.9, tAlas * 0.42, 0.004, 0.004, hitamKilap, 0.0015).translateY(tAlas * 0.25).translateZ(b.d / 2 + 0.0015));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(b.w * 0.36, b.w * 0.38, 0.014, 32), abu).translateY(tAlas + 0.007));
    for (const sx of [-1, 1]) g.add(blok(THREE, b.w * 0.13, b.h * 0.56, b.d * 0.5, b.w * 0.05, abu, 0.004).translateX(sx * b.w * 0.36).translateY(tAlas + 0.01));
    g.add(blok(THREE, b.w * 0.56, b.h * 0.46, b.d * 0.82, b.w * 0.16, abu, 0.008).translateY(yKepala));
    g.add(lensa(b.w * 0.21, 0, yKepala + b.h * 0.23, b.d * 0.41 + 0.006));
  }
}

/** lift */
export function bangunLift({ THREE, g, b, W }: Konteks) {
  const hitam = mat(THREE, W(0x15171b), { metalness: 0.6, roughness: 0.32 });
  const hitamKilap = mat(THREE, 0x0a0b0d, { roughness: 0.15, metalness: 0.3 });
  g.add(papan(THREE, b.w, b.d, 0.008, 0.01, hitam, 0.002));
  const lebarMon = Math.min(0.36, b.w * 0.66), xMon = -b.w / 2 + lebarMon / 2 + 0.03;
  g.add(kotak(THREE, lebarMon + 0.01, 0.0015, 0.014, hitamKilap, xMon, 0.0085, -b.d * 0.18));
  if (b.naik !== false) {
    const tinggiMon = lebarMon * 0.6;
    const mon = new THREE.Group();
    mon.add(blok(THREE, lebarMon, tinggiMon, 0.012, 0.008, hitam, 0.003));
    const layar = new THREE.Mesh(new THREE.PlaneGeometry(lebarMon * 0.95, tinggiMon * 0.86), new THREE.MeshBasicMaterial({ map: teksturLift(THREE), toneMapped: false }));
    layar.position.set(0, tinggiMon * 0.53, 0.0065); mon.add(layar);
    mon.add(blok(THREE, lebarMon + 0.012, 0.03, 0.03, 0.01, hitam, 0.004));
    mon.position.set(xMon, 0.008, -b.d * 0.18); mon.rotation.x = -0.16; g.add(mon);
  }
  const xMic = b.w / 2 - 0.06;
  if (b.naik !== false) {
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.008, 20), hitam).translateX(xMic).translateY(0.012).translateZ(b.d * 0.15));
    const kurva = new THREE.CatmullRomCurve3([
      new THREE.Vector3(xMic, 0.012, b.d * 0.15), new THREE.Vector3(xMic, b.h * 0.6, b.d * 0.12), new THREE.Vector3(xMic, b.h * 0.88, b.d * 0.02),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(kurva, 24, 0.005, 8, false), hitam));
    const kepala = new THREE.Mesh(new THREE.SphereGeometry(0.016, 20, 14), hitamKilap);
    kepala.scale.set(1, 1.5, 1); kepala.position.set(xMic, b.h * 0.92, -b.d * 0.02); g.add(kepala);
  } else {
    //  Layar turun = mic gooseneck ikut masuk ke meja (hide); tinggal lubang/tutup rata di tempatnya.
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.0015, 24), hitamKilap).translateX(xMic).translateY(0.0085).translateZ(b.d * 0.15));
  }
}
