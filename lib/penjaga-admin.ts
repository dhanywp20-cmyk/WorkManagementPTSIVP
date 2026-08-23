/**
 * lib/penjaga-admin.ts - memastikan pemanggil sebuah route server benar-benar
 * admin, DI SISI SERVER.
 *
 * Kenapa ada berkas ini
 *
 * Menyembunyikan tombol Admin Panel dari peramban TIDAK membuat sesuatu jadi
 * aman: yang disembunyikan cuma menunya. Siapa pun bisa memanggil route-nya
 * langsung dengan curl. Karena itu setiap route yang menyentuh rahasia
 * memanggil pastikanAdmin() lebih dulu, dan keputusannya diambil dari cookie
 * sesi yang diverifikasi ke tabel user_sessions - bukan dari apa pun yang
 * dikirim peramban tentang dirinya sendiri.
 *
 * Perannya dibaca ulang dari tabel users setiap kali, bukan dari klaim token,
 * supaya pencabutan hak admin berlaku seketika dan tidak menunggu tokennya
 * kedaluwarsa.
 */

import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { getAdminClient } from '@/lib/supabase-admin';

export interface Pemanggil {
  id: string;
  username: string;
  full_name: string;
  role: string;
}

export type HasilPenjaga =
  | { ok: true; user: Pemanggil }
  | { ok: false; status: 401 | 403; alasan: string };

/** Peran yang boleh menyentuh pengaturan sistem. */
const PERAN_ADMIN = ['admin', 'superadmin'];

/**
 * Memastikan pemanggilnya orang yang sudah masuk - siapa pun perannya.
 *
 * Dipakai route yang boleh dijalankan pengguna biasa tapi tidak boleh terbuka
 * ke publik, mis. pengiriman notifikasi WhatsApp: seluruh tim memicunya lewat
 * pekerjaan sehari-hari, tapi tanpa penjaga ini ia jadi alat kirim WA gratis
 * bagi siapa pun yang menemukan alamatnya.
 */
export async function pastikanMasuk(req: NextRequest): Promise<HasilPenjaga> {
  const token = req.cookies.get('ivp_session')?.value;
  if (!token) return { ok: false, status: 401, alasan: 'Belum masuk.' };

  const db = getAdminClient();
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const { data: sesi } = await db
    .from('user_sessions')
    .select('user_id, expires_at')
    .eq('token_hash', tokenHash)
    .single();

  if (!sesi) return { ok: false, status: 401, alasan: 'Sesi tidak dikenal.' };
  if (new Date(sesi.expires_at) < new Date()) {
    return { ok: false, status: 401, alasan: 'Sesi kedaluwarsa.' };
  }

  const { data: user } = await db
    .from('users')
    .select('id, username, full_name, role')
    .eq('id', sesi.user_id)
    .single();

  if (!user) return { ok: false, status: 401, alasan: 'Akun tidak ditemukan.' };
  return { ok: true, user: user as Pemanggil };
}

export async function pastikanAdmin(req: NextRequest): Promise<HasilPenjaga> {
  //  Perannya diperiksa SESUDAH sesinya, dan dibaca ulang dari tabel users -
  //  bukan dari klaim token - supaya pencabutan hak admin berlaku seketika.
  const masuk = await pastikanMasuk(req);
  if (!masuk.ok) return masuk;

  if (!PERAN_ADMIN.includes((masuk.user.role ?? '').toLowerCase())) {
    return { ok: false, status: 403, alasan: 'Hanya admin yang boleh mengubah pengaturan ini.' };
  }
  return masuk;
}
