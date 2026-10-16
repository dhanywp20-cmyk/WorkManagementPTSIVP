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
const SUDAH_DITANGANI: readonly string[] = [...PENANGANAN, 'Pending Action'];

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
  if (sekarang === 'Solved' || sekarang === 'Waiting Approval') return [];
  if (!sudahDitangani(sekarang)) return [...PENANGANAN, 'Solved'];
  return ALUR_STATUS_PTS.filter(s => s !== 'Pending' && s !== sekarang);
}

/** Boleh menambah catatan tanpa mengganti status? */
export const bolehCatatanSaja = (sekarang: string) =>
  (ALUR_STATUS_PTS as readonly string[]).includes(sekarang) && sekarang !== 'Solved';

/** Keterangan untuk status yang belum bisa dipilih (null = semua tersedia). */
export function alasanBelumBisa(sekarang: string): string | null {
  if (sekarang === 'Solved') return 'Ticket sudah Solved. Gunakan Buka Ulang bila masalah muncul lagi.';
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
