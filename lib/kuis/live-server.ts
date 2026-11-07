import type { SupabaseClient } from '@supabase/supabase-js';
import { acakUrutan, type KelasEksternal, type Pilihan } from './kelas-eksternal';
import { hapusSimpanan, simpanSebentar } from '../simpan-sebentar';
import {
  anulirDari, distribusi, indeksTerhitung, jadwalLive, posisiSaya, rapikanUrlGambar, semuaMenjawab, susunPapan, transisiLive, wujudkanLive,
  type AksiLive, type BarisPapan, type RekapPeserta, type StatusLive, type Tahap,
} from './live';

export type KelasLive = KelasEksternal & StatusLive;
type Db = SupabaseClient;

export interface SoalLive { teks: string; gambar: string | null; pilihan: Record<Pilihan, string>; kunci: Pilihan }

export function muatSoalLive(db: Db, id: string | undefined): Promise<SoalLive | null> {
  if (!id) return Promise.resolve(null);
  return simpanSebentar(`soal:${id}`, 30_000, async () => {
    const { data } = await db.from('lc_questions').select('question,option_a,option_b,option_c,option_d,correct_answer,gambar_url').eq('id', id).maybeSingle();
    if (!data) return null;
    const s = data as { question: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_answer: string; gambar_url: string | null };
    return {
      teks: s.question, gambar: rapikanUrlGambar(s.gambar_url),
      pilihan: { A: s.option_a, B: s.option_b, C: s.option_c, D: s.option_d }, kunci: String(s.correct_answer).toUpperCase() as Pilihan,
    };
  });
}

export function muatPapan(db: Db, kelasId: string, sesi: number, sampai: number): Promise<BarisPapan[]> {
  return simpanSebentar(`papan:${kelasId}:${sesi}:${sampai}`, 1000, async () => {
    const { data } = await db.rpc('lc_eks_live_papan', { p_kelas: kelasId, p_sesi: sesi, p_sampai: sampai });
    return susunPapan((data ?? []) as RekapPeserta[]);
  });
}

async function urutanBaru(db: Db, k: KelasLive): Promise<string[]> {
  const { data } = await db.from('lc_questions').select('id').in('id', k.question_ids).eq('question_type', 'abcd');
  const sah = new Set(((data ?? []) as { id: string }[]).map(x => x.id));
  const urut = k.question_ids.filter(id => sah.has(id));
  return k.acak_soal ? acakUrutan(urut) : urut;
}

function updateBersyarat(db: Db, k: KelasLive, ubahan: Record<string, unknown>) {
  let q = db.from('lc_eks_kelas').update(ubahan)
    .eq('id', k.id).eq('live_tahap', k.live_tahap).eq('live_indeks', k.live_indeks).eq('live_sesi', k.live_sesi);
  q = k.live_soal_tutup ? q.eq('live_soal_tutup', k.live_soal_tutup) : q.is('live_soal_tutup', null);
  return q.select('id');
}

export async function jalankanAksiLive(db: Db, k: KelasLive, aksi: AksiLive, dari: { tahap?: unknown; indeks?: unknown }):
  Promise<{ ok: true; berubah: boolean } | { ok: false; galat: string }> {
  const sekarang = Date.now();
  const j = jadwalLive(k, sekarang);
  if (dari.tahap !== undefined && (dari.tahap !== j.tahap || Number(dari.indeks) !== j.indeks)) {
    return { ok: true, berubah: false };
  }
  const ubahan = transisiLive(k, aksi, sekarang, aksi === 'live_mulai' ? await urutanBaru(db, k) : []);
  if ('galat' in ubahan) return { ok: false, galat: ubahan.galat };
  const tambahan = aksi === 'live_mulai' ? { aktif: true, dimulai_pada: new Date(sekarang).toISOString() } : {};
  const { data, error } = await updateBersyarat(db, k, { ...ubahan, ...tambahan, updated_at: new Date(sekarang).toISOString() });
  if (error) return { ok: false, galat: 'Gagal menyimpan. Coba lagi.' };
  const berubah = ((data ?? []) as unknown[]).length > 0;
  const anulir = anulirDari(aksi, j);
  if (berubah && anulir !== null) {
    const { error: hapus } = await db.from('lc_eks_live_jawaban').delete().eq('kelas_id', k.id).eq('sesi', k.live_sesi).gte('indeks', anulir);
    if (hapus) return { ok: false, galat: 'Soal diulang, tetapi jawaban lama gagal dianulir - tekan "Ulang soal ini" sekali lagi.' };
  }
  return { ok: true, berubah };
}

export async function tutupBilaSemuaMenjawab(db: Db, k: KelasLive, jumlahPemain: number): Promise<void> {
  const sekarang = Date.now();
  const j = jadwalLive(k, sekarang);
  if (j.tahap !== 'soal') return;
  const { count } = await db.from('lc_eks_live_jawaban').select('id', { count: 'exact', head: true })
    .eq('kelas_id', k.id).eq('sesi', k.live_sesi).eq('indeks', j.indeks);
  if (!semuaMenjawab(count ?? 0, jumlahPemain)) return;
  const ubahan = transisiLive(k, 'live_lewati', sekarang);
  if ('galat' in ubahan) return;
  await updateBersyarat(db, k, ubahan);
}

const msAtauNull = (iso: string | null) => (iso ? new Date(iso).getTime() : null);

export async function keadaanHost(db: Db, k: KelasLive) {
  const sekarang = Date.now();
  const rapi = wujudkanLive(k, sekarang);
  if (rapi) void updateBersyarat(db, k, rapi).then(() => {}, () => {});
  const j = jadwalLive(k, sekarang);
  const tahap = j.tahap;
  const adaSoal = tahap === 'siap' || tahap === 'soal' || tahap === 'hasil';
  const [{ data: pemain }, soal, jawaban, papan] = await Promise.all([
    db.from('lc_eks_peserta').select('id,nama').eq('kelas_id', k.id).order('created_at'),
    adaSoal ? muatSoalLive(db, k.live_urutan[j.indeks]) : Promise.resolve(null),
    adaSoal
      ? db.from('lc_eks_live_jawaban').select('pilihan').eq('kelas_id', k.id).eq('sesi', k.live_sesi).eq('indeks', j.indeks)
        .then(r => (r.data ?? []) as { pilihan: string }[])
      : Promise.resolve([] as { pilihan: string }[]),
    tahap === 'papan' || tahap === 'selesai' ? muatPapan(db, k.id, k.live_sesi, indeksTerhitung(k, sekarang)) : Promise.resolve(null),
  ]);
  return {
    sekarang, tahap, sesi: k.live_sesi, indeks: j.indeks,
    total: tahap === 'lobi' ? k.question_ids.length : k.live_urutan.length,
    detik: k.detik_per_soal,
    mulaiMs: j.mulaiMs ?? msAtauNull(k.live_soal_mulai),
    tutupMs: j.tutupMs ?? msAtauNull(k.live_soal_tutup),
    akhirMs: j.akhirMs,
    jedaMs: j.jedaMs,
    pemain: (pemain ?? []) as { id: string; nama: string }[],
    soal: soal ? { teks: soal.teks, gambar: soal.gambar, pilihan: soal.pilihan } : null,
    kunci: tahap === 'hasil' && soal ? soal.kunci : null,
    jumlahMenjawab: jawaban.length,
    distribusi: tahap === 'hasil' ? distribusi(jawaban) : null,
    papan,
  };
}
export type KeadaanHost = Awaited<ReturnType<typeof keadaanHost>>;

type JawabanSaya = { pilihan: Pilihan; benar: boolean; poin: number };
async function jawabanSaya(db: Db, k: KelasLive, pesertaId: string, indeks: number): Promise<JawabanSaya | null> {
  const kunci = `jwb:${pesertaId}:${k.live_sesi}:${indeks}:${k.live_soal_mulai}`;
  const j = await simpanSebentar(kunci, 600_000, () => Promise.resolve(
    db.from('lc_eks_live_jawaban').select('pilihan,benar,poin').eq('peserta_id', pesertaId).eq('sesi', k.live_sesi).eq('indeks', indeks).maybeSingle(),
  ).then(r => r.data as JawabanSaya | null));
  if (!j) hapusSimpanan(kunci);
  return j;
}

export async function keadaanPeserta(db: Db, k: KelasLive, pesertaId: string | null, jumlahPemain: number) {
  const sekarang = Date.now();
  const j = jadwalLive(k, sekarang);
  const tahap: Tahap = j.tahap;
  const adaSoal = !!pesertaId && (tahap === 'siap' || tahap === 'soal' || tahap === 'hasil');
  const [soal, milikSaya, papan] = await Promise.all([
    adaSoal ? muatSoalLive(db, k.live_urutan[j.indeks]) : Promise.resolve(null),
    pesertaId && tahap !== 'lobi' ? jawabanSaya(db, k, pesertaId, j.indeks) : Promise.resolve(null),
    pesertaId && tahap !== 'lobi' ? muatPapan(db, k.id, k.live_sesi, indeksTerhitung(k, sekarang)) : Promise.resolve(null),
  ]);
  const terbuka = tahap === 'hasil' || tahap === 'papan' || tahap === 'selesai';
  return {
    sekarang, tahap, sesi: k.live_sesi, indeks: j.indeks,
    total: tahap === 'lobi' ? k.question_ids.length : k.live_urutan.length,
    detik: k.detik_per_soal,
    mulaiMs: j.mulaiMs, tutupMs: j.tutupMs, akhirMs: j.akhirMs, jedaMs: j.jedaMs,
    jumlahPemain,
    soal: soal ? { teks: soal.teks, gambar: soal.gambar, pilihan: soal.pilihan } : null,
    kunci: tahap === 'hasil' && soal ? soal.kunci : null,
    jawabanSaya: milikSaya ? (terbuka ? milikSaya : { pilihan: milikSaya.pilihan }) : null,
    posisi: papan && pesertaId ? posisiSaya(papan, pesertaId) : null,
    papan: papan && (tahap === 'papan' || tahap === 'selesai')
      ? papan.slice(0, 5).map(b => ({ nama: b.nama, poin: b.poin, peringkat: b.peringkat }))
      : null,
  };
}
export type KeadaanPeserta = Awaited<ReturnType<typeof keadaanPeserta>>;
