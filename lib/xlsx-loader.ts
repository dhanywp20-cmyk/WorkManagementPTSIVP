/**
 * Loader XLSX dari CDN. Pola yang dipakai di Picket Showroom & Ticketing.
 * Memuat library XLSX (SheetJS) jika belum ada di window, lalu memanggil callback.
 */
/**
 * SheetJS 0.20.3 dari CDN resmi SheetJS. Versi 0.18.5 (cdnjs / npm) rentan prototype pollution &
 * ReDoS saat membaca berkas Excel dari luar, dan perbaikannya hanya terbit di CDN SheetJS.
 */
export const URL_XLSX = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';

export function loadXLSX(onReady: (XLSX: any) => void, onError?: () => void) {
  if (typeof window === 'undefined') return;
  if ((window as any).XLSX) {
    onReady((window as any).XLSX);
    return;
  }
  const script = document.createElement('script');
  script.src = URL_XLSX;
  script.onload = () => onReady((window as any).XLSX);
  script.onerror = () => {
    if (onError) onError();
    else alert('Gagal memuat library Excel. Coba lagi atau periksa koneksi internet.');
  };
  document.head.appendChild(script);
}
