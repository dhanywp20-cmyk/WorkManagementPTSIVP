export interface PenggunaDasar {
  id: string;
  username: string;
  full_name: string;
  role: string | null;
  team_type?: string | null;
  sales_division?: string | null;
  phone_number?: string | null;
  allowed_menus?: string[] | null;
  access_level?: string | null;
}

export interface PenggunaPortal extends PenggunaDasar {
  password?: string;
  jabatan?: string | null;
  atasan_id?: string | null;
  kpi_enabled?: boolean;
  created_at?: string | null;
  is_internal_sales?: boolean;
  piket_akses?: string | null;
  piket_ubah?: boolean | null;
  pimpinan?: boolean | null;
  telegram_terhubung?: boolean | null;
  bisa_ditugaskan?: boolean | null;
  tanggal_nonaktif?: string | null;
  pts_daerah?: string | null;
}
