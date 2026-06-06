/**
 * Loader XLSX dari CDN. Pola yang dipakai di Picket Showroom & Ticketing.
 * Memuat library XLSX (SheetJS) jika belum ada di window, lalu memanggil callback.
 */
export function loadXLSX(onReady: (XLSX: any) => void, onError?: () => void) {
  if (typeof window === 'undefined') return;
  if ((window as any).XLSX) {
    onReady((window as any).XLSX);
    return;
  }
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  script.onload = () => onReady((window as any).XLSX);
  script.onerror = () => {
    if (onError) onError();
    else alert('Gagal memuat library Excel. Coba lagi atau periksa koneksi internet.');
  };
  document.head.appendChild(script);
}
