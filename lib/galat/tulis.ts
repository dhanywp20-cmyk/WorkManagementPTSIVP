
export const NAMA_EVENT_GALAT_TULIS = 'galat-tulis';

export interface GalatTulis { tabel: string; pesan: string }

const KODE_DITANGANI = new Set(['PGRST204', '42703', '23505']);

export function tabelPenulisan(metode: string | undefined, url: string): string | null {
  if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes((metode ?? 'GET').toUpperCase())) return null;
  const cocok = /\/rest\/v1\/([^/?#]+)/.exec(url);
  if (!cocok || cocok[1] === 'rpc') return null;
  return decodeURIComponent(cocok[1]);
}

export function pesanGalatTulis(status: number, isi: { code?: string; message?: string } | null): string | null {
  if (status < 400) return null;
  if (isi?.code && KODE_DITANGANI.has(isi.code)) return null;
  if (status === 401 || status === 403 || isi?.code === '42501') return 'Tidak punya izin menyimpan perubahan ini. Coba muat ulang halaman atau masuk lagi.';
  if (isi?.code === '23503') return 'Data yang dirujuk sudah tidak ada (mungkin baru dihapus orang lain). Muat ulang halaman lalu coba lagi.';
  if (isi?.code === '23502' || isi?.code === '22P02' || isi?.code === '23514') return 'Isian tidak lengkap atau formatnya tidak sah, perubahan tidak tersimpan.';
  if (status >= 500) return 'Server sedang bermasalah, perubahan belum tersimpan. Coba lagi sebentar lagi.';
  return 'Perubahan tidak tersimpan' + (isi?.message ? `: ${isi.message}` : '.');
}

export function umumkanGalatTulis(galat: GalatTulis): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<GalatTulis>(NAMA_EVENT_GALAT_TULIS, { detail: galat }));
}

export async function periksaJawabanTulis(metode: string | undefined, url: string, jawaban: Response | null): Promise<void> {
  try {
    const tabel = tabelPenulisan(metode, url);
    if (!tabel) return;
    if (!jawaban) { umumkanGalatTulis({ tabel, pesan: 'Koneksi terputus, perubahan belum tersimpan. Periksa internet lalu coba lagi.' }); return; }
    if (jawaban.ok) return;
    let isi: { code?: string; message?: string } | null = null;
    try { isi = await jawaban.clone().json(); } catch {  }
    const pesan = pesanGalatTulis(jawaban.status, isi);
    if (pesan) umumkanGalatTulis({ tabel, pesan });
  } catch {  }
}
