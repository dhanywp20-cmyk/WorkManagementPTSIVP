/**
 * lib/kesehatan.ts - bentuk data & aturan peringatan halaman Kesehatan Sistem.
 * Murni (tanpa jaringan) supaya aturannya bisa diuji: uji/kesehatan.ts.
 */
import type { JejakCron } from './cron-catat';

/** Batas paket Supabase Free (byte). */
export const BATAS_DB = 500 * 1024 * 1024;
export const BATAS_STORAGE = 1024 * 1024 * 1024;
/** Cron Vercel harian dianggap macet bila tidak tercatat jalan > 26 jam. */
export const CRON_MACET_JAM = 26;
export const CRON_VERCEL: { nama: string; label: string; jadwal: string }[] = [
  { nama: 'escalate', label: 'Eskalasi ticket idle', jadwal: '08:00 WIB' },
  { nama: 'digest', label: 'Briefing pagi (WA / Telegram / push)', jadwal: '06:00 WIB' },
];

export interface DataKesehatan {
  sistem: {
    db_bytes: number;
    tabel: { nama: string; bytes: number; baris: number }[];
    bucket: { bucket: string; bytes: number; jumlah: number }[];
    cron: { nama: string; jadwal: string; aktif: boolean; terakhir: string | null; status: string | null }[];
    pemicu_http: { trigger: string; tabel: string; fungsi: string }[];
    fungsi_berahasia: string[];
  } | null;
  /** Fungsi kesehatan_sistem() belum ada (migrasi 036 belum dijalankan). */
  sqlBelum: boolean;
  cronVercel: JejakCron;
  ai: { jam24: number; hari7: number };
  waJam24: number;
  apkTerakhir: { versi: string; diunggah_pada: string } | null;
  kanal: Record<string, boolean> | null;
  env: { serviceRole: boolean; cronSecret: boolean };
}

export interface Peringatan { tingkat: 'merah' | 'kuning'; teks: string }

/** Daftar peringatan dari data kesehatan, paling gawat lebih dulu. */
export function ringkasKesehatan(d: DataKesehatan, sekarang: number): Peringatan[] {
  const p: Peringatan[] = [];
  if (!d.env.serviceRole) p.push({ tingkat: 'merah', teks: 'SUPABASE_SERVICE_ROLE_KEY belum diisi di Vercel - cron & route server berjalan tanpa hak penuh.' });
  if (!d.env.cronSecret) p.push({ tingkat: 'merah', teks: 'CRON_SECRET belum diisi di Vercel - cron eskalasi & briefing pagi menolak semua panggilan.' });
  if (d.sqlBelum) p.push({ tingkat: 'kuning', teks: 'Migrasi 036_kesehatan_sistem.sql belum dijalankan - ukuran DB/storage & pemeriksaan keamanan belum tampil.' });
  const s = d.sistem;
  if (s) {
    if (s.fungsi_berahasia.length) p.push({ tingkat: 'merah', teks: `Fungsi DB masih menyimpan token/kunci tertulis: ${s.fungsi_berahasia.join(', ')}. Jalankan migrasi 035 lalu rotate token.` });
    if (s.pemicu_http.length) p.push({ tingkat: 'merah', teks: `Trigger memanggil HTTP keluar langsung dari DB (bisa WA dobel / di luar satu pintu): ${s.pemicu_http.map(t => `${t.trigger} (${t.tabel})`).join(', ')}.` });
    const pakaiDb = s.db_bytes / BATAS_DB;
    if (pakaiDb > 0.8) p.push({ tingkat: pakaiDb > 0.95 ? 'merah' : 'kuning', teks: `Basis data ${Math.round(pakaiDb * 100)}% dari batas paket Free (500 MB).` });
    const pakaiSt = s.bucket.reduce((a, b) => a + b.bytes, 0) / BATAS_STORAGE;
    if (pakaiSt > 0.8) p.push({ tingkat: pakaiSt > 0.95 ? 'merah' : 'kuning', teks: `Storage ${Math.round(pakaiSt * 100)}% dari batas paket Free (1 GB).` });
    for (const c of s.cron) if (c.aktif && c.status && c.status !== 'succeeded') p.push({ tingkat: 'kuning', teks: `pg_cron "${c.nama}" terakhir berstatus ${c.status}.` });
  }
  for (const c of CRON_VERCEL) {
    const j = d.cronVercel[c.nama];
    if (!j) { p.push({ tingkat: 'kuning', teks: `Cron "${c.label}" belum pernah tercatat jalan (jejak baru dicatat sejak pembaruan ini).` }); continue; }
    const jam = (sekarang - new Date(j.waktu).getTime()) / 3_600_000;
    if (!j.ok) p.push({ tingkat: 'merah', teks: `Cron "${c.label}" gagal pada jalan terakhir: ${j.ringkas}` });
    else if (jam > CRON_MACET_JAM) p.push({ tingkat: 'merah', teks: `Cron "${c.label}" tidak jalan sejak ${Math.floor(jam)} jam lalu (jadwal harian ${c.jadwal}).` });
  }
  return p.sort((a, b) => (a.tingkat === b.tingkat ? 0 : a.tingkat === 'merah' ? -1 : 1));
}
