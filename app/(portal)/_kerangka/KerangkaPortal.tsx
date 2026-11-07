'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase, setDbToken, SESI_HABIS } from '@/lib/supabase';
import { setSession, clearSession, getSession, verifySessionFromCookie, cekSesiServer } from '@/lib/auth/sesi';
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
import { useMerek, latarDasbor } from '@/lib/merek/inti';
import { LogoMerek, FooterPlatform } from '@/components/shared';
import { Ikon } from '@/components/shared/Ikon';
import { catatPemakaian } from '@/lib/pemakaian';
import { pasangMiring3D } from '@/lib/miring3d';
import { AnalyticsIframe } from './AnalyticsIframe';
import { GridMenuPortal } from './KartuMenuPortal';

export function KerangkaPortal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? '/dashboard';
  const [tujuanMenu, setTujuanMenu] = useState<string | null>(null);
  const [sedangPindah, mulaiPindah] = useTransition();
  const urlTujuan = useRef<string | null>(null);
  const jalurSorot = tujuanMenu ?? pathname;
  const aktifUrl = (url: string) => jalurSorot === url || jalurSorot.startsWith(url + '/');
  const berandaTersorot = jalurSorot === '/dashboard';
  const pindahKe = useCallback((url: string) => {
    const jalur = url.split('?')[0];
    if (jalur !== pathname) { setTujuanMenu(jalur); urlTujuan.current = url; }
    mulaiPindah(() => router.push(url));
  }, [pathname, router]);
  useEffect(() => { setTujuanMenu(null); urlTujuan.current = null; }, [pathname]);
  useEffect(() => {
    if (!tujuanMenu) return;
    const t = setTimeout(() => {
      const url = urlTujuan.current;
      setTujuanMenu(null);
      if (url && navigator.onLine !== false) window.location.assign(url);
    }, 12_000);
    return () => clearTimeout(t);
  }, [tujuanMenu]);
  const merek = useMerek();
  const autoNavigatedRef = useRef(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [dasborMuncul, setDasborMuncul] = useState(false);
  const sudahMasukRef = useRef(false);
  const masukKeDashboard = useCallback(() => {
    if (sudahMasukRef.current) return;
    sudahMasukRef.current = true;
    setDasborMuncul(true);
    setIsLoggedIn(true);
    setShowSidebar(true);
    const lanjut = tujuanLanjutAman(new URLSearchParams(window.location.search).get('lanjut'));
    if (lanjut) router.replace(lanjut);
    window.setTimeout(() => setDasborMuncul(false), 520);
  }, [router]);
  const [loading, setLoading] = useState(true);
  const [showTour, setShowTour] = useState(false);
  const [tourVisible, setTourVisible] = useState(false);
  const [tourHighlightKey, setTourHighlightKey] = useState<string | null>(null);
  const showDashboardPanel = pathname === '/dashboard';

  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminPanelTab, setAdminPanelTab] = useState<'settings' | 'userManagement' | 'picBrand'>('settings');
  const [pendingUsers, setPendingUsers] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [layarPenuh, setLayarPenuh] = useState(false);
  const [isiEl, setIsiEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = isiEl;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ukur = () => {
      el.style.setProperty('--tinggi-isi', `${el.clientHeight}px`);
      const bawah = Math.max(0, window.innerHeight - el.getBoundingClientRect().bottom);
      document.documentElement.style.setProperty('--jarak-bawah-isi', `${Math.round(bawah)}px`);
    };
    ukur();
    const ro = new ResizeObserver(ukur);
    ro.observe(el);
    window.addEventListener('resize', ukur);
    return () => { ro.disconnect(); window.removeEventListener('resize', ukur); };
  }, [isiEl]);

  const allowedMenus = currentUser?.allowed_menus ?? null;
  const semuaMenu = !!currentUser && (!allowedMenus || hasFullAccess(currentUser));
  const kunciMenu = !currentUser ? '' : semuaMenu ? '*' : (allowedMenus ?? []).join(',');
  const visibleMenuItems: MenuItem[] = useMemo(() => {
    if (!kunciMenu) return [];
    if (kunciMenu === '*') return DAFTAR_MENU;
    const izin = kunciMenu.split(',');
    return DAFTAR_MENU.filter(m => izin.includes(m.key));
  }, [kunciMenu]);

  const sesiBerakhir = useCallback(() => {
    autoNavigatedRef.current = false;
    setIsLoggedIn(false); setCurrentUser(null);
    setDasborMuncul(false);
    sudahMasukRef.current = false;
    clearSession();
    setShowSidebar(false);
    setShowAdminPanel(false); setShowUserProfile(false);
    setTujuanMenu(null); urlTujuan.current = null;
  }, [setShowSidebar]);
  const handleLogout = () => {
    sesiBerakhir();
    router.push('/dashboard');
  };

  useEffect(() => {
    if (!isLoggedIn || sedangPindah) return;
    const lanjut = new URLSearchParams(window.location.search).get('lanjut');
    if (!lanjut) return;
    let batal = false;
    void cekSesiServer().then(hasil => {
      if (batal) return;
      if (hasil === 'habis') sesiBerakhir();
      else if (hasil === 'sah') {
        const tujuan = tujuanLanjutAman(lanjut);
        if (tujuan) router.replace(tujuan);
      }
    });
    return () => { batal = true; };
  }, [pathname, sedangPindah, isLoggedIn, sesiBerakhir, router]);

  useEffect(() => pasangMiring3D(document.body), []);

  useEffect(() => {
    if (!isLoggedIn) return;
    window.addEventListener(SESI_HABIS, sesiBerakhir);
    return () => window.removeEventListener(SESI_HABIS, sesiBerakhir);
  }, [isLoggedIn, sesiBerakhir]);

  useEffect(() => {
    if (!isLoggedIn || !currentUser || !showSidebar) return;
    if (autoNavigatedRef.current) return;
    const role = currentUser.role?.toLowerCase() ?? '';
    const isSalesGuest = ['guest','sales'].includes(role) && !isPimpinan(currentUser);
    const isRegularTeam = role === 'team' && !hasFullAccess(currentUser)
      && !(currentUser.allowed_menus ?? []).includes('dashboard') && currentUser.jabatan !== 'Supervisor';
    if (isSalesGuest || isRegularTeam) {
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
      autoNavigatedRef.current = true;
      const firstItem = firstMenu.items?.[0];
      if (firstItem && (firstItem.internal || (firstItem.embed && !firstItem.external))) router.replace(firstItem.url);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, showSidebar, currentUser]);

  const handleMenuClick = (item: MenuItem['items'][0], _menuTitle?: string) => {
    if (item.external && !item.embed) { window.open(item.url, '_blank'); return; }
    setShowSidebar(true);
    pindahKe(item.url);
  };

  const openMenuByKey = (key: string) => {
    const menu = DAFTAR_MENU.find(m => m.key === key);
    const item = menu?.items?.[0];
    if (menu && item) handleMenuClick(item, menu.title);
  };

  const handleNotifNavigate = (navInternalUrl: string, title: string, refId?: string) => {
    if (navInternalUrl.startsWith('admin:')) {
      const tab = navInternalUrl.slice('admin:'.length);
      if (tab === 'settings' || tab === 'userManagement' || tab === 'picBrand') setAdminPanelTab(tab);
      setShowAdminPanel(true);
      return;
    }
    const urlDenganTarget = refId
      ? `${navInternalUrl}${navInternalUrl.includes('?') ? '&' : '?'}open=${encodeURIComponent(refId)}`
      : navInternalUrl;
    void title;
    setShowSidebar(true);
    pindahKe(urlDenganTarget);
  };

  useEffect(() => { setLayarPenuh(false); }, [pathname]);

  const daftarPrefetch = visibleMenuItems.flatMap(m => m.items)
    .filter(it => it.internal || (it.embed && !it.external)).map(it => it.url.split('?')[0]);
  const kunciPrefetch = [...new Set(daftarPrefetch)].join('|');
  useEffect(() => {
    if (!currentUser || !kunciPrefetch) return;
    const hemat = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (hemat) return;
    const KUNCI = 'prefetch-menu-terakhir';
    try {
      const terakhir = Number(sessionStorage.getItem(KUNCI) || 0);
      if (Date.now() - terakhir < 30 * 60 * 1000) return;
      sessionStorage.setItem(KUNCI, String(Date.now()));
    } catch {  }
    const urls = ['/dashboard', ...kunciPrefetch.split('|')];
    let batal = false, i = 0;
    const tunda = (fn: () => void) => ('requestIdleCallback' in window
      ? window.requestIdleCallback(fn, { timeout: 3000 })
      : setTimeout(fn, 300));
    const lanjut = () => {
      if (batal || i >= urls.length) return;
      try { router.prefetch(urls[i]); } catch {  }
      i++;
      tunda(lanjut);
    };
    const awal = setTimeout(() => tunda(lanjut), 2000);
    return () => { batal = true; clearTimeout(awal); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, kunciPrefetch]);

  useEffect(() => {
    const handleMsg = (e: MessageEvent) => {
      if (!e.data) return;
      if (e.data.type === 'IFRAME_MODAL_OPEN' || e.data.type === 'IFRAME_MODAL_CLOSE') {
        if (e.origin !== window.location.origin) return;
        setLayarPenuh(e.data.type === 'IFRAME_MODAL_OPEN');
        return;
      }
      if (e.data.type !== 'CC_NAVIGATE') return;
      const url: string = e.data.url ?? '';
      if (!url) return;
      const match = DAFTAR_MENU.flatMap(m => m.items.map(it => ({ it, menu: m })))
        .find(({ it }) => it.url === url);
      if (match) {
        handleMenuClick(match.it, match.menu.title);
      } else {
        pindahKe(url);
      }
    };
    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let batal = false;
    const load = async () => {
      let parsed = getSession<User>();
      if (!parsed) parsed = await verifySessionFromCookie<User>();
      if (batal) return;
      if (!parsed) { setLoading(false); return; }
      autoNavigatedRef.current = true;
      setCurrentUser(parsed);
      setIsLoggedIn(true);
      setShowSidebar(true);
      setLoading(false);

      try {
        const [profilPenuh, pim] = await Promise.all([
          supabase.from('users').select('id,username,full_name,role,team_type,sales_division,jabatan,phone_number,allowed_menus,kpi_enabled,access_level,piket_akses').eq('id', parsed.id).single(),
          supabase.from('users').select('pimpinan').eq('id', parsed.id).maybeSingle(),
        ]);
        const profil = profilPenuh.error
          ? await supabase.from('users').select('id,username,full_name,role,team_type,sales_division,jabatan,phone_number,allowed_menus,kpi_enabled').eq('id', parsed.id).single()
          : profilPenuh;
        if (batal || profil.error || !profil.data) return;
        const pimpinanDb = !pim.error && pim.data
          ? (pim.data as { pimpinan?: unknown }).pimpinan === true
          : (parsed as { pimpinan?: unknown }).pimpinan === true;
        const segar = { ...profil.data, pimpinan: pimpinanDb } as User;
        setSession(segar);
        setCurrentUser(lama => {
          if (!lama) return segar;
          const a = lama as unknown as Record<string, unknown>, b = segar as unknown as Record<string, unknown>;
          const beda = Object.keys(b).some(k => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
          return beda ? { ...lama, ...segar } : lama;
        });
      } catch {  }
    };
    load();
    return () => { batal = true; };
  }, []);

  const isAdmin = ['admin', 'superadmin'].includes(currentUser?.role?.toLowerCase() ?? '');
  const modulAktif = showDashboardPanel ? 'dashboard' : (pathname.replace(/^\/+/, '').split('/')[0] || 'dashboard');
  useEffect(() => {
    if (isLoggedIn && modulAktif !== 'tools-team') catatPemakaian(modulAktif);
  }, [isLoggedIn, modulAktif]);
  const asistenAtasan = isAdmin || /supervisor|manager/i.test(currentUser?.jabatan ?? '');
  const isFullAccess = isAdmin || hasFullAccess(currentUser);

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

    const ch = supabase.channel('admin-pending-count-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reminders' }, () => {
        setTimeout(refreshPendingCount, 400);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        setTimeout(refreshPendingCount, 400);
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [isFullAccess]);

  const projectMenuItems = visibleMenuItems.filter(m => PROJECT_KEYS.includes(m.key));
  const internalMenuItems = visibleMenuItems.filter(m => INTERNAL_DAILY_KEYS.includes(m.key));
  const learningMenuItems = visibleMenuItems.filter(m => LEARNING_KEYS.includes(m.key));

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ background: 'var(--latar-halaman)', minHeight: '100dvh' }} aria-busy="true">
        <div className="flex flex-col items-center gap-5" style={{ animation: 'fadeIn 400ms ease 200ms both' }}>
          <LogoMerek ukuran="lg" />
          <div className="w-28 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(15,23,42,0.1)' }}>
            <div className="h-full w-1/2 rounded-full" style={{ background: merek.warnaUtama, animation: 'loadingBar 1.1s ease-in-out infinite' }} />
          </div>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <LayarMasuk
        onMasuk={(data, token) => {
          setCurrentUser(data);
          setSession(data);
          setDbToken(token);
          autoNavigatedRef.current = true;
        }}
        onSelesai={masukKeDashboard}
      />
    );
  }

  const renderHeader = (withBackBtn = false) => (
    <div className="kepala-3d bg-white/80 backdrop-blur-md shadow-md shrink-0" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', position: 'relative', zIndex: 60 }}>
      <div className="w-full px-3 md:px-4 py-3 md:py-3.5">
        <div className="flex items-center justify-between gap-2 md:gap-4">
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <LogoMerek ukuran="sm" className="flex md:hidden" />
            <LogoMerek ukuran="md" className="hidden md:flex" />
            <div>
              <div className="flex items-center gap-1.5 md:gap-2.5">
                <h1 className="text-sm md:text-xl md:leading-7 font-bold text-slate-800 tracking-tight leading-tight">
                  <span className="hidden sm:inline">{merek.namaPlatform}</span>
                  <span className="sm:hidden">{merek.namaPlatformSingkat}</span>
                </h1>
                <span className="hidden sm:inline text-slate-400 font-light">|</span>
                <span className="hidden sm:inline text-xs md:text-sm font-bold tracking-wide" style={{ color: merek.warnaAksen }}>{merek.namaPortal}</span>
              </div>
              <p className="text-slate-500 text-[11px] md:text-xs font-medium mt-0.5 hidden sm:block">{merek.namaPerusahaan}</p>
            </div>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
            {currentUser && (
              <GlobalSearch
                currentUser={currentUser}
                onNavigate={(url) => { setShowSidebar(true); pindahKe(url); }}
              />
            )}
            {currentUser && (
              <NotificationBar currentUser={currentUser} onNavigate={handleNotifNavigate} />
            )}
            {!showSidebar && (
              <div className="hidden md:flex items-center gap-2.5 px-4 py-2 rounded-xl border border-slate-200/80 bg-white/70 backdrop-blur-xs">
                <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0"
                  style={{ background: 'linear-gradient(135deg, #fde68a, #f59e0b)', color: '#78350f' }}>
                  {currentUser?.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
                </div>
                <div className="leading-tight">
                  <p className="text-xs font-bold text-slate-800">{currentUser?.full_name}</p>
                  <p className="text-[10px] font-bold tracking-widest uppercase text-amber-700">{currentUser?.role}</p>
                </div>
              </div>
            )}

            {currentUser && (
              <button type="button" onClick={() => setShowUserProfile(true)} aria-label={`Profil ${currentUser.full_name ?? ''}`}
                className="md:hidden w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                style={{ background: 'linear-gradient(135deg, #fde68a, #f59e0b)', color: '#78350f' }}>
                {currentUser.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
              </button>
            )}

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

  const bukaDashboard = () => { setShowSidebar(true); pindahKe('/dashboard'); };
  const renderNavBawah = () => (!layarPenuh && currentUser ? (
    <NavBawahMobile
      aksen={merek.warnaAksen}
      beranda={{ key: '__dashboard', label: 'Dashboard', aktif: showSidebar ? berandaTersorot : true, onPilih: bukaDashboard }}
      menu={visibleMenuItems.filter(m => m.items.length).map(menu => {
        const it = menu.items[0];
        return {
          key: menu.key, label: menu.title, pendek: LABEL_PENDEK[menu.key],
          ikon: MENU_ICONS[menu.key] ?? <Ikon nama={menu.icon} ukuran="1em" className="inline-block align-[-0.12em]" />,
          aktif: showSidebar && !berandaTersorot && menu.items.some(x => aktifUrl(x.url)),
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

  const renderModals = () => (
    <>
      {showAdminPanel && <AdminPanelModal initialTab={adminPanelTab} onClose={() => setShowAdminPanel(false)} />}
      {showUserProfile && currentUser && <UserProfileModal currentUser={currentUser} onClose={() => setShowUserProfile(false)} />}
    </>
  );

  if (!showSidebar) {
    return (
      <div className={`${dasborMuncul ? 'lc-dasbor-pudar' : ''} flex flex-col bg-cover bg-center bg-fixed`} style={{ ...latarDasbor(merek), height: '100dvh' }}>
        {renderModals()}
        {currentUser && !tourVisible && (
          <AsistenPlatform modul={modulAktif} atasan={asistenAtasan} onMulaiTur={() => setShowTour(true)} />
        )}
        {renderHeader()}

        <div className="flex-1 overflow-y-auto py-6 px-4 md:px-8">
          <div className="max-w-[1600px] mx-auto space-y-8">
            {(
              <>
                {canAccessKPI && currentUser && (
                  <AnalyticsIframe />
                )}
                <GridMenuPortal learningMenuItems={learningMenuItems} projectMenuItems={projectMenuItems}
                  internalMenuItems={internalMenuItems} onMenuClick={handleMenuClick} />

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

  return (
    <div className={`${dasborMuncul ? 'lc-dasbor-pudar' : ''} flex flex-col bg-cover bg-center bg-fixed`} style={{ ...latarDasbor(merek), height: '100dvh' }}>
      {renderModals()}

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
        <SidebarPortal
          sidebarCollapsed={sidebarCollapsed} setSidebarCollapsed={setSidebarCollapsed}
          tourVisible={tourVisible} tourHighlightKey={tourHighlightKey}
          visibleMenuItems={visibleMenuItems} showDashboardPanel={berandaTersorot} aktifUrl={aktifUrl}
          currentUser={currentUser} isAdmin={isAdmin} isFullAccess={isFullAccess}
          pendingUsers={pendingUsers} pendingRequests={pendingRequests}
          onMenu={handleMenuClick} onBeranda={() => pindahKe('/dashboard')}
          onProfil={() => setShowUserProfile(true)}
          onAdminPanel={() => { setAdminPanelTab(pendingUsers > 0 ? 'userManagement' : 'settings'); setShowAdminPanel(true); }}
          onKeluar={handleLogout}
        />

        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className={`flex-1 min-h-0 overflow-hidden relative ${sedangPindah ? 'isi-sedang-pindah' : ''}`}
            style={{ ['--warna-pindah' as string]: merek.warnaAksen }}>
            {sedangPindah && <div aria-hidden="true" className="bilah-pindah-menu" />}
            {showDashboardPanel && currentUser ? (
              <div className="w-full h-full overflow-hidden relative"
                style={latarDasbor(merek)}>
                <PermissionAwareDashboard currentUser={currentUser} openMenu={openMenuByKey} openUrl={handleNotifNavigate}
                  onHubungkanTelegram={() => setShowUserProfile(true)} />
              </div>
            ) : (
              <div ref={setIsiEl} className={layarPenuh
                ? 'isi-portal fixed inset-0 z-300 bg-white overflow-auto'
                : 'isi-portal w-full h-full overflow-auto relative'}>
                {children}
              </div>
            )}
          </div>
        </div>
      </div>

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
