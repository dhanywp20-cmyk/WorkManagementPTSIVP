import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/register - pendaftaran akun mandiri, dikerjakan di server.
 *
 * KENAPA PINDAH KE SINI
 *
 * Sebelumnya form registrasi melakukan dua hal langsung dari peramban:
 * memeriksa apakah username sudah dipakai, lalu menulis baris users baru.
 * Keduanya menuntut tabel `users` terbuka untuk pengunjung yang belum login -
 * dan "terbuka" itu berlaku untuk SELURUH tabel, bukan hanya untuk pemeriksaan
 * satu username.
 *
 * Akibatnya, siapa pun yang memegang anon key (yang ikut terkirim ke peramban
 * setiap kali halaman dibuka) bisa membaca seluruh daftar 74 akun beserta nama
 * lengkap, username, dan nomor teleponnya. Username di platform ini adalah
 * pengenal login, jadi daftar itu sekaligus menyerahkan daftar sasaran yang
 * lengkap.
 *
 * Dengan pendaftaran dikerjakan di sini memakai service role, tabel `users`
 * tidak perlu terbuka lagi untuk pengunjung anonim.
 *
 * BATAS YANG DIJAGA DI SINI
 *
 * Route ini memang harus bisa dipanggil tanpa sesi. Karena itu akun yang
 * lahir darinya SELALU dipaksa berbentuk pendaftaran menunggu persetujuan:
 * role 'guest', team_type 'Pending Approval', tanpa satu pun menu. Nilai yang
 * dikirim peramban untuk ketiga hal itu diabaikan, tidak dipercaya.
 */

/** Umur minimum password. Sama dengan yang dijaga set-credential. */
const MIN_PASSWORD = 6;

function bersih(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const full_name = bersih(body.full_name);
    const username = bersih(body.username).toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    const sales_division = bersih(body.sales_division) || null;
    const jabatan = bersih(body.jabatan) || null;
    const phone_number = bersih(body.phone_number) || null;

    if (!full_name || !username) {
      return NextResponse.json({ error: 'Nama dan email wajib diisi.' }, { status: 400 });
    }
    if (password.length < MIN_PASSWORD) {
      return NextResponse.json(
        { error: `Password minimal ${MIN_PASSWORD} karakter.` }, { status: 400 },
      );
    }

    const supabase = getAdminClient();

    // Pemeriksaan ganda tetap di sini supaya pesannya bisa dibaca manusia.
    // Kolom username juga UNIQUE di database, jadi dua pendaftaran yang datang
    // bersamaan tetap tidak bisa lolos berdua - pemeriksaan ini kenyamanan,
    // bukan penjaga.
    const { data: sudahAda } = await supabase
      .from('users').select('id').eq('username', username).maybeSingle();
    if (sudahAda) {
      return NextResponse.json(
        { error: 'Email sudah terdaftar. Gunakan email lain.' }, { status: 409 },
      );
    }

    // role, team_type, dan allowed_menus TIDAK diambil dari permintaan.
    // Route ini terbuka tanpa sesi; menerima ketiganya dari peramban berarti
    // menyerahkan pembuatan akun admin kepada siapa pun.
    const { data: baru, error: galatUser } = await supabase
      .from('users')
      .insert([{
        full_name,
        username,
        role: 'guest',
        team_type: 'Pending Approval',
        sales_division,
        jabatan,
        phone_number,
        allowed_menus: [],
      }])
      .select('id')
      .single();

    if (galatUser || !baru) {
      // 23505 = pelanggaran UNIQUE. Terjadi bila dua pendaftaran dengan email
      // yang sama datang nyaris bersamaan dan lolos pemeriksaan di atas.
      const duplikat = (galatUser as { code?: string } | null)?.code === '23505';
      return NextResponse.json(
        { error: duplikat ? 'Email sudah terdaftar. Gunakan email lain.' : 'Pendaftaran gagal.' },
        { status: duplikat ? 409 : 500 },
      );
    }

    // Password di-hash di server. Peramban tidak pernah menyentuh tabel
    // kredensial, dan hash-nya tidak pernah melewati jaringan dalam bentuk apa pun.
    const hash = await bcrypt.hash(password, 12);
    const { error: galatKredensial } = await supabase
      .from('user_credentials')
      .insert({ user_id: baru.id, password_hash: hash, algorithm: 'bcrypt' });

    if (galatKredensial) {
      // Akun tanpa password tidak bisa dipakai masuk dan akan menyumbat daftar
      // persetujuan admin. Lebih baik dibatalkan sekalian daripada
      // meninggalkan baris setengah jadi yang tidak jelas asal-usulnya.
      await supabase.from('users').delete().eq('id', baru.id);
      return NextResponse.json({ error: 'Gagal menyimpan password.' }, { status: 500 });
    }

    // Kabari admin bahwa ada yang menunggu persetujuan.
    //
    // Ini pun pindah ke server. Versi lamanya dipanggil dari peramban SESUDAH
    // registrasi, jadi ia harus membaca tabel users tanpa token untuk mencari
    // siapa saja adminnya - persis pembacaan yang sedang ditutup. Dan karena
    // pemanggilnya membungkusnya dengan catch kosong, kegagalannya tidak akan
    // terlihat oleh siapa pun.
    try {
      const [{ data: admin }, { data: timPenuh }] = await Promise.all([
        supabase.from('users').select('id').in('role', ['admin', 'superadmin']),
        supabase.from('users').select('id').eq('role', 'team').eq('access_level', 'full'),
      ]);
      const tujuan = [...(admin ?? []), ...(timPenuh ?? [])] as { id: string }[];
      if (tujuan.length > 0) {
        await supabase.from('notifications').insert(tujuan.map(a => ({
          user_id: a.id,
          type: 'user',
          title: '👥 User baru menunggu approval',
          body: `${full_name} baru mendaftar dan menunggu aktivasi akun.`,
          // M16 (docs/UX-WORKFLOW-AUDIT.md): dulu mengarah ke '/dashboard' generik -
          // admin harus cari sendiri tab Admin Panel > User Management. "admin:<tab>"
          // dikenali khusus oleh handleNotifNavigate di app/dashboard/page.tsx.
          action_url: 'admin:userManagement',
          ref_id: baru.id,
          created_by: full_name,
          is_read: false,
          created_at: new Date().toISOString(),
        })));
      }
    } catch {
      // Akunnya sudah terbentuk dan tetap muncul di daftar menunggu persetujuan
      // di Admin Panel. Gagal mengabari bukan alasan menggagalkan pendaftaran.
    }

    return NextResponse.json({ success: true, id: baru.id });
  } catch {
    return NextResponse.json({ error: 'Pendaftaran gagal.' }, { status: 500 });
  }
}
