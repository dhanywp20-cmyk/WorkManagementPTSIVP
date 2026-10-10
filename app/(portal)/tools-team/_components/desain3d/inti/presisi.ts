/**
 * Presisi Desain 3D: snap ke grid saat menggeser / memutar benda, dan penggaris (ukur jarak bebas antara dua
 * titik mana pun - kursi ke layar, lebar jalur, tinggi bawah plafon). Murni (diuji di uji/desain3d-presisi.ts).
 */
import type { Titik } from './tipe';

/** Snap geser: langkah grid (m) & snap putar (derajat). */
export interface Snap { aktif: boolean; langkah: number; sudut: number }
export const LANGKAH_SNAP = [0.01, 0.05, 0.1, 0.25, 0.5, 1] as const;
export const SUDUT_SNAP = [5, 15, 45, 90] as const;
export const SNAP_AWAL: Snap = { aktif: false, langkah: 0.1, sudut: 15 };

export function snapSah(x: unknown): Snap {
  const o = (x ?? {}) as Partial<Snap>;
  return {
    aktif: o.aktif === true,
    langkah: (LANGKAH_SNAP as readonly number[]).includes(o.langkah as number) ? (o.langkah as number) : SNAP_AWAL.langkah,
    sudut: (SUDUT_SNAP as readonly number[]).includes(o.sudut as number) ? (o.sudut as number) : SNAP_AWAL.sudut,
  };
}

export const labelLangkah = (m: number) => (m < 1 ? `${Math.round(m * 100)} cm` : `${m} m`);

/** Bulatkan ke kelipatan `langkah` (hasil dirapikan ke mm supaya tidak 0,30000000004). */
export const bulatkanKe = (v: number, langkah: number) => Math.round(Math.round(v / langkah) * langkah * 1000) / 1000;

/** Titik penggaris: bila snap aktif, dibulatkan ke grid; selain itu ke mm. */
export function titikSnap(p: Titik, snap: Snap): Titik {
  const l = snap.aktif ? snap.langkah : 0.001;
  return [bulatkanKe(p[0], l), bulatkanKe(p[1], l), bulatkanKe(p[2], l)];
}

/**
 * Jarak garis grid yang digambar: langkah snap, tapi dibuat lebih renggang (kelipatan 2 / 5 / 10) bila
 * garisnya akan lebih dari `maksGaris` per sisi - grid 1 cm di ruang 20 m tidak terbaca & berat.
 */
export function jarakGrid(langkah: number, panjangMaks: number, maksGaris = 120): number {
  let j = langkah;
  for (const k of [2, 2.5, 2, 2, 2.5, 2, 2]) { if (panjangMaks / j <= maksGaris) break; j *= k; }
  return Math.round(j * 1000) / 1000;
}

// ── Penggaris ───────────────────────────────────────────────────────────────

export interface GarisPenggaris { id: string; a: Titik; b: Titik }
export const MAKS_PENGGARIS = 30;

export const panjangGaris = (g: Pick<GarisPenggaris, 'a' | 'b'>) => Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1], g.b[2] - g.a[2]);

/** "2.350 mm" - satuan gambar kerja AV (mm), pemisah ribuan Indonesia. */
export const formatPanjang = (m: number) => `${Math.round(m * 1000).toLocaleString('id-ID')} mm`;

/** Komponen jarak: datar (lantai) & tinggi - berguna untuk "kursi ke layar" yang beda ketinggian. */
export function rincianGaris(g: Pick<GarisPenggaris, 'a' | 'b'>): { datar: number; tinggi: number } {
  return { datar: Math.hypot(g.b[0] - g.a[0], g.b[2] - g.a[2]), tinggi: Math.abs(g.b[1] - g.a[1]) };
}

/** Daftar garis penggaris yang sah (dari desain tersimpan / berkas): maks MAKS_PENGGARIS, angka terbatas. */
export function penggarisSah(x: unknown): GarisPenggaris[] {
  if (!Array.isArray(x)) return [];
  const titik = (t: unknown): t is Titik => Array.isArray(t) && t.length === 3 && t.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 1000);
  return x.slice(0, MAKS_PENGGARIS).flatMap(g => {
    const o = g as Partial<GarisPenggaris>;
    return typeof o?.id === 'string' && titik(o.a) && titik(o.b) ? [{ id: o.id.slice(0, 40), a: o.a, b: o.b }] : [];
  });
}
