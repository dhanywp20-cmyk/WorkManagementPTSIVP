/**
 * lib/ringkasan-performa.ts - enam angka "Ringkasan Performa".
 *
 * KENAPA BERKAS INI ADA
 *
 * Keenam angka ini semula dihitung di dalam app/dashboard/_components/
 * DashboardKPI.tsx, terselip di antara perhitungan belasan angka lain, dan
 * ditampilkan di kartu PALING BAWAH tab Analytics. Permintaannya: naikkan ke
 * sebelah kanan Team Monitoring, yang memang punya banyak ruang kosong.
 *
 * Masalahnya, Team Monitoring adalah widget mandiri di pohon komponen yang
 * BERBEDA. Menyalin rumusnya ke sana akan menghasilkan dua definisi untuk
 * angka yang sama - persis jenis duplikasi yang baru saja dibersihkan dari
 * DonutChart, dan yang paling mudah menyimpang diam-diam karena keduanya
 * "kelihatan benar" sendiri-sendiri.
 *
 * Jadi rumusnya dipindah ke sini, dan DashboardKPI berhenti menampilkan
 * kartunya untuk admin. Satu definisi, satu tempat tampil.
 *
 * LINGKUP: seluruh platform, TANPA penyaringan per-supervisor. Itu sebabnya
 * pemakainya (widget Team Monitoring) hanya menampilkannya untuk admin -
 * admin memang melihat seluruh platform, jadi angka tanpa saringan benar
 * untuknya. Untuk Supervisor PTS, kartu lama di DashboardKPI tetap dipakai
 * karena ia sudah menyaring ke anggota timnya lewat scope. Menyamakan
 * keduanya berarti memindahkan seluruh penyelesaian scope ke sini juga, dan
 * itu perubahan yang jauh lebih besar daripada yang diminta.
 */

import { supabase } from '@/lib/supabase';

export interface RingkasanPerforma {
  avgResolusiHari: number;
  solvedHariIni: number;
  reminderOverdue: number;
  piketTerisi: number;
  piketTotal: number;
  tamuHariIni: number;
  lcAvgSkor: number;
}

const hariIni = () => new Date().toISOString().split('T')[0];

/** Senin minggu ini (yyyy-mm-dd). Minggu dihitung sebagai hari ke-0 JS. */
function seninMingguIni(): string {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return d.toISOString().split('T')[0];
}

/**
 * Jumlah hari kerja (Senin-Jumat) dari awal minggu s.d. HARI INI - bukan
 * lima. Kalau hari ini Rabu, targetnya 3, bukan 5; tanpa itu piket akan
 * selalu terlihat belum terpenuhi di awal minggu.
 */
function hariKerjaSampaiHariIni(): number {
  const akhir = new Date(); akhir.setHours(0, 0, 0, 0);
  const mulai = new Date(akhir);
  const dow = mulai.getDay();
  mulai.setDate(mulai.getDate() + (dow === 0 ? -6 : 1 - dow));
  let n = 0;
  for (const d = new Date(mulai); d <= akhir; d.setDate(d.getDate() + 1)) {
    const wd = d.getDay();
    if (wd >= 1 && wd <= 5) n++;
  }
  return n;
}

export async function ambilRingkasanPerforma(): Promise<RingkasanPerforma> {
  const today = hariIni();

  const [tiketRes, logRes, remRes, piketRes, tamuRes, lcRes] = await Promise.all([
    supabase.from('tickets').select('id,status,date,created_at'),
    //  Batas 500 mengikuti perhitungan aslinya - "solved hari ini" dibaca dari
    //  activity_logs, dan log terbaru selalu ada di kepala urutan.
    supabase.from('activity_logs').select('ticket_id,new_status,created_at')
      .order('created_at', { ascending: false }).limit(500),
    supabase.from('reminders').select('id,status,due_date'),
    supabase.from('piket_schedules').select('id,pic_ivp_name,pic_ump_name,pic_mvi_name')
      .gte('day_date', seninMingguIni()).lte('day_date', today),
    supabase.from('piket_tamu_detail').select('id').gte('created_at', today),
    supabase.from('lc_quiz_attempts').select('id,score,is_submitted,grading_status')
      .eq('is_submitted', true).neq('grading_status', 'pending_review'),
  ]);

  const tiket = (tiketRes.data ?? []) as any[];
  const log   = (logRes.data   ?? []) as any[];
  const rem   = (remRes.data   ?? []) as any[];
  const piket = (piketRes.data ?? []) as any[];
  const lc    = (lcRes.data    ?? []) as any[];

  //  Rata-rata resolusi: hanya tiket Solved yang punya kedua tanggal.
  //  Math.max(0, ...) menahan selisih negatif dari data yang tanggalnya
  //  tertukar - satu baris begitu bisa menarik rata-ratanya jadi minus.
  const solvedT = tiket.filter(t => t.status === 'Solved' && t.date && t.created_at);
  const totalHari = solvedT.reduce((acc, t) => {
    const d = (new Date(t.date).getTime() - new Date(t.created_at).getTime()) / 86400000;
    return acc + Math.max(0, d);
  }, 0);

  const idTiket = new Set(tiket.map(t => t.id as string));
  const skor = lc.filter(a => a.score != null).map(a => a.score as number);

  return {
    avgResolusiHari: solvedT.length ? Math.round(totalHari / solvedT.length) : 0,
    solvedHariIni: log.filter(a =>
      a.new_status === 'Solved' && a.created_at?.startsWith(today) && idTiket.has(a.ticket_id)
    ).length,
    reminderOverdue: rem.filter(r => r.status === 'pending' && r.due_date < today).length,
    piketTerisi: piket.filter(p => p.pic_ivp_name || p.pic_ump_name || p.pic_mvi_name).length,
    piketTotal: hariKerjaSampaiHariIni(),
    tamuHariIni: (tamuRes.data ?? []).length,
    lcAvgSkor: skor.length ? Math.round(skor.reduce((a, b) => a + b, 0) / skor.length) : 0,
  };
}
