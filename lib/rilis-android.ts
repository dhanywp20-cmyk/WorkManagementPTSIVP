export type RilisAndroid = {
  id: string; versi: string; kode_versi: number; ukuran: number;
  catatan: string | null; wajib: boolean; diunggah_pada: string; tersedia: boolean;
};

export const URL_UNDUH_APK = '/api/android/unduh';

let janji: Promise<RilisAndroid | null> | null = null;

export function ambilRilisTerbaru(segarkan = false): Promise<RilisAndroid | null> {
  if (!janji || segarkan) {
    janji = fetch('/api/android', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => (j?.terbaru as RilisAndroid | null) ?? null)
      .catch(() => null);
  }
  return janji;
}

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
