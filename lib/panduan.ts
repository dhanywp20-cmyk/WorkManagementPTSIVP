/**
 * lib/panduan.ts - panduan singkat per modul.
 *
 * Satu sumber untuk dua pemakai:
 *   - tab "Panduan" di panel Asisten (dibaca manusia, kontekstual dengan
 *     halaman yang sedang dibuka), dan
 *   - alat `panduan_modul` milik asisten AI (dibaca model), supaya jawaban
 *     "cara ..." berpijak pada alur platform ini, bukan karangan model.
 *
 * Tulis seperti menjelaskan ke rekan baru: apa gunanya, langkah inti,
 * jebakan yang sering terjadi. Kalau alur di aplikasi berubah, ubah di sini.
 */

export interface Panduan {
  kunci: string;
  judul: string;
  /** Satu kalimat: modul ini untuk apa. */
  guna: string;
  langkah: string[];
  tips: string[];
}

export const PANDUAN: Panduan[] = [
  {
    kunci: 'dashboard',
    judul: 'Beranda',
    guna: 'Ringkasan kerja Anda hari ini dan kondisi tim dalam satu layar.',
    langkah: [
      'Mulai dari kartu Agenda Saya: tab "Perlu tindakan" berisi yang harus dikerjakan lebih dulu.',
      'Tab "Hari ini" dan "Mendatang" menampilkan jadwal yang jatuh hari ini dan 5 hari ke depan.',
      'Klik sebuah item untuk langsung membuka halaman terkait.',
      'Tombol pintas di bawah kartu Agenda membuka pekerjaan yang paling sering dipakai.',
    ],
    tips: [
      'Supervisor dan Manager melihat kartu Daily Report Tim: siapa yang belum mengisi, dikelompokkan per atasan.',
      'Badge merah di header berisi semua notifikasi; ketuk untuk melihat rinciannya per bagian.',
    ],
  },
  {
    kunci: 'ticketing',
    judul: 'Ticket Troubleshooting',
    guna: 'Mencatat dan menyelesaikan keluhan unit di lokasi customer sampai tuntas.',
    langkah: [
      'Klik "New Ticket", isi project, kasus (issue case), produk, dan deskripsi masalah. Lampirkan foto bila ada.',
      'Tiket baru berstatus Waiting Approval sampai disetujui dan di-assign ke handler.',
      'Handler memperbarui progres lewat aktivitas: Pending → Call / Onsite / In Progress → Solved.',
      'Saat berstatus Onsite, jadwal troubleshooting otomatis dibuat di Request Schedule.',
      'Tulis langkah penyelesaian di aktivitas terakhir sebelum Solved, supaya bisa jadi referensi tiket serupa.',
    ],
    tips: [
      'Tiket yang terlalu lama tidak diperbarui menjadi Overdue dan memengaruhi KPI Ticketing.',
      'Saat membuka detail tiket, lihat "Solusi serupa" untuk tiket lama dengan kasus mirip yang sudah Solved.',
    ],
  },
  {
    kunci: 'reminder-schedule',
    judul: 'Request Schedule',
    guna: 'Mengatur jadwal kerja lapangan: demo, survey, konfigurasi, training, troubleshooting, maintenance, event.',
    langkah: [
      'Sales atau tim mengajukan jadwal lewat "Request Jadwal": pilih kategori, tanggal, jam, lokasi, dan PIC customer.',
      'Supervisor menyetujui dan meng-assign anggota tim (pengaturan assign Manager hanya oleh Admin).',
      'Handler berangkat sesuai jadwal; setelah selesai, tandai Done dan unggah foto penyelesaian bila diminta.',
      'Jadwal yang batal ditandai Cancelled, jangan dihapus, supaya riwayatnya tetap ada.',
    ],
    tips: [
      'Kategori Konfigurasi, Konfigurasi & Training, dan Training yang selesai dihitung untuk insentif.',
      'Demo Product dan kategori konfigurasi/training memicu Form Review dari customer.',
      'Jadwal troubleshooting dari tiket ikut tertutup otomatis saat tiketnya Solved.',
    ],
  },
  {
    kunci: 'form-require-project',
    judul: 'Request Design Project',
    guna: 'Mengajukan kebutuhan desain solusi AV (ruangan, produk, foto survey) ke tim PTS.',
    langkah: [
      'Buat request baru: isi data project, sales, dan kebutuhan per ruangan.',
      'Unggah foto ruangan (maks. 10 per ruangan) agar desainer memahami kondisi lapangan.',
      'Pantau statusnya di daftar; desainer mengunggah hasil desain sebagai berkas lampiran.',
    ],
    tips: ['Semakin lengkap ukuran dan foto ruangan, semakin sedikit revisi desain.'],
  },
  {
    kunci: 'summary-project',
    judul: 'Summary Project',
    guna: 'Melihat riwayat lengkap satu project: jadwal, troubleshooting, desain, dan form review.',
    langkah: [
      'Cari nama project di kolom pencarian.',
      'Klik project untuk melihat semua aktivitas terkait dalam satu halaman.',
    ],
    tips: ['Gunakan sebelum kunjungan ke customer untuk mengetahui riwayat masalah dan unit di lokasi.'],
  },
  {
    kunci: 'project-progress',
    judul: 'Project Progress',
    guna: 'Checklist pekerjaan instalasi per proyek dan per lokasi: siapa mengerjakan apa, kapan, dan apa kendalanya.',
    langkah: [
      'Admin membuat proyek (client, Sales, jadwal). Proyek kategori Konfigurasi dari Request Schedule dibuat otomatis.',
      'Admin menambah checklist per lokasi/ruangan: isinya disusun AI dari wiring diagram & foto rak (tab "AI dari diagram" di jendela Impor), diimpor dari teks/Excel, atau disalin dari lokasi lain; lalu assign satu atau beberapa orang (mereka dikabari lewat Telegram).',
      'Yang di-assign membuka checklist-nya, mencentang item yang selesai, menandai kendala (dengan catatan), dan mengunggah foto bukti.',
      'Untuk tim lapangan tanpa akun: buka checklist, klik "Link untuk tim", aktifkan, salin, kirim ke grup. Mereka mencentang dari HP tanpa login.',
      'Untuk client/atasan: di halaman proyek, "Link proyek" memberi tampilan hanya-baca seluruh lokasi.',
    ],
    tips: [
      'Centang & kendala baru terkirim saat tombol Simpan ditekan; jamnya tetap jam saat diklik. Riwayatnya ada di panel Riwayat pengerjaan.',
      'Hasil AI selalu diperiksa dulu di kotak teks sebelum disimpan - AI bisa salah membaca diagram.',
      'Kartu "Ada kendala" dan "Terlambat" di ringkasan menyaring proyek yang perlu ditangani lebih dulu.',
      'Checklist yang target-nya dekat/lewat atau berkendala masuk Agenda Beranda dan ringkasan pagi orang yang di-assign.',
      'Hanya admin yang bisa membuat dan menghapus proyek/checklist; Team melihat semua proyek, Sales melihat proyeknya sendiri.',
    ],
  },
  {
    kunci: 'daily-report',
    judul: 'Daily Report',
    guna: 'Laporan kerja harian tiap anggota tim.',
    langkah: [
      'Aktivitas tiket dan jadwal hari itu terisi otomatis dari sistem.',
      'Tambahkan aktivitas manual untuk pekerjaan di luar tiket/jadwal (meeting internal, persiapan, dll).',
      'Gunakan "Susun dengan AI" untuk membuat draf catatan dari aktivitas hari itu, lalu periksa sebelum menyimpan.',
      'Simpan sebelum jam kerja berakhir.',
    ],
    tips: [
      'Atasan melihat siapa yang belum mengisi di kartu Daily Report Tim di Beranda.',
      'Aktivitas manual bisa diedit atau dihapus oleh pemiliknya dan Admin.',
    ],
  },
  {
    kunci: 'picket-showroom',
    judul: 'Piket Showroom',
    guna: 'Jadwal piket showroom dan catatan kunjungan tamu.',
    langkah: [
      'Lihat siapa PIC piket hari ini dan minggu ini.',
      'PIC mencatat kegiatan: tamu, instansi, produk yang didemokan, jam pemakaian, dan kebutuhan tamu.',
      'Hari libur ditandai dengan tombol Libur pada baris tanggalnya.',
    ],
    tips: ['Ringkasan di atas halaman menunjukkan produk paling sering didemokan dan kebutuhan terbanyak.'],
  },
  {
    kunci: 'learning-center',
    judul: 'Learning Center',
    guna: 'Materi, quiz, dan penilaian kompetensi tim.',
    langkah: [
      'Buka materi untuk belajar, lalu kerjakan quiz pada sesi yang aktif.',
      'Quiz pilihan ganda dinilai otomatis; essay dinilai admin (dibantu AI).',
      'Lihat nilai dan riwayat di tab nilai/riwayat.',
    ],
    tips: ['Skor Learning Center ikut menyumbang KPI. Nilai di bawah 70 mengurangi poin.'],
  },
  {
    kunci: 'tech-note',
    judul: 'Tech Note R&D',
    guna: 'Kumpulan catatan teknis tim: solusi, konfigurasi, dan temuan produk.',
    langkah: [
      'Tulis catatan baru: judul, deskripsi, produk, tag, dan tautan OneDrive bila ada berkas.',
      'Catatan diajukan untuk direview; setelah disetujui tampil untuk seluruh tim.',
    ],
    tips: ['Minimal 2 tech note disetujui per tahun memberi nilai penuh KPI R&D.'],
  },
  {
    kunci: 'kpi-team',
    judul: 'KPI Team',
    guna: 'Penilaian kinerja tim berdasarkan data platform.',
    langkah: [
      'Pilih periode (6 bulan / 1 tahun) dan tim.',
      'Klik kartu anggota untuk melihat rincian skor per komponen.',
      'Admin menyimpan penilaian periode lewat "Mulai KPI".',
    ],
    tips: ['Komponen: Ticketing, BAST & Demo, Learning Center, R&D. Bobotnya diatur di Pengaturan KPI.'],
  },
  {
    kunci: 'incentive-pts',
    judul: 'Incentive PTS',
    guna: 'Perhitungan insentif dari pekerjaan konfigurasi dan training yang selesai.',
    langkah: [
      'Pekerjaan yang selesai di Request Schedule dengan kategori insentif masuk otomatis.',
      'Yang berwenang mengisi nominal dan memeriksa skema per project.',
    ],
    tips: ['Akses halaman dan input nominal diatur per user oleh Admin.'],
  },
  {
    kunci: 'form-review',
    judul: 'Form Review Demo & BAST',
    guna: 'Penilaian customer setelah demo produk atau BAST.',
    langkah: [
      'Form muncul dari jadwal Demo Product / konfigurasi / training yang selesai.',
      'Isi penilaian (bintang) dan catatan sesuai masukan customer.',
    ],
    tips: ['Bintang di bawah 3 mengurangi nilai KPI BAST & Demo.'],
  },
  {
    kunci: 'unit-movement',
    judul: 'Unit Movement Log',
    guna: 'Mencatat perpindahan unit/peralatan (keluar, kembali, pindah lokasi).',
    langkah: [
      'Catat setiap unit yang keluar atau masuk beserta tujuan, penanggung jawab, dan lampirannya.',
    ],
    tips: ['Catat di hari yang sama agar posisi unit selalu akurat.'],
  },
];

export function cariPanduan(kunci: string | null | undefined): Panduan | undefined {
  if (!kunci) return undefined;
  return PANDUAN.find(p => p.kunci === kunci);
}

/** Panduan sebagai teks polos untuk konteks model. */
export function panduanTeks(p: Panduan): string {
  return `${p.judul}: ${p.guna}\nLangkah:\n${p.langkah.map((l, i) => `${i + 1}. ${l}`).join('\n')}\nTips:\n${p.tips.map(t => `- ${t}`).join('\n')}`;
}
