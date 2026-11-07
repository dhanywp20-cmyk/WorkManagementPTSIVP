export interface PenggunaDasar {
  id: string;
  username: string;
  full_name: string;
  role: string;
  team_type?: string;
  sales_division?: string;
  phone_number?: string;
  allowed_menus?: string[];
  access_level?: string;
}

export interface PenggunaPortal extends PenggunaDasar {
  password?: string;
  jabatan?: string;
  atasan_id?: string | null;
  kpi_enabled?: boolean;
  created_at?: string;
  is_internal_sales?: boolean;
  piket_akses?: string | null;
  piket_ubah?: boolean | null;
  pimpinan?: boolean | null;
  telegram_chat_id?: string | null;
  bisa_ditugaskan?: boolean | null;
  pts_daerah?: string | null;
}
