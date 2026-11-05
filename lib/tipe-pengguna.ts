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
