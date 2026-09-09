import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const MIN_PASSWORD = 6;

/** team_type khusus untuk akun hasil bypass - sengaja beda dari 'Pending
 *  Approval' (supaya lolos gerbang login) dan gampang difilter/diaudit admin
 *  di Admin Panel > User Management. */
const BYPASS_TEAM_TYPE = 'Learning Center - Bypass Event';

function bersih(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Menentukan apakah pendaftaran ini berhak lolos tanpa approval admin. */
function bypassAktif(kodeDikirim: string): boolean {
  const kodeRahasia = (process.env.REGISTER_BYPASS_CODE || '').trim();
  const saklarNyala = (process.env.REGISTER_BYPASS_ENABLED || '').trim() === 'true';
  if (!saklarNyala || !kodeRahasia || !kodeDikirim) return false;
  if (kodeDikirim !== kodeRahasia) return false;

  const batasWaktu = process.env.REGISTER_BYPASS_UNTIL;
  if (batasWaktu) {
    const batas = new Date(batasWaktu);
    if (!Number.isNaN(batas.getTime()) && new Date() > batas) return false;
  }
  return true;
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
    const event_code = bersih(body.event_code);
    const bypass = bypassAktif(event_code);

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
    // menyerahkan pembuatan akun admin kepada siapa pun. Ini berlaku juga
    // untuk jalur bypass: yang berubah cuma team_type & allowed_menus, role
    // tetap dipaksa 'guest' apa pun hasil bypassAktif().
    const { data: baru, error: galatUser } = await supabase
      .from('users')
      .insert([{
        full_name,
        username,
        role: 'guest',
        team_type: bypass ? BYPASS_TEAM_TYPE : 'Pending Approval',
        sales_division,
        jabatan,
        phone_number,
        allowed_menus: bypass ? ['learning-center'] : [],
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
          title: bypass
            ? '🎓 Akun event LC auto-aktif (bypass)'
            : '👥 User baru menunggu approval',
          body: bypass
            ? `${full_name} mendaftar lewat kode event dan langsung aktif (akses: Learning Center saja). Tidak perlu approval, ini info saja.`
            : `${full_name} baru mendaftar dan menunggu aktivasi akun.`,
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

    return NextResponse.json({ success: true, id: baru.id, bypass });
  } catch {
    return NextResponse.json({ error: 'Pendaftaran gagal.' }, { status: 500 });
  }
}
