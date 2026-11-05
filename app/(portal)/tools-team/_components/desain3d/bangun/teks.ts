import type * as T from 'three';
import { barisTeks, tinggiHurufSah, warnaSah } from '../inti';
import type { Konteks } from './dasar';

const PX_HURUF = 96;
const MAKS_PX = 2048;

function gambarTeks(b: Konteks['b'], w: number, h: number): HTMLCanvasElement {
  const t = tinggiHurufSah(b.tinggiHuruf);
  const skala = Math.min(PX_HURUF / t, MAKS_PX / Math.max(w, h));
  const px = t * skala;
  const cv = document.createElement('canvas');
  cv.width = Math.max(8, Math.round(w * skala)); cv.height = Math.max(8, Math.round(h * skala));
  const c = cv.getContext('2d');
  if (!c) return cv;
  const latar = warnaSah(b.latarTeks);
  if (latar) {
    const r = px * 0.3;
    c.fillStyle = latar;
    c.beginPath();
    c.roundRect(0, 0, cv.width, cv.height, r);
    c.fill();
  }
  c.fillStyle = warnaSah(b.warna) ?? '#0f172a';
  c.font = `700 ${px}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  const tepi = px * 0.35, spasi = px * 1.25;
  barisTeks(b.teks).forEach((s, i) => c.fillText(s, cv.width / 2, tepi + px / 2 + i * spasi, cv.width - tepi));
  return cv;
}

export function bangunTeks({ THREE, g, b }: Konteks) {
  const lantai = b.hadapTeks === 'lantai';
  const w = Math.max(0.02, b.w), h = Math.max(0.02, lantai ? b.d : b.h);
  const tex = new THREE.CanvasTexture(gambarTeks(b, w, h));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const m = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, side: THREE.DoubleSide, toneMapped: false, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const o: T.Mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  o.renderOrder = 2;
  o.userData.tanpaBayangan = true;
  const raycastAsli = o.raycast.bind(o);
  o.raycast = (rc, hasil) => { if (rc.camera) raycastAsli(rc, hasil); };
  if (lantai) {
    o.rotation.x = -Math.PI / 2; o.position.y = 0.003;
  } else if (b.hadapTeks === 'kamera') {
    o.position.y = h / 2;
    const qInduk = new THREE.Quaternion();
    o.onBeforeRender = (_r, _s, kamera) => {
      const induk = o.parent;
      if (!induk) return;
      induk.getWorldQuaternion(qInduk);
      o.quaternion.copy(qInduk.invert().multiply(kamera.quaternion));
      o.updateMatrix();
      o.matrixWorld.multiplyMatrices(induk.matrixWorld, o.matrix);
    };
  } else {
    o.position.set(0, h / 2, b.d / 2);
  }
  g.add(o);
}
