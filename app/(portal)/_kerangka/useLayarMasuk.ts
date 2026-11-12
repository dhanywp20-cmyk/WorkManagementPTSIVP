'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { User } from '../dashboard/_components/shared';
import { useDivisiSales, useMerek } from '@/lib/merek/inti';
import { useKelompokPTS } from '@/lib/kelompok/inti';
import { kembaliTerang } from '@/components/shared/Tema';
import { type HasilMasuk } from './LangkahDuaFaktor';
import { akunTertunda, PESAN_TERTUNDA } from '@/lib/auth/akun-tertunda';
import { pesanGalat } from '@/lib/galat/pesan';

export interface LayarMasukKonteks {
  onMasuk: (pengguna: User, dbToken: string | null) => void;
  onSelesai: () => void;
}

export function useLayarMasuk(k: LayarMasukKonteks) {
  const { onMasuk, onSelesai } = k;
  const merek = useMerek();
  const daftarDivisi = useDivisiSales();
  const daftarKelompokPTS = useKelompokPTS();
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginErr, setLoginErr] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [langkah2fa, setLangkah2fa] = useState<{ tahap: 'kode_2fa' | 'daftar_2fa'; tantangan: string } | null>(null);
  const [registerErr, setRegisterErr] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [showRegPwd, setShowRegPwd] = useState(false);
  const [showRegConfirmPwd, setShowRegConfirmPwd] = useState(false);
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [animKartu, setAnimKartu] = useState<'masuk' | 'tukarKeluar' | 'tukarMasuk'>('masuk');
  const [masukBerhasil, setMasukBerhasil] = useState(false);
  const [namaSapa, setNamaSapa] = useState('');
  const [putaranAnim, setPutaranAnim] = useState(0);
  const jedaTukarRef = useRef<number | null>(null);
  const [registerForm, setRegisterForm] = useState({
    full_name: '',
    username: '',
    password: '',
    confirm_password: '',
    divisi: '',
    pts_type: '',
    sales_division: '',
    jabatan: '',
    phone_number: '',
    event_code: '',
  });
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [registerBypass, setRegisterBypass] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'verify'>('request');
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPwd, setForgotNewPwd] = useState('');
  const [forgotConfirmPwd, setForgotConfirmPwd] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [forgotMaskedPhone, setForgotMaskedPhone] = useState('');
  const pindahForm = useCallback((keDaftar: boolean) => {
    if (jedaTukarRef.current) window.clearTimeout(jedaTukarRef.current);
    if (keDaftar) {
      setAnimKartu('tukarKeluar');
      jedaTukarRef.current = window.setTimeout(() => {
        setShowRegister(true);
        setRegisterErr('');
        setAnimKartu('tukarMasuk');
        setPutaranAnim((n) => n + 1);
      }, 240);
    } else {
      setShowRegister(false);
      setRegisterErr('');
      setRegisterSuccess(false);
      setRegisterBypass(false);
      setAnimKartu('masuk');
      setPutaranAnim((n) => n + 1);
    }
  }, []);
  useEffect(() => () => { if (jedaTukarRef.current) window.clearTimeout(jedaTukarRef.current); }, []);

  useEffect(() => {
    const kode = new URLSearchParams(window.location.search).get('kode');
    if (kode) setRegisterForm(f => ({ ...f, event_code: kode }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async () => {
    if (loginLoading) return;
    kembaliTerang();
    setLoginLoading(true);
    setLoginErr('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginForm.username, password: loginForm.password }),
      });
      const result = await res.json();
      if (res.ok && (result.tahap === 'kode_2fa' || result.tahap === 'daftar_2fa') && result.tantangan) {
        setLangkah2fa({ tahap: result.tahap, tantangan: result.tantangan });
        return;
      }
      if (!res.ok || !result.user) { setLoginErr(result.error || 'Email atau password salah!'); return; }
      lanjutMasuk(result);
    } catch { setLoginErr('Login gagal. Coba lagi.'); } finally { setLoginLoading(false); }
  };

  const lanjutMasuk = (result: HasilMasuk) => {
    setLangkah2fa(null);
    const data = result.user as unknown as User;
    if (akunTertunda(data)) {
      setLoginErr(PESAN_TERTUNDA);
      return;
    }
    onMasuk(data, result.db_token ?? null);

    setNamaSapa(((data.full_name as string | undefined) ?? '').trim().split(/\s+/)[0] ?? '');
    setMasukBerhasil(true);
    const pakaiAnimasi = typeof window !== 'undefined'
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(onSelesai, pakaiAnimasi ? 900 : 0);
  };

  const handleForgotRequest = async () => {
    if (!forgotUsername.trim()) { setForgotMsg({ type: 'error', text: 'Masukkan username.' }); return; }
    setForgotLoading(true); setForgotMsg(null);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: forgotUsername.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) { setForgotMsg({ type: 'error', text: data.error }); return; }
      setForgotMaskedPhone(data.maskedPhone ?? '');
      setForgotStep('verify');
      setForgotMsg({ type: 'success', text: data.message ?? 'OTP dikirim.' });
    } catch { setForgotMsg({ type: 'error', text: 'Gagal mengirim OTP.' }); }
    finally { setForgotLoading(false); }
  };

  const handleForgotVerify = async () => {
    if (!forgotOtp || !forgotNewPwd) { setForgotMsg({ type: 'error', text: 'Isi semua field.' }); return; }
    if (forgotNewPwd !== forgotConfirmPwd) { setForgotMsg({ type: 'error', text: 'Konfirmasi password tidak cocok.' }); return; }
    setForgotLoading(true); setForgotMsg(null);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: forgotUsername, otp: forgotOtp, newPassword: forgotNewPwd }),
      });
      const data = await res.json();
      if (!res.ok) { setForgotMsg({ type: 'error', text: data.error }); return; }
      setForgotMsg({ type: 'success', text: 'Password berhasil diubah! Silakan login.' });
      setTimeout(() => {
        setShowForgot(false); setForgotStep('request');
        setForgotUsername(''); setForgotOtp(''); setForgotNewPwd(''); setForgotConfirmPwd('');
        setForgotMsg(null);
      }, 2000);
    } catch { setForgotMsg({ type: 'error', text: 'Gagal mereset password.' }); }
    finally { setForgotLoading(false); }
  };

  const handleRegister = async () => {
    const { full_name, username, password, confirm_password, divisi, pts_type, sales_division } = registerForm;
    if (!full_name.trim()) { setRegisterErr('Nama lengkap wajib diisi!'); return; }
    if (!username.trim()) { setRegisterErr('Email wajib diisi!'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username.trim())) { setRegisterErr('Masukkan alamat email yang valid (contoh: nama@perusahaan.com).'); return; }
    if (!password || password.length < 8) { setRegisterErr('Password minimal 8 karakter!'); return; }
    if (!/[A-Z]/.test(password)) { setRegisterErr('Password harus mengandung minimal 1 huruf kapital!'); return; }
    if (!/[0-9]/.test(password)) { setRegisterErr('Password harus mengandung minimal 1 angka!'); return; }
    if (password !== confirm_password) { setRegisterErr('Konfirmasi password tidak cocok!'); return; }
    if (!divisi) { setRegisterErr('Pilih divisi!'); return; }
    if (divisi === 'PTS' && !pts_type) { setRegisterErr('Pilih tipe PTS!'); return; }
    if ((divisi === 'Sales' || divisi === 'Marketing') && !sales_division) { setRegisterErr('Pilih sales division!'); return; }
    setRegisterErr('');

    let requestedDivision: string | null = null;
    if (divisi === 'PTS') requestedDivision = pts_type;
    else if (divisi === 'Sales') requestedDivision = sales_division;
    else if (divisi === 'Marketing') requestedDivision = `Marketing:${sales_division}`;

    setRegisterLoading(true);
    try {
      const daftarRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: full_name.trim(),
          username: username.trim().toLowerCase(),
          password,
          sales_division: requestedDivision,
          divisi,
          pts_type,
          jabatan: registerForm.jabatan.trim() || null,
          phone_number: registerForm.phone_number.trim() || null,
          event_code: registerForm.event_code.trim() || null,
        }),
      });
      const hasilDaftar = await daftarRes.json().catch(() => ({}));
      if (!daftarRes.ok) {
        setRegisterErr(hasilDaftar.error || 'Pendaftaran gagal.');
        setRegisterLoading(false);
        return;
      }
      setRegisterBypass(Boolean(hasilDaftar.bypass));
      setRegisterSuccess(true);
      setRegisterForm({ full_name: '', username: '', password: '', confirm_password: '', divisi: '', pts_type: '', sales_division: '', jabatan: '', phone_number: '', event_code: '' });
    } catch (err) {
      setRegisterErr('Registrasi gagal: ' + pesanGalat(err));
    }
    setRegisterLoading(false);
  };
  return {
    masukBerhasil, merek, putaranAnim, animKartu, showRegister, namaSapa, langkah2fa, lanjutMasuk,
    setLangkah2fa, setLoginForm, loginForm, handleLogin, showLoginPwd, setLoginErr, setShowLoginPwd, loginErr,
    loginLoading, pindahForm, setShowForgot, setForgotStep, setForgotMsg, registerSuccess, registerBypass, registerForm,
    setRegisterForm, showRegPwd, setShowRegPwd, showRegConfirmPwd, setShowRegConfirmPwd, daftarKelompokPTS, daftarDivisi, registerErr,
    setRegisterErr, handleRegister, registerLoading, showForgot, forgotMsg, forgotStep, forgotUsername, setForgotUsername,
    handleForgotRequest, forgotLoading, forgotMaskedPhone, forgotOtp, setForgotOtp, forgotNewPwd, setForgotNewPwd, forgotConfirmPwd,
    setForgotConfirmPwd, handleForgotVerify,
  };
}
