/**
 * Angka ringkasan Project Progress - murni (tanpa React), supaya bisa diuji. Dipakai:
 *  - daftar proyek (tampilan depan)          -> ringkasDaftarProyek
 *  - detail proyek & link View-Only proyek   -> ringkasDariLokasi / hitungRingkasan
 *  - checklist satu lokasi & link tim        -> ringkasChecklist
 * Semua dihitung dari data yang SUDAH dimuat halaman: tidak ada kueri tambahan.
 */
import {
  hariIni, keadaanJadwal, statDari,
  type ChecklistBagian, type ChecklistItem, type KeadaanJadwal, type ProyekRingkas, type StatChecklist, type StatusProyek,
} from '@/lib/checklist';

export type StatusLokasi = 'selesai' | 'berjalan' | 'belum' | 'kosong';

export interface RingkasLokasi {
  id: string; judul: string; stat: StatChecklist; persen: number;
  status: StatusLokasi; jadwal: KeadaanJadwal; labelJadwal: string;
}

export interface TitikLaju { tanggal: string; jumlah: number; kumulatif: number }

export interface Ringkasan {
  total: StatChecklist; persen: number;
  lokasi: RingkasLokasi[];
  lokasiSelesai: number; lokasiTerlambat: number;
  perStatus: Record<StatusLokasi, number>;
  perJadwal: Record<KeadaanJadwal, number>;
  /** Kosong bila item tidak dimuat (mis. detail proyek internal hanya punya angka per lokasi). */
  perOrang: { nama: string; jumlah: number }[];
  /** Waktu terpakai terhadap rentang start-target proyek (0-100), null bila tanggal tidak lengkap. */
  waktuPersen: number | null;
  hariBerjalan: number | null; sisaHari: number | null;
  laju: TitikLaju[];
}

const hari = (t: string) => { const [y, m, d] = t.slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000; };
const keTanggal = (n: number) => new Date(n * 86400000).toISOString().slice(0, 10);
const persenDari = (s: StatChecklist) => (s.total ? Math.round((s.selesai / s.total) * 100) : 0);

/** Tanggal lokal (zona perangkat) dari stempel waktu ISO - dipakai mengelompokkan centang per hari. */
function tanggalLokal(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const MAKS_HARI_LAJU = 30;

/** Item selesai per orang, terbanyak dulu. */
export function perOrangDari(items: ChecklistItem[]): { nama: string; jumlah: number }[] {
  const orang = new Map<string, number>();
  for (const it of items) if (it.selesai) {
    const n = (it.selesai_oleh || '').trim() || 'Tidak tercatat';
    orang.set(n, (orang.get(n) ?? 0) + 1);
  }
  return [...orang].map(([nama, jumlah]) => ({ nama, jumlah })).sort((a, b) => b.jumlah - a.jumlah);
}

/** Centang per hari, maks 30 hari terakhir sejak aktivitas pertama s.d. hari ini; kumulatif membawa yang lebih lama. */
export function lajuDari(items: ChecklistItem[], hariIniStr = hariIni()): TitikLaju[] {
  const perHari = new Map<string, number>();
  for (const it of items) if (it.selesai && it.selesai_pada) {
    const t = tanggalLokal(it.selesai_pada);
    perHari.set(t, (perHari.get(t) ?? 0) + 1);
  }
  if (!perHari.size) return [];
  const kini = hari(hariIniStr);
  const awal = Math.max(Math.min(...[...perHari.keys()].map(hari)), kini - (MAKS_HARI_LAJU - 1));
  let kumulatif = [...perHari].filter(([t]) => hari(t) < awal).reduce((n, [, v]) => n + v, 0);
  const laju: TitikLaju[] = [];
  for (let n = awal; n <= kini; n++) {
    const jumlah = perHari.get(keTanggal(n)) ?? 0;
    kumulatif += jumlah;
    laju.push({ tanggal: keTanggal(n), jumlah, kumulatif });
  }
  return laju;
}

/** Hari berjalan, sisa hari, dan waktu terpakai (%) dari rentang start-target. */
export function waktuDari(start: string | null, target: string | null, hariIniStr = hariIni()) {
  const kini = hari(hariIniStr);
  const hariBerjalan = start ? Math.max(0, kini - hari(start)) : null;
  const sisaHari = target ? hari(target) - kini : null;
  let waktuPersen: number | null = null;
  if (start && target) {
    const rentang = hari(target) - hari(start);
    waktuPersen = rentang > 0 ? Math.min(100, Math.max(0, Math.round(((kini - hari(start)) / rentang) * 100))) : (kini >= hari(target) ? 100 : 0);
  }
  return { hariBerjalan, sisaHari, waktuPersen };
}

export interface LokasiMasukan { id: string; judul: string; target_date: string | null; stat: StatChecklist }

/** Ringkasan proyek dari angka per lokasi. `items` opsional - untuk "dikerjakan oleh" & laju harian. */
export function ringkasDariLokasi(
  proyek: { start_date: string | null; target_date: string | null },
  masukan: LokasiMasukan[], items: ChecklistItem[] | null = null, hariIniStr = hariIni(),
): Ringkasan {
  const lokasi: RingkasLokasi[] = masukan.map(d => {
    const tuntas = d.stat.total > 0 && d.stat.selesai === d.stat.total;
    const j = keadaanJadwal(d.target_date, tuntas, hariIniStr);
    const status: StatusLokasi = d.stat.total === 0 ? 'kosong' : tuntas ? 'selesai' : d.stat.selesai > 0 ? 'berjalan' : 'belum';
    return { id: d.id, judul: d.judul, stat: d.stat, persen: persenDari(d.stat), status, jadwal: j.keadaan, labelJadwal: j.label };
  });
  const total = masukan.reduce((a, d) => ({ total: a.total + d.stat.total, selesai: a.selesai + d.stat.selesai, kendala: a.kendala + d.stat.kendala }), { total: 0, selesai: 0, kendala: 0 });
  const perStatus: Record<StatusLokasi, number> = { selesai: 0, berjalan: 0, belum: 0, kosong: 0 };
  const perJadwal: Record<KeadaanJadwal, number> = { selesai: 0, aman: 0, dekat: 0, terlambat: 0, tanpa: 0 };
  for (const l of lokasi) { perStatus[l.status]++; perJadwal[l.jadwal]++; }
  return {
    total, persen: persenDari(total), lokasi, lokasiSelesai: perStatus.selesai, lokasiTerlambat: perJadwal.terlambat,
    perStatus, perJadwal,
    perOrang: items ? perOrangDari(items) : [],
    ...waktuDari(proyek.start_date, proyek.target_date, hariIniStr),
    laju: items ? lajuDari(items, hariIniStr) : [],
  };
}

export interface DaftarShare { id: string; judul: string; target_date: string | null }

/** Ringkasan proyek dari seluruh item (link View-Only memuat semua item). */
export function hitungRingkasan(
  proyek: { start_date: string | null; target_date: string | null },
  daftar: DaftarShare[], items: ChecklistItem[], hariIniStr = hariIni(),
): Ringkasan {
  const perDaftar = new Map<string, ChecklistItem[]>();
  for (const d of daftar) perDaftar.set(d.id, []);
  for (const it of items) perDaftar.get(it.daftar_id)?.push(it);
  return ringkasDariLokasi(proyek, daftar.map(d => ({ ...d, stat: statDari(perDaftar.get(d.id) ?? []) })), items, hariIniStr);
}

// ── Daftar proyek (tampilan depan) ──────────────────────────────────────────

export interface RingkasanDaftar {
  perStatus: Record<StatusProyek, number>;
  perJadwal: Record<KeadaanJadwal, number>;
  item: StatChecklist;
  progres: { label: string; value: number }[];
}

export function ringkasDaftarProyek(proyek: ProyekRingkas[], hariIniStr = hariIni()): RingkasanDaftar {
  const perStatus: Record<StatusProyek, number> = { in_progress: 0, done: 0, blocked: 0 };
  const perJadwal: Record<KeadaanJadwal, number> = { selesai: 0, aman: 0, dekat: 0, terlambat: 0, tanpa: 0 };
  const item = { total: 0, selesai: 0, kendala: 0 };
  for (const p of proyek) {
    perStatus[p.status] = (perStatus[p.status] ?? 0) + 1;
    perJadwal[keadaanJadwal(p.target_terdekat ?? p.target_date, p.status === 'done', hariIniStr).keadaan]++;
    item.total += p.stat.total; item.selesai += p.stat.selesai; item.kendala += p.stat.kendala;
  }
  const progres = proyek.filter(p => p.status !== 'done' && p.stat.total > 0)
    .map(p => ({ label: p.nama, value: persenDari(p.stat) }))
    .sort((a, b) => a.value - b.value);
  return { perStatus, perJadwal, item, progres };
}

// ── Checklist satu lokasi ───────────────────────────────────────────────────

export interface RingkasanChecklist {
  total: StatChecklist; persen: number;
  perBagian: { label: string; value: number }[];
  bagianSelesai: number; jumlahBagian: number;
  perOrang: { nama: string; jumlah: number }[];
  laju: TitikLaju[];
  hariBerjalan: number | null; sisaHari: number | null; waktuPersen: number | null;
}

export function ringkasChecklist(
  daftar: { start_date: string | null; target_date: string | null },
  bagian: ChecklistBagian[], items: ChecklistItem[], hariIniStr = hariIni(),
): RingkasanChecklist {
  const total = statDari(items);
  const perBagian = bagian.map(b => {
    const s = statDari(items.filter(i => i.bagian_id === b.id));
    return { label: b.judul, value: persenDari(s), ada: s.total > 0 };
  }).filter(b => b.ada).map(({ label, value }) => ({ label, value }));
  return {
    total, persen: persenDari(total), perBagian,
    bagianSelesai: perBagian.filter(b => b.value === 100).length, jumlahBagian: perBagian.length,
    perOrang: perOrangDari(items), laju: lajuDari(items, hariIniStr),
    ...waktuDari(daftar.start_date, daftar.target_date, hariIniStr),
  };
}
