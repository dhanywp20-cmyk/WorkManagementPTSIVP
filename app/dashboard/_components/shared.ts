export interface User {
  id: string;
  username: string;
  password?: string;
  full_name: string;
  role: string;
  team_type?: string;
  phone_number?: string;
  sales_division?: string;
  jabatan?: string;
  atasan_id?: string | null;  // atasan langsung - pohon hierarki Struktur Organisasi
  allowed_menus?: string[];
  kpi_enabled?: boolean;  // true = masuk roster KPI, false = dikecualikan
  created_at?: string;    // used to calculate days pending for Pending Approval users
  is_internal_sales?: boolean; // Guest/Sales internal (IVP/MVI) vs external - untuk routing pipeline
  /** 'full' | 'guest' - toggle akses setara admin di modul data. Lihat lib/constants.ts hasFullAccess(). */
  access_level?: string;
  /** 'lingkup' | 'semua' - lingkup catatan tamu Piket Showroom. Lihat lib/piket-akses.ts. */
  piket_akses?: string | null;
  /** Chat ID Telegram pribadi, terisi hanya lewat verifikasi - lihat app/api/notifikasi/telegram/route.ts aksi 'hubungkan'. */
  telegram_chat_id?: string | null;
  /**
   * Namanya ditawarkan saat assign pekerjaan? Bawaan true; dimatikan admin
   * untuk akun yang perannya menyetujui, bukan mengerjakan.
   * Lihat bolehDitugaskan() di lib/teams.ts.
   */
  bisa_ditugaskan?: boolean | null;
  /**
   * Alamat daerah/kota - hanya berarti untuk akun kelompok PTS Cabang (lihat
   * field `cabang` di lib/kelompok.ts). Dipakai auto-fill Daerah/Kota saat
   * akun ini dipilih di dropdown Installer, Reminder Schedule mode Remote.
   */
  pts_daerah?: string | null;
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

// Notification Types

export interface NotificationItem {
  id: string;
  type: 'ticket' | 'require' | 'reminder';
  title: string;
  subtitle: string;
  time: string;
  url: string;
  internalUrl?: string;
  menuTitle: string;
  /**
   * Id record TUJUAN untuk deep-link (dipakai destinasi membuka detailnya
   * langsung, bukan cuma daftar). Untuk notif dari tickets/project_requests/
   * reminders/form_reviews, `id` di atas SUDAH id record aslinya - refId
   * tidak perlu diisi. HANYA notifikasi dari tabel `notifications` (personal)
   * butuh ini terpisah, karena `id`-nya di sana adalah id baris notifikasi
   * itu sendiri (dipakai utk mark-as-read), bukan id record yang dituju -
   * itu ada di kolom ref_id.
   */
  refId?: string;
}

/**
 * Daftar divisi sales - HANYA nilai bawaan, bukan lagi sumber kebenaran.
 *
 * Daftar yang benar-benar berlaku disimpan di database dan dibaca lewat
 * useDivisiSales() (lihat lib/merek.ts), supaya divisi baru bisa ditambahkan
 * dari Admin Panel tanpa deploy. Nama ini dipertahankan untuk pemakaian di
 * luar React dan sebagai cadangan saat pengaturannya belum termuat.
 *
 * Sebelumnya daftar yang sama disalin di lima berkas shared.ts: menambah satu
 * divisi berarti menyunting kelimanya, dan satu yang terlewat membuat divisi
 * itu muncul di sebagian menu saja.
 */
export { DIVISI_BAWAAN as SALES_DIVISIONS } from '@/lib/merek';

// Hierarki jabatan & aturan CC - satu sumber kebenaran di lib/jabatan.ts,
// re-export agar call-site lama tetap jalan.
export { JABATAN_LIST, JABATAN_CONFIG, JABATAN_CC_RULES, type JabatanType } from '@/lib/jabatan';


// Account Settings Modal

export const ALL_MENU_KEYS = [
  'dashboard',
  'kpi-team',
  'form-bast',
  'request-design-project',
  'ticket-troubleshooting',
  'incentive-pts',
  'project-progress',
  'daily-report',
  'database-pts',
  'unit-movement',
  'reminder-schedule',
  'picket-showroom',
  'learning-center',
  'tech-note',
];

/**
 * Menu yang TIDAK ikut diberikan otomatis saat user baru dibuat.
 * Admin/superadmin tetap melihatnya (mereka bypass allowed_menus), tapi anggota
 * team baru harus diberi akses manual lewat Admin Panel.
 */
export const RESTRICTED_MENU_KEYS = ['project-progress'];

/**
 * Default allowed_menus untuk user BARU. Sengaja dipisah dari ALL_MENU_KEYS:
 * ALL_MENU_KEYS = daftar lengkap untuk selector di Admin Panel,
 * DEFAULT_MENU_KEYS = yang benar-benar dicentang saat user dibuat.
 */
export const DEFAULT_MENU_KEYS = ALL_MENU_KEYS.filter(k => !RESTRICTED_MENU_KEYS.includes(k));

/**
 * Paket menu bergaya SALES - dipakai kelompok PTS yang di Admin Panel ->
 * Kelompok disetel "Tampilan Dashboard: Seperti Sales" (lihat `dashboard`
 * di lib/kelompok.ts).
 *
 * Isinya mengikuti apa yang benar-benar dipakai akun Sales/Marketing di
 * basis data ini: mengajukan jadwal & request design, membuat ticket,
 * mengisi form review, membaca Learning Center - TANPA Daily Report,
 * Incentive PTS, KPI Team, maupun Unit Movement yang memang urusan tim
 * internal.
 *
 * Disaring lewat ALL_MENU_KEYS supaya tidak bisa memuat kunci yang tidak
 * punya menu sungguhan. Akun Sales lama menyimpan 'form-require-project' di
 * allowed_menus padahal tidak ada satu pun menu berkunci itu - kunci hantu
 * yang tidak membuka apa-apa, dan tidak perlu ikut diwariskan ke sini.
 *
 * Hanya soal MENU: role akun tidak ikut berubah, jadi PTS Daerah tetap bisa
 * ditugaskan jadwal dan tetap tercatat bagiannya di Incentive PTS - yang
 * berubah hanya apa yang ia lihat di layarnya sendiri.
 */
export const SALES_MENU_KEYS = ALL_MENU_KEYS.filter(k => [
  'dashboard',
  'form-bast',
  'request-design-project',
  'ticket-troubleshooting',
  'reminder-schedule',
  'learning-center',
].includes(k));

export const ALL_MENU_LABELS: Record<string, { label: string; icon: string }> = {
  'dashboard':              { label: 'Analytics Dashboard (KPI)', icon: '📊' },
  'kpi-team':               { label: 'KPI Team', icon: '📊' },
  'learning-center':        { label: 'Learning Center', icon: '🎓' },
  'form-bast':              { label: 'Form Review Demo & BAST', icon: '⭐' },
  'request-design-project': { label: 'Request Design Project', icon: '🏗️' },
  'ticket-troubleshooting': { label: 'Ticket Troubleshooting', icon: '🎫' },
  'incentive-pts':          { label: 'Incentive Team PTS IVP', icon: '💰' },
  'project-progress':       { label: 'Project Progress', icon: '📊' },
  'daily-report':           { label: 'Daily Report', icon: '📈' },
  'database-pts':           { label: 'Database PTS', icon: '💼' },
  'unit-movement':          { label: 'Unit Movement Log', icon: '🚚' },
  'reminder-schedule':      { label: 'Request Schedule', icon: '🗓️' },
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
  /** Hanya dipakai lonceng Notifikasi personal (tabel `notifications`) - keempat
   *  lonceng lain (Ticket/Require/Reminder/Review) berasal dari status record
   *  asli, bukan flag is_read, jadi tidak butuh "tandai semua dibaca". */
  onMarkAllRead?: () => void;
}


// Admin Panel props
export interface AdminPanelModalProps {
  initialTab: 'settings' | 'userManagement' | 'picBrand' | 'kpiRoster' | 'merek' | 'kelompok';
  onClose: () => void;
}
