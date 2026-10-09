/**
 * daftar-menu.tsx - Menu portal (urutan kode = urutan tampil), kelompok sidebar & ikon garisnya.
 * Data statis, dipecah dari KerangkaPortal. Hak tampil per akun disaring di KerangkaPortal
 * (allowed_menus / Full Access).
 */
import React from 'react';
import type { MenuItem } from '../dashboard/_components/shared';

export const DAFTAR_MENU: MenuItem[] = [
{
    title: 'Learning Center', icon: '🎓', key: 'learning-center',
    gradient: 'from-blue-700 via-blue-600 to-indigo-500',
    description: 'Platform training, quiz online & analytics team',
    items: [{ name: 'Learning Center', url: '/learning-center', icon: '📚', internal: true, embed: true }]
  },
  {
    title: 'Tech Note R&D', icon: '📝', key: 'tech-note',
    gradient: 'from-pink-700 via-pink-600 to-rose-500',
    description: 'Platform dokumentasi teknikal & R&D — KPI 10%',
    items: [{ name: 'Tech Note', url: '/tech-note', icon: '📝', internal: true, embed: true }]
  },
  {
    title: 'Summary Project', icon: '🗂️', key: 'summary-project',
    gradient: 'from-violet-700 via-violet-600 to-indigo-500',
    description: 'Riwayat Request Schedule, Troubleshooting & Design Project per nama project',
    items: [{ name: 'Summary Project', url: '/summary-project', icon: '🗂️', internal: true, embed: true }]
  },
  {
    title: 'Request Schedule', icon: '🗓️', key: 'reminder-schedule',
    gradient: 'from-cyan-700 via-cyan-600 to-teal-500',
    description: 'Jadwal & request pekerjaan team PTS',
    items: [{ name: 'Request Schedule', url: '/reminder-schedule', icon: '⏰', internal: true, embed: true }]
  },
  {
    title: 'Request Design Project', icon: '🏗️', key: 'request-design-project',
    gradient: 'from-violet-700 via-violet-600 to-violet-500',
    description: 'Solution request Design form untuk project Sales',
    items: [{ name: 'Submit Require', url: '/form-require-project', icon: '📋', internal: true, embed: true }]
  },
  {
    title: 'Form Review Demo & BAST', icon: '⭐', key: 'form-bast',
    gradient: 'from-slate-700 via-slate-600 to-slate-500',
    description: 'Platform review Demo Produk & BAST',
    items: [{ name: 'Platform Review', url: '/form-review', icon: '⭐', internal: true, embed: true }]
  },
  {
    title: 'Ticket Troubleshooting', icon: '🎫', key: 'ticket-troubleshooting',
    gradient: 'from-rose-700 via-rose-600 to-rose-500',
    description: 'Technical support & issue tracking',
    items: [{ name: 'Ticket Management', url: '/ticketing', icon: '🔧', internal: true, embed: true }]
  },
  {
    title: 'Piket Showroom', icon: '🏪', key: 'picket-showroom',
    gradient: 'from-teal-700 via-teal-600 to-cyan-500',
    description: 'Jadwal piket showroom Team PTS IVP, UMP & MVI',
    items: [{ name: 'Piket Showroom', url: '/picket-showroom', icon: '📅', internal: true, embed: true }]
  },
  {
    title: 'Daily Report', icon: '📈', key: 'daily-report',
    gradient: 'from-emerald-700 via-emerald-600 to-emerald-500',
    description: 'Activity tracking & performance metrics',
  items: [{ name: 'Daily Report', url: '/daily-report', icon: '📅', internal: true, embed: true }]
  },
  {
    title: 'Database PTS', icon: '💼', key: 'database-pts',
    gradient: 'from-indigo-700 via-indigo-600 to-indigo-500',
    description: 'Central repository & documentation',
    items: [{ name: 'Access Database', url: 'https://1drv.ms/f/c/25d404c0b5ee2b43/IgBDK-61wATUIIAlAgQAAAAAAZWW6TamAlBHUnCoirmplNs', icon: '🗃️', embed: false, external: true }]
  },
  {
    title: 'Unit Movement Log', icon: '🚚', key: 'unit-movement',
    gradient: 'from-amber-700 via-amber-600 to-amber-500',
    description: 'Equipment check-in & check-out tracking',
    items: [{ name: 'Unit Movement Log', url: '/unit-movement', icon: '🚚', internal: true, embed: true }]
  },
  {
    title: 'Incentive PTS', icon: '💰', key: 'incentive-pts',
    gradient: 'from-indigo-700 via-indigo-600 to-purple-500',
    description: 'Kalkulasi & rekap incentive tim PTS',
    items: [{ name: 'Incentive PTS', url: '/incentive-pts', icon: '💰', internal: true, embed: true }]
  },
  {
    title: 'Project Progress', icon: '📊', key: 'project-progress',
    gradient: 'from-cyan-700 via-cyan-600 to-teal-500',
    description: 'Checklist instalasi per proyek & lokasi, dicentang tim dari lapangan',
    items: [{ name: 'Project Progress', url: '/project-progress', icon: '📊', internal: true, embed: true }]
  },
  {
    title: 'Tools Team', icon: '🧮', key: 'tools-team',
    gradient: 'from-blue-700 via-blue-600 to-sky-500',
    description: 'Kalkulator LED, desain 3D ruang, layar, proyektor, sinyal, audio & daya',
    items: [{ name: 'Tools Team', url: '/tools-team', icon: '🧮', internal: true, embed: true }]
  },
  {
    title: 'KPI Team', icon: '📊', key: 'kpi-team',
    gradient: 'from-sky-700 via-sky-600 to-blue-500',
    description: 'Key Performance Indicators & analytics tim PTS',
    items: [{ name: 'KPI Team', url: '/kpi-team', icon: '📊', internal: true, embed: true }]
  },
];

/** Kelompok sidebar & menu bawah HP (urutan kategori: Learning -> Project -> Internal Daily). */
export const PROJECT_KEYS = ['reminder-schedule', 'request-design-project', 'form-bast', 'ticket-troubleshooting', 'incentive-pts', 'project-progress', 'summary-project', 'tools-team'];
export const INTERNAL_DAILY_KEYS = ['picket-showroom', 'daily-report', 'database-pts', 'unit-movement'];
export const LEARNING_KEYS = ['kpi-team', 'learning-center', 'tech-note'];

export const MENU_ICONS: Record<string, React.ReactElement> = {
  'learning-center': <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>,
'picket-showroom': <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  'reminder-schedule': <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  'request-design-project': <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
  'form-bast': <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
  'ticket-troubleshooting': <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>,
  'daily-report': <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  'database-pts': <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>,
  'tools-team': <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
  'unit-movement': <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>,
  'incentive-pts': <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  'tech-note': <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  'project-progress': <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m4 10V11m4 6v-4M4 19h16a1 1 0 001-1V6a1 1 0 00-1-1H4a1 1 0 00-1 1v12a1 1 0 001 1z" /></svg>,
  'summary-project': <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>,
  'kpi-team': <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
};
