/**
 * lib/totp.ts - verifikasi dua langkah (2FA) berbasis TOTP, RFC 6238 (sama dengan Google
 * Authenticator, Microsoft Authenticator, Authy). Murni Node (crypto) - hanya dipakai di server.
 *
 * - Rahasia 20 byte acak, dikodekan Base32 (RFC 4648) untuk aplikasi authenticator.
 * - Kode 6 digit, periode 30 detik, HMAC-SHA1; toleransi ±1 periode untuk jam HP yang meleset.
 * - Rahasia DISIMPAN TERENKRIPSI (AES-256-GCM, kunci diturunkan dari SUPABASE_JWT_SECRET): isi
 *   tabel user_credentials yang bocor saja tidak cukup untuk membuat kode.
 * - Kode cadangan sekali pakai, disimpan sebagai hash SHA-256.
 */
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

const ABJAD = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bit = 0, nilai = 0, out = '';
  for (const b of buf) {
    nilai = (nilai << 8) | b; bit += 8;
    while (bit >= 5) { out += ABJAD[(nilai >>> (bit - 5)) & 31]; bit -= 5; }
  }
  if (bit > 0) out += ABJAD[(nilai << (5 - bit)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const bersih = s.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bit = 0, nilai = 0; const out: number[] = [];
  for (const c of bersih) {
    nilai = (nilai << 5) | ABJAD.indexOf(c); bit += 5;
    if (bit >= 8) { out.push((nilai >>> (bit - 8)) & 255); bit -= 8; }
  }
  return Buffer.from(out);
}

export function buatRahasia(): string {
  return base32Encode(randomBytes(20));
}

/** Kode TOTP untuk satu langkah waktu (RFC 4226 dynamic truncation). */
export function kodeHotp(rahasia: Buffer, langkah: number, digit = 6, algo: 'sha1' | 'sha256' | 'sha512' = 'sha1'): string {
  const pesan = Buffer.alloc(8);
  pesan.writeUInt32BE(Math.floor(langkah / 2 ** 32), 0);
  pesan.writeUInt32BE(langkah >>> 0, 4);
  const h = createHmac(algo, rahasia).update(pesan).digest();
  const o = h[h.length - 1] & 0x0f;
  const angka = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(angka % 10 ** digit).padStart(digit, '0');
}

export function kodeTotp(rahasiaBase32: string, waktuMs = Date.now()): string {
  return kodeHotp(base32Decode(rahasiaBase32), Math.floor(waktuMs / 30_000));
}

/**
 * Cocokkan kode masukan (toleransi ±1 periode). Mengembalikan langkah waktu yang cocok, atau null.
 * Pemanggil menyimpan langkah terakhir yang dipakai agar kode yang sama tidak bisa dipakai ulang.
 */
export function cocokTotp(rahasiaBase32: string, kode: string, waktuMs = Date.now(), langkahTerakhir = -1): number | null {
  const k = (kode || '').replace(/\D/g, '');
  if (k.length !== 6) return null;
  const kunci = base32Decode(rahasiaBase32);
  const sekarang = Math.floor(waktuMs / 30_000);
  for (const geser of [0, -1, 1]) {
    const langkah = sekarang + geser;
    if (langkah <= langkahTerakhir) continue;
    const harus = Buffer.from(kodeHotp(kunci, langkah));
    if (timingSafeEqual(harus, Buffer.from(k))) return langkah;
  }
  return null;
}

/** URL otpauth:// untuk QR yang dipindai aplikasi authenticator. */
export function urlOtpauth(rahasiaBase32: string, akun: string, penerbit: string): string {
  const label = encodeURIComponent(`${penerbit}:${akun}`);
  return `otpauth://totp/${label}?secret=${rahasiaBase32}&issuer=${encodeURIComponent(penerbit)}&algorithm=SHA1&digits=6&period=30`;
}

// ── Penyimpanan terenkripsi ─────────────────────────────────────────────────

function kunciEnkripsi(): Buffer {
  const sumber = process.env.SUPABASE_JWT_SECRET;
  if (!sumber) throw new Error('SUPABASE_JWT_SECRET belum diisi - 2FA tidak bisa dipakai.');
  return createHash('sha256').update(`totp-2fa:${sumber}`).digest();
}

export function enkripsiRahasia(rahasiaBase32: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', kunciEnkripsi(), iv);
  const isi = Buffer.concat([c.update(rahasiaBase32, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), isi.toString('base64')].join('.');
}

export function dekripsiRahasia(tersimpan: string): string {
  const [v, iv, tag, isi] = tersimpan.split('.');
  if (v !== 'v1' || !iv || !tag || !isi) throw new Error('Format rahasia 2FA tidak dikenal.');
  const d = createDecipheriv('aes-256-gcm', kunciEnkripsi(), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(isi, 'base64')), d.final()]).toString('utf8');
}

// ── Kode cadangan ───────────────────────────────────────────────────────────

const hashCadangan = (k: string) => createHash('sha256').update(k.replace(/[^A-Z0-9]/gi, '').toUpperCase()).digest('hex');

/** 8 kode cadangan `XXXX-XXXX` (sekali pakai). Kembalikan teks untuk ditunjukkan SEKALI + hash untuk disimpan. */
export function buatKodeCadangan(jumlah = 8): { teks: string[]; hash: string[] } {
  const huruf = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // tanpa O/0/I/1 yang mudah tertukar
  const teks = Array.from({ length: jumlah }, () => {
    const b = randomBytes(8);
    const s = Array.from(b, x => huruf[x % huruf.length]).join('');
    return `${s.slice(0, 4)}-${s.slice(4)}`;
  });
  return { teks, hash: teks.map(hashCadangan) };
}

/** Indeks kode cadangan yang cocok (untuk dibuang setelah dipakai), atau -1. */
export function cocokKodeCadangan(masukan: string, daftarHash: string[] | null | undefined): number {
  const h = hashCadangan(masukan || '');
  return (daftarHash ?? []).findIndex(x => x === h);
}
