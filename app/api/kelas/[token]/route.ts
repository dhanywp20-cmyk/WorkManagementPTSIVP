/**
 * /api/kelas/<token> - Kelas Eksternal Learning Center untuk customer (PUBLIK, tanpa login).
 *
 *  GET                              -> info kelas + status peserta (header x-peserta: token perangkat)
 *  POST { aksi:'daftar', nama }     -> { token }   (cukup nama; perangkat sama = peserta sama)
 *  POST { aksi:'mulai' }            -> soal TANPA kunci jawaban (melanjutkan percobaan yang terbuka)
 *  POST { aksi:'kirim', jawaban }   -> { skor, benar, jumlah, lulus } - dinilai di server
 *
 * Kunci jawaban tidak pernah keluar dari server. Tabel lc_eks_* terkunci dari peramban (migrasi 050).
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAdminClient } from '@/lib/supabase-admin';
import {
  PESAN_STATUS, acakUrutan, lewatWaktu, nilaiJawaban, rapikanNama, saringJawaban, sisaWaktuMs, statusKelas,
  type KelasEksternal,
} from '@/lib/kelas-eksternal';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };
const jawab = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });
const galat = (pesan: string, status = 400) => jawab({ error: pesan }, status);
const hash = (t: string) => crypto.createHash('sha256').update(t).digest('hex');
const TOKEN_SAH = /^[A-Za-z0-9_-]{16,64}$/;

type Db = ReturnType<typeof getAdminClient>;
interface Peserta { id: string; nama: string }
interface Hasil {
  id: string; percobaan: number; urutan_soal: string[]; mulai_pada: string; selesai_pada: string | null;
  benar: number | null; jumlah: number | null; skor: number | null; lulus: boolean | null;
}

async function muatKelas(db: Db, token: string): Promise<KelasEksternal | null> {
  if (!TOKEN_SAH.test(token)) return null;
  const { data } = await db.from('lc_eks_kelas').select('*').eq('token', token).maybeSingle();
  return (data as KelasEksternal | null) ?? null;
}

async function muatPeserta(db: Db, kelasId: string, req: NextRequest): Promise<Peserta | null> {
  const t = req.headers.get('x-peserta') ?? '';
  if (!TOKEN_SAH.test(t)) return null;
  const { data } = await db.from('lc_eks_peserta').select('id,nama').eq('kelas_id', kelasId).eq('token_hash', hash(t)).maybeSingle();
  return (data as Peserta | null) ?? null;
}

async function jumlahPeserta(db: Db, kelasId: string): Promise<number> {
  const { count } = await db.from('lc_eks_peserta').select('id', { count: 'exact', head: true }).eq('kelas_id', kelasId);
  return count ?? 0;
}

async function hasilPeserta(db: Db, pesertaId: string): Promise<Hasil[]> {
  const { data } = await db.from('lc_eks_hasil').select('id,percobaan,urutan_soal,mulai_pada,selesai_pada,benar,jumlah,skor,lulus')
    .eq('peserta_id', pesertaId).order('percobaan', { ascending: false });
  return (data ?? []) as Hasil[];
}

const ringkasHasil = (h: Hasil | undefined) => (h && h.selesai_pada
  ? { skor: h.skor, benar: h.benar, jumlah: h.jumlah, lulus: h.lulus, selesai_pada: h.selesai_pada, percobaan: h.percobaan }
  : null);

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const db = getAdminClient();
  const kelas = await muatKelas(db, token);
  if (!kelas) return galat('Link kelas tidak ditemukan.', 404);
  const [peserta, jumlah] = await Promise.all([muatPeserta(db, kelas.id, req), jumlahPeserta(db, kelas.id)]);
  const status = statusKelas(kelas, jumlah);
  const daftarHasil = peserta ? await hasilPeserta(db, peserta.id) : [];
  const terbuka = daftarHasil.find(h => !h.selesai_pada);
  return jawab({
    kelas: {
      judul: kelas.judul, keterangan: kelas.keterangan, jumlahSoal: kelas.question_ids.length,
      timerMenit: kelas.timer_menit, passingGrade: kelas.passing_grade, satuKali: kelas.satu_kali,
    },
    status, pesan: status === 'buka' ? null : PESAN_STATUS[status],
    peserta: peserta ? { nama: peserta.nama } : null,
    hasil: ringkasHasil(daftarHasil.find(h => h.selesai_pada)),
    berjalan: !!terbuka,
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const db = getAdminClient();
  try {
    const kelas = await muatKelas(db, token);
    if (!kelas) return galat('Link kelas tidak ditemukan.', 404);
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const aksi = String(body.aksi ?? '');

    // ── Daftar: cukup nama ──
    if (aksi === 'daftar') {
      const sudah = await muatPeserta(db, kelas.id, req);
      if (sudah) return jawab({ token: req.headers.get('x-peserta'), nama: sudah.nama });
      const status = statusKelas(kelas, await jumlahPeserta(db, kelas.id));
      if (status !== 'buka') return galat(PESAN_STATUS[status], 403);
      const n = rapikanNama(body.nama);
      if ('galat' in n) return galat(n.galat);
      const tokenPeserta = crypto.randomBytes(24).toString('base64url');
      const { error } = await db.from('lc_eks_peserta').insert({ kelas_id: kelas.id, nama: n.nama, nama_norm: n.norm, token_hash: hash(tokenPeserta) });
      if (error) {
        if (error.code === '23505') return galat('Nama ini sudah terdaftar di kelas ini. Tambahkan inisial atau nama perusahaan Anda.', 409);
        return galat('Pendaftaran gagal. Coba lagi.', 500);
      }
      return jawab({ token: tokenPeserta, nama: n.nama });
    }

    const peserta = await muatPeserta(db, kelas.id, req);
    if (!peserta) return galat('Isi nama Anda dulu.', 401);
    const daftarHasil = await hasilPeserta(db, peserta.id);
    const terbuka = daftarHasil.find(h => !h.selesai_pada);

    // ── Mulai / lanjutkan ──
    if (aksi === 'mulai') {
      let h = terbuka;
      if (!h) {
        const selesai = daftarHasil.find(x => x.selesai_pada);
        if (selesai && kelas.satu_kali) return jawab({ error: 'Anda sudah mengerjakan quiz ini.', hasil: ringkasHasil(selesai) }, 409);
        //  Peserta lama boleh mulai walau kuota penuh; selain itu kelas harus buka.
        const status = statusKelas(kelas, 0);
        if (status !== 'buka') return galat(PESAN_STATUS[status], 403);
        const { data: q } = await db.from('lc_questions').select('id').in('id', kelas.question_ids).eq('question_type', 'abcd');
        const sah = new Set(((q ?? []) as { id: string }[]).map(x => x.id));
        const urut = kelas.question_ids.filter(id => sah.has(id));
        if (!urut.length) return galat('Soal kelas ini belum tersedia.', 409);
        const urutan = kelas.acak_soal ? acakUrutan(urut) : urut;
        const { data: baru, error } = await db.from('lc_eks_hasil').insert({
          kelas_id: kelas.id, peserta_id: peserta.id, percobaan: (daftarHasil[0]?.percobaan ?? 0) + 1, urutan_soal: urutan,
        }).select('id,percobaan,urutan_soal,mulai_pada,selesai_pada,benar,jumlah,skor,lulus').single();
        if (error || !baru) return galat('Gagal memulai. Coba lagi.', 500);
        h = baru as Hasil;
      }
      const { data: soal } = await db.from('lc_questions').select('id,question,option_a,option_b,option_c,option_d').in('id', h.urutan_soal);
      const peta = new Map(((soal ?? []) as { id: string; question: string; option_a: string; option_b: string; option_c: string; option_d: string }[]).map(s => [s.id, s]));
      return jawab({
        percobaan: h.percobaan,
        mulai_pada: h.mulai_pada,
        sisaMs: sisaWaktuMs(h.mulai_pada, kelas.timer_menit),
        soal: h.urutan_soal.filter(id => peta.has(id)).map(id => {
          const s = peta.get(id)!;
          return { id, teks: s.question, pilihan: { A: s.option_a, B: s.option_b, C: s.option_c, D: s.option_d } };
        }),
      });
    }

    // ── Kirim: dinilai di server ──
    if (aksi === 'kirim') {
      if (!terbuka) {
        const selesai = daftarHasil.find(x => x.selesai_pada);
        return selesai ? jawab({ hasil: ringkasHasil(selesai) }) : galat('Quiz belum dimulai.', 409);
      }
      const jawaban = saringJawaban(body.jawaban, terbuka.urutan_soal);
      const { data: kunciRows } = await db.from('lc_questions').select('id,correct_answer').in('id', terbuka.urutan_soal);
      const kunci = Object.fromEntries(((kunciRows ?? []) as { id: string; correct_answer: string }[]).map(r => [r.id, r.correct_answer]));
      const nilai = nilaiJawaban(kunci, terbuka.urutan_soal, jawaban, kelas.passing_grade);
      const sekarang = Date.now();
      //  Syarat selesai_pada IS NULL: dua kiriman bersamaan tidak bisa menimpa nilai.
      const { data: tersimpan } = await db.from('lc_eks_hasil').update({
        jawaban, ...nilai,
        selesai_pada: new Date(sekarang).toISOString(),
        durasi_detik: Math.round((sekarang - new Date(terbuka.mulai_pada).getTime()) / 1000),
        lewat_waktu: lewatWaktu(terbuka.mulai_pada, kelas.timer_menit, sekarang),
      }).eq('id', terbuka.id).is('selesai_pada', null).select('id,percobaan,urutan_soal,mulai_pada,selesai_pada,benar,jumlah,skor,lulus');
      const h = ((tersimpan ?? []) as Hasil[])[0] ?? (await hasilPeserta(db, peserta.id)).find(x => x.selesai_pada);
      return jawab({ hasil: ringkasHasil(h), bolehUlang: !kelas.satu_kali });
    }

    return galat('Permintaan tidak dikenal.');
  } catch {
    return galat('Terjadi gangguan. Coba lagi.', 500);
  }
}
