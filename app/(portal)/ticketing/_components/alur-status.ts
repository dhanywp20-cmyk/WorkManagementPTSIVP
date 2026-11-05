export const ALUR_STATUS_PTS = ['Pending', 'Call', 'Onsite', 'In Progress', 'Pending Action', 'Solved'] as const;
export type StatusAlurPTS = (typeof ALUR_STATUS_PTS)[number];

const PENANGANAN: readonly StatusAlurPTS[] = ['Call', 'Onsite', 'In Progress'];
const SUDAH_DITANGANI: readonly string[] = [...PENANGANAN, 'Pending Action', 'Overdue'];
const TERTUTUP: Record<string, string> = {
  Solved: 'Ticket sudah Solved. Gunakan Buka Ulang bila masalah muncul lagi.',
  'Waiting Approval': 'Ticket masih menunggu persetujuan admin.',
  Rejected: 'Ticket sudah ditolak.',
  Cancelled: 'Ticket sudah dibatalkan.',
};
const tertutup = (s: string) => Object.prototype.hasOwnProperty.call(TERTUTUP, s);

export const ARTI_STATUS: Record<StatusAlurPTS, string> = {
  Pending: 'Belum ditangani',
  Call: 'Hubungi customer / bantu jarak jauh',
  Onsite: 'Datang ke lokasi (bisa dijadwalkan)',
  'In Progress': 'Sedang dikerjakan',
  'Pending Action': 'Tertahan kendala - wajib isi alasan',
  Solved: 'Masalah selesai - wajib isi catatan',
};

export const sudahDitangani = (sekarang: string) => SUDAH_DITANGANI.includes(sekarang);

export function statusBerikutnya(sekarang: string): StatusAlurPTS[] {
  if (tertutup(sekarang)) return [];
  if (!sudahDitangani(sekarang)) return [...PENANGANAN, 'Solved'];
  return ALUR_STATUS_PTS.filter(s => s !== 'Pending' && s !== sekarang);
}

export const bolehCatatanSaja = (sekarang: string) =>
  sekarang === 'Pending' || sudahDitangani(sekarang);

export function alasanBelumBisa(sekarang: string): string | null {
  if (tertutup(sekarang)) return TERTUTUP[sekarang];
  if (!sudahDitangani(sekarang)) return 'Pending Action bisa dipilih setelah ticket ditangani (Call, Onsite, atau In Progress).';
  return null;
}

export function updateSah(sekarang: string, baru: string): boolean {
  if (baru === sekarang) return bolehCatatanSaja(sekarang);
  return (statusBerikutnya(sekarang) as string[]).includes(baru);
}

export function wajibCatatan(sekarang: string, baru: string): boolean {
  if (baru === sekarang) return true;
  return baru === 'Pending Action' || baru === 'Solved';
}

export const LANGKAH_PROGRES = ['Pending', 'Call', 'Onsite', 'In Progress', 'Solved'] as const;
export type KeadaanLangkah = 'selesai' | 'dilewati' | 'aktif' | 'belum';

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
