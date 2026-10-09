'use client';

/**
 * LayarMasuk - layar masuk, daftar akun & lupa password portal (dipecah dari KerangkaPortal).
 *
 * Semua state form tinggal di sini; KerangkaPortal hanya menerima hasilnya: `onMasuk` saat
 * password benar (sesi & token dipasang), lalu `onSelesai` setelah animasi penutup selesai -
 * baru saat itu layar ini diganti portal.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { User } from '../dashboard/_components/shared';
import { JABATAN_LIST, JABATAN_CONFIG } from '../dashboard/_components/shared';
import { useDivisiSales, useMerek, gradasiPanelLogin, angkaTembus } from '@/lib/merek';
import { useKelompokPTS } from '@/lib/kelompok';
import { ModalPortal, LogoMerek, ChipVersi } from '@/components/shared';
import { IkonTeks } from '@/components/shared/Ikon';

export function LayarMasuk({ onMasuk, onSelesai }: {
  /** Password benar: pasang sesi, token & pengguna. */
  onMasuk: (pengguna: User, dbToken: string | null) => void;
  /** Animasi penutup selesai - ganti layar ini dengan portal. */
  onSelesai: () => void;
}) {
  const merek = useMerek();
  const daftarDivisi = useDivisiSales();
  const daftarKelompokPTS = useKelompokPTS();
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginErr, setLoginErr] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerErr, setRegisterErr] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [showRegPwd, setShowRegPwd] = useState(false);
  const [showRegConfirmPwd, setShowRegConfirmPwd] = useState(false);
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  /* Animasi kartu login saat berpindah masuk  daftar.
     'masuk'       kartu tumbuh keluar dari koper (adegan penuh diputar ulang)
     'tukarKeluar' kartu lama menyusut & memudar, isinya belum diganti
     'tukarMasuk'  isi sudah berganti, kartu baru muncul sementara koper berputar */
  const [animKartu, setAnimKartu] = useState<'masuk' | 'tukarKeluar' | 'tukarMasuk'>('masuk');
  /* Login sudah lolos, tapi halaman login belum ditinggalkan: tombol berubah
     jadi tanda centang dan koper menutup kembali. Lihat catatan di handleLogin
     soal kenapa perpindahannya sengaja ditunda. */
  const [masukBerhasil, setMasukBerhasil] = useState(false);
  /* Naik tiap kali animasi kartu perlu diulang. Dipakai sebagai key React
     supaya animasi CSS benar-benar dijalankan lagi, bukan diabaikan karena
     elemennya dianggap sama. */
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
  // true kalau pendaftaran ini lolos lewat kode event (lihat REGISTER_BYPASS_*
  // di app/api/auth/register/route.ts) dan langsung aktif tanpa approval admin.
  const [registerBypass, setRegisterBypass] = useState(false);
  // Forgot password flow
  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'verify'>('request');
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPwd, setForgotNewPwd] = useState('');
  const [forgotConfirmPwd, setForgotConfirmPwd] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [forgotMaskedPhone, setForgotMaskedPhone] = useState('');
  /* Perpindahan antara form masuk dan form daftar.
     Ke DAFTAR  : kartu ditutup dulu 240 ms, baru isinya diganti - kalau tidak,
                  isi baru terlihat menyusut keluar dan efek tukarnya rusak,
                  karena React mengganti isi pada saat diklik, bukan di tengah
                  animasi. Kopernya berputar di tempat.
     Ke MASUK   : seluruh adegan koper diputar ulang dari nol, dan kartunya
                  tumbuh lagi dari dalam koper. */
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

  /*
    Link/QR Code dari Admin Panel > Kode Acara membawa ?kode=XXXX.

    SENGAJA mendarat di form MASUK, bukan langsung dilempar ke form Daftar -
    QR/link yang sama dibagikan ke SEMUA peserta acara, dan sebagian dari
    mereka sudah pernah mendaftar sebelumnya (lewat kode acara acara lalu,
    atau didaftarkan admin). Memaksa semua orang ke form Daftar berarti yang
    sudah punya akun harus mencari sendiri tombol "Masuk" dulu. Kode acara
    tetap disiapkan di sini - begitu orang yang BELUM punya akun mengklik
    Daftar sendiri, kodenya sudah terisi, tidak perlu mengetik ulang.

    window.location.search dibaca langsung (bukan useSearchParams) karena
    ini cuma dibaca SEKALI saat halaman terbuka, dan menghindari keharusan
    membungkus seluruh halaman ini dengan <Suspense> hanya untuk itu.
  */
  useEffect(() => {
    const kode = new URLSearchParams(window.location.search).get('kode');
    if (kode) setRegisterForm(f => ({ ...f, event_code: kode }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async () => {
    if (loginLoading) return;
    setLoginLoading(true);
    setLoginErr('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginForm.username, password: loginForm.password }),
      });
      const result = await res.json();
      if (!res.ok || !result.user) { setLoginErr(result.error || 'Email atau password salah!'); return; }
      const data = result.user;
      if (data.team_type === 'Pending Approval') {
        setLoginErr('Akun kamu masih menunggu persetujuan admin. Kamu akan dihubungi setelah akun diaktifkan.');
        return;
      }
      onMasuk(data, result.db_token ?? null);

      /* Perpindahan ke dashboard ditunda supaya animasi penutup (lc-bongkar di
         globals.css) sempat jalan sampai habis. 1500ms = jeda 270ms + durasi
         1230ms milik animasi terakhir; angka ini WAJIB ikut berubah setiap
         durasi di globals.css diubah, kalau tidak halaman login dilepas dari
         DOM di tengah gerakan. Penundaan ini hanya dibayar saat orang benar
         benar menekan tombol login. */
      setMasukBerhasil(true);
      const pakaiAnimasi = typeof window !== 'undefined'
        && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.setTimeout(onSelesai, pakaiAnimasi ? 1500 : 0);
    } catch { setLoginErr('Login gagal. Coba lagi.'); } finally { setLoginLoading(false); }
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
    // Registrasi baru WAJIB email valid (disimpan di kolom username). Akun lama
    // yang terlanjur pakai username non-email tidak terpengaruh.
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
      // Seluruh pendaftaran dikerjakan di server - lihat /api/auth/register.
      //
      // Sebelumnya peramban memeriksa username ganda lalu menulis sendiri ke
      // tabel users. Keduanya menuntut tabel itu terbuka untuk pengunjung yang
      // belum login, dan "terbuka" berlaku untuk SELURUH tabel: siapa pun yang
      // memegang anon key bisa membaca 74 akun beserta nama, username, dan
      // nomor teleponnya. Username di sini adalah pengenal login, jadi daftar
      // itu sekaligus menyerahkan daftar sasaran yang lengkap.
      const daftarRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: full_name.trim(),
          username: username.trim().toLowerCase(),
          password,
          sales_division: requestedDivision,
          //  Dipakai server HANYA untuk menyusun team_type di jalur kode acara
          //  (akun itu tidak pernah lewat approval admin, jadi tidak ada
          //  langkah lain yang mengisinya). role & allowed_menus tetap tidak
          //  pernah ditentukan peramban - lihat catatan di /api/auth/register.
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
      // Pemberitahuan ke admin ikut dikerjakan /api/auth/register - versi
      // lamanya di sini harus membaca tabel users tanpa token untuk mencari
      // siapa adminnya, persis pembacaan yang sedang ditutup.
      // `bypass` datang dari server (lihat REGISTER_BYPASS_* di route.ts) -
      // peramban cuma menampilkan hasilnya, tidak pernah menentukan sendiri.
      setRegisterBypass(Boolean(hasilDaftar.bypass));
      setRegisterSuccess(true);
      setRegisterForm({ full_name: '', username: '', password: '', confirm_password: '', divisi: '', pts_type: '', sales_division: '', jabatan: '', phone_number: '', event_code: '' });
    } catch (err: any) {
      setRegisterErr('Registrasi gagal: ' + err.message);
    }
    setRegisterLoading(false);
  };

    return (
      // SATU background penuh utk seluruh halaman (tidak dipotong per panel) -
      // tiap panel hanya overlay transparan di atas gambar yang sama.
      <>
      {/* Seluruh isi halaman login ada di dalam bungkus ini supaya bisa dihisap
          masuk ke koper sebagai satu benda. Lapisan kopernya SENGAJA di luar —
          kalau ikut di dalam, kopernya akan menghisap dirinya sendiri. */}
      <div className={`${masukBerhasil ? 'lc-bongkar' : ''} flex bg-cover bg-center bg-fixed`} style={{ minHeight: '100dvh', backgroundImage: `url(${merek.gambarLatar})` }}>
        {/* ── LEFT: panel branding (desktop) — overlay merah transparan, gambar tembus dari bg penuh ── */}
        <div className={`hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 text-white overflow-hidden ${masukBerhasil ? 'lc-bongkar-kiri' : ''}`}
          style={{ background: gradasiPanelLogin(merek) }}>
          <div className="flex items-center gap-2.5">
            <LogoMerek ukuran="lg" gaya="tembus" />
            <span className="text-lg font-bold tracking-tight">{merek.namaPlatform} <span className="font-normal text-white/75">· {merek.namaPortal}</span></span>
          </div>
          <div className="max-w-md">
            <h1 className="text-4xl font-black leading-tight mb-4">{merek.judulLogin}</h1>
            <p className="text-white/85 text-base leading-relaxed mb-8">{merek.subjudulLogin}</p>
            <div className="flex flex-wrap gap-2.5">
              {[['🗓️', 'Request Schedule'], ['🎫', 'Ticket Troubleshooting'], ['🏗️', 'Design Project'], ['🏪', 'Piket Showroom']].map(([ic, l]) => (
                <span key={l} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/12 backdrop-blur text-sm font-semibold border border-white/15">{ic} {l}</span>
              ))}
            </div>
          </div>
          {/*  Kredit & identitas build duduk di baris yang sama: keduanya
               keterangan tentang perangkat lunaknya, bukan tentang isi
               halaman, jadi tidak pantas dipisah jadi dua blok. */}
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-white/55 text-xs">
              © {new Date().getFullYear()} {merek.namaPerusahaan}
              {merek.kredit && <span className="text-white/40"> · {merek.kredit}</span>}
            </p>
            <ChipVersi gaya="terang" />
          </div>
        </div>

        {/* ── RIGHT: panel form — overlay PUTIH transparan di atas bg penuh (biar tidak
            contrast), form dlm kartu frosted ── */}
        <div className={`relative overflow-hidden flex-1 flex items-center justify-center p-4 sm:p-8 ${masukBerhasil ? 'lc-bongkar-kanan' : ''}`}
          style={{ background: `rgba(255,255,255,${angkaTembus(merek.tembusKanan, 0.55)})` }}>
          <div
            key={putaranAnim}
            className={`lc-kartu ${
              animKartu === 'masuk' ? 'lc-kartu-masuk'
                : animKartu === 'tukarKeluar' ? 'lc-tukar-keluar' : 'lc-tukar-masuk'
            } w-full ${showRegister ? 'max-w-2xl' : 'max-w-md'} bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-6 sm:p-8`}
          >
            <div className="mb-8">
              {/* Logo kecil — hanya mobile (di desktop logo ada di panel kiri) */}
              <div className="flex lg:hidden items-center gap-2.5 mb-6">
                <LogoMerek ukuran="lg" />
                <span className="text-lg font-bold text-slate-800">{merek.namaPlatform} <span className="text-slate-500 font-normal">· {merek.namaPortal}</span></span>
              </div>
              <h2 className="text-xl sm:text-3xl font-bold text-slate-800 tracking-tight">{showRegister ? 'Buat Akun Baru' : 'Selamat Datang'}</h2>
              <p className="text-slate-500 text-sm mt-1.5">{showRegister ? 'Lengkapi data untuk mendaftar. Akun akan diverifikasi admin.' : 'Masuk ke akun Anda untuk melanjutkan'}</p>
            </div>

            {!showRegister && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="f-dashboard-page-1" className="block text-xs font-bold mb-2 text-slate-600 tracking-widest uppercase">Email</label>
                  <input id="f-dashboard-page-1" type="text" autoComplete="username" value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:border-rose-500 focus:ring-2 focus:ring-rose-100 transition-all bg-white text-slate-800 font-medium text-sm outline-none"
                    placeholder="email@perusahaan.com" onKeyDown={(e) => e.key === 'Enter' && handleLogin()} />
                </div>
                <div>
                  <label htmlFor="f-dashboard-login-pwd" className="block text-xs font-bold mb-2 text-slate-600 tracking-widest uppercase">Password</label>
                  <div className="relative">
                    <input id="f-dashboard-login-pwd" autoComplete="current-password" type={showLoginPwd ? 'text' : 'password'} value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      className="w-full border border-slate-200 rounded-xl pl-4 pr-11 py-3 focus:border-rose-500 focus:ring-2 focus:ring-rose-100 transition-all bg-white text-slate-800 font-medium text-sm outline-none"
                      placeholder="Masukkan password" onKeyDown={(e) => { if (e.key === 'Enter') { setLoginErr(''); handleLogin(); } }} />
                    <button type="button" onClick={() => setShowLoginPwd(v => !v)} tabIndex={-1}
                      aria-label={showLoginPwd ? 'Sembunyikan password' : 'Tampilkan password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600 transition-colors">
                      {showLoginPwd ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" /></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" /><circle cx="12" cy="12" r="3" /></svg>
                      )}
                    </button>
                  </div>
                </div>
                {loginErr && (
                  <div className="px-4 py-2.5 rounded-xl text-sm font-medium text-red-700 bg-red-50 border border-red-200">
                    {loginErr}
                  </div>
                )}
                <button onClick={handleLogin} disabled={loginLoading || masukBerhasil} className="w-full text-white py-3.5 rounded-xl font-bold shadow-lg transition-all tracking-wide text-sm mt-2 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:opacity-90"
                  style={{ background: `linear-gradient(to right, ${merek.warnaUtama}, ${merek.warnaUtama2})` }}>
                  {masukBerhasil ? (
                    <>
                      {/* Kepastian bahwa passwordnya benar — inilah yang orang
                          tunggu, dan ia tampil seketika, tidak menunggu animasi. */}
                      <svg aria-hidden="true" focusable="false" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                      Berhasil masuk
                    </>
                  ) : loginLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Memverifikasi...
                    </>
                  ) : (
                    <>🔐 Masuk ke Portal</>
                  )}
                </button>
                <p className="text-center text-xs text-slate-500 pt-1">
                  Belum punya akun? <button onClick={() => pindahForm(true)} className="text-indigo-600 font-bold hover:underline">Daftar di sini</button>
                  <span className="mx-2 text-slate-400">|</span>
                  <button onClick={() => { setShowForgot(true); setForgotStep('request'); setForgotMsg(null); }} className="font-bold hover:underline" style={{ color: merek.warnaUtama }}>Lupa Password?</button>
                </p>
              </div>
            )}

            {showRegister && (
              <div>
                {registerSuccess ? (
                  <div className="text-center py-6">
                    <div className="text-5xl mb-4">{registerBypass ? '🎓' : '✅'}</div>
                    <h3 className="font-bold text-slate-800 text-lg mb-2">Pendaftaran Berhasil!</h3>
                    <p className="text-slate-500 text-sm mb-4">
                      {registerBypass
                        ? 'Akun kamu sudah langsung aktif untuk Learning Center - tidak perlu menunggu admin. Silakan login sekarang.'
                        : 'Akun kamu akan diverifikasi oleh admin. Kamu akan dihubungi setelah akun diaktifkan.'}
                    </p>
                    <button onClick={() => pindahForm(false)} className="text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all hover:opacity-90" style={{ background: merek.warnaUtama }}>Kembali ke Login</button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                      {/* Kolom Kiri */}
                      <div className="space-y-3">
                        <div>
                          <label htmlFor="f-dashboard-page-2" className="block text-xs font-bold mb-1.5 text-slate-600 tracking-widest uppercase">Nama Lengkap *</label>
                          <input id="f-dashboard-page-2" type="text" value={registerForm.full_name} onChange={e => setRegisterForm({ ...registerForm, full_name: e.target.value })}
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="Nama lengkap" />
                        </div>
                        <div>
                          <label htmlFor="f-dashboard-page-3" className="block text-xs font-bold mb-1.5 text-slate-600 tracking-widest uppercase">Email *</label>
                          <input id="f-dashboard-page-3" type="email" value={registerForm.username} onChange={e => setRegisterForm({ ...registerForm, username: e.target.value })}
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="email@perusahaan.com" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold mb-1.5 text-slate-600 tracking-widest uppercase">Password *</label>
                          <div className="relative">
                            <input type={showRegPwd ? 'text' : 'password'} value={registerForm.password} onChange={e => setRegisterForm({ ...registerForm, password: e.target.value })}
                              className="w-full border border-slate-200 rounded-xl pl-4 pr-11 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="min. 8 karakter, ada kapital & angka" />
                            <button type="button" onClick={() => setShowRegPwd(v => !v)} tabIndex={-1}
                              aria-label={showRegPwd ? 'Sembunyikan password' : 'Tampilkan password'}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600 transition-colors">
                              {showRegPwd ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" /></svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" /><circle cx="12" cy="12" r="3" /></svg>
                              )}
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold mb-1.5 text-slate-600 tracking-widest uppercase">Konfirmasi Password *</label>
                          <div className="relative">
                            <input type={showRegConfirmPwd ? 'text' : 'password'} value={registerForm.confirm_password} onChange={e => setRegisterForm({ ...registerForm, confirm_password: e.target.value })}
                              className="w-full border border-slate-200 rounded-xl pl-4 pr-11 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="ulangi password" />
                            <button type="button" onClick={() => setShowRegConfirmPwd(v => !v)} tabIndex={-1}
                              aria-label={showRegConfirmPwd ? 'Sembunyikan password' : 'Tampilkan password'}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600 transition-colors">
                              {showRegConfirmPwd ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" /></svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" /><circle cx="12" cy="12" r="3" /></svg>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                      {/* Kolom Kanan */}
                      <div className="space-y-3">
                        <div>
                          <label htmlFor="f-dashboard-page-4" className="block text-xs font-bold mb-1.5 text-slate-600 tracking-widest uppercase">Divisi *</label>
                          <select id="f-dashboard-page-4" value={registerForm.divisi} onChange={e => setRegisterForm({ ...registerForm, divisi: e.target.value, pts_type: '', sales_division: '' })}
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all bg-white">
                            <option value="">-- Pilih Divisi --</option>
                            <option value="PTS">PTS</option>
                            <option value="Sales">Sales</option>
                            <option value="Marketing">Marketing</option>
                          </select>
                        </div>
                        {registerForm.divisi === 'PTS' && (
                          <div>
                            <label htmlFor="f-dashboard-page-5" className="block text-xs font-bold mb-1.5 text-slate-600 tracking-widests uppercase">Tipe PTS *</label>
                            <select id="f-dashboard-page-5" value={registerForm.pts_type} onChange={e => setRegisterForm({ ...registerForm, pts_type: e.target.value })}
                              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all bg-white">
                              <option value="">-- Pilih Tipe PTS --</option>
                              {daftarKelompokPTS.map(k => <option key={k.nama} value={k.label}>{k.label}</option>)}
                            </select>
                          </div>
                        )}
                        {(registerForm.divisi === 'Sales' || registerForm.divisi === 'Marketing') && (
                          <div>
                            <label htmlFor="f-dashboard-page-6" className="block text-xs font-bold mb-1.5 text-slate-600 tracking-widest uppercase">
                              {registerForm.divisi === 'Marketing' ? 'Marketing Division *' : 'Sales Division *'}
                            </label>
                            <select id="f-dashboard-page-6" value={registerForm.sales_division} onChange={e => setRegisterForm({ ...registerForm, sales_division: e.target.value })}
                              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all bg-white">
                              <option value="">-- Pilih {registerForm.divisi} Division --</option>
                              {daftarDivisi.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                          </div>
                        )}
                        <div>
                          <label htmlFor="f-dashboard-page-7" className="block text-xs font-bold mb-1.5 text-slate-600 tracking-widest uppercase">Jabatan / Posisi</label>
                          <select id="f-dashboard-page-7" value={registerForm.jabatan} onChange={e => setRegisterForm({ ...registerForm, jabatan: e.target.value })}
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all bg-white">
                            <option value="">— Pilih Jabatan —</option>
                            {JABATAN_LIST.map(j => <option key={j} value={j}>{JABATAN_CONFIG[j].icon} {j}</option>)}
                          </select>
                        </div>
                        <div>
                          <label htmlFor="f-dashboard-page-8" className="block text-xs font-bold mb-1.5 text-slate-600 tracking-widest uppercase">No. HP</label>
                          <input id="f-dashboard-page-8" type="text" value={registerForm.phone_number} onChange={e => setRegisterForm({ ...registerForm, phone_number: e.target.value })}
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="08xx..." />
                        </div>
                      </div>
                    </div>
                    {/* Kode Acara: opsional, hanya dipakai untuk onboarding massal
                        (mis. peserta Learning Center) yang dibagikan panitia. Kosong
                        = alur normal, tetap menunggu approval admin seperti biasa. */}
                    <div>
                      <label htmlFor="f-dashboard-page-9" className="block text-xs font-bold mb-1.5 text-slate-600 tracking-widest uppercase">Kode Acara (opsional)</label>
                      <input id="f-dashboard-page-9" type="text" value={registerForm.event_code} onChange={e => setRegisterForm({ ...registerForm, event_code: e.target.value })}
                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="Isi hanya jika diberikan admin" />
                    </div>
                    {registerErr && (
                      <div className="px-4 py-2.5 rounded-xl text-sm font-medium text-red-700 bg-red-50 border border-red-200">{registerErr}</div>
                    )}
                    <button onClick={() => { setRegisterErr(''); handleRegister(); }} disabled={registerLoading}
                      className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 text-white py-3.5 rounded-xl font-bold shadow-lg transition-all text-sm disabled:opacity-60 flex items-center justify-center gap-2">
                      {registerLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                      <IkonTeks nama="📝" />Daftar Akun
                    </button>
                    <p className="text-center text-xs text-slate-500">Sudah punya akun? <button onClick={() => pindahForm(false)} className="font-bold hover:underline" style={{ color: merek.warnaUtama }}>Login</button></p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Forgot Password Modal (login page) ── */}
        {showForgot && (
        <ModalPortal>
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-800"><IkonTeks nama="🔐" />Reset Password</h3>
                <button aria-label="Tutup" onClick={() => setShowForgot(false)} className="text-slate-500 hover:text-slate-600 font-bold text-lg leading-none">✕</button>
              </div>
              {forgotMsg && (
                <div className={`px-3 py-2 rounded-lg text-xs font-semibold ${forgotMsg.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                  {forgotMsg.text}
                </div>
              )}
              {forgotStep === 'request' ? (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">Kode OTP dikirim ke WhatsApp terdaftar.</p>
                  <input type="text" value={forgotUsername} onChange={e => setForgotUsername(e.target.value)}
                    placeholder="Email / Username" onKeyDown={e => e.key === 'Enter' && handleForgotRequest()}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none" />
                  <button onClick={handleForgotRequest} disabled={forgotLoading}
                    className="w-full text-white py-2.5 rounded-xl font-bold text-sm disabled:opacity-60 transition-all hover:opacity-90" style={{ background: merek.warnaUtama }}>
                    {forgotLoading ? 'Mengirim...' : 'Kirim Kode OTP'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">Masukkan kode 6-digit yang dikirim ke WA <strong>{forgotMaskedPhone}</strong>, lalu buat password baru.</p>
                  <input type="text" value={forgotOtp} onChange={e => setForgotOtp(e.target.value)}
                    placeholder="Kode OTP (6 digit)" maxLength={6}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-center tracking-widest font-bold focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none" />
                  <input type="password" value={forgotNewPwd} onChange={e => setForgotNewPwd(e.target.value)}
                    placeholder="Password baru (min. 8, ada kapital & angka)"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none" />
                  <input type="password" value={forgotConfirmPwd} onChange={e => setForgotConfirmPwd(e.target.value)}
                    placeholder="Konfirmasi password baru"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none" />
                  <div className="flex gap-2">
                    <button onClick={() => { setForgotStep('request'); setForgotMsg(null); }}
                      className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 transition-all">Kembali</button>
                    <button onClick={handleForgotVerify} disabled={forgotLoading}
                      className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-60 transition-all hover:opacity-90" style={{ background: merek.warnaUtama }}>
                      {forgotLoading ? 'Menyimpan...' : 'Reset Password'}
                    </button>
                  </div>
                  <button onClick={handleForgotRequest} disabled={forgotLoading}
                    className="w-full text-xs text-slate-500 hover:text-rose-500 transition-all">
                    Kirim ulang OTP
                  </button>
                </div>
              )}
            </div>
          </div>
        </ModalPortal>
        )}
      </div>
      </>
    );
}
