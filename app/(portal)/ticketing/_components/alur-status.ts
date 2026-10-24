/**
 * Aturan pindah status ticket Team PTS di panel "Update Status".
 *
 * Satu-satunya tempat aturan ini ditulis; panel di TicketDetailPopup dan
 * penjaga di useTambahAktivitas hanya membaca hasilnya. Database cukup
 * mengecek nama status yang sah (tickets_status_check).
 *
 * Tiga aturan, semuanya hanya bergantung pada status SEKARANG:
 *  1. Pending = status awal. Dari situ: mulai ditangani (Call, Onsite,
 *     In Progress) atau langsung Solved.
 *  2. Setelah ditangani, Call / Onsite / In Progress / Pending Action bebas
 *     berpindah sesuai kenyataan di lapangan (mis. In Progress -> Onsite untuk
 *     kunjungan ulang, Pending Action -> Call setelah kendala beres).
 *  3. Solved boleh dari status APA PUN (wajib catatan penyelesaian) - tim
 *     tidak perlu mengarang Onsite/In Progress dulu hanya supaya bisa
 *     menutup ticket. Setelah Solved, status terkunci - membuka lagi lewat
 *     tombol Buka Ulang.
 * Overdue (dipasang SLA) diperlakukan seperti aturan 2. Waiting Approval,
 * Rejected, dan Cancelled tertutup seperti Solved.
 * Selain pindah status, selalu bisa "tambah catatan saja" (status tetap).
 *
 * Versi sebelumnya memakai urutan maju-saja + riwayat tersembunyi (tombol
 * terkunci tanpa alasan, Solved wajib lewat Onsite dulu) - itulah yang
 * membuat tim bingung.
 */
export const ALUR_STATUS_PTS = ['Pending', 'Call', 'Onsite', 'In Progress', 'Pending Action', 'Solved'] as const;
export type StatusAlurPTS = (typeof ALUR_STATUS_PTS)[number];

/** Status penanganan: ticket sudah benar-benar ditangani. */
const PENANGANAN: readonly StatusAlurPTS[] = ['Call', 'Onsite', 'In Progress'];
/**
 * Status yang boleh pindah ke mana saja (kecuali Pending). Overdue ikut di
 * sini: status itu dipasang otomatis oleh SLA dan MENIMPA status kerja,
 * jadi tidak diketahui apakah ticket sudah ditangani - dan Pending Action
 * (perpanjang deadline) adalah satu-satunya jalan keluar selain Solved.
 */
const SUDAH_DITANGANI: readonly string[] = [...PENANGANAN, 'Pending Action', 'Overdue'];
/** Status tertutup: tidak bisa diupdate dari panel ini. */
const TERTUTUP: Record<string, string> = {
  Solved: 'Ticket sudah Solved. Gunakan Buka Ulang bila masalah muncul lagi.',
  'Waiting Approval': 'Ticket masih menunggu persetujuan admin.',
  Rejected: 'Ticket sudah ditolak.',
  Cancelled: 'Ticket sudah dibatalkan.',
};
const tertutup = (s: string) => Object.prototype.hasOwnProperty.call(TERTUTUP, s);

/** Arti tiap status, tampil di bawah namanya di panel. */
export const ARTI_STATUS: Record<StatusAlurPTS, string> = {
  Pending: 'Belum ditangani',
  Call: 'Hubungi customer / bantu jarak jauh',
  Onsite: 'Datang ke lokasi (bisa dijadwalkan)',
  'In Progress': 'Sedang dikerjakan',
  'Pending Action': 'Tertahan kendala - wajib isi alasan',
  Solved: 'Masalah selesai - wajib isi catatan',
};

export const sudahDitangani = (sekarang: string) => SUDAH_DITANGANI.includes(sekarang);

/** Status tujuan yang boleh dipilih dari status sekarang (tidak termasuk status sekarang itu sendiri). */
export function statusBerikutnya(sekarang: string): StatusAlurPTS[] {
  if (tertutup(sekarang)) return [];
  if (!sudahDitangani(sekarang)) return [...PENANGANAN, 'Solved'];
  return ALUR_STATUS_PTS.filter(s => s !== 'Pending' && s !== sekarang);
}

/** Boleh menambah catatan tanpa mengganti status? */
export const bolehCatatanSaja = (sekarang: string) =>
  sekarang === 'Pending' || sudahDitangani(sekarang);

/** Keterangan untuk status yang belum bisa dipilih (null = semua tersedia). */
export function alasanBelumBisa(sekarang: string): string | null {
  if (tertutup(sekarang)) return TERTUTUP[sekarang];
  if (!sudahDitangani(sekarang)) return 'Pending Action bisa dipilih setelah ticket ditangani (Call, Onsite, atau In Progress).';
  return null;
}

/** Sah atau tidak sebuah update: pindah status sesuai aturan, atau catatan saja (status sama). */
export function updateSah(sekarang: string, baru: string): boolean {
  if (baru === sekarang) return bolehCatatanSaja(sekarang);
  return (statusBerikutnya(sekarang) as string[]).includes(baru);
}

/** Notes wajib diisi? Catatan saja, Pending Action (alasan), dan Solved wajib; Call/Onsite/In Progress opsional. */
export function wajibCatatan(sekarang: string, baru: string): boolean {
  if (baru === sekarang) return true;
  return baru === 'Pending Action' || baru === 'Solved';
}

/** Langkah yang digambar di garis progres detail ticket. */
export const LANGKAH_PROGRES = ['Pending', 'Call', 'Onsite', 'In Progress', 'Solved'] as const;
export type KeadaanLangkah = 'selesai' | 'dilewati' | 'aktif' | 'belum';

/**
 * Keadaan tiap langkah garis progres, dari status sekarang & riwayat aktivitas.
 *
 * Aturan 3 di atas membolehkan Solved dari status apa pun, jadi jalur nyata sering melompat (Call -> Solved).
 * Dulu semua langkah di depan posisi terjauh dicentang hijau - ticket yang langsung Solved setelah Call tampak
 * melewati Onsite & In Progress padahal tidak pernah. Sekarang:
 *  - aktif    = status sekarang; bila status tidak ada di garis (Pending Action, Overdue, ...) = langkah
 *               terjauh yang pernah dicapai. Ticket yang dibuka ulang mengikuti status sekarangnya.
 *  - selesai  = sebelum langkah aktif DAN benar-benar ada di riwayat (Pending = awal, selalu dilalui).
 *  - dilewati = sebelum langkah aktif tetapi tidak pernah dilalui.
 *  - belum    = sesudah langkah aktif.
 */
export function jejakProgres(status: string, riwayat: readonly { new_status?: string | null }[]): { langkah: (typeof LANGKAH_PROGRES)[number]; keadaan: KeadaanLangkah }[] {
  const urutan: readonly string[] = LANGKAH_PROGRES;
  const dicapai = new Set<number>([0]);
  for (const l of riwayat) { const i = urutan.indexOf(l.new_status ?? ''); if (i >= 0) dicapai.add(i); }
  const iStatus = urutan.indexOf(status);
  const aktif = iStatus >= 0 ? iStatus : Math.max(...dicapai);
  return LANGKAH_PROGRES.map((langkah, i) => ({
    langkah,
    keadaan: i === aktif ? 'aktif' : i > aktif ? 'belum' : dicapai.has(i) ? 'selesai' : 'dilewati',
  }));
}
