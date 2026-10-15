/**
 * lib/kuis-live-server.ts - bagian SERVER Kuis Live: baca/tulis basis data & kabar realtime.
 * Dipakai /api/kelas/<token> (peserta) dan /api/admin/kelas-eksternal (layar host). Aturannya
 * sendiri ada di lib/kuis-live.ts (murni, teruji).
 *
 * JANGAN diimpor dari komponen klien.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { acakUrutan, type KelasEksternal, type Pilihan } from './kelas-eksternal';
import {
  distribusi, indeksTerhitung, posisiSaya, susunPapan, tahapEfektif, transisiLive,
  type AksiLive, type BarisPapan, type RekapPeserta, type StatusLive, type Tahap,
} from './kuis-live';

export type KelasLive = KelasEksternal & StatusLive;
type Db = SupabaseClient;

/** Topik kabar realtime satu kuis. Isinya hanya colekan - data tetap diambil lewat route server. */
export const topikKuis = (token: string) => `kuis-live:${token}`;

/**
 * Colek semua layar peserta supaya langsung mengambil status terbaru (Supabase Realtime Broadcast
 * lewat REST). Gagal = diam: layar peserta tetap menyegarkan diri berkala.
 */
export async function siarkanKuis(token: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const kunci = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !kunci) return;
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST', cache: 'no-store',
      headers: { apikey: kunci, Authorization: `Bearer ${kunci}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ topic: topikKuis(token), event: 'ubah', payload: { t: Date.now() } }] }),
      signal: AbortSignal.timeout(1500),
    });
  } catch { /* abaikan - ada penyegaran berkala */ }
}

export interface SoalLive { teks: string; pilihan: Record<Pilihan, string>; kunci: Pilihan }

export async function muatSoalLive(db: Db, id: string | undefined): Promise<SoalLive | null> {
  if (!id) return null;
  const { data } = await db.from('lc_questions').select('question,option_a,option_b,option_c,option_d,correct_answer').eq('id', id).maybeSingle();
  if (!data) return null;
  const s = data as { question: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_answer: string };
  return { teks: s.question, pilihan: { A: s.option_a, B: s.option_b, C: s.option_c, D: s.option_d }, kunci: String(s.correct_answer).toUpperCase() as Pilihan };
}

export async function muatPapan(db: Db, kelasId: string, sesi: number, sampai: number): Promise<BarisPapan[]> {
  const { data } = await db.rpc('lc_eks_live_papan', { p_kelas: kelasId, p_sesi: sesi, p_sampai: sampai });
  return susunPapan((data ?? []) as RekapPeserta[]);
}

/** Soal yang sah (pilihan ganda & masih ada di Bank Soal) dalam urutan sesi baru. */
async function urutanBaru(db: Db, k: KelasLive): Promise<string[]> {
  const { data } = await db.from('lc_questions').select('id').in('id', k.question_ids).eq('question_type', 'abcd');
  const sah = new Set(((data ?? []) as { id: string }[]).map(x => x.id));
  const urut = k.question_ids.filter(id => sah.has(id));
  return k.acak_soal ? acakUrutan(urut) : urut;
}

/**
 * Jalankan satu tombol admin. `dari` = tahap & soal yang terlihat di layar host saat tombol
 * ditekan: kalau sudah tidak cocok (klik ganda, dua layar host), tidak ada yang berubah - jadi
 * satu klik tidak pernah melompati dua soal.
 */
export async function jalankanAksiLive(db: Db, k: KelasLive, aksi: AksiLive, dari: { tahap?: unknown; indeks?: unknown }):
  Promise<{ ok: true; berubah: boolean } | { ok: false; galat: string }> {
  const sekarang = Date.now();
  if (dari.tahap !== undefined && (dari.tahap !== tahapEfektif(k, sekarang) || Number(dari.indeks) !== k.live_indeks)) {
    return { ok: true, berubah: false };
  }
  const ubahan = transisiLive(k, aksi, sekarang, aksi === 'live_mulai' ? await urutanBaru(db, k) : []);
  if ('galat' in ubahan) return { ok: false, galat: ubahan.galat };
  const tambahan = aksi === 'live_mulai' ? { aktif: true, dimulai_pada: new Date(sekarang).toISOString() } : {};
  //  Bersyarat pada status yang tadi dibaca: dua permintaan bersamaan, hanya satu yang berlaku.
  const { data, error } = await db.from('lc_eks_kelas')
    .update({ ...ubahan, ...tambahan, updated_at: new Date(sekarang).toISOString() })
    .eq('id', k.id).eq('live_tahap', k.live_tahap).eq('live_indeks', k.live_indeks).eq('live_sesi', k.live_sesi)
    .select('id');
  if (error) return { ok: false, galat: 'Gagal menyimpan. Coba lagi.' };
  const berubah = ((data ?? []) as unknown[]).length > 0;
  if (berubah) await siarkanKuis(k.token);
  return { ok: true, berubah };
}

/** Status lengkap untuk LAYAR HOST admin (termasuk kunci setelah waktu habis). */
export async function keadaanHost(db: Db, k: KelasLive) {
  const sekarang = Date.now();
  const tahap = tahapEfektif(k, sekarang);
  const adaSoal = tahap === 'siap' || tahap === 'soal' || tahap === 'hasil';
  const [{ data: pemain }, soal, jawaban, papan] = await Promise.all([
    db.from('lc_eks_peserta').select('id,nama').eq('kelas_id', k.id).order('created_at'),
    adaSoal ? muatSoalLive(db, k.live_urutan[k.live_indeks]) : Promise.resolve(null),
    adaSoal
      ? db.from('lc_eks_live_jawaban').select('pilihan').eq('kelas_id', k.id).eq('sesi', k.live_sesi).eq('indeks', k.live_indeks)
        .then(r => (r.data ?? []) as { pilihan: string }[])
      : Promise.resolve([] as { pilihan: string }[]),
    tahap === 'papan' || tahap === 'selesai' ? muatPapan(db, k.id, k.live_sesi, indeksTerhitung(k, sekarang)) : Promise.resolve(null),
  ]);
  return {
    sekarang, tahap, sesi: k.live_sesi, indeks: k.live_indeks,
    total: tahap === 'lobi' ? k.question_ids.length : k.live_urutan.length,
    detik: k.detik_per_soal,
    mulaiMs: k.live_soal_mulai ? new Date(k.live_soal_mulai).getTime() : null,
    tutupMs: k.live_soal_tutup ? new Date(k.live_soal_tutup).getTime() : null,
    pemain: (pemain ?? []) as { id: string; nama: string }[],
    soal: soal ? { teks: soal.teks, pilihan: soal.pilihan } : null,
    //  Layar host biasanya diproyeksikan: kunci baru dikirim setelah waktu habis.
    kunci: tahap === 'hasil' && soal ? soal.kunci : null,
    jumlahMenjawab: jawaban.length,
    distribusi: tahap === 'hasil' ? distribusi(jawaban) : null,
    papan,
  };
}
export type KeadaanHost = Awaited<ReturnType<typeof keadaanHost>>;

/** Status untuk LAYAR PESERTA. Soal & skor hanya untuk peserta terdaftar; kunci hanya setelah waktu habis. */
export async function keadaanPeserta(db: Db, k: KelasLive, pesertaId: string | null, jumlahPemain: number) {
  const sekarang = Date.now();
  const tahap: Tahap = tahapEfektif(k, sekarang);
  const adaSoal = !!pesertaId && (tahap === 'siap' || tahap === 'soal' || tahap === 'hasil');
  const [soal, milikSaya, papan] = await Promise.all([
    adaSoal ? muatSoalLive(db, k.live_urutan[k.live_indeks]) : Promise.resolve(null),
    pesertaId && tahap !== 'lobi'
      ? db.from('lc_eks_live_jawaban').select('pilihan,benar,poin').eq('peserta_id', pesertaId).eq('sesi', k.live_sesi).eq('indeks', k.live_indeks).maybeSingle()
        .then(r => r.data as { pilihan: Pilihan; benar: boolean; poin: number } | null)
      : Promise.resolve(null),
    pesertaId && tahap !== 'lobi' ? muatPapan(db, k.id, k.live_sesi, indeksTerhitung(k, sekarang)) : Promise.resolve(null),
  ]);
  const terbuka = tahap === 'hasil' || tahap === 'papan' || tahap === 'selesai';
  return {
    sekarang, tahap, sesi: k.live_sesi, indeks: k.live_indeks,
    total: tahap === 'lobi' ? k.question_ids.length : k.live_urutan.length,
    detik: k.detik_per_soal,
    mulaiMs: k.live_soal_mulai ? new Date(k.live_soal_mulai).getTime() : null,
    tutupMs: k.live_soal_tutup ? new Date(k.live_soal_tutup).getTime() : null,
    jumlahPemain,
    soal: soal ? { teks: soal.teks, pilihan: soal.pilihan } : null,
    kunci: tahap === 'hasil' && soal ? soal.kunci : null,
    //  Benar/salah & poin soal yang sedang berjalan baru dibuka setelah waktu habis.
    jawabanSaya: milikSaya ? (terbuka ? milikSaya : { pilihan: milikSaya.pilihan }) : null,
    posisi: papan && pesertaId ? posisiSaya(papan, pesertaId) : null,
    papan: papan && (tahap === 'papan' || tahap === 'selesai')
      ? papan.slice(0, 5).map(b => ({ nama: b.nama, poin: b.poin, peringkat: b.peringkat }))
      : null,
  };
}
export type KeadaanPeserta = Awaited<ReturnType<typeof keadaanPeserta>>;
