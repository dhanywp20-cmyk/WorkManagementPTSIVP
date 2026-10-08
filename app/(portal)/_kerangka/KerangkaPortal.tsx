'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase, setDbToken } from '@/lib/supabase';
import { setSession, clearSession, getSession, verifySessionFromCookie } from '@/lib/auth';
import { hasFullAccess } from '@/lib/constants';
import { isPimpinan } from '@/lib/pimpinan';
import type { User, MenuItem } from '../dashboard/_components/shared';
import { UserProfileModal, NotificationBar, AdminPanelModal } from '../dashboard/_components/Modals';
import GlobalSearch from '../dashboard/_components/GlobalSearch';
import PermissionAwareDashboard from '../dashboard/_components/widgets/PermissionAwareDashboard';
import OnboardingTour from '../dashboard/_components/OnboardingTour';
import { NavBawahMobile, IKON_AKUN } from '../dashboard/_components/NavBawahMobile';
import { LABEL_PENDEK } from '../dashboard/_components/nav-bawah';
import { AsistenPlatform } from '../dashboard/_components/AsistenPlatform';
import { LayarMasuk } from './LayarMasuk';
import { tujuanLanjutAman } from '@/lib/tujuan-lanjut';
import { SidebarPortal } from './SidebarPortal';
import { DAFTAR_MENU, MENU_ICONS, LEARNING_KEYS, PROJECT_KEYS, INTERNAL_DAILY_KEYS } from './daftar-menu';
import { useMerek, latarDasbor } from '@/lib/merek';
import SessionExpiryBanner from '@/app/_components/SessionExpiryBanner';
import { LogoMerek, FooterPlatform } from '@/components/shared';
import { Ikon } from '@/components/shared/Ikon';

/**
 * KerangkaPortal - layout bersama SEMUA modul (app/(portal)/layout.tsx): sesi & layar masuk, header,
 * sidebar, menu bawah HP, notifikasi, Admin Panel, Asisten.
 *
 * Dulu ini halaman /dashboard yang memuat tiap modul di dalam <iframe>. Akibatnya tiap modul
 * adalah aplikasi terpisah: sesi, merek & daftar pengguna dimuat ulang tiap pindah menu, alamat di
 * peramban selalu /dashboard (tombol back & tautan langsung tidak berfungsi), dan popup modul hanya
 * menutupi kotak iframe-nya. Sekarang modul dirender langsung sebagai `children`; menu berpindah
 * lewat router, dan modul yang aktif dibaca dari alamat halaman (usePathname).
 */
export function KerangkaPortal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? '/dashboard';
  /** Menu yang alamatnya sedang dibuka (termasuk sub-halamannya). */
  const aktifUrl = (url: string) => pathname === url || pathname.startsWith(url + '/');
  const merek = useMerek();
  // Guard: ensure auto-navigation to first menu only happens ONCE per login session
  // (prevents race-condition re-fires when currentUser/showSidebar update multiple times)
  const autoNavigatedRef = useRef(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
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
    //  Datang dari tautan langsung tanpa sesi (proxy.ts membawa ?lanjut=): kembali ke halaman itu.
    const lanjut = tujuanLanjutAman(new URLSearchParams(window.location.search).get('lanjut'));
    if (lanjut) router.replace(lanjut);
    window.setTimeout(() => setDasborMuncul(false), 700);
  }, [router]);
  const [loading, setLoading] = useState(true);
  const [menuLoading, setMenuLoading] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [tourVisible, setTourVisible] = useState(false);
  const [tourHighlightKey, setTourHighlightKey] = useState<string | null>(null);
  /** Beranda (widget adaptif) = alamat /dashboard. */
  const showDashboardPanel = pathname === '/dashboard';

  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
  /*
    Modul di dalam iframe minta layar penuh - dipakai saat peserta sedang
    mengerjakan Quiz.

    Modal yang dibuat DI DALAM iframe hanya bisa menutupi area iframe-nya; di
    luar itu sidebar dan bilah atas tetap terlihat, dan tombol-tombolnya tetap
    bisa diklik. Untuk quiz berbatas waktu itu bukan sekadar soal tampilan:
    satu klik menu di luar sana mengganti isi iframe, dan pengerjaannya hilang
    di tengah jalan.

    Jadi iframe-nya sendiri yang dinaikkan ke seluruh layar, atas permintaan
    modul di dalamnya lewat postMessage.
  */
  const [layarPenuh, setLayarPenuh] = useState(false);
  /*
    Tinggi area modul sebagai variabel CSS --tinggi-isi: pengganti 100vh untuk modul yang dulu
    menghitung tingginya terhadap iframe (mis. calc(100vh - 112px) di Materi Learning Center).
  */
  const isiRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = isiRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    //  --jarak-bawah-isi: ruang di bawah area isi (menu bawah HP + footer) - dipakai bilah `fixed bottom`
    //  milik modul (mis. antrean offline Project Progress) supaya tidak tertutup menu bawah.
    const ukur = () => {
      el.style.setProperty('--tinggi-isi', `${el.clientHeight}px`);
      const bawah = Math.max(0, window.innerHeight - el.getBoundingClientRect().bottom);
      document.documentElement.style.setProperty('--jarak-bawah-isi', `${Math.round(bawah)}px`);
    };
    ukur();
    const ro = new ResizeObserver(ukur);
    ro.observe(el);
    return () => ro.disconnect();
  });

  const [visibleMenuItems, setVisibleMenuItems] = useState<MenuItem[]>([]);


  useEffect(() => {
    if (!currentUser) return;
    setMenuLoading(true);
    const timer = setTimeout(() => {
      const allowed = currentUser.allowed_menus;
      /*
        Yang melewati saringan allowed_menus bukan cuma admin/superadmin,
        tapi juga akun Team yang diberi toggle "Full Access" di Admin Panel.
        Full Access artinya SELURUH menu tampil tanpa ada yang disembunyikan -
        kalau di sini hanya role admin yang dilewatkan, pemegang Full Access
        tetap kehilangan menu yang tidak tercentang di allowed_menus-nya, dan
        satu-satunya cara membukanya jadi mencentang menu satu per satu.
      */
      if (!allowed || hasFullAccess(currentUser)) {
        setVisibleMenuItems(DAFTAR_MENU);
      } else {
        // Always use DAFTAR_MENU order (code order), not allowed_menus DB order
        setVisibleMenuItems(DAFTAR_MENU.filter(m => allowed.includes(m.key)));
      }
      setMenuLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [currentUser]);

  const handleLogout = () => {
    autoNavigatedRef.current = false; // reset so next login re-navigates correctly
    setIsLoggedIn(false); setCurrentUser(null);
    /* Wajib: tanpa ini `masukBerhasil` tetap true selamanya, dan begitu
       halaman login dirender ulang setelah logout, kelas .lc-bongkar terpasang
       lagi dari awal. Animasinya `forwards`, jadi halaman yang baru saja muncul
       langsung terbongkar dan menyisakan layar kosong - persis bug yang dulu
       dilaporkan. sudahMasukRef juga direset supaya login BERIKUTNYA bisa
       memicu urutan keluar lagi, bukan cuma yang pertama. */
    setDasborMuncul(false);
    sudahMasukRef.current = false;
    clearSession();
    setShowSidebar(false);
    setShowAdminPanel(false); setShowUserProfile(false);
    router.push('/dashboard');
  };

  // Auto-navigate sales/guest to first allowed menu when sidebar opens
  // Uses autoNavigatedRef so this runs EXACTLY ONCE per login - no race conditions
  useEffect(() => {
    if (!isLoggedIn || !currentUser || !showSidebar) return;
    if (autoNavigatedRef.current) return; // already navigated this session
    const role = currentUser.role?.toLowerCase() ?? '';
    //  Pimpinan (lib/pimpinan.ts) berperan guest tetapi mendarat di panel dashboard seperti Team,
    //  bukan dilempar ke menu pertama seperti Sales.
    const isSalesGuest = ['guest','sales'].includes(role) && !isPimpinan(currentUser);
    // Full Access diperlakukan seperti admin: mendarat di panel dashboard,
    // bukan dilempar ke menu pertama yang tercentang.
    const isRegularTeam = role === 'team' && !hasFullAccess(currentUser)
      && !(currentUser.allowed_menus ?? []).includes('dashboard') && currentUser.jabatan !== 'Supervisor';
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
        ? DAFTAR_MENU.find(m => m.key === categoryOrderedKey)
        : null;
      if (!firstMenu) return;
      autoNavigatedRef.current = true; // mark before state updates to prevent concurrent fires
      const firstItem = firstMenu.items?.[0];
      if (firstItem && (firstItem.internal || (firstItem.embed && !firstItem.external))) router.replace(firstItem.url);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, showSidebar, currentUser]);

  const handleMenuClick = (item: MenuItem['items'][0], _menuTitle?: string) => {
    if (item.external && !item.embed) { window.open(item.url, '_blank'); return; }
    setShowSidebar(true);
    router.push(item.url);
  };

  // Buka menu berdasarkan key (dipakai widget dashboard: Quick Action, "Lihat semua").
  const openMenuByKey = (key: string) => {
    const menu = DAFTAR_MENU.find(m => m.key === key);
    const item = menu?.items?.[0];
    if (menu && item) handleMenuClick(item, menu.title);
  };

  const handleNotifNavigate = (navInternalUrl: string, title: string, refId?: string) => {
    // M16 (docs/UX-WORKFLOW-AUDIT.md): sebagian notifikasi (mis. "user baru
    // mendaftar") tidak menunjuk ke HALAMAN, tapi ke tab Admin Panel - modal
    // terpisah, bukan bagian dari sistem iframe/route di bawah. action_url
    // "admin:<tab>" sengaja BUKAN route sungguhan, dikenali khusus di sini.
    if (navInternalUrl.startsWith('admin:')) {
      const tab = navInternalUrl.slice('admin:'.length);
      if (tab === 'settings' || tab === 'userManagement' || tab === 'picBrand') setAdminPanelTab(tab);
      setShowAdminPanel(true);
      return;
    }
    // Deep-link: ?open=<id record> supaya halaman tujuan bisa langsung
    // membuka detailnya, bukan cuma daftar - lihat pemakaian di masing-masing
    // page.tsx (ticketing/reminder-schedule/form-require-project/form-review).
    const urlDenganTarget = refId
      ? `${navInternalUrl}${navInternalUrl.includes('?') ? '&' : '?'}open=${encodeURIComponent(refId)}`
      : navInternalUrl;
    void title;
    setShowSidebar(true);
    router.push(urlDenganTarget);
  };

  /*
    Turunkan lagi dari layar penuh begitu halaman modulnya berganti. Pesan IFRAME_MODAL_CLOSE dikirim
    modul saat komponennya dilepas - dan itu tidak selalu sempat terjadi (mis. pindah lewat
    notifikasi). Tanpa penurunan di sini layar penuh menempel ke halaman berikutnya.
  */
  useEffect(() => { setLayarPenuh(false); }, [pathname]);

  // postMessage bridge
  // Receives CC_NAVIGATE messages from Command Center iframe and routes to the
  // matching menu item, so Quick Access buttons in Command Center work seamlessly.
  useEffect(() => {
    const handleMsg = (e: MessageEvent) => {
      if (!e.data) return;
      // Permintaan layar penuh dari modul di dalam iframe. Hanya dilayani bila
      // asalnya sama - pesan dari halaman lain tidak boleh bisa menutupi
      // seluruh layar pengguna.
      if (e.data.type === 'IFRAME_MODAL_OPEN' || e.data.type === 'IFRAME_MODAL_CLOSE') {
        if (e.origin !== window.location.origin) return;
        setLayarPenuh(e.data.type === 'IFRAME_MODAL_OPEN');
        return;
      }
      if (e.data.type !== 'CC_NAVIGATE') return;
      const url: string = e.data.url ?? '';
      if (!url) return;
      // Find the menu item whose url matches
      const match = DAFTAR_MENU.flatMap(m => m.items.map(it => ({ it, menu: m })))
        .find(({ it }) => it.url === url);
      if (match) {
        handleMenuClick(match.it, match.menu.title);
      } else {
        router.push(url);
      }
    };
    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const load = async () => {
      /*
        sessionStorage kosong bukan berarti sesinya sudah habis - itu cuma
        berarti tab/proses ini baru (refresh yang mendaur ulang proses tab,
        PWA yang dibuka lagi setelah OS membekukan/menutupnya di HP, dst).
        Cookie httpOnly (umurnya 6 jam, sama dengan SESSION_DURATION_MS) yang
        jadi sumber kebenaran sebenarnya - verifySessionFromCookie() sudah
        ada persis untuk kasus ini tapi sebelumnya tidak pernah dipanggil,
        jadi orang selalu dilempar ke layar login walau cookie-nya masih sah.
      */
      let parsed = getSession<User>();
      if (!parsed) parsed = await verifySessionFromCookie<User>();
      if (!parsed) { setLoading(false); return; }
      try {
        setCurrentUser(parsed);
        setIsLoggedIn(true);
        const { data, error } = await supabase.from('users').select('id,username,full_name,role,team_type,sales_division,jabatan,phone_number,allowed_menus,kpi_enabled').eq('id', parsed.id).single();
        const userData: User = (!error && data) ? data : parsed;
        if (!error && data) {
          //  Penanda pimpinan dibaca ulang dari DB lewat kueri terpisah & toleran (kolom baru tidak
          //  dimasukkan ke select utama, lihat lib/auth.ts). Tanpa ini, sesi yang dibuat SEBELUM
          //  akun dijadikan pimpinan tetap "bukan pimpinan" sampai logout - datanya tersaring.
          const { data: pim, error: galatPim } = await supabase.from('users').select('pimpinan').eq('id', parsed.id).maybeSingle();
          const pimpinanDb = !galatPim && pim ? (pim as { pimpinan?: unknown }).pimpinan === true : (parsed as { pimpinan?: unknown }).pimpinan === true;
          const segar = { ...data, pimpinan: pimpinanDb };
          setCurrentUser(segar);
          setSession(segar);
        }
        // Permission-Aware Dashboard = homepage utk SEMUA role. Semua mendarat di
        // dashboard home saat reload; tidak lagi auto-lompat ke menu pertama.
        autoNavigatedRef.current = true; // matikan auto-navigate useEffect
        setShowSidebar(true);
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, []);

  // isAdmin TETAP admin/superadmin murni - khusus tombol Admin Panel (kelola
  // akun, bukan sekadar lihat data). Lihat lib/constants.ts hasFullAccess.
  const isAdmin = ['admin', 'superadmin'].includes(currentUser?.role?.toLowerCase() ?? '');
  /** Modul yang sedang dibuka, untuk panduan kontekstual Asisten (lib/panduan.ts). */
  const modulAktif = showDashboardPanel ? 'dashboard' : (pathname.replace(/^\/+/, '').split('/')[0] || 'dashboard');
  const asistenAtasan = isAdmin || /supervisor|manager/i.test(currentUser?.jabatan ?? '');
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
  const canAccessKPI = isFullAccess || isPTSSupervisor || isSalesSupervisor || hasTeamDashboardAccess || isPimpinan(currentUser);

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
    // Dep-nya isFullAccess, bukan isAdmin: penjaga di atas memakai isFullAccess,
    // jadi untuk akun Full Access non-admin nilai isAdmin tidak pernah berubah
    // dan efek ini tidak pernah dijalankan ulang - badge-nya tidak muncul.
  }, [isFullAccess]);


  const projectMenuItems = visibleMenuItems.filter(m => PROJECT_KEYS.includes(m.key));
  const internalMenuItems = visibleMenuItems.filter(m => INTERNAL_DAILY_KEYS.includes(m.key));
  const learningMenuItems = visibleMenuItems.filter(m => LEARNING_KEYS.includes(m.key));




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
              <div className="text-4xl"><Ikon nama={menu.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /></div>
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
                  <svg aria-hidden="true" focusable="false" className="w-5 h-5 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                ) : (
                  <svg aria-hidden="true" focusable="false" className="w-5 h-5 text-slate-500 transition-transform group-hover/item:-translate-x-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                )}
                <span className="flex-1 text-sm tracking-wide text-right">{item.name}</span>
                <div className="w-10 h-10 bg-white rounded-md shadow-sm flex items-center justify-center text-xl border border-slate-200 text-slate-600 group-hover/item:scale-110 transition-transform flex-shrink-0"><Ikon nama={item.icon} ukuran={20} /></div>
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
      <div className="flex items-center justify-center bg-cover bg-center bg-fixed" style={{ background: 'var(--latar-halaman)', minHeight: '100dvh' }}>
        <div className="flex flex-col items-center gap-4 px-10 py-8 rounded-2xl" style={{ background: 'rgba(255,255,255,0.92)', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
          <div className="w-12 h-12 rounded-full border-4 border-t-rose-600 border-rose-200 animate-spin" />
          <p className="text-slate-700 font-semibold">Memuat portal...</p>
        </div>
      </div>
    );
  }

  // LOGIN / REGISTER SCREEN - lihat LayarMasuk.tsx
  if (!isLoggedIn) {
    return (
      <LayarMasuk
        onMasuk={(data, token) => {
          setCurrentUser(data);
          setSession(data);
          // Pasang token PostgREST supaya seluruh query berikutnya membawa
          // identitas user - inilah yang membuat policy RLS bisa menyaring.
          setDbToken(token);
          // Permission-Aware Dashboard = homepage utk SEMUA role; tidak lagi auto-lompat ke menu pertama.
          autoNavigatedRef.current = true;
        }}
        onSelesai={masukKeDashboard}
      />
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
                <span className="hidden sm:inline text-slate-400 font-light">|</span>
                <span className="hidden sm:inline text-xs md:text-sm font-bold tracking-wide" style={{ color: merek.warnaAksen }}>{merek.namaPortal}</span>
              </div>
              <p className="text-slate-500 text-[11px] md:text-xs font-medium mt-0.5 hidden sm:block">{merek.namaPerusahaan}</p>
            </div>
          </div>

          {/* CENTER — spacer */}
          <div className="flex-1" />

          {/* RIGHT */}
          <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
            {/* Global Search icon — sebelah kiri notif */}
            {currentUser && (
              <GlobalSearch
                currentUser={currentUser}
                onNavigate={(url) => { setShowSidebar(true); router.push(url); }}
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
                  <p className="text-[10px] font-bold tracking-widest uppercase text-amber-700">{currentUser?.role}</p>
                </div>
              </div>
            )}

            {/* HP / APK: avatar membuka profil (keluar & Admin Panel ada di menu bawah "Lainnya") */}
            {currentUser && (
              <button type="button" onClick={() => setShowUserProfile(true)} aria-label={`Profil ${currentUser.full_name ?? ''}`}
                className="md:hidden w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #fde68a, #f59e0b)', color: '#78350f' }}>
                {currentUser.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
              </button>
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
                className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
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

  // MENU BAWAH HP / APK (shared) - pengganti sidebar di layar < md: semua menu, digeser kiri-kanan.
  //  Profil dibuka dari avatar di header.
  const bukaDashboard = () => { setShowSidebar(true); router.push('/dashboard'); };
  const renderNavBawah = () => (!menuLoading && !layarPenuh && currentUser ? (
    <NavBawahMobile
      aksen={merek.warnaAksen}
      beranda={{ key: '__dashboard', label: 'Dashboard', aktif: showSidebar ? showDashboardPanel : true, onPilih: bukaDashboard }}
      menu={visibleMenuItems.filter(m => m.items.length).map(menu => {
        const it = menu.items[0];
        return {
          key: menu.key, label: menu.title, pendek: LABEL_PENDEK[menu.key],
          ikon: MENU_ICONS[menu.key] ?? <Ikon nama={menu.icon} ukuran="1em" className="inline-block align-[-0.12em]" />,
          aktif: showSidebar && !showDashboardPanel && menu.items.some(x => aktifUrl(x.url)),
          badge: menu.key === 'reminder-schedule' && isFullAccess ? pendingRequests : 0,
          onPilih: () => handleMenuClick(it, menu.title),
        };
      })}
      akun={[
        ...(isAdmin ? [{ key: '__admin', label: 'Admin Panel', ikon: IKON_AKUN.admin, badge: pendingUsers,
          onPilih: () => { setAdminPanelTab(pendingUsers > 0 ? 'userManagement' : 'settings'); setShowAdminPanel(true); } }] : []),
        { key: '__keluar', label: 'Keluar', ikon: IKON_AKUN.keluar, bahaya: true, onPilih: handleLogout },
      ]}
    />
  ) : null);

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
      <div className={`${dasborMuncul ? 'lc-dasbor-muncul' : ''} flex flex-col bg-cover bg-center bg-fixed`} style={{ ...latarDasbor(merek), height: '100dvh' }}>
        {renderModals()}
        {/* ── Jelajahi Button (always visible while logged-in, before sidebar loads) ── */}
        {currentUser && !tourVisible && (
          <AsistenPlatform modul={modulAktif} atasan={asistenAtasan} onMulaiTur={() => setShowTour(true)} />
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

        {renderNavBawah()}
        <FooterPlatform />

        <style>{`
          @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
          @keyframes dropIn { from { opacity: 0; transform: translateY(-8px) scale(0.97); } to { opacity: 1; transform: none; } }
        `}</style>
      </div>
    );
  }

  // VIEW: SIDEBAR
  return (
    <div className={`${dasborMuncul ? 'lc-dasbor-muncul' : ''} flex flex-col bg-cover bg-center bg-fixed`} style={{ ...latarDasbor(merek), height: '100dvh' }}>
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
            <AsistenPlatform modul={modulAktif} atasan={asistenAtasan} onMulaiTur={() => setShowTour(true)} />
          )}
        </>
      )}
      {renderHeader()}

      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* SIDEBAR - lihat SidebarPortal.tsx */}
        <SidebarPortal
          sidebarCollapsed={sidebarCollapsed} setSidebarCollapsed={setSidebarCollapsed}
          tourVisible={tourVisible} tourHighlightKey={tourHighlightKey} menuLoading={menuLoading}
          visibleMenuItems={visibleMenuItems} showDashboardPanel={showDashboardPanel} aktifUrl={aktifUrl}
          currentUser={currentUser} isAdmin={isAdmin} isFullAccess={isFullAccess}
          pendingUsers={pendingUsers} pendingRequests={pendingRequests}
          onMenu={handleMenuClick} onBeranda={() => router.push('/dashboard')}
          onProfil={() => setShowUserProfile(true)}
          onAdminPanel={() => { setAdminPanelTab(pendingUsers > 0 ? 'userManagement' : 'settings'); setShowAdminPanel(true); }}
          onKeluar={handleLogout}
        />

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
            {showDashboardPanel && currentUser ? (
              /* Permission-Aware Dashboard - widget adaptif per permission.
                 Background transparan (IVP bg tembus); hanya card yg opaque.
                 Analytics = launcher full-screen (bukan embed) utk yg berhak. */
              <div className="w-full h-full overflow-hidden relative"
                style={latarDasbor(merek)}>
                <PermissionAwareDashboard currentUser={currentUser} openMenu={openMenuByKey} openUrl={handleNotifNavigate}
                  onHubungkanTelegram={() => setShowUserProfile(true)} />
              </div>
            ) : (
              /*
                Modul dirender langsung di sini. `isi-portal` membuat h-screen/min-h-screen milik modul
                berarti "setinggi area ini" (app/globals.css), karena dulu ukuran itu diukur terhadap
                iframe. Layar penuh (quiz) menaikkan area ini menutupi seluruh layar seperti dulu.
              */
              <div ref={isiRef} className={layarPenuh
                ? 'isi-portal fixed inset-0 z-[300] bg-white overflow-auto'
                : 'isi-portal w-full h-full overflow-auto relative'}>
                {children}
              </div>
            )}
          </div>
        </div>
      </div>

      {/*  Anak TERAKHIR dari root flex-col, di luar baris sidebar+isi - itulah
           yang membuatnya membentang dari ujung kiri layar sampai ujung kanan,
           melewati bawah sidebar, bukan cuma selebar area modul. Root-nya
           setinggi 100dvh, jadi area modul di atasnya menyusut sendiri setinggi
           bilah ini; tidak ada yang tertutup. */}
      {/* HP / APK: menu bawah (Dashboard + 3 utama + Lainnya) menggantikan sidebar. */}
      {renderNavBawah()}

      <FooterPlatform />

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

/** Penanda memuat menu (tingkat modul: komponen di dalam render dipasang ulang tiap render). */
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

/** Analytics dalam iframe di tampilan kartu - tingkat modul supaya iframe-nya tidak dimuat ulang tiap render induk. */
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
            <span className="text-4xl"><Ikon nama="📊" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
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
