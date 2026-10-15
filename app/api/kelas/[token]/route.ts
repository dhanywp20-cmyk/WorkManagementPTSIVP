/**
 * /api/kelas/<token> - Kelas Eksternal Learning Center untuk customer (PUBLIK, tanpa login).
 *
 *  GET                              -> info kelas + status peserta (header x-peserta: token perangkat)
 *  POST { aksi:'daftar', nama }     -> { token }   (cukup nama; perangkat sama = peserta sama)
 *  POST { aksi:'mulai' }            -> soal TANPA kunci jawaban (melanjutkan percobaan yang terbuka)
 *  POST { aksi:'kirim', jawaban, alasan? } -> { skor, benar, jumlah, lulus } - dinilai di server
 *  POST { aksi:'pelanggaran', jenis }        -> { total, batas, kirimOtomatis }
 *
 * Kuis Live (jenis 'live', ala Kahoot - lib/kuis-live.ts): GET berisi `live` (tahap, soal yang sedang
 * berjalan, posisi & papan skor) dan jawaban dikirim per soal:
 *  POST { aksi:'jawab', indeks, pilihan }  -> { pilihan } - poin dihitung server, dibuka setelah waktu habis
 * Peserta tidak bisa mulai sendiri: soal hanya muncul setelah admin menekan Mulai di layar host.
 *
 * Mode 'admin': peserta terdaftar menunggu (GET -> menunggu:true) sampai admin menekan Mulai; batas
 * waktu semua peserta = dimulai_pada + timer. Admin menekan Akhiri -> peserta yang masih mengerjakan
 * mengirim otomatis (alasan 'diakhiri').
 *
 * Kunci jawaban tidak pernah keluar dari server. Tabel lc_eks_* terkunci dari peramban (migrasi 050).
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAdminClient } from '@/lib/supabase-admin';
import {
  PESAN_STATUS, acakUrutan, acuanWaktu, alasanKirimSah, jenisPelanggaranSah, lewatWaktu, menungguAdmin, nilaiJawaban,
  rapikanNama, saringJawaban, sisaWaktuMs, statusKelas,
} from '@/lib/kelas-eksternal';
import { PESAN_LIVE, periksaJawab, poinKahoot, statusLive } from '@/lib/kuis-live';
import { keadaanPeserta, muatSoalLive, tutupBilaSemuaMenjawab, type KelasLive } from '@/lib/kuis-live-server';
import { simpanSebentar } from '@/lib/simpan-sebentar';

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

async function muatKelas(db: Db, token: string): Promise<KelasLive | null> {
  if (!TOKEN_SAH.test(token)) return null;
  const { data } = await db.from('lc_eks_kelas').select('*').eq('token', token).maybeSingle();
  return (data as KelasLive | null) ?? null;
}

/**
 * GET (dibaca 100+ HP tiap 2,5 dtk): kelas & jumlah peserta disimpan sebentar di memori, jadi
 * HP yang menyegarkan bersamaan berbagi satu query. POST (daftar, jawab) selalu membaca langsung.
 */
const muatKelasSebentar = (db: Db, token: string) => simpanSebentar(`kelas:${token}`, 1000, () => muatKelas(db, token));
const jumlahPesertaSebentar = (db: Db, kelasId: string) => simpanSebentar(`jumlah:${kelasId}`, 2000, () => jumlahPeserta(db, kelasId));

/** Status pendaftaran menurut format kelas. */
function statusDaftar(kelas: KelasLive, jumlah: number): { status: string; pesan: string | null } {
  if (kelas.jenis === 'live') {
    const st = statusLive(kelas, jumlah);
    return { status: st, pesan: st === 'buka' ? null : PESAN_LIVE[st] };
  }
  const st = statusKelas(kelas, jumlah);
  return { status: st, pesan: st === 'buka' ? null : PESAN_STATUS[st] };
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
  const kelas = await muatKelasSebentar(db, token);
  if (!kelas) return galat('Link kelas tidak ditemukan.', 404);
  const [peserta, jumlah] = await Promise.all([muatPeserta(db, kelas.id, req), jumlahPesertaSebentar(db, kelas.id)]);
  if (kelas.jenis === 'live') {
    return jawab({
      kelas: {
        judul: kelas.judul, keterangan: kelas.keterangan, jumlahSoal: kelas.question_ids.length,
        jenis: 'live', detikPerSoal: kelas.detik_per_soal,
        tema: { warna: kelas.tema_warna, logo: kelas.logo_url, latar: kelas.latar_url },
      },
      ...statusDaftar(kelas, jumlah),
      peserta: peserta ? { nama: peserta.nama } : null,
      live: await keadaanPeserta(db, kelas, peserta?.id ?? null, jumlah),
    });
  }
  const status = statusKelas(kelas, jumlah);
  const daftarHasil = peserta ? await hasilPeserta(db, peserta.id) : [];
  const terbuka = daftarHasil.find(h => !h.selesai_pada);
  return jawab({
    kelas: {
      judul: kelas.judul, keterangan: kelas.keterangan, jumlahSoal: kelas.question_ids.length,
      timerMenit: kelas.timer_menit, passingGrade: kelas.passing_grade, satuKali: kelas.satu_kali,
      modeMulai: kelas.mode_mulai, batasPelanggaran: kelas.batas_pelanggaran, jenis: 'mandiri',
    },
    menunggu: menungguAdmin(kelas),
    jumlahPeserta: kelas.mode_mulai === 'admin' ? jumlah : undefined,
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
      const { status, pesan } = statusDaftar(kelas, await jumlahPeserta(db, kelas.id));
      if (status !== 'buka') return galat(pesan ?? 'Pendaftaran ditutup.', 403);
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

    if (kelas.jenis === 'live') {
      if (aksi !== 'jawab') return galat('Kuis ini dipandu langsung oleh admin.', 409);
      return await jawabLive(db, kelas, peserta, body);
    }

    const daftarHasil = await hasilPeserta(db, peserta.id);
    const terbuka = daftarHasil.find(h => !h.selesai_pada);

    // ── Mulai / lanjutkan ──
    if (aksi === 'mulai') {
      let h = terbuka;
      if (!h) {
        const selesai = daftarHasil.find(x => x.selesai_pada);
        if (selesai && kelas.satu_kali) return jawab({ error: 'Anda sudah mengerjakan quiz ini.', hasil: ringkasHasil(selesai) }, 409);
        if (menungguAdmin(kelas)) return jawab({ error: 'Menunggu pengajar memulai.', menunggu: true }, 409);
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
        sisaMs: sisaWaktuMs(acuanWaktu(kelas, h.mulai_pada), kelas.timer_menit),
        batasPelanggaran: kelas.batas_pelanggaran,
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
        lewat_waktu: lewatWaktu(acuanWaktu(kelas, terbuka.mulai_pada), kelas.timer_menit, sekarang),
        dikirim_otomatis: alasanKirimSah(body.alasan),
      }).eq('id', terbuka.id).is('selesai_pada', null).select('id,percobaan,urutan_soal,mulai_pada,selesai_pada,benar,jumlah,skor,lulus');
      const h = ((tersimpan ?? []) as Hasil[])[0] ?? (await hasilPeserta(db, peserta.id)).find(x => x.selesai_pada);
      return jawab({ hasil: ringkasHasil(h), bolehUlang: !kelas.satu_kali });
    }

    // ── Pelanggaran: dicatat atomik di basis data (lc_eks_catat_pelanggaran, migrasi 051) ──
    if (aksi === 'pelanggaran') {
      if (!terbuka) return jawab({ total: null });
      if (!jenisPelanggaranSah(body.jenis)) return galat('Jenis pelanggaran tidak dikenal.');
      const { data: total } = await db.rpc('lc_eks_catat_pelanggaran', { p_hasil: terbuka.id, p_jenis: body.jenis });
      const n = typeof total === 'number' ? total : null;
      const batas = kelas.batas_pelanggaran;
      return jawab({ total: n, batas, kirimOtomatis: !!batas && n !== null && n >= batas });
    }

    return galat('Permintaan tidak dikenal.');
  } catch {
    return galat('Terjadi gangguan. Coba lagi.', 500);
  }
}


/**
 * Kuis Live: satu jawaban per soal, dikunci begitu terkirim (seperti Kahoot). Poin dihitung dari
 * waktu server sejak pilihan dibuka. Bila semua peserta sudah menjawab, soal ditutup lebih awal
 * dan jadwal sesudahnya (hasil, papan, soal berikutnya) ikut maju.
 */
async function jawabLive(db: Db, kelas: KelasLive, peserta: Peserta, body: Record<string, unknown>) {
  const cek = periksaJawab(kelas, body.indeks, body.pilihan);
  if (!cek.ok) return galat(cek.alasan, 409);
  const indeks = cek.jadwal.indeks;
  const soalId = kelas.live_urutan[indeks];
  const soal = await muatSoalLive(db, soalId);
  if (!soal) return galat('Soal tidak tersedia.', 409);
  const benar = cek.pilihan === soal.kunci;
  const { error } = await db.from('lc_eks_live_jawaban').insert({
    kelas_id: kelas.id, peserta_id: peserta.id, sesi: kelas.live_sesi, indeks, soal_id: soalId,
    pilihan: cek.pilihan, benar, poin: poinKahoot(benar, cek.waktuMs, kelas.detik_per_soal * 1000), waktu_ms: cek.waktuMs,
  });
  if (error) {
    if (error.code !== '23505') return galat('Jawaban belum terkirim. Coba lagi.', 500);
    //  Sudah menjawab (klik ganda / kirim ulang): jawaban pertama yang berlaku.
    const { data: lama } = await db.from('lc_eks_live_jawaban').select('pilihan')
      .eq('peserta_id', peserta.id).eq('sesi', kelas.live_sesi).eq('indeks', indeks).maybeSingle();
    return jawab({ pilihan: (lama as { pilihan: string } | null)?.pilihan ?? cek.pilihan });
  }
  await tutupBilaSemuaMenjawab(db, kelas, await jumlahPeserta(db, kelas.id));
  return jawab({ pilihan: cek.pilihan });
}
