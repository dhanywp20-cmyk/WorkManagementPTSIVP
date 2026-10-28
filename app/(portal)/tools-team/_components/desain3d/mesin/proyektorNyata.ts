/**
 * desain3d/mesin/proyektorNyata.ts - Proyektor sebagai LAMPU SUNGGUHAN (centang "Sinar nyata"), bukan lapisan warna:
 *
 *   - three.js SpotLight dari PUNCAK kerucut sinar (inti/blending.ts lensaDari, termasuk koreksi jarak b), frustum
 *     OFF-AXIS persis bingkai gambar (throw ratio, rasio panel, lens shift H/V) - keystone & lengkung layar muncul
 *     sendiri karena cahaya diproyeksikan, bukan digambar per permukaan.
 *   - Gambar yang diproyeksikan (light.map): konten proyektor (pola uji, putih penuh, dashboard, gambar unggahan)
 *     x profil keseragaman lensa x ramp edge blending (media server) x mask ke bidang.
 *   - Intensitas dari LUMEN (candela = lumen / (w1 x h1)), turun 1/jarak² & cos sudut datang, dipantulkan sesuai warna
 *     & bahan permukaan (dinding gelap redup, layar putih terang), bayangan benda dari shadow map.
 *   - Skala ke adegan: terang cahaya ruangan yang DIRENDER pada arah permukaan sasaran (diukur langsung, lihat
 *     ambienAdegan) disetarakan dengan lux ruangan yang dihitung (kontrasProyektor) - jadi perbandingan terang gambar
 *     vs ruangan yang terlihat = kontras yang tertulis di panel. Proyektor 2.000 lm di ruang terang tampak pudar;
 *     20.000 lm di ruang gelap tampak pekat. Satu skala (rata-rata) untuk SEMUA proyektor: proyektor identik pada
 *     jarak identik = gambar sama terang di dinding mana pun, area blending tanpa sambungan.
 *
 * Cahaya di luar bingkai gambar dimatikan lewat patch shader (pasangPatchProyektor) - bawaan three.js membiarkan
 * kerucut bundar menyala di luar peta.
 */
import type * as T from 'three';
import { teksturKonten } from '../bangun/konten';
import { teksturPolaUji } from '../bangun/tekstur';
import { type Benda, koreksiJarakDari, kotakGrid, type Lensa, lumenDari, rasioGambarProyektor } from '../inti';
import type { Mesin } from './tipe';

/** Gambar konten per kunci (pola uji / dashboard dibuat sekali, bukan tiap gambar ulang). */
const cacheKonten = new Map<string, CanvasImageSource>();

/**
 * Konten yang diproyeksikan proyektor: grid uji (centang Grid sinar, garis putih di atas hitam seperti pola grid
 * internal proyektor), pola uji, putih penuh, dashboard / CCTV / home screen, atau gambar unggahan. null = putih.
 * `mati` = proyektor tidak menyala (intensitas 0).
 */
export function kontenProyektor(THREE: typeof T, p: Benda, grid: boolean, lebarM: number, tinggiM: number,
  gambar: Map<string, T.Texture>): { sumber: CanvasImageSource | null; kunci: string; mati: boolean } {
  const rasio = 1 / rasioGambarProyektor(p), konten = p.konten ?? 'pola';
  if (konten === 'mati') return { sumber: null, kunci: 'mati', mati: true };
  if (grid) {
    const kg = kotakGrid(lebarM, tinggiM, p.gridKolom);
    const kunci = `grid|${kg.kolom}|${kg.baris}|${rasio.toFixed(3)}`;
    let c = cacheKonten.get(kunci) as HTMLCanvasElement | undefined;
    if (!c) {
      c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 / rasio);
      const g = c.getContext('2d')!, W = c.width, H = c.height;
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.strokeStyle = '#fff'; g.lineWidth = 2;
      g.beginPath();
      for (let i = 1; i < kg.kolom; i++) { const x = (i / kg.kolom) * W; g.moveTo(x, 0); g.lineTo(x, H); }
      for (let j = 1; j < kg.baris; j++) { const y = (j / kg.baris) * H; g.moveTo(0, y); g.lineTo(W, y); }
      g.moveTo(0, 0); g.lineTo(W, H); g.moveTo(W, 0); g.lineTo(0, H); g.stroke();
      g.lineWidth = 6; g.strokeRect(3, 3, W - 6, H - 6);
      g.lineWidth = 3; g.beginPath(); g.arc(W / 2, H / 2, H * 0.12, 0, Math.PI * 2); g.stroke();
      cacheKonten.set(kunci, c);
    }
    return { sumber: c, kunci, mati: false };
  }
  if (konten === 'gambar') {
    const tex = gambar.get(p.id);
    return { sumber: (tex?.image as CanvasImageSource | undefined) ?? null, kunci: `gambar|${tex?.uuid ?? '-'}`, mati: false };
  }
  if (konten === 'putih') return { sumber: null, kunci: 'putih', mati: false };
  const kunci = `${konten}|${p.nama}|${rasio.toFixed(3)}`;
  let sumber = cacheKonten.get(kunci);
  if (!sumber) {
    const tex = konten === 'pola' ? teksturPolaUji(THREE, p.nama, rasio) : teksturKonten(THREE, { ...p, w: rasio, h: 1 });
    sumber = tex.image as CanvasImageSource;
    cacheKonten.set(kunci, sumber);
  }
  return { sumber, kunci, mati: false };
}

/**
 * Lampu adegan (matahari, langit, peta lingkungan) per tingkat cahaya ruangan f (terang 1, redup 0,45, gelap 0,12),
 * sebelum adaptasi eksposur.
 */
export const lampuRuang = (f: number) => ({ matahari: 1.6 * f, langit: 0.35 * f, lingkungan: Math.max(0.1, f) });
interface Adaptasi { f: number; k: number }
const adaptasi = new WeakMap<object, Adaptasi>();
const adaptasiDari = (m: Mesin): Adaptasi => adaptasi.get(m) ?? { f: 1, k: 1 };
/**
 * Pasang lampu adegan = dasar tingkat cahaya ruangan (f) x k. k selalu 1 sejak Sinar nyata tidak lagi meredupkan
 * ruangan saat gambar proyektor terang (lihat TAMBAHAN_MAKS) - tetap ada supaya pemanggil lama tidak berubah.
 * Adaptasi dilakukan pada LAMPU, bukan toneMappingExposure, supaya garis ukur, label & layar display (bahan tanpa
 * cahaya) tidak ikut menggelap.
 */
export function aturCahayaRuang(m: Mesin, ubah: Partial<Adaptasi>) {
  const a = { ...adaptasiDari(m), ...ubah }; adaptasi.set(m, a);
  const d = lampuRuang(a.f);
  m.lampu.matahari.intensity = d.matahari * a.k; m.lampu.langit.intensity = d.langit * a.k;
  (m.scene as T.Scene & { environmentIntensity: number }).environmentIntensity = d.lingkungan * a.k;
}

/**
 * Iradiansi cahaya ruangan yang DIRENDER pada permukaan bernormal `n` (lampu matahari + langit + peta lingkungan
 * adegan), dalam satuan yang sama dengan lampu three.js - diukur, bukan ditebak: adegan kalibrasi berisi lampu &
 * peta lingkungan yang sama persis (tanpa benda penghalang), bidang putih matte dirender tanpa tone mapping sekali
 * tanpa & sekali dengan lampu uji 1 cd pada 1 m -> A = terang tanpa / selisih. Peta lingkungan ruangan tidak sama
 * terang ke semua arah (dinding depan +-5,5, belakang +-2,0, lantai +-6,8), jadi diukur & disimpan per arah.
 * Selalu diukur dengan lampu DASAR (tanpa adaptasi eksposur).
 */
interface Kalibrasi {
  scene: T.Scene; rt: T.WebGLRenderTarget; kam: T.PerspectiveCamera; bidang: T.Mesh;
  mat: T.DirectionalLight; langit: T.HemisphereLight; uji: T.SpotLight; cache: Map<string, number>;
}
const kalibrasi = new WeakMap<object, Kalibrasi>();
export function ambienAdegan(m: Mesin, n: T.Vector3): number {
  const { THREE, renderer } = m;
  let k = kalibrasi.get(m);
  if (!k) {
    const scene = new THREE.Scene();
    const float = renderer.extensions.has('EXT_color_buffer_float');
    const rt = new THREE.WebGLRenderTarget(8, 8, { type: float ? THREE.FloatType : THREE.HalfFloatType });
    const kam = new THREE.PerspectiveCamera(6, 1, 0.05, 10);
    const bidang = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 }));
    const mat = new THREE.DirectionalLight(0xffffff, 1), langit = new THREE.HemisphereLight(0xffffff, 0x94a3b8, 1);
    const uji = new THREE.SpotLight(0xffffff, 0, 0, 0.6, 0, 2);
    scene.add(bidang, mat, mat.target, langit, uji, uji.target);
    k = { scene, rt, kam, bidang, mat, langit, uji, cache: new Map() };
    kalibrasi.set(m, k);
  }
  const kk = k;
  const sk = kk.scene as T.Scene & { environmentIntensity?: number };
  const L = m.lampu, nn = n.clone().normalize(), dasar = lampuRuang(adaptasiDari(m).f);
  const kunci = [nn.x, nn.y, nn.z].map(v => Math.round(v * 40)).join(',') + `|${dasar.matahari}`;
  const ada = kk.cache.get(kunci);
  if (ada !== undefined) return ada;
  //  Samakan lampu & lingkungan dengan adegan utama (arah matahari, intensitas sesuai tingkat cahaya ruangan).
  kk.mat.intensity = dasar.matahari; kk.mat.color.copy(L.matahari.color);
  kk.mat.position.copy(L.matahari.position).sub(L.matahari.target.position); kk.mat.target.position.set(0, 0, 0);
  kk.langit.intensity = dasar.langit; kk.langit.color.copy(L.langit.color); kk.langit.groundColor.copy(L.langit.groundColor);
  sk.environment = m.scene.environment; sk.environmentIntensity = dasar.lingkungan;
  const atas = Math.abs(nn.y) > 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
  kk.bidang.up.copy(atas); kk.bidang.position.set(0, 0, 0); kk.bidang.lookAt(nn);
  kk.kam.up.copy(atas); kk.kam.position.copy(nn); kk.kam.lookAt(0, 0, 0);
  kk.uji.position.copy(nn); kk.uji.target.position.set(0, 0, 0);
  kk.scene.updateMatrixWorld(true);
  const baca = () => {
    const tm = renderer.toneMapping, rtLama = renderer.getRenderTarget();
    renderer.toneMapping = THREE.NoToneMapping; renderer.setRenderTarget(kk.rt); renderer.render(kk.scene, kk.kam);
    let v: number;
    if (kk.rt.texture.type === THREE.FloatType) { const px = new Float32Array(4); renderer.readRenderTargetPixels(kk.rt, 4, 4, 1, 1, px); v = px[0]; }
    else { const px = new Uint16Array(4); renderer.readRenderTargetPixels(kk.rt, 4, 4, 1, 1, px); v = THREE.DataUtils.fromHalfFloat(px[0]); }
    renderer.setRenderTarget(rtLama); renderer.toneMapping = tm;
    return v;
  };
  kk.uji.intensity = 0; const tanpa = baca();
  kk.uji.intensity = 1; const dengan = baca();
  kk.uji.intensity = 0;
  const A = dengan - tanpa > 1e-6 ? tanpa / (dengan - tanpa) : 1;
  kk.cache.set(kunci, A);
  return A;
}
/** Keseragaman ANSI proyektor (pojok / pusat) - spesifikasi umum proyektor instalasi ±85%. */
export const KESERAGAMAN = 0.85;
/**
 * Tambahan terang dari proyektor di atas cahaya ruangan (luminance putih = iradiansi / pi, nilai linear adegan)
 * digulung halus menuju TAMBAHAN_MAKS: hampir linear saat redup, tidak pernah melewati batas - supaya gambar yang
 * sangat terang di ruang gelap tidak jadi putih rata & warna konten tetap terbaca.
 *
 * Cahaya ruangan TIDAK PERNAH disentuh. Riwayat:
 *   - dulu seluruh cahaya adegan diturunkan sebanding sampai putih gambar = 1,3: memasang / mendekatkan proyektor
 *     membuat SELURUH RUANGAN menggelap (diukur 6x) & pengaturan "Cahaya ruangan" seperti tidak berfungsi;
 *   - lalu batasnya dipasang pada TOTAL (ruangan + gambar) = 1,5: di ruang terang cahaya ruangannya sendiri sudah
 *     mendekati 1,5, jatah proyektor habis, lampu proyektor = 0 & gambarnya hilang.
 * Sekarang yang dibatasi hanya tambahan dari proyektor - ruangan tetap, gambar selalu tampil, makin terang saat
 * proyektor mendekat & makin redup saat menjauh (lux = lumen / luas, seperti kalkulator pabrikan).
 */
const TAMBAHAN_MAKS = 1.2;
/** Gulung tambahan terang proyektor q (>= 0): ~q saat kecil, mendekati TAMBAHAN_MAKS tanpa pernah melewatinya. */
export function gulungTerang(q: number): number {
  return q <= 0 ? 0 : TAMBAHAN_MAKS * (1 - Math.exp(-q / TAMBAHAN_MAKS));
}
/** Resolusi peta gambar proyektor (lebar piksel). */
const LEBAR_PETA = 768;

export interface MasukanLampu {
  p: Benda; L: Lensa;
  /** Lux cahaya ruangan di bidang sasaran (nyata, dari lampu / preset / jendela). */ luxAmbien: number;
  /** Lux gambar proyektor di pusat bidang sasaran (lumen / luas). */ luxGambar: number;
  /** Normal permukaan sasaran di pusat gambar (menghadap lensa). */ normal: T.Vector3 | null;
  /** Gambar konten (kanvas / gambar unggahan) & kuncinya (berubah = peta dibuat ulang). */ konten: CanvasImageSource | null; kunciKonten: string;
  /** Lebar area blending tiap sisi (pecahan gambar) - ramp edge blending media server. */ blend: { kiri: number; kanan: number; atas: number; bawah: number };
  /** Mask ke bidang: segitiga uv (0..1) bagian gambar yang mengenai layar / bidang; null = tanpa mask. */ maskUv: number[] | null;
  /** Proyektor dimatikan (konten "Mati"). */ mati?: boolean;
}

/** Peta tekstur bahan yang dibaca shader fragmen (masing-masing memakai satu unit tekstur GPU). */
const PETA_BAHAN = ['map', 'alphaMap', 'aoMap', 'bumpMap', 'normalMap', 'emissiveMap', 'lightMap', 'roughnessMap', 'metalnessMap',
  'clearcoatMap', 'clearcoatNormalMap', 'clearcoatRoughnessMap', 'sheenColorMap', 'sheenRoughnessMap', 'specularIntensityMap',
  'specularColorMap', 'transmissionMap', 'thicknessMap', 'iridescenceMap', 'iridescenceThicknessMap', 'anisotropyMap'];
/**
 * Jumlah proyektor maksimal yang bisa jadi lampu sungguhan di GPU ini: unit tekstur shader (umumnya 16) dikurangi
 * bahan bercahaya paling berat di adegan (peta-petanya + peta lingkungan + bayangan matahari + 1 cadangan). Lebih
 * dari ini shader gagal dikompilasi (benda hitam / hilang), jadi Sinar nyata kembali ke penanda warna.
 */
export function batasProyektorNyata(m: Mesin): number {
  let berat = 0;
  m.scene.traverse(o => {
    const bahan = (o as T.Mesh).material;
    if (!bahan) return;
    for (const b of Array.isArray(bahan) ? bahan : [bahan]) {
      const x = b as T.Material & Record<string, unknown>;
      if (!(x.isMeshStandardMaterial || x.isMeshLambertMaterial || x.isMeshPhongMaterial || x.isMeshToonMaterial)) continue;
      berat = Math.max(berat, PETA_BAHAN.filter(k => x[k]).length + ((x.transmission as number) > 0 ? 1 : 0));
    }
  });
  return Math.max(0, m.renderer.capabilities.maxTextures - berat - 3);
}

interface Lampu { light: T.SpotLight; kanvas: HTMLCanvasElement; tex: T.CanvasTexture; kunci: string }
const simpanan = new WeakMap<object, Map<string, Lampu>>();

/** Patch shader sekali: piksel di luar peta gambar SpotLight tidak menyala (proyektor = bingkai persegi, bukan kerucut bundar). */
export function pasangPatchProyektor(THREE: typeof T) {
  const c = THREE.ShaderChunk as unknown as Record<string, string>;
  const lama = 'directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;';
  if (c.lights_fragment_begin.includes(lama)) c.lights_fragment_begin = c.lights_fragment_begin.replace(lama, 'directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : vec3( 0.0 );');
}

const keLinear = new Float32Array(256).map((_, i) => { const s = i / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
const keSrgb = (l: number) => Math.round(255 * (l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055));

/**
 * Peta gambar proyektor (sRGB): konten x profil keseragaman x ramp blending x mask, dinormalkan ke maksimum 1.
 * Profil: lensa proyektor dirancang menerangi bidang TEGAK LURUS sumbu merata sampai ±KESERAGAMAN di pojok, padahal
 * lampu titik bersudut lebar meredup cos³ ke pinggir - maka intensitas per arah = (1 + tan²) ^ 1,5 x keseragaman.
 * Mengembalikan pengali intensitas (nilai profil maksimum) supaya pusat gambar tetap = lumen / luas.
 */
function gambarPeta(kv: HTMLCanvasElement, L: Lensa, m: MasukanLampu): number {
  const W = LEBAR_PETA, H = Math.max(64, Math.round((W * L.h1) / L.w1));
  kv.width = W; kv.height = H;
  const g = kv.getContext('2d', { willReadFrequently: true })!;
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
  if (m.konten) { try { g.drawImage(m.konten, 0, 0, W, H); } catch { /* gambar belum siap: putih */ } }
  //  Mask ke bidang: hanya segitiga yang mengenai layar / bidang yang tetap menyala (uv 0..1, v ke atas).
  let mask: Uint8ClampedArray | null = null;
  if (m.maskUv) {
    const mk = document.createElement('canvas'); mk.width = W; mk.height = H;
    const gm = mk.getContext('2d')!;
    gm.fillStyle = '#fff'; gm.strokeStyle = '#fff'; gm.lineWidth = 1.5; gm.beginPath();
    for (let i = 0; i + 5 < m.maskUv.length; i += 6) {
      gm.moveTo(m.maskUv[i] * W, (1 - m.maskUv[i + 1]) * H);
      gm.lineTo(m.maskUv[i + 2] * W, (1 - m.maskUv[i + 3]) * H);
      gm.lineTo(m.maskUv[i + 4] * W, (1 - m.maskUv[i + 5]) * H);
      gm.closePath();
    }
    gm.fill(); gm.stroke();
    mask = gm.getImageData(0, 0, W, H).data;
  }
  const data = g.getImageData(0, 0, W, H), d = data.data;
  const profil = (u: number, v: number) => {
    const tx = (u - 0.5 + L.gH) * L.w1, ty = (v - 0.5 + L.gV) * L.h1;
    const r2 = ((2 * u - 1) ** 2 + (2 * v - 1) ** 2) / 2;
    return (1 + tx * tx + ty * ty) ** 1.5 * (1 - (1 - KESERAGAMAN) * r2);
  };
  const maks = Math.max(profil(0, 0), profil(1, 0), profil(0, 1), profil(1, 1), profil(0.5, 0.5));
  const { kiri, kanan, atas, bawah } = m.blend;
  //  Ramp edge blending di cahaya LINEAR: dua proyektor yang bertumpuk menjumlah tepat 1 di area blending.
  const ramp = (t: number, q: number) => (q > 0.001 ? Math.min(1, Math.max(0, t / q)) : 1);
  for (let y = 0; y < H; y++) {
    const v = 1 - (y + 0.5) / H;
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W, i = (y * W + x) * 4;
      const k = (profil(u, v) / maks) * ramp(u, kiri) * ramp(1 - u, kanan) * ramp(v, bawah) * ramp(1 - v, atas) * (mask ? mask[i] / 255 : 1);
      d[i] = keSrgb(keLinear[d[i]] * k); d[i + 1] = keSrgb(keLinear[d[i + 1]] * k); d[i + 2] = keSrgb(keLinear[d[i + 2]] * k); d[i + 3] = 255;
    }
  }
  g.putImageData(data, 0, 0);
  return maks;
}

/**
 * Pasang / perbarui lampu semua proyektor (mode Sinar nyata) & gulungan terang gambarnya. `daftar` kosong = semua lampu
 * proyektor dilepas, cahaya ruangan kembali normal.
 */
export function aturLampuProyektor(m: Mesin, daftar: MasukanLampu[]) {
  const { THREE, scene, renderer } = m;
  let peta = simpanan.get(m);
  if (!peta) { peta = new Map(); simpanan.set(m, peta); }
  const ada = new Set(daftar.map(x => x.p.id));
  for (const [id, l] of peta) {
    if (ada.has(id)) continue;
    scene.remove(l.light, l.light.target); l.light.dispose(); l.tex.dispose(); peta.delete(id);
  }
  //  Anggaran unit tekstur GPU: tiap proyektor = peta gambar (+ peta bayangan). Sisakan ±6 untuk bahan & matahari;
  //  proyektor yang tidak kebagian bayangan tetap menyala (bayangan benda hilang untuk proyektor itu saja).
  const sisaUnit = batasProyektorNyata(m);
  const denganBayangan = Math.max(0, Math.min(daftar.length, sisaUnit - daftar.length));
  /** Per proyektor: candela pusat (lumen / (w1 x h1), sudah x pengali profil), iradiansi ruangan adegan A & lux. */
  const ukur: { light: T.SpotLight; cd: number; A: number; lux: number; luxGambar: number }[] = [];

  daftar.forEach((x, i) => {
    const { p, L } = x;
    let lampu = peta!.get(p.id);
    if (!lampu) {
      const kanvas = document.createElement('canvas');
      const tex = new THREE.CanvasTexture(kanvas); tex.colorSpace = THREE.SRGBColorSpace;
      const light = new THREE.SpotLight(0xffffff, 1, 0, 0.5, 0, 2);
      light.map = tex; scene.add(light, light.target);
      lampu = { light, kanvas, tex, kunci: '' };
      peta!.set(p.id, lampu);
    }
    const { light } = lampu;
    //  Bingkai gambar dalam tangen sudut: x0..x1 (kanan), y0..y1 (atas) - simetris penuh TX x TY + sub-bingkai (view offset).
    const x0 = (-0.5 + L.gH) * L.w1, x1 = (0.5 + L.gH) * L.w1, y0 = (-0.5 + L.gV) * L.h1, y1 = (0.5 + L.gV) * L.h1;
    const TX = Math.max(Math.abs(x0), Math.abs(x1)), TY = Math.max(Math.abs(y0), Math.abs(y1));
    const sudutPojok = Math.atan(Math.hypot(TX, TY));
    light.angle = Math.min(Math.PI / 2 - 0.01, sudutPojok + 0.02);
    light.penumbra = 0;
    light.shadow.focus = Math.atan(TY) / light.angle;
    //  Peta bayangan berasio TX:TY (SpotLightShadow mengambil aspek kamera dari mapSize).
    const lebarBayang = 1024, tinggiBayang = Math.max(64, Math.round((lebarBayang * TY) / TX));
    if (light.shadow.mapSize.x !== lebarBayang || light.shadow.mapSize.y !== tinggiBayang) {
      light.shadow.mapSize.set(lebarBayang, tinggiBayang);
      light.shadow.map?.dispose(); (light.shadow as unknown as { map: unknown }).map = null;
    }
    const kam = light.shadow.camera as T.PerspectiveCamera;
    kam.up.set(...L.atas);
    kam.near = Math.max(0.05, koreksiJarakDari(p) + 0.06);
    kam.far = 60;
    const fw = TX * 2000, fh = TY * 2000;
    kam.setViewOffset(fw, fh, (x0 + TX) * 1000, (TY - y1) * 1000, (x1 - x0) * 1000, (y1 - y0) * 1000);
    light.position.set(...L.O);
    light.target.position.set(L.O[0] + L.D[0], L.O[1] + L.D[1], L.O[2] + L.D[2]);
    light.target.updateMatrixWorld();
    light.castShadow = i < denganBayangan;
    light.shadow.bias = -0.0003; light.shadow.normalBias = 0.015; light.shadow.radius = 2;

    //  Peta gambar: dibuat ulang hanya bila konten / lensa / blending / mask berubah.
    let hashMask = 0;
    if (x.maskUv) for (const v of x.maskUv) hashMask = (hashMask * 31 + Math.round(v * 2000)) | 0;
    const kunci = JSON.stringify([x.kunciKonten, L.w1, L.h1, L.gH, L.gV, x.blend, x.maskUv ? x.maskUv.length : -1, hashMask]);
    let pengali = (light.userData.pengali as number) || 1;
    if (kunci !== lampu.kunci) {
      pengali = gambarPeta(lampu.kanvas, L, x);
      light.userData.pengali = pengali;
      lampu.tex.needsUpdate = true; lampu.kunci = kunci;
    }
    const n = x.normal ?? new THREE.Vector3(-L.D[0], -L.D[1], -L.D[2]);
    ukur.push({ light, cd: x.mati ? 0 : (lumenDari(p) / (L.w1 * L.h1)) * pengali, A: ambienAdegan(m, n), lux: Math.max(0.5, x.luxAmbien), luxGambar: x.luxGambar });
  });
  //  Intensitas: candela nyata = lumen / (w1 x h1) (pusat gambar di bidang tegak = lumen / luas) x skala adegan -
  //  terang cahaya ruangan yang dirender di permukaan sasaran (A, diukur) setara dengan lux ruangan yang dihitung,
  //  dirata-rata atas semua proyektor supaya satuan cahaya proyektor sama untuk semuanya.
  const skala = ukur.reduce((a, u) => a + u.A / u.lux, 0) / Math.max(1, ukur.length);
  //  Permukaan putih: luminance = iradiansi / pi (BRDF Lambert) -> A / pi (ruangan) + skala x lux gambar / pi
  //  (proyektor). Hanya bagian proyektor yang digulung (gulungTerang); cahaya ruangan TIDAK disentuh.
  for (const u of ukur) {
    const tambahan = (skala * u.luxGambar) / Math.PI;
    const faktor = tambahan > 0 ? gulungTerang(tambahan) / tambahan : 1;
    u.light.intensity = u.cd * skala * faktor;
  }
  aturCahayaRuang(m, { k: 1 });
}
