/**
 * lib/gambar-desain-server.ts - gambar Desain 3D (tekstur lantai/dinding & gambar konten layar) disimpan
 * SEKALI per isi di tabel tools_gambar_desain (migrasi 044).
 *
 * Saat desain / template disimpan, setiap gambar data URL di data.layar & data.tekstur diganti rujukan
 * "ref:<hash>" (SHA-256 isi, 40 hex). Gambar yang sama - di 10 versi riwayat, atau di desain lain - hanya
 * satu baris. Peramban mengambilnya lewat /api/tools-team/aset?h= dengan cache permanen, jadi tiap
 * peramban cukup mengunduh sekali (hemat egress Supabase & bandwidth Vercel paket gratis).
 * Hanya untuk server (service role).
 */
import { createHash } from 'node:crypto';
import type { getAdminClient } from '@/lib/supabase-admin';
import { POLA_REF_GAMBAR } from '@/lib/tools-team';

type Db = ReturnType<typeof getAdminClient>;
const TABEL = 'tools_gambar_desain';
/** Batas total seluruh gambar desain (byte data URL) - pengaman kuota basis data paket gratis (500 MB). */
export const MAKS_TOTAL_GAMBAR_DESAIN = 150_000_000;

export const hashGambar = (dataUrl: string) => createHash('sha256').update(dataUrl).digest('hex').slice(0, 40);

type PetaGambar = Record<string, string> | undefined;

/**
 * Ganti setiap gambar data URL di `layar` & `tekstur` dengan ref:<hash> (gambar baru disimpan sekali),
 * dan pastikan setiap ref yang dikirim memang ada. Data lain tidak diubah.
 */
export async function rujukGambarDesain<T extends { layar?: PetaGambar; tekstur?: PetaGambar }>(
  db: Db, data: T, userId: string,
): Promise<{ ok: true; data: T } | { ok: false; alasan: string }> {
  const kelompok = (['layar', 'tekstur'] as const).filter(k => data[k] && Object.keys(data[k]!).length);
  if (!kelompok.length) return { ok: true, data };
  const baru = new Map<string, string>();      // hash -> data URL
  const ref = new Set<string>();
  for (const k of kelompok) for (const v of Object.values(data[k]!)) {
    if (POLA_REF_GAMBAR.test(v)) ref.add(v.slice(4)); else baru.set(hashGambar(v), v);
  }
  const semua = [...new Set([...ref, ...baru.keys()])];
  const { data: adaBaris, error } = await db.from(TABEL).select('hash').in('hash', semua);
  if (error) return { ok: false, alasan: error.message };
  const ada = new Set(((adaBaris ?? []) as { hash: string }[]).map(r => r.hash));
  if ([...ref].some(h => !ada.has(h))) return { ok: false, alasan: 'Sebagian gambar desain sudah tidak ada di server - unggah ulang gambarnya.' };
  const sisip = [...baru].filter(([h]) => !ada.has(h));
  if (sisip.length) {
    const { data: ukuranBaris } = await db.from(TABEL).select('ukuran');
    const terpakai = ((ukuranBaris ?? []) as { ukuran: number }[]).reduce((s, r) => s + r.ukuran, 0);
    const tambahan = sisip.reduce((s, [, v]) => s + v.length, 0);
    if (terpakai + tambahan > MAKS_TOTAL_GAMBAR_DESAIN) {
      return { ok: false, alasan: 'Ruang gambar desain tim sudah penuh - hapus desain lama yang tidak dipakai, atau simpan tanpa tekstur / gambar layar.' };
    }
    const { error: e2 } = await db.from(TABEL).upsert(
      sisip.map(([hash, v]) => ({ hash, data: v, ukuran: v.length, dibuat_oleh: userId })),
      { onConflict: 'hash', ignoreDuplicates: true },
    );
    if (e2) return { ok: false, alasan: e2.message };
  }
  const ganti = (p: PetaGambar) => (p ? Object.fromEntries(Object.entries(p).map(([k, v]) => [k, POLA_REF_GAMBAR.test(v) ? v : `ref:${hashGambar(v)}`])) : p);
  return { ok: true, data: { ...data, ...(data.layar ? { layar: ganti(data.layar) } : {}), ...(data.tekstur ? { tekstur: ganti(data.tekstur) } : {}) } };
}

/** Hapus gambar yang tidak lagi dirujuk siapa pun (masa tenggang 1 hari). Gagal = diabaikan. */
export async function bersihkanGambarDesain(db: Db): Promise<void> {
  try { await db.rpc('bersihkan_gambar_desain'); } catch { /* bukan bagian penting penyimpanan */ }
}
