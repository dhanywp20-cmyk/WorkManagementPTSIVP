/**
 * Angka ringkasan Project Progress - murni (tanpa React), supaya bisa diuji. Dipakai:
 *  - daftar proyek (tampilan depan)          -> ringkasDaftarProyek
 *  - detail proyek & link View-Only proyek   -> ringkasDariLokasi / hitungRingkasan
 *  - checklist satu lokasi & link tim        -> ringkasChecklist
 * Prinsip: tiap fakta tampil SEKALI. Yang sudah ada di kartu/daftar halaman (progres per lokasi,
 * per bagian, jumlah per status di kartu filter) tidak diulang di sini.
 */
import {
  hariIni, keadaanJadwal, statDari,
  type ChecklistItem, type KeadaanJadwal, type ProyekRingkas, type StatChecklist,
} from '@/lib/checklist';
import { kontribusiHandler, selesaiPerHari, type AnggotaNama, type Kontribusi } from '@/lib/checklist-ringkasan';

export type StatusLokasi = 'selesai' | 'berjalan' | 'belum' | 'kosong';

export interface RingkasLokasi {
  id: string; judul: string; stat: StatChecklist; persen: number;
  status: StatusLokasi; jadwal: KeadaanJadwal; labelJadwal: string;
}

export interface TitikLaju { tanggal: string; jumlah: number; kumulatif: number }

export interface Waktu { hariBerjalan: number | null; sisaHari: number | null; waktuPersen: number | null }

export interface Ringkasan extends Waktu {
  total: StatChecklist; persen: number;
  lokasi: RingkasLokasi[];
  perStatus: Record<StatusLokasi, number>;
  /** Tenggat lokasi yang BELUM selesai (selesai sudah ada di perStatus). */
  perTenggat: Record<Exclude<KeadaanJadwal, 'selesai'>, number>;
  /** Handler saja (anggota checklist). Kosong bila data aktivitas tidak tersedia. */
  perOrang: Kontribusi[];
  laju: TitikLaju[];
}

const hari = (t: string) => { const [y, m, d] = t.slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000; };
const keTanggal = (n: number) => new Date(n * 86400000).toISOString().slice(0, 10);
const persenDari = (s: StatChecklist) => (s.total ? Math.round((s.selesai / s.total) * 100) : 0);

export const MAKS_HARI_LAJU = 30;

/** Laju harian dari peta tanggal->jumlah: maks 30 hari terakhir sejak aktivitas pertama s.d. hari ini. */
export function lajuDariPeta(perHari: Record<string, number>, hariIniStr = hariIni()): TitikLaju[] {
  const tanggal = Object.keys(perHari);
  if (!tanggal.length) return [];
  const kini = hari(hariIniStr);
  const awal = Math.max(Math.min(...tanggal.map(hari)), kini - (MAKS_HARI_LAJU - 1));
  let kumulatif = tanggal.filter(t => hari(t) < awal).reduce((n, t) => n + perHari[t], 0);
  const laju: TitikLaju[] = [];
  for (let n = awal; n <= kini; n++) {
    const jumlah = perHari[keTanggal(n)] ?? 0;
    kumulatif += jumlah;
    laju.push({ tanggal: keTanggal(n), jumlah, kumulatif });
  }
  return laju;
}

/** Hari berjalan, sisa hari, dan waktu terpakai (%) dari rentang start-target. */
export function waktuDari(start: string | null, target: string | null, hariIniStr = hariIni()): Waktu {
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

/** Ringkasan proyek dari angka per lokasi + aktivitas (handler & per hari) bila ada. */
export function ringkasDariLokasi(
  proyek: { start_date: string | null; target_date: string | null },
  masukan: LokasiMasukan[],
  aktivitas: { kontribusi: Kontribusi[]; perHari: Record<string, number> } | null = null,
  hariIniStr = hariIni(),
): Ringkasan {
  const lokasi: RingkasLokasi[] = masukan.map(d => {
    const tuntas = d.stat.total > 0 && d.stat.selesai === d.stat.total;
    const j = keadaanJadwal(d.target_date, tuntas, hariIniStr);
    const status: StatusLokasi = d.stat.total === 0 ? 'kosong' : tuntas ? 'selesai' : d.stat.selesai > 0 ? 'berjalan' : 'belum';
    return { id: d.id, judul: d.judul, stat: d.stat, persen: persenDari(d.stat), status, jadwal: j.keadaan, labelJadwal: j.label };
  });
  const total = masukan.reduce((a, d) => ({ total: a.total + d.stat.total, selesai: a.selesai + d.stat.selesai, kendala: a.kendala + d.stat.kendala }), { total: 0, selesai: 0, kendala: 0 });
  const perStatus: Record<StatusLokasi, number> = { selesai: 0, berjalan: 0, belum: 0, kosong: 0 };
  const perTenggat: Ringkasan['perTenggat'] = { aman: 0, dekat: 0, terlambat: 0, tanpa: 0 };
  for (const l of lokasi) {
    perStatus[l.status]++;
    if (l.jadwal !== 'selesai') perTenggat[l.jadwal]++;
  }
  return {
    total, persen: persenDari(total), lokasi, perStatus, perTenggat,
    perOrang: aktivitas?.kontribusi ?? [],
    laju: aktivitas ? lajuDariPeta(aktivitas.perHari, hariIniStr) : [],
    ...waktuDari(proyek.start_date, proyek.target_date, hariIniStr),
  };
}

export interface DaftarShare { id: string; judul: string; target_date: string | null }

/** Ringkasan proyek dari seluruh item (link View-Only memuat semua item & anggota). */
export function hitungRingkasan(
  proyek: { start_date: string | null; target_date: string | null },
  daftar: DaftarShare[], items: ChecklistItem[], anggota: AnggotaNama[], hariIniStr = hariIni(),
): Ringkasan {
  const perDaftar = new Map<string, ChecklistItem[]>();
  for (const d of daftar) perDaftar.set(d.id, []);
  for (const it of items) perDaftar.get(it.daftar_id)?.push(it);
  return ringkasDariLokasi(proyek, daftar.map(d => ({ ...d, stat: statDari(perDaftar.get(d.id) ?? []) })),
    { kontribusi: kontribusiHandler(items, anggota), perHari: selesaiPerHari(items) }, hariIniStr);
}

// ── Daftar proyek (tampilan depan) ──────────────────────────────────────────
//  Jumlah per status / kendala / terlambat sudah ada di kartu filter, progres tiap proyek di
//  daftarnya - yang ditambahkan di sini hanya yang belum tampil di mana pun.

export interface RingkasanDaftar {
  item: StatChecklist;
  perDivisi: { label: string; value: number }[];
  perSales: { label: string; value: number }[];
}

function hitungLabel(nilai: (string | null | undefined)[], kosong: string): { label: string; value: number }[] {
  const m = new Map<string, number>();
  for (const v of nilai) { const k = (v ?? '').trim() || kosong; m.set(k, (m.get(k) ?? 0) + 1); }
  return [...m].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'id'));
}

export function ringkasDaftarProyek(proyek: ProyekRingkas[]): RingkasanDaftar {
  const item = { total: 0, selesai: 0, kendala: 0 };
  for (const p of proyek) { item.total += p.stat.total; item.selesai += p.stat.selesai; item.kendala += p.stat.kendala; }
  return {
    item,
    perDivisi: hitungLabel(proyek.map(p => p.sales_division), 'Tanpa divisi'),
    perSales: hitungLabel(proyek.map(p => p.sales_name), 'Tanpa Sales'),
  };
}

// ── Checklist satu lokasi ───────────────────────────────────────────────────
//  Progres, x/y item & kendala sudah di header halaman; progres per bagian di panel bagian.

export interface RingkasanChecklist extends Waktu {
  persen: number;
  perOrang: Kontribusi[];
  laju: TitikLaju[];
}

export function ringkasChecklist(
  daftar: { start_date: string | null; target_date: string | null },
  items: ChecklistItem[], anggota: AnggotaNama[], hariIniStr = hariIni(),
): RingkasanChecklist {
  return {
    persen: persenDari(statDari(items)),
    perOrang: kontribusiHandler(items, anggota),
    laju: lajuDariPeta(selesaiPerHari(items), hariIniStr),
    ...waktuDari(daftar.start_date, daftar.target_date, hariIniStr),
  };
}
