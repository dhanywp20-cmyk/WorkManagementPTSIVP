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

/**
 * Tumpang tindih satu garis sampel gambar proyektor A (titik permukaan berurutan dari tepi ke tepi,
 * jarak SERAGAM dalam koordinat gambar) dengan gambar proyektor B: run terpanjang titik yang juga
 * disinari B. Tepi run berada di antara dua sampel -> ditambah setengah sampel di kedua ujung.
 *   - lebarM : panjang run menyusuri permukaan (ikut menekuk di layar lengkung)
 *   - persen : porsi run terhadap lebar GAMBAR (koordinat lensa = piksel) - angka yang diisi di
 *              software blending; tidak terpengaruh gambar yang tumpah ke dinding di luar layar.
 */
export function tumpangGaris(garisA: (Titik | null)[], LB: Lensa, terlihatB: (X: Titik) => boolean = () => true):
  { lebarM: number; persen: number; tengah: Titik } | null {
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
  const setengah = (a: number, b: number) => (garisA[a] && garisA[b] ? jarakTitik(garisA[a]!, garisA[b]!) / 2 : 0);
  const lebar = panjangGaris(garisA, s, e) + (s > 0 ? setengah(s - 1, s) : 0) + (e < n - 1 ? setengah(e, e + 1) : 0);
  const porsi = (e - s + (s > 0 ? 0.5 : 0) + (e < n - 1 ? 0.5 : 0)) / (n - 1);
  if (lebar < 0.005) return null;
  const m = Math.round((s + e) / 2);
  return { lebarM: lebar, persen: Math.min(100, porsi * 100), tengah: garisA[m]! };
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
