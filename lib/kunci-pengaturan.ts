
export const KUNCI_PENGATURAN = {
  MANAGER: 'manager_user_id',

  JADWAL_REMINDER: 'reminder_schedule',

  MEREK: 'merek',
  DIVISI_SALES: 'sales_divisions',
  KELOMPOK: 'kelompok',
  LINGKUP_MANAGER: 'lingkup_manager',
  DAFTAR_PILIHAN: 'daftar_pilihan',
  NOTIFIKASI_KANAL: 'notifikasi.kanal',
} as const;

export type KunciPengaturan = typeof KUNCI_PENGATURAN[keyof typeof KUNCI_PENGATURAN];
