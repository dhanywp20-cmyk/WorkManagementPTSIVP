import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getAdminClient } from '@/lib/supabase-admin';
import { TIM_TERTUNDA } from '@/lib/akun-tertunda';
import { SARING_PENERIMA_ADMIN } from '@/lib/penerima-admin';
import {
  TABEL_KODE_ACARA, dariBaris, periksaKodeAcara,
  type PengaturanKodeAcara, type BarisKodeAcara,
} from '@/lib/kode-acara';

export const dynamic = 'force-dynamic';

const MIN_PASSWORD = 6;

const MENU_BYPASS = ['learning-center', 'reminder-schedule', 'ticket-troubleshooting', 'request-design-project', 'form-bast'];

async function teamTypeDariPilihan(
  supabase: ReturnType<typeof getAdminClient>, divisi: string, ptsType: string,
): Promise<string> {
  if (divisi === 'Marketing') return 'Marketing';
  if (divisi !== 'PTS' || !ptsType) return 'Guest';

  try {
    const { data } = await supabase.from('app_settings')
      .select('value').eq('key', 'kelompok').maybeSingle();
    const mentah = (data as { value?: unknown } | null)?.value;
    const isi = typeof mentah === 'string' ? JSON.parse(mentah) : mentah;
    if (Array.isArray(isi)) {
      const cocok = (isi as { nama?: unknown; label?: unknown }[])
        .find(k => typeof k?.label === 'string' && k.label === ptsType);
      if (cocok && typeof cocok.nama === 'string' && cocok.nama.trim()) return cocok.nama;
    }
  } catch {  }
  return 'Guest';
}

function bersih(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

async function bacaPengaturanKodeAcara(
  supabase: ReturnType<typeof getAdminClient>,
): Promise<PengaturanKodeAcara | null> {
  try {
    const { data } = await supabase.from(TABEL_KODE_ACARA)
      .select('aktif, kode, berlaku_sampai').maybeSingle();
    const tersimpan = dariBaris(data as BarisKodeAcara | null);
    if (tersimpan && tersimpan.kode) return tersimpan;
  } catch {  }

  const kode = (process.env.REGISTER_BYPASS_CODE || '').trim();
  if (!kode) return null;
  return {
    aktif: (process.env.REGISTER_BYPASS_ENABLED || '').trim() === 'true',
    kode,
    berlakuSampai: (process.env.REGISTER_BYPASS_UNTIL || '').trim() || null,
  };
}

function barisSetara(divisi: string, salesDivision: string | null) {
  const divisiBersih = (salesDivision ?? '').replace(/^Marketing:/, '').trim() || null;
  const untukSales = divisi === 'Sales' || divisi === 'Marketing';
  return {
    sales_division: untukSales ? divisiBersih : null,
    is_internal_sales:
      divisi === 'Marketing'
      || (divisi === 'Sales' && ['IVP', 'MVI', 'MLDS'].includes(divisiBersih ?? '')),
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

    const statusKode = periksaKodeAcara(event_code, await bacaPengaturanKodeAcara(supabase));
    if (statusKode === 'tidak_valid') {
      return NextResponse.json(
        { error: 'Kode acara tidak valid atau sudah kedaluwarsa. Kosongkan field ini jika tidak punya kode.' },
        { status: 400 },
      );
    }
    const bypass = statusKode === 'valid';

    const { data: sudahAda } = await supabase
      .from('users').select('id').eq('username', username).maybeSingle();
    if (sudahAda) {
      return NextResponse.json(
        { error: 'Email sudah terdaftar. Gunakan email lain.' }, { status: 409 },
      );
    }

    const { data: baru, error: galatUser } = await supabase
      .from('users')
      .insert([{
        full_name,
        username,
        role: 'guest',
        team_type: bypass ? await teamTypeDariPilihan(supabase, divisi, pts_type) : TIM_TERTUNDA,
        daftar_via_event: bypass,
        ...(bypass ? barisSetara(divisi, sales_division) : { sales_division }),
        jabatan,
        phone_number,
        allowed_menus: bypass ? MENU_BYPASS : [],
      }])
      .select('id')
      .single();

    if (galatUser || !baru) {
      const duplikat = (galatUser as { code?: string } | null)?.code === '23505';
      return NextResponse.json(
        { error: duplikat ? 'Email sudah terdaftar. Gunakan email lain.' : 'Pendaftaran gagal.' },
        { status: duplikat ? 409 : 500 },
      );
    }

    const hash = await bcrypt.hash(password, 12);
    const { error: galatKredensial } = await supabase
      .from('user_credentials')
      .insert({ user_id: baru.id, password_hash: hash, algorithm: 'bcrypt' });

    if (galatKredensial) {
      await supabase.from('users').delete().eq('id', baru.id);
      return NextResponse.json({ error: 'Gagal menyimpan password.' }, { status: 500 });
    }

    try {
      const { data: admin } = await supabase.from('users').select('id').or(SARING_PENERIMA_ADMIN);
      const tujuan = (admin ?? []) as { id: string }[];
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
          action_url: 'admin:userManagement',
          ref_id: baru.id,
          created_by: full_name,
          is_read: false,
          created_at: new Date().toISOString(),
        })));
      }
    } catch {
    }

    return NextResponse.json({ success: true, id: baru.id, bypass });
  } catch {
    return NextResponse.json({ error: 'Pendaftaran gagal.' }, { status: 500 });
  }
}
