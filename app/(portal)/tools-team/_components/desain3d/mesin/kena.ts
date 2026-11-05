import type * as T from 'three';

export function kenaPermukaan(ray: T.Raycaster, akar: T.Object3D[]): T.Intersection | undefined {
  ray.params.Line = { threshold: 0.0001 };
  ray.params.Points = { threshold: 0.0001 };
  return ray.intersectObjects(akar, true).find(h => {
    const o = h.object as T.Mesh;
    if (!o.isMesh) return false;
    for (let p: T.Object3D | null = o; p; p = p.parent) if (!p.visible || p.userData.sorot) return false;
    const daftar = Array.isArray(o.material) ? o.material : [o.material];
    const mt = (daftar[h.face?.materialIndex ?? 0] ?? daftar[0]) as (T.Material & { opacity?: number }) | undefined;
    return !!mt && mt.visible !== false && !(mt.transparent && (mt.opacity ?? 1) < 0.3);
  });
}
