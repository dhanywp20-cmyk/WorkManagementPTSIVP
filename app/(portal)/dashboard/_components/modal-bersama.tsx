'use client';
import React from 'react';
import { supabase } from '@/lib/supabase';

import { kirimNotifikasi } from '@/lib/notifikasi/router';
import { appLink } from '@/lib/app-url';
import { Ikon } from '@/components/shared/Ikon';

export type HasilSebar = { taraf: 'ok' | 'sebagian' | 'gagal'; pesan: string };

export async function propagateUserRename(
  edited: { id?: string; username?: string; full_name?: string },
  orig: { username?: string; full_name?: string } | null,
): Promise<HasilSebar> {
  const beres: HasilSebar = { taraf: 'ok', pesan: '' };
  if (!orig || !edited.id) return beres;
  const nameChanged = (orig.full_name ?? '') !== (edited.full_name ?? '');
  const userChanged = (orig.username ?? '') !== (edited.username ?? '');
  if (!nameChanged && !userChanged) return beres;

  const { data, error } = await supabase.rpc('propagate_user_rename', {
    p_user_id: edited.id,
    p_old_username: (orig.username ?? null) as string,
    p_new_username: (edited.username ?? null) as string,
    p_old_name: (orig.full_name ?? null) as string,
    p_new_name: (edited.full_name ?? null) as string,
  });
  if (error) return { taraf: 'gagal', pesan: error.message };

  const gagal = (data as { _gagal?: { kolom: string }[] } | null)?._gagal;
  if (gagal && gagal.length > 0) {
    return { taraf: 'sebagian', pesan: gagal.map(g => g.kolom).join(', ') };
  }
  return beres;
}

export function pesanSebar(h: HasilSebar): string {
  if (h.taraf === 'ok')       return 'Akun diperbarui & nama tersebar ke data terkait.';
  if (h.taraf === 'sebagian') return `Akun diperbarui. Nama tersebar, kecuali di: ${h.pesan}.`;
  return `Akun tersimpan, tapi sebar nama ke data terkait gagal: ${h.pesan}`;
}

export function sendWelcomeWA(phone: string | null | undefined, fullName: string, username: string, password: string) {
  if (!phone) return;
  const msg =
    `🎉 *Akun Baru — PTS Portal*\n\n` +
    `Halo *${fullName}*, akun kamu sudah dibuat oleh Admin:\n\n` +
    `👤 Username: ${username}\n` +
    `🔑 Password: ${password}\n\n` +
    `Silakan login & segera ganti password kamu.\n` +
    `🔗 ${appLink()}`;
  void kirimNotifikasi({
    event: 'system.account_created',
    whatsapp: { penerima: [{ nama: fullName, telepon: phone }], pesan: msg },
  });
}

export function maskPhone(phone?: string): string {
  if (!phone || phone.length < 6) return '••••';
  return phone.slice(0, 4) + '••••' + phone.slice(-3);
}

export const KOLOM_PROFIL_DASAR =
  'id,username,full_name,role,team_type,phone_number,sales_division,jabatan,allowed_menus,kpi_enabled,divisi,pts_type';

export async function ambilProfil(id: string) {
  const lengkap = await supabase.from('users')
    .select(`${KOLOM_PROFIL_DASAR},created_at,access_level,telegram_terhubung`).eq('id', id).single();
  if (!lengkap.error) return lengkap;
  return await supabase.from('users').select(KOLOM_PROFIL_DASAR).eq('id', id).single();
}

export function Kartu({ icon, judul, hitung, children }: {
  icon: string; judul: string; hitung?: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
      <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100 bg-slate-50/60">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
          <span className="text-sm"><Ikon nama={icon} ukuran={14} /></span> {judul}
        </p>
        {hitung && (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-500">
            {hitung}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

export function Baris({ icon, label, value, children }: {
  icon: string; label: string; value?: string; children?: React.ReactNode;
}) {
  return (
    <div className="px-4 py-2.5 flex items-center justify-between gap-4">
      <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2 shrink-0">
        <span className="w-4 text-center text-slate-400"><Ikon nama={icon} ukuran={14} /></span> {label}
      </span>
      <div className="min-w-0 text-right">
        {children ?? <span className="text-sm font-semibold text-slate-800 truncate">{value || '—'}</span>}
      </div>
    </div>
  );
}

export function Kelompok({ label, kosong, orang, warna }: {
  label: string; kosong: string; warna: string;
  orang: { full_name: string; jabatan?: string | null; sales_division?: string | null; phone_number?: string | null }[];
}) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: warna }}>{label}</p>
      {orang.length === 0 ? (
        <p className="text-xs text-slate-500 italic">{kosong}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {orang.map((o, i) => (
            <span key={`${o.full_name}-${i}`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-50 border border-slate-200 text-slate-700">
              {o.full_name}
              {o.jabatan && <span className="text-slate-500 font-normal">· {o.jabatan}</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function StripInfo({ icon, judul, keterangan, angka, satuan }: {
  icon: string; judul: string; keterangan: React.ReactNode;
  angka?: number | string; satuan?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs mb-4">
      <div className="text-2xl shrink-0"><Ikon nama={icon} ukuran={24} /></div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{judul}</p>
        <p className="text-xs text-slate-500 mt-0.5 leading-snug">{keterangan}</p>
      </div>
      {angka !== undefined && (
        <div className="text-right shrink-0 pl-2">
          <p className="text-xl font-black text-slate-800 leading-none">{angka}</p>
          {satuan && <p className="text-[11px] text-slate-500 mt-1">{satuan}</p>}
        </div>
      )}
    </div>
  );
}
