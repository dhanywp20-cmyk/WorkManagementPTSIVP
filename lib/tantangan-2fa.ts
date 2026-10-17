/**
 * lib/tantangan-2fa.ts - tiket sementara antara "password benar" dan "kode 2FA benar".
 *
 * Sesudah password lolos, server belum membuat sesi; ia memberi tiket bertanda tangan HMAC
 * (kunci diturunkan dari SUPABASE_JWT_SECRET) yang hanya berlaku 5 menit dan hanya bisa dipakai
 * di /api/auth/login-2fa. Tiket tidak berisi rahasia - hanya id pengguna, tahap & kedaluwarsa.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

export type Tahap2FA = 'kode_2fa' | 'daftar_2fa';

export interface IsiTantangan { uid: string; tahap: Tahap2FA; exp: number }

export const MASA_TANTANGAN_MS = 5 * 60 * 1000;

function kunci(): Buffer {
  const sumber = process.env.SUPABASE_JWT_SECRET;
  if (!sumber) throw new Error('SUPABASE_JWT_SECRET belum diisi - 2FA tidak bisa dipakai.');
  return createHash('sha256').update(`tantangan-2fa:${sumber}`).digest();
}

const b64u = (b: Buffer) => b.toString('base64url');

export function buatTantangan(uid: string, tahap: Tahap2FA, sekarang = Date.now()): string {
  const isi: IsiTantangan & { n: string } = { uid, tahap, exp: sekarang + MASA_TANTANGAN_MS, n: b64u(randomBytes(6)) };
  const badan = b64u(Buffer.from(JSON.stringify(isi)));
  return `${badan}.${b64u(createHmac('sha256', kunci()).update(badan).digest())}`;
}

/** Isi tiket bila tanda tangan sah & belum kedaluwarsa, selain itu null. */
export function bacaTantangan(tiket: string | undefined | null, sekarang = Date.now()): IsiTantangan | null {
  if (!tiket || typeof tiket !== 'string' || tiket.length > 600) return null;
  const [badan, ttd] = tiket.split('.');
  if (!badan || !ttd) return null;
  const harus = createHmac('sha256', kunci()).update(badan).digest();
  const dapat = Buffer.from(ttd, 'base64url');
  if (dapat.length !== harus.length || !timingSafeEqual(dapat, harus)) return null;
  try {
    const isi = JSON.parse(Buffer.from(badan, 'base64url').toString('utf8')) as IsiTantangan;
    if (typeof isi.uid !== 'string' || (isi.tahap !== 'kode_2fa' && isi.tahap !== 'daftar_2fa')) return null;
    if (typeof isi.exp !== 'number' || isi.exp < sekarang) return null;
    return { uid: isi.uid, tahap: isi.tahap, exp: isi.exp };
  } catch { return null; }
}
