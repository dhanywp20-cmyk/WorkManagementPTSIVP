'use client';


export interface FlowChip {
  icon: string;
  label: string;
  state: 'normal' | 'active' | 'done' | 'wait';
}

export interface TourStep {
  id: string;
  menuKey: string | null;
  icon: string;
  title: string;
  desc: string;
  color: string;
  accentBg: string;
  flow?: FlowChip[];
}

export const ALL_STEPS: TourStep[] = [
  {
    id: 'welcome', menuKey: null, icon: '👋',
    title: 'Selamat datang di Work Management!',
    desc: 'Platform terpadu IndoVisual untuk tim PTS — kelola jadwal, tiket, proyek, dan laporan harian. Panduan ini akan memandu kamu langkah demi langkah.',
    color: '#be123c', accentBg: 'linear-gradient(135deg,#fff1f2,#fecdd3)',
  },
  {
    id: 'learning-center', menuKey: 'learning-center', icon: '🎓',
    title: 'Learning Center',
    desc: 'Platform training & quiz online tim PTS. Selesaikan kuis yang di-assign oleh admin dan lihat perkembanganmu.',
    color: '#1d4ed8', accentBg: 'linear-gradient(135deg,#eff6ff,#dbeafe)',
    flow: [
      { icon: '📚', label: 'Buka Quiz', state: 'normal' },
      { icon: '▶', label: 'Mulai', state: 'active' },
      { icon: '✏️', label: 'Jawab Soal', state: 'normal' },
      { icon: '📤', label: 'Submit', state: 'active' },
      { icon: '🏆', label: 'Nilai', state: 'done' },
    ],
  },
  {
    id: 'tech-note', menuKey: 'tech-note', icon: '📝',
    title: 'Tech Note R&D',
    desc: 'Dokumentasi teknikal & riset. Note yang di-approve supervisor dihitung sebagai KPI.',
    color: '#be185d', accentBg: 'linear-gradient(135deg,#fdf2f8,#fce7f3)',
    flow: [
      { icon: '➕', label: 'Tambah Note', state: 'normal' },
      { icon: '✏️', label: 'Isi Konten', state: 'active' },
      { icon: '📤', label: 'Submit', state: 'active' },
      { icon: '⏳', label: 'Review', state: 'wait' },
      { icon: '✅', label: 'Approved', state: 'done' },
    ],
  },
  {
    id: 'reminder-schedule', menuKey: 'reminder-schedule', icon: '🗓️',
    title: 'Request Schedule',
    desc: 'Jadwal Demo, Meeting, Konfigurasi & Training. Sales request jadwal, tim PTS update status.',
    color: '#0f766e', accentBg: 'linear-gradient(135deg,#f0fdfa,#ccfbf1)',
    flow: [
      { icon: '📋', label: 'Request Jadwal', state: 'normal' },
      { icon: '📤', label: 'Kirim', state: 'active' },
      { icon: '⏳', label: 'Menunggu', state: 'wait' },
      { icon: '🔧', label: 'On Progress', state: 'wait' },
      { icon: '✅', label: 'Selesai', state: 'done' },
    ],
  },
  {
    id: 'request-design-project', menuKey: 'request-design-project', icon: '🏗️',
    title: 'Request Design Project',
    desc: 'Request desain ruangan, BOQ, dan proposal teknis dari tim IVP.',
    color: '#7c3aed', accentBg: 'linear-gradient(135deg,#f5f3ff,#ede9fe)',
    flow: [
      { icon: '📋', label: 'Buat Request', state: 'normal' },
      { icon: '📝', label: 'Isi Detail', state: 'active' },
      { icon: '📤', label: 'Kirim', state: 'active' },
      { icon: '⏳', label: 'Processing', state: 'wait' },
      { icon: '✅', label: 'Done', state: 'done' },
    ],
  },
  {
    id: 'form-bast', menuKey: 'form-bast', icon: '⭐',
    title: 'Form Review Demo & BAST',
    desc: 'Penilaian kualitas Demo Produk dan serah terima. Rating di bawah 3★ mengurangi KPI.',
    color: '#b45309', accentBg: 'linear-gradient(135deg,#fffbeb,#fef3c7)',
    flow: [
      { icon: '⭐', label: 'Isi Review', state: 'normal' },
      { icon: '⭐⭐', label: 'Beri Rating', state: 'active' },
      { icon: '📤', label: 'Submit', state: 'active' },
      { icon: '✅', label: 'Tersimpan', state: 'done' },
    ],
  },
  {
    id: 'ticket-troubleshooting', menuKey: 'ticket-troubleshooting', icon: '🎫',
    title: 'Ticket Troubleshooting',
    desc: 'Pelaporan masalah teknis produk. SLA countdown otomatis — tiket overdue mengurangi KPI.',
    color: '#be123c', accentBg: 'linear-gradient(135deg,#fff1f2,#fecdd3)',
    flow: [
      { icon: '🎫', label: 'Buat Tiket', state: 'normal' },
      { icon: '📤', label: 'Submit', state: 'active' },
      { icon: '⏳', label: 'In Progress', state: 'wait' },
      { icon: '✅', label: 'Solved', state: 'done' },
    ],
  },
  {
    id: 'picket-showroom', menuKey: 'picket-showroom', icon: '🏪',
    title: 'Piket Showroom',
    desc: 'Jadwal piket showroom tim PTS IVP, UMP & MVI. Data piket masuk ke laporan KPI bulanan.',
    color: '#0f766e', accentBg: 'linear-gradient(135deg,#f0fdfa,#ccfbf1)',
    flow: [
      { icon: '📅', label: 'Lihat Jadwal', state: 'normal' },
      { icon: '✔️', label: 'Check-in', state: 'active' },
      { icon: '💾', label: 'Simpan', state: 'active' },
      { icon: '✅', label: 'Tercatat', state: 'done' },
    ],
  },
  {
    id: 'daily-report', menuKey: 'daily-report', icon: '📈',
    title: 'Daily Report',
    desc: 'Catatan aktivitas harian & performa tim. Laporan terakumulasi otomatis setiap hari.',
    color: '#047857', accentBg: 'linear-gradient(135deg,#f0fdf4,#dcfce7)',
    flow: [
      { icon: '📈', label: 'Tambah Laporan', state: 'normal' },
      { icon: '✏️', label: 'Isi Aktivitas', state: 'active' },
      { icon: '📤', label: 'Submit', state: 'active' },
      { icon: '✅', label: 'Tersimpan', state: 'done' },
    ],
  },
  {
    id: 'unit-movement', menuKey: 'unit-movement', icon: '🚚',
    title: 'Unit Movement Log',
    desc: 'Tracking keluar-masuk unit demo & peralatan. Semua gerakan tercatat untuk akuntabilitas inventori.',
    color: '#b45309', accentBg: 'linear-gradient(135deg,#fffbeb,#fef3c7)',
    flow: [
      { icon: '🚚', label: 'Catat Keluar', state: 'normal' },
      { icon: '📝', label: 'Isi Detail', state: 'active' },
      { icon: '💾', label: 'Simpan', state: 'active' },
      { icon: '✅', label: 'Tercatat', state: 'done' },
    ],
  },
  {
    id: 'incentive-pts', menuKey: 'incentive-pts', icon: '💰',
    title: 'Incentive PTS',
    desc: 'Kalkulasi & rekap incentive tim per project. Admin input biaya, sistem hitung pembagian otomatis.',
    color: '#6d28d9', accentBg: 'linear-gradient(135deg,#f5f3ff,#ede9fe)',
    flow: [
      { icon: '📋', label: 'Data Project', state: 'normal' },
      { icon: '💵', label: 'Input Biaya', state: 'active' },
      { icon: '🧮', label: 'Auto Hitung', state: 'wait' },
      { icon: '✅', label: 'Lunas', state: 'done' },
    ],
  },
  {
    id: 'done', menuKey: null, icon: '🚀',
    title: 'Siap menggunakan semua platform!',
    desc: 'Kamu sudah mengenal semua fitur Work Management Platform. Klik menu di sidebar untuk memulai. Sampai jumpa di tour berikutnya! 💪',
    color: '#be123c', accentBg: 'linear-gradient(135deg,#fff1f2,#fecdd3)',
  },
];
