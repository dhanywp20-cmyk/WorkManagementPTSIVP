export interface KonteksTemplate {
  status: string;
  produk?: string | null;
  sn?: string | null;
  kasus?: string | null;
  lokasi?: string | null;
  catatanSaja?: boolean;
  bukaUlang?: boolean;
}

type Bagian = [judul: string, ...poin: string[]];

function susun(bagian: Bagian[]): string {
  return bagian.map(([judul, ...poin]) => [judul, ...poin.map(p => `- ${p}`)].join('\n')).join('\n');
}

function unit(k: KonteksTemplate): string {
  const produk = k.produk?.trim();
  const sn = k.sn?.trim();
  const nama = produk ? `Unit ${produk}` : 'Unit';
  return `${nama}${sn ? ` (SN ${sn})` : ''}${k.lokasi?.trim() ? ` di ${k.lokasi.trim()}` : ''}`;
}

function kondisiAwal(k: KonteksTemplate): Bagian {
  const kasus = k.kasus?.trim();
  return ['KONDISI AWAL', `${unit(k)} dilaporkan mengalami kendala ${kasus ? `"${kasus}"` : '[gejala yang dilaporkan user]'}`];
}

export function templateNotes(k: KonteksTemplate): string {
  if (k.bukaUlang) {
    return susun([
      ['ALASAN DIBUKA ULANG', `Kendala ${k.kasus?.trim() ? `"${k.kasus.trim()}"` : 'sebelumnya'} muncul kembali pada [tanggal / waktu kejadian]`],
      ['GEJALA TERKINI', '[gejala yang dilaporkan user saat ini]'],
      ['RENCANA', 'Pengecekan ulang dan penanganan lanjutan oleh tim PTS'],
    ]);
  }
  if (k.catatanSaja) {
    return susun([
      ['PERKEMBANGAN', '[hal yang sudah dilakukan / informasi terbaru dari user atau tim]'],
      ['STATUS SAAT INI', '[kondisi unit / penanganan saat ini]'],
      ['LANGKAH BERIKUTNYA', '[rencana tindak lanjut], target [tanggal]'],
    ]);
  }
  if (k.status === 'Pending Action') {
    return susun([
      ['KENDALA', 'Penanganan tertahan karena [menunggu konfirmasi user / akses lokasi / ketersediaan sparepart]'],
      ['SUDAH DICEK', '[pengecekan dan tindakan yang sudah dilakukan]'],
      ['DIBUTUHKAN', '[hal yang harus tersedia] dari [pihak terkait]'],
      ['TINDAK LANJUT', 'Penanganan dilanjutkan setelah kebutuhan di atas terpenuhi, estimasi [tanggal]'],
    ]);
  }
  if (k.status === 'Solved') {
    return susun([
      kondisiAwal(k),
      ['PENYEBAB', '[hasil pemeriksaan, mis. kabel HDMI rusak pada konektor sisi unit]'],
      ['TINDAKAN', 'Pengecekan fisik unit, kabel, dan sumber daya', '[tindakan perbaikan, mis. penggantian kabel HDMI / reset konfigurasi]'],
      ['HASIL', 'Unit kembali berfungsi normal dan sudah diuji bersama user [nama user]'],
      ['REKOMENDASI', 'Pengecekan koneksi kabel dan perangkat secara berkala', 'Hubungi tim PTS bila kendala muncul kembali'],
    ]);
  }
  return susun([
    kondisiAwal(k),
    ['TINDAKAN', 'Pengecekan awal unit, kabel, dan sumber daya', '[tindakan yang sedang dikerjakan]'],
    ['HASIL SEMENTARA', 'Kendala belum sepenuhnya teratasi, penanganan masih berjalan'],
    ['RENCANA', '[langkah berikutnya], target selesai [tanggal]'],
  ]);
}

export function templateAction(k: KonteksTemplate): string {
  if (k.status === 'Pending Action') {
    return ['1. [pengecekan yang sudah dilakukan]', '2. Penanganan ditahan: [alasan singkat]'].join('\n');
  }
  if (k.status === 'Solved') {
    return ['1. Cek fisik unit, kabel, dan sumber daya', '2. [tindakan perbaikan utama]', '3. Uji fungsi bersama user, hasil normal'].join('\n');
  }
  return ['1. Cek fisik unit, kabel, dan sumber daya', '2. [tindakan yang sedang dikerjakan]'].join('\n');
}
