/**
 * desain3d/inti/blending.ts - Area blending antar proyektor (edge blending): bagian permukaan yang
 * disinari dua proyektor sekaligus. Lebar diukur menyusuri permukaan (cm, ikut menekuk di layar
 * lengkung / sudut dinding) dan persennya terhadap lebar gambar MASING-MASING proyektor - angka
 * yang diisi di software blending (mis. 15% = 288 px dari 1920 px).
 *
 * Murni: tanpa three.js / React / DOM (diuji di uji/blending-proyektor.ts). Titik permukaan
 * (hasil raycast) & uji keterhalangan diberikan pemanggil (mesin/alatBantu.ts).
 */
import { arahProyektor, geserLensaDari, keDunia, lensaProyektor, offsetLensaDari, throwRatioDari } from './proyektor';
import type { Benda, Titik } from './tipe';

/** Model lensa proyektor: basis ortonormal (sumbu, kanan, atas) + lebar/tinggi gambar per meter lempar. */
export interface Lensa {
  O: Titik; D: Titik; kanan: Titik; atas: Titik;
  /** lebar & tinggi gambar per 1 m jarak lempar (16:9) */ w1: number; h1: number;
  /** pergeseran pusat gambar (lens shift) dalam pecahan lebar / tinggi gambar */ gH: number; gV: number;
}

const tambah = (a: Titik, b: Titik, k = 1): Titik => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const kurang = (a: Titik, b: Titik): Titik => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const titik = (a: Titik, b: Titik) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const silang = (a: Titik, b: Titik): Titik => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const panjang = (a: Titik) => Math.hypot(a[0], a[1], a[2]);
const satuan = (a: Titik): Titik => { const l = panjang(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const jarakTitik = (a: Titik, b: Titik) => panjang(kurang(a, b));

/** Lensa proyektor di dunia - rumus yang sama dengan sinar di kanvas (TR/zoom, lens shift, pan & tilt). */
export function lensaDari(p: Benda): Lensa {
  const r = (p.rot * Math.PI) / 180;
  const D = satuan(arahProyektor(p));
  const kanan: Titik = [-Math.cos(r), 0, Math.sin(r)];
  const atas = satuan(silang(kanan, D));
  const w1 = 1 / throwRatioDari(p), h1 = (w1 * 9) / 16;
  //  Gantung plafon = terbalik: offset vertikal lensa ke bawah sumbu.
  const arahV = p.pasangProyektor === 'meja' ? 1 : -1;
  return { O: keDunia(p, lensaProyektor(p)), D, kanan, atas, w1, h1, gH: geserLensaDari(p), gV: arahV * offsetLensaDari(p) };
}

/** Arah sinar ke titik gambar (u, v) - u, v dari -0,5 (kiri / bawah) sampai 0,5 (kanan / atas). */
export function arahSinar(L: Lensa, u: number, v: number): Titik {
  return satuan(tambah(tambah(L.D, L.kanan, (u + L.gH) * L.w1), L.atas, (v + L.gV) * L.h1));
}

/** Kebalikan arahSinar: koordinat gambar (u, v) titik dunia X, atau null bila di belakang lensa. */
export function keGambar(L: Lensa, X: Titik): { u: number; v: number } | null {
  const w = kurang(X, L.O);
  const t = titik(w, L.D);
  if (t <= 1e-6) return null;
  return { u: titik(w, L.kanan) / t / L.w1 - L.gH, v: titik(w, L.atas) / t / L.h1 - L.gV };
}

/** Titik X berada di dalam bingkai gambar proyektor (belum memeriksa keterhalangan). */
export function dalamGambar(L: Lensa, X: Titik): boolean {
  const k = keGambar(L, X);
  return !!k && Math.abs(k.u) <= 0.5 + 1e-9 && Math.abs(k.v) <= 0.5 + 1e-9;
}

/** Panjang polyline titik-titik berurutan (null = sinar tidak mengenai apa pun - memutus garis). */
function panjangGaris(t: (Titik | null)[], dari = 0, sampai = t.length - 1): number {
  let s = 0;
  for (let i = dari + 1; i <= sampai; i++) { const a = t[i - 1], b = t[i]; if (a && b) s += jarakTitik(a, b); }
  return s;
}

/** Sisa ruang di dalam bingkai gambar L pada titik X: >= 0 di dalam (0 = tepat di tepi), null di belakang lensa. */
function sisaBingkai(L: Lensa, X: Titik): number | null {
  const k = keGambar(L, X);
  return k ? 0.5 - Math.max(Math.abs(k.u), Math.abs(k.v)) : null;
}

/**
 * Tumpang tindih satu garis sampel gambar proyektor A (titik permukaan berurutan dari tepi ke tepi,
 * jarak SERAGAM dalam koordinat gambar) dengan gambar proyektor B: run terpanjang titik yang juga
 * disinari B. Tepi run berada di antara dua sampel: bila sampel luarnya keluar bingkai B, titik tepi
 * diinterpolasi tepat di garis bingkai B; selain itu (terhalang / tidak kena) diambil setengah sampel.
 *   - lebarM : panjang run menyusuri permukaan (ikut menekuk di layar lengkung)
 *   - persen : porsi run terhadap lebar GAMBAR (koordinat lensa = piksel) - angka yang diisi di
 *              software blending; tidak terpengaruh gambar yang tumpah ke dinding di luar layar.
 *   - garis  : titik permukaan dari tepi ke tepi area blending (untuk garis ukur berpanah).
 */
export function tumpangGaris(garisA: (Titik | null)[], LB: Lensa, terlihatB: (X: Titik) => boolean = () => true):
  { lebarM: number; persen: number; tengah: Titik; garis: Titik[] } | null {
  const n = garisA.length;
  if (n < 2 || panjangGaris(garisA) <= 1e-6) return null;
  const masuk = garisA.map(x => !!x && dalamGambar(LB, x) && terlihatB(x));
  let terbaik: [number, number] | null = null;
  for (let i = 0; i < masuk.length; i++) {
    if (!masuk[i]) continue;
    let j = i; while (j + 1 < masuk.length && masuk[j + 1]) j++;
    if (!terbaik || j - i > terbaik[1] - terbaik[0]) terbaik = [i, j];
    i = j;
  }
  if (!terbaik) return null;
  const [s, e] = terbaik;
  //  Segmen yang "melompat" (gambar tumpah ke permukaan lain) tidak dipakai untuk tepi: > 3x median.
  const seg = garisA.slice(1).map((b, i) => (b && garisA[i] ? jarakTitik(garisA[i]!, b) : 0)).filter(x => x > 0).sort((a, b) => a - b);
  const batasSeg = (seg[Math.floor(seg.length / 2)] ?? 0) * 3;
  /** Tepi di luar sampel `dalam` ke arah sampel `luar`: porsi segmen yang masih di dalam & titiknya. */
  const tepi = (dalam: number, luar: number): { t: number; X: Titik } => {
    const a = garisA[dalam]!, b = garisA[luar];
    if (!b || jarakTitik(a, b) > batasSeg) return { t: 0.5, X: a };
    const fa = sisaBingkai(LB, a), fb = sisaBingkai(LB, b);
    const t = fa !== null && fb !== null && fb < 0 ? Math.min(1, Math.max(0, fa / (fa - fb))) : 0.5;
    return { t, X: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t] };
  };
  const awal = s > 0 ? tepi(s, s - 1) : { t: 0, X: garisA[s]! };
  const akhir = e < n - 1 ? tepi(e, e + 1) : { t: 0, X: garisA[e]! };
  const lebar = panjangGaris(garisA, s, e) + jarakTitik(awal.X, garisA[s]!) + jarakTitik(akhir.X, garisA[e]!);
  const porsi = (e - s + awal.t + akhir.t) / (n - 1);
  if (lebar < 0.005) return null;
  const m = Math.round((s + e) / 2);
  const garis = [awal.X, ...(garisA.slice(s, e + 1) as Titik[]), akhir.X].filter((x, i, d) => i === 0 || jarakTitik(x, d[i - 1]) > 1e-6);
  return { lebarM: lebar, persen: Math.min(100, porsi * 100), tengah: garisA[m]!, garis };
}

export interface SampelProyektor {
  p: Benda; L: Lensa;
  /** Titik permukaan sepanjang garis tengah mendatar (kiri -> kanan) & tegak (bawah -> atas) gambar. */
  baris: (Titik | null)[]; kolom: (Titik | null)[];
}

export interface Blending {
  a: string; b: string; namaA: string; namaB: string;
  arah: 'kiri-kanan' | 'atas-bawah';
  /** Lebar area blending menyusuri permukaan (m). */ lebarM: number;
  /** Persen dari lebar (kiri-kanan) / tinggi (atas-bawah) gambar A & B. */ persenA: number; persenB: number;
  /** Titik tengah area blending (untuk label). */ tengah: Titik;
  /** Titik permukaan dari tepi ke tepi area blending di garis tengah gambar A (garis ukur berpanah). */ garis: Titik[];
}

/** Blending di bawah ini diabaikan (sentuhan tepi / pembulatan sampel). */
export const BLENDING_MIN_PERSEN = 1;

/**
 * Semua pasangan proyektor yang gambarnya bertumpuk di permukaan yang sama. `terlihat(i, X)` = titik
 * X benar-benar terkena sinar proyektor ke-i (tidak terhalang benda lain) - dari raycast pemanggil.
 */
export function hitungBlending(daftar: SampelProyektor[], terlihat: (i: number, X: Titik) => boolean = () => true): Blending[] {
  const hasil: Blending[] = [];
  for (let i = 0; i < daftar.length; i++) for (let j = i + 1; j < daftar.length; j++) {
    const A = daftar[i], B = daftar[j];
    const ukur = (sumbu: 'baris' | 'kolom') => {
      const ab = tumpangGaris(A[sumbu], B.L, X => terlihat(j, X));
      const ba = tumpangGaris(B[sumbu], A.L, X => terlihat(i, X));
      return ab && ba ? { ab, ba } : null;
    };
    const h = ukur('baris'), v = ukur('kolom');
    //  Arah blending = sumbu yang bertumpuk lebih sempit (sisi-ke-sisi); bila hanya satu sumbu bertumpuk, itu.
    const pilih = h && v ? (h.ab.persen <= v.ab.persen ? { arah: 'kiri-kanan' as const, ...h } : { arah: 'atas-bawah' as const, ...v })
      : h ? { arah: 'kiri-kanan' as const, ...h } : v ? { arah: 'atas-bawah' as const, ...v } : null;
    if (!pilih || Math.max(pilih.ab.persen, pilih.ba.persen) < BLENDING_MIN_PERSEN) continue;
    hasil.push({
      a: A.p.id, b: B.p.id, namaA: A.p.nama, namaB: B.p.nama, arah: pilih.arah,
      lebarM: (pilih.ab.lebarM + pilih.ba.lebarM) / 2, persenA: pilih.ab.persen, persenB: pilih.ba.persen,
      tengah: [(pilih.ab.tengah[0] + pilih.ba.tengah[0]) / 2, (pilih.ab.tengah[1] + pilih.ba.tengah[1]) / 2, (pilih.ab.tengah[2] + pilih.ba.tengah[2]) / 2],
      garis: pilih.ab.garis,
    });
  }
  return hasil;
}

/** Teks ringkas satu blending, mis. "52 cm · 15%" atau "52 cm · 15% / 17%". */
export function teksBlending(b: Pick<Blending, 'lebarM' | 'persenA' | 'persenB'>): string {
  const cm = Math.round(b.lebarM * 100);
  const pa = Math.round(b.persenA), pb = Math.round(b.persenB);
  return `${cm} cm · ${pa === pb ? `${pa}%` : `${pa}% / ${pb}%`}`;
}

/** Resolusi acuan untuk perkiraan piksel: 1920 px lebar (Full HD / WUXGA) & 1080 px tinggi. */
export const PIKSEL_ACUAN = { 'kiri-kanan': 1920, 'atas-bawah': 1080 } as const;

/** Perkiraan lebar blending dalam piksel di resolusi acuan, mis. 12% kiri-kanan -> 230. */
export const pikselBlending = (persen: number, arah: Blending['arah']) => Math.round((persen / 100) * PIKSEL_ACUAN[arah]);

/**
 * Baris keterangan detail satu blending (kartu di kanvas & PNG), mis.
 *   Area blending P1 ↔ P2 · kiri-kanan
 *   Lebar area 49 cm
 *   P1: 12% ≈ 230 px · P2: 11% ≈ 211 px
 *   dari lebar gambar (acuan 1920 px)
 */
export function barisKeterangan(b: Blending, nama: (n: string) => string = n => n): string[] {
  const p = (x: number) => `${Math.round(x)}% ≈ ${pikselBlending(x, b.arah)} px`;
  const sisi = b.arah === 'kiri-kanan' ? 'lebar' : 'tinggi';
  return [
    `Area blending ${nama(b.namaA)} ↔ ${nama(b.namaB)} · ${b.arah}`,
    `${sisi === 'lebar' ? 'Lebar' : 'Tinggi'} area ${Math.round(b.lebarM * 100)} cm`,
    `${nama(b.namaA)}: ${p(b.persenA)} · ${nama(b.namaB)}: ${p(b.persenB)}`,
    `dari ${sisi} gambar (acuan ${PIKSEL_ACUAN[b.arah]} px)`,
  ];
}
