/** Tipe engine kanvas (Mesin) & arah kamera standar. */
import type * as T from 'three';
import type { OrbitControls as KontrolOrbit } from 'three/examples/jsm/controls/OrbitControls.js';

export type Mesin = {
  THREE: typeof T; renderer: T.WebGLRenderer; labelRenderer: { render: (s: T.Scene, c: T.Camera) => void; setSize: (w: number, h: number) => void; domElement: HTMLElement };
  scene: T.Scene; kamera: T.PerspectiveCamera;
  orbit: KontrolOrbit;
  /** Animasi kamera yang sedang berjalan (tombol arah pandang / fokus). */ terbang: Terbang | null;
  gizmo: T.Object3D & { attach: (o: T.Object3D) => void; detach: () => void; setMode: (m: 'translate' | 'rotate') => void; showX: boolean; showY: boolean; showZ: boolean; dragging: boolean; dispose: () => void; object?: T.Object3D };
  grupRuang: T.Group; grupBenda: T.Group; grupBantu: T.Group;
  /** Bayangan lembut di dinding/lantai & cahaya layar (lihat efek "Bayangan & cahaya"). */ grupBayang: T.Group;
  /** Lampu adegan - intensitasnya mengikuti tingkat cahaya ruangan (terang/redup/gelap). */ lampu: { matahari: T.DirectionalLight; langit: T.HemisphereLight };
  CSS2DObject: new (el: HTMLElement) => T.Object3D;
  GLTFExporter: new () => { parse: (o: T.Object3D, ok: (r: ArrayBuffer | object) => void, err: (e: unknown) => void, opsi: object) => void };
  GLTFLoader: new () => { parse: (data: ArrayBuffer, path: string, ok: (g: { scene: T.Group }) => void, err: (e: unknown) => void) => void };
  cache: Map<string, { obj: T.Object3D; tanda: string }>;
};

export type Sisi = 'depan' | 'belakang' | 'kiri' | 'kanan';

/** Animasi kamera: titik pusat bergeser lurus, kamera mengorbit (sferis) supaya tidak menembus ruangan. */
export type Terbang = { t0: T.Vector3; t1: T.Vector3; s0: T.Spherical; s1: T.Spherical; mulai: number; durasi: number };

export type Sudut = 'iso' | 'atas' | 'depan' | 'belakang' | 'kiri' | 'kanan';

/** Arah dari titik pusat ke kamera. "Depan" = menghadap dinding depan (tempat display), dst. */
export const ARAH_SUDUT: Record<Sudut, [number, number, number]> = {
  iso: [0.2, 0.75, 0.95], atas: [0, 1, 0.002],
  depan: [0, 0.38, 1], belakang: [0, 0.38, -1], kiri: [1, 0.38, 0], kanan: [-1, 0.38, 0],
};

/** Tampak untuk ekspor PNG & lembar cetak. */
export const TAMPAK: { arah: 'sekarang' | Sudut; judul: string }[] = [
  { arah: 'sekarang', judul: 'Perspektif (sudut sekarang)' }, { arah: 'atas', judul: 'Denah dari atas' },
  { arah: 'depan', judul: 'Tampak depan' }, { arah: 'kiri', judul: 'Tampak samping' },
];
