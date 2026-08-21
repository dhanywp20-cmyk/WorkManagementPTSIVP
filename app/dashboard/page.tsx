'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, setDbToken } from '@/lib/supabase';
import { setSession, clearSession, getSession, startSessionWatcher } from '@/lib/auth';
import { isAdmin as checkIsAdmin, hasFullAccess, SESSION_DURATION_MS } from '@/lib/constants';
import {
  User, MenuItem, NotificationItem,
  JABATAN_LIST, JabatanType, JABATAN_CONFIG, JABATAN_CC_RULES,
  ALL_MENU_KEYS, ALL_MENU_LABELS, ROLE_BADGE,
  NotifBellProps, AdminPanelModalProps,
  DISPLAY_BRANDS_DB, MIDDLEWARE_BRANDS_DB, BrandPicMappingDB,
} from './_components/shared';
import {
  AccountSettingsModal, UserProfileModal, UserManagementModal,
  BrandPicSettingModal, NotifBell, NotificationBar,
  BrandPicSettingContent, AdminPanelModal,
  AccountSettingsInline, UserManagementInline, BrandPicSettingInline,
} from './_components/Modals';
import GlobalSearch from './_components/GlobalSearch';
import PermissionAwareDashboard from './_components/widgets/PermissionAwareDashboard';
import OnboardingTour, { JelajahiButton } from './_components/OnboardingTour';
import { notifyNewUserRegistration } from '@/lib/notifications';
import { useDivisiSales, useMerek, gradasiPanelLogin, angkaTembus } from '@/lib/merek';
import SessionExpiryBanner from '@/app/_components/SessionExpiryBanner';
import { ModalPortal, LogoMerek } from '@/components/shared';

export default function Dashboard() {
  const router = useRouter();
  const daftarDivisi = useDivisiSales();
  const merek = useMerek();
  // Guard: ensure auto-navigation to first menu only happens ONCE per login session
  // (prevents race-condition re-fires when currentUser/showSidebar update multiple times)
  const autoNavigatedRef = useRef(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginErr, setLoginErr] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerErr, setRegisterErr] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  /* Animasi kartu login saat berpindah masuk  daftar.
     'masuk'       kartu tumbuh keluar dari koper (adegan penuh diputar ulang)
     'tukarKeluar' kartu lama menyusut & memudar, isinya belum diganti
     'tukarMasuk'  isi sudah berganti, kartu baru muncul sementara koper berputar */
  const [animKartu, setAnimKartu] = useState<'masuk' | 'tukarKeluar' | 'tukarMasuk'>('masuk');
  /* Login sudah lolos, tapi halaman login belum ditinggalkan: tombol berubah
     jadi tanda centang dan koper menutup kembali. Lihat catatan di handleLogin
     soal kenapa perpindahannya sengaja ditunda. */
  const [masukBerhasil, setMasukBerhasil] = useState(false);
  /* Dashboard baru saja menggantikan halaman login: ia tumbuh keluar dari
     koper. Kelasnya dilepas lagi setelah animasinya habis - lihat catatan di
     app/globals.css soal kenapa transform tidak boleh menetap di akar
     dashboard. */
  const [dasborMuncul, setDasborMuncul] = useState(false);
  const sudahMasukRef = useRef(false);
  /* Perpindahan ke dashboard. Aman dipanggil berkali-kali: hanya yang pertama
     yang berlaku, sehingga pemberitahuan animasi dan jaring pengaman waktu
     tidak mungkin saling bertabrakan. */
  const masukKeDashboard = useCallback(() => {
    if (sudahMasukRef.current) return;
    sudahMasukRef.current = true;
    setDasborMuncul(true);
    setIsLoggedIn(true);
    setShowSidebar(true);
    setShowDashboardPanel(true);
    window.setTimeout(() => setDasborMuncul(false), 700);
  }, []);
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
  });
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);
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
  const [loading, setLoading] = useState(true);
  const [menuLoading, setMenuLoading] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [tourVisible, setTourVisible] = useState(false);
  const [tourHighlightKey, setTourHighlightKey] = useState<string | null>(null);
  const [showDashboardPanel, setShowDashboardPanel] = useState(false);

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
      setAnimKartu('masuk');
      setPutaranAnim((n) => n + 1);
    }
  }, []);
  useEffect(() => () => { if (jedaTukarRef.current) window.clearTimeout(jedaTukarRef.current); }, []);

  const [showSidebar, setShowSidebar] = useState(false);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [iframeTitle, setIframeTitle] = useState<string>('');
  const [showTicketing, setShowTicketing] = useState(false);
  const [internalUrl, setInternalUrl] = useState<string>('/ticketing');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);

  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminPanelTab, setAdminPanelTab] = useState<'settings' | 'userManagement' | 'picBrand'>('settings');
  /**
   * Dua antrean yang menunggu tindakan admin, sengaja DIPISAH karena
   * diselesaikan di tempat berbeda: pendingUsers di Admin Panel > User
   * Management, pendingRequests di Request Schedule. Menjumlahkannya jadi satu
   * badge membuat angka merah muncul di panel yang tidak memuat antreannya.
   */
  const [pendingUsers, setPendingUsers] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(false);

  const [visibleMenuItems, setVisibleMenuItems] = useState<MenuItem[]>([]);

  const allMenuItems: MenuItem[] = [
	{
      title: 'Learning Center', icon: '🎓', key: 'learning-center',
      gradient: 'from-blue-700 via-blue-600 to-indigo-500',
      description: 'Platform training, quiz online & analytics team',
      items: [{ name: 'Learning Center', url: '/learning-center', icon: '📚', internal: true, embed: true }]
    },
    {
      title: 'Tech Note R&D', icon: '📝', key: 'tech-note',
      gradient: 'from-pink-700 via-pink-600 to-rose-500',
      description: 'Platform dokumentasi teknikal & R&D — KPI 10%',
      items: [{ name: 'Tech Note', url: '/tech-note', icon: '📝', internal: true, embed: true }]
    },
    {
      title: 'Request Schedule', icon: '🗓️', key: 'reminder-schedule',
      gradient: 'from-cyan-700 via-cyan-600 to-teal-500',
      description: 'Jadwal & request pekerjaan team PTS',
      items: [{ name: 'Request Schedule', url: '/reminder-schedule', icon: '⏰', internal: true, embed: true }]
    },
    {
      title: 'Request Design Project', icon: '🏗️', key: 'request-design-project',
      gradient: 'from-violet-700 via-violet-600 to-violet-500',
      description: 'Solution request Design form untuk project Sales',
      items: [{ name: 'Submit Require', url: '/form-require-project', icon: '📋', internal: true, embed: true }]
    },
    {
      title: 'Form Review Demo & BAST', icon: '⭐', key: 'form-bast',
      gradient: 'from-slate-700 via-slate-600 to-slate-500',
      description: 'Platform review Demo Produk & BAST',
      items: [{ name: 'Platform Review', url: '/form-review', icon: '⭐', internal: true, embed: true }]
    },
    {
      title: 'Ticket Troubleshooting', icon: '🎫', key: 'ticket-troubleshooting',
      gradient: 'from-rose-700 via-rose-600 to-rose-500',
      description: 'Technical support & issue tracking',
      items: [{ name: 'Ticket Management', url: '/ticketing', icon: '🔧', internal: true, embed: true }]
    },
    {
      title: 'Piket Showroom', icon: '🏪', key: 'picket-showroom',
      gradient: 'from-teal-700 via-teal-600 to-cyan-500',
      description: 'Jadwal piket showroom Team PTS IVP, UMP & MVI',
      items: [{ name: 'Piket Showroom', url: '/picket-showroom', icon: '📅', internal: true, embed: true }]
    },
    {
      title: 'Daily Report', icon: '📈', key: 'daily-report',
      gradient: 'from-emerald-700 via-emerald-600 to-emerald-500',
      description: 'Activity tracking & performance metrics',
	  items: [{ name: 'Daily Report', url: '/daily-report', icon: '📅', internal: true, embed: true }]
    },
    {
      title: 'Database PTS', icon: '💼', key: 'database-pts',
      gradient: 'from-indigo-700 via-indigo-600 to-indigo-500',
      description: 'Central repository & documentation',
      items: [{ name: 'Access Database', url: 'https://1drv.ms/f/c/25d404c0b5ee2b43/IgBDK-61wATUIIAlAgQAAAAAAZWW6TamAlBHUnCoirmplNs', icon: '🗃️', embed: false, external: true }]
    },
    {
      title: 'Unit Movement Log', icon: '🚚', key: 'unit-movement',
      gradient: 'from-amber-700 via-amber-600 to-amber-500',
      description: 'Equipment check-in & check-out tracking',
      items: [{ name: 'Unit Movement Log', url: '/unit-movement', icon: '🚚', internal: true, embed: true }]
    },
    {
      title: 'Incentive PTS', icon: '💰', key: 'incentive-pts',
      gradient: 'from-indigo-700 via-indigo-600 to-purple-500',
      description: 'Kalkulasi & rekap incentive tim PTS',
      items: [{ name: 'Incentive PTS', url: '/incentive-pts', icon: '💰', internal: true, embed: true }]
    },
    {
      title: 'Project Progress', icon: '📊', key: 'project-progress',
      gradient: 'from-cyan-700 via-cyan-600 to-teal-500',
      description: 'Progres instalasi per proyek & per lokasi',
      items: [{ name: 'Project Progress', url: '/project-progress', icon: '📊', internal: true, embed: true }]
    },
    {
      title: 'KPI Team', icon: '📊', key: 'kpi-team',
      gradient: 'from-sky-700 via-sky-600 to-blue-500',
      description: 'Key Performance Indicators & analytics tim PTS',
      items: [{ name: 'KPI Team', url: '/kpi-team', icon: '📊', internal: true, embed: true }]
    },
  ];

  useEffect(() => {
    if (!currentUser) return;
    setMenuLoading(true);
    const timer = setTimeout(() => {
      const allowed = currentUser.allowed_menus;
      const roleLC = currentUser.role?.toLowerCase();
      if (!allowed || roleLC === 'superadmin' || roleLC === 'admin') {
        setVisibleMenuItems(allMenuItems);
      } else {
        // Always use allMenuItems order (code order), not allowed_menus DB order
        setVisibleMenuItems(allMenuItems.filter(m => allowed.includes(m.key)));
      }
      setMenuLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [currentUser]);

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
      setCurrentUser(data);
      setSession(data);
      // Pasang token PostgREST supaya seluruh query berikutnya membawa
      // identitas user - inilah yang membuat policy RLS bisa menyaring.
      setDbToken(result.db_token ?? null);
      // Permission-Aware Dashboard = homepage utk SEMUA role. Semua mendarat di
      // dashboard home (widget adaptif); tidak lagi auto-lompat ke menu pertama.
      autoNavigatedRef.current = true; // matikan auto-navigate useEffect

      /* Perpindahan ke dashboard ditunda supaya animasi penutup (lc-bongkar di
         globals.css) sempat jalan sampai habis. 1500ms = jeda 270ms + durasi
         1230ms milik animasi terakhir; angka ini WAJIB ikut berubah setiap
         durasi di globals.css diubah, kalau tidak halaman login dilepas dari
         DOM di tengah gerakan. Penundaan ini hanya dibayar saat orang benar
         benar menekan tombol login. */
      setMasukBerhasil(true);
      const pakaiAnimasi = typeof window !== 'undefined'
        && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.setTimeout(masukKeDashboard, pakaiAnimasi ? 1500 : 0);
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
      const { data: existing } = await supabase.from('users').select('id').eq('username', username.trim().toLowerCase()).maybeSingle();
      if (existing) { setRegisterErr('Email sudah terdaftar. Gunakan email lain.'); setRegisterLoading(false); return; }
      const { data: newUser, error } = await supabase.from('users').insert([{
        full_name: full_name.trim(),
        username: username.trim().toLowerCase(),
        role: 'guest',
        team_type: 'Pending Approval',
        sales_division: requestedDivision,
        jabatan: registerForm.jabatan.trim() || null,
        phone_number: registerForm.phone_number.trim() || null,
        allowed_menus: [],
      }]).select('id').single();
      if (error) throw error;
      // Simpan password via server route (hash + insert ke user_credentials di server,
      // supaya browser tak perlu menulis ke tabel kredensial).
      if (newUser?.id) {
        const credRes = await fetch('/api/auth/set-credential', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: newUser.id, password }),
        });
        if (!credRes.ok) {
          const j = await credRes.json().catch(() => ({}));
          throw new Error(j.error || 'Gagal menyimpan password.');
        }
      }
      setRegisterSuccess(true);
      // Notify all admins of new pending user
      notifyNewUserRegistration(full_name.trim(), newUser?.id ?? '').catch(() => {});
      setRegisterForm({ full_name: '', username: '', password: '', confirm_password: '', divisi: '', pts_type: '', sales_division: '', jabatan: '', phone_number: '' });
    } catch (err: any) {
      setRegisterErr('Registrasi gagal: ' + err.message);
    }
    setRegisterLoading(false);
  };

  const handleLogout = () => {
    autoNavigatedRef.current = false; // reset so next login re-navigates correctly
    setIsLoggedIn(false); setCurrentUser(null);
    /* Wajib: tanpa ini `masukBerhasil` tetap true selamanya, dan begitu
       halaman login dirender ulang setelah logout, kelas .lc-bongkar terpasang
       lagi dari awal. Animasinya `forwards`, jadi halaman yang baru saja muncul
       langsung terbongkar dan menyisakan layar kosong - persis bug yang dulu
       dilaporkan. sudahMasukRef juga direset supaya login BERIKUTNYA bisa
       memicu urutan keluar lagi, bukan cuma yang pertama. */
    setMasukBerhasil(false);
    setDasborMuncul(false);
    sudahMasukRef.current = false;
    clearSession();
    setShowSidebar(false); setIframeUrl(null); setShowTicketing(false); setInternalUrl('/ticketing');
    setShowAdminPanel(false); setShowUserProfile(false);
    router.push('/dashboard');
  };

  // Auto-navigate sales/guest to first allowed menu when sidebar opens
  // Uses autoNavigatedRef so this runs EXACTLY ONCE per login - no race conditions
  useEffect(() => {
    if (!isLoggedIn || !currentUser || !showSidebar) return;
    if (autoNavigatedRef.current) return; // already navigated this session
    const role = currentUser.role?.toLowerCase() ?? '';
    const isSalesGuest = ['guest','sales'].includes(role);
    const isRegularTeam = role === 'team' && !(currentUser.allowed_menus ?? []).includes('dashboard') && currentUser.jabatan !== 'Supervisor';
    if (isSalesGuest || isRegularTeam) {
      // Navigate to VISUAL FIRST menu - matches sidebar category order: LEARNING  PROJECT  INTERNAL DAILY
      // Using allowed[0] was wrong because sidebar groups by category, not by allowed_menus order
      const allowed = currentUser.allowed_menus ?? [];
      const categoryOrderedKey = [
        ...LEARNING_KEYS.filter(k => allowed.includes(k)),
        ...PROJECT_KEYS.filter(k => allowed.includes(k)),
        ...INTERNAL_DAILY_KEYS.filter(k => allowed.includes(k)),
      ][0] ?? null;
      const firstMenu = categoryOrderedKey
        ? allMenuItems.find(m => m.key === categoryOrderedKey)
        : null;
      if (!firstMenu) return;
      autoNavigatedRef.current = true; // mark before state updates to prevent concurrent fires
      const firstItem = firstMenu.items?.[0];
      const firstTitle = firstMenu.title ?? '';
      if (firstItem && firstItem.internal) {
        setIframeLoading(true);
        setInternalUrl(firstItem.url);
        setIframeTitle(`${firstTitle} - ${firstItem.name}`);
        setShowTicketing(true);
      } else if (firstItem && firstItem.embed && !firstItem.external) {
        setIframeLoading(true);
        setIframeUrl(firstItem.url);
        setIframeTitle(`${firstTitle} - ${firstItem.name}`);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, showSidebar, currentUser]);

  const handleMenuClick = (item: MenuItem['items'][0], menuTitle: string) => {
    if (item.external && !item.embed) { window.open(item.url, '_blank'); return; }
    setSidebarMobileOpen(false); // close overlay on mobile
    setIframeUrl(null); setShowTicketing(false); setInternalUrl('/ticketing'); setShowDashboardPanel(false);
    setIframeLoading(true);
    setTimeout(() => {
      if (item.internal) {
        setShowSidebar(true); setShowTicketing(true);
        setInternalUrl(item.url);
        setIframeTitle(`${menuTitle} - ${item.name}`);
      } else if (item.embed) {
        setShowSidebar(true); setIframeUrl(item.url);
        setIframeTitle(`${menuTitle} - ${item.name}`);
      }
    }, 150);
  };

  // Buka menu berdasarkan key (dipakai widget dashboard: Quick Action, "Lihat semua").
  const openMenuByKey = (key: string) => {
    const menu = allMenuItems.find(m => m.key === key);
    const item = menu?.items?.[0];
    if (menu && item) handleMenuClick(item, menu.title);
  };

  const handleNotifNavigate = (navInternalUrl: string, title: string) => {
    setIframeUrl(null); setShowTicketing(false); setInternalUrl('/ticketing'); setIframeTitle(''); setShowDashboardPanel(false);
    setTimeout(() => {
      setShowTicketing(true);
      setInternalUrl(navInternalUrl);
      setIframeTitle(title);
      setShowSidebar(true);
    }, 150);
  };

  // postMessage bridge
  // Receives CC_NAVIGATE messages from Command Center iframe and routes to the
  // matching menu item, so Quick Access buttons in Command Center work seamlessly.
  useEffect(() => {
    const handleMsg = (e: MessageEvent) => {
      if (!e.data) return;
      if (e.data.type === 'IFRAME_MODAL_OPEN' || e.data.type === 'IFRAME_MODAL_CLOSE') return;
      if (e.data.type !== 'CC_NAVIGATE') return;
      const url: string = e.data.url ?? '';
      if (!url) return;
      // Find the menu item whose url matches
      const match = allMenuItems.flatMap(m => m.items.map(it => ({ it, menu: m })))
        .find(({ it }) => it.url === url);
      if (match) {
        handleMenuClick(match.it, match.menu.title);
      } else {
        // Fallback: open as internal iframe directly
        setIframeUrl(null); setShowTicketing(true); setInternalUrl(url);
        setIframeTitle(''); setShowDashboardPanel(false); setIframeLoading(true);
      }
    };
    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMenuItems]);

  const handleBackToDashboard = () => {
    // Tidak kembali ke card view - untuk admin/supervisor: dashboard panel
    // Untuk sales/guest: navigasikan ke menu pertama yang tersedia
    setIframeUrl(null); setShowTicketing(false); setInternalUrl('/ticketing'); setIframeTitle('');
    const role = currentUser?.role?.toLowerCase() ?? '';
    const isAdm = ['admin','superadmin'].includes(role) ||
      (role === 'team' && (currentUser?.jabatan === 'Supervisor' || (currentUser?.allowed_menus ?? []).includes('dashboard')));
    if (isAdm) {
      setShowDashboardPanel(true);
    } else {
      // sales/guest: navigate to VISUAL first menu (category order, matches sidebar)
      const catOrdered = [
        ...visibleMenuItems.filter(m => LEARNING_KEYS.includes(m.key)),
        ...visibleMenuItems.filter(m => PROJECT_KEYS.includes(m.key)),
        ...visibleMenuItems.filter(m => INTERNAL_DAILY_KEYS.includes(m.key)),
      ];
      const firstMenu = catOrdered[0];
      const firstItem = firstMenu?.items?.[0];
      const firstTitle = firstMenu?.title ?? '';
      if (firstItem) {
        setIframeLoading(true);
        if (firstItem.internal) {
          setInternalUrl(firstItem.url);
          setIframeTitle(`${firstTitle} - ${firstItem.name}`);
          setShowTicketing(true);
        } else if (firstItem.embed && !firstItem.external) {
          setIframeUrl(firstItem.url);
          setIframeTitle(`${firstTitle} - ${firstItem.name}`);
        }
      }
    }
  };

  useEffect(() => {
    const load = async () => {
      const parsed = getSession<User>();
      if (!parsed) { setLoading(false); return; }
      try {
        setCurrentUser(parsed);
        setIsLoggedIn(true);
        const { data, error } = await supabase.from('users').select('id,username,full_name,role,team_type,sales_division,jabatan,phone_number,allowed_menus,kpi_enabled').eq('id', parsed.id).single();
        const userData: User = (!error && data) ? data : parsed;
        if (!error && data) {
          setCurrentUser(data);
          setSession(data);
        }
        // Permission-Aware Dashboard = homepage utk SEMUA role. Semua mendarat di
        // dashboard home saat reload; tidak lagi auto-lompat ke menu pertama.
        autoNavigatedRef.current = true; // matikan auto-navigate useEffect
        setShowSidebar(true); setShowDashboardPanel(true);
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, []);

  // isAdmin TETAP admin/superadmin murni - khusus tombol Admin Panel (kelola
  // akun, bukan sekadar lihat data). Lihat lib/constants.ts hasFullAccess.
  const isAdmin = ['admin', 'superadmin'].includes(currentUser?.role?.toLowerCase() ?? '');
  // Admin/superadmin, ATAU akun Team PTS dengan toggle "Full Access" aktif
  // (mis. Manager PTS) - dipakai untuk hal yang BUKAN kelola akun: lihat
  // badge pending, akses KPI penuh, dst.
  const isFullAccess = isAdmin || hasFullAccess(currentUser);

  // KPI: admin/full-access + PTS supervisor + sales supervisor (harus ada allowed_menus dashboard) + team member with dashboard permission
  const isPTSSupervisor = currentUser?.role === 'team'
    && ['Team PTS IVP', 'Team PTS UMP', 'Team PTS MVI'].includes(currentUser?.team_type ?? '')
    && currentUser?.jabatan === 'Supervisor';
  const isSalesSupervisor = ['guest', 'sales'].includes(currentUser?.role?.toLowerCase() ?? '')
    && ['Supervisor', 'Manager', 'Deputy General Manager', 'General Manager', 'Direktur'].includes(currentUser?.jabatan ?? '')
    && (currentUser?.allowed_menus ?? []).includes('dashboard');
  const hasTeamDashboardAccess = currentUser?.role === 'team'
    && (currentUser?.allowed_menus ?? []).includes('dashboard');
  const canAccessKPI = isFullAccess || isPTSSupervisor || isSalesSupervisor || hasTeamDashboardAccess;

  useEffect(() => {
    if (!isFullAccess) return;

    const refreshPendingCount = () => {
      // Hitung (1) user pending approval + (2) request jadwal sales yang belum di-assign
      Promise.all([
        supabase.from('users')
          .select('id', { count: 'exact', head: true })
          .eq('team_type', 'Pending Approval'),
        supabase.from('reminders')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_to', '')
          .eq('status', 'pending')
          .ilike('notes', '%[REQUEST SALES]%'),
      ]).then(([userRes, reminderRes]) => {
        setPendingUsers((userRes as any).count ?? 0);
        setPendingRequests((reminderRes as any).count ?? 0);
      });
    };

    refreshPendingCount();

    // Realtime: update badge saat ada request jadwal baru atau user baru daftar
    const ch = supabase.channel('admin-pending-count-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reminders' }, () => {
        setTimeout(refreshPendingCount, 400);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        setTimeout(refreshPendingCount, 400);
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [isAdmin]);

  const INTERNAL_KEYS = ['reminder-schedule', 'request-design-project', 'form-bast', 'ticket-troubleshooting', 'picket-showroom', 'kpi-team'];
  const PROJECT_KEYS = ['reminder-schedule', 'request-design-project', 'form-bast', 'ticket-troubleshooting', 'incentive-pts', 'project-progress'];
  const INTERNAL_DAILY_KEYS = ['picket-showroom', 'daily-report', 'database-pts', 'unit-movement'];
  const LEARNING_KEYS = ['kpi-team', 'learning-center', 'tech-note'];

  const projectMenuItems = visibleMenuItems.filter(m => PROJECT_KEYS.includes(m.key));
  const internalMenuItems = visibleMenuItems.filter(m => INTERNAL_DAILY_KEYS.includes(m.key));
  const learningMenuItems = visibleMenuItems.filter(m => LEARNING_KEYS.includes(m.key));

  const MENU_ICONS: Record<string, React.ReactElement> = {
    'learning-center': <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>,
	'picket-showroom': <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
    'reminder-schedule': <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    'request-design-project': <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
    'form-bast': <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
    'ticket-troubleshooting': <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>,
    'daily-report': <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    'database-pts': <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>,
    'unit-movement': <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>,
    'incentive-pts': <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    'tech-note': <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    'project-progress': <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m4 10V11m4 6v-4M4 19h16a1 1 0 001-1V6a1 1 0 00-1-1H4a1 1 0 00-1 1v12a1 1 0 001 1z" /></svg>,
    'kpi-team': <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    };

  function MenuLoadingOverlay() {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'rgba(226,168,75,0.3)', borderTopColor: '#e2a84b' }} />
          <p className="text-white/70 text-sm font-medium tracking-wide">Memuat menu...</p>
        </div>
      </div>
    );
  }

  function AnalyticsIframe() {
    const [iframeState, setIframeState] = useState<'loading' | 'ready' | 'error'>('loading');
    return (
      <div style={{ animation: 'fadeInUp 0.35s ease forwards', opacity: 0, height: '85vh', position: 'relative' }}>
        {iframeState === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/10 rounded-3xl z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'rgba(226,168,75,0.3)', borderTopColor: '#e2a84b' }} />
              <p className="text-white/70 text-sm">Memuat analytics...</p>
            </div>
          </div>
        )}
        {iframeState === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/5 rounded-3xl z-10">
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="text-4xl">📊</span>
              <p className="text-white/80 font-semibold">Analytics tidak dapat dimuat</p>
              <p className="text-white/50 text-sm">Coba refresh halaman</p>
              <button onClick={() => setIframeState('loading')} className="mt-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all">
                Coba Lagi
              </button>
            </div>
          </div>
        )}
        <iframe
          src="/analytics-dashboard"
          className="w-full h-full border-0 rounded-3xl overflow-hidden"
          style={{ boxShadow: '0 4px 32px rgba(0,0,0,0.12)', opacity: iframeState === 'ready' ? 1 : 0, transition: 'opacity 0.3s' }}
          title="Analytics Dashboard"
          onLoad={() => setIframeState('ready')}
          onError={() => setIframeState('error')}
        />
      </div>
    );
  }

  const renderMenuCard = (menu: MenuItem, index: number, accentColor: string) => {
    const isSingleInternal = menu.items.length === 1 && menu.items[0].internal;
    return (
      <div key={menu.key}
        className={`rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white ${isSingleInternal ? 'cursor-pointer group' : ''}`}
        style={{ animation: `fadeInUp 0.5s ease forwards`, animationDelay: `${index * 80}ms`, opacity: 0 }}
        onClick={isSingleInternal ? () => handleMenuClick(menu.items[0], menu.title) : undefined}
      >
        <div className={`bg-gradient-to-br ${menu.gradient} ${isSingleInternal ? 'p-6 md:p-8' : 'p-5 md:p-6'} relative overflow-hidden`}>
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white" />
            <div className="absolute -left-2 -bottom-2 w-16 h-16 rounded-full bg-white" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="text-4xl">{menu.icon}</div>
              <h3 className="text-xl font-bold tracking-tight text-white leading-tight">{menu.title}</h3>
            </div>
            <p className="text-white/90 text-sm font-medium line-clamp-2">{menu.description}</p>
          </div>
        </div>
        {!isSingleInternal && (
          <div className="p-5 space-y-3">
            {menu.items.map((item, itemIndex) => (
              <button key={itemIndex} onClick={e => { e.stopPropagation(); handleMenuClick(item, menu.title); }}
                className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 text-slate-800 px-5 py-4 rounded-md font-semibold shadow-sm hover:shadow-md transition-all text-right flex items-center justify-end gap-4 group/item">
                {item.external && !item.embed ? (
                  <svg aria-hidden="true" focusable="false" className="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                ) : (
                  <svg aria-hidden="true" focusable="false" className="w-5 h-5 text-slate-400 transition-transform group-hover/item:-translate-x-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                )}
                <span className="flex-1 text-sm tracking-wide text-right">{item.name}</span>
                <div className="w-10 h-10 bg-white rounded-md shadow-sm flex items-center justify-center text-xl border border-slate-200 group-hover/item:scale-110 transition-transform flex-shrink-0">{item.icon}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // LOADING
  if (loading) {
    return (
      <div className="flex items-center justify-center bg-cover bg-center bg-fixed" style={{ backgroundImage: 'url(/IVP_Background.png)', minHeight: '100dvh' }}>
        <div className="flex flex-col items-center gap-4 px-10 py-8 rounded-2xl" style={{ background: 'rgba(255,255,255,0.92)', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
          <div className="w-12 h-12 rounded-full border-4 border-t-rose-600 border-rose-200 animate-spin" />
          <p className="text-slate-700 font-semibold">Memuat portal...</p>
        </div>
      </div>
    );
  }

  // LOGIN / REGISTER SCREEN
  if (!isLoggedIn) {
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
          <p className="text-white/55 text-xs">© 2026 {merek.namaPerusahaan}</p>
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
                <span className="text-lg font-bold text-slate-800">{merek.namaPlatform} <span className="text-slate-400 font-normal">· {merek.namaPortal}</span></span>
              </div>
              <h2 className="text-3xl font-bold text-slate-800 tracking-tight">{showRegister ? 'Buat Akun Baru' : 'Selamat Datang'}</h2>
              <p className="text-slate-500 text-sm mt-1.5">{showRegister ? 'Lengkapi data untuk mendaftar. Akun akan diverifikasi admin.' : 'Masuk ke akun Anda untuk melanjutkan'}</p>
            </div>

            {!showRegister && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold mb-2 text-slate-600 tracking-widest uppercase">Email</label>
                  <input type="text" value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:border-rose-500 focus:ring-2 focus:ring-rose-100 transition-all bg-white text-slate-800 font-medium text-sm outline-none"
                    placeholder="email@perusahaan.com" onKeyDown={(e) => e.key === 'Enter' && handleLogin()} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-2 text-slate-600 tracking-widest uppercase">Password</label>
                  <input type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:border-rose-500 focus:ring-2 focus:ring-rose-100 transition-all bg-white text-slate-800 font-medium text-sm outline-none"
                    placeholder="Enter your password" onKeyDown={(e) => { if (e.key === 'Enter') { setLoginErr(''); handleLogin(); } }} />
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
                    <>🔐 Sign In to Portal</>
                  )}
                </button>
                <p className="text-center text-xs text-slate-400 pt-1">
                  Belum punya akun? <button onClick={() => pindahForm(true)} className="text-indigo-600 font-bold hover:underline">Daftar di sini</button>
                  <span className="mx-2 text-slate-300">|</span>
                  <button onClick={() => { setShowForgot(true); setForgotStep('request'); setForgotMsg(null); }} className="font-bold hover:underline" style={{ color: merek.warnaUtama }}>Lupa Password?</button>
                </p>
              </div>
            )}

            {showRegister && (
              <div>
                {registerSuccess ? (
                  <div className="text-center py-6">
                    <div className="text-5xl mb-4">✅</div>
                    <h3 className="font-bold text-slate-800 text-lg mb-2">Pendaftaran Berhasil!</h3>
                    <p className="text-slate-500 text-sm mb-4">Akun kamu akan diverifikasi oleh admin. Kamu akan dihubungi setelah akun diaktifkan.</p>
                    <button onClick={() => pindahForm(false)} className="text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all hover:opacity-90" style={{ background: merek.warnaUtama }}>Kembali ke Login</button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                      {/* Kolom Kiri */}
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-bold mb-1.5 text-slate-600 tracking-widest uppercase">Nama Lengkap *</label>
                          <input type="text" value={registerForm.full_name} onChange={e => setRegisterForm({ ...registerForm, full_name: e.target.value })}
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="Nama lengkap" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold mb-1.5 text-slate-600 tracking-widest uppercase">Email *</label>
                          <input type="email" value={registerForm.username} onChange={e => setRegisterForm({ ...registerForm, username: e.target.value })}
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="email@perusahaan.com" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold mb-1.5 text-slate-600 tracking-widest uppercase">Password *</label>
                          <input type="password" value={registerForm.password} onChange={e => setRegisterForm({ ...registerForm, password: e.target.value })}
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="min. 8 karakter, ada kapital & angka" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold mb-1.5 text-slate-600 tracking-widest uppercase">Konfirmasi Password *</label>
                          <input type="password" value={registerForm.confirm_password} onChange={e => setRegisterForm({ ...registerForm, confirm_password: e.target.value })}
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="ulangi password" />
                        </div>
                      </div>
                      {/* Kolom Kanan */}
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-bold mb-1.5 text-slate-600 tracking-widest uppercase">Divisi *</label>
                          <select aria-label="-- Pilih Divisi --" value={registerForm.divisi} onChange={e => setRegisterForm({ ...registerForm, divisi: e.target.value, pts_type: '', sales_division: '' })}
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all bg-white">
                            <option value="">-- Pilih Divisi --</option>
                            <option value="PTS">PTS</option>
                            <option value="Sales">Sales</option>
                            <option value="Marketing">Marketing</option>
                          </select>
                        </div>
                        {registerForm.divisi === 'PTS' && (
                          <div>
                            <label className="block text-xs font-bold mb-1.5 text-slate-600 tracking-widests uppercase">Tipe PTS *</label>
                            <select aria-label="-- Pilih Tipe PTS --" value={registerForm.pts_type} onChange={e => setRegisterForm({ ...registerForm, pts_type: e.target.value })}
                              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all bg-white">
                              <option value="">-- Pilih Tipe PTS --</option>
                              <option value="PTS IVP">PTS IVP</option>
                              <option value="PTS UMP">PTS UMP</option>
                              <option value="PTS MVI">PTS MVI</option>
                            </select>
                          </div>
                        )}
                        {(registerForm.divisi === 'Sales' || registerForm.divisi === 'Marketing') && (
                          <div>
                            <label className="block text-xs font-bold mb-1.5 text-slate-600 tracking-widest uppercase">
                              {registerForm.divisi === 'Marketing' ? 'Marketing Division *' : 'Sales Division *'}
                            </label>
                            <select value={registerForm.sales_division} onChange={e => setRegisterForm({ ...registerForm, sales_division: e.target.value })}
                              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all bg-white">
                              <option value="">-- Pilih {registerForm.divisi} Division --</option>
                              {daftarDivisi.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                          </div>
                        )}
                        <div>
                          <label className="block text-xs font-bold mb-1.5 text-slate-600 tracking-widest uppercase">Jabatan / Posisi</label>
                          <select aria-label="— Pilih Jabatan —" value={registerForm.jabatan} onChange={e => setRegisterForm({ ...registerForm, jabatan: e.target.value })}
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all bg-white">
                            <option value="">— Pilih Jabatan —</option>
                            {JABATAN_LIST.map(j => <option key={j} value={j}>{JABATAN_CONFIG[j].icon} {j}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold mb-1.5 text-slate-600 tracking-widest uppercase">No. HP</label>
                          <input type="text" value={registerForm.phone_number} onChange={e => setRegisterForm({ ...registerForm, phone_number: e.target.value })}
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="08xx..." />
                        </div>
                      </div>
                    </div>
                    {registerErr && (
                      <div className="px-4 py-2.5 rounded-xl text-sm font-medium text-red-700 bg-red-50 border border-red-200">{registerErr}</div>
                    )}
                    <button onClick={() => { setRegisterErr(''); handleRegister(); }} disabled={registerLoading}
                      className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 text-white py-3.5 rounded-xl font-bold shadow-lg transition-all text-sm disabled:opacity-60 flex items-center justify-center gap-2">
                      {registerLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                      📝 Daftar Akun
                    </button>
                    <p className="text-center text-xs text-slate-400">Sudah punya akun? <button onClick={() => pindahForm(false)} className="font-bold hover:underline" style={{ color: merek.warnaUtama }}>Login</button></p>
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
                <h3 className="text-base font-bold text-slate-800">🔐 Reset Password</h3>
                <button aria-label="Tutup" onClick={() => setShowForgot(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg leading-none">✕</button>
              </div>
              {forgotMsg && (
                <div className={`px-3 py-2 rounded-lg text-xs font-semibold ${forgotMsg.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                  {forgotMsg.text}
                </div>
              )}
              {forgotStep === 'request' ? (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">Masukkan email (atau username lama) kamu. Kode OTP akan dikirim ke nomor WhatsApp yang terdaftar.</p>
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
                    className="w-full text-xs text-slate-400 hover:text-rose-500 transition-all">
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

  // SHARED HEADER JSX
  const renderHeader = (withBackBtn = false) => (
    <div className="bg-white/80 backdrop-blur-md shadow-md flex-shrink-0" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', position: 'relative', zIndex: 50 }}>
      <div className="w-full px-3 md:px-4 py-3 md:py-3.5">
        <div className="flex items-center justify-between gap-2 md:gap-4">
          {/* LEFT: Logo */}
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            <LogoMerek ukuran="sm" className="md:hidden" />
            <LogoMerek ukuran="md" className="hidden md:flex" />
            <div>
              <div className="flex items-center gap-1.5 md:gap-2.5">
                <h1 className="text-sm md:text-xl font-bold text-slate-800 tracking-tight leading-tight">
                  <span className="hidden sm:inline">{merek.namaPlatform}</span>
                  <span className="sm:hidden">{merek.namaPlatformSingkat}</span>
                </h1>
                <span className="hidden sm:inline text-slate-300 font-light">|</span>
                <span className="hidden sm:inline text-xs md:text-sm font-bold tracking-wide" style={{ color: merek.warnaAksen }}>{merek.namaPortal}</span>
              </div>
              <p className="text-slate-500 text-[10px] md:text-xs font-medium mt-0.5 hidden sm:block">{merek.namaPerusahaan}</p>
            </div>
          </div>

          {/* CENTER — spacer */}
          <div className="flex-1" />

          {/* RIGHT */}
          <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
            {/* Mobile hamburger — only when sidebar is open (in sidebar mode) */}
            {showSidebar && (
              <button aria-label="Menu"
                onClick={() => setSidebarMobileOpen(o => !o)}
                className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
                style={{ background: sidebarMobileOpen ? 'rgba(200,134,29,0.15)' : 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.08)', color: '#64748b' }}
                title="Menu">
                {sidebarMobileOpen
                  ? <svg aria-hidden="true" focusable="false" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  : <svg aria-hidden="true" focusable="false" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg>
                }
              </button>
            )}
            {/* Global Search icon — sebelah kiri notif */}
            {currentUser && (
              <GlobalSearch
                currentUser={currentUser}
                onNavigate={(url, searchQuery) => {
                  setIframeUrl(null); setShowTicketing(false); setInternalUrl(url); setIframeTitle(''); setShowDashboardPanel(false);
                  setTimeout(() => { setShowTicketing(true); setShowSidebar(true); }, 150);
                }}
              />
            )}
            {/* NotificationBar — selalu di kanan */}
            {currentUser && (
              <NotificationBar currentUser={currentUser} onNavigate={handleNotifNavigate} />
            )}
            {/* User badge — hanya di main menu (non-sidebar), hidden di mobile kecil */}
            {!showSidebar && (
              <div className="hidden md:flex items-center gap-2.5 px-4 py-2 rounded-xl border border-slate-200/80 bg-white/70 backdrop-blur-sm">
                <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #fde68a, #f59e0b)', color: '#78350f' }}>
                  {currentUser?.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
                </div>
                <div className="leading-tight">
                  <p className="text-xs font-bold text-slate-800">{currentUser?.full_name}</p>
                  <p className="text-[9px] font-bold tracking-widest uppercase text-amber-600">{currentUser?.role}</p>
                </div>
              </div>
            )}

            {/* Mobile: avatar only */}
            {!showSidebar && (
              <div className="md:hidden w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #fde68a, #f59e0b)', color: '#78350f' }}>
                {currentUser?.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
              </div>
            )}

            {/* User Profile — hidden di mobile */}
            {!showSidebar && (
              <button onClick={() => setShowUserProfile(true)}
                className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: '#065f46' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(16,185,129,0.15)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(16,185,129,0.08)'; }}>
                <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                User Profile
              </button>
            )}

            {/* Sign Out */}
            {!showSidebar && (
              <button onClick={handleLogout}
                className="flex items-center gap-1.5 px-2 md:px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.22)', color: '#b91c1c' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.13)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.07)'; }}>
                <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            )}
          </div>
        </div>
      </div>

    </div>
  );

  // MODAL RENDERS (shared)
  const renderModals = () => (
    <>
      {showAdminPanel && <AdminPanelModal initialTab={adminPanelTab} onClose={() => setShowAdminPanel(false)} />}
      {showUserProfile && currentUser && <UserProfileModal currentUser={currentUser} onClose={() => setShowUserProfile(false)} />}
    </>
  );

  // VIEW: NO SIDEBAR (main dashboard)
  if (!showSidebar) {
    return (
      <div className={`${dasborMuncul ? 'lc-dasbor-muncul' : ''} flex flex-col bg-cover bg-center bg-fixed`} style={{ backgroundImage: 'url(/IVP_Background.png)', height: '100dvh' }}>
        {renderModals()}
        {/* ── Jelajahi Button (always visible while logged-in, before sidebar loads) ── */}
        {currentUser && !tourVisible && (
          <JelajahiButton onClick={() => setShowTour(true)} />
        )}
        {renderHeader()}

        <div className="flex-1 overflow-y-auto py-6 px-4 md:px-8">
          <div className="max-w-[1600px] mx-auto space-y-8">
            {menuLoading ? <MenuLoadingOverlay /> : (
              <>
                {/* ── Analytics Dashboard — admin, PTS sup, sales sup ── */}
                {canAccessKPI && currentUser && (
                  <AnalyticsIframe />
                )}
				{/* ── Learning Center section (BARU) ── */}
                {learningMenuItems.length > 0 && (
                  <div style={{ animation: 'fadeInUp 0.45s ease 0.2s forwards', opacity: 0 }}>
                    <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-xl"
                      style={{ background: 'rgba(15,23,42,0.72)', backdropFilter: 'blur(8px)', boxShadow: '0 2px 12px rgba(0,0,0,0.25)' }}>
                      <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #60a5fa, #4338ca)' }}>
                        <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 14l9-5-9-5-9 5 9 5z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                        </svg>
                      </div>
                      <span className="text-white font-bold text-sm tracking-wide">Learning Center</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      {learningMenuItems.map((menu, i) => renderMenuCard(menu, i, '#4338ca'))}
                    </div>
                  </div>
                )}
                {/* Project section */}
                {projectMenuItems.length > 0 && (
                  <div style={{ animation: 'fadeInUp 0.45s ease forwards', opacity: 0 }}>
                    <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-xl"
                      style={{ background: 'rgba(15,23,42,0.72)', backdropFilter: 'blur(8px)', boxShadow: '0 2px 12px rgba(0,0,0,0.25)' }}>
                      <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #38bdf8, #0284c7)' }}>
                        <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <span className="text-white font-bold text-sm tracking-wide">Project</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      {projectMenuItems.map((menu, i) => renderMenuCard(menu, i, '#0ea5e9'))}
                    </div>
                  </div>
                )}

                {/* Internal Daily section */}
                {internalMenuItems.length > 0 && (
                  <div style={{ animation: 'fadeInUp 0.45s ease 0.1s forwards', opacity: 0 }}>
                    <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-xl"
                      style={{ background: 'rgba(15,23,42,0.72)', backdropFilter: 'blur(8px)', boxShadow: '0 2px 12px rgba(0,0,0,0.25)' }}>
                      <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #34d399, #059669)' }}>
                        <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <span className="text-white font-bold text-sm tracking-wide">Internal Daily</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {internalMenuItems.map((menu, i) => renderMenuCard(menu, i, '#10b981'))}
                    </div>
                  </div>
                )}

              </>
            )}
          </div>
        </div>

        <div className="bg-white/70 backdrop-blur-sm border-t border-slate-200/60 flex-shrink-0">
          <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-3 md:py-4">
            <p className="text-slate-500 text-xs font-medium tracking-wide text-center">© 2026 IndoVisual — Work Management Support (PTS IVP)</p>
          </div>
        </div>

        <style>{`
          @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
          @keyframes dropIn { from { opacity: 0; transform: translateY(-8px) scale(0.97); } to { opacity: 1; transform: none; } }
        `}</style>
      </div>
    );
  }

  // VIEW: SIDEBAR
  return (
    <div className={`${dasborMuncul ? 'lc-dasbor-muncul' : ''} flex flex-col bg-cover bg-center bg-fixed`} style={{ backgroundImage: 'url(/IVP_Background.png)', height: '100dvh' }}>
      {isLoggedIn && <SessionExpiryBanner />}
      {renderModals()}

      {/* ── Onboarding Tour + floating button (sidebar view — stable mount) ── */}
      {currentUser && (
        <>
          <OnboardingTour
            currentUser={currentUser}
            visibleMenuKeys={visibleMenuItems.map(m => m.key)}
            forceShow={showTour}
            onDone={() => setShowTour(false)}
            onHighlightKey={setTourHighlightKey}
            onVisibleChange={setTourVisible}
          />
          {!tourVisible && (
            <JelajahiButton onClick={() => setShowTour(true)} />
          )}
        </>
      )}
      {renderHeader()}

      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* Mobile sidebar backdrop */}
        {sidebarMobileOpen && (
          <div
            className="fixed inset-0 z-[180] md:hidden"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
            onClick={() => setSidebarMobileOpen(false)}
          />
        )}

        {/* SIDEBAR */}
        <div
          className={`
            flex flex-col transition-all duration-300 ease-in-out flex-shrink-0
            ${sidebarCollapsed ? 'w-[48px] md:w-[64px]' : 'w-[220px] md:w-[272px]'}
            md:relative
            fixed top-0 bottom-0 left-0 z-[190]
            ${sidebarMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}
          style={{
            background: 'rgba(255,255,255,0.96)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '2px 0 20px rgba(0,0,0,0.10)',
            borderRight: '1px solid rgba(0,0,0,0.07)',
            // On desktop: position:static so it participates in flex layout
            // On mobile: fixed overlay (overridden by Tailwind fixed above)
            ...(tourVisible ? { zIndex: 1505 } : {}),
          }}
        >
          {/* Top accent line */}
          <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, #c8861d 40%, #e2a84b 60%, transparent)' }} />

          {/* Collapse button — absolute top-right */}
          {!sidebarCollapsed && (
            <button aria-label="Collapse sidebar"
              onClick={() => setSidebarCollapsed(true)}
              className="absolute top-2 right-2 z-10 w-6 h-6 rounded-md flex items-center justify-center transition-all"
              style={{ color: '#cbd5e1' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.06)'; (e.currentTarget as HTMLButtonElement).style.color = '#64748b'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#cbd5e1'; }}
              title="Collapse sidebar"
            >
              <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* ── SIDEBAR SCROLLABLE CONTENT ── */}
          <div className="flex-1 overflow-y-auto py-3 px-2.5" style={{ scrollbarWidth: 'none' }}>

            {menuLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'rgba(226,168,75,0.35)', borderTopColor: '#e2a84b' }} />
              </div>
            ) : sidebarCollapsed ? (
              /* Collapsed: icon-only */
              <div className="space-y-1">
                {/* Expand button - top */}
                <button aria-label="Main Menu"
                  onClick={() => setSidebarCollapsed(false)}
                  className="w-full h-9 rounded-lg flex items-center justify-center transition-all mb-1"
                  style={{ color: '#94a3b8' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.06)'; (e.currentTarget as HTMLButtonElement).style.color = '#334155'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; }}
                  title="Main Menu"
                >
                  <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => { setShowDashboardPanel(true); setShowTicketing(false); setIframeUrl(null); }}
                  title="Dashboard"
                  aria-label="Dashboard"
                  aria-current={showDashboardPanel ? 'page' : undefined}
                  className="w-full h-9 rounded-lg flex items-center justify-center text-base transition-all"
                  style={showDashboardPanel
                    ? { background: 'rgba(200,134,29,0.15)', border: '1px solid rgba(200,134,29,0.35)', color: '#92600a' }
                    : { background: 'transparent', border: '1px solid transparent', color: '#64748b' }}
                >🏠</button>
                {visibleMenuItems.map((menu) => (
                  <div key={menu.key}>
                    {menu.items.map((item, itemIndex) => {
                      const isActive = !showDashboardPanel && ((showTicketing && item.internal && internalUrl === item.url) || (iframeUrl === item.url));
                      return (
                        <button
                          key={itemIndex}
                          onClick={() => { setShowDashboardPanel(false); handleMenuClick(item, menu.title); }}
                          title={`${menu.title} — ${item.name}`}
                          className="relative w-full h-9 rounded-lg flex items-center justify-center text-base transition-all"
                          style={
                            isActive
                              ? { background: 'rgba(200,134,29,0.15)', border: '1px solid rgba(200,134,29,0.35)', color: '#92600a' }
                              : { background: 'transparent', border: '1px solid transparent', color: '#64748b' }
                          }
                          onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.06)'; }}
                          onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                        >
                          {MENU_ICONS[menu.key] ?? <span>{menu.icon}</span>}
                          {/* Antrean request jadwal muncul DI SINI — di menu yang
                              benar-benar memuatnya, bukan di ikon Admin Panel. */}
                          {menu.key === 'reminder-schedule' && isAdmin && pendingRequests > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                              {pendingRequests}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : (
              /* Expanded: full nav */
              <div className="space-y-4">

                {/* ── Dashboard/Home item (untuk SEMUA role — homepage adaptif) ── */}
                <div>
                  <button
                    onClick={() => { setShowDashboardPanel(true); setShowTicketing(false); setIframeUrl(null); }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all"
                    style={showDashboardPanel
                      ? { background: 'rgba(200,134,29,0.12)', border: '1px solid rgba(200,134,29,0.30)', color: '#92600a' }
                      : { background: 'transparent', border: '1px solid transparent', color: '#475569' }}
                    onMouseEnter={e => { if (!showDashboardPanel) { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.04)'; } }}
                    onMouseLeave={e => { if (!showDashboardPanel) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; } }}
                  >
                    <span className="w-5 h-5 text-sm flex items-center justify-center flex-shrink-0">🏠</span>
                    <span className="text-sm font-semibold truncate">Dashboard</span>
                    {showDashboardPanel && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />}
                  </button>
                </div>

                {/* Learning Center section */}
                {visibleMenuItems.filter(m => LEARNING_KEYS.includes(m.key)).length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 px-1 mb-1.5">
                      <span className="text-[10px] font-bold tracking-[0.14em] uppercase" style={{ color: 'rgba(0,0,0,0.38)' }}>Learning</span>
                      <div className="flex-1 h-px" style={{ background: 'rgba(0,0,0,0.08)' }} />
                    </div>
                    <div className="space-y-0.5">
                      {visibleMenuItems.filter(m => LEARNING_KEYS.includes(m.key)).map(menu => {
                        if (menu.items.length === 1) {
                          const item = menu.items[0];
                          const isActive = (showTicketing && item.internal && internalUrl === item.url) || (iframeUrl === item.url);
                          const isTourHL = tourHighlightKey === menu.key;
                          return (
                            <button
                              key={menu.key}
                              id={`tour-menu-${menu.key}`}
                              onClick={() => handleMenuClick(item, menu.title)}
                              aria-current={isActive ? 'page' : undefined}
                              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all"
                              style={
                                isTourHL
                                  ? { background: 'rgba(250,204,21,0.13)', border: '1.5px solid rgba(250,204,21,0.65)', color: '#334155', animation: 'tourMenuPulse 1.6s ease-in-out infinite', position: 'relative', zIndex: 1510 }
                                  : isActive
                                    ? { background: 'rgba(67,56,202,0.10)', border: '1px solid rgba(67,56,202,0.25)', color: '#3730a3' }
                                    : { background: 'transparent', border: '1px solid transparent', color: '#334155' }
                              }
                              onMouseEnter={e => { if (!isActive && !isTourHL) { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(67,56,202,0.05)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(67,56,202,0.12)'; } }}
                              onMouseLeave={e => { if (!isActive && !isTourHL) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'; } }}
                            >
                              <span
                                className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 transition-colors"
                                style={{
                                  background: isActive ? 'rgba(67,56,202,0.15)' : 'rgba(0,0,0,0.06)',
                                  color: isActive ? '#3730a3' : '#64748b',
                                }}
                              >
                                {MENU_ICONS[menu.key] ?? <span>{menu.icon}</span>}
                              </span>
                              <span className="flex-1 truncate text-sm font-medium">{menu.title}</span>
                              {isActive && (
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#4338ca' }} />
                              )}
                            </button>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                )}

                {/* Project section */}
                {visibleMenuItems.filter(m => PROJECT_KEYS.includes(m.key)).length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 px-1 mb-1.5">
                      <span className="text-[10px] font-bold tracking-[0.14em] uppercase" style={{ color: 'rgba(0,0,0,0.38)' }}>Project</span>
                      <div className="flex-1 h-px" style={{ background: 'rgba(0,0,0,0.08)' }} />
                    </div>
                    <div className="space-y-0.5">
                      {visibleMenuItems.filter(m => PROJECT_KEYS.includes(m.key)).map(menu => {
                        if (menu.items.length === 1) {
                          const item = menu.items[0];
                          const isActive = (showTicketing && item.internal && internalUrl === item.url) || (iframeUrl === item.url);
                          const isTourHL = tourHighlightKey === menu.key;
                          return (
                            <button
                              key={menu.key}
                              id={`tour-menu-${menu.key}`}
                              onClick={() => handleMenuClick(item, menu.title)}
                              aria-current={isActive ? 'page' : undefined}
                              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all"
                              style={
                                isTourHL
                                  ? { background: 'rgba(250,204,21,0.13)', border: '1.5px solid rgba(250,204,21,0.65)', color: '#334155', animation: 'tourMenuPulse 1.6s ease-in-out infinite', position: 'relative', zIndex: 1510 }
                                  : isActive
                                    ? { background: 'rgba(200,134,29,0.11)', border: '1px solid rgba(200,134,29,0.28)', color: '#92600a' }
                                    : { background: 'transparent', border: '1px solid transparent', color: '#334155' }
                              }
                              onMouseEnter={e => { if (!isActive && !isTourHL) { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.05)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,0,0,0.06)'; } }}
                              onMouseLeave={e => { if (!isActive && !isTourHL) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'; } }}
                            >
                              <span
                                className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 transition-colors"
                                style={{
                                  background: isActive ? 'rgba(200,134,29,0.18)' : 'rgba(0,0,0,0.06)',
                                  color: isActive ? '#92600a' : '#64748b',
                                }}
                              >
                                {MENU_ICONS[menu.key] ?? <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth={2} /></svg>}
                              </span>
                              <span className="flex-1 truncate text-sm font-medium">{menu.title}</span>
                              {isActive && (
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#c8861d' }} />
                              )}
                            </button>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                )}

                {/* Internal Daily section */}
                {visibleMenuItems.filter(m => INTERNAL_DAILY_KEYS.includes(m.key)).length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 px-1 mb-1.5">
                      <span className="text-[10px] font-bold tracking-[0.14em] uppercase" style={{ color: 'rgba(0,0,0,0.38)' }}>Internal Daily</span>
                      <div className="flex-1 h-px" style={{ background: 'rgba(0,0,0,0.08)' }} />
                    </div>
                    <div className="space-y-0.5">
                      {visibleMenuItems.filter(m => INTERNAL_DAILY_KEYS.includes(m.key)).flatMap(menu =>
                        menu.items.map((item, itemIndex) => {
                          const isActive = (showTicketing && item.internal && internalUrl === item.url) || (iframeUrl === item.url);
                          const isTourHL = tourHighlightKey === menu.key;
                          return (
                            <button
                              key={`${menu.key}-${itemIndex}`}
                              id={`tour-menu-${menu.key}`}
                              onClick={() => handleMenuClick(item, menu.title)}
                              aria-current={isActive ? 'page' : undefined}
                              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all"
                              style={
                                isTourHL
                                  ? { background: 'rgba(250,204,21,0.13)', border: '1.5px solid rgba(250,204,21,0.65)', color: '#334155', animation: 'tourMenuPulse 1.6s ease-in-out infinite', position: 'relative', zIndex: 1510 }
                                  : isActive
                                    ? { background: 'rgba(200,134,29,0.11)', border: '1px solid rgba(200,134,29,0.28)', color: '#92600a' }
                                    : { background: 'transparent', border: '1px solid transparent', color: '#334155' }
                              }
                              onMouseEnter={e => { if (!isActive && !isTourHL) { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.05)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,0,0,0.06)'; } }}
                              onMouseLeave={e => { if (!isActive && !isTourHL) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'; } }}
                            >
                              <span
                                className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 transition-colors"
                                style={{
                                  background: isActive ? 'rgba(200,134,29,0.18)' : 'rgba(0,0,0,0.06)',
                                  color: isActive ? '#92600a' : '#64748b',
                                }}
                              >
                                {MENU_ICONS[menu.key] ?? <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth={2} /></svg>}
                              </span>
                              <span className="flex-1 truncate text-sm font-medium">{item.name}</span>
                          {/* Antrean request jadwal muncul DI SINI — di menu yang
                              benar-benar memuatnya, bukan di ikon Admin Panel. */}
                              {menu.key === 'reminder-schedule' && isAdmin && pendingRequests > 0 && (
                                <span className="text-[10px] font-black bg-red-500 text-white rounded-full px-1.5 py-0.5 leading-none flex-shrink-0">
                                  {pendingRequests}
                                </span>
                              )}
                              {item.external && !item.embed && (
                                <svg aria-hidden="true" focusable="false" className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              )}
                              {isActive && !item.external && (
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#c8861d' }} />
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}


              </div>
            )}
          </div>

          {/* ── SIDEBAR FOOTER: User + Admin + Sign Out ── */}
          <div className="flex-shrink-0" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
            {sidebarCollapsed ? (
              /* Collapsed footer */
              <div className="py-2 px-1.5 flex flex-col items-center gap-1.5">
                {/* Avatar */}
                <button aria-label={currentUser?.full_name ?? ''}
                  onClick={() => setShowUserProfile(true)}
                  className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 transition-all"
                  style={{ background: 'linear-gradient(135deg, #fde68a, #f59e0b)', color: '#78350f' }}
                  title={currentUser?.full_name ?? ''}
                >
                  {currentUser?.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
                </button>

                {/* Admin */}
                {isAdmin && (
                  <button
                    onClick={() => { setAdminPanelTab('settings'); setShowAdminPanel(true); }}
                    className="relative w-9 h-9 rounded-lg flex items-center justify-center transition-all"
                    style={{ color: '#94a3b8' }}
                    title={pendingUsers > 0 ? `Admin Panel — ${pendingUsers} user menunggu persetujuan` : 'Admin Panel'}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#4338ca'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.1)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                  >
                    <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {pendingUsers > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">{pendingUsers}</span>
                    )}
                  </button>
                )}

                {/* Sign out */}
                <button aria-label="Sign Out"
                  onClick={handleLogout}
                  className="w-9 h-9 rounded-lg flex items-center justify-center transition-all"
                  style={{ color: '#94a3b8' }}
                  title="Sign Out"
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#b91c1c'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.07)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                >
                  <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            ) : (
              /* Expanded footer */
              <div className="p-3 space-y-1">

                {/* User profile row */}
                <button
                  onClick={() => setShowUserProfile(true)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-left"
                  style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.07)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(200,134,29,0.22)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.03)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,0,0,0.06)'; }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #fde68a, #f59e0b)', color: '#78350f' }}
                  >
                    {currentUser?.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate leading-tight" style={{ color: '#1e293b' }}>{currentUser?.full_name ?? '-'}</p>
                    <p className="text-[10px] font-bold tracking-widest uppercase mt-0.5" style={{ color: '#c8861d' }}>{currentUser?.role ?? '-'}</p>
                  </div>
                  <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{ color: '#94a3b8' }}>
                    <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>

                {/* Admin Panel */}
                {isAdmin && (
                  <button
                    onClick={() => { setAdminPanelTab('settings'); setShowAdminPanel(true); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                    style={{ color: '#64748b', border: '1px solid transparent' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.07)'; (e.currentTarget as HTMLButtonElement).style.color = '#4338ca'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(99,102,241,0.18)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#64748b'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'; }}
                  >
                    <svg aria-hidden="true" focusable="false" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>Admin Panel</span>
                    {pendingUsers > 0 && (
                      <span className="ml-auto text-[10px] font-black bg-red-500 text-white rounded-full px-1.5 py-0.5 leading-none">{pendingUsers}</span>
                    )}
                  </button>
                )}

                {/* Sign out */}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{ color: '#94a3b8', border: '1px solid transparent' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.06)'; (e.currentTarget as HTMLButtonElement).style.color = '#b91c1c'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.15)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'; }}
                >
                  <svg aria-hidden="true" focusable="false" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign out
                </button>

              </div>
            )}
          </div>
        </div>

        {/* MAIN CONTENT */}
        {/* Area modul dikunci PERSIS setinggi layar.
            Sebelumnya di sini ada overflow-y-auto, sehingga area ini bisa
            tumbuh melebihi layar dan iframe di dalamnya ikut lebih tinggi dari
            yang terlihat. Akibatnya setiap modal di SEMUA modul meleset:
            position:fixed di dalam iframe mengacu ke viewport iframe — kalau
            viewport itu lebih tinggi dari area terlihat, latar gelap modal
            berhenti di tengah layar dan isinya tidak pernah pas.

            Modul di dalam iframe sudah punya scroll sendiri (h-screen +
            overflow-hidden), jadi lapisan ini tidak boleh ikut men-scroll.
            min-h-0 wajib: tanpa itu flex-1 menolak menyusut di bawah tinggi
            kontennya dan penguncian ini tidak berlaku. */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="flex-1 min-h-0 overflow-hidden relative">
            {/* ── Loading Bar (muncul saat menu diklik, hilang setelah iframe loaded) ── */}
            {iframeLoading && (
              <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none">
                <div className="h-[3px] bg-slate-100 w-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      background: 'linear-gradient(90deg, #e2a84b, #f59e0b, #e2a84b)',
                      backgroundSize: '200% 100%',
                      animation: 'loadingBar 1.2s ease-in-out infinite',
                      width: '60%',
                    }}
                  />
                </div>
              </div>
            )}
            {showDashboardPanel && currentUser ? (
              /* Permission-Aware Dashboard - widget adaptif per permission.
                 Background transparan (IVP bg tembus); hanya card yg opaque.
                 Analytics = launcher full-screen (bukan embed) utk yg berhak. */
              <div className="w-full h-full overflow-hidden relative"
                style={{ backgroundImage: 'url(/IVP_Background.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
                <PermissionAwareDashboard currentUser={currentUser} openMenu={openMenuByKey} openUrl={handleNotifNavigate} />
              </div>
            ) : showTicketing ? (
              <div className="w-full h-full overflow-auto relative">
                {iframeLoading && (
                  <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-10 h-10 rounded-full border-[3px] border-t-transparent animate-spin" style={{ borderColor: 'rgba(226,168,75,0.25)', borderTopColor: '#e2a84b' }} />
                      <p className="text-slate-500 text-sm font-semibold tracking-wide">Memuat halaman...</p>
                    </div>
                  </div>
                )}
                <iframe
                  key={internalUrl}
                  src={internalUrl}
                  className="w-full h-full border-0"
                  title={iframeTitle}
                  onLoad={() => setIframeLoading(false)}
                />
              </div>
            ) : iframeUrl ? (
              <div className="w-full h-full overflow-auto relative">
                {iframeLoading && (
                  <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-10 h-10 rounded-full border-[3px] border-t-transparent animate-spin" style={{ borderColor: 'rgba(226,168,75,0.25)', borderTopColor: '#e2a84b' }} />
                      <p className="text-slate-500 text-sm font-semibold tracking-wide">Memuat halaman...</p>
                    </div>
                  </div>
                )}
                <iframe
                  key={iframeUrl}
                  src={iframeUrl}
                  className="w-full h-full border-0"
                  title={iframeTitle}
                  onLoad={() => setIframeLoading(false)}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400"
                style={{ backgroundImage: 'url(/IVP_Background.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
                <div className="text-center bg-white/75 rounded-2xl px-8 py-6 shadow-lg backdrop-blur-md">
                  <div className="text-5xl mb-3">📂</div>
                  <p className="font-semibold text-base text-slate-600">Pilih menu dari sidebar</p>
                  <p className="text-sm mt-1 text-slate-400">Klik salah satu menu di sebelah kiri untuk memulai</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
        @keyframes dropIn { from { opacity: 0; transform: translateY(-8px) scale(0.97); } to { opacity: 1; transform: none; } }
        @keyframes loadingBar {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(80%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}
