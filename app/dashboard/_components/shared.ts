export interface User {
  id: string;
  username: string;
  password: string;
  full_name: string;
  role: string;
  team_type?: string;
  phone_number?: string;
  sales_division?: string;
  jabatan?: string;
  allowed_menus?: string[];
  kpi_enabled?: boolean;  // true = masuk roster KPI, false = dikecualikan
}

export interface MenuItem {
  title: string;
  icon: string;
  gradient: string;
  description: string;
  key: string;
  items: {
    name: string;
    url: string;
    icon: string;
    external?: boolean;
    embed?: boolean;
    internal?: boolean;
  }[];
}

// ─── Notification Types ───────────────────────────────────────────────────────

export interface NotificationItem {
  id: string;
  type: 'ticket' | 'require' | 'reminder';
  title: string;
  subtitle: string;
  time: string;
  url: string;
  internalUrl?: string;
  menuTitle: string;
}

export const SALES_DIVISIONS = [
  'IVP', 'MVI', 'MLDS', 'HAVS', 'Enterprise', 'DEC', 'ICS', 'POJ', 'VOJ', 'LOCOS',
  'VISIONMEDIA', 'UMP', 'BISOL', 'KIMS', 'IDC', 'IOCMEDAN', 'IOCPekanbaru',
  'IOCBandung', 'IOCJATENG', 'IOCSEMARANG', 'POSSurabaya', 'IOCSurabaya',
  'IOCBali', 'SGP', 'SGP 1', 'SGP 2', 'OSS',
];

// Hierarki jabatan — urutan dari bawah ke atas
export const JABATAN_LIST = ['Staff', 'Supervisor', 'Manager', 'Deputy General Manager', 'General Manager', 'Direktur'] as const;
export type JabatanType = typeof JABATAN_LIST[number];

export const JABATAN_CONFIG: Record<JabatanType, { icon: string; color: string; bg: string; border: string; tier: number }> = {
  'Staff':                  { icon: '👤', color: '#374151', bg: '#f9fafb',   border: '#d1d5db', tier: 1 },
  'Supervisor':             { icon: '👥', color: '#1e40af', bg: '#eff6ff',   border: '#93c5fd', tier: 2 },
  'Manager':                { icon: '🏅', color: '#7e22ce', bg: '#faf5ff',   border: '#c4b5fd', tier: 3 },
  'Deputy General Manager': { icon: '🎖️', color: '#b45309', bg: '#fffbeb',   border: '#fcd34d', tier: 4 },
  'General Manager':        { icon: '🌟', color: '#065f46', bg: '#ecfdf5',   border: '#6ee7b7', tier: 5 },
  'Direktur':               { icon: '👑', color: '#991b1b', bg: '#fff1f2',   border: '#fca5a5', tier: 6 },
};

// Rules CC otomatis berdasarkan jabatan (bawahan → CC ke jabatan mana di atas)
export const JABATAN_CC_RULES: Record<JabatanType, JabatanType[]> = {
  'Staff':                  ['Supervisor', 'Manager', 'Deputy General Manager', 'General Manager'],
  'Supervisor':             ['Manager', 'Deputy General Manager', 'General Manager'],
  'Manager':                ['General Manager', 'Deputy General Manager', 'Direktur'],
  'Deputy General Manager': ['General Manager', 'Direktur'],
  'General Manager':        ['Direktur'],
  'Direktur':               [],
};


// ─── Account Settings Modal ──────────────────────────────────────────────────

export const ALL_MENU_KEYS = [
  'dashboard',
  'form-bast',
  'request-design-project',
  'ticket-troubleshooting',
  'daily-report',
  'database-pts',
  'unit-movement',
  'reminder-schedule',
  'picket-showroom',
  'learning-center',
  'tech-note',
];

export const ALL_MENU_LABELS: Record<string, { label: string; icon: string }> = {
  'dashboard':              { label: 'Analytics Dashboard (KPI)', icon: '📊' },
  'learning-center':        { label: 'Learning Center', icon: '🎓' },
  'form-bast':              { label: 'Form Review Demo & BAST', icon: '⭐' },
  'request-design-project': { label: 'Request Design Project', icon: '🏗️' },
  'ticket-troubleshooting': { label: 'Ticket Troubleshooting', icon: '🎫' },
  'daily-report':           { label: 'Daily Report', icon: '📈' },
  'database-pts':           { label: 'Database PTS', icon: '💼' },
  'unit-movement':          { label: 'Unit Movement Log', icon: '🚚' },
  'reminder-schedule':      { label: 'Reminder Schedule', icon: '🗓️' },
  'picket-showroom':        { label: 'Piket Showroom', icon: '🏪' },
  'tech-note':              { label: 'Tech Note R&D', icon: '📝' },
};

export const ROLE_BADGE: Record<string, string> = {
  superadmin: 'bg-rose-100 text-rose-700 border-rose-200',
  admin: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  team: 'bg-blue-100 text-blue-700 border-blue-200',
  team_pts: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  guest: 'bg-amber-100 text-amber-700 border-amber-200',
};


// Brand mappings (from BrandPicSettingModal section)
export const DISPLAY_BRANDS_DB = ['Microvision', 'Philips', 'Panasonic', 'Newline', 'Promethean', 'Maxhub', 'Ledman', 'Taniled', 'Vivitek'];
export const MIDDLEWARE_BRANDS_DB = ['Tricolor', 'Wyrestorm', 'Extron', 'Crestron', 'AVCiT', 'Brightsign', 'Cue'];

export interface BrandPicMappingDB {
  id?: string;
  brand_type: 'display' | 'middleware';
  brand_name: string;
  pic_user_id: string | null;
  pic_user_name: string | null;
}

// Notif Bell props (from NotifBell section)
export interface NotifBellProps {
  icon: string;
  label: string;
  count: number;
  color: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
  items: NotificationItem[];
  onItemClick: (item: NotificationItem) => void;
}


// Admin Panel props
export interface AdminPanelModalProps {
  initialTab: 'settings' | 'userManagement' | 'picBrand' | 'kpiRoster';
  onClose: () => void;
}
