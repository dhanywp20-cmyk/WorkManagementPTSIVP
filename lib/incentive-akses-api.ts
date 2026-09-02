/**
 * lib/incentive-akses-api.ts - pemanggil /api/incentive/akses dari klien.
 *
 * Terpisah dari lib/incentive-akses.ts, yang sengaja dijaga MURNI (tanpa
 * fetch, tanpa Supabase) supaya aturannya bisa diimpor route server juga.
 * Berkas ini bagian klien-nya saja.
 */

import type { TingkatAkses } from './incentive-akses';

type Res = { error: { message: string } | null };

async function kirim(body: Record<string, unknown>): Promise<Res> {
  try {
    const res = await fetch('/api/incentive/akses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { error: { message: json.error || 'Gagal memproses.' } };
    return { error: null };
  } catch (e) {
    return { error: { message: (e as Error).message } };
  }
}

/** Setel tingkat akses seseorang di modul Incentive PTS. */
export function setAksesIncentive(userId: string, value: TingkatAkses): Promise<Res> {
  return kirim({ action: 'setAkses', userId, value });
}

/**
 * Tetapkan lingkup brand seorang petugas.
 *
 * null = tanpa batas (melihat semua brand). 'MVI' / 'IVP' = hanya brand itu;
 * proyek "Kedua Brand" tetap terlihat oleh keduanya karena memang milik
 * bersama.
 */
export function setBrandScopeIncentive(userId: string, value: string | null): Promise<Res> {
  return kirim({ action: 'setBrandScope', userId, value });
}
