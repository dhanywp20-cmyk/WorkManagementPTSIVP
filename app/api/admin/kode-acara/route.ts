import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { getSessionUser, isAdminRole } from '@/lib/server-auth';
import {
  TABEL_KODE_ACARA, rapikanKodeAcara, dariBaris,
  type PengaturanKodeAcara, type BarisKodeAcara,
} from '@/lib/kode-acara';

export const dynamic = 'force-dynamic';

/**
 * /api/admin/kode-acara - baca & simpan pengaturan pendaftaran lewat kode acara.
 *
 * KENAPA LEWAT ROUTE, BUKAN LANGSUNG DARI PERAMBAN seperti pengaturan lain
 * (kelompok, merek, lingkup manager)?
 *
 * Karena isinya rahasia. Kode acara adalah satu-satunya yang memisahkan
 * "peserta yang dikasih kode panitia" dari "siapa pun di internet": siapa yang
 * memegangnya bisa membuat akun aktif TANPA persetujuan admin. Kalau ia
 * disimpan di app_settings dengan kunci biasa, policy `as_baca` mengizinkan
 * anon membacanya - artinya kodenya bisa diambil siapa saja yang membuka
 * DevTools, dan gerbangnya tidak menjaga apa pun lagi.
 *
 * Basis data ini bahkan sudah memasang penjaga untuk itu: trigger
 * `tolak_rahasia_di_pengaturan` MENOLAK menyimpan kunci bernama rahasia di
 * app_settings. Jadi kodenya tinggal di tabelnya sendiri,
 * `pengaturan_kode_acara`, yang RLS-nya menyala tanpa satu pun policy dan hak
 * anon/authenticated-nya dicabut - peramban ditolak di lapisan basis data,
 * bukan cuma "tidak diminta" oleh kode ini. Route inilah satu-satunya pintunya,
 * dan ia memakai service-role setelah memastikan pemanggilnya memang admin.
 */

async function pastikanAdmin(request: NextRequest) {
  const caller = await getSessionUser(request);
  if (!caller) return { galat: NextResponse.json({ error: 'Sesi tidak valid. Login ulang.' }, { status: 401 }) };
  if (!isAdminRole(caller.role)) {
    return { galat: NextResponse.json({ error: 'Hanya admin yang boleh mengubah pengaturan ini.' }, { status: 403 }) };
  }
  return { caller };
}

export async function GET(request: NextRequest) {
  const { galat } = await pastikanAdmin(request);
  if (galat) return galat;

  const supabase = getAdminClient();
  const [{ data: baris }, { count }] = await Promise.all([
    supabase.from(TABEL_KODE_ACARA).select('aktif, kode, berlaku_sampai').maybeSingle(),
    //  Berapa akun yang sudah masuk lewat kode acara - dipakai layar admin
    //  untuk memberi tahu apakah gerbangnya benar-benar terpakai.
    supabase.from('users').select('id', { count: 'exact', head: true }).eq('daftar_via_event', true),
  ]);

  const pengaturan = dariBaris(baris as BarisKodeAcara | null);

  /*
    Kalau belum pernah disimpan lewat layar ini, tampilkan apa adanya dari
    variabel lingkungan yang lama - supaya admin melihat keadaan yang SEDANG
    BERLAKU, bukan formulir kosong yang seolah fiturnya belum pernah diatur.
    `dariEnv` memberi tahu layar untuk menjelaskan asalnya.
  */
  //  Aturan "belum pernah disimpan" harus SAMA PERSIS dengan yang dipakai
  //  /api/auth/register saat memutuskan jatuh ke env - kalau berbeda, layar ini
  //  akan menampilkan satu kode sementara pendaftaran memakai kode yang lain.
  //  Baris yang ada tapi kodenya kosong dihitung belum diatur di kedua tempat.
  const belumPernahDisimpan = pengaturan === null || pengaturan.kode === '';
  const hasil: PengaturanKodeAcara & { dariEnv: boolean; jumlahAkunEvent: number } = belumPernahDisimpan
    ? {
        aktif: (process.env.REGISTER_BYPASS_ENABLED || '').trim() === 'true',
        kode: (process.env.REGISTER_BYPASS_CODE || '').trim(),
        berlakuSampai: (process.env.REGISTER_BYPASS_UNTIL || '').trim() || null,
        dariEnv: true,
        jumlahAkunEvent: count ?? 0,
      }
    : { ...pengaturan, dariEnv: false, jumlahAkunEvent: count ?? 0 };

  return NextResponse.json(hasil);
}

export async function PUT(request: NextRequest) {
  const { galat, caller } = await pastikanAdmin(request);
  if (galat || !caller) return galat ?? NextResponse.json({ error: 'Sesi tidak valid.' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { body = null; }

  const bersih = rapikanKodeAcara(body);
  if (!bersih) return NextResponse.json({ error: 'Bentuk pengaturan tidak dikenali.' }, { status: 400 });

  //  Gerbang yang menyala tanpa kode = terbuka untuk semua orang. Ditolak di
  //  sini, bukan dibiarkan tersimpan lalu diam-diam meloloskan siapa pun.
  if (bersih.aktif && bersih.kode.length < 6) {
    return NextResponse.json(
      { error: 'Kode acara minimal 6 karakter saat pendaftaran kode acara dinyalakan.' },
      { status: 400 },
    );
  }
  if (bersih.berlakuSampai && Number.isNaN(new Date(bersih.berlakuSampai).getTime())) {
    return NextResponse.json({ error: 'Tanggal berlaku tidak valid.' }, { status: 400 });
  }

  const supabase = getAdminClient();
  const { error } = await supabase.from(TABEL_KODE_ACARA).upsert({
    //  id selalu true - tabelnya dibatasi satu baris (constraint satu_baris_saja),
    //  karena dua baris berarti dua kode berlaku bersamaan tanpa ada yang tahu
    //  mana yang menang.
    id: true,
    aktif: bersih.aktif,
    kode: bersih.kode,
    berlaku_sampai: bersih.berlakuSampai,
    diubah_pada: new Date().toISOString(),
    diubah_oleh: caller.id,
  }, { onConflict: 'id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, ...bersih });
}
