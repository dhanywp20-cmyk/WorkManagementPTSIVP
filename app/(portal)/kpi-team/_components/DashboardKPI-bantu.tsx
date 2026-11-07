'use client';
import { WARNA_STATUS_TICKET } from '@/lib/desain';

export const STATUS_COLORS: Record<string, string> = WARNA_STATUS_TICKET;

export const CATEGORY_COLORS: Record<string, string> = {
  'Demo Product': '#3b82f6', 'Meeting & Survey': '#8b5cf6', 'Konfigurasi': '#10b981',
  'Konfigurasi & Training': '#06b6d4', 'Troubleshooting': '#ef4444',
  'Training': '#f59e0b', 'Internal': '#6b7280',
};

export function batasDenganLainnya<T extends { count: number }>(
  daftar: T[], n: number, buatLainnya: (sisaCount: number) => T,
): T[] {
  if (daftar.length <= n) return daftar;
  const sisa = daftar.slice(n).reduce((s, d) => s + d.count, 0);
  return [...daftar.slice(0, n), buatLainnya(sisa)];
}

export const SEVERITY_STYLE = {
  info:     { bg: 'rgba(59,130,246,0.06)',  border: 'rgba(59,130,246,0.18)',  dot: '#3b82f6', text: '#1e40af' },
  warn:     { bg: 'rgba(245,158,11,0.07)',  border: 'rgba(245,158,11,0.22)',  dot: '#d97706', text: '#92400e' },
  critical: { bg: 'rgba(239,68,68,0.06)',   border: 'rgba(239,68,68,0.18)',   dot: '#ef4444', text: '#991b1b' },
};

export const todayStr   = () => new Date().toISOString().split('T')[0];

const dayOfWeek  = () => ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][new Date().getDay()];

export const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]; };

export function getMonday() {
  const d = new Date(); const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().split('T')[0];
}

export type PiketPic = { pic_ivp_name: string|null; pic_ump_name: string|null; pic_mvi_name: string|null };

export function computeCascadedPiketToday(
  weekRows: (PiketPic & { day_date: string })[],
  holidays: string[],
  todayDate: string
): PiketPic | null {
  if (weekRows.length === 0) return null;
  const holidaySet = new Set(holidays);
  const sorted = [...weekRows].sort((a, b) => a.day_date.localeCompare(b.day_date));
  const picPool: PiketPic[] = sorted.map(r => ({
    pic_ivp_name: r.pic_ivp_name ?? null,
    pic_ump_name: r.pic_ump_name ?? null,
    pic_mvi_name: r.pic_mvi_name ?? null,
  }));
  let poolIdx = 0;
  for (const row of sorted) {
    if (holidaySet.has(row.day_date)) {
      if (row.day_date === todayDate) return { pic_ivp_name: null, pic_ump_name: null, pic_mvi_name: null };
    } else {
      const pic = picPool[Math.min(poolIdx, picPool.length - 1)];
      poolIdx++;
      if (row.day_date === todayDate) return pic;
    }
  }
  return null;
}
