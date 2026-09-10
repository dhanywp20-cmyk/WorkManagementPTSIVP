import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getAdminClient } from '@/lib/supabase-admin';
import {
  TABEL_KODE_ACARA, dariBaris, periksaKodeAcara,
  type PengaturanKodeAcara, type BarisKodeAcara,
} from '@/lib/kode-acara';

export const dynamic = 'force-dynamic';

const MIN_PASSWORD = 6;

/** Menu yang didapat akun hasil pendaftaran lewat kode acara. */
const MENU_BYPASS = ['learning-center', 'reminder-schedule', 'ticket-troubleshooting', 'request-design-project', 'form-bast'];

/**
 * team_type untuk akun hasil kode acara.
 *
 * DULU kolom ini dipakai sebagai penanda bypass ('Learning Center - Bypass
 * Event'). Akibatnya divisi/tim yang DIPILIH pendaftar ikut tertimpa dan tidak
 * pernah terpasang: akun bypass memang tidak pernah melewati approval admin -
 * langkah yang biasanya mengisi team_type - jadi tidak ada satu pun titik yang
 * memperbaikinya belakangan. Yang terlihat oleh admin: akun yang divisinya
 * seolah tidak tersimpan.
 *
 * Sekarang penandanya punya kolom sendiri (users.daftar_via_event), dan
 * team_type diisi nilai sungguhan sesuai pilihan pendaftar - memakai konvensi
 * yang sama dengan akun yang disetujui manual.
 */
async function teamTypeDariPilihan(
  supabase: ReturnType<typeof getAdminClient>, divisi: string, ptsType: string,
): Promise<string> {
  if (divisi === 'Marketing') return 'Marketing';
  if (divisi !== 'PTS' || !ptsType) return 'Guest';

  /*
    Label PTS ('PTS IVP') dipetakan ke team_type ('Team PTS IVP') dengan
    membaca app_settings.kelompok - SUMBER YANG SAMA dengan yang dipakai
    formulirnya, jadi kelompok yang baru ditambahkan admin langsung ikut
    tanpa deploy.

    Dibaca di sini lewat SQL, bukan dengan mengimpor lib/kelompok.ts: modul itu
    modul klien (memakai hook React dan klien Supabase peramban) dan cache-nya
    diisi ASINKRON di peramban - di server cache itu selalu kosong, jadi
    hasilnya akan selalu null tanpa satu pun pesan galat.

    Pilihan yang tidak dikenal jatuh ke 'Guest': akun tetap bisa masuk dan
    tetap terdata, tinggal dirapikan admin - lebih baik daripada menolak
    pendaftaran peserta acara di depan mejanya.
  */
  try {
    const { data } = await supabase.from('app_settings')
      .select('value').eq('key', 'kelompok').maybeSingle();
    const mentah = (data as { value?: unknown } | null)?.value;
    //  Nilainya disimpan sebagai STRING JSON (jsonb berisi string), jadi perlu
    //  satu lapis parse lagi sebelum jadi larik.
    const isi = typeof mentah === 'string' ? JSON.parse(mentah) : mentah;
    if (Array.isArray(isi)) {
      const cocok = (isi as { nama?: unknown; label?: unknown }[])
        .find(k => typeof k?.label === 'string' && k.label === ptsType);
      if (cocok && typeof cocok.nama === 'string' && cocok.nama.trim()) return cocok.nama;
    }
  } catch { /* pengaturan belum ada/rusak - jatuh ke bawaan */ }
  return 'Guest';
}

function bersih(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Pengaturan kode acara - dari Admin Panel, dengan variabel lingkungan sebagai
 * cadangan.
 *
 * Dulu satu-satunya sumbernya REGISTER_BYPASS_* di Vercel, jadi membuka
 * pendaftaran untuk satu acara berarti menyunting variabel lingkungan lalu
 * menunggu deploy ulang - dan menutupnya kembali sesudah acara menuntut hal
 * yang sama sekali lagi. Sekarang admin mengaturnya dari layar, berlaku
 * seketika.
 *
 * Variabel lingkungannya SENGAJA tetap dibaca sebagai cadangan: pemasangan
 * yang sudah terlanjur memakainya tidak boleh mendadak menolak kode yang
 * sedang dipakai peserta hanya karena kode ini naik ke produksi. Begitu admin
 * menyimpan sekali lewat layar, nilai di basis data yang dipakai dan env
 * diabaikan.
 */
async function bacaPengaturanKodeAcara(
  supabase: ReturnType<typeof getAdminClient>,
): Promise<PengaturanKodeAcara | null> {
  try {
    const { data } = await supabase.from(TABEL_KODE_ACARA)
      .select('aktif, kode, berlaku_sampai').maybeSingle();
    const tersimpan = dariBaris(data as BarisKodeAcara | null);
    //  Baris ada tapi kodenya kosong = admin belum pernah mengisinya lewat
    //  layar; itu bukan "pengaturan tersimpan", jadi tetap jatuh ke env.
    if (tersimpan && tersimpan.kode) return tersimpan;
  } catch { /* pengaturan belum ada - jatuh ke env di bawah */ }

  const kode = (process.env.REGISTER_BYPASS_CODE || '').trim();
  if (!kode) return null;
  return {
    aktif: (process.env.REGISTER_BYPASS_ENABLED || '').trim() === 'true',
    kode,
    berlakuSampai: (process.env.REGISTER_BYPASS_UNTIL || '').trim() || null,
  };
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
    //  Dipakai HANYA untuk menyusun team_type di jalur kode acara. role tetap
    //  tidak pernah diambil dari permintaan - lihat catatan di bawah.
    const divisi = bersih(body.divisi);
    const pts_type = bersih(body.pts_type);

    if (!full_name || !username) {
      return NextResponse.json({ error: 'Nama dan email wajib diisi.' }, { status: 400 });
    }
    if (password.length < MIN_PASSWORD) {
      return NextResponse.json(
        { error: `Password minimal ${MIN_PASSWORD} karakter.` }, { status: 400 },
      );
    }

    const supabase = getAdminClient();

    // Kode acara diisi tapi salah/kedaluwarsa/fitur lagi nonaktif -> tolak di
    // sini dengan pesan jelas. Jangan biarkan lolos ke pendaftaran normal
    // seolah-olah field-nya memang dikosongkan.
    const statusKode = periksaKodeAcara(event_code, await bacaPengaturanKodeAcara(supabase));
    if (statusKode === 'tidak_valid') {
      return NextResponse.json(
        { error: 'Kode acara tidak valid atau sudah kedaluwarsa. Kosongkan field ini jika tidak punya kode.' },
        { status: 400 },
      );
    }
    const bypass = statusKode === 'valid';

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
        team_type: bypass ? await teamTypeDariPilihan(supabase, divisi, pts_type) : 'Pending Approval',
        //  Penanda akun acara ada di kolomnya sendiri, bukan menumpang
        //  team_type - lihat teamTypeDariPilihan di atas.
        daftar_via_event: bypass,
        sales_division,
        jabatan,
        phone_number,
        allowed_menus: bypass ? MENU_BYPASS : [],
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
            ? `${full_name} mendaftar lewat kode event dan langsung aktif (divisi: ${sales_division ?? '-'}). Tidak perlu approval, ini info saja.`
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
