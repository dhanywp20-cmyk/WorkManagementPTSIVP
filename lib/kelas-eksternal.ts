/**
 * lib/kelas-eksternal.ts - aturan Kelas Eksternal Learning Center (quiz untuk customer tanpa akun).
 * Murni (tanpa basis data), dipakai route server & halaman, dan diuji di uji/kelas-eksternal.ts.
 *
 * Peserta cukup mengisi NAMA. Perangkatnya menyimpan token acak (localStorage); server hanya
 * menyimpan hash-nya - jadi kembali dari HP yang sama melanjutkan, bukan mendaftar ulang.
 */

export const MAKS_NAMA = 80;
export const PILIHAN = ['A', 'B', 'C', 'D'] as const;
export type Pilihan = typeof PILIHAN[number];
/** Toleransi sesudah waktu habis (jaringan lambat, kirim otomatis). Lebih dari ini ditandai lewat waktu. */
export const TOLERANSI_DETIK = 60;

export interface KelasEksternal {
  id: string; judul: string; keterangan: string; token: string;
  question_ids: string[]; timer_menit: number | null; passing_grade: number;
  acak_soal: boolean; satu_kali: boolean; aktif: boolean;
  buka_pada: string | null; tutup_pada: string | null; maks_peserta: number;
  dibuat_nama?: string | null; created_at?: string; updated_at?: string;
}

/** Nama tampil + bentuk pembanding (huruf kecil, spasi tunggal) - atau pesan galat. */
export function rapikanNama(masukan: unknown): { nama: string; norm: string } | { galat: string } {
  const nama = String(masukan ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (nama.length < 2) return { galat: 'Isi nama lengkap Anda.' };
  if (nama.length > MAKS_NAMA) return { galat: `Nama maksimal ${MAKS_NAMA} karakter.` };
  if (!/\p{L}/u.test(nama)) return { galat: 'Nama harus berisi huruf.' };
  return { nama, norm: nama.toLowerCase() };
}

export type StatusKelas = 'buka' | 'nonaktif' | 'belum' | 'selesai' | 'penuh';

/** Status untuk PENDAFTARAN baru. Peserta yang sudah terdaftar tetap boleh melihat/menyelesaikan. */
export function statusKelas(k: Pick<KelasEksternal, 'aktif' | 'buka_pada' | 'tutup_pada' | 'maks_peserta'>, jumlahPeserta: number, sekarang = Date.now()): StatusKelas {
  if (!k.aktif) return 'nonaktif';
  if (k.buka_pada && new Date(k.buka_pada).getTime() > sekarang) return 'belum';
  if (k.tutup_pada && new Date(k.tutup_pada).getTime() <= sekarang) return 'selesai';
  if (jumlahPeserta >= k.maks_peserta) return 'penuh';
  return 'buka';
}

export const PESAN_STATUS: Record<Exclude<StatusKelas, 'buka'>, string> = {
  nonaktif: 'Kelas ini sedang tidak dibuka.',
  belum: 'Kelas ini belum dibuka.',
  selesai: 'Kelas ini sudah ditutup.',
  penuh: 'Kuota peserta kelas ini sudah penuh.',
};

/** Jawaban mentah dari peramban -> hanya soal milik percobaan ini, hanya A-D. */
export function saringJawaban(mentah: unknown, urutan: string[]): Record<string, Pilihan> {
  const hasil: Record<string, Pilihan> = {};
  if (!mentah || typeof mentah !== 'object') return hasil;
  const boleh = new Set(urutan);
  for (const [id, v] of Object.entries(mentah as Record<string, unknown>)) {
    const p = String(v ?? '').toUpperCase();
    if (boleh.has(id) && (PILIHAN as readonly string[]).includes(p)) hasil[id] = p as Pilihan;
  }
  return hasil;
}

export interface Penilaian { benar: number; jumlah: number; skor: number; lulus: boolean }

/** Skor 0-100 (dibulatkan) atas SEMUA soal percobaan - yang tidak dijawab dihitung salah. */
export function nilaiJawaban(kunci: Record<string, string>, urutan: string[], jawaban: Record<string, Pilihan>, passingGrade: number): Penilaian {
  const jumlah = urutan.length;
  const benar = urutan.filter(id => kunci[id] && jawaban[id] === String(kunci[id]).toUpperCase()).length;
  const skor = jumlah ? Math.round((benar / jumlah) * 100) : 0;
  return { benar, jumlah, skor, lulus: skor >= passingGrade };
}

/** Acak Fisher-Yates dengan `acak` yang bisa diganti saat diuji. */
export function acakUrutan<T>(daftar: T[], acak: () => number = Math.random): T[] {
  const a = [...daftar];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(acak() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Sisa waktu (ms) percobaan berbatas waktu; null bila tanpa batas. */
export function sisaWaktuMs(mulaiIso: string, timerMenit: number | null, sekarang = Date.now()): number | null {
  if (!timerMenit) return null;
  return Math.max(0, new Date(mulaiIso).getTime() + timerMenit * 60_000 - sekarang);
}

/** Lewat waktu bila dikirim lebih dari timer + toleransi. */
export function lewatWaktu(mulaiIso: string, timerMenit: number | null, sekarang = Date.now()): boolean {
  if (!timerMenit) return false;
  return sekarang - new Date(mulaiIso).getTime() > (timerMenit * 60 + TOLERANSI_DETIK) * 1000;
}

/** Rapikan isian admin (simpan kelas). */
export function rapikanKelas(m: Record<string, unknown>): { galat: string } | Omit<KelasEksternal, 'id' | 'token'> {
  const judul = String(m.judul ?? '').replace(/\s+/g, ' ').trim();
  if (!judul) return { galat: 'Judul kelas wajib diisi.' };
  if (judul.length > 120) return { galat: 'Judul maksimal 120 karakter.' };
  const ids = Array.isArray(m.question_ids) ? [...new Set(m.question_ids.map(String))].filter(x => /^[0-9a-f-]{36}$/i.test(x)) : [];
  if (!ids.length) return { galat: 'Pilih minimal satu soal.' };
  if (ids.length > 200) return { galat: 'Maksimal 200 soal per kelas.' };
  const angka = (v: unknown, min: number, max: number, bawaan: number | null) => {
    if (v === null || v === '' || v === undefined) return bawaan;
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : bawaan;
  };
  const tgl = (v: unknown) => { const s = String(v ?? '').trim(); if (!s) return null; const d = new Date(s); return Number.isNaN(d.getTime()) ? null : d.toISOString(); };
  const buka = tgl(m.buka_pada), tutup = tgl(m.tutup_pada);
  if (buka && tutup && new Date(tutup) <= new Date(buka)) return { galat: 'Waktu tutup harus sesudah waktu buka.' };
  return {
    judul,
    keterangan: String(m.keterangan ?? '').trim().slice(0, 1000),
    question_ids: ids,
    timer_menit: angka(m.timer_menit, 1, 300, null),
    passing_grade: angka(m.passing_grade, 0, 100, 70) as number,
    acak_soal: m.acak_soal !== false,
    satu_kali: m.satu_kali !== false,
    aktif: m.aktif !== false,
    buka_pada: buka, tutup_pada: tutup,
    maks_peserta: angka(m.maks_peserta, 1, 2000, 200) as number,
  };
}

/** Kunci localStorage token peserta untuk satu kelas. */
export const kunciPeserta = (tokenKelas: string) => `kelas-eksternal:${tokenKelas}`;
