/**
 * lib/lapor-galat.ts - kirim galat di layar pengguna ke /api/galat (klien saja).
 *
 * Diam & murah: tiap galat yang sama hanya dikirim sekali per muat halaman, paling banyak
 * BATAS_PER_HALAMAN laporan, lewat sendBeacon (tidak menunda apa pun, tetap terkirim walau
 * halamannya sedang ditutup). Gagal mengirim tidak pernah menimbulkan galat baru.
 */
import { BATAS_PER_HALAMAN, abaikanGalat, rapikanLaporan, type LaporanGalat } from './galat-klien';

const terkirim = new Set<string>();

export function laporGalat(l: LaporanGalat, berkasSkrip?: string): void {
  try {
    if (typeof window === 'undefined') return;
    if (abaikanGalat(l.pesan, berkasSkrip, window.location.origin)) return;
    if (terkirim.size >= BATAS_PER_HALAMAN) return;
    const r = rapikanLaporan({ ...l, jalur: l.jalur ?? window.location.pathname });
    const kunci = `${r.sumber}|${r.pesan}|${r.jalur}`;
    if (terkirim.has(kunci)) return;
    terkirim.add(kunci);
    const isi = JSON.stringify(r);
    if (navigator.sendBeacon?.('/api/galat', new Blob([isi], { type: 'application/json' }))) return;
    void fetch('/api/galat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: isi, keepalive: true }).catch(() => {});
  } catch { /* pelapor tidak boleh menjadi sumber galat */ }
}
