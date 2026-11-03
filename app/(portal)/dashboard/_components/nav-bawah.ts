import type { ReactNode } from 'react';

export interface MenuNav {
  key: string;
  label: string;
   pendek?: string;
  ikon: ReactNode;
  aktif?: boolean;
  badge?: number;
   bahaya?: boolean;
  onPilih: () => void;
}

export const TOMBOL_TERLIHAT = 5;

export const PRIORITAS_MENU = [
  'reminder-schedule', 'ticket-troubleshooting', 'project-progress', 'request-design-project', 'summary-project',
  'daily-report', 'picket-showroom', 'form-bast', 'incentive-pts', 'tools-team', 'kpi-team',
  'learning-center', 'tech-note', 'unit-movement', 'database-pts',
];

export const LABEL_PENDEK: Record<string, string> = {
  'reminder-schedule': 'Schedule', 'ticket-troubleshooting': 'Ticketing', 'project-progress': 'Progress',
  'request-design-project': 'Design', 'summary-project': 'Summary', 'daily-report': 'Daily Report',
  'picket-showroom': 'Piket', 'form-bast': 'Review & BAST', 'incentive-pts': 'Incentive', 'tools-team': 'AV Tools',
  'kpi-team': 'KPI', 'learning-center': 'Learning', 'tech-note': 'Tech Note', 'unit-movement': 'Unit Log',
  'database-pts': 'Database',
};

export function urutNav<T extends { key: string }>(menu: T[], prioritas: string[] = PRIORITAS_MENU): T[] {
  const peringkat = (k: string) => { const i = prioritas.indexOf(k); return i < 0 ? prioritas.length : i; };
  return menu.map((m, i) => ({ m, i })).sort((a, b) => peringkat(a.m.key) - peringkat(b.m.key) || a.i - b.i).map(x => x.m);
}
