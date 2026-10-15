/**
 * lib/kuis-live.ts - format "Kuis Live" (ala Kahoot) Kelas Eksternal. Murni (tanpa basis data),
 * dipakai route server, layar host admin & halaman peserta, dan diuji di uji/kuis-live.ts.
 *
 * Admin memandu: lobi -> [siap -> soal -> hasil -> papan] x N -> selesai. Yang disimpan di basis
 * data hanya lobi/soal/papan/selesai; 'siap' (hitung mundur sebelum pilihan muncul) dan 'hasil'
 * (waktu habis, kunci dibuka) diturunkan dari live_soal_mulai/live_soal_tutup - jadi pergantian
 * karena waktu tidak butuh penjadwal di server, cukup jam.
 */
import type { Pilihan } from './kelas-eksternal';

//  Salinan PILIHAN dari kelas-eksternal - modul itu mengimpor berkas ini, jadi jangan impor balik.
const PILIHAN: readonly Pilihan[] = ['A', 'B', 'C', 'D'];

/** Jeda "Siap-siap" sebelum pilihan jawaban muncul. */
export const HITUNG_MUNDUR_MS = 4000;
/** Jawaban yang berangkat tepat sebelum waktu habis tetap diterima selama jeda jaringan ini. */
export const TOLERANSI_MS = 800;
export const POIN_MAKS = 1000;
export const PILIHAN_DETIK = [5, 10, 20, 30, 60, 90, 120, 240] as const;
export const MAKS_PESERTA_LIVE = 500;

export type TahapSimpan = 'lobi' | 'soal' | 'papan' | 'selesai';
export type Tahap = 'lobi' | 'siap' | 'soal' | 'hasil' | 'papan' | 'selesai';

export interface StatusLive {
  detik_per_soal: number;
  live_tahap: TahapSimpan; live_indeks: number; live_urutan: string[];
  live_soal_mulai: string | null; live_soal_tutup: string | null; live_sesi: number;
}

const ms = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);
const iso = (t: number) => new Date(t).toISOString();

/** Tahap yang sedang berlaku menurut jam. */
export function tahapEfektif(k: Pick<StatusLive, 'live_tahap' | 'live_soal_mulai' | 'live_soal_tutup'>, sekarang = Date.now()): Tahap {
  if (k.live_tahap !== 'soal') return k.live_tahap;
  if (sekarang < ms(k.live_soal_mulai)) return 'siap';
  if (sekarang < ms(k.live_soal_tutup) + TOLERANSI_MS) return 'soal';
  return 'hasil';
}

/**
 * Poin ala Kahoot: benar seketika = 1000, benar tepat di detik terakhir = 500, salah = 0.
 * Pembaginya waktu soal penuh (bukan waktu sampai ditutup), jadi soal yang ditutup lebih cepat
 * karena semua sudah menjawab tidak mengubah nilai siapa pun.
 */
export function poinKahoot(benar: boolean, waktuMs: number, durasiMs: number): number {
  if (!benar || durasiMs <= 0) return 0;
  const r = Math.min(1, Math.max(0, waktuMs / durasiMs));
  return Math.round(POIN_MAKS * (1 - r / 2));
}

/** Pemeriksaan jawaban masuk: masih soal yang sama & masih dalam waktu. */
export function periksaJawab(k: StatusLive, indeks: unknown, pilihan: unknown, sekarang = Date.now()):
  { ok: true; pilihan: Pilihan; waktuMs: number } | { ok: false; alasan: string } {
  const p = String(pilihan ?? '').toUpperCase();
  if (!(PILIHAN as readonly string[]).includes(p)) return { ok: false, alasan: 'Pilihan tidak dikenal.' };
  const t = tahapEfektif(k, sekarang);
  if (Number(indeks) !== k.live_indeks || (t !== 'soal' && t !== 'siap' && t !== 'hasil')) return { ok: false, alasan: 'Soal sudah berganti.' };
  if (t === 'siap') return { ok: false, alasan: 'Pilihan belum dibuka.' };
  if (t === 'hasil') return { ok: false, alasan: 'Waktu habis.' };
  const durasi = k.detik_per_soal * 1000;
  return { ok: true, pilihan: p as Pilihan, waktuMs: Math.min(durasi, Math.max(0, sekarang - ms(k.live_soal_mulai))) };
}

/**
 * Soal terakhir yang poinnya SUDAH boleh terlihat. Selama soal berjalan, poin soal itu belum
 * dihitung - kalau tidak, skor yang naik membocorkan benar/salah sebelum kunci dibuka.
 */
export function indeksTerhitung(k: Pick<StatusLive, 'live_tahap' | 'live_indeks' | 'live_soal_mulai' | 'live_soal_tutup'>, sekarang = Date.now()): number {
  const t = tahapEfektif(k, sekarang);
  if (t === 'lobi') return -1;
  if (t === 'siap' || t === 'soal') return k.live_indeks - 1;
  return k.live_indeks;
}

export type AksiLive = 'live_mulai' | 'live_tutup_soal' | 'live_lanjut' | 'live_akhiri' | 'live_ulang';
export const AKSI_LIVE: readonly AksiLive[] = ['live_mulai', 'live_tutup_soal', 'live_lanjut', 'live_akhiri', 'live_ulang'];
export type UbahanLive = Partial<Omit<StatusLive, 'detik_per_soal'>>;

/**
 * Perubahan status untuk satu tombol admin, atau galat bila tombol itu tidak berlaku di tahap ini.
 * `urutanBaru` (soal yang sah, sudah diacak bila perlu) hanya dipakai saat Mulai.
 */
export function transisiLive(k: StatusLive, aksi: AksiLive, sekarang = Date.now(), urutanBaru: string[] = []): UbahanLive | { galat: string } {
  const t = tahapEfektif(k, sekarang);
  const durasi = k.detik_per_soal * 1000;
  const soalBaru = (indeks: number): UbahanLive => ({
    live_tahap: 'soal', live_indeks: indeks,
    live_soal_mulai: iso(sekarang + HITUNG_MUNDUR_MS), live_soal_tutup: iso(sekarang + HITUNG_MUNDUR_MS + durasi),
  });
  switch (aksi) {
    case 'live_mulai':
      if (t !== 'lobi') return { galat: 'Kuis sudah berjalan.' };
      if (!urutanBaru.length) return { galat: 'Soal kuis ini belum tersedia.' };
      return { ...soalBaru(0), live_urutan: urutanBaru, live_sesi: k.live_sesi + 1 };
    case 'live_tutup_soal': {
      if (t !== 'siap' && t !== 'soal') return { galat: 'Tidak ada soal yang sedang berjalan.' };
      //  Mundurkan batas sejauh toleransi: kunci langsung terbuka, jawaban yang datang sesudahnya ditolak.
      const tutup = sekarang - TOLERANSI_MS;
      return { live_soal_tutup: iso(tutup), live_soal_mulai: iso(Math.min(ms(k.live_soal_mulai), tutup)) };
    }
    case 'live_lanjut':
      if (t === 'hasil') return { live_tahap: 'papan' };
      if (t === 'papan') return k.live_indeks + 1 < k.live_urutan.length ? soalBaru(k.live_indeks + 1) : { live_tahap: 'selesai' };
      return { galat: t === 'siap' || t === 'soal' ? 'Tunggu waktu habis atau tekan Lewati.' : 'Belum bisa lanjut.' };
    case 'live_akhiri':
      if (t === 'lobi' || t === 'selesai') return { galat: 'Kuis tidak sedang berjalan.' };
      return t === 'siap' || t === 'soal'
        ? { live_tahap: 'selesai', live_soal_tutup: iso(sekarang - TOLERANSI_MS), live_soal_mulai: iso(Math.min(ms(k.live_soal_mulai), sekarang - TOLERANSI_MS)) }
        : { live_tahap: 'selesai' };
    case 'live_ulang':
      if (t !== 'selesai') return { galat: 'Kuis belum selesai.' };
      return { live_tahap: 'lobi', live_indeks: 0, live_soal_mulai: null, live_soal_tutup: null };
  }
}

/** Semua peserta sudah menjawab soal ini -> soal boleh ditutup lebih awal. */
export const semuaMenjawab = (jumlahMenjawab: number, jumlahPeserta: number) => jumlahPeserta > 0 && jumlahMenjawab >= jumlahPeserta;

// ── Papan skor ───────────────────────────────────────────────────────────────

/** Satu baris rekap dari lc_eks_live_papan (angka bigint bisa datang sebagai string). */
export interface RekapPeserta { peserta_id: string; nama: string; poin: number | string; benar: number | string; dijawab: number | string; waktu_benar_ms: number | string }
export interface BarisPapan { peserta_id: string; nama: string; poin: number; benar: number; dijawab: number; waktuBenarMs: number; peringkat: number }

/**
 * Urutkan: poin terbanyak, lalu yang total waktu jawab benarnya lebih cepat. Peringkat sama hanya
 * bila poin DAN waktu sama persis (mis. dua-duanya 0).
 */
export function susunPapan(rekap: RekapPeserta[]): BarisPapan[] {
  const baris = rekap.map(r => ({
    peserta_id: r.peserta_id, nama: r.nama, poin: Number(r.poin) || 0, benar: Number(r.benar) || 0,
    dijawab: Number(r.dijawab) || 0, waktuBenarMs: Number(r.waktu_benar_ms) || 0, peringkat: 0,
  }));
  baris.sort((a, b) => b.poin - a.poin || a.waktuBenarMs - b.waktuBenarMs || a.nama.localeCompare(b.nama, 'id'));
  baris.forEach((b, i) => {
    const sebelum = baris[i - 1];
    b.peringkat = sebelum && sebelum.poin === b.poin && sebelum.waktuBenarMs === b.waktuBenarMs ? sebelum.peringkat : i + 1;
  });
  return baris;
}

/** Posisi satu peserta + siapa tepat di atasnya (untuk "120 poin di belakang Budi"). */
export function posisiSaya(papan: BarisPapan[], pesertaId: string): { peringkat: number; poin: number; benar: number; jumlah: number; atas: { nama: string; selisih: number } | null } | null {
  const i = papan.findIndex(b => b.peserta_id === pesertaId);
  if (i < 0) return null;
  const saya = papan[i];
  const atas = papan.slice(0, i).reverse().find(b => b.poin > saya.poin);
  return { peringkat: saya.peringkat, poin: saya.poin, benar: saya.benar, jumlah: papan.length, atas: atas ? { nama: atas.nama, selisih: atas.poin - saya.poin } : null };
}

/** Jumlah pemilih tiap pilihan. */
export function distribusi(jawaban: { pilihan: string }[]): Record<Pilihan, number> {
  const d: Record<Pilihan, number> = { A: 0, B: 0, C: 0, D: 0 };
  for (const j of jawaban) if ((PILIHAN as readonly string[]).includes(j.pilihan)) d[j.pilihan as Pilihan]++;
  return d;
}

/** Waktu per soal dari isian admin: dibulatkan ke pilihan terdekat (5-240 detik). */
export function rapikanDetik(v: unknown, bawaan = 20): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return bawaan;
  return PILIHAN_DETIK.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a));
}

// ── Tampilan (tema, logo, latar) ────────────────────────────────────────────

export const WARNA_BAWAAN = '#46178f';
/** Pilihan cepat warna tema di form admin. */
export const PALET_TEMA = ['#46178f', '#1368ce', '#0b2a5b', '#0e7c66', '#8b1e3f', '#c2410c', '#1f2937'] as const;

/** Hanya #rrggbb (huruf kecil); selain itu = bawaan (null). */
export function rapikanWarna(v: unknown): string | null {
  const s = String(v ?? '').trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(s) ? s : null;
}

/** Folder unggahan logo/latar Kuis Live di bucket merek-files. */
export const FOLDER_GAMBAR = 'kuis-live';
/**
 * Hanya gambar hasil unggahan kita sendiri (bucket merek-files/kuis-live/) yang boleh dipasang -
 * link luar bisa berisi apa saja dan ikut tampil di HP semua peserta.
 */
export function rapikanUrlGambar(v: unknown): string | null {
  const s = String(v ?? '').trim();
  return /^https:\/\/[a-z0-9.-]+\/storage\/v1\/object\/public\/merek-files\/kuis-live\/[A-Za-z0-9._-]{1,120}$/.test(s) ? s : null;
}

/** Teks di atas warna tema: putih kecuali warnanya sangat terang. */
export function teksDiAtas(hex: string): '#ffffff' | '#111827' {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) > 186 ? '#111827' : '#ffffff';
}

/** Label tahap untuk kartu admin. */
export function labelTahap(t: Tahap, indeks: number, total: number): string {
  switch (t) {
    case 'lobi': return 'Lobi';
    case 'siap': case 'soal': return `Soal ${indeks + 1}/${total} berjalan`;
    case 'hasil': return `Soal ${indeks + 1}/${total} · jawaban dibuka`;
    case 'papan': return `Papan skor setelah soal ${indeks + 1}/${total}`;
    case 'selesai': return 'Selesai';
  }
}

/** Status pendaftaran Kuis Live (tanpa jadwal buka/tutup - admin yang memandu). */
export function statusLive(k: { aktif: boolean; maks_peserta: number; live_tahap: TahapSimpan }, jumlahPeserta: number): 'buka' | 'nonaktif' | 'selesai' | 'penuh' {
  if (!k.aktif) return 'nonaktif';
  if (k.live_tahap === 'selesai') return 'selesai';
  if (jumlahPeserta >= k.maks_peserta) return 'penuh';
  return 'buka';
}

export const PESAN_LIVE = {
  nonaktif: 'Kuis ini sedang tidak dibuka.',
  selesai: 'Kuis ini sudah selesai.',
  penuh: 'Kuis ini sudah penuh.',
} as const;
