'use client';

import { useState, useEffect, useMemo, useRef, useCallback, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase, SESI_HABIS } from '@/lib/supabase';
import { setSession, clearSession, getSession, verifySessionFromCookie, cekSesiServer } from '@/lib/auth/sesi';
import { hasFullAccess } from '@/lib/constants';
import { isPimpinan } from '@/lib/pimpinan';
import type { User, MenuItem } from '../dashboard/_components/shared';
import { tujuanLanjutAman } from '@/lib/tujuan-lanjut';
import { DAFTAR_MENU, LEARNING_KEYS, PROJECT_KEYS, INTERNAL_DAILY_KEYS } from './daftar-menu';
import { useMerek } from '@/lib/merek/inti';
import { kembaliTerang } from '@/components/shared/Tema';
import { catatPemakaian } from '@/lib/pemakaian';
import { pasangMiring3D } from '@/lib/miring3d';
import { useLisensi } from '@/components/shared/Lisensi';
import { menuBoleh } from '@/lib/lisensi/inti';

export function useKerangkaPortal() {
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
  const lisensi = useLisensi();
  const visibleMenuItems: MenuItem[] = useMemo(() => {
    if (!kunciMenu) return [];
    const izin = kunciMenu.split(',');
    return (kunciMenu === '*' ? DAFTAR_MENU : DAFTAR_MENU.filter(m => izin.includes(m.key))).filter(m => menuBoleh(m.key, lisensi));
  }, [kunciMenu, lisensi]);

  const sesiBerakhir = useCallback(() => {
    kembaliTerang(); autoNavigatedRef.current = false;
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
        setPendingUsers((userRes).count ?? 0);
        setPendingRequests((reminderRes).count ?? 0);
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
  return {
    loading, merek, isLoggedIn, setCurrentUser, autoNavigatedRef, masukKeDashboard, currentUser, setShowSidebar,
    pindahKe, handleNotifNavigate, showSidebar, setShowUserProfile, handleLogout, layarPenuh, berandaTersorot, visibleMenuItems,
    aktifUrl, isFullAccess, pendingRequests, handleMenuClick, isAdmin, pendingUsers, setAdminPanelTab, setShowAdminPanel,
    showAdminPanel, adminPanelTab, showUserProfile, dasborMuncul, tourVisible, modulAktif, asistenAtasan, setShowTour,
    canAccessKPI, learningMenuItems, projectMenuItems, internalMenuItems, showTour, setTourHighlightKey, setTourVisible, sidebarCollapsed,
    setSidebarCollapsed, tourHighlightKey, sedangPindah, showDashboardPanel, openMenuByKey, setIsiEl, lisensi,
  };
}
