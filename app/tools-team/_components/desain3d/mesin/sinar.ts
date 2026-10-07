/**
 * desain3d/mesin/sinar.ts - Sinar proyektor di kanvas. Grid sinar dari lensa (TR/zoom, lens shift, pan &
 * tilt) ditembakkan (raycast) ke SEMUA permukaan - dinding, lantai, plafon, layar, bidang lengkung/cembung,
 * furnitur & objek impor. Gambar jatuh tepat mengikuti permukaannya (melipat di sudut, menekuk di
 * lengkungan); tumpang-tindih antar proyektor (blending) tampil lebih terang karena dijumlahkan (aditif).
 *
 *   - Bidang proyeksi (dinding, lantai, layar, bidang mapping): sel grid. Sel di tepi BENDA dipecah halus
 *     (sinar tambahan) supaya bayangan benda di lantai/dinding tajam, bukan kotak-kotak.
 *   - Benda yang tersinari (objek mapping, model, furnitur, perangkat): mesin/cahayaBenda.ts, per titik
 *     permukaan - mulus mengikuti bentuknya, bukan bercak sel grid.
 *   - Keterangan (nama, jarak lensa -> bidang, ukuran gambar, lux pusat) & lux tiap pojok TERCETAK DI
 *     CAHAYA gambar itu sendiri, hitam kecil seperti simulator proyektor pabrikan (mesin/teksCahaya.ts).
 *     Di proyektor cukup namanya.
 *   - Warna sinar per proyektor (inti/proyektor.ts warnaSinarProyektor): otomatis berbeda bila >= 2
 *     proyektor, atau pilihan engineer - bidang gambar, kerucut & cahaya di benda memakai warna itu.
 *   - Area blending: mesin/blending.ts.
 */
import { f } from '../../bersama/ui';
import { arahProyektor, arahSinar, type Benda, type Blending, geserLensaDari, keGambar, lensaDari, type Lensa, lumenDari, offsetLensaDari, ronaProyektor, sinarProyektor, throwRatioDari, type Titik, warnaSinarProyektor } from '../inti';
import type * as T from 'three';
import type { KeadaanDesain } from '../useKeadaanDesain';
import { gambarBlending } from './blending';
import { gambarCahayaBenda, type SumberCahaya } from './cahayaBenda';
import { gambarTeksCahaya, TINGGI_HURUF, type BlokTeks } from './teksCahaya';
import type { Mesin } from './tipe';

export type KeadaanSinar = Pick<KeadaanDesain, 'benda' | 'ruang' | 'sinar' | 'ukur' | 'labelProduk' | 'plafonDi' | 'tampilBlending' | 'detailBlending' | 'setInfoBlending'>;

/** Bidang proyeksi: gambar digambar sebagai sel grid. Benda lain diterangi per titik (cahayaBenda). */
const BIDANG_PROYEKSI = new Set<Benda['jenis']>(['layar', 'bidang']);
/**
 * Tulisan keterangan & lux hanya menempel di bidang yang memang disasar proyeksi (ruangan, layar, bidang &
 * objek mapping). Proyektor / furnitur / perangkat lain yang lewat di depan lensa tetap membuat bayangan di
 * cahaya, tetapi tidak memotong tulisan & tidak mengubah jarak lempar / lux yang ditulis.
 */
const BIDANG_TEKS = new Set<Benda['jenis']>(['layar', 'bidang', 'objek', 'model']);

export function gambarSinar(m: Mesin, k: KeadaanSinar, labelP: (teks: string, pos: T.Vector3, dy?: -1 | 1) => void) {
  const { THREE, grupBantu } = m;
  const { benda, ruang, sinar, ukur, labelProduk, plafonDi, tampilBlending, detailBlending, setInfoBlending } = k;
  const daftarProj = benda.filter(p => p.jenis === 'proyektor');
  const hitungBlend = tampilBlending && daftarProj.length >= 2;
  if (!hitungBlend) setInfoBlending(v => (v.length ? [] : v));
  if (!(sinar || hitungBlend) || !daftarProj.length) return;

  m.scene.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(); ray.near = 0.03; ray.far = 80;
  (ray.params as { Line?: { threshold: number } }).Line = { threshold: 0.0001 };
  //  Saat menyeret: grid lebih kasar & tanpa sinar tambahan supaya tetap lancar.
  const kasar = m.gizmo.dragging;
  const NX = kasar ? 12 : 24, NY = kasar ? 7 : 14;
  const cahaya = { transparent: true, depthWrite: false, toneMapped: false };
  //  Banyak proyektor (immersive): kerucut & bidang gambar diredam supaya tumpukannya tidak silau.
  const banyak = daftarProj.length > 4, redam = banyak ? 0.35 : 1;
  const jenisDari = new Map(benda.map(b => [b.id, b.jenis]));
  const sasaranTeks = [...m.grupRuang.children, ...m.grupBenda.children.filter(o => {
    const j = jenisDari.get(o.userData.id as string);
    return !!j && BIDANG_TEKS.has(j);
  })];

  /** Titik permukaan pertama yang terkena sinar (kaca & bayangan ditembus) + benda yang dikenai (null = ruangan). */
  const tembakRinci = (O: T.Vector3, arah: T.Vector3, sasaran: T.Object3D[]): { p: T.Vector3; id: string | null; n: T.Vector3 | null } | null => {
    ray.set(O, arah);
    const hit = ray.intersectObjects(sasaran, true).find(h => {
      const o = h.object as T.Mesh;
      if (!o.isMesh) return false;
      const mt = (Array.isArray(o.material) ? o.material[0] : o.material) as T.Material & { opacity?: number };
      return !(mt?.transparent && (mt.opacity ?? 1) < 0.6);
    });
    if (!hit) return null;
    let o: T.Object3D | null = hit.object;
    while (o && !o.userData.id) o = o.parent;
    //  Mundur 1,2 cm ke arah lensa supaya bidang gambar tidak tenggelam di permukaan.
    return { p: hit.point.clone().addScaledVector(arah, -0.012), id: (o?.userData.id as string | undefined) ?? null,
      n: hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : null };
  };
  const tembak = (O: T.Vector3, arah: T.Vector3, sasaran: T.Object3D[]) => tembakRinci(O, arah, sasaran)?.p ?? null;
  /** Titik terkena benda yang diterangi per titik (bukan bidang proyeksi). */
  const diBenda = (id: string | null) => !!id && !BIDANG_PROYEKSI.has(jenisDari.get(id) ?? 'objek');

  /** Data per proyektor untuk area blending (inti/blending.ts). */
  const dataBlend: { p: Benda; L: Lensa; O: T.Vector3; sasaran: T.Object3D[]; kena: (T.Vector3 | null)[]; baris: (Titik | null)[]; kolom: (Titik | null)[] }[] = [];
  const sumberCahaya: SumberCahaya[] = [];
  /** Bidang gambar tiap proyektor - dibuat SETELAH blending dihitung, supaya keterangan tidak jatuh di area tumpang tindih. */
  const bidangGambar: { p: Benda; L: Lensa; pos: number[]; uv: number[]; opasitas: number; warna: T.Color; teks: { info: string[]; lux: (number | null)[]; pos: number[]; uv: number[] } | null }[] = [];
  const bendaTersinari = new Set<string>();
  daftarProj.forEach((p, idx) => {
    const sn = sinarProyektor(p, benda, ruang);
    const O = new THREE.Vector3(...sn.asal);
    const sendiri = m.cache.get(p.id)?.obj;
    const sasaran = [...m.grupRuang.children, ...m.grupBenda.children.filter(o => o !== sendiri && !o.userData.sorot)];
    const r = (p.rot * Math.PI) / 180;
    const D = new THREE.Vector3(...arahProyektor(p)).normalize();
    const kanan = new THREE.Vector3(-Math.cos(r), 0, Math.sin(r));
    const atas = new THREE.Vector3().crossVectors(kanan, D).normalize();
    const w1 = 1 / throwRatioDari(p), h1 = (w1 * 9) / 16, arahV = p.pasangProyektor === 'meja' ? 1 : -1;
    const offV = offsetLensaDari(p), gH = geserLensaDari(p);
    const arah = new THREE.Vector3();
    /** Arah sinar ke titik gambar (u, v), -0,5..0,5 - rumus yang sama dengan inti/blending.ts. */
    const arahUV = (u: number, v: number) => arah.copy(D).addScaledVector(kanan, (u + gH) * w1).addScaledVector(atas, (v + arahV * offV) * h1).normalize();
    const kena: (T.Vector3 | null)[] = [], kenaId: (string | null)[] = [];
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const t = tembakRinci(O, arahUV(i / (NX - 1) - 0.5, j / (NY - 1) - 0.5), sasaran);
      kena.push(t?.p ?? null); kenaId.push(t?.id ?? null);
      if (t && diBenda(t.id)) bendaTersinari.add(t.id!);
    }
    const sel = (i: number, j: number) => kena[j * NX + i];
    if (hitungBlend) {
      //  Garis tengah mendatar & tegak gambar, sampel rapat (lebih kasar saat menyeret) - dasar ukur blending.
      const L = lensaDari(p), NB = kasar ? 31 : 81, NV = kasar ? 21 : 49;
      const keT = (v: T.Vector3 | null): Titik | null => (v ? [v.x, v.y, v.z] : null);
      const sampel = (u: number, v: number) => keT(tembak(O, arah.set(...arahSinar(L, u, v)), sasaran));
      dataBlend.push({
        p, L, O, sasaran, kena,
        baris: Array.from({ length: NB }, (_, i) => sampel(i / (NB - 1) - 0.5, 0)),
        kolom: Array.from({ length: NV }, (_, j) => sampel(0, j / (NV - 1) - 0.5)),
      });
    }
    if (!sinar) return;
    const warna = new THREE.Color(warnaSinarProyektor(p, idx, daftarProj.length));
    sumberCahaya.push({ O, L: lensaDari(p), sasaran, kuat: (sn.layar ? 0.8 : 1) * (banyak ? 0.6 : 1), warna: [warna.r, warna.g, warna.b] });

    //  Bidang gambar: sel grid yang keempat sudutnya kena permukaan ruang / bidang proyeksi & tidak
    //  "melompat" (tepi objek ke dinding di belakangnya). Sel yang sebagian mengenai benda dipecah 8x8
    //  dengan sinar tambahan -> tepi bayangan benda tajam. Sel yang seluruhnya di benda: cahayaBenda.
    //  uv = koordinat gambar (0..1) tiap titik - tekstur cahaya (& keterangannya) jatuh tepat di bidang.
    const pos: number[] = [], uv: number[] = [];
    const quadKe = (P: number[], U: number[]) => (A: T.Vector3, B: T.Vector3, C: T.Vector3, Dd: T.Vector3, batas: number, u0: number, v0: number, u1: number, v1: number) => {
      if (A.distanceTo(B) > batas || B.distanceTo(C) > batas || C.distanceTo(Dd) > batas || Dd.distanceTo(A) > batas) return;
      P.push(A.x, A.y, A.z, B.x, B.y, B.z, C.x, C.y, C.z, A.x, A.y, A.z, C.x, C.y, C.z, Dd.x, Dd.y, Dd.z);
      U.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
    };
    const quad = quadKe(pos, uv);
    const gu = (i: number) => i / (NX - 1), gv = (j: number) => j / (NY - 1);
    const S = 8;
    for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) {
      const sudut = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([a, b]) => b * NX + a);
      if (sudut.some(n => !kena[n])) continue;
      const jarak = (kena[sudut[0]]!.distanceTo(O) + kena[sudut[2]]!.distanceTo(O)) / 2;
      const batas = ((jarak * w1) / (NX - 1)) * 6 + 0.05;
      const diB = sudut.filter(n => diBenda(kenaId[n])).length;
      if (!diB) { quad(kena[sudut[0]]!, kena[sudut[1]]!, kena[sudut[2]]!, kena[sudut[3]]!, batas, gu(i), gv(j), gu(i + 1), gv(j + 1)); continue; }
      if (diB === 4 || kasar) continue;
      //  Sel campuran (tepi benda / bayangannya): grid (S+1)x(S+1) sinar di dalam sel ini.
      const sub: ({ p: T.Vector3; id: string | null } | null)[] = [];
      for (let b = 0; b <= S; b++) for (let a = 0; a <= S; a++) {
        sub.push(tembakRinci(O, arahUV((i + a / S) / (NX - 1) - 0.5, (j + b / S) / (NY - 1) - 0.5), sasaran));
      }
      const t = (a: number, b: number) => sub[b * (S + 1) + a];
      for (let b = 0; b < S; b++) for (let a = 0; a < S; a++) {
        const q = [t(a, b), t(a + 1, b), t(a + 1, b + 1), t(a, b + 1)];
        if (q.some(x => !x || diBenda(x.id))) continue;
        quad(q[0]!.p, q[1]!.p, q[2]!.p, q[3]!.p, batas / S + 0.05, gu(i + a / S), gv(j + b / S), gu(i + (a + 1) / S), gv(j + (b + 1) / S));
      }
    }
    //  Tepi gambar (warna per proyektor) + kerucut cahaya dari lensa ke tepi itu.
    const tepi: T.Vector3[] = [];
    for (let i = 0; i < NX; i++) tepi.push(sel(i, 0)!);
    for (let j = 1; j < NY; j++) tepi.push(sel(NX - 1, j)!);
    for (let i = NX - 2; i >= 0; i--) tepi.push(sel(i, NY - 1)!);
    for (let j = NY - 2; j > 0; j--) tepi.push(sel(0, j)!);
    //  Garis tepi: warna sinar yang lebih pekat (pilihan engineer) atau rona otomatis proyektor ini.
    const warnaTepi = p.warnaSinar ? warna.clone().offsetHSL(0, 0.1, -0.18) : new THREE.Color().setHSL(ronaProyektor(idx), 0.9, 0.55);
    const garis: number[] = [], kerucut: number[] = [], alfa: number[] = [];
    for (let i = 0; i < tepi.length; i++) {
      const A = tepi[i], B = tepi[(i + 1) % tepi.length];
      if (!A || !B) continue;
      if (A.distanceTo(B) < Math.max(0.6, A.distanceTo(O) * w1 * 0.4)) garis.push(A.x, A.y, A.z, B.x, B.y, B.z);
      kerucut.push(O.x, O.y, O.z, A.x, A.y, A.z, B.x, B.y, B.z);
      //  Kerucut: pekat di lensa (warna tepi), memudar ke bidang (warna sinar).
      alfa.push(warnaTepi.r, warnaTepi.g, warnaTepi.b, 0.45 * redam, warna.r, warna.g, warna.b, 0.08 * redam, warna.r, warna.g, warna.b, 0.08 * redam);
    }
    if (garis.length) {
      const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(garis, 3));
      grupBantu.add(new THREE.LineSegments(g2, new THREE.LineBasicMaterial({ ...cahaya, color: warnaTepi, opacity: 0.95 })));
    }
    if (kerucut.length) {
      const g3 = new THREE.BufferGeometry();
      g3.setAttribute('position', new THREE.Float32BufferAttribute(kerucut, 3)); g3.setAttribute('color', new THREE.Float32BufferAttribute(alfa, 4));
      const kerucutSinar = new THREE.Mesh(g3, new THREE.MeshBasicMaterial({ ...cahaya, vertexColors: true, side: THREE.DoubleSide }));
      kerucutSinar.renderOrder = 2; grupBantu.add(kerucutSinar);
    }
    const kilau = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 8), new THREE.MeshBasicMaterial({ ...cahaya, color: 0xfffbeb, blending: THREE.AdditiveBlending, opacity: 0.95 }));
    kilau.position.copy(O); grupBantu.add(kilau);
    //  Grid tulisan: sinar yang hanya mengenai bidang sasaran (BIDANG_TEKS) - tulisan utuh walau ada benda
    //  di depan lensa. Saat menyeret tanpa tulisan (tekstur tidak dibuat ulang tiap frame).
    const tulis = ukur && !kasar;
    const teksPos: number[] = [], teksUv: number[] = [];
    let tengah = sel(Math.floor(NX / 2), Math.floor(NY / 2));
    if (tulis) {
      const kt: (T.Vector3 | null)[] = [];
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) kt.push(tembak(O, arahUV(gu(i) - 0.5, gv(j) - 0.5), sasaranTeks));
      const quadTeks = quadKe(teksPos, teksUv);
      for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) {
        const [A, B, C, Dd] = [kt[j * NX + i], kt[j * NX + i + 1], kt[(j + 1) * NX + i + 1], kt[(j + 1) * NX + i]];
        if (!A || !B || !C || !Dd) continue;
        quadTeks(A, B, C, Dd, (((A.distanceTo(O) + C.distanceTo(O)) / 2) * w1 / (NX - 1)) * 6 + 0.05, gu(i), gv(j), gu(i + 1), gv(j + 1));
      }
      tengah = kt[Math.floor(NY / 2) * NX + Math.floor(NX / 2)] ?? tengah;
    }
    const jarakSumbu = sn.layar ? sn.jarak : tengah ? tengah.distanceTo(O) : sn.jarak;
    //  Lux di titik gambar (u, v): fluks lensa merata di bidang tegak lurus sumbu -> E = lumen/(w1·h1) ·
    //  cos(sudut datang) / (cos³(sudut ke sumbu) · jarak²). Di pusat bidang tegak = lumen / luas gambar.
    const E0 = lumenDari(p) / (w1 * h1);
    const luxDi = (u: number, v: number) => {
      const r = arahUV(u, v).clone(), t = tembakRinci(O, r, sasaranTeks);
      if (!t) return null;
      const d = t.p.distanceTo(O), cosA = Math.max(0.2, r.dot(D)), cosT = t.n ? Math.abs(r.dot(t.n)) : 1;
      return (E0 * cosT) / (cosA ** 3 * d * d);
    };
    bidangGambar.push({ p, L: lensaDari(p), pos, uv, warna, opasitas: (sn.layar ? 0.26 : 0.34) * (banyak ? 0.6 : 1),
      teks: tulis ? {
        info: [p.nama, `Jarak lensa → bidang ${f(jarakSumbu)} m`, `Ukuran gambar ±${f(jarakSumbu * w1)} × ${f(jarakSumbu * h1)} m`,
          `Pusat ${f(luxDi(0, 0) ?? E0 / (jarakSumbu * jarakSumbu), 0)} lx`],
        //  Kiri atas, kanan atas, kiri bawah, kanan bawah (sedikit ke dalam dari tepi gambar).
        lux: [luxDi(-0.48, 0.47), luxDi(0.48, 0.47), luxDi(-0.48, -0.47), luxDi(0.48, -0.47)],
        pos: teksPos, uv: teksUv,
      } : null });
    if (ukur) {
      //  Di proyektor cukup namanya (bila label produk sudah menampilkannya, tidak diulang).
      if (!labelProduk || p.sembunyiLabel) {
        const diPlafon = p.elev + p.h > plafonDi(p.x) - 0.35;
        labelP(p.nama, new THREE.Vector3(p.x, diPlafon ? Math.max(0.3, p.elev - 0.02) : p.elev + p.h + 0.02, p.z), diPlafon ? 1 : -1);
      }
    }
  });
  if (sinar && bendaTersinari.size) {
    const akar = [...bendaTersinari].map(id => m.cache.get(id)?.obj).filter((o): o is T.Object3D => !!o);
    gambarCahayaBenda(m, sumberCahaya, akar, kasar);
  }
  const blending: Blending[] = hitungBlend ? gambarBlending(m, dataBlend, NX, NY, setInfoBlending, detailBlending) : [];
  for (const bg of bidangGambar) {
    if (!bg.pos.length) continue;
    //  Sisi gambar yang bertumpuk dengan proyektor lain (area blending): keterangan digeser melewatinya &
    //  lux pojok di sisi itu tidak ditulis (di situ cahaya dua proyektor menumpuk - tulisannya bertabrakan).
    let kiri = 0, kanan = 0, atas = 0, bawah = 0;
    for (const b of blending) {
      if (b.a !== bg.p.id && b.b !== bg.p.id) continue;
      const g = keGambar(bg.L, b.tengah), porsi = Math.min(0.6, (b.a === bg.p.id ? b.persenA : b.persenB) / 100);
      if (!g) continue;
      if (b.arah === 'kiri-kanan') { if (g.u < 0) kiri = Math.max(kiri, porsi); else kanan = Math.max(kanan, porsi); }
      else if (g.v > 0) atas = Math.max(atas, porsi); else bawah = Math.max(bawah, porsi);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(bg.pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(bg.uv, 2));
    const gambar = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ ...cahaya, color: bg.warna, opacity: bg.opasitas, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    gambar.renderOrder = 2; grupBantu.add(gambar);
    //  Tulisan: lapisan tersendiri (campuran biasa, bukan aditif) di atas cahaya - di permukaan putih,
    //  cahaya aditif sudah mentok putih sehingga huruf yang hanya "lebih redup" tidak akan terlihat.
    if (bg.teks) {
      const hl = TINGGI_HURUF * 1.28, ws = 0.16, hs = hl + 0.02, tepi = 0.012;
      const pojok = (i: number, x: number, y: number, kanan: boolean, tampil: boolean): BlokTeks | null =>
        tampil && bg.teks!.lux[i] !== null ? { x, y, w: ws, h: hs, baris: [`${f(bg.teks!.lux[i]!, 0)} lx`], kanan } : null;
      const kiriAtas = !kiri && !atas;
      const blok = [
        pojok(0, tepi, tepi, false, kiriAtas),
        pojok(1, 1 - tepi - ws, tepi, true, !kanan && !atas),
        pojok(2, tepi, 1 - tepi - hs, false, !kiri && !bawah),
        pojok(3, 1 - tepi - ws, 1 - tepi - hs, true, !kanan && !bawah),
        //  Keterangan di pojok kiri atas (di bawah lux pojoknya), melewati area blending kiri / atas.
        { x: Math.min(0.5, tepi + kiri), y: Math.min(0.5, (kiriAtas ? tepi + hs : tepi) + atas), w: 0.42, h: hl * bg.teks.info.length + 0.02, baris: bg.teks.info, tebalPertama: true },
      ].filter((b): b is BlokTeks => !!b);
      gambarTeksCahaya(m, bg.teks.pos, bg.teks.uv, blok);
    }
  }
}
