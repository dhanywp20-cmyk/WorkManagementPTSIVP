/**
 * Aturan pindah status ticket Team PTS di panel "Update Status".
 *
 * Satu-satunya tempat aturan ini ditulis; tombolnya di TicketDetailPopup
 * hanya membaca hasilnya. Database cukup mengecek nama status yang sah
 * (tickets_status_check) - urutan alurnya dijaga di sini.
 */
export const ALUR_STATUS_PTS = ['Pending', 'Call', 'Onsite', 'In Progress', 'Pending Action', 'Solved'] as const;
export type StatusAlurPTS = (typeof ALUR_STATUS_PTS)[number];

/** Langkah kerja nyata; Pending Action & Solved bukan "posisi" pengerjaan. */
const LANGKAH_KERJA: readonly string[] = ['Pending', 'Call', 'Onsite', 'In Progress'];

/**
 * Posisi pengerjaan yang sudah dicapai ticket.
 *
 * Saat ticket sedang Pending Action, posisinya diambil dari langkah kerja
 * TERJAUH di riwayat - Pending Action bisa masuk dari Call, Onsite, atau In
 * Progress, dan sesudah kendalanya beres pengerjaan lanjut dari titik itu,
 * bukan dipaksa melompat ke In Progress.
 */
function posisiKerja(statusSekarang: string, riwayatStatus: readonly string[]): number {
  if (statusSekarang !== 'Pending Action') return ALUR_STATUS_PTS.indexOf(statusSekarang as StatusAlurPTS);
  const dariRiwayat = riwayatStatus.map(s => LANGKAH_KERJA.indexOf(s)).filter(i => i >= 0);
  //  Riwayat kosong/rusak: anggap minimal Call - Pending Action memang
  //  hanya bisa dipilih sejak Call.
  return Math.max(1, ...dariRiwayat);
}

/** true = tombol status ini dikunci (tidak boleh dipilih). */
export function statusTerkunci(
  langkah: StatusAlurPTS,
  statusSekarang: string,
  riwayatStatus: readonly string[] = [],
): boolean {
  const posisi = posisiKerja(statusSekarang, riwayatStatus);
  const idx = ALUR_STATUS_PTS.indexOf(langkah);

  if (statusSekarang === 'Pending Action') {
    //  Kendala beres: lanjut dari titik terakhir atau maju. Mundur melewati
    //  titik itu tetap dikunci, sama seperti status lain.
    if (langkah === 'Pending Action') return false;
    if (langkah === 'Solved') return posisi < 2;
    return idx < posisi;
  }

  if (posisi >= 0 && idx < posisi) return true;
  //  Pending Action boleh sejak Call: menelepon customer atau datang ke
  //  lokasi bisa langsung tertahan kendala (customer belum siap, akses belum
  //  ada) tanpa harus pura-pura In Progress dulu.
  if (langkah === 'Pending Action') return posisi < 1;
  //  Solved tetap hanya sejak Onsite.
  if (langkah === 'Solved') return posisi < 2;
  return false;
}
