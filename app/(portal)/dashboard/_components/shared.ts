import type { ComponentType, SVGProps } from 'react';

export type { PenggunaPortal as User } from '@/lib/tipe-pengguna';

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

export interface NotificationItem {
  id: string;
  type: 'ticket' | 'require' | 'reminder';
  title: string;
  subtitle: string;
  time: string;
  url: string;
  internalUrl?: string;
  menuTitle: string;
  refId?: string;
}

export { DIVISI_BAWAAN as SALES_DIVISIONS } from '@/lib/merek/inti';

export { JABATAN_LIST, JABATAN_CONFIG, JABATAN_CC_RULES, type JabatanType } from '@/lib/jabatan';

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
  'tools-team',
  'tools-pustaka',
  'summary-project',
  'reminder-schedule',
  'picket-showroom',
  'learning-center',
  'tech-note',
];

export const RESTRICTED_MENU_KEYS = ['project-progress', 'summary-project', 'tools-pustaka'];

export const DEFAULT_MENU_KEYS = ALL_MENU_KEYS.filter(k => !RESTRICTED_MENU_KEYS.includes(k));

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
  'tools-team':            { label: 'AV Solution Tools', icon: '🧮' },
  'tools-pustaka':         { label: 'Pustaka AV Solution Tools', icon: '📚' },
  'reminder-schedule':      { label: 'Request Schedule', icon: '🗓️' },
  'picket-showroom':        { label: 'Piket Showroom', icon: '🏪' },
  'tech-note':              { label: 'Tech Note R&D', icon: '📝' },
  'summary-project':        { label: 'Summary Project', icon: '🗂️' },
};

export const ROLE_BADGE: Record<string, string> = {
  superadmin: 'bg-rose-100 text-rose-700 border-rose-200',
  admin: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  team: 'bg-blue-100 text-blue-700 border-blue-200',
  team_pts: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  guest: 'bg-amber-100 text-amber-700 border-amber-200',
};

export interface BrandPicMappingDB {
  id?: string;
  brand_type: 'display' | 'middleware';
  brand_name: string;
  pic_user_id: string | null;
  pic_user_name: string | null;
}

export interface NotifBellProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  count: number;
  color: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
  items: NotificationItem[];
  onItemClick: (item: NotificationItem) => void;
  onMarkAllRead?: () => void;
}

export interface AdminPanelModalProps {
  initialTab: 'settings' | 'userManagement' | 'picBrand' | 'kpiRoster' | 'merek' | 'kelompok' | 'integrasi' | 'kodeAcara' | 'daftarPilihan';
  onClose: () => void;
}
