import { kunciPeserta, type IsianPeserta } from '@/lib/kuis/kelas-eksternal';
import type { KeadaanPeserta } from '@/lib/kuis/live-server';

export interface InfoKelas {
  kelas: {
    judul: string; keterangan: string; jumlahSoal: number; timerMenit: number | null; passingGrade: number; satuKali: boolean;
    modeMulai: 'auto' | 'admin'; batasPelanggaran: number | null; jenis: 'mandiri'; isianPeserta: IsianPeserta;
  };
  menunggu: boolean;
  jumlahPeserta?: number;
  status: 'buka' | 'nonaktif' | 'belum' | 'selesai' | 'penuh';
  pesan: string | null;
  peserta: { nama: string; instansi?: string | null } | null;
  hasil: Hasil | null;
  berjalan: boolean;
}
export interface InfoLive {
  kelas: {
    judul: string; keterangan: string; jumlahSoal: number; jenis: 'live'; detikPerSoal: number; isianPeserta: IsianPeserta;
    tema: { warna: string | null; logo: string | null; latar: string | null };
  };
  status: 'buka' | 'nonaktif' | 'selesai' | 'penuh';
  pesan: string | null;
  peserta: { nama: string; instansi?: string | null } | null;
  live: KeadaanPeserta;
}
export const adalahLive = (i: InfoKelas | InfoLive): i is InfoLive => i.kelas.jenis === 'live';

export interface Hasil { id: string; skor: number; benar: number; jumlah: number; lulus: boolean; selesai_pada: string; percobaan: number }
export interface Soal { id: string; teks: string; gambar: string | null; pilihan: Record<'A' | 'B' | 'C' | 'D', string> }
export interface Percobaan { percobaan: number; mulai_pada: string; sisaMs: number | null; batasPelanggaran: number | null; soal: Soal[] }

const simpan = {
  baca(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } },
  tulis(k: string, v: string) { try { localStorage.setItem(k, v); } catch {  } },
  hapus(k: string) { try { localStorage.removeItem(k); } catch {  } },
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
