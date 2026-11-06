import { CATEGORIES } from '@/lib/jadwal-aturan';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type RepeatType = 'none' | 'daily' | 'weekly' | 'monthly';

export interface TeamUser {
  id: string;
  username: string;
  full_name: string;
  role: string;
  team_type?: string;
  sales_division?: string;
  phone_number?: string;
  allowed_menus?: string[];
  jabatan?: string | null;
  access_level?: string;
  telegram_chat_id?: string | null;
  bisa_ditugaskan?: boolean | null;
}

export interface GuestUser {
  id: string;
  username: string;
  full_name: string;
  role: string;
  phone_number?: string;
  sales_division?: string;
  is_internal_sales?: boolean;
}

export const PRODUCT_TYPES = ['LED', 'LCD/Middleware', 'LED & LCD'] as const;

export const DAILY_REPORT_CATEGORIES = [
  ...CATEGORIES,
  'Design Single Line Diagram',
  'Research and Development',
];

export const CATEGORY_CONFIG: Record<string, { icon: string; color: string; bg: string; border: string; accent: string }> = {
  'Demo Product':     { icon: '🖥️', color: '#a78bfa', bg: 'rgba(167,139,250,0.15)', border: 'rgba(167,139,250,0.4)', accent: '#7c3aed' },
  'Meeting & Survey': { icon: '🤝', color: '#38bdf8', bg: 'rgba(56,189,248,0.15)',   border: 'rgba(56,189,248,0.4)',   accent: '#0ea5e9' },
  'Konfigurasi':      { icon: '⚙️', color: '#34d399', bg: 'rgba(52,211,153,0.15)',   border: 'rgba(52,211,153,0.4)',   accent: '#10b981' },
  'Konfigurasi & Training':      { icon: '📌', color: '#34d399', bg: 'rgba(52,211,153,0.15)',   border: 'rgba(52,211,153,0.4)',   accent: '#10b981' },
  'Troubleshooting':  { icon: '🔧', color: '#fb7185', bg: 'rgba(251,113,133,0.15)',   border: 'rgba(251,113,133,0.4)',  accent: '#e11d48' },
  'Training':         { icon: '🎓', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)',    border: 'rgba(251,191,36,0.4)',   accent: '#d97706' },
  'Maintenance':      { icon: '🛠️', color: '#fb923c', bg: 'rgba(251,146,60,0.15)',    border: 'rgba(251,146,60,0.4)',   accent: '#ea580c' },
  'Standby Event':    { icon: '📡', color: '#22d3ee', bg: 'rgba(34,211,238,0.15)',    border: 'rgba(34,211,238,0.4)',   accent: '#0891b2' },
  'Design Single Line Diagram': { icon: '📐', color: '#818cf8', bg: 'rgba(129,140,248,0.15)', border: 'rgba(129,140,248,0.4)', accent: '#4f46e5' },
  'Research and Development':    { icon: '🔬', color: '#f472b6', bg: 'rgba(244,114,182,0.15)', border: 'rgba(244,114,182,0.4)', accent: '#db2777' },
  'Internal':         { icon: '🕵🏻', color: '#16a34a', bg: 'rgba(22,163,74,0.15)',    border: 'rgba(22,163,74,0.4)',   accent: '#16a34a' },
};

export const PIE_COLORS = ['#7c3aed','#0ea5e9','#10b981','#e11d48','#f59e0b','#6366f1','#14b8a6','#f97316','#8b5cf6','#06b6d4','#ec4899','#84cc16'];

export function formatDatetime(createdAt: string) {
  if (!createdAt) return '';
  const d = new Date(createdAt);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' +
    d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}
