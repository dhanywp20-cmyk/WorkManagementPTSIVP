/**
 * lib/incentive-nominal-api.ts - pemanggil /api/incentive/nominal dari klien.
 *
 * Terpisah dari lib/incentive-nominal.ts yang sengaja murni (dipakai route
 * server juga). Berkas ini bagian peramban saja.
 */
import { tempelkanNominal, type AturanNominal } from './incentive-nominal';

export interface HasilPetaNominal {
  peta: Record<string, number>;
  /** Pemanggil pemegang akses input/penuh (boleh memproses tahapan). */
  terbuka: boolean;
  aturan: AturanNominal | null;
  error: { message: string } | null;
}

let sedangDiambil: Promise<HasilPetaNominal> | null = null;

/**
 * Ambil peta nominal. Pemanggilan yang bersamaan (daftar proyek + jadwal
 * tahapan dimuat sekaligus) berbagi SATU permintaan; begitu selesai, panggilan
 * berikutnya mengambil ulang - nominal baru disimpan harus langsung terbaca.
 */
export function ambilPetaNominal(): Promise<HasilPetaNominal> {
  if (sedangDiambil) return sedangDiambil;
  const p = (async (): Promise<HasilPetaNominal> => {
    try {
      const res = await fetch('/api/incentive/nominal', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { peta: {}, terbuka: false, aturan: null, error: { message: json.error || 'Gagal memuat nominal incentive.' } };
      }
      return { peta: json.data ?? {}, terbuka: !!json.terbuka, aturan: json.aturan ?? null, error: null };
    } catch (e) {
      return { peta: {}, terbuka: false, aturan: null, error: { message: (e as Error).message } };
    }
  })().finally(() => { sedangDiambil = null; });
  sedangDiambil = p;
  return p;
}

/** Tempelkan nominal terkini ke baris proyek (menimpa `incentive_value`). */
export async function lengkapiNominal<T extends { id: string; incentive_value?: number | null }>(baris: T[]): Promise<T[]> {
  if (baris.length === 0) return baris;
  const { peta } = await ambilPetaNominal();
  return tempelkanNominal(baris, peta);
}

/** Simpan nominal satu proyek (server menuliskannya ke seluruh baris sebatch). */
export async function simpanNominal(reminderId: string, nominal: number): Promise<{ error: { message: string } | null }> {
  try {
    const res = await fetch('/api/incentive/nominal', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reminderId, nominal }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { error: { message: json.error || 'Gagal menyimpan nominal.' } };
    return { error: null };
  } catch (e) {
    return { error: { message: (e as Error).message } };
  }
}

/** Ubah siapa yang boleh melihat nominal proyek (konfigurasi penuh). */
export async function simpanAturanNominal(aturan: AturanNominal): Promise<{ error: { message: string } | null }> {
  try {
    const res = await fetch('/api/incentive/nominal', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(aturan),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { error: { message: json.error || 'Gagal menyimpan aturan.' } };
    return { error: null };
  } catch (e) {
    return { error: { message: (e as Error).message } };
  }
}
