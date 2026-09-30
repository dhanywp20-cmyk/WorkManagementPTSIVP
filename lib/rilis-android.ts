/**
 * lib/rilis-android.ts - sisi peramban untuk rilis APK Android.
 * Sumber tunggalnya tabel rilis_android + bucket privat aplikasi-android,
 * diisi admin lewat Admin Panel -> Aplikasi Android (lihat /api/android).
 */
export type RilisAndroid = {
  id: string; versi: string; kode_versi: number; ukuran: number;
  catatan: string | null; wajib: boolean; diunggah_pada: string; tersedia: boolean;
};

export const URL_UNDUH_APK = '/api/android/unduh';

let janji: Promise<RilisAndroid | null> | null = null;

/** Rilis terbaru; satu permintaan per muat halaman (dipakai Profil & cek pembaruan). */
export function ambilRilisTerbaru(segarkan = false): Promise<RilisAndroid | null> {
  if (!janji || segarkan) {
    janji = fetch('/api/android', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => (j?.terbaru as RilisAndroid | null) ?? null)
      .catch(() => null);
  }
  return janji;
}

/**
 * Kode versi APK yang sedang menjalankan halaman ini, dari User-Agent
 * ("WorkManagementAndroid/1.0.1 (2)"). null = bukan di aplikasi Android.
 * APK v1.0.0 belum menulis kodenya -> dianggap 1.
 */
export function kodeVersiAplikasi(): number | null {
  if (typeof navigator === 'undefined') return null;
  const m = navigator.userAgent.match(/WorkManagementAndroid\/[^\s]+(?: \((\d+)\))?/);
  if (!m) return null;
  return m[1] ? Number(m[1]) : 1;
}

export function formatUkuran(b: number): string {
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export const formatTanggal = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
