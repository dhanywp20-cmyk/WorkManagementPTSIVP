import type * as T from 'three';

/**
 * Impor objek 3D dari luar untuk Desain 3D (mapping patung, gedung, produk). Semua dibaca di
 * peramban - tidak ada yang diunggah ke server.
 *
 *   Format  : glTF (.glb/.gltf + .bin), OBJ (+ .mtl & tekstur), FBX, COLLADA (.dae) & .kmz
 *             (ekspor bawaan SketchUp), STL, 3DS, PLY, atau satu .zip berisi salah satunya.
 *   SketchUp: berkas .skp tertutup (tidak ada pembaca untuk peramban) - pengguna diarahkan
 *             mengekspor ke .dae / .obj / .fbx / .stl dari SketchUp.
 *
 * Loader three.js dimuat dinamis hanya untuk format yang dipakai. Hasilnya dirapikan: bahan
 * jadi MeshStandardMaterial dua sisi (model SketchUp sering punya muka terbalik - tanpa ini
 * sebagian permukaan tembus & sinar proyektor tidak mengenainya).
 */

export type Satuan = 'mm' | 'cm' | 'm' | 'inci' | 'kaki';
export const FAKTOR_SATUAN: Record<Satuan, number> = { mm: 0.001, cm: 0.01, m: 1, inci: 0.0254, kaki: 0.3048 };
export const LABEL_SATUAN: Record<Satuan, string> = { mm: 'milimeter', cm: 'sentimeter', m: 'meter', inci: 'inci', kaki: 'kaki (feet)' };

type Format = 'glb' | 'gltf' | 'obj' | 'fbx' | 'dae' | 'kmz' | 'stl' | '3ds' | 'ply';
/** Urutan prioritas bila beberapa berkas model dipilih sekaligus. */
const URUT_FORMAT: Format[] = ['glb', 'gltf', 'fbx', 'dae', 'kmz', 'obj', '3ds', 'stl', 'ply'];
/** Atribut accept untuk <input type=file multiple>. */
export const TERIMA_3D = '.glb,.gltf,.bin,.obj,.mtl,.fbx,.dae,.kmz,.stl,.3ds,.ply,.zip,.skp,.jpg,.jpeg,.png,.webp,.bmp,.tga';
export const MAKS_BYTE_3D = 60 * 1024 * 1024;

/** Berkas yang satuannya pasti meter (spesifikasi format): glTF, COLLADA/KMZ (unit dibaca loader). */
const SATUAN_PASTI: Format[] = ['glb', 'gltf', 'dae', 'kmz'];
/** Format yang lazim Z-up (STL & 3DS dari SketchUp / 3ds Max / printer 3D) - otomatis ditegakkan. */
const LAZIM_Z_ATAS: Format[] = ['stl', '3ds'];

export const PANDUAN_SKP =
  'Berkas SketchUp (.skp) tidak bisa dibaca langsung di peramban. Di SketchUp: File → Export → 3D Model → pilih ' +
  'COLLADA (.dae) - paling lengkap dengan tekstur - atau OBJ / FBX / STL. SketchUp versi web (gratis): Download → STL. ' +
  'Lalu impor berkas hasil ekspor itu di sini (tekstur ikut bila dipilih bersamaan atau dalam satu .zip).';

export class GalatImpor extends Error {}

export interface HasilImpor3D {
  /** Objek siap pakai (Y-up menurut berkasnya, satuan berkas). */ obj: T.Object3D;
  nama: string; format: Format;
  /** Ukuran kotak batas dalam satuan berkas (x, y, z). */ ukuranFile: [number, number, number];
  /** Satuan awal: pasti (glTF/DAE) atau tebakan dari ukuran. */ satuan: Satuan; satuanPasti: boolean;
  /** Putar tegak awal (derajat sumbu X): 90 untuk format yang lazim Z-up. */ putar: number;
  segitiga: number; catatan: string[];
}

const ekstensi = (nama: string) => (nama.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '');
const namaDasar = (p: string) => decodeURIComponent(p).split(/[\\/]/).pop()!.toLowerCase();

/** Berkas model utama dari daftar nama (null bila tidak ada). Murni - diuji. */
export function formatUtama(nama: string[]): { indeks: number; format: Format } | null {
  for (const f of URUT_FORMAT) {
    const i = nama.findIndex(n => ekstensi(n) === f);
    if (i >= 0) return { indeks: i, format: f };
  }
  return null;
}

/**
 * Tebakan satuan dari ukuran terbesar (satuan berkas), untuk format tanpa satuan baku (OBJ/STL/FBX/3DS/PLY).
 * Objek mapping umumnya 0,3-60 m: angka ratusan hampir pasti mm, puluhan pada FBX = cm (bawaan FBX).
 * Tetap bisa diganti di panel.
 */
export function tebakSatuan(ukuranMaks: number, format: string): Satuan {
  if (ukuranMaks >= 300) return 'mm';
  if (format === 'fbx' && ukuranMaks >= 30) return 'cm';
  if (ukuranMaks >= 120) return 'cm';
  return 'm';
}

/** Ukuran nyata (m) model: ukuran berkas × satuan, ditegakkan `putar` derajat di sumbu X. Murni - diuji. */
export function ukuranModel(ukuranFile: [number, number, number], satuan: Satuan, putar = 0): { w: number; h: number; d: number } {
  const k = FAKTOR_SATUAN[satuan];
  const [x, y, z] = ukuranFile.map(v => Math.max(0, v) * k);
  const tegak = Math.abs(Math.round(putar / 90)) % 2 === 1;
  const r = (v: number) => Math.round(v * 1000) / 1000;
  return { w: r(x), h: r(tegak ? z : y), d: r(tegak ? y : z) };
}

/** Isi .zip -> berkas (folder __MACOSX & berkas tersembunyi dilewati). */
async function bukaZip(f: File): Promise<File[]> {
  const { unzipSync } = await import('three/examples/jsm/libs/fflate.module.js');
  let isi: Record<string, Uint8Array>;
  try { isi = unzipSync(new Uint8Array(await f.arrayBuffer())); } catch { throw new GalatImpor(`${f.name} bukan .zip yang sah.`); }
  return Object.entries(isi)
    .filter(([n, d]) => d.length && !/(^|\/)(__MACOSX|\.)/.test(n))
    .map(([n, d]) => new File([d], n.split('/').pop()!));
}

/** Rapikan hasil loader: bahan PBR dua sisi, normal ada, hitung segitiga. */
function rapikan(THREE: typeof T, obj: T.Object3D): number {
  let segitiga = 0;
  const jadikanPBR = (mt: T.Material): T.Material => {
    if ((mt as T.MeshStandardMaterial).isMeshStandardMaterial) { mt.side = THREE.DoubleSide; return mt; }
    const l = mt as T.MeshPhongMaterial;
    const baru = new THREE.MeshStandardMaterial({
      name: l.name, color: l.color ? l.color.clone() : new THREE.Color(0xd1d5db), map: l.map ?? null,
      transparent: l.transparent, opacity: l.opacity ?? 1, alphaTest: l.alphaTest ?? 0, vertexColors: !!l.vertexColors,
      side: THREE.DoubleSide, roughness: 0.8, metalness: 0,
    });
    mt.dispose();
    return baru;
  };
  obj.traverse(o => {
    const m = o as T.Mesh;
    if (!m.isMesh) return;
    m.material = Array.isArray(m.material) ? m.material.map(jadikanPBR) : jadikanPBR(m.material);
    if (!m.geometry.attributes.normal) m.geometry.computeVertexNormals();
    segitiga += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
  });
  return Math.round(segitiga);
}

/** Mesh dari geometri tanpa bahan (STL / PLY): abu-abu muda, warna verteks bila ada. */
function meshPolos(THREE: typeof T, geo: T.BufferGeometry, nama: string): T.Mesh {
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.8, metalness: 0, vertexColors: !!geo.attributes.color }));
  m.name = nama;
  return m;
}

/**
 * Baca berkas yang dipilih pengguna (boleh beberapa: model + .mtl/.bin + tekstur, atau satu .zip).
 * Melempar GalatImpor dengan pesan yang bisa langsung ditampilkan.
 */
export async function bacaBerkas3D(THREE: typeof T, pilihan: File[]): Promise<HasilImpor3D> {
  const total = pilihan.reduce((s, f) => s + f.size, 0);
  if (!pilihan.length) throw new GalatImpor('Tidak ada berkas dipilih.');
  if (total > MAKS_BYTE_3D) throw new GalatImpor(`Berkas terlalu besar (${(total / 1048576).toFixed(0)} MB, maks ${MAKS_BYTE_3D / 1048576} MB). Kurangi detail / ukuran tekstur sebelum ekspor.`);
  const berkas: File[] = [];
  for (const f of pilihan) berkas.push(...(ekstensi(f.name) === 'zip' ? await bukaZip(f) : [f]));
  const utama = formatUtama(berkas.map(f => f.name));
  if (!utama) {
    if (berkas.some(f => ekstensi(f.name) === 'skp')) throw new GalatImpor(PANDUAN_SKP);
    throw new GalatImpor('Tidak ada berkas model yang dikenali. Pilih .glb, .gltf, .obj, .fbx, .dae, .kmz, .stl, .3ds atau .ply (atau .zip berisi salah satunya).');
  }
  const { format } = utama, fUtama = berkas[utama.indeks];
  const nama = fUtama.name.replace(/\.[^.]+$/, '');

  //  Berkas pendamping (tekstur, .bin, .mtl) dicari dari nama dasarnya - jalur folder di dalam model diabaikan.
  const alamat = new Map<string, string>();
  for (const f of berkas) alamat.set(namaDasar(f.name), URL.createObjectURL(f));
  const manajer = new THREE.LoadingManager();
  manajer.setURLModifier(url => (/^(data|blob):/.test(url) ? url : alamat.get(namaDasar(url)) ?? url));
  const lepas = () => { for (const u of alamat.values()) URL.revokeObjectURL(u); };

  const catatan: string[] = [];
  let obj: T.Object3D;
  try {
    obj = await muat(THREE, format, fUtama, berkas, manajer, catatan);
    //  Tekstur dimuat menyusul (async) - URL berkas dilepas setelah manajer selesai atau 2 menit.
    let selesai = false;
    manajer.onLoad = () => { if (!selesai) { selesai = true; lepas(); } };
    setTimeout(() => { if (!selesai) { selesai = true; lepas(); } }, 120_000);
  } catch (e) {
    lepas();
    if (e instanceof GalatImpor) throw e;
    const pesan = e instanceof Error ? e.message : String(e);
    if (/KTX2/i.test(pesan)) throw new GalatImpor('Model memakai tekstur KTX2 yang belum didukung. Ekspor ulang dengan tekstur JPG/PNG.');
    throw new GalatImpor(`Berkas ${fUtama.name} tidak bisa dibaca (${pesan.slice(0, 140)}).`);
  }

  const segitiga = rapikan(THREE, obj);
  if (!segitiga) throw new GalatImpor('Model tidak berisi permukaan (mesh). Titik/garis saja (point cloud) tidak bisa dipakai - ekspor sebagai mesh.');
  if (segitiga > 1_500_000) catatan.push(`Model berat (${(segitiga / 1e6).toFixed(1)} juta segitiga) - kanvas bisa melambat. Kurangi detail (decimate) bila perlu.`);
  obj.updateMatrixWorld(true);
  const s = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
  const ukuranFile: [number, number, number] = [s.x, s.y, s.z];
  if (!(Math.max(...ukuranFile) > 0)) throw new GalatImpor('Ukuran model nol - berkas kosong atau rusak.');
  const satuanPasti = SATUAN_PASTI.includes(format);
  const satuan = satuanPasti ? 'm' : tebakSatuan(Math.max(...ukuranFile), format);
  if (!satuanPasti) catatan.push(`Satuan berkas ditebak ${LABEL_SATUAN[satuan]} - ganti di panel bila ukurannya tidak sesuai.`);
  return { obj, nama, format, ukuranFile, satuan, satuanPasti, putar: LAZIM_Z_ATAS.includes(format) ? 90 : 0, segitiga, catatan };
}

async function muat(THREE: typeof T, format: Format, f: File, semua: File[], manajer: T.LoadingManager, catatan: string[]): Promise<T.Object3D> {
  switch (format) {
    case 'glb': case 'gltf': {
      const [{ GLTFLoader }, { DRACOLoader }, { MeshoptDecoder }] = await Promise.all([
        import('three/examples/jsm/loaders/GLTFLoader.js'),
        import('three/examples/jsm/loaders/DRACOLoader.js'),
        import('three/examples/jsm/libs/meshopt_decoder.module.js'),
      ]);
      //  Draco & meshopt: kompresi yang lazim pada model dari Sketchfab / produsen. Decoder Draco di /public/three/draco.
      const draco = new DRACOLoader(manajer).setDecoderPath('/three/draco/').setDecoderConfig({ type: 'wasm' });
      const loader = new GLTFLoader(manajer).setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);
      const data = format === 'glb' ? await f.arrayBuffer() : await f.text();
      try {
        return await new Promise<T.Object3D>((ok, gagal) => loader.parse(data, '', g => ok(g.scene), gagal));
      } finally { draco.dispose(); }
    }
    case 'obj': {
      const [{ OBJLoader }, { MTLLoader }] = await Promise.all([
        import('three/examples/jsm/loaders/OBJLoader.js'), import('three/examples/jsm/loaders/MTLLoader.js'),
      ]);
      const loader = new OBJLoader(manajer);
      const mtl = semua.find(x => ekstensi(x.name) === 'mtl');
      if (mtl) {
        const bahan = new MTLLoader(manajer).parse(await mtl.text(), '');
        bahan.preload(); loader.setMaterials(bahan);
      } else catatan.push('Tanpa berkas .mtl - warna/tekstur asli tidak ikut (pilih .obj bersama .mtl & teksturnya, atau satu .zip).');
      return loader.parse(await f.text());
    }
    case 'fbx': {
      const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
      return new FBXLoader(manajer).parse(await f.arrayBuffer(), '');
    }
    case 'dae': {
      const { ColladaLoader } = await import('three/examples/jsm/loaders/ColladaLoader.js');
      const hasil = new ColladaLoader(manajer).parse(await f.text(), '');
      if (!hasil?.scene) throw new GalatImpor(`${f.name} bukan berkas COLLADA yang sah.`);
      return hasil.scene;
    }
    case 'kmz': {
      const { KMZLoader } = await import('three/examples/jsm/loaders/KMZLoader.js');
      const hasil = new KMZLoader(manajer).parse(await f.arrayBuffer());
      if (!hasil?.scene) throw new GalatImpor(`${f.name} tidak berisi model COLLADA.`);
      return hasil.scene;
    }
    case 'stl': {
      const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
      return meshPolos(THREE, new STLLoader(manajer).parse(await f.arrayBuffer()), f.name);
    }
    case 'ply': {
      const { PLYLoader } = await import('three/examples/jsm/loaders/PLYLoader.js');
      const geo = new PLYLoader(manajer).parse(await f.arrayBuffer());
      if (!geo.index) throw new GalatImpor('PLY ini berupa titik (point cloud) tanpa permukaan. Buat mesh dulu (mis. di MeshLab: Surface Reconstruction), lalu ekspor ulang.');
      return meshPolos(THREE, geo, f.name);
    }
    case '3ds': {
      const { TDSLoader } = await import('three/examples/jsm/loaders/TDSLoader.js');
      return new TDSLoader(manajer).parse(await f.arrayBuffer(), '');
    }
  }
}
