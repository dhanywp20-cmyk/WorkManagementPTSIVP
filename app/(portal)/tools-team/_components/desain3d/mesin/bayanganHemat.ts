import type * as T from 'three';

type Lampu = T.Light & { target?: T.Object3D; angle?: number; distance?: number; shadow: T.LightShadow & { focus?: number } };
type Kam = T.Camera & { near: number; far: number; left?: number; right?: number; top?: number; bottom?: number };

export function buatPenjagaBayangan(renderer: T.WebGLRenderer, scene: T.Scene): () => void {
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  let lama: number[] = [], baru: number[] = [];
  const matriks = (m: T.Matrix4) => { for (let i = 0; i < 16; i++) baru.push(m.elements[i]); };
  const kunjungi = (o: T.Object3D) => {
    const l = o as Lampu;
    if (l.isLight) {
      if (!l.castShadow || !l.shadow) return;
      const s = l.shadow, k = s.camera as Kam;
      baru.push(-l.id, s.map ? 1 : 0, s.mapSize.x, s.mapSize.y, l.angle ?? 0, l.distance ?? 0, s.focus ?? 0, k.near, k.far, k.left ?? 0, k.right ?? 0, k.top ?? 0, k.bottom ?? 0);
      matriks(l.matrixWorld);
      if (l.target) matriks(l.target.matrixWorld);
      return;
    }
    const m = o as T.Mesh;
    if (!m.castShadow || !m.geometry || !(m.isMesh || (o as T.Line).isLine || (o as T.Points).isPoints)) return;
    const pa = m.geometry.attributes.position as (T.BufferAttribute & { data?: { version: number } }) | undefined;
    baru.push(m.id, m.geometry.id, pa ? pa.version ?? pa.data?.version ?? 0 : 0, m.geometry.drawRange.count);
    for (const mt of Array.isArray(m.material) ? m.material : [m.material]) baru.push(mt?.id ?? 0, mt?.version ?? 0, mt?.side ?? 0);
    matriks(m.matrixWorld);
  };
  return () => {
    baru.length = 0;
    baru.push(renderer.shadowMap.type, renderer.shadowMap.enabled ? 1 : 0);
    if (scene.matrixWorldAutoUpdate) scene.updateMatrixWorld();
    scene.traverseVisible(kunjungi);
    let beda = baru.length !== lama.length;
    for (let i = 0; !beda && i < baru.length; i++) beda = baru[i] !== lama[i];
    if (beda) renderer.shadowMap.needsUpdate = true;
    [lama, baru] = [baru, lama];
  };
}
