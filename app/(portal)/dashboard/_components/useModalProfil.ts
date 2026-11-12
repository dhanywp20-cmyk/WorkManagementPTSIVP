'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { setSession } from '@/lib/auth/sesi';
import { User, JabatanType, JABATAN_CONFIG, ALL_MENU_KEYS, ALL_MENU_LABELS, ROLE_BADGE } from './shared';
import { ambilProfil } from './modal-bersama';
import { hasFullAccess } from '@/lib/constants';
import { bacaPengaturan } from '@/lib/notifikasi/pengaturan';
import { statusInstalasiPWA, subscribeInstallPWA, pasangAplikasiPWA, type StatusInstallPWA } from '@/lib/pwa-install';
import { useMerek } from '@/lib/merek/inti';

export interface ModalProfilKonteks {
  currentUser: User;
}

export function useModalProfil(k: ModalProfilKonteks) {
  const { currentUser } = k;
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
  const [telegramBot, setTelegramBot] = useState<{ status: 'memuat' | 'siap' | 'galat'; username?: string; alasan?: string }>({ status: 'memuat' });
  const [menghubungkan, setMenghubungkan] = useState(false);
  const [pesanTelegram, setPesanTelegram] = useState<{ tipe: 'ok' | 'gagal'; teks: string } | null>(null);
  const [telegramAktif, setTelegramAktif] = useState<boolean | null>(null);
  const [autoHubung, setAutoHubung] = useState<'diam' | 'menunggu' | 'gagal'>('diam');
  const autoHubungRef = useRef<{ interval?: ReturnType<typeof setInterval>; timeout?: ReturnType<typeof setTimeout> }>({});

  const merek = useMerek();
  const [statusInstall, setStatusInstall] = useState<StatusInstallPWA>('belum-siap');
  const [memasang, setMemasang] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  useEffect(() => {
    setStatusInstall(statusInstalasiPWA());
    return subscribeInstallPWA(() => setStatusInstall(statusInstalasiPWA()));
  }, []);
  const handlePasangAplikasi = async () => {
    setMemasang(true);
    try { await pasangAplikasiPWA(); } finally { setMemasang(false); }
  };

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
          const ids = supMaps.map((s: any) => s.supervisor_id).filter((id: string) => id !== currentUser.id);
          if (ids.length > 0) {
            const { data: sups } = await supabase.from('users').select('full_name, phone_number, sales_division, jabatan').in('id', ids);
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
          const filtered = (subUsers ?? []).filter((u: any) => {
            if (u.username === currentUser.username) return false;
            const tier = u.jabatan ? (JABATAN_CONFIG[u.jabatan as JabatanType]?.tier ?? 0) : 0;
            return tier < selfTier;
          });
          if (filtered.length) setSubordinates(filtered);
        }
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/notifikasi/telegram', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ aksi: 'bot_info' }),
        });
        const j = await r.json() as { ok?: boolean; alasan?: string; bot?: string };
        setTelegramBot(j?.ok && j.bot
          ? { status: 'siap', username: j.bot }
          : { status: 'galat', alasan: j?.alasan ?? 'Bot Telegram belum diatur admin.' });
      } catch {
        setTelegramBot({ status: 'galat', alasan: 'Tidak bisa menghubungi server.' });
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const p = await bacaPengaturan();
        setTelegramAktif(p.aktif.telegram);
      } catch { setTelegramAktif(false); }
    })();
  }, []);

  const hentikanAutoHubung = () => {
    if (autoHubungRef.current.interval) clearInterval(autoHubungRef.current.interval);
    if (autoHubungRef.current.timeout) clearTimeout(autoHubungRef.current.timeout);
    autoHubungRef.current = {};
  };
  useEffect(() => hentikanAutoHubung, []);

  const cekHubunganTelegramSekali = async (): Promise<boolean> => {
    try {
      const r = await fetch('/api/notifikasi/telegram', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aksi: 'hubungkan' }),
      });
      const j = await r.json() as { ok?: boolean };
      return !!j?.ok;
    } catch { return false; }
  };

  const mulaiAutoHubung = () => {
    if (telegramBot.status !== 'siap' || !telegramBot.username) return;
    window.open(`https://t.me/${telegramBot.username}?start=${currentUser.id}`, '_blank', 'noopener,noreferrer');

    hentikanAutoHubung();
    setPesanTelegram(null);
    setAutoHubung('menunggu');

    const cekSekali = async () => {
      const berhasil = await cekHubunganTelegramSekali();
      if (!berhasil) return;
      hentikanAutoHubung();
      setAutoHubung('diam');
      setPesanTelegram({ tipe: 'ok', teks: 'Telegram terhubung! Notifikasi akan masuk ke chat itu.' });
      const { data } = await ambilProfil(currentUser.id);
      if (data) { setUserData(data); setSession(data); }
    };
    cekSekali();
    autoHubungRef.current.interval = setInterval(cekSekali, 4000);
    autoHubungRef.current.timeout = setTimeout(() => {
      hentikanAutoHubung();
      setAutoHubung('gagal');
    }, 5 * 60 * 1000);
  };

  const putuskanTelegram = async () => {
    setMenghubungkan(true);
    setPesanTelegram(null);
    try {
      const r = await fetch('/api/notifikasi/telegram', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aksi: 'putuskan' }),
      });
      const j = await r.json() as { ok?: boolean; alasan?: string };
      if (j?.ok) {
        setPesanTelegram(null);
        const { data } = await ambilProfil(currentUser.id);
        if (data) { setUserData(data); setSession(data); }
      } else {
        setPesanTelegram({ tipe: 'gagal', teks: j?.alasan ?? 'Gagal memutuskan.' });
      }
    } catch {
      setPesanTelegram({ tipe: 'gagal', teks: 'Tidak bisa menghubungi server.' });
    }
    setMenghubungkan(false);
  };

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

  const salam = (() => {
    const j = new Date().getHours();
    if (j < 11) return 'Selamat Pagi';
    if (j < 15) return 'Selamat Siang';
    if (j < 19) return 'Selamat Sore';
    return 'Selamat Malam';
  })();

  const menuAktif = hasFullAccess(userData)
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
  return {
    salam, userData, jabatanCfg, menuAktif, notification, telegramAktif, autoHubung, putuskanTelegram,
    menghubungkan, telegramBot, mulaiAutoHubung, pesanTelegram, editPhone, phoneInput, setPhoneInput, handleSavePhone,
    saving, setEditPhone, bergabung, atasanList, ivpList, sortedSubordinates, editPassword, passwordInput,
    setPasswordInput, getPasswordStrength, confirmPassword, setConfirmPassword, handleSavePassword, setEditPassword, statusInstall, handlePasangAplikasi,
    memasang, merek, setShowInstallGuide, roleClass, cariIzin, setCariIzin, menuTersaring, showInstallGuide,
  };
}
