import crypto from 'crypto';

/**
 * lib/db-token.ts - penerbit JWT untuk PostgREST (server-only).
 *
 * Platform ini tidak memakai Supabase Auth; sesinya custom (bcrypt + tabel
 * user_sessions + cookie httpOnly), jadi auth.uid() di dalam policy RLS selalu
 * NULL dan policy terpaksa berbunyi USING (true). Login menerbitkan JWT
 * bertanda tangan SUPABASE_JWT_SECRET berisi identitas user; PostgREST
 * memverifikasinya dan policy bisa menulis syarat sungguhan:
 *
 *     USING (sales_name = request.jwt.claims ->> 'username')
 *
 * Klaim `role` sengaja 'anon', bukan 'authenticated'. Klaim itu menetapkan
 * role Postgres yang menjalankan query, dan beberapa tabel (audit_trail,
 * incentive_*, kpi_global_settings, notifications, project_*) HANYA punya
 * policy untuk `anon`. Menerbitkan role lain membuat tabel-tabel itu tertutup
 * seketika. JANGAN diubah tanpa memindahkan policy-nya lebih dulu.
 */

const SECRET = process.env.SUPABASE_JWT_SECRET ?? '';

/** Umur token disamakan dengan umur sesi (6 jam) agar keduanya kedaluwarsa bersamaan. */
const TOKEN_HOURS = 6;

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export interface DbTokenUser {
  id: string;
  username: string;
  full_name?: string | null;
  role?: string | null;
  sales_division?: string | null;
  /**
   * Toggle "Full Access" (lib/constants.ts hasFullAccess). WAJIB ikut di
   * sini - kolom ini dibaca dari DB oleh route login/session, tapi payload
   * di bawah dulu TIDAK MENYERTAKANNYA sama sekali. Akibatnya setiap
   * kebijakan RLS yang memeriksa `jwt_claim('access_level')` (mis.
   * boleh_hapus_reminder()) selalu membaca string kosong - cabang Full
   * Access-nya MATI TOTAL, terlepas dari apa yang disetel admin di Kelola
   * Akun. Reminder Schedule kebetulan tetap jalan untuk satu orang karena
   * ada jalur cadangan yang memeriksa ID tertunjuk secara manual
   * (app_settings.manager_user_id) - itu menutupi masalahnya, bukan
   * memperbaikinya. Modul lain (Ticketing, Design Project) tidak punya
   * jalur cadangan itu, jadi tombol Hapus tampil tapi diam-diam tidak
   * pernah benar-benar menghapus untuk siapa pun selain admin.
   */
  access_level?: string | null;
}

/**
 * Terbitkan JWT HS256 untuk dipakai klien saat memanggil PostgREST.
 *
 * Mengembalikan null bila SUPABASE_JWT_SECRET belum diset - dalam keadaan itu
 * aplikasi tetap berjalan persis seperti sebelumnya (klien memakai anon key
 * polos). Penerbitan token sengaja TIDAK boleh menggagalkan login.
 */
export function issueDbToken(user: DbTokenUser): string | null {
  if (!SECRET) return null;

  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + TOKEN_HOURS * 3600;

  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    // Klaim standar yang dibaca PostgREST / Supabase.
    sub:  user.id,
    role: 'anon',            // lihat catatan panjang di atas - JANGAN diubah
    aud:  'authenticated',
    iat,
    exp,
    // Klaim identitas yang akan dipakai policy RLS.
    username:       user.username,
    user_role:      user.role ?? '',
    full_name:      user.full_name ?? '',
    sales_division: user.sales_division ?? '',
    access_level:   user.access_level ?? '',
  };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = crypto.createHmac('sha256', SECRET).update(signingInput).digest();

  return `${signingInput}.${base64url(signature)}`;
}
