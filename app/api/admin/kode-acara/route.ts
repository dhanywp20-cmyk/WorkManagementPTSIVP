import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { getSessionUser, isAdminRole } from '@/lib/server-auth';
import {
  TABEL_KODE_ACARA, rapikanKodeAcara, dariBaris,
  type PengaturanKodeAcara, type BarisKodeAcara,
} from '@/lib/kode-acara';

export const dynamic = 'force-dynamic';

export interface AkunEvent {
  id: string;
  full_name: string | null;
  username: string | null;
  sales_division: string | null;
  team_type: string | null;
  jabatan: string | null;
  created_at: string | null;
}

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
  const [{ data: baris }, { data: akunEvent }] = await Promise.all([
    supabase.from(TABEL_KODE_ACARA).select('aktif, kode, berlaku_sampai').maybeSingle(),
    supabase.from('users')
      .select('id, full_name, username, sales_division, team_type, jabatan, created_at')
      .eq('daftar_via_event', true)
      .order('created_at', { ascending: false }),
  ]);

  const pengaturan = dariBaris(baris as BarisKodeAcara | null);

  const belumPernahDisimpan = pengaturan === null || pengaturan.kode === '';
  const daftarAkun = (akunEvent ?? []) as AkunEvent[];
  const hasil: PengaturanKodeAcara & {
    dariEnv: boolean; jumlahAkunEvent: number; daftarAkun: AkunEvent[];
  } = belumPernahDisimpan
    ? {
        aktif: (process.env.REGISTER_BYPASS_ENABLED || '').trim() === 'true',
        kode: (process.env.REGISTER_BYPASS_CODE || '').trim(),
        berlakuSampai: (process.env.REGISTER_BYPASS_UNTIL || '').trim() || null,
        dariEnv: true,
        jumlahAkunEvent: daftarAkun.length,
        daftarAkun,
      }
    : { ...pengaturan, dariEnv: false, jumlahAkunEvent: daftarAkun.length, daftarAkun };

  return NextResponse.json(hasil);
}

export async function PUT(request: NextRequest) {
  const { galat, caller } = await pastikanAdmin(request);
  if (galat || !caller) return galat ?? NextResponse.json({ error: 'Sesi tidak valid.' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { body = null; }

  const bersih = rapikanKodeAcara(body);
  if (!bersih) return NextResponse.json({ error: 'Bentuk pengaturan tidak dikenali.' }, { status: 400 });

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
