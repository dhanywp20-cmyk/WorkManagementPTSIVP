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
    title: 'AV Solution Tools', icon: '🧮', key: 'tools-team',
    gradient: 'from-blue-700 via-blue-600 to-sky-500',
    description: 'Kalkulator LED, desain 3D ruang, layar, proyektor, sinyal, audio & daya',
    items: [{ name: 'AV Solution Tools', url: '/tools-team', icon: '🧮', internal: true, embed: true }]
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
    title: 'KPI Team', icon: '📊', key: 'kpi-team',
    gradient: 'from-sky-700 via-sky-600 to-blue-500',
    description: 'Key Performance Indicators & analytics tim PTS',
    items: [{ name: 'KPI Team', url: '/kpi-team', icon: '📊', internal: true, embed: true }]
  },
];

export const PROJECT_KEYS = ['reminder-schedule', 'request-design-project', 'form-bast', 'ticket-troubleshooting', 'incentive-pts', 'project-progress', 'summary-project', 'tools-team'];
export const INTERNAL_DAILY_KEYS = ['picket-showroom', 'daily-report', 'database-pts', 'unit-movement'];
export const LEARNING_KEYS = ['kpi-team', 'learning-center', 'tech-note'];

const TIPIS = 0.18;
const ik = (isi: React.ReactNode) => (
  <svg aria-hidden="true" focusable="false" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">{isi}</svg>
);

export const IKON_BERANDA = ik(<>
  <path d="M3.5 10.5 12 4l8.5 6.5V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19z" fill="currentColor" fillOpacity={TIPIS} />
  <path d="M9.5 20.5V15h5v5.5" />
</>);

export const MENU_ICONS: Record<string, React.ReactElement> = {
  'learning-center': ik(<>
    <path d="M2.5 9.2 12 4.5l9.5 4.7-9.5 4.7z" fill="currentColor" fillOpacity={TIPIS} />
    <path d="M6.5 11.5v4.2c0 1.5 2.5 3.3 5.5 3.3s5.5-1.8 5.5-3.3v-4.2M21.5 9.2v5" />
  </>),
  'tech-note': ik(<>
    <rect x="5.5" y="3" width="14" height="18" rx="2.5" fill="currentColor" fillOpacity={TIPIS} />
    <path d="M9.5 8h6M9.5 12h6M9.5 16h3.5M5.5 7.5H3.5M5.5 12H3.5M5.5 16.5H3.5" />
  </>),
  'summary-project': ik(<>
    <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z" fill="currentColor" fillOpacity={TIPIS} />
    <path d="M8 13h8M8 16.5h5" />
  </>),
  'tools-team': ik(<>
    <path d="M5.5 4v5.5M5.5 14v6M12 4v2.5M12 11v9M18.5 4v9.5M18.5 18v2" />
    <circle cx="5.5" cy="11.8" r="2.3" fill="currentColor" fillOpacity={TIPIS} />
    <circle cx="12" cy="8.7" r="2.3" fill="currentColor" fillOpacity={TIPIS} />
    <circle cx="18.5" cy="15.8" r="2.3" fill="currentColor" fillOpacity={TIPIS} />
  </>),
  'reminder-schedule': ik(<>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" fill="currentColor" fillOpacity={TIPIS} />
    <path d="M8 3v4M16 3v4M3.5 10h17M8 14h2M14 14h2M8 17h2" />
  </>),
  'request-design-project': ik(<>
    <path d="M4 4v16h16z" fill="currentColor" fillOpacity={TIPIS} />
    <path d="M8.5 11.5v4h4zM4 8h2M4 12h1.5M4 16h2" />
  </>),
  'form-bast': ik(<>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v9a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4A2.5 2.5 0 0 1 4 14.5z" fill="currentColor" fillOpacity={TIPIS} />
    <path d="m12 6.6 1.1 2.2 2.4.35-1.75 1.7.42 2.4L12 12.1l-2.17 1.15.42-2.4-1.75-1.7 2.4-.35z" />
  </>),
  'ticket-troubleshooting': ik(<>
    <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2.5a2.5 2.5 0 0 0 0 5V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2.5a2.5 2.5 0 0 0 0-5z" fill="currentColor" fillOpacity={TIPIS} />
    <path d="M14.5 5.5v2M14.5 11v2M14.5 16.5v2" />
  </>),
  'picket-showroom': ik(<>
    <path d="M3.5 9a2.8 2.8 0 0 0 5.6 0 2.9 2.9 0 0 0 5.8 0 2.8 2.8 0 0 0 5.6 0L19 4H5z" fill="currentColor" fillOpacity={TIPIS} />
    <path d="M5 12.2V20h14v-7.8M10 20v-4.5h4V20" />
  </>),
  'daily-report': ik(<>
    <rect x="5" y="4" width="14" height="17" rx="2.5" fill="currentColor" fillOpacity={TIPIS} />
    <rect x="9" y="2.5" width="6" height="3.2" rx="1.2" />
    <path d="M9 17v-3M12 17v-6M15 17v-4.5" />
  </>),
  'database-pts': ik(<>
    <ellipse cx="12" cy="6" rx="7.5" ry="3" fill="currentColor" fillOpacity={TIPIS} />
    <path d="M4.5 6v12c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3V6M4.5 12c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3" />
  </>),
  'unit-movement': ik(<>
    <path d="M2.5 6.5A1.5 1.5 0 0 1 4 5h9.5v11h-11z" fill="currentColor" fillOpacity={TIPIS} />
    <path d="M13.5 9H18l3.5 3.8V16h-1.5M13.5 16H9.2M2.5 16h2.3" />
    <circle cx="7" cy="17" r="2" /><circle cx="17.5" cy="17" r="2" />
  </>),
  'incentive-pts': ik(<>
    <rect x="3.5" y="7.5" width="17" height="12" rx="2.5" fill="currentColor" fillOpacity={TIPIS} />
    <path d="M5.5 7.5 15 4.2a1.5 1.5 0 0 1 1.9.9l.8 2.4M20.5 11.5h-3.5a2 2 0 0 0 0 4h3.5" />
  </>),
  'project-progress': ik(<>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="currentColor" fillOpacity={TIPIS} />
    <path d="m7.5 9 1.5 1.5 3-3M7.5 15.5 9 17l3-3M14.5 9.5H17M14.5 16H17" />
  </>),
  'kpi-team': ik(<>
    <path d="M3.5 17.5v-2a8.5 8.5 0 0 1 17 0v2z" fill="currentColor" fillOpacity={TIPIS} stroke="none" />
    <path d="M3.5 17.5v-2a8.5 8.5 0 0 1 17 0v2M12 15.5l3.8-4.6M12 8.5v1M7 11l.7.7M17 11l-.7.7" />
    <circle cx="12" cy="15.5" r="1.4" fill="currentColor" />
  </>),
};
