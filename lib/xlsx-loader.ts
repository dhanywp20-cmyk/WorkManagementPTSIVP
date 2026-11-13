export type PustakaXlsx = typeof import('xlsx-js-style');

export const URL_XLSX = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';

export function loadXLSX(onReady: (XLSX: PustakaXlsx) => void, onError?: () => void) {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { XLSX?: PustakaXlsx };
  if (w.XLSX) {
    onReady(w.XLSX);
    return;
  }
  const script = document.createElement('script');
  script.src = URL_XLSX;
  script.onload = () => { if (w.XLSX) onReady(w.XLSX); else onError?.(); };
  script.onerror = () => {
    if (onError) onError();
    else alert('Gagal memuat library Excel. Coba lagi atau periksa koneksi internet.');
  };
  document.head.appendChild(script);
}
