/**
 * lib/rahasia-server.ts - membaca token integrasi. HANYA untuk sisi server.
 *
 * Jangan pernah mengimpor berkas ini dari komponen 'use client'. Ia memakai
 * getAdminClient() (service_role) dan nilai yang dikembalikannya adalah token
 * mentah; ikut ter-bundle ke peramban berarti membocorkannya ke setiap
 * pengunjung.
 *
 * URUTAN SUMBER, dan alasannya:
 *
 *   1. tabel rahasia_integrasi - yang diatur admin dari Admin Panel.
 *   2. variabel lingkungan - cadangan.
 *
 * Basis data didahulukan supaya perubahan dari Admin Panel berlaku SEKETIKA,
 * tanpa deploy ulang - itu justru inti dari memindahkannya ke sana. Variabel
 * lingkungan tetap dibaca sebagai cadangan supaya pemasangan yang sudah ada
 * (FONNTE_TOKEN di Edge Function, token di Vercel) tidak mendadak berhenti
 * bekerja pada detik berkas ini ter-deploy sementara tabelnya masih kosong.
 */

import { getAdminClient } from '@/lib/supabase-admin';

const CADANGAN_ENV: Record<string, string | undefined> = {
  'whatsapp.token':     process.env.FONNTE_TOKEN,
  'telegram.bot_token': process.env.TELEGRAM_BOT_TOKEN,
};

/**
 * Umur cache pendek saja. Tanpa cache, setiap pengiriman notifikasi menambah
 * satu query; dengan cache panjang, token yang baru diganti admin masih
 * dipakai lama sesudahnya. 30 detik menutup lonjakan pengiriman beruntun
 * tanpa membuat pergantian token terasa tidak berlaku.
 */
const UMUR_MS = 30_000;
const cache = new Map<string, { nilai: string | null; sampai: number }>();

export async function bacaRahasia(kunci: string): Promise<string | null> {
  const kini = Date.now();
  const tersimpan = cache.get(kunci);
  if (tersimpan && tersimpan.sampai > kini) return tersimpan.nilai;

  let nilai: string | null = null;
  try {
    const db = getAdminClient();
    const { data } = await db.from('rahasia_integrasi').select('nilai').eq('kunci', kunci).maybeSingle();
    if (data?.nilai) nilai = data.nilai as string;
  } catch {
    //  Tabelnya mungkin belum dibuat (sql/rahasia-integrasi.sql belum jalan).
    //  Itu bukan galat yang perlu meledak - cadangan env di bawah yang dipakai.
  }
  if (!nilai) nilai = CADANGAN_ENV[kunci] ?? null;

  cache.set(kunci, { nilai, sampai: kini + UMUR_MS });
  return nilai;
}

/** Dipanggil sesudah admin menyimpan token baru, supaya berlaku seketika. */
export function lupakanRahasia(kunci?: string): void {
  if (kunci) cache.delete(kunci); else cache.clear();
}
