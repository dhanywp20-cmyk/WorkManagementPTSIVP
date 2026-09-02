'use client';
import React from 'react';
import { supabase } from '@/lib/supabase';

import { kirimNotifikasi } from '@/lib/notifikasi/router';

/**
 * Sebar perubahan nama/username user ke semua snapshot di tabel terkait, lewat
 * SQL function propagate_user_rename. Tiga hasil yang berbeda artinya bagi
 * admin: ok (semua tabel terbarui), sebagian (fungsi SQL menangkap galat per
 * tabel lalu lanjut), gagal (RPC-nya sendiri gagal, tidak ada yang tersebar).
 * Akun sendiri sudah tersimpan sebelum fungsi ini dipanggil.
 */
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
    p_old_username: orig.username ?? null,
    p_new_username: edited.username ?? null,
    p_old_name: orig.full_name ?? null,
    p_new_name: edited.full_name ?? null,
  });
  if (error) return { taraf: 'gagal', pesan: error.message };

  const gagal = (data as { _gagal?: { kolom: string }[] } | null)?._gagal;
  if (gagal && gagal.length > 0) {
    return { taraf: 'sebagian', pesan: gagal.map(g => g.kolom).join(', ') };
  }
  return beres;
}

/** Kalimat yang ditampilkan ke admin untuk tiap hasil penyebaran. */
export function pesanSebar(h: HasilSebar): string {
  if (h.taraf === 'ok')       return 'Akun diperbarui & nama tersebar ke data terkait.';
  if (h.taraf === 'sebagian') return `Akun diperbarui. Nama tersebar, kecuali di: ${h.pesan}.`;
  return `Akun tersimpan, tapi sebar nama ke data terkait gagal: ${h.pesan}`;
}

/**
 * WA selamat datang saat akun baru dibuat - dipakai kedua handleAddUser di
 * bawah (list lama & baru). Fire-and-forget, tidak boleh menggagalkan alur
 * create-akun.
 *
 * TITIK PERTAMA yang dipindah ke notification engine (lib/notifikasi) - lihat
 * komentar panjang di lib/notifikasi/router.ts untuk kenapa 47 titik WA
 * lainnya BELUM ikut dipindah. Ini dipilih sebagai bukti pola karena kecil,
 * berdiri sendiri, dan pesannya mudah dibandingkan sebelum/sesudah - bukan
 * karena paling penting.
 *
 * Isi pesan PERSIS SAMA dengan sebelum dipindah - hanya jalur pengirimannya
 * yang berubah, dari sendWANotif() langsung menjadi lewat router yang sama
 * dengan event lain.
 */
export function sendWelcomeWA(phone: string | null | undefined, fullName: string, username: string, password: string) {
  if (!phone) return;
  const msg =
    `🎉 *Akun Baru — PTS Portal*\n\n` +
    `Halo *${fullName}*, akun kamu sudah dibuat oleh Admin:\n\n` +
    `👤 Username: ${username}\n` +
    `🔑 Password: ${password}\n\n` +
    `Silakan login & segera ganti password kamu.\n` +
    `🔗 https://work-management-ptsivp.vercel.app/dashboard`;
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

/**
 * Ambil profil user, dengan jalur mundur bila created_at / access_level belum
 * ada di basis data. PostgREST menolak SELURUH query kalau satu kolom saja tak
 * dikenal, jadi tanpa jalur mundur satu kolom yang hilang mengosongkan seluruh
 * halaman Profil.
 */
export async function ambilProfil(id: string) {
  const lengkap = await supabase.from('users')
    .select(`${KOLOM_PROFIL_DASAR},created_at,access_level,telegram_chat_id`).eq('id', id).single();
  if (!lengkap.error) return lengkap;
  return await supabase.from('users').select(KOLOM_PROFIL_DASAR).eq('id', id).single();
}

/**
 * Kartu bersection-header - bentuk dasar tampilan Profil.
 *
 * Dibuat satu kali lalu dipakai berulang, bukan disalin per bagian: enam
 * bagian dengan markup kartu yang disalin manual sudah cukup untuk membuat
 * pembatas, padding, dan tebal border-nya pelan-pelan berbeda satu sama lain.
 */
export function Kartu({ icon, judul, hitung, children }: {
  icon: string; judul: string; hitung?: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100 bg-slate-50/60">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
          <span className="text-sm">{icon}</span> {judul}
        </p>
        {hitung && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-500">
            {hitung}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

/** Satu baris "label di kiri, nilai di kanan". */
export function Baris({ icon, label, value, children }: {
  icon: string; label: string; value?: string; children?: React.ReactNode;
}) {
  return (
    <div className="px-4 py-2.5 flex items-center justify-between gap-4">
      <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2 flex-shrink-0">
        <span className="w-4 text-center text-slate-300">{icon}</span> {label}
      </span>
      <div className="min-w-0 text-right">
        {children ?? <span className="text-sm font-semibold text-slate-800 truncate">{value || '—'}</span>}
      </div>
    </div>
  );
}

/** Kelompok orang pada Struktur Organisasi (atasan / IVP / bawahan). */
export function Kelompok({ label, kosong, orang, warna }: {
  label: string; kosong: string; warna: string;
  orang: { full_name: string; jabatan?: string; sales_division?: string; phone_number?: string }[];
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: warna }}>{label}</p>
      {orang.length === 0 ? (
        <p className="text-xs text-slate-300 italic">{kosong}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {orang.map((o, i) => (
            <span key={`${o.full_name}-${i}`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-50 border border-slate-200 text-slate-700">
              {o.full_name}
              {o.jabatan && <span className="text-slate-400 font-normal">· {o.jabatan}</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Inline variants (no fixed overlay, used inside AdminPanelModal)

/**
 * Strip info di puncak tiap bagian Admin Panel. Satu bentuk untuk semua bagian,
 * mengikuti bahasa visual halaman Profil: netral, dengan angka penting di
 * kanan. Warna per bagian membuat berpindah tab terasa berpindah aplikasi.
 */
export function StripInfo({ icon, judul, keterangan, angka, satuan }: {
  icon: string; judul: string; keterangan: React.ReactNode;
  angka?: number | string; satuan?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm mb-4">
      <div className="text-2xl flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{judul}</p>
        <p className="text-xs text-slate-500 mt-0.5 leading-snug">{keterangan}</p>
      </div>
      {angka !== undefined && (
        <div className="text-right flex-shrink-0 pl-2">
          <p className="text-xl font-black text-slate-800 leading-none">{angka}</p>
          {satuan && <p className="text-[10px] text-slate-400 mt-1">{satuan}</p>}
        </div>
      )}
    </div>
  );
}
