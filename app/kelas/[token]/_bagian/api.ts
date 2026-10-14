/** Panggilan ke /api/kelas/<token> dari halaman customer + penyimpanan token & draf di perangkat. */
import { kunciPeserta } from '@/lib/kelas-eksternal';

export interface InfoKelas {
  kelas: {
    judul: string; keterangan: string; jumlahSoal: number; timerMenit: number | null; passingGrade: number; satuKali: boolean;
    modeMulai: 'auto' | 'admin'; batasPelanggaran: number | null;
  };
  /** Mode admin & belum dimulai: peserta terdaftar menunggu di ruang tunggu. */
  menunggu: boolean;
  jumlahPeserta?: number;
  status: 'buka' | 'nonaktif' | 'belum' | 'selesai' | 'penuh';
  pesan: string | null;
  peserta: { nama: string } | null;
  hasil: Hasil | null;
  berjalan: boolean;
}
export interface Hasil { skor: number; benar: number; jumlah: number; lulus: boolean; selesai_pada: string; percobaan: number }
export interface Soal { id: string; teks: string; pilihan: Record<'A' | 'B' | 'C' | 'D', string> }
export interface Percobaan { percobaan: number; mulai_pada: string; sisaMs: number | null; batasPelanggaran: number | null; soal: Soal[] }

const simpan = {
  baca(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } },
  tulis(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* mode privat: tetap jalan, hanya tidak diingat */ } },
  hapus(k: string) { try { localStorage.removeItem(k); } catch { /* abaikan */ } },
};

export const tokenPeserta = (kelas: string) => simpan.baca(kunciPeserta(kelas));
export const simpanTokenPeserta = (kelas: string, t: string) => simpan.tulis(kunciPeserta(kelas), t);

const kunciDraf = (kelas: string, percobaan: number) => `${kunciPeserta(kelas)}:draf:${percobaan}`;
export function bacaDraf(kelas: string, percobaan: number): Record<string, string> {
  try { return JSON.parse(simpan.baca(kunciDraf(kelas, percobaan)) ?? '{}') as Record<string, string>; } catch { return {}; }
}
export const tulisDraf = (kelas: string, percobaan: number, j: Record<string, string>) => simpan.tulis(kunciDraf(kelas, percobaan), JSON.stringify(j));
export const hapusDraf = (kelas: string, percobaan: number) => simpan.hapus(kunciDraf(kelas, percobaan));

export async function panggilKelas<T>(kelas: string, body?: Record<string, unknown>): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  const t = tokenPeserta(kelas);
  try {
    const res = await fetch(`/api/kelas/${encodeURIComponent(kelas)}`, {
      method: body ? 'POST' : 'GET',
      cache: 'no-store',
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(t ? { 'x-peserta': t } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
  } catch {
    return { ok: false, status: 0, data: { error: 'Koneksi terputus. Periksa internet lalu coba lagi.' } as T & { error?: string } };
  }
}

export interface HasilLapor { total: number | null; batas: number | null; kirimOtomatis: boolean }

/** Laporkan satu pelanggaran. keepalive: tetap terkirim walau halaman sedang disembunyikan. */
export async function laporPelanggaran(kelas: string, jenis: string): Promise<HasilLapor | null> {
  const t = tokenPeserta(kelas);
  if (!t) return null;
  try {
    const res = await fetch(`/api/kelas/${encodeURIComponent(kelas)}`, {
      method: 'POST', keepalive: true, cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'x-peserta': t },
      body: JSON.stringify({ aksi: 'pelanggaran', jenis }),
    });
    return res.ok ? (await res.json()) as HasilLapor : null;
  } catch { return null; }
}
