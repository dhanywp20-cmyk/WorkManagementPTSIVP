export const DOMAIN_ONEDRIVE = /(^|\.)(1drv\.ms|onedrive\.live\.com|onedrive\.com|sharepoint\.com)$/i;

export function linkOneDriveSah(u: string): boolean {
  try { const x = new URL(u.trim()); return x.protocol === 'https:' && DOMAIN_ONEDRIVE.test(x.hostname); } catch { return false; }
}

export const KATEGORI_FOLDER = [
  { value: 'display',    icon: '🖥️', label: 'Display',    desc: 'Panel, videowall, LED, LCD' },
  { value: 'middleware', icon: '🎛️', label: 'Middleware', desc: 'Perangkat controller & processor' },
  { value: 'software',   icon: '💿', label: 'Software',   desc: 'Aplikasi, CMS, lisensi' },
] as const;

export type KategoriFolder = (typeof KATEGORI_FOLDER)[number]['value'];
