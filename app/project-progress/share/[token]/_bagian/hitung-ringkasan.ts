/**
 * Angka ringkasan link View-Only Project Progress - murni (tanpa React), supaya bisa diuji.
 * Semua dihitung dari data yang SUDAH dikirim /api/project-progress/share/<token>: tidak ada
 * kueri tambahan, jadi halaman yang lebih kaya ini tidak menambah beban basis data.
 */
import { hariIni, keadaanJadwal, statDari, type ChecklistItem, type KeadaanJadwal, type StatChecklist } from '@/lib/checklist';

export interface DaftarShare { id: string; judul: string; target_date: string | null }

export type StatusLokasi = 'selesai' | 'berjalan' | 'belum' | 'kosong';

export interface RingkasLokasi {
  id: string; judul: string; stat: StatChecklist; persen: number;
  status: StatusLokasi; jadwal: KeadaanJadwal; labelJadwal: string;
}

export interface Ringkasan {
  total: StatChecklist; persen: number;
  lokasi: RingkasLokasi[];
  lokasiSelesai: number; lokasiTerlambat: number;
  perStatus: Record<StatusLokasi, number>;
  perJadwal: Record<KeadaanJadwal, number>;
  perOrang: { nama: string; jumlah: number }[];
  /** Waktu terpakai terhadap rentang start-target proyek (0-100), null bila tanggal tidak lengkap. */
  waktuPersen: number | null;
  hariBerjalan: number | null; sisaHari: number | null;
  laju: { tanggal: string; jumlah: number; kumulatif: number }[];
}

const hari = (t: string) => { const [y, m, d] = t.slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000; };
const keTanggal = (n: number) => new Date(n * 86400000).toISOString().slice(0, 10);

/** Tanggal lokal (zona perangkat) dari stempel waktu ISO - dipakai mengelompokkan centang per hari. */
function tanggalLokal(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const MAKS_HARI_LAJU = 30;

export function hitungRingkasan(
  proyek: { start_date: string | null; target_date: string | null },
  daftar: DaftarShare[], items: ChecklistItem[], hariIniStr = hariIni(),
): Ringkasan {
  const perDaftar = new Map<string, ChecklistItem[]>();
  for (const d of daftar) perDaftar.set(d.id, []);
  for (const it of items) perDaftar.get(it.daftar_id)?.push(it);

  const lokasi: RingkasLokasi[] = daftar.map(d => {
    const stat = statDari(perDaftar.get(d.id) ?? []);
    const tuntas = stat.total > 0 && stat.selesai === stat.total;
    const j = keadaanJadwal(d.target_date, tuntas, hariIniStr);
    const status: StatusLokasi = stat.total === 0 ? 'kosong' : tuntas ? 'selesai' : stat.selesai > 0 ? 'berjalan' : 'belum';
    return { id: d.id, judul: d.judul, stat, persen: stat.total ? Math.round((stat.selesai / stat.total) * 100) : 0, status, jadwal: j.keadaan, labelJadwal: j.label };
  });

  const total = statDari(items);
  const perStatus: Record<StatusLokasi, number> = { selesai: 0, berjalan: 0, belum: 0, kosong: 0 };
  const perJadwal: Record<KeadaanJadwal, number> = { selesai: 0, aman: 0, dekat: 0, terlambat: 0, tanpa: 0 };
  for (const l of lokasi) { perStatus[l.status]++; perJadwal[l.jadwal]++; }

  const orang = new Map<string, number>();
  for (const it of items) if (it.selesai) {
    const n = (it.selesai_oleh || '').trim() || 'Tidak tercatat';
    orang.set(n, (orang.get(n) ?? 0) + 1);
  }
  const perOrang = [...orang].map(([nama, jumlah]) => ({ nama, jumlah })).sort((a, b) => b.jumlah - a.jumlah);

  let waktuPersen: number | null = null, hariBerjalan: number | null = null, sisaHari: number | null = null;
  const kini = hari(hariIniStr);
  if (proyek.start_date) hariBerjalan = Math.max(0, kini - hari(proyek.start_date));
  if (proyek.target_date) sisaHari = hari(proyek.target_date) - kini;
  if (proyek.start_date && proyek.target_date) {
    const rentang = hari(proyek.target_date) - hari(proyek.start_date);
    waktuPersen = rentang > 0 ? Math.min(100, Math.max(0, Math.round(((kini - hari(proyek.start_date)) / rentang) * 100))) : (kini >= hari(proyek.target_date) ? 100 : 0);
  }

  // Laju penyelesaian: centang per hari, maks 30 hari terakhir yang ada aktivitasnya s.d. hari ini.
  const perHari = new Map<string, number>();
  for (const it of items) if (it.selesai && it.selesai_pada) {
    const t = tanggalLokal(it.selesai_pada);
    perHari.set(t, (perHari.get(t) ?? 0) + 1);
  }
  const laju: Ringkasan['laju'] = [];
  if (perHari.size) {
    const awalData = Math.min(...[...perHari.keys()].map(hari));
    const awal = Math.max(awalData, kini - (MAKS_HARI_LAJU - 1));
    let kumulatif = [...perHari].filter(([t]) => hari(t) < awal).reduce((n, [, v]) => n + v, 0);
    for (let n = awal; n <= kini; n++) {
      const t = keTanggal(n);
      const jumlah = perHari.get(t) ?? 0;
      kumulatif += jumlah;
      laju.push({ tanggal: t, jumlah, kumulatif });
    }
  }

  return {
    total, persen: total.total ? Math.round((total.selesai / total.total) * 100) : 0,
    lokasi, lokasiSelesai: perStatus.selesai, lokasiTerlambat: perJadwal.terlambat,
    perStatus, perJadwal, perOrang, waktuPersen, hariBerjalan, sisaHari, laju,
  };
}
