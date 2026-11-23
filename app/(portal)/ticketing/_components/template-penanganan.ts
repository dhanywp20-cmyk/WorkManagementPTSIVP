export interface KonteksTemplate {
  status: string;
  produk?: string | null;
  sn?: string | null;
  kasus?: string | null;
  lokasi?: string | null;
  catatanSaja?: boolean;
  bukaUlang?: boolean;
}

function unit(k: KonteksTemplate): string {
  const produk = k.produk?.trim();
  const sn = k.sn?.trim();
  const nama = produk ? `Unit ${produk}` : 'Unit';
  return `${nama}${sn ? ` (SN ${sn})` : ''}${k.lokasi?.trim() ? ` di ${k.lokasi.trim()}` : ''}`;
}

function kondisiAwal(k: KonteksTemplate): string {
  const kasus = k.kasus?.trim();
  return `Kondisi Awal: ${unit(k)} dilaporkan mengalami kendala ${kasus ? `"${kasus}"` : '[gejala yang dilaporkan user]'}.`;
}

export function templateNotes(k: KonteksTemplate): string {
  if (k.bukaUlang) {
    return [
      `Alasan Dibuka Ulang: Kendala ${k.kasus?.trim() ? `"${k.kasus.trim()}"` : 'sebelumnya'} muncul kembali pada [tanggal / waktu kejadian].`,
      'Gejala Terkini: [gejala yang dilaporkan user saat ini].',
      'Rencana: Pengecekan ulang dan penanganan lanjutan oleh tim PTS.',
    ].join('\n');
  }
  if (k.catatanSaja) {
    return [
      'Perkembangan: [hal yang sudah dilakukan / informasi terbaru dari user atau tim].',
      'Status Saat Ini: [kondisi unit / penanganan saat ini].',
      'Langkah Berikutnya: [rencana tindak lanjut] dengan target [tanggal].',
    ].join('\n');
  }
  if (k.status === 'Pending Action') {
    return [
      'Kendala: Penanganan tertahan karena [menunggu konfirmasi user / akses lokasi / ketersediaan sparepart].',
      'Sudah Dicek: [pengecekan dan tindakan yang sudah dilakukan].',
      'Dibutuhkan: [hal yang harus tersedia] dari [pihak terkait].',
      'Tindak Lanjut: Penanganan dilanjutkan setelah kebutuhan di atas terpenuhi, estimasi [tanggal].',
    ].join('\n');
  }
  if (k.status === 'Solved') {
    return [
      kondisiAwal(k),
      'Tindakan: Pengecekan fisik unit, kabel, dan sumber daya, lalu [tindakan perbaikan, mis. penggantian kabel HDMI / reset konfigurasi].',
      'Hasil: Unit kembali berfungsi normal dan sudah diuji bersama user [nama user] tanpa kendala.',
      'Rekomendasi: Pengecekan koneksi kabel dan perangkat secara berkala; hubungi tim PTS bila kendala muncul kembali.',
    ].join('\n');
  }
  return [
    kondisiAwal(k),
    'Tindakan: Pengecekan awal unit, kabel, dan sumber daya sudah dilakukan; saat ini sedang [tindakan yang sedang dikerjakan].',
    'Hasil: Kendala belum sepenuhnya teratasi, penanganan masih berjalan.',
    'Rencana: [langkah berikutnya] dengan target selesai [tanggal].',
  ].join('\n');
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
