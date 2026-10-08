import type { ReactNode } from 'react';

/**
 * Aturan navigasi bawah HP / APK (murni - diuji di uji/nav-bawah.ts): urutan tombol & label pendeknya.
 */

export interface MenuNav {
  key: string;
  label: string;
  /** Label ringkas untuk tombol bar bawah (lebar ±1/5 layar HP). */ pendek?: string;
  ikon: ReactNode;
  aktif?: boolean;
  badge?: number;
  /** Aksi berisiko (Keluar) - ditampilkan merah. */ bahaya?: boolean;
  onPilih: () => void;
}

/** Tombol yang terlihat sekaligus tanpa menggeser (sisanya digeser kiri-kanan). */
export const TOMBOL_TERLIHAT = 5;

/**
 * Urutan menu di bar bawah: yang paling sering dibuka tim di lapangan lebih dulu, supaya layar
 * pertama (tanpa menggeser) sudah memuat menu harian. Menu yang tidak dikenal ditaruh di belakang.
 */
export const PRIORITAS_MENU = [
  'reminder-schedule', 'ticket-troubleshooting', 'project-progress', 'request-design-project', 'summary-project',
  'daily-report', 'picket-showroom', 'form-bast', 'incentive-pts', 'tools-team', 'kpi-team',
  'learning-center', 'tech-note', 'unit-movement', 'database-pts',
];

/** Label pendek tombol bar bawah. */
export const LABEL_PENDEK: Record<string, string> = {
  'reminder-schedule': 'Schedule', 'ticket-troubleshooting': 'Ticketing', 'project-progress': 'Progress',
  'request-design-project': 'Design', 'summary-project': 'Summary', 'daily-report': 'Daily Report',
  'picket-showroom': 'Piket', 'form-bast': 'Review & BAST', 'incentive-pts': 'Incentive', 'tools-team': 'Tools Team',
  'kpi-team': 'KPI', 'learning-center': 'Learning', 'tech-note': 'Tech Note', 'unit-movement': 'Unit Log',
  'database-pts': 'Database',
};

/** Urutkan menu menurut PRIORITAS_MENU; yang setara tetap urutan aslinya (urutan sidebar). */
export function urutNav<T extends { key: string }>(menu: T[], prioritas: string[] = PRIORITAS_MENU): T[] {
  const peringkat = (k: string) => { const i = prioritas.indexOf(k); return i < 0 ? prioritas.length : i; };
  return menu.map((m, i) => ({ m, i })).sort((a, b) => peringkat(a.m.key) - peringkat(b.m.key) || a.i - b.i).map(x => x.m);
}
