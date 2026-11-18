import type * as T from 'three';
import { teksturKonten } from '../bangun/konten';
import { teksturPolaUji } from '../bangun/tekstur';
import { type Benda, koreksiJarakDari, kotakGrid, type Lensa, lumenGambarDari, petaMaskBidang, putaranGambar, rasioGambarProyektor, type UjiBidang } from '../inti';
import type { Mesin } from './tipe';

const cacheKonten = new Map<string, CanvasImageSource>();

export function kontenProyektor(THREE: typeof T, p: Benda, grid: boolean, lebarM: number, tinggiM: number,
  gambar: Map<string, T.Texture>): { sumber: CanvasImageSource | null; kunci: string; mati: boolean } {
  const tegak = putaranGambar(p) % 2 === 1, rasio = tegak ? rasioGambarProyektor(p) : 1 / rasioGambarProyektor(p), konten = p.konten ?? 'pola';
  if (konten === 'mati') return { sumber: null, kunci: 'mati', mati: true };
  if (grid) {
    const kg = tegak ? kotakGrid(tinggiM, lebarM, p.gridKolom) : kotakGrid(lebarM, tinggiM, p.gridKolom);
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

export const lampuRuang = (f: number) => ({ matahari: 1.6 * f, langit: 0.35 * f, lingkungan: Math.max(0.1, f) });
interface Adaptasi { f: number; k: number }
const adaptasi = new WeakMap<object, Adaptasi>();
const adaptasiDari = (m: Mesin): Adaptasi => adaptasi.get(m) ?? { f: 1, k: 1 };
export function aturCahayaRuang(m: Mesin, ubah: Partial<Adaptasi>) {
  const a = { ...adaptasiDari(m), ...ubah }; adaptasi.set(m, a);
  const d = lampuRuang(a.f);
  m.lampu.matahari.intensity = d.matahari * a.k; m.lampu.langit.intensity = d.langit * a.k;
  (m.scene as T.Scene & { environmentIntensity: number }).environmentIntensity = d.lingkungan * a.k;
}

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
export const KESERAGAMAN = 0.85;
export const PUTIH_LAYAR = 1, EKSPOSUR_MIN = 0.08;
const TAMBAHAN_MAKS = 4;
export function gulungTerang(q: number): number {
  if (q <= PUTIH_LAYAR) return Math.max(0, q);
  const r = TAMBAHAN_MAKS - PUTIH_LAYAR;
  return PUTIH_LAYAR + r * (1 - Math.exp(-(q - PUTIH_LAYAR) / r));
}
export const eksposurLayar = (putih: number) => (putih > PUTIH_LAYAR ? Math.max(EKSPOSUR_MIN, PUTIH_LAYAR / putih) : 1);
const LEBAR_PETA = 768, LEBAR_MASK = 384, LEBAR_MASK_KASAR = 192;
const tinggiPeta = (L: Lensa) => Math.max(64, Math.round((LEBAR_PETA * L.h1) / L.w1));

export interface MasukanLampu {
  p: Benda; L: Lensa;
   luxAmbien: number;
   luxGambar: number;
   normal: T.Vector3 | null;
   konten: CanvasImageSource | null; kunciKonten: string;
   blend: { kiri: number; kanan: number; atas: number; bawah: number };
   mask: { uji: UjiBidang[]; kunci: string } | null;
   mati?: boolean;
   silau?: number;
   pusat?: T.Vector3 | null; lebar?: number; tinggi?: number;
}

const PETA_BAHAN = ['map', 'alphaMap', 'aoMap', 'bumpMap', 'normalMap', 'emissiveMap', 'lightMap', 'roughnessMap', 'metalnessMap',
  'clearcoatMap', 'clearcoatNormalMap', 'clearcoatRoughnessMap', 'sheenColorMap', 'sheenRoughnessMap', 'specularIntensityMap',
  'specularColorMap', 'transmissionMap', 'thicknessMap', 'iridescenceMap', 'iridescenceThicknessMap', 'anisotropyMap'];
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

interface Lampu {
  light: T.SpotLight; kanvas: HTMLCanvasElement; tex: T.CanvasTexture;
  dasar: HTMLCanvasElement; kanvasMask: HTMLCanvasElement; kunciIsi: string; kunciBlend: string; kunciMask: string; lebarMask: number; halo: T.Mesh<T.PlaneGeometry, T.MeshBasicMaterial>;
}
const simpanan = new WeakMap<object, Map<string, Lampu>>();

export const TEPI_HALO = 0.42, KUAT_HALO = 0.5, AWAL_HALO = 2, SILAU_PENUH = 30, DALAM_HALO = 0.08;
export const kuatHalo = (silau: number) => (silau > AWAL_HALO ? Math.min(1, Math.log(silau / AWAL_HALO) / Math.log(SILAU_PENUH / AWAL_HALO)) : 0);
let teksturHalo: T.Texture | null = null;
function haloBaru(THREE: typeof T): T.Mesh<T.PlaneGeometry, T.MeshBasicMaterial> {
  if (!teksturHalo) {
    const N = 128, c = document.createElement('canvas'); c.width = N; c.height = N;
    const g = c.getContext('2d')!, img = g.createImageData(N, N), d = img.data;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = Math.max(0, Math.abs((2 * x + 1) / N - 1) - TEPI_HALO), v = Math.max(0, Math.abs((2 * y + 1) / N - 1) - TEPI_HALO);
      const t = Math.min(1, Math.hypot(u, v) / (1 - TEPI_HALO)), i = (y * N + x) * 4, nilai = Math.round(255 * (u + v > 0 ? Math.exp(-4 * t) * (1 - t) : DALAM_HALO));
      d[i] = nilai; d[i + 1] = nilai; d[i + 2] = nilai; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    teksturHalo = new THREE.CanvasTexture(c);
  }
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: teksturHalo, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  halo.renderOrder = 5; halo.visible = false; halo.raycast = () => {};
  return halo;
}

export const NORMAL_BIAS_SPOT = 'shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;';
export const NORMAL_BIAS_SPOT_KE_LAMPU = `{
			vec4 pusatLampu = inverse( spotLightMatrix[ i ] ) * vec4( 0.0, 0.0, 1.0, 0.0 );
			vec3 keLampu = pusatLampu.xyz / pusatLampu.w - worldPosition.xyz;
			shadowWorldPosition.xyz += shadowWorldNormal * ( dot( shadowWorldNormal, keLampu ) < 0.0 ? - 1.0 : 1.0 ) * spotLightShadows[ i ].shadowNormalBias;
		}`;
export const biasKeArahLampu = (chunk: string) => chunk.replace(NORMAL_BIAS_SPOT, NORMAL_BIAS_SPOT_KE_LAMPU);

export function pasangPatchProyektor(THREE: typeof T) {
  const c = THREE.ShaderChunk as unknown as Record<string, string>;
  const lama = 'directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;';
  if (c.lights_fragment_begin.includes(lama)) c.lights_fragment_begin = c.lights_fragment_begin.replace(lama, 'directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : vec3( 0.0 );');
  c.shadowmap_vertex = biasKeArahLampu(c.shadowmap_vertex);
}

const keLinear = new Float32Array(256).map((_, i) => { const s = i / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
const keSrgb = (l: number) => Math.round(255 * (l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055));

const keSrgbTabel = Uint8ClampedArray.from({ length: 4096 }, (_, i) => keSrgb(i / 4095));

function gambarDasar(kv: HTMLCanvasElement, L: Lensa, m: MasukanLampu): number {
  const W = LEBAR_PETA, H = tinggiPeta(L);
  kv.width = W; kv.height = H;
  const g = kv.getContext('2d', { willReadFrequently: true })!;
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
  if (m.konten) {
    try { g.save(); g.translate(W / 2, H / 2); g.rotate((-L.putar * Math.PI) / 2); const [a, b] = L.putar % 2 ? [H, W] : [W, H]; g.drawImage(m.konten, -a / 2, -b / 2, a, b); g.restore(); } catch {  }
  }
  const data = g.getImageData(0, 0, W, H), d = data.data;
  const profil = (u: number, v: number) => {
    const tx = (u - 0.5 + L.gH) * L.w1, ty = (v - 0.5 + L.gV) * L.h1;
    const r2 = ((2 * u - 1) ** 2 + (2 * v - 1) ** 2) / 2;
    return (1 + tx * tx + ty * ty) ** 1.5 * (1 - (1 - KESERAGAMAN) * r2);
  };
  const maks = Math.max(profil(0, 0), profil(1, 0), profil(0, 1), profil(1, 1), profil(0.5, 0.5));
  const { kiri, kanan, atas, bawah } = m.blend;
  const ramp = (t: number, q: number) => (q > 0.001 ? Math.min(1, Math.max(0, t / q)) : 1);
  for (let y = 0; y < H; y++) {
    const v = 1 - (y + 0.5) / H, rv = ramp(v, bawah) * ramp(1 - v, atas);
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W, i = (y * W + x) * 4;
      const k = Math.min(1, (profil(u, v) / maks) * ramp(u, kiri) * ramp(1 - u, kanan) * rv) * 4095;
      d[i] = keSrgbTabel[(keLinear[d[i]] * k + 0.5) | 0]; d[i + 1] = keSrgbTabel[(keLinear[d[i + 1]] * k + 0.5) | 0];
      d[i + 2] = keSrgbTabel[(keLinear[d[i + 2]] * k + 0.5) | 0]; d[i + 3] = 255;
    }
  }
  g.putImageData(data, 0, 0);
  return maks;
}

function gambarMask(kv: HTMLCanvasElement, L: Lensa, uji: UjiBidang[], lebar: number) {
  const tinggi = Math.max(16, Math.round((lebar * tinggiPeta(L)) / LEBAR_PETA));
  const peta = petaMaskBidang(L, uji, lebar, tinggi);
  kv.width = lebar; kv.height = tinggi;
  const g = kv.getContext('2d')!, img = g.createImageData(lebar, tinggi), d = img.data;
  for (let i = 0; i < peta.length; i++) { const v = peta[i] ? 255 : 0; d[i * 4] = v; d[i * 4 + 1] = v; d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
}

function susunPeta(l: Lampu, adaMask: boolean) {
  const { kanvas, dasar, kanvasMask, tex } = l;
  if (kanvas.width !== dasar.width || kanvas.height !== dasar.height) {
    kanvas.width = dasar.width; kanvas.height = dasar.height;
    tex.dispose();
  }
  const g = kanvas.getContext('2d')!;
  g.globalCompositeOperation = 'copy'; g.drawImage(dasar, 0, 0);
  if (adaMask) {
    g.globalCompositeOperation = 'multiply'; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(kanvasMask, 0, 0, kanvas.width, kanvas.height);
  }
  g.globalCompositeOperation = 'source-over';
  tex.needsUpdate = true;
}

export function aturLampuProyektor(m: Mesin, daftar: MasukanLampu[], kasar = false, tahanEksposur = false): number {
  const { THREE, scene } = m;
  let peta = simpanan.get(m);
  if (!peta) { peta = new Map(); simpanan.set(m, peta); }
  const ada = new Set(daftar.map(x => x.p.id));
  for (const [id, l] of peta) {
    if (ada.has(id)) continue;
    scene.remove(l.light, l.light.target, l.halo); l.light.dispose(); l.tex.dispose(); l.halo.material.dispose(); l.halo.geometry.dispose(); peta.delete(id);
  }
  const sisaUnit = batasProyektorNyata(m);
  const denganBayangan = Math.max(0, Math.min(daftar.length, sisaUnit - daftar.length));
  const ukur: { light: T.SpotLight; cd: number; A: number; lux: number; luxGambar: number; silau: number; halo: T.Mesh<T.PlaneGeometry, T.MeshBasicMaterial>; atas: T.Vector3; pusat: T.Vector3 | null; arah: T.Vector3; lebar: number; tinggi: number }[] = [];

  daftar.forEach((x, i) => {
    const { p, L } = x;
    let lampu = peta!.get(p.id);
    if (!lampu) {
      const kanvas = document.createElement('canvas');
      const tex = new THREE.CanvasTexture(kanvas); tex.colorSpace = THREE.SRGBColorSpace;
      const light = new THREE.SpotLight(0xffffff, 1, 0, 0.5, 0, 2);
      const halo = haloBaru(THREE);
      light.map = tex; scene.add(light, light.target, halo);
      lampu = { light, kanvas, tex, dasar: document.createElement('canvas'), kanvasMask: document.createElement('canvas'), kunciIsi: '', kunciBlend: '', kunciMask: '', lebarMask: 0, halo };
      peta!.set(p.id, lampu);
    }
    const { light } = lampu;
    const x0 = (-0.5 + L.gH) * L.w1, x1 = (0.5 + L.gH) * L.w1, y0 = (-0.5 + L.gV) * L.h1, y1 = (0.5 + L.gV) * L.h1;
    const TX = Math.max(Math.abs(x0), Math.abs(x1)), TY = Math.max(Math.abs(y0), Math.abs(y1));
    const sudutPojok = Math.atan(Math.hypot(TX, TY));
    light.angle = Math.min(Math.PI / 2 - 0.01, sudutPojok + 0.02);
    light.penumbra = 0;
    light.shadow.focus = Math.atan(TY) / light.angle;
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

    const kunciIsi = JSON.stringify([x.kunciKonten, L.w1, L.h1, L.gH, L.gV, L.putar]), kunciBlend = JSON.stringify(x.blend);
    let pengali = (light.userData.pengali as number) || 1, ubah = false;
    if (kunciIsi !== lampu.kunciIsi || (!kasar && kunciBlend !== lampu.kunciBlend)) {
      pengali = gambarDasar(lampu.dasar, L, x);
      light.userData.pengali = pengali;
      lampu.kunciIsi = kunciIsi; lampu.kunciBlend = kunciBlend; ubah = true;
    }
    const kunciMask = x.mask ? JSON.stringify([x.mask.kunci, L]) : '';
    if (kunciMask !== lampu.kunciMask || (x.mask && !kasar && lampu.lebarMask < LEBAR_MASK)) {
      const lebar = kasar ? LEBAR_MASK_KASAR : LEBAR_MASK;
      if (x.mask) gambarMask(lampu.kanvasMask, L, x.mask.uji, lebar);
      lampu.kunciMask = kunciMask; lampu.lebarMask = x.mask ? lebar : 0; ubah = true;
    }
    if (ubah) susunPeta(lampu, !!x.mask);
    const n = x.normal ?? new THREE.Vector3(-L.D[0], -L.D[1], -L.D[2]);
    const pusat = x.pusat ?? null, arah = pusat && n.dot(new THREE.Vector3(...L.O).sub(pusat)) < 0 ? n.clone().negate() : n.clone();
    ukur.push({ light, cd: x.mati ? 0 : (lumenGambarDari(p) / (L.w1 * L.h1)) * pengali, A: ambienAdegan(m, n), lux: Math.max(0.5, x.luxAmbien), luxGambar: x.luxGambar, silau: x.silau ?? 1,
      halo: lampu.halo, atas: new THREE.Vector3(...L.atas), pusat, arah, lebar: x.lebar ?? 0, tinggi: x.tinggi ?? 0 });
  });
  const skala = ukur.reduce((a, u) => a + u.A / u.lux, 0) / Math.max(1, ukur.length);
  const putih = Math.max(0, ...ukur.filter(u => u.cd > 0).map(u => (u.A + skala * u.luxGambar) / Math.PI));
  const silau = Math.max(1, ...ukur.filter(u => u.cd > 0).map(u => u.silau));
  const k = tahanEksposur && ukur.length ? adaptasiDari(m).k : Math.min(1, eksposurLayar(putih) * Math.cbrt(silau));
  for (const u of ukur) {
    const tambahan = (k * skala * u.luxGambar) / Math.PI;
    const faktor = tambahan > 0 ? gulungTerang(tambahan) / tambahan : 1;
    u.light.intensity = u.cd * skala * k * faktor;
    const g = u.cd > 0 && u.pusat && u.lebar > 0 ? kuatHalo(u.silau) : 0;
    u.halo.visible = g > 0.02;
    if (!u.halo.visible || !u.pusat) continue;
    u.halo.position.copy(u.pusat).addScaledVector(u.arah, 0.01);
    u.halo.up.copy(u.atas); u.halo.lookAt(u.pusat.clone().add(u.arah));
    u.halo.scale.set(u.lebar / TEPI_HALO, u.tinggi / TEPI_HALO, 1);
    u.halo.material.color.setScalar(KUAT_HALO * g);
  }
  aturCahayaRuang(m, { k });
  return k;
}
