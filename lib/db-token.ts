import crypto from 'crypto';

/**
 * lib/db-token.ts - penerbit JWT untuk PostgREST (server-only).
 *
 * Kenapa ada
 * Platform ini tidak memakai Supabase Auth; sesinya custom (bcrypt + tabel
 * user_sessions + cookie httpOnly). Akibatnya di dalam policy RLS,
 * auth.uid() selalu NULL - basis data tidak punya cara mengenali siapa yang
 * bertanya. Itu sebabnya semua policy yang ada terpaksa berbunyi USING (true).
 *
 * Token di sini menutup celah itu: login yang sudah berjalan di server
 * sekalian menerbitkan JWT bertanda tangan SUPABASE_JWT_SECRET, berisi
 * identitas user. PostgREST memverifikasinya, lalu policy bisa membaca
 * klaimnya dan menulis syarat sungguhan:
 *
 *     USING (sales_name = request.jwt.claims ->> 'username')
 *
 * Kenapa role-nya 'anon', bukan 'authenticated'
 * Ini keputusan yang paling menentukan di berkas ini, jadi ditulis eksplisit.
 *
 * Klaim `role` menetapkan role Postgres yang menjalankan query. Sebagian besar
 * policy yang sudah ada terpasang untuk role `anon` - dan beberapa tabel
 * (audit_trail, incentive_*, kpi_global_settings, notifications, project_*)
 * HANYA punya policy untuk `anon`, tanpa padanan `public`.
 *
 * Menerbitkan role 'authenticated' akan membuat query berjalan sebagai role
 * lain, sehingga policy `anon` itu tidak lagi berlaku dan tabel-tabel tersebut
 * langsung tertutup - aplikasi rusak seketika.
 *
 * Dengan role 'anon', perilaku hari ini TIDAK BERUBAH sama sekali. Yang
 * bertambah hanyalah klaim identitas yang kini tersedia di dalam policy. Itu
 * membuat pengetatan bisa dikerjakan bertahap per tabel, bukan sekali putus.
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
  };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = crypto.createHmac('sha256', SECRET).update(signingInput).digest();

  return `${signingInput}.${base64url(signature)}`;
}
