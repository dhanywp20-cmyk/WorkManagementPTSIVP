import type { DeretKPI } from '@/lib/kpi-dasbor';

export type KunciPeriode = '7' | '30' | '90' | 'tahun' | 'semua';

export const DAFTAR_PERIODE: { kunci: KunciPeriode; label: string }[] = [
  { kunci: '7', label: '7 hari' },
  { kunci: '30', label: '30 hari' },
  { kunci: '90', label: '90 hari' },
  { kunci: 'tahun', label: 'Tahun ini' },
  { kunci: 'semua', label: 'Semua data' },
];

export interface TitikGrafik {
  kunci: string;
  label: string;
  total: number;
  tanda: number;
}

export interface BagianStatus { label: string; persen: number; jumlah: number }

export interface HasilTiket {
  total: number; selesai: number; belum: number; terlambat: number; persen: number;
  status: BagianStatus[]; titik: TitikGrafik[];
}

export interface HasilJadwal {
  total: number; selesai: number; berjalan: number; terlambat: number; persen: number;
  titik: TitikGrafik[];
}

const MS_HARI = 86_400_000;

export function tanggalLokal(d: Date): string {
  const b = String(d.getMonth() + 1).padStart(2, '0');
  const h = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${b}-${h}`;
}

const keTanggal = (s: string) => new Date(`${s}T00:00:00`);

export function rentangPeriode(kunci: KunciPeriode, deret: DeretKPI | undefined, kini = new Date()): { mulai: string; akhir: string } {
  const akhir = tanggalLokal(kini);
  if (kunci === 'tahun') return { mulai: `${kini.getFullYear()}-01-01`, akhir };
  if (kunci === 'semua') {
    const semua = [...(deret?.tiket ?? []).map(t => t.t), ...(deret?.jadwal ?? []).map(j => j.t)].filter(t => t && t <= akhir);
    const awal = semua.length ? semua.reduce((a, b) => (a < b ? a : b)) : `${kini.getFullYear()}-01-01`;
    return { mulai: awal, akhir };
  }
  const m = new Date(kini);
  m.setDate(m.getDate() - (Number(kunci) - 1));
  return { mulai: tanggalLokal(m), akhir };
}

function bingkaiTitik(mulai: string, akhir: string) {
  const dMulai = keTanggal(mulai), dAkhir = keTanggal(akhir);
  const hari = Math.round((dAkhir.getTime() - dMulai.getTime()) / MS_HARI) + 1;
  const langkah = hari <= 45 ? 1 : hari <= 400 ? 7 : 30;
  const fmtHari: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };
  const fmtTgl: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const fmtBln: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  const titik: TitikGrafik[] = [];
  for (let i = 0; i < hari; i += langkah) {
    const d = new Date(dMulai.getTime() + i * MS_HARI);
    const label = langkah === 1
      ? d.toLocaleDateString('id-ID', fmtHari)
      : `Mulai ${d.toLocaleDateString('id-ID', langkah === 7 ? fmtTgl : fmtBln)}`;
    titik.push({ kunci: tanggalLokal(d), label, total: 0, tanda: 0 });
  }
  const posisi = (tgl: string) => {
    const n = Math.round((keTanggal(tgl).getTime() - dMulai.getTime()) / MS_HARI);
    return n < 0 ? -1 : Math.floor(n / langkah);
  };
  return { titik, posisi };
}

const STATUS_SELESAI = 'Solved';
const STATUS_BATAL = 'Cancelled';

export function hitungTiket(deret: DeretKPI | undefined, mulai: string, akhir: string): HasilTiket {
  const { titik, posisi } = bingkaiTitik(mulai, akhir);
  const peta: Record<string, number> = {};
  let total = 0, selesai = 0, terlambat = 0;
  for (const r of deret?.tiket ?? []) {
    if (!r.t || r.t < mulai || r.t > akhir || r.s === STATUS_BATAL) continue;
    total += 1;
    peta[r.s] = (peta[r.s] ?? 0) + 1;
    if (r.s === STATUS_SELESAI) selesai += 1;
    if (r.s === 'Overdue') terlambat += 1;
    const p = titik[posisi(r.t)];
    if (p) { p.total += 1; if (r.s === STATUS_SELESAI) p.tanda += 1; }
  }
  const status = Object.entries(peta)
    .map(([label, jumlah]) => ({ label, jumlah, persen: total ? Math.round((jumlah / total) * 100) : 0 }))
    .sort((a, b) => b.jumlah - a.jumlah);
  return { total, selesai, belum: total - selesai, terlambat, persen: total ? (selesai / total) * 100 : 0, status, titik };
}

export function hitungJadwal(deret: DeretKPI | undefined, mulai: string, akhir: string, hariIni: string): HasilJadwal {
  const { titik, posisi } = bingkaiTitik(mulai, akhir);
  let total = 0, selesai = 0, berjalan = 0, terlambat = 0;
  for (const r of deret?.jadwal ?? []) {
    if (!r.t || r.t < mulai || r.t > akhir || r.s === 'cancelled') continue;
    total += 1;
    if (r.s === 'done') selesai += 1;
    else if (r.t < hariIni) terlambat += 1;
    else berjalan += 1;
    const p = titik[posisi(r.t)];
    if (p) { p.total += 1; if (r.s === 'done') p.tanda += 1; }
  }
  return { total, selesai, berjalan, terlambat, persen: total ? (selesai / total) * 100 : 0, titik };
}

export const fmtTanggalTitik = (s: string) => {
  const [y, m, d] = s.split('-');
  return `${d}.${m}.${y}`;
};
