import type { Pilihan } from './kelas-eksternal';

const PILIHAN: readonly Pilihan[] = ['A', 'B', 'C', 'D'];

export const HITUNG_MUNDUR_MS = 4000;
export const TOLERANSI_MS = 800;
export const HASIL_MS = 6000;
export const PAPAN_MS = 6000;
export const POIN_MAKS = 1000;
export const PILIHAN_DETIK = [5, 10, 20, 30, 60, 90, 120, 240] as const;
export const MAKS_PESERTA_LIVE = 500;

export type TahapSimpan = 'lobi' | 'soal' | 'papan' | 'selesai';
export type Tahap = 'lobi' | 'siap' | 'soal' | 'hasil' | 'papan' | 'selesai';

export interface StatusLive {
  detik_per_soal: number;
  live_tahap: TahapSimpan; live_indeks: number; live_urutan: string[];
  live_soal_mulai: string | null; live_soal_tutup: string | null; live_sesi: number;
  live_jeda_pada?: string | null;
}

const ms = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);
const iso = (t: number) => new Date(t).toISOString();

export interface Jadwal {
  tahap: Tahap;
  indeks: number;
  mulaiMs: number | null;
  tutupMs: number | null;
  akhirMs: number | null;
  jedaMs: number | null;
}

type DasarJadwal = Pick<StatusLive, 'live_tahap' | 'live_indeks' | 'live_urutan' | 'live_soal_mulai' | 'live_soal_tutup' | 'detik_per_soal' | 'live_jeda_pada'>;

export function jadwalLive(k: DasarJadwal, sekarang = Date.now()): Jadwal {
  if (k.live_tahap === 'lobi' || k.live_tahap === 'selesai') {
    return { tahap: k.live_tahap, indeks: k.live_indeks, mulaiMs: null, tutupMs: null, akhirMs: null, jedaMs: null };
  }
  if (k.live_tahap === 'papan') {
    return { tahap: 'papan', indeks: k.live_indeks, mulaiMs: ms(k.live_soal_mulai), tutupMs: ms(k.live_soal_tutup), akhirMs: null, jedaMs: null };
  }
  if (k.live_jeda_pada) {
    const jedaMs = ms(k.live_jeda_pada);
    return { ...jalankanJadwal(k, jedaMs), akhirMs: null, jedaMs };
  }
  return { ...jalankanJadwal(k, sekarang), jedaMs: null };
}

function jalankanJadwal(k: DasarJadwal, sekarang: number): Omit<Jadwal, 'jedaMs'> {
  const total = Math.max(1, k.live_urutan.length);
  const durasi = k.detik_per_soal * 1000;
  let i = k.live_indeks, mulai = ms(k.live_soal_mulai), tutup = ms(k.live_soal_tutup);
  for (;;) {
    const j = (tahap: Tahap, akhirMs: number | null): Omit<Jadwal, 'jedaMs'> => ({ tahap, indeks: i, mulaiMs: mulai, tutupMs: tutup, akhirMs });
    if (sekarang < mulai) return j('siap', mulai);
    const habis = tutup + TOLERANSI_MS;
    if (sekarang < habis) return j('soal', habis);
    const akhirHasil = habis + HASIL_MS;
    if (sekarang < akhirHasil) return j('hasil', akhirHasil);
    const akhirPapan = akhirHasil + PAPAN_MS;
    if (sekarang < akhirPapan) return j('papan', akhirPapan);
    if (i + 1 >= total) return j('selesai', null);
    i += 1;
    mulai = akhirPapan + HITUNG_MUNDUR_MS;
    tutup = mulai + durasi;
  }
}

export const tahapEfektif = (k: DasarJadwal, sekarang = Date.now()): Tahap => jadwalLive(k, sekarang).tahap;

export function poinKahoot(benar: boolean, waktuMs: number, durasiMs: number): number {
  if (!benar || durasiMs <= 0) return 0;
  const r = Math.min(1, Math.max(0, waktuMs / durasiMs));
  return Math.round(POIN_MAKS * (1 - r / 2));
}

export function periksaJawab(k: StatusLive, indeks: unknown, pilihan: unknown, sekarang = Date.now()):
  { ok: true; pilihan: Pilihan; waktuMs: number; jadwal: Jadwal } | { ok: false; alasan: string } {
  const p = String(pilihan ?? '').toUpperCase();
  if (!(PILIHAN as readonly string[]).includes(p)) return { ok: false, alasan: 'Pilihan tidak dikenal.' };
  const j = jadwalLive(k, sekarang);
  if (j.tahap === 'lobi') return { ok: false, alasan: 'Kuis belum dimulai.' };
  if (j.jedaMs) return { ok: false, alasan: 'Kuis sedang dijeda presenter.' };
  if (Number(indeks) !== j.indeks || (j.tahap !== 'soal' && j.tahap !== 'siap' && j.tahap !== 'hasil')) return { ok: false, alasan: 'Soal sudah berganti.' };
  if (j.tahap === 'siap') return { ok: false, alasan: 'Pilihan belum dibuka.' };
  if (j.tahap === 'hasil') return { ok: false, alasan: 'Waktu habis.' };
  const durasi = k.detik_per_soal * 1000;
  return { ok: true, pilihan: p as Pilihan, waktuMs: Math.min(durasi, Math.max(0, sekarang - (j.mulaiMs ?? sekarang))), jadwal: j };
}

export function indeksTerhitung(k: DasarJadwal, sekarang = Date.now()): number {
  const j = jadwalLive(k, sekarang);
  if (j.tahap === 'lobi') return -1;
  if (j.tahap === 'siap' || j.tahap === 'soal') return j.indeks - 1;
  return j.indeks;
}

export type AksiLive = 'live_mulai' | 'live_lewati' | 'live_tutup_soal' | 'live_lanjut' | 'live_akhiri' | 'live_ulang'
  | 'live_jeda' | 'live_lanjutkan' | 'live_ulang_soal' | 'live_mundur';
export const AKSI_LIVE: readonly AksiLive[] = ['live_mulai', 'live_lewati', 'live_tutup_soal', 'live_lanjut', 'live_akhiri', 'live_ulang',
  'live_jeda', 'live_lanjutkan', 'live_ulang_soal', 'live_mundur'];

export function anulirDari(aksi: AksiLive, j: Pick<Jadwal, 'indeks'>): number | null {
  if (aksi === 'live_ulang_soal') return j.indeks;
  if (aksi === 'live_mundur') return Math.max(0, j.indeks - 1);
  return null;
}
export type UbahanLive = Partial<Omit<StatusLive, 'detik_per_soal'>>;

export function transisiLive(k: StatusLive, aksi: AksiLive, sekarang = Date.now(), urutanBaru: string[] = []): UbahanLive | { galat: string } {
  const j = jadwalLive(k, sekarang);
  const durasi = k.detik_per_soal * 1000;
  const soalBaru = (indeks: number): UbahanLive => ({
    live_tahap: 'soal', live_indeks: indeks, live_jeda_pada: null,
    live_soal_mulai: iso(sekarang + HITUNG_MUNDUR_MS), live_soal_tutup: iso(sekarang + HITUNG_MUNDUR_MS + durasi),
  });
  const berjalan = j.tahap !== 'lobi' && j.tahap !== 'selesai';
  const dijeda = !!j.jedaMs;
  const geser = (tutup: number): UbahanLive => ({
    live_tahap: 'soal', live_indeks: j.indeks,
    live_soal_tutup: iso(tutup), live_soal_mulai: iso(Math.min(j.mulaiMs ?? tutup, tutup)),
  });
  switch (aksi) {
    case 'live_mulai':
      if (j.tahap !== 'lobi') return { galat: 'Kuis sudah berjalan.' };
      if (!urutanBaru.length) return { galat: 'Soal kuis ini belum tersedia.' };
      return { ...soalBaru(0), live_urutan: urutanBaru, live_sesi: k.live_sesi + 1 };
    case 'live_lewati':
    case 'live_tutup_soal':
    case 'live_lanjut':
      if (dijeda) return { galat: 'Kuis sedang dijeda - tekan Lanjutkan dulu.' };
      if (j.tahap === 'siap' || j.tahap === 'soal') return geser(sekarang - TOLERANSI_MS);
      if (j.tahap === 'hasil') return geser(sekarang - TOLERANSI_MS - HASIL_MS);
      if (j.tahap === 'papan') {
        return j.indeks + 1 < k.live_urutan.length ? soalBaru(j.indeks + 1) : { live_tahap: 'selesai', live_indeks: j.indeks };
      }
      return { galat: j.tahap === 'lobi' ? 'Kuis belum dimulai.' : 'Kuis sudah selesai.' };
    case 'live_akhiri':
      if (!berjalan) return { galat: 'Kuis tidak sedang berjalan.' };
      return j.tahap === 'siap' || j.tahap === 'soal'
        ? { ...geser(sekarang - TOLERANSI_MS), live_tahap: 'selesai', live_jeda_pada: null }
        : { live_tahap: 'selesai', live_indeks: j.indeks, live_jeda_pada: null };
    case 'live_ulang':
      if (j.tahap === 'lobi') return { galat: 'Kuis belum dimulai.' };
      return { live_tahap: 'lobi', live_indeks: 0, live_soal_mulai: null, live_soal_tutup: null, live_jeda_pada: null };
    case 'live_jeda':
      if (!berjalan || k.live_tahap !== 'soal') return { galat: 'Jeda hanya saat kuis berjalan.' };
      if (dijeda) return { galat: 'Kuis sudah dijeda.' };
      return { live_jeda_pada: iso(sekarang) };
    case 'live_lanjutkan': {
      if (!k.live_jeda_pada) return { galat: 'Kuis tidak sedang dijeda.' };
      const lama = Math.max(0, sekarang - ms(k.live_jeda_pada));
      return {
        live_jeda_pada: null,
        live_soal_mulai: iso(ms(k.live_soal_mulai) + lama), live_soal_tutup: iso(ms(k.live_soal_tutup) + lama),
      };
    }
    case 'live_ulang_soal':
      if (!berjalan) return { galat: 'Kuis tidak sedang berjalan.' };
      return soalBaru(j.indeks);
    case 'live_mundur':
      if (!berjalan) return { galat: 'Kuis tidak sedang berjalan.' };
      if (j.indeks <= 0) return { galat: 'Ini sudah soal pertama.' };
      return soalBaru(j.indeks - 1);
  }
}

export function wujudkanLive(k: StatusLive, sekarang = Date.now()): UbahanLive | null {
  if (k.live_tahap !== 'soal' || k.live_jeda_pada) return null;
  const j = jadwalLive(k, sekarang);
  if (j.tahap === 'selesai') return { live_tahap: 'selesai', live_indeks: j.indeks };
  if (j.indeks === k.live_indeks) return null;
  return { live_indeks: j.indeks, live_soal_mulai: iso(j.mulaiMs!), live_soal_tutup: iso(j.tutupMs!) };
}

export const semuaMenjawab = (jumlahMenjawab: number, jumlahPeserta: number) => jumlahPeserta > 0 && jumlahMenjawab >= jumlahPeserta;

export interface RekapPeserta { peserta_id: string; nama: string; poin: number | string; benar: number | string; dijawab: number | string; waktu_benar_ms: number | string }
export interface BarisPapan { peserta_id: string; nama: string; poin: number; benar: number; dijawab: number; waktuBenarMs: number; peringkat: number }

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

export function posisiSaya(papan: BarisPapan[], pesertaId: string): { peringkat: number; poin: number; benar: number; jumlah: number; atas: { nama: string; selisih: number } | null } | null {
  const i = papan.findIndex(b => b.peserta_id === pesertaId);
  if (i < 0) return null;
  const saya = papan[i];
  const atas = papan.slice(0, i).reverse().find(b => b.poin > saya.poin);
  return { peringkat: saya.peringkat, poin: saya.poin, benar: saya.benar, jumlah: papan.length, atas: atas ? { nama: atas.nama, selisih: atas.poin - saya.poin } : null };
}

export function distribusi(jawaban: { pilihan: string }[]): Record<Pilihan, number> {
  const d: Record<Pilihan, number> = { A: 0, B: 0, C: 0, D: 0 };
  for (const j of jawaban) if ((PILIHAN as readonly string[]).includes(j.pilihan)) d[j.pilihan as Pilihan]++;
  return d;
}

export function rapikanDetik(v: unknown, bawaan = 20): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return bawaan;
  return PILIHAN_DETIK.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a));
}

export const WARNA_BAWAAN = '#46178f';
export const PALET_TEMA = ['#46178f', '#1368ce', '#0b2a5b', '#0e7c66', '#8b1e3f', '#c2410c', '#1f2937'] as const;

export function rapikanWarna(v: unknown): string | null {
  const s = String(v ?? '').trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(s) ? s : null;
}

export const FOLDER_GAMBAR = 'kuis-live';
export function rapikanUrlGambar(v: unknown): string | null {
  const s = String(v ?? '').trim();
  return /^https:\/\/[a-z0-9.-]+\/storage\/v1\/object\/public\/merek-files\/kuis-live\/[A-Za-z0-9._-]{1,120}$/.test(s) ? s : null;
}

export function teksDiAtas(hex: string): '#ffffff' | '#111827' {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) > 186 ? '#111827' : '#ffffff';
}

export function labelTahap(t: Tahap, indeks: number, total: number): string {
  switch (t) {
    case 'lobi': return 'Lobi';
    case 'siap': case 'soal': return `Soal ${indeks + 1}/${total} berjalan`;
    case 'hasil': return `Soal ${indeks + 1}/${total} · jawaban dibuka`;
    case 'papan': return `Papan skor setelah soal ${indeks + 1}/${total}`;
    case 'selesai': return 'Selesai';
  }
}

export function statusLive(k: DasarJadwal & { aktif: boolean; maks_peserta: number }, jumlahPeserta: number, sekarang = Date.now()): 'buka' | 'nonaktif' | 'selesai' | 'penuh' {
  if (!k.aktif) return 'nonaktif';
  if (tahapEfektif(k, sekarang) === 'selesai') return 'selesai';
  if (jumlahPeserta >= k.maks_peserta) return 'penuh';
  return 'buka';
}

export const PESAN_LIVE = {
  nonaktif: 'Kuis ini sedang tidak dibuka.',
  selesai: 'Kuis ini sudah selesai.',
  penuh: 'Kuis ini sudah penuh.',
} as const;
