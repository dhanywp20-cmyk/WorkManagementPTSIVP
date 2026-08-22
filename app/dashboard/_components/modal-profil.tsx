'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { setSession } from '@/lib/auth';

import { User, JabatanType, JABATAN_CONFIG, ALL_MENU_KEYS, ALL_MENU_LABELS, ROLE_BADGE } from './shared';
import { ModalPortal, formatUsername } from '@/components/shared';

import { ambilProfil, Kartu, Baris, Kelompok } from './modal-bersama';

// UserProfileModal

interface UserProfileModalProps {
  currentUser: User;
  onClose: () => void;
}

export function UserProfileModal({ currentUser, onClose }: UserProfileModalProps) {
  const [userData, setUserData] = useState<User>(currentUser);
  const [editPhone, setEditPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState(currentUser.phone_number || '');
  const [editPassword, setEditPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [cariIzin, setCariIzin] = useState('');
  const [supervisors, setSupervisors] = useState<{ full_name: string; phone_number?: string; sales_division?: string; jabatan?: string }[]>([]);
  const [subordinates, setSubordinates] = useState<{ full_name: string; username: string; sales_division?: string; jabatan?: string }[]>([]);

  const notify = (type: 'success' | 'error', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 3500);
  };

  useEffect(() => {
    (async () => {
      const { data } = await ambilProfil(currentUser.id);
      if (data) { setUserData(data); setPhoneInput(data.phone_number || ''); }

      const userDiv = currentUser.sales_division;
      const selfTier = currentUser.jabatan ? (JABATAN_CONFIG[currentUser.jabatan as JabatanType]?.tier ?? 0) : 0;

      if (userDiv) {
        const { data: supMaps } = await supabase.from('division_supervisor_mappings').select('supervisor_id').eq('sales_division', userDiv);
        if (supMaps && supMaps.length > 0) {
          const ids = supMaps.map((s: any) => s.supervisor_id).filter((id: string) => id !== currentUser.id); // exclude self
          if (ids.length > 0) {
            const { data: sups } = await supabase.from('users').select('full_name, phone_number, sales_division, jabatan').in('id', ids);
            // Only show users with HIGHER tier (true atasan)
            const filtered = (sups ?? []).filter((s: any) => {
              const tier = s.jabatan ? (JABATAN_CONFIG[s.jabatan as JabatanType]?.tier ?? 0) : 0;
              return tier > selfTier;
            });
            if (filtered.length) setSupervisors(filtered);
          }
        }
        const { data: ivpMaps } = await supabase.from('division_ivp_mappings').select('ivp_id').eq('sales_division', userDiv);
        if (ivpMaps && ivpMaps.length > 0) {
          const ivpIds = ivpMaps.map((s: any) => s.ivp_id);
          const { data: ivps } = await supabase.from('users').select('full_name, phone_number, sales_division, jabatan').in('id', ivpIds);
          if (ivps) setSupervisors(prev => [...prev, ...ivps.map((iv: any) => ({ ...iv, _isIVP: true }))]);
        }
      }

      if (currentUser.jabatan && ['Supervisor', 'Manager', 'Deputy General Manager', 'General Manager', 'Direktur'].includes(currentUser.jabatan)) {
        const { data: divMaps } = await supabase.from('division_supervisor_mappings').select('sales_division').eq('supervisor_id', currentUser.id);
        if (divMaps && divMaps.length > 0) {
          const divs = divMaps.map((m: any) => m.sales_division);
          const { data: subUsers } = await supabase.from('users').select('full_name, username, sales_division, jabatan').in('sales_division', divs).eq('role', 'guest').neq('sales_division', 'IVP').neq('id', currentUser.id);
          // Only show users with LOWER tier (true bawahan), exclude self
          const filtered = (subUsers ?? []).filter((u: any) => {
            if (u.username === currentUser.username) return false; // exclude self
            const tier = u.jabatan ? (JABATAN_CONFIG[u.jabatan as JabatanType]?.tier ?? 0) : 0;
            return tier < selfTier;
          });
          if (filtered.length) setSubordinates(filtered);
        }
      }
    })();
  }, []);

  const handleSavePhone = async () => {
    setSaving(true);
    const { error } = await supabase.from('users').update({ phone_number: phoneInput.trim() }).eq('id', currentUser.id);
    if (error) { notify('error', 'Gagal menyimpan nomor telepon.'); }
    else {
      notify('success', 'Nomor WhatsApp berhasil diperbarui!');
      setEditPhone(false);
      const { data } = await ambilProfil(currentUser.id);
      if (data) { setUserData(data); setSession(data); }
    }
    setSaving(false);
  };

  const getPasswordStrength = (pwd: string): { score: number; label: string; color: string } => {
    if (!pwd) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 1) return { score, label: 'Lemah', color: 'bg-red-400' };
    if (score <= 2) return { score, label: 'Cukup', color: 'bg-amber-400' };
    if (score <= 3) return { score, label: 'Baik', color: 'bg-yellow-400' };
    return { score, label: 'Kuat', color: 'bg-emerald-500' };
  };

  const handleSavePassword = async () => {
    if (!passwordInput || passwordInput.length < 8) { notify('error', 'Password minimal 8 karakter.'); return; }
    if (!/[A-Z]/.test(passwordInput)) { notify('error', 'Password harus mengandung minimal 1 huruf kapital.'); return; }
    if (!/[0-9]/.test(passwordInput)) { notify('error', 'Password harus mengandung minimal 1 angka.'); return; }
    if (passwordInput !== confirmPassword) { notify('error', 'Konfirmasi password tidak cocok.'); return; }
    setSaving(true);
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id, newPassword: passwordInput }),
    });
    const result = await res.json();
    if (!res.ok) { notify('error', result.error || 'Gagal mengubah password.'); }
    else { notify('success', 'Password berhasil diubah!'); setEditPassword(false); setPasswordInput(''); setConfirmPassword(''); }
    setSaving(false);
  };

  const roleClass = ROLE_BADGE[userData.role?.toLowerCase()] || 'bg-slate-100 text-slate-700 border-slate-200';
  const initials = userData.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const jabatanCfg = userData.jabatan ? JABATAN_CONFIG[userData.jabatan as JabatanType] : null;

  const sortedSupervisors = [...supervisors].sort((a, b) => {
    const ta = a.jabatan ? (JABATAN_CONFIG[a.jabatan as JabatanType]?.tier ?? 0) : 0;
    const tb = b.jabatan ? (JABATAN_CONFIG[b.jabatan as JabatanType]?.tier ?? 0) : 0;
    return tb - ta;
  });
  const sortedSubordinates = [...subordinates].sort((a, b) => {
    const ta = a.jabatan ? (JABATAN_CONFIG[a.jabatan as JabatanType]?.tier ?? 0) : 0;
    const tb = b.jabatan ? (JABATAN_CONFIG[b.jabatan as JabatanType]?.tier ?? 0) : 0;
    return tb - ta;
  });

  // Nilai turunan untuk tampilan
  const salam = (() => {
    const j = new Date().getHours();
    if (j < 11) return 'Selamat Pagi';
    if (j < 15) return 'Selamat Siang';
    if (j < 19) return 'Selamat Sore';
    return 'Selamat Malam';
  })();

  // Admin & superadmin melewati allowed_menus sepenuhnya, jadi daftarnya
  // dianggap penuh - kalau tidak, profil mereka justru terbaca paling sedikit
  // aksesnya, kebalikan dari kenyataannya.
  const menuAktif = ['admin', 'superadmin'].includes((userData.role ?? '').toLowerCase())
    ? ALL_MENU_KEYS
    : (userData.allowed_menus ?? []);

  const menuTersaring = menuAktif.filter(k => {
    const q = cariIzin.trim().toLowerCase();
    if (!q) return true;
    return `${k} ${ALL_MENU_LABELS[k]?.label ?? ''}`.toLowerCase().includes(q);
  });

  const bergabung = (userData as { created_at?: string }).created_at
    ? new Date((userData as { created_at?: string }).created_at as string)
        .toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—';

  const atasanList = sortedSupervisors.filter((s: any) => !s._isIVP);
  const ivpList = sortedSupervisors.filter((s: any) => s._isIVP);

  return (
  <ModalPortal>
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-5xl h-full max-h-full flex flex-col overflow-hidden border border-slate-200">

        {/* ── HERO ──
            Menyapa lalu langsung menyebut identitas, bukan judul generik
            "User Profile". Judul semacam itu hanya mengulang apa yang sudah
            jelas dari cara halamannya dibuka — ruangnya lebih berguna dipakai
            menampilkan siapa pemilik akun ini. */}
        <div className="flex-shrink-0 px-6 py-5 relative overflow-hidden"
          style={{ background: 'linear-gradient(120deg,#be123c,#9f1239 55%,#881337)' }}>
          <button aria-label="Tutup" onClick={onClose}
            className="absolute top-4 right-4 bg-white/15 hover:bg-white/25 text-white p-2 rounded-lg transition-all z-10">
            <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <div className="flex flex-wrap items-end justify-between gap-4 pr-10">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-rose-200/90 mb-1.5">
                {salam} · <span className="text-white/70 normal-case tracking-normal font-medium">{formatUsername(userData.username)}</span>
              </p>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight truncate">
                {userData.full_name}
              </h2>
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                {jabatanCfg && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white/15 text-white backdrop-blur">
                    {jabatanCfg.icon} {userData.jabatan}
                  </span>
                )}
                {jabatanCfg && (userData.team_type || userData.sales_division) && (
                  <span className="text-white/40 text-xs">›</span>
                )}
                {(userData.team_type || userData.sales_division) && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white/15 text-white backdrop-blur">
                    {userData.team_type || userData.sales_division}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2.5 flex-shrink-0">
              <div className="rounded-xl px-4 py-2.5 text-center min-w-[76px]" style={{ background: 'rgba(0,0,0,0.22)' }}>
                <p className="text-2xl font-black text-white leading-none">{menuAktif.length}</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-rose-200/80 mt-1">Modul</p>
              </div>
              <div className="rounded-xl px-4 py-2.5 text-center min-w-[76px]" style={{ background: 'rgba(250,204,21,0.9)' }}>
                <p className="text-sm font-black text-amber-900 leading-none pt-1.5 truncate">{userData.role}</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-amber-900/70 mt-1.5">Peran</p>
              </div>
            </div>
          </div>
        </div>

        {notification && (
          <div className={`mx-5 mt-4 px-4 py-3 rounded-lg text-sm font-semibold flex items-center gap-2 flex-shrink-0 ${notification.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {notification.type === 'success' ? '✅' : '❌'} {notification.msg}
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* ══ KIRI ══ */}
            <div className="lg:col-span-2 space-y-4">

              <Kartu icon="👤" judul="Informasi Pribadi & Kontak">
                <div className="divide-y divide-slate-100">
                  <Baris icon="#"  label="Username / NIK"  value={formatUsername(userData.username)} />
                  <Baris icon="👤" label="Nama Lengkap"    value={userData.full_name} />
                  <Baris icon="📱" label="No. Telepon / WA">
                    {editPhone ? (
                      <div className="flex items-center gap-2">
                        <input value={phoneInput} onChange={e => setPhoneInput(e.target.value)}
                          placeholder="08xxxxxxxxxx"
                          className="w-40 rounded-lg border border-slate-300 px-2.5 py-1 text-sm outline-none focus:ring-2 focus:ring-rose-200" />
                        <button onClick={handleSavePhone} disabled={saving}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-40">Simpan</button>
                        <button onClick={() => { setEditPhone(false); setPhoneInput(userData.phone_number || ''); }}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 text-xs font-bold">Batal</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className={userData.phone_number ? 'text-slate-800 font-semibold text-sm' : 'text-slate-300 text-sm'}>
                          {userData.phone_number || 'Belum diisi'}
                        </span>
                        <button onClick={() => setEditPhone(true)}
                          className="text-[11px] text-rose-600 font-bold hover:underline">Ubah</button>
                      </div>
                    )}
                  </Baris>
                  <Baris icon="🏢" label="Divisi / Team" value={userData.team_type || userData.sales_division || '—'} />
                  <Baris icon="⭐" label="Jabatan"       value={userData.jabatan || '—'} />
                  <Baris icon="📅" label="Bergabung Sejak" value={bergabung} />
                  <Baris icon="🔑" label="Status Akun">
                    <span className="inline-flex items-center gap-1.5 text-emerald-600 font-bold text-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Aktif
                    </span>
                  </Baris>
                </div>
              </Kartu>

              <Kartu icon="🗂️" judul="Struktur Organisasi">
                <div className="p-4 space-y-3">
                  <Kelompok label={`Atasan${userData.sales_division ? ' · ' + userData.sales_division : ''}`} kosong="Belum ada atasan terdaftar" orang={atasanList} warna="#b45309" />
                  <Kelompok label="Sales Internal (IVP)" kosong="Belum ada Sales Internal terpetakan" orang={ivpList} warna="#0369a1" />
                  <Kelompok label="Bawahan" kosong="Belum ada bawahan terdaftar" orang={sortedSubordinates} warna="#4d7c0f" />
                </div>
              </Kartu>

              <Kartu icon="🛡️" judul="Keamanan & Sandi">
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Sesi Saat Ini</span>
                    <span className="inline-flex items-center gap-1.5 text-emerald-600 font-bold text-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Online &amp; Terotentikasi
                    </span>
                  </div>
                  {editPassword ? (
                    <div className="space-y-2 pt-1">
                      <input type="password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)}
                        placeholder="Password baru (min. 8 karakter, 1 kapital, 1 angka)"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200" />
                      {passwordInput && (() => {
                        const { score, label, color } = getPasswordStrength(passwordInput);
                        return (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div className={`h-full ${color} transition-all`} style={{ width: `${(score / 5) * 100}%` }} />
                            </div>
                            <span className="text-[11px] font-bold text-slate-500">{label}</span>
                          </div>
                        );
                      })()}
                      <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Ulangi password baru"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200" />
                      {confirmPassword && passwordInput !== confirmPassword && (
                        <p className="text-[11px] text-red-500 font-semibold">Password tidak cocok</p>
                      )}
                      <div className="flex gap-2">
                        <button onClick={handleSavePassword} disabled={saving}
                          className="px-3 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-lg disabled:opacity-40">Simpan Password</button>
                        <button onClick={() => { setEditPassword(false); setPasswordInput(''); setConfirmPassword(''); }}
                          className="px-3 py-1.5 bg-slate-100 text-slate-500 text-xs font-bold rounded-lg">Batal</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setEditPassword(true)}
                      className="w-full py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                      🔑 Ubah Password
                    </button>
                  )}
                </div>
              </Kartu>
            </div>

            {/* ══ KANAN ══ */}
            <div className="space-y-4">
              <Kartu icon="🎭" judul="Peran Pengguna" hitung="1 Role">
                <div className="p-4 space-y-3">
                  <span className={`inline-flex px-3 py-1.5 rounded-lg text-xs font-bold border ${roleClass}`}>
                    {userData.role}
                  </span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Level Akses</p>
                    <span className={`inline-flex px-3 py-1.5 rounded-lg text-xs font-bold border ${
                      (userData as { access_level?: string }).access_level === 'full'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                      {(userData as { access_level?: string }).access_level === 'full' ? '🔓 Full Access' : '🔒 Guest'}
                    </span>
                  </div>
                </div>
              </Kartu>

              <Kartu icon="🔐" judul="Hak Akses Modul" hitung={String(menuAktif.length)}>
                <div className="p-4 space-y-2.5">
                  <input aria-label="Cari modul..." value={cariIzin} onChange={e => setCariIzin(e.target.value)}
                    placeholder="🔍 Cari modul..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-rose-200" />
                  {/* TANPA max-h: halaman ini sudah menggulir sebagai satu blok
                      (bungkusnya flex-1 overflow-y-auto di induk - lihat
                      className pembungkus modal). Kotak setinggi 256px yang
                      menggulir sendiri DI DALAM halaman yang sudah menggulir
                      menyembunyikan chip tanpa penanda apa pun - diuji dengan
                      14 modul aktif: badge menunjukkan "14" tapi hanya 9 chip
                      yang terlihat, 128px sisanya tersembunyi begitu saja. */}
                  <div className="flex flex-wrap gap-1.5">
                    {menuTersaring.length === 0 ? (
                      <p className="text-xs text-slate-400 py-2">Tidak ada modul yang cocok.</p>
                    ) : menuTersaring.map(k => {
                      const cfg = ALL_MENU_LABELS[k];
                      return (
                        <span key={k}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          {cfg?.icon} {cfg?.label ?? k}
                        </span>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed pt-1">
                    Daftar ini ditentukan admin lewat Admin Panel. Untuk menambah akses modul,
                    hubungi admin.
                  </p>
                </div>
              </Kartu>
            </div>
          </div>
        </div>
      </div>
    </div>
  </ModalPortal>
  );
}
