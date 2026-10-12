/** Aturan murni Tech Note: domain OneDrive yang sah & kategori folder. */
export const DOMAIN_ONEDRIVE = /(^|\.)(1drv\.ms|onedrive\.live\.com|onedrive\.com|sharepoint\.com)$/i;

export function linkOneDriveSah(u: string): boolean {
  try { const x = new URL(u.trim()); return x.protocol === 'https:' && DOMAIN_ONEDRIVE.test(x.hostname); } catch { return false; }
}

/**
 * Kategori folder Tech Note - emoji MENGIKUTI kategori, bukan dipilih bebas.
 *
 * Dulu emoji-nya kotak teks bebas. Hasilnya menyimpang pelan-pelan: folder
 * yang isinya sama-sama layar bisa berikon , , atau apa pun yang kebetulan
 * dipilih saat itu - jadi ikonnya berhenti berarti apa-apa. Dengan diikatkan
 * ke kategori, satu pandangan ke sidebar sudah cukup untuk tahu jenis isinya.
 */
export const KATEGORI_FOLDER = [
  { value: 'display',    icon: '🖥️', label: 'Display',    desc: 'Panel, videowall, LED, LCD' },
  { value: 'middleware', icon: '🎛️', label: 'Middleware', desc: 'Perangkat controller & processor' },
  { value: 'software',   icon: '💿', label: 'Software',   desc: 'Aplikasi, CMS, lisensi' },
] as const;

export type KategoriFolder = (typeof KATEGORI_FOLDER)[number]['value'];
