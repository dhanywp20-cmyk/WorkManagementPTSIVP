
import { MAKS_PESERTA_LIVE, rapikanDetik, rapikanUrlGambar, rapikanWarna } from './live';

export const MAKS_NAMA = 80;
export const PILIHAN = ['A', 'B', 'C', 'D'] as const;
export type Pilihan = typeof PILIHAN[number];
export const TOLERANSI_DETIK = 60;

export interface KelasEksternal {
  id: string; judul: string; keterangan: string; token: string;
  question_ids: string[]; timer_menit: number | null; passing_grade: number;
  acak_soal: boolean; satu_kali: boolean; aktif: boolean;
  buka_pada: string | null; tutup_pada: string | null; maks_peserta: number;
  mode_mulai: ModeMulai; dimulai_pada: string | null;
  batas_pelanggaran: number | null;
  jenis: JenisKelas;
  detik_per_soal: number;
  tema_warna: string | null; logo_url: string | null; latar_url: string | null;
  isian_peserta: IsianPeserta;
  dibuat_nama?: string | null; created_at?: string; updated_at?: string;
}

export type ModeMulai = 'auto' | 'admin';
export type JenisKelas = 'mandiri' | 'live';

export type IsianPeserta = 'nama' | 'instansi' | 'kontak';
export const ISIAN_PESERTA: { nilai: IsianPeserta; label: string; ket: string }[] = [
  { nilai: 'nama', label: 'Nama saja', ket: 'Paling cepat untuk peserta.' },
  { nilai: 'instansi', label: 'Nama + perusahaan', ket: 'Perusahaan/instansi wajib diisi.' },
  { nilai: 'kontak', label: 'Nama + perusahaan + kontak', ket: 'Email/HP opsional, dengan izin dihubungi.' },
];
export const rapikanIsianPeserta = (v: unknown): IsianPeserta => (v === 'instansi' || v === 'kontak' ? v : 'nama');
export const MAKS_INSTANSI = 120;
export const MAKS_KONTAK = 120;

export interface DataPeserta { instansi: string | null; kontak: string | null; izin_kontak: boolean }

const bersih = (v: unknown) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim();

export function rapikanDataPeserta(isian: IsianPeserta, m: Record<string, unknown>): DataPeserta | { galat: string } {
  if (isian === 'nama') return { instansi: null, kontak: null, izin_kontak: false };
  const instansi = bersih(m.instansi);
  if (instansi.length < 2) return { galat: 'Isi nama perusahaan / instansi Anda.' };
  if (instansi.length > MAKS_INSTANSI) return { galat: `Nama perusahaan maksimal ${MAKS_INSTANSI} karakter.` };
  if (isian === 'instansi') return { instansi, kontak: null, izin_kontak: false };
  const kontak = bersih(m.kontak);
  if (!kontak) return { instansi, kontak: null, izin_kontak: false };
  if (kontak.length > MAKS_KONTAK) return { galat: `Kontak maksimal ${MAKS_KONTAK} karakter.` };
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(kontak);
  const digit = kontak.replace(/[\s().-]/g, '');
  const hp = /^\+?\d{8,15}$/.test(digit);
  if (!email && !hp) return { galat: 'Kontak harus berupa email atau nomor HP.' };
  return { instansi, kontak, izin_kontak: m.izin_kontak === true };
}

export const JENIS_PELANGGARAN = ['pindah_tab', 'keluar_jendela', 'salin_tempel'] as const;
export type JenisPelanggaran = typeof JENIS_PELANGGARAN[number];
export const LABEL_PELANGGARAN: Record<JenisPelanggaran, string> = {
  pindah_tab: 'Pindah tab / aplikasi',
  keluar_jendela: 'Keluar jendela',
  salin_tempel: 'Salin / tempel / klik kanan',
};
export const jenisPelanggaranSah = (j: unknown): j is JenisPelanggaran => (JENIS_PELANGGARAN as readonly string[]).includes(String(j));

export const ALASAN_KIRIM_OTOMATIS = ['waktu', 'pelanggaran', 'diakhiri'] as const;
export type AlasanKirimOtomatis = typeof ALASAN_KIRIM_OTOMATIS[number];
export const alasanKirimSah = (a: unknown): AlasanKirimOtomatis | null =>
  ((ALASAN_KIRIM_OTOMATIS as readonly string[]).includes(String(a)) ? (a as AlasanKirimOtomatis) : null);

export const menungguAdmin = (k: Pick<KelasEksternal, 'mode_mulai' | 'dimulai_pada'>) => k.mode_mulai === 'admin' && !k.dimulai_pada;

export function acuanWaktu(k: Pick<KelasEksternal, 'mode_mulai' | 'dimulai_pada'>, mulaiPercobaan: string): string {
  return k.mode_mulai === 'admin' && k.dimulai_pada ? k.dimulai_pada : mulaiPercobaan;
}

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

export function nilaiJawaban(kunci: Record<string, string>, urutan: string[], jawaban: Record<string, Pilihan>, passingGrade: number): Penilaian {
  const jumlah = urutan.length;
  const benar = urutan.filter(id => kunci[id] && jawaban[id] === String(kunci[id]).toUpperCase()).length;
  const skor = jumlah ? Math.round((benar / jumlah) * 100) : 0;
  return { benar, jumlah, skor, lulus: skor >= passingGrade };
}

export function acakUrutan<T>(daftar: T[], acak: () => number = Math.random): T[] {
  const a = [...daftar];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(acak() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function sisaWaktuMs(mulaiIso: string, timerMenit: number | null, sekarang = Date.now()): number | null {
  if (!timerMenit) return null;
  return Math.max(0, new Date(mulaiIso).getTime() + timerMenit * 60_000 - sekarang);
}

export function lewatWaktu(mulaiIso: string, timerMenit: number | null, sekarang = Date.now()): boolean {
  if (!timerMenit) return false;
  return sekarang - new Date(mulaiIso).getTime() > (timerMenit * 60 + TOLERANSI_DETIK) * 1000;
}

export function rapikanKelas(m: Record<string, unknown>): { galat: string } | Omit<KelasEksternal, 'id' | 'token' | 'dimulai_pada'> {
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
  const jenis: JenisKelas = m.jenis === 'live' ? 'live' : 'mandiri';
  const buka = jenis === 'live' ? null : tgl(m.buka_pada), tutup = jenis === 'live' ? null : tgl(m.tutup_pada);
  if (buka && tutup && new Date(tutup) <= new Date(buka)) return { galat: 'Waktu tutup harus sesudah waktu buka.' };
  return {
    jenis,
    detik_per_soal: rapikanDetik(m.detik_per_soal),
    tema_warna: rapikanWarna(m.tema_warna),
    logo_url: rapikanUrlGambar(m.logo_url),
    latar_url: rapikanUrlGambar(m.latar_url),
    judul,
    keterangan: String(m.keterangan ?? '').trim().slice(0, 1000),
    question_ids: ids,
    timer_menit: angka(m.timer_menit, 1, 300, null),
    passing_grade: angka(m.passing_grade, 0, 100, 70) as number,
    acak_soal: m.acak_soal !== false,
    satu_kali: m.satu_kali !== false,
    aktif: m.aktif !== false,
    buka_pada: buka, tutup_pada: tutup,
    maks_peserta: angka(m.maks_peserta, 1, jenis === 'live' ? MAKS_PESERTA_LIVE : 2000, 200) as number,
    mode_mulai: m.mode_mulai === 'admin' ? 'admin' : 'auto',
    batas_pelanggaran: angka(m.batas_pelanggaran, 1, 50, null),
    isian_peserta: rapikanIsianPeserta(m.isian_peserta),
  };
}

export const kunciPeserta = (tokenKelas: string) => `kelas-eksternal:${tokenKelas}`;
