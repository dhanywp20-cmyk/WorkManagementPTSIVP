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
import { arahProyektor, arahSinar, type Benda, kotakGrid, warnaSah, type Blending, type CahayaDiPermukaan, geserLensaDari, keGambar, kontrasProyektor, koreksiJarakDari, lensaDari, type Lensa, lumenDari, offsetLensaDari, permukaanUtama, rasioGambarProyektor, ronaProyektor, sinarProyektor, throwRatioDari, type Titik, warnaSinarProyektor } from '../inti';
import type * as T from 'three';
import type { KeadaanDesain } from '../useKeadaanDesain';
import { type DataBlend, gambarBlending } from './blending';
import { gambarCahayaBenda, type SumberCahaya } from './cahayaBenda';
import { gambarGridCahaya, gambarTeksCahaya, TINGGI_HURUF, type BlokTeks } from './teksCahaya';
import { aturLampuProyektor, batasProyektorNyata, kontenProyektor, type MasukanLampu } from './proyektorNyata';
import type { Mesin } from './tipe';

export type KeadaanSinar = Pick<KeadaanDesain, 'benda' | 'ruang' | 'sinar' | 'ukur' | 'labelProduk' | 'plafonDi' | 'tampilBlending' | 'detailBlending' | 'gridSinar' | 'teksSinar' | 'setInfoBlending' | 'setUkuranCahaya' | 'sinarNyata' | 'gambarLayar'>;

/** Bidang proyeksi: gambar digambar sebagai sel grid. Benda lain diterangi per titik (cahayaBenda). */
const BIDANG_PROYEKSI = new Set<Benda['jenis']>(['layar', 'bidang']);
/**
 * Tulisan keterangan & lux hanya menempel di bidang yang memang disasar proyeksi (ruangan, layar, bidang &
 * objek mapping). Proyektor / furnitur / perangkat lain yang lewat di depan lensa tetap membuat bayangan di
 * cahaya, tetapi tidak memotong tulisan & tidak mengubah jarak lempar / lux yang ditulis.
 */
const BIDANG_TEKS = new Set<Benda['jenis']>(['layar', 'bidang', 'objek', 'model']);
/** Jarak bidang gambar dari permukaan (m), tegak lurus permukaan ke arah lensa. */
const ANGKAT = 0.008;

/** Satu titik kena sinar: posisi (sudah diangkat), benda (null = ruangan), normal menghadap lensa, mesh, cos sudut datang. */
interface Kena { p: T.Vector3; id: string | null; n: T.Vector3 | null; kunci: string; cos: number }

/**
 * Dua titik di permukaan yang SAMA (boleh digabung jadi satu sel gambar): mesh yang sama & tidak menekuk tajam
 * (lengkungan layar boleh, sudut kotak / pojok dinding-lantai tidak), atau mesh lain tetapi sebidang (potongan
 * dinding di kiri-kanan jendela). Dulu cukup "benda yang sama" - lantai, dinding & plafon semuanya "ruangan",
 * jadi sel di pojok ruangan memotong miring melayang di udara.
 */
function sePermukaan(a: Kena, b: Kena): boolean {
  if (!a.n || !b.n) return a.kunci === b.kunci;
  const d = a.n.dot(b.n);
  if (a.kunci === b.kunci) return d > 0.7;
  return d > 0.995 && Math.abs(a.n.x * (b.p.x - a.p.x) + a.n.y * (b.p.y - a.p.y) + a.n.z * (b.p.z - a.p.z)) < 0.02;
}

export function gambarSinar(m: Mesin, k: KeadaanSinar, labelP: (teks: string, pos: T.Vector3, dy?: -1 | 1) => void) {
  const { THREE, grupBantu } = m;
  const { benda, ruang, sinar, ukur, labelProduk, plafonDi, tampilBlending, detailBlending, gridSinar, teksSinar, setInfoBlending, setUkuranCahaya, sinarNyata, gambarLayar } = k;
  const daftarProj = benda.filter(p => p.jenis === 'proyektor');
  //  Blending dihitung bila zonanya ditampilkan ATAU sinar nyata (ramp edge blending media server di gambar proyektor).
  const hitungBlend = (tampilBlending || (sinar && sinarNyata)) && daftarProj.length >= 2;
  if (!hitungBlend) setInfoBlending(v => (v.length ? [] : v));
  /**
   * Sinar nyata (mesin/proyektorNyata.ts): proyektor = lampu sungguhan bergambar, terang dari lumen vs cahaya ruangan,
   * bayangan & bahan permukaan asli. Mati: penanda warna rancangan (lapisan aditif per proyektor) seperti dulu.
   */
  const nyata = sinar && sinarNyata && daftarProj.length <= batasProyektorNyata(m);
  if (!nyata) aturLampuProyektor(m, []);
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

  /** Matriks normal (lokal -> dunia) per mesh, dihitung sekali per gambar. */
  const matNormal = new Map<string, T.Matrix3>();
  const matN = (o: T.Object3D) => {
    let x = matNormal.get(o.uuid);
    if (!x) { x = new THREE.Matrix3().getNormalMatrix(o.matrixWorld); matNormal.set(o.uuid, x); }
    return x;
  };
  /** Titik permukaan pertama yang terkena sinar (kaca & bayangan ditembus) + benda yang dikenai (null = ruangan). */
  const tembakRinci = (O: T.Vector3, arah: T.Vector3, sasaran: T.Object3D[]): Kena | null => {
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
    //  Normal permukaan HALUS (interpolasi normal titik sudut - lengkung layar terbaca mulus, bukan per faset),
    //  dibalik bila perlu supaya MENGHADAP LENSA (sisi yang disinari).
    const nLokal = (hit as { normal?: T.Vector3 }).normal ?? hit.face?.normal;
    const n = nLokal ? nLokal.clone().applyMatrix3(matN(hit.object)).normalize() : null;
    if (n && n.dot(arah) > 0) n.negate();
    //  Bidang gambar diangkat 8 mm TEGAK LURUS permukaan, bukan mundur menyusuri sinar: sinar yang datang
    //  miring (layar cembung / lengkung dari samping, lantai) dulu hanya terangkat beberapa mm sehingga sel
    //  gambar tenggelam di balik lengkungan -> cahaya belang-belang tegak di depan & tembus di belakang layar.
    const p = n ? hit.point.clone().addScaledVector(n, ANGKAT) : hit.point.clone().addScaledVector(arah, -0.012);
    return { p, id: (o?.userData.id as string | undefined) ?? null, n, kunci: hit.object.uuid, cos: n ? -n.dot(arah) : 1 };
  };
  const tembak = (O: T.Vector3, arah: T.Vector3, sasaran: T.Object3D[]) => tembakRinci(O, arah, sasaran)?.p ?? null;
  /** Titik terkena benda yang diterangi per titik (bukan bidang proyeksi). */
  const diBenda = (id: string | null) => !!id && !BIDANG_PROYEKSI.has(jenisDari.get(id) ?? 'objek');
  /** Titik terkena layar / bidang mapping (sasaran "Mask ke bidang"). */
  const diBidang = (id: string | null) => !!id && BIDANG_PROYEKSI.has(jenisDari.get(id) ?? 'objek');
  /** Nama bidang mapping / objek / model yang paling banyak disinari (bukan dinding). */
  const namaBenda = new Map(benda.map(b => [b.id, b.nama]));
  const namaPermukaan = (kenaId: (string | null)[]) => {
    const id = permukaanUtama(kenaId, x => BIDANG_TEKS.has(jenisDari.get(x) ?? 'kursi'));
    return id ? namaBenda.get(id) ?? null : null;
  };

  /** Data per proyektor untuk area blending (inti/blending.ts). */
  const dataBlend: DataBlend[] = [];
  const sumberCahaya: SumberCahaya[] = [];
  /** Bidang gambar tiap proyektor - dibuat SETELAH blending dihitung, supaya keterangan tidak jatuh di area tumpang tindih. */
  const bidangGambar: { p: Benda; L: Lensa; pos: number[]; uv: number[]; warnaTitik: number[]; opasitas: number; warna: T.Color; tepi: T.Color; lebar: number; tinggi: number; permukaan: string | null; teks: { info: string[]; lux: (number | null)[]; pos: number[]; uv: number[] } | null; normal: T.Vector3 | null }[] = [];
  const bendaTersinari = new Set<string>();
  daftarProj.forEach((p, idx) => {
    const sn = sinarProyektor(p, benda, ruang);
    //  O = puncak kerucut sinar (ujung lensa mundur sejauh koreksi jarak b, inti/blending.ts lensaDari) - semua sinar,
    //  jarak untuk lux & ukuran gambar dari sini. Kerucut & kilau tetap digambar dari ujung lensa (`ujung`).
    const kj = koreksiJarakDari(p);
    const O = new THREE.Vector3(...lensaDari(p).O), ujung = new THREE.Vector3(...sn.asal);
    const sendiri = m.cache.get(p.id)?.obj;
    const sasaran = [...m.grupRuang.children, ...m.grupBenda.children.filter(o => o !== sendiri && !o.userData.sorot)];
    const r = (p.rot * Math.PI) / 180;
    const D = new THREE.Vector3(...arahProyektor(p)).normalize();
    const kanan = new THREE.Vector3(-Math.cos(r), 0, Math.sin(r));
    const atas = new THREE.Vector3().crossVectors(kanan, D).normalize();
    const w1 = 1 / throwRatioDari(p), h1 = w1 * rasioGambarProyektor(p), arahV = p.pasangProyektor === 'meja' ? 1 : -1;
    const offV = offsetLensaDari(p), gH = geserLensaDari(p);
    const arah = new THREE.Vector3();
    /** Arah sinar ke titik gambar (u, v), -0,5..0,5 - rumus yang sama dengan inti/blending.ts. */
    const arahUV = (u: number, v: number) => arah.copy(D).addScaledVector(kanan, (u + gH) * w1).addScaledVector(atas, (v + arahV * offV) * h1).normalize();
    const kena: (T.Vector3 | null)[] = [], kenaId: (string | null)[] = [], rinci: (Kena | null)[] = [];
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const t = tembakRinci(O, arahUV(i / (NX - 1) - 0.5, j / (NY - 1) - 0.5), sasaran);
      kena.push(t?.p ?? null); kenaId.push(t?.id ?? null); rinci.push(t);
      if (t && diBenda(t.id)) bendaTersinari.add(t.id!);
    }
    const sel = (i: number, j: number) => kena[j * NX + i];
    /** Segitiga permukaan yang tersinari proyektor ini (semua permukaan, termasuk benda) - dasar zona blending. */
    const zona: number[] = [], zonaN: number[] = [], zonaMesh: string[] = [];
    /** Satu segitiga zona: titik, normal (menghadap lensa) & mesh permukaannya. */
    const keZona = (t: Kena[], mesh: string) => {
      for (const x of t) { const n = x.n ?? O.clone().sub(x.p).normalize(); zona.push(x.p.x, x.p.y, x.p.z); zonaN.push(n.x, n.y, n.z); }
      zonaMesh.push(mesh);
    };
    if (hitungBlend) {
      //  Garis tengah mendatar & tegak gambar, sampel rapat (lebih kasar saat menyeret) - dasar ukur blending.
      const L = lensaDari(p), NB = kasar ? 31 : 81, NV = kasar ? 21 : 49;
      const keT = (v: T.Vector3 | null): Titik | null => (v ? [v.x, v.y, v.z] : null);
      const sampel = (u: number, v: number) => keT(tembak(O, arah.set(...arahSinar(L, u, v)), sasaran));
      dataBlend.push({
        p, L, O, sasaran, zona, zonaN, zonaMesh,
        baris: Array.from({ length: NB }, (_, i) => sampel(i / (NB - 1) - 0.5, 0)),
        kolom: Array.from({ length: NV }, (_, j) => sampel(0, j / (NV - 1) - 0.5)),
      });
    }
    if (!sinar && !hitungBlend) return;
    const warna = new THREE.Color(warnaSinarProyektor(p, idx, daftarProj.length));
    if (sinar && !nyata) sumberCahaya.push({ O, L: lensaDari(p), sasaran, kuat: (sn.layar ? 0.8 : 1) * (banyak ? 0.6 : 1), warna: [warna.r, warna.g, warna.b] });

    //  Bidang gambar: sel grid yang keempat sudutnya kena SATU permukaan (sePermukaan) & tidak "melompat".
    //  Sel CAMPURAN - sudut-sudutnya di permukaan berbeda (tepi layar / bidang mapping -> dinding di
    //  belakangnya, pojok dinding-lantai, tepi benda & bayangannya) - dipecah 8x8 dengan sinar tambahan,
    //  sehingga tepi cahaya tajam & menekuk tepat di pojok, bukan zigzag selebar sel grid. Sel yang
    //  seluruhnya di benda: cahayaBenda (zona blending tetap ikut).
    //  Mask ke bidang (p.maskBidang): hanya bagian yang jatuh di layar / bidang mapping yang digambar - seperti
    //  masking di media server; cahaya di luar bidang (dinding, lantai) tidak tampil.
    //  uv = koordinat gambar (0..1) tiap titik - tekstur cahaya (& keterangannya) jatuh tepat di bidang.
    //  Urutan titik tiap segitiga berlawanan jarum jam DILIHAT DARI LENSA: sisi depannya menghadap lensa, jadi
    //  cahaya (FrontSide) ikut "tembus" bersama dinding yang disembunyikan dan tidak tampil dari balik layar.
    const mask = !!p.maskBidang;
    /** Boleh digambar: bukan benda (benda diterangi lewat cahayaBenda) & - bila di-mask - di layar / bidang. */
    const bolehId = (id: string | null) => !diBenda(id) && (!mask || diBidang(id));
    /** Ikut zona blending: semua permukaan yang benar-benar menerima gambar (di-mask: hanya layar / bidang). */
    const bolehZona = (id: string | null) => !mask || diBidang(id);
    //  Terang cahaya per titik seperti kenyataan: iluminansi E ∝ cos(sudut datang) / (cos³(sudut ke sumbu) ·
    //  jarak²), relatif terhadap pusat gambar. Cahaya yang lewat tepi layar & jatuh di dinding jauh di
    //  belakangnya / lantai yang terkena miring jadi lebih redup - bukan selembar warna rata di mana-mana.
    const terang = (P: T.Vector3, n: T.Vector3 | null) => {
      const r = P.clone().sub(O), d2 = Math.max(0.01, r.lengthSq()); r.normalize();
      const cosA = Math.max(0.2, r.dot(D)), cosT = n ? Math.abs(r.dot(n)) : 1;
      return Math.max(0.05, cosT) / (cosA ** 3 * d2);
    };
    const pusatGambar = tembakRinci(O, arahUV(0, 0).clone(), sasaran);
    const terangAcuan = pusatGambar ? terang(pusatGambar.p, pusatGambar.n) : 1 / Math.max(0.25, sn.jarak ** 2);
    /** Faktor terang 0,06..1,4 (1 = pusat gambar). */
    const faktor = (P: T.Vector3, n: T.Vector3 | null) => Math.min(1.4, Math.max(0.06, terang(P, n) / terangAcuan));
    const pos: number[] = [], uv: number[] = [], warnaTitik: number[] = [];
    const quadKe = (P: number[], U: number[], W?: number[]) => (A: T.Vector3, B: T.Vector3, C: T.Vector3, Dd: T.Vector3, batas: number, u0: number, v0: number, u1: number, v1: number, k?: number[]) => {
      if (A.distanceTo(B) > batas || B.distanceTo(C) > batas || C.distanceTo(Dd) > batas || Dd.distanceTo(A) > batas) return;
      P.push(A.x, A.y, A.z, B.x, B.y, B.z, C.x, C.y, C.z, A.x, A.y, A.z, C.x, C.y, C.z, Dd.x, Dd.y, Dd.z);
      U.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
      if (W) for (const s of [0, 1, 2, 0, 2, 3]) { const f = k?.[s] ?? 1; W.push(warna.r * f, warna.g * f, warna.b * f); }
    };
    const quad = quadKe(pos, uv, warnaTitik);
    /**
     * Sisi sel terpanjang yang masih wajar: selebar sel grid di jarak itu, dibagi cos sudut datang (permukaan yang
     * disinari miring - lantai, ujung layar lengkung - memang memanjangkan sel). Lebih dari itu = sel "melompat"
     * (tepi benda ke dinding di belakangnya). Dulu batasnya tetap 6x, sehingga sel di permukaan yang disinari
     * sangat miring ikut dibuang & cahaya berlubang bertangga.
     */
    const batasSel = (jarak: number, cos: number, bagi = 1) => ((jarak * w1) / (NX - 1) / bagi) * Math.max(6, 2.5 / Math.max(0.05, cos)) + 0.05;
    /** Satu sel (4 titik satu permukaan) -> bidang cahaya (bukan benda / di-mask) & zona blending. */
    const isi = (q: Kena[], batas: number, u0: number, v0: number, u1: number, v1: number) => {
      if (q.some((x, s) => x.p.distanceTo(q[(s + 1) % 4].p) > batas)) return;
      const [A, B, C, Dd] = q.map(x => x.p), id = q[0].id;
      if (hitungBlend && bolehZona(id)) { keZona([q[0], q[1], q[2]], q[0].kunci); keZona([q[0], q[2], q[3]], q[0].kunci); }
      if (sinar && bolehId(id)) quad(A, B, C, Dd, Infinity, u0, v0, u1, v1, q.map(x => faktor(x.p, x.n)));
    };
    const satuSel = (q: (Kena | null)[]): q is Kena[] => q.every(x => !!x && x.id === q[0]!.id && sePermukaan(q[0]!, x));
    /**
     * Sel satu permukaan yang terlalu MELENGKUNG untuk digambar sebagai satu segi empat datar: tali busur sel
     * (panjang c, normal sudut-sudutnya berbeda θ) masuk ke balik lengkungan sejauh ±c·θ/8. Di layar lengkung /
     * cembung yang disinari sangat miring (dekat garis singgung) sel membentang panjang & tenggelam lebih dalam
     * dari ANGKAT -> separuh segitiganya tertutup permukaan (gerigi). Sel seperti ini dipecah S x S.
     */
    const melengkung = (q: Kena[]) => {
      let c = 0, d = 1;
      for (let s = 0; s < 4; s++) {
        c = Math.max(c, q[s].p.distanceTo(q[(s + 1) % 4].p));
        if (q[s].n && q[0].n) d = Math.min(d, q[s].n!.dot(q[0].n!));
      }
      return (c * Math.acos(Math.min(1, d))) / 8 > ANGKAT * 0.5;
    };
    /**
     * Sub-sel TEPI (sudut-sudutnya di permukaan berbeda - tepi bayangan benda, tepi layar -> dinding di belakangnya,
     * pojok ruangan): tiap permukaan di sub-sel ini digambar sampai TEPAT di batasnya. Titik batas di tiap sisi yang
     * menyeberang dicari dengan membagi dua sinar (3x -> ±1/64 sel grid), lalu poligonnya (marching squares)
     * dipecah segitiga. Dulu sub-sel campuran dibuang utuh -> tepi bayangan & tepi layar bertangga.
     */
    const tepiHalus = (s4: (Kena | null)[], uvS: number[][], jarak: number) => {
      const sudah: Kena[] = [];
      for (const rep of s4) {
        if (!rep || sudah.some(x => x.id === rep.id && sePermukaan(x, rep))) continue;
        sudah.push(rep);
        const lampu = sinar && bolehId(rep.id), zon = hitungBlend && bolehZona(rep.id);
        if (!lampu && !zon) continue;
        const anggota = (x: Kena | null): x is Kena => !!x && x.id === rep.id && sePermukaan(rep, x);
        const dalam = s4.map(anggota);
        //  Pelana (dua sudut berseberangan): jarang & ambigu - dilewati.
        if (dalam[0] === dalam[2] && dalam[1] === dalam[3] && dalam[0] !== dalam[1]) continue;
        const poli: { k: Kena; u: number; v: number }[] = [];
        for (let k = 0; k < 4; k++) {
          const k2 = (k + 1) % 4;
          if (dalam[k]) poli.push({ k: s4[k]!, u: uvS[k][0], v: uvS[k][1] });
          if (dalam[k] === dalam[k2]) continue;
          const [ia, ib] = dalam[k] ? [k, k2] : [k2, k];
          const di = (t: number) => [uvS[ia][0] + (uvS[ib][0] - uvS[ia][0]) * t, uvS[ia][1] + (uvS[ib][1] - uvS[ia][1]) * t];
          let lo = 0, hi = 1, kenaLo = s4[ia]!;
          for (let n = 0; n < 3; n++) {
            const t = (lo + hi) / 2, [u, v] = di(t), h = tembakRinci(O, arahUV(u - 0.5, v - 0.5), sasaran);
            if (anggota(h)) { lo = t; kenaLo = h; } else hi = t;
          }
          const [u, v] = di(lo);
          poli.push({ k: kenaLo, u, v });
        }
        if (poli.length < 3) continue;
        const batas = batasSel(jarak, Math.min(...poli.map(x => x.k.cos)), S);
        if (poli.some((x, s) => x.k.p.distanceTo(poli[(s + 1) % poli.length].k.p) > batas)) continue;
        const f = lampu ? poli.map(x => faktor(x.k.p, x.k.n)) : [];
        //  Kipas segitiga dari titik pertama - urutan keliling tetap berlawanan jarum jam dari lensa.
        for (let s = 1; s + 1 < poli.length; s++) {
          if (zon) keZona([poli[0].k, poli[s].k, poli[s + 1].k], rep.kunci);
          if (lampu) for (const n of [0, s, s + 1]) {
            const P = poli[n].k.p;
            pos.push(P.x, P.y, P.z); uv.push(poli[n].u, poli[n].v); warnaTitik.push(warna.r * f[n], warna.g * f[n], warna.b * f[n]);
          }
        }
      }
    };
    const gu = (i: number) => i / (NX - 1), gv = (j: number) => j / (NY - 1);
    const S = 8;
    for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) {
      const q = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([a, b]) => rinci[b * NX + a]);
      const ada = q.filter((x): x is Kena => !!x);
      if (!ada.length) continue;
      const jarak = ada.reduce((s, x) => s + x.p.distanceTo(O), 0) / ada.length;
      const satu = satuSel(q);
      if (satu && (kasar || !melengkung(q))) { isi(q, batasSel(jarak, Math.min(...q.map(x => x.cos))), gu(i), gv(j), gu(i + 1), gv(j + 1)); continue; }
      if (kasar) continue;
      //  Sel campuran (tepi benda / bayangannya, tepi layar / bidang, pojok ruangan, sinar yang lolos keluar):
      //  grid (S+1)x(S+1) sinar di dalam sel ini; sub-sel satu permukaan digambar utuh, sub-sel tepi lewat tepiHalus.
      const sub: (Kena | null)[] = [];
      for (let b = 0; b <= S; b++) for (let a = 0; a <= S; a++) {
        sub.push(tembakRinci(O, arahUV((i + a / S) / (NX - 1) - 0.5, (j + b / S) / (NY - 1) - 0.5), sasaran));
      }
      const t = (a: number, b: number) => sub[b * (S + 1) + a];
      for (let b = 0; b < S; b++) for (let a = 0; a < S; a++) {
        const s4 = [t(a, b), t(a + 1, b), t(a + 1, b + 1), t(a, b + 1)];
        const u0 = gu(i + a / S), v0 = gv(j + b / S), u1 = gu(i + (a + 1) / S), v1 = gv(j + (b + 1) / S);
        if (satuSel(s4)) isi(s4, batasSel(jarak, Math.min(...s4.map(x => x.cos)), S), u0, v0, u1, v1);
        else tepiHalus(s4, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], jarak);
      }
    }
    if (!sinar) return;
    //  Tepi gambar (warna per proyektor) + kerucut cahaya dari lensa ke tepi itu. Di-mask: tiap titik tepi
    //  ditarik ke arah pusat gambar sampai mengenai layar / bidang - kerucut berakhir di tepi area yang tampil.
    const ci = (NX - 1) / 2, cj = (NY - 1) / 2;
    const titikTepi = (i: number, j: number): Kena | null => {
      if (!mask) return rinci[j * NX + i];
      for (let n = 0; n <= 24; n++) {
        const ii = Math.round(i + ((ci - i) * n) / 24), jj = Math.round(j + ((cj - j) * n) / 24), t = rinci[jj * NX + ii];
        if (t && diBidang(t.id)) return t;
      }
      return null;
    };
    const tepi: (Kena | null)[] = [];
    for (let i = 0; i < NX; i++) tepi.push(titikTepi(i, 0));
    for (let j = 1; j < NY; j++) tepi.push(titikTepi(NX - 1, j));
    for (let i = NX - 2; i >= 0; i--) tepi.push(titikTepi(i, NY - 1));
    for (let j = NY - 2; j > 0; j--) tepi.push(titikTepi(0, j));
    //  Garis tepi: warna sinar yang lebih pekat (pilihan engineer) atau rona otomatis proyektor ini.
    const warnaTepi = p.warnaSinar ? warna.clone().offsetHSL(0, 0.1, -0.18) : new THREE.Color().setHSL(ronaProyektor(idx), 0.9, 0.55);
    //  Garis tepi berupa pita tipis MENEMPEL di permukaan (sisi depan menghadap lensa), bukan garis 1 px:
    //  garis tidak bisa ikut "tembus" bersama dinding yang disembunyikan & dulu tampak melayang di udara.
    const lebarGaris = Math.min(0.03, Math.max(0.01, sn.jarak * w1 * 0.003));
    const keLensa = (P: T.Vector3) => O.clone().sub(P).normalize();
    const pita: number[] = [], kerucut: number[] = [], alfa: number[] = [];
    //  Sinar nyata: tanpa kerucut berwarna & pita tepi (di udara cahaya proyektor tidak terlihat tanpa asap) - cukup
    //  4 garis frustum tipis dari lensa ke pojok gambar sebagai alat bantu rancangan.
    if (nyata) {
      const pojokG = [rinci[0], rinci[NX - 1], rinci[NX * NY - 1], rinci[(NY - 1) * NX]].filter((x): x is Kena => !!x);
      const garisF: number[] = [];
      for (const q of pojokG) garisF.push(ujung.x, ujung.y, ujung.z, q.p.x, q.p.y, q.p.z);
      if (garisF.length) {
        const gf = new THREE.BufferGeometry(); gf.setAttribute('position', new THREE.Float32BufferAttribute(garisF, 3));
        grupBantu.add(new THREE.LineSegments(gf, new THREE.LineBasicMaterial({ ...cahaya, color: warnaTepi, opacity: 0.55 })));
      }
    }
    for (let i = 0; i < tepi.length && !nyata; i++) {
      const A = tepi[i], B = tepi[(i + 1) % tepi.length];
      if (!A || !B) continue;
      if (A.p.distanceTo(B.p) < Math.max(0.6, A.p.distanceTo(O) * w1 * 0.4)) {
        const n = new THREE.Vector3().addVectors(A.n ?? keLensa(A.p), B.n ?? keLensa(B.p)).normalize();
        const s = new THREE.Vector3().crossVectors(n, B.p.clone().sub(A.p)).normalize().multiplyScalar(lebarGaris / 2);
        const a0 = A.p.clone().sub(s), a1 = A.p.clone().add(s), b0 = B.p.clone().sub(s), b1 = B.p.clone().add(s);
        for (const v of [a0, b0, b1, a0, b1, a1]) pita.push(v.x, v.y, v.z);
      }
      kerucut.push(ujung.x, ujung.y, ujung.z, A.p.x, A.p.y, A.p.z, B.p.x, B.p.y, B.p.z);
      //  Kerucut: pekat di lensa (warna tepi), memudar ke bidang (warna sinar).
      alfa.push(warnaTepi.r, warnaTepi.g, warnaTepi.b, 0.45 * redam, warna.r, warna.g, warna.b, 0.08 * redam, warna.r, warna.g, warna.b, 0.08 * redam);
    }
    if (pita.length) {
      const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(pita, 3));
      const garisTepi = new THREE.Mesh(g2, new THREE.MeshBasicMaterial({ ...cahaya, color: warnaTepi, opacity: 0.95, side: THREE.FrontSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
      garisTepi.renderOrder = 3; grupBantu.add(garisTepi);
    }
    if (kerucut.length) {
      const g3 = new THREE.BufferGeometry();
      g3.setAttribute('position', new THREE.Float32BufferAttribute(kerucut, 3)); g3.setAttribute('color', new THREE.Float32BufferAttribute(alfa, 4));
      const kerucutSinar = new THREE.Mesh(g3, new THREE.MeshBasicMaterial({ ...cahaya, vertexColors: true, side: THREE.DoubleSide }));
      kerucutSinar.renderOrder = 2; grupBantu.add(kerucutSinar);
    }
    const kilau = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 8), new THREE.MeshBasicMaterial({ ...cahaya, color: 0xfffbeb, blending: THREE.AdditiveBlending, opacity: 0.95 }));
    kilau.position.copy(ujung); grupBantu.add(kilau);
    //  Grid tulisan: sinar yang hanya mengenai bidang sasaran (BIDANG_TEKS) - tulisan utuh walau ada benda
    //  di depan lensa. Saklar "Keterangan sinar"; saat menyeret tanpa tulisan (tekstur tidak dibuat ulang tiap frame).
    const tulis = teksSinar && !kasar;
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
    //  Jarak sepanjang sumbu dari PUNCAK sinar (ukuran gambar = jarak x w1); yang ditulis = dari ujung lensa (- b).
    const jarakSumbu = sn.layar ? sn.jarak + kj : tengah ? tengah.distanceTo(O) : sn.jarak + kj;
    //  Lux di titik gambar (u, v): fluks lensa merata di bidang tegak lurus sumbu -> E = lumen/(w1·h1) ·
    //  cos(sudut datang) / (cos³(sudut ke sumbu) · jarak²). Di pusat bidang tegak = lumen / luas gambar.
    const E0 = lumenDari(p) / (w1 * h1);
    const luxDi = (u: number, v: number) => {
      const r = arahUV(u, v).clone(), t = tembakRinci(O, r, sasaranTeks);
      if (!t) return null;
      const d = t.p.distanceTo(O), cosA = Math.max(0.2, r.dot(D)), cosT = t.n ? Math.abs(r.dot(t.n)) : 1;
      return (E0 * cosT) / (cosA ** 3 * d * d);
    };
    bidangGambar.push({ p, L: lensaDari(p), normal: pusatGambar?.n ?? null, pos, uv, warnaTitik, warna, tepi: warnaTepi, lebar: jarakSumbu * w1, tinggi: jarakSumbu * h1, permukaan: sn.layar ? null : namaPermukaan(kenaId), opasitas: (sn.layar ? 0.26 : 0.34) * (banyak ? 0.6 : 1),
      teks: tulis ? {
        info: [p.nama, `Jarak lensa → bidang ${f(jarakSumbu - kj)} m`, `Ukuran gambar ±${f(jarakSumbu * w1)} × ${f(jarakSumbu * h1)} m`,
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
  if (sinar && !nyata && bendaTersinari.size) {
    const akar = [...bendaTersinari].map(id => m.cache.get(id)?.obj).filter((o): o is T.Object3D => !!o);
    gambarCahayaBenda(m, sumberCahaya, akar, kasar);
  }
  const blending: Blending[] = hitungBlend ? gambarBlending(m, dataBlend, setInfoBlending, detailBlending, tampilBlending) : [];
  //  Mode grid (bukan saat menyeret - tekstur tidak dibuat ulang tiap frame): cahaya diredam, pola garis menonjol.
  const grid = gridSinar && !kasar;
  //  Ukuran gambar di permukaan yang benar-benar disinari (layar mapping, benda, dinding) untuk panel proyektor.
  if (!kasar) {
    const ukuran: Record<string, CahayaDiPermukaan> = {};
    for (const bg of bidangGambar) ukuran[bg.p.id] = { lebar: Math.round(bg.lebar * 1000) / 1000, tinggi: Math.round(bg.tinggi * 1000) / 1000, permukaan: bg.permukaan };
    setUkuranCahaya(v => (JSON.stringify(v) === JSON.stringify(ukuran) ? v : ukuran));
  }
  const lampu: MasukanLampu[] = [];
  for (const bg of bidangGambar) {
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
    if (nyata) {
      //  Lampu sungguhan (mesin/proyektorNyata.ts): konten x keseragaman lensa x ramp edge blending x mask bidang.
      const kt = kontenProyektor(THREE, bg.p, gridSinar, bg.lebar, bg.tinggi, gambarLayar.current);
      const kp = kontrasProyektor(bg.p, benda, ruang, 15);
      lampu.push({ p: bg.p, L: bg.L, normal: bg.normal, luxAmbien: kp.cahaya.total, luxGambar: kp.luxGambar,
        konten: kt.sumber, kunciKonten: kt.kunci, mati: kt.mati, blend: { kiri, kanan, atas, bawah }, maskUv: bg.p.maskBidang ? bg.uv : null });
    }
    if (!bg.pos.length) continue;
    if (!nyata) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(bg.pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(bg.uv, 2));
      //  Warna per titik = warna sinar x faktor terang (jarak & sudut datang) - lihat `terang` di atas.
      geo.setAttribute('color', new THREE.Float32BufferAttribute(bg.warnaTitik, 3));
      //  FrontSide: segitiga menghadap lensa (lihat sel di atas) - tidak tampil dari balik layar / dinding tembus.
      const gambar = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ ...cahaya, vertexColors: true, opacity: bg.opasitas * (grid ? 0.45 : 1), side: THREE.FrontSide, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
      gambar.renderOrder = 2; grupBantu.add(gambar);
      if (grid) {
        const kg = kotakGrid(bg.lebar, bg.tinggi, bg.p.gridKolom);
        const wg = warnaSah(bg.p.warnaGrid);
        gambarGridCahaya(m, bg.pos, bg.uv, wg ? new THREE.Color(wg) : bg.tepi, kg.kolom, kg.baris);
      }
    }
    //  Tulisan: lapisan tersendiri (campuran biasa, bukan aditif) di atas cahaya - di permukaan putih,
    //  cahaya aditif sudah mentok putih sehingga huruf yang hanya "lebih redup" tidak akan terlihat.
    if (bg.teks) {
      const hl = TINGGI_HURUF * 1.28, ws = 0.09, hs = hl + 0.012, tepi = 0.01;
      const pojok = (i: number, x: number, y: number, kanan: boolean, tampil: boolean): BlokTeks | null =>
        tampil && bg.teks!.lux[i] !== null ? { x, y, w: ws, h: hs, baris: [`${f(bg.teks!.lux[i]!, 0)} lx`], kanan } : null;
      const kiriAtas = !kiri && !atas;
      const blok = [
        pojok(0, tepi, tepi, false, kiriAtas),
        pojok(1, 1 - tepi - ws, tepi, true, !kanan && !atas),
        pojok(2, tepi, 1 - tepi - hs, false, !kiri && !bawah),
        pojok(3, 1 - tepi - ws, 1 - tepi - hs, true, !kanan && !bawah),
        //  Keterangan di pojok kiri atas (di bawah lux pojoknya), melewati area blending kiri / atas.
        { x: Math.min(0.5, tepi + kiri), y: Math.min(0.5, (kiriAtas ? tepi + hs : tepi) + atas), w: 0.24, h: hl * bg.teks.info.length + 0.012, baris: bg.teks.info, tebalPertama: true },
      ].filter((b): b is BlokTeks => !!b);
      gambarTeksCahaya(m, bg.teks.pos, bg.teks.uv, blok);
    }
  }
  if (nyata) aturLampuProyektor(m, lampu);
}
