'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { setSession, clearSession, getSession, startSessionWatcher } from '@/lib/auth';
import { isAdmin as checkIsAdmin, SESSION_DURATION_MS } from '@/lib/constants';
import {
  User, MenuItem, NotificationItem,
  SALES_DIVISIONS, JABATAN_LIST, JabatanType, JABATAN_CONFIG, JABATAN_CC_RULES,
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
import OnboardingTour, { JelajahiButton } from './_components/OnboardingTour';

export default function Dashboard() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginErr, setLoginErr] = useState('');
  const [registerErr, setRegisterErr] = useState('');
  const [showRegister, setShowRegister] = useState(false);
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
  const [loading, setLoading] = useState(true);
  const [menuLoading, setMenuLoading] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [showDashboardPanel, setShowDashboardPanel] = useState(false);

  const [showSidebar, setShowSidebar] = useState(false);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [iframeTitle, setIframeTitle] = useState<string>('');
  const [showTicketing, setShowTicketing] = useState(false);
  const [internalUrl, setInternalUrl] = useState<string>('/ticketing');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminPanelTab, setAdminPanelTab] = useState<'settings' | 'userManagement' | 'picBrand'>('settings');
  const [pendingCount, setPendingCount] = useState(0);
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
      title: 'Reminder Schedule', icon: '🗓️', key: 'reminder-schedule',
      gradient: 'from-cyan-700 via-cyan-600 to-teal-500',
      description: 'Jadwal & reminder pekerjaan team PTS',
      items: [{ name: 'Reminder', url: '/reminder-schedule', icon: '⏰', internal: true, embed: true }]
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
      description: 'Jadwal piket showroom Team PTS IVP, UMP & MLDS',
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
      items: [{ name: 'Access Database', url: 'https://1drv.ms/f/c/25d404c0b5ee2b43/IgBDK-61wATUIIAlAgQAAAAAARPyRqbKPJAap5G_Ol5NmA8?e=fFU8wh', icon: '🗃️', embed: false, external: true }]
    },
    {
      title: 'Unit Movement Log', icon: '🚚', key: 'unit-movement',
      gradient: 'from-amber-700 via-amber-600 to-amber-500',
      description: 'Equipment check-in & check-out tracking',
      items: [{ name: 'Unit Movement Log', url: '/unit-movement', icon: '🚚', internal: true, embed: true }]
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
        setVisibleMenuItems(allMenuItems.filter(m => allowed.includes(m.key)));
      }
      setMenuLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [currentUser]);

  const handleLogin = async () => {
    try {
      const { data, error } = await supabase.from('users').select('*').eq('username', loginForm.username).eq('password', loginForm.password).single();
      if (error || !data) { setLoginErr('Username atau password salah!'); return; }
      if (data.team_type === 'Pending Approval') {
        setLoginErr('Akun kamu masih menunggu persetujuan admin. Kamu akan dihubungi setelah akun diaktifkan.');
        return;
      }
      setCurrentUser(data);
      setIsLoggedIn(true);
      setSession(data);
      // Auto-route: langsung ke sidebar, tab pertama sesuai role
      const role = data.role?.toLowerCase() ?? '';
      const isAdminOrSup = ['admin','superadmin'].includes(role) ||
        (role === 'team' && data.jabatan === 'Supervisor') ||
        (['guest','sales'].includes(role) && ['Supervisor','Manager','Deputy General Manager','General Manager','Direktur'].includes(data.jabatan ?? ''));
      const hasTeamDash = role === 'team' && (data.allowed_menus ?? []).includes('dashboard');
      if (isAdminOrSup || hasTeamDash) {
        // Admin/supervisor/team with dashboard: langsung tampilkan sidebar + dashboard panel
        setTimeout(() => { setShowSidebar(true); setShowDashboardPanel(true); }, 50);
      } else {
        // Sales/guest/team tanpa dashboard: langsung ke menu pertama yang allowed
        const firstMenu = (data.allowed_menus ?? [])[0];
        if (firstMenu) {
          setTimeout(() => { setShowSidebar(true); }, 50);
        } else {
          setTimeout(() => { setShowSidebar(true); }, 50);
        }
      }
    } catch { setLoginErr('Login gagal. Coba lagi.'); }
  };

  const handleRegister = async () => {
    const { full_name, username, password, confirm_password, divisi, pts_type, sales_division } = registerForm;
    if (!full_name.trim()) { setRegisterErr('Nama lengkap wajib diisi!'); return; }
    if (!username.trim()) { setRegisterErr('Email / username wajib diisi!'); return; }
    if (!password || password.length < 6) { setRegisterErr('Password minimal 6 karakter!'); return; }
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
      if (existing) { setRegisterErr('Username / email sudah terdaftar. Gunakan username lain.'); setRegisterLoading(false); return; }
      const { error } = await supabase.from('users').insert([{
        full_name: full_name.trim(),
        username: username.trim().toLowerCase(),
        password: password,
        role: 'guest',
        team_type: 'Pending Approval',
        sales_division: requestedDivision,
        jabatan: registerForm.jabatan.trim() || null,
        phone_number: registerForm.phone_number.trim() || null,
        allowed_menus: [],
      }]);
      if (error) throw error;
      setRegisterSuccess(true);
      setRegisterForm({ full_name: '', username: '', password: '', confirm_password: '', divisi: '', pts_type: '', sales_division: '', jabatan: '', phone_number: '' });
    } catch (err: any) {
      setRegisterErr('Registrasi gagal: ' + err.message);
    }
    setRegisterLoading(false);
  };

  const handleLogout = () => {
    setIsLoggedIn(false); setCurrentUser(null);
    clearSession();
    setShowSidebar(false); setIframeUrl(null); setShowTicketing(false); setInternalUrl('/ticketing');
    setShowAdminPanel(false); setShowUserProfile(false);
    router.push('/dashboard');
  };

  // Auto-navigate sales/guest to first allowed menu when sidebar opens
  useEffect(() => {
    if (!isLoggedIn || !currentUser || !showSidebar) return;
    const role = currentUser.role?.toLowerCase() ?? '';
    const isSalesGuest = ['guest','sales'].includes(role);
    const isRegularTeam = role === 'team' && !(currentUser.allowed_menus ?? []).includes('dashboard') && currentUser.jabatan !== 'Supervisor';
    if ((isSalesGuest || isRegularTeam) && visibleMenuItems.length > 0 && !showTicketing && !iframeUrl && !showDashboardPanel) {
      const firstItem = visibleMenuItems[0]?.items?.[0];
      const firstTitle = visibleMenuItems[0]?.title ?? '';
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
  }, [isLoggedIn, showSidebar, visibleMenuItems.length]);

  const handleMenuClick = (item: MenuItem['items'][0], menuTitle: string) => {
    if (item.external && !item.embed) { window.open(item.url, '_blank'); return; }
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

  const handleNotifNavigate = (navInternalUrl: string, title: string) => {
    setIframeUrl(null); setShowTicketing(false); setInternalUrl('/ticketing'); setIframeTitle('');
    setTimeout(() => {
      setShowTicketing(true);
      setInternalUrl(navInternalUrl);
      setIframeTitle(title);
      setShowSidebar(true);
    }, 150);
  };

  const handleBackToDashboard = () => {
    // Tidak kembali ke card view — untuk admin/supervisor: dashboard panel
    // Untuk sales/guest: navigasikan ke menu pertama yang tersedia
    setIframeUrl(null); setShowTicketing(false); setInternalUrl('/ticketing'); setIframeTitle('');
    const role = currentUser?.role?.toLowerCase() ?? '';
    const isAdm = ['admin','superadmin'].includes(role) ||
      (role === 'team' && (currentUser?.jabatan === 'Supervisor' || (currentUser?.allowed_menus ?? []).includes('dashboard')));
    if (isAdm) {
      setShowDashboardPanel(true);
    } else {
      // sales/guest: navigate to first visible menu
      const firstItem = visibleMenuItems[0]?.items?.[0];
      const firstTitle = visibleMenuItems[0]?.title ?? '';
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
        const { data, error } = await supabase.from('users').select('*').eq('id', parsed.id).single();
        const userData: User = (!error && data) ? data : parsed;
        if (!error && data) {
          setCurrentUser(data);
          setSession(data);
        }
        // Auto-route langsung ke sidebar sesuai role
        const role = userData.role?.toLowerCase() ?? '';
        const isAdminOrSup2 = ['admin','superadmin'].includes(role) ||
          (role === 'team' && userData.jabatan === 'Supervisor') ||
          (['guest','sales'].includes(role) && ['Supervisor','Manager','Deputy General Manager','General Manager','Direktur'].includes(userData.jabatan ?? ''));
        const hasTeamDash2 = role === 'team' && (userData.allowed_menus ?? []).includes('dashboard');
        if (isAdminOrSup2 || hasTeamDash2) {
          setShowSidebar(true); setShowDashboardPanel(true);
        } else {
          setShowSidebar(true);
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, []);

  const isAdmin = ['admin', 'superadmin'].includes(currentUser?.role?.toLowerCase() ?? '');

  // KPI: admin + PTS supervisor + sales supervisor + team member with dashboard permission
  const isPTSSupervisor = currentUser?.role === 'team'
    && ['Team PTS', 'Team PTS UMP', 'Team PTS MLDS'].includes(currentUser?.team_type ?? '')
    && currentUser?.jabatan === 'Supervisor';
  const isSalesSupervisor = ['guest', 'sales'].includes(currentUser?.role?.toLowerCase() ?? '')
    && ['Supervisor', 'Manager', 'Deputy General Manager', 'General Manager', 'Direktur'].includes(currentUser?.jabatan ?? '');
  const hasTeamDashboardAccess = currentUser?.role === 'team'
    && (currentUser?.allowed_menus ?? []).includes('dashboard');
  const canAccessKPI = isAdmin || isPTSSupervisor || isSalesSupervisor || hasTeamDashboardAccess;

  useEffect(() => {
    if (!isAdmin) return;

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
        const userPending = (userRes as any).count ?? 0;
        const requestPending = (reminderRes as any).count ?? 0;
        setPendingCount(userPending + requestPending);
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

  const INTERNAL_KEYS = ['reminder-schedule', 'request-design-project', 'form-bast', 'ticket-troubleshooting', 'picket-showroom'];
  const PROJECT_KEYS = ['reminder-schedule', 'request-design-project', 'form-bast', 'ticket-troubleshooting'];
  const INTERNAL_DAILY_KEYS = ['picket-showroom', 'daily-report', 'database-pts', 'unit-movement'];
  // ── Learning Center sebagai section tersendiri ──
  const LEARNING_KEYS = ['learning-center', 'tech-note'];

  const projectMenuItems = visibleMenuItems.filter(m => PROJECT_KEYS.includes(m.key));
  const internalMenuItems = visibleMenuItems.filter(m => INTERNAL_DAILY_KEYS.includes(m.key));
  const learningMenuItems = visibleMenuItems.filter(m => LEARNING_KEYS.includes(m.key));

  const MENU_ICONS: Record<string, React.ReactElement> = {
    'learning-center': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>,
	'picket-showroom': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
    'reminder-schedule': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    'request-design-project': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
    'form-bast': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
    'ticket-troubleshooting': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>,
    'daily-report': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    'database-pts': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>,
    'unit-movement': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>,
    'tech-note': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
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
                  <svg className="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                ) : (
                  <svg className="w-5 h-5 text-slate-400 transition-transform group-hover/item:-translate-x-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
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

  // ── LOADING ──
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

  // ── LOGIN / REGISTER SCREEN ──
  if (!isLoggedIn) {
    return (
      <div className="flex items-center justify-center bg-cover bg-center bg-fixed p-4" style={{ backgroundImage: 'url(/IVP_Background.png)', minHeight: '100dvh' }}>
        <div className={`w-full rounded-3xl shadow-2xl overflow-hidden transition-all ${showRegister ? 'max-w-2xl' : 'max-w-md'}`} style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(20px)' }}>
          <div className="p-6 md:p-8">
            <div className="flex flex-col items-center mb-8">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg ${showRegister ? 'bg-gradient-to-br from-indigo-600 to-indigo-700' : 'bg-gradient-to-br from-rose-600 to-rose-700'}`}>
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {showRegister
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  }
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-slate-800 mb-1 tracking-tight">Work Management</h1>
              <p className="text-slate-500 text-sm font-medium">Support System — IndoVisual</p>
            </div>

            {!showRegister && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold mb-2 text-slate-600 tracking-widest uppercase">Username</label>
                  <input type="text" value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:border-rose-500 focus:ring-2 focus:ring-rose-100 transition-all bg-white text-slate-800 font-medium text-sm outline-none"
                    placeholder="Enter your username" onKeyDown={(e) => e.key === 'Enter' && handleLogin()} />
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
                <button onClick={() => { setLoginErr(''); handleLogin(); }} className="w-full bg-gradient-to-r from-rose-600 to-rose-700 text-white py-3.5 rounded-xl hover:from-rose-700 hover:to-rose-800 font-bold shadow-lg transition-all tracking-wide text-sm mt-2">
                  🔐 Sign In to Portal
                </button>
                <p className="text-center text-xs text-slate-400 pt-1">Belum punya akun? <button onClick={() => setShowRegister(true)} className="text-indigo-600 font-bold hover:underline">Daftar di sini</button></p>
              </div>
            )}

            {showRegister && (
              <div>
                {registerSuccess ? (
                  <div className="text-center py-6">
                    <div className="text-5xl mb-4">✅</div>
                    <h3 className="font-bold text-slate-800 text-lg mb-2">Pendaftaran Berhasil!</h3>
                    <p className="text-slate-500 text-sm mb-4">Akun kamu akan diverifikasi oleh admin. Kamu akan dihubungi setelah akun diaktifkan.</p>
                    <button onClick={() => { setShowRegister(false); setRegisterSuccess(false); }} className="bg-rose-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-rose-700 transition-all">Kembali ke Login</button>
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
                          <label className="block text-xs font-bold mb-1.5 text-slate-600 tracking-widest uppercase">Username / Email *</label>
                          <input type="text" value={registerForm.username} onChange={e => setRegisterForm({ ...registerForm, username: e.target.value })}
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="username atau email" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold mb-1.5 text-slate-600 tracking-widest uppercase">Password *</label>
                          <input type="password" value={registerForm.password} onChange={e => setRegisterForm({ ...registerForm, password: e.target.value })}
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="min. 6 karakter" />
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
                          <select value={registerForm.divisi} onChange={e => setRegisterForm({ ...registerForm, divisi: e.target.value, pts_type: '', sales_division: '' })}
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
                            <select value={registerForm.pts_type} onChange={e => setRegisterForm({ ...registerForm, pts_type: e.target.value })}
                              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all bg-white">
                              <option value="">-- Pilih Tipe PTS --</option>
                              <option value="PTS IVP">PTS IVP</option>
                              <option value="PTS UMP">PTS UMP</option>
                              <option value="PTS MLDS">PTS MLDS</option>
                            </select>
                          </div>
                        )}
                        {(registerForm.divisi === 'Sales' || registerForm.divisi === 'Marketing') && (
                          <div>
                            <label className="block text-xs font-bold mb-1.5 text-slate-600 tracking-widest uppercase">Sales Division *</label>
                            <select value={registerForm.sales_division} onChange={e => setRegisterForm({ ...registerForm, sales_division: e.target.value })}
                              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all bg-white">
                              <option value="">-- Pilih Sales Division --</option>
                              {SALES_DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                          </div>
                        )}
                        <div>
                          <label className="block text-xs font-bold mb-1.5 text-slate-600 tracking-widest uppercase">Jabatan / Posisi</label>
                          <select value={registerForm.jabatan} onChange={e => setRegisterForm({ ...registerForm, jabatan: e.target.value })}
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
                    <p className="text-center text-xs text-slate-400">Sudah punya akun? <button onClick={() => { setShowRegister(false); setRegisterErr(''); }} className="text-rose-600 font-bold hover:underline">Login</button></p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── SHARED HEADER JSX ──
  const renderHeader = (withBackBtn = false) => (
    <div className="bg-white/80 backdrop-blur-md shadow-md flex-shrink-0" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', position: 'relative', zIndex: 50 }}>
      <div className="w-full px-3 md:px-4 py-3 md:py-3.5">
        <div className="flex items-center justify-between gap-2 md:gap-4">
          {/* LEFT: Logo */}
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            <div className="w-9 h-9 md:w-12 md:h-12 bg-gradient-to-br from-rose-600 to-rose-700 rounded-xl shadow-md flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-1.5 md:gap-2.5">
                <h1 className="text-sm md:text-xl font-bold text-slate-800 tracking-tight leading-tight">
                  <span className="hidden sm:inline">Work Management Platform</span>
                  <span className="sm:hidden">WM Platform</span>
                </h1>
                <span className="hidden sm:inline text-slate-300 font-light">|</span>
                <span className="hidden sm:inline text-xs md:text-sm font-bold tracking-wide" style={{ color: '#c8861d' }}>PTS Portal</span>
              </div>
              <p className="text-slate-500 text-[10px] md:text-xs font-medium mt-0.5 hidden sm:block">IndoVisual Professional Tools</p>
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
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

  // ── MODAL RENDERS (shared) ──
  const renderModals = () => (
    <>
      {showAdminPanel && <AdminPanelModal initialTab={adminPanelTab} onClose={() => setShowAdminPanel(false)} />}
      {showUserProfile && currentUser && <UserProfileModal currentUser={currentUser} onClose={() => setShowUserProfile(false)} />}
    </>
  );

  // ── VIEW: NO SIDEBAR (main dashboard) ──
  if (!showSidebar) {
    return (
      <div className="flex flex-col bg-cover bg-center bg-fixed" style={{ backgroundImage: 'url(/IVP_Background.png)', height: '100dvh' }}>
        {renderModals()}
        {/* ── Onboarding Tour ── */}
        {currentUser && (
          <>
            <OnboardingTour
              currentUser={currentUser}
              forceShow={showTour}
              onDone={() => setShowTour(false)}
            />
            {!showTour && (
              <JelajahiButton onClick={() => setShowTour(true)} />
            )}
          </>
        )}
        {renderHeader()}

        <div className="flex-1 overflow-y-auto py-6 px-4 md:px-8">
          <div className="max-w-[1600px] mx-auto space-y-8">
            {menuLoading ? <MenuLoadingOverlay /> : (
              <>
                {/* ── Analytics Dashboard — admin, PTS sup, sales sup ── */}
                {canAccessKPI && currentUser && (
                  <div style={{ animation: "fadeInUp 0.35s ease forwards", opacity: 0, height: '85vh' }}>
                    <iframe
                      src="/analytics-dashboard"
                      className="w-full h-full border-0 rounded-3xl overflow-hidden"
                      style={{ boxShadow: '0 4px 32px rgba(0,0,0,0.12)' }}
                      title="Analytics Dashboard"
                    />
                  </div>
                )}
				{/* ── Learning Center section (BARU) ── */}
                {learningMenuItems.length > 0 && (
                  <div style={{ animation: 'fadeInUp 0.45s ease 0.2s forwards', opacity: 0 }}>
                    <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-xl"
                      style={{ background: 'rgba(15,23,42,0.72)', backdropFilter: 'blur(8px)', boxShadow: '0 2px 12px rgba(0,0,0,0.25)' }}>
                      <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #60a5fa, #4338ca)' }}>
                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes dropIn { from { opacity: 0; transform: translateY(-8px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        `}</style>
      </div>
    );
  }

  // ── VIEW: SIDEBAR ──
  return (
    <div className="flex flex-col bg-cover bg-center bg-fixed" style={{ backgroundImage: 'url(/IVP_Background.png)', height: '100dvh' }}>
      {renderModals()}
      {renderHeader()}

      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR */}
        <div
          className={`relative flex flex-col transition-all duration-300 ease-in-out flex-shrink-0 ${sidebarCollapsed ? 'w-[48px] md:w-[64px]' : 'w-[220px] md:w-[272px]'}`}
          style={{
            background: 'rgba(255,255,255,0.88)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '2px 0 20px rgba(0,0,0,0.10)',
            borderRight: '1px solid rgba(0,0,0,0.07)',
          }}
        >
          {/* Top accent line */}
          <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, #c8861d 40%, #e2a84b 60%, transparent)' }} />

          {/* Collapse button — absolute top-right */}
          {!sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(true)}
              className="absolute top-2 right-2 z-10 w-6 h-6 rounded-md flex items-center justify-center transition-all"
              style={{ color: '#cbd5e1' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.06)'; (e.currentTarget as HTMLButtonElement).style.color = '#64748b'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#cbd5e1'; }}
              title="Collapse sidebar"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <button
                  onClick={() => setSidebarCollapsed(false)}
                  className="w-full h-9 rounded-lg flex items-center justify-center transition-all mb-1"
                  style={{ color: '#94a3b8' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.06)'; (e.currentTarget as HTMLButtonElement).style.color = '#334155'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; }}
                  title="Main Menu"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>
                {canAccessKPI && (
                  <button
                    onClick={() => { setShowDashboardPanel(true); setShowTicketing(false); setIframeUrl(null); setIframeLoading(true); }}
                    title="Dashboard"
                    className="w-full h-9 rounded-lg flex items-center justify-center text-base transition-all"
                    style={showDashboardPanel
                      ? { background: 'rgba(200,134,29,0.15)', border: '1px solid rgba(200,134,29,0.35)', color: '#92600a' }
                      : { background: 'transparent', border: '1px solid transparent', color: '#64748b' }}
                  >📊</button>
                )}
                {visibleMenuItems.map((menu) => (
                  <div key={menu.key}>
                    {menu.items.map((item, itemIndex) => {
                      const isActive = !showDashboardPanel && ((showTicketing && item.internal && internalUrl === item.url) || (iframeUrl === item.url));
                      return (
                        <button
                          key={itemIndex}
                          onClick={() => { setShowDashboardPanel(false); handleMenuClick(item, menu.title); }}
                          title={`${menu.title} — ${item.name}`}
                          className="w-full h-9 rounded-lg flex items-center justify-center text-base transition-all"
                          style={
                            isActive
                              ? { background: 'rgba(200,134,29,0.15)', border: '1px solid rgba(200,134,29,0.35)', color: '#92600a' }
                              : { background: 'transparent', border: '1px solid transparent', color: '#64748b' }
                          }
                          onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.06)'; }}
                          onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                        >
                          {MENU_ICONS[menu.key] ?? <span>{menu.icon}</span>}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : (
              /* Expanded: full nav */
              <div className="space-y-4">

                {/* ── Dashboard item (untuk admin/supervisor) ── */}
                {canAccessKPI && (
                  <div>
                    <button
                      onClick={() => { setShowDashboardPanel(true); setShowTicketing(false); setIframeUrl(null); setIframeLoading(true); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all"
                      style={showDashboardPanel
                        ? { background: 'rgba(200,134,29,0.12)', border: '1px solid rgba(200,134,29,0.30)', color: '#92600a' }
                        : { background: 'transparent', border: '1px solid transparent', color: '#475569' }}
                      onMouseEnter={e => { if (!showDashboardPanel) { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.04)'; } }}
                      onMouseLeave={e => { if (!showDashboardPanel) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; } }}
                    >
                      <span className="w-5 h-5 text-sm flex items-center justify-center flex-shrink-0">📊</span>
                      <span className="text-sm font-semibold truncate">Dashboard</span>
                      {showDashboardPanel && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />}
                    </button>
                  </div>
                )}

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
                          return (
                            <button
                              key={menu.key}
                              onClick={() => handleMenuClick(item, menu.title)}
                              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all"
                              style={
                                isActive
                                  ? { background: 'rgba(67,56,202,0.10)', border: '1px solid rgba(67,56,202,0.25)', color: '#3730a3' }
                                  : { background: 'transparent', border: '1px solid transparent', color: '#334155' }
                              }
                              onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(67,56,202,0.05)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(67,56,202,0.12)'; } }}
                              onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'; } }}
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
                          return (
                            <button
                              key={menu.key}
                              onClick={() => handleMenuClick(item, menu.title)}
                              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all"
                              style={
                                isActive
                                  ? { background: 'rgba(200,134,29,0.11)', border: '1px solid rgba(200,134,29,0.28)', color: '#92600a' }
                                  : { background: 'transparent', border: '1px solid transparent', color: '#334155' }
                              }
                              onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.05)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,0,0,0.06)'; } }}
                              onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'; } }}
                            >
                              <span
                                className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 transition-colors"
                                style={{
                                  background: isActive ? 'rgba(200,134,29,0.18)' : 'rgba(0,0,0,0.06)',
                                  color: isActive ? '#92600a' : '#64748b',
                                }}
                              >
                                {MENU_ICONS[menu.key] ?? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth={2} /></svg>}
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
                          return (
                            <button
                              key={`${menu.key}-${itemIndex}`}
                              onClick={() => handleMenuClick(item, menu.title)}
                              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all"
                              style={
                                isActive
                                  ? { background: 'rgba(200,134,29,0.11)', border: '1px solid rgba(200,134,29,0.28)', color: '#92600a' }
                                  : { background: 'transparent', border: '1px solid transparent', color: '#334155' }
                              }
                              onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.05)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,0,0,0.06)'; } }}
                              onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'; } }}
                            >
                              <span
                                className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 transition-colors"
                                style={{
                                  background: isActive ? 'rgba(200,134,29,0.18)' : 'rgba(0,0,0,0.06)',
                                  color: isActive ? '#92600a' : '#64748b',
                                }}
                              >
                                {MENU_ICONS[menu.key] ?? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth={2} /></svg>}
                              </span>
                              <span className="flex-1 truncate text-sm font-medium">{item.name}</span>
                              {item.external && !item.embed && (
                                <svg className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <button
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
                    title="Admin Panel"
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#4338ca'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.1)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {pendingCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">{pendingCount}</span>
                    )}
                  </button>
                )}

                {/* Sign out */}
                <button
                  onClick={handleLogout}
                  className="w-9 h-9 rounded-lg flex items-center justify-center transition-all"
                  style={{ color: '#94a3b8' }}
                  title="Sign Out"
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#b91c1c'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.07)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>Admin Panel</span>
                    {pendingCount > 0 && (
                      <span className="ml-auto text-[10px] font-black bg-red-500 text-white rounded-full px-1.5 py-0.5 leading-none">{pendingCount}</span>
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
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign out
                </button>

              </div>
            )}
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          <div className="flex-1 overflow-hidden bg-white relative">
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
            {showDashboardPanel && canAccessKPI && currentUser ? (
              /* ── Analytics Dashboard — iframe ke /analytics-dashboard ── */
              <div className="w-full h-full overflow-hidden relative">
                {iframeLoading && (
                  <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-10 h-10 rounded-full border-[3px] border-t-transparent animate-spin" style={{ borderColor: 'rgba(226,168,75,0.25)', borderTopColor: '#e2a84b' }} />
                      <p className="text-slate-500 text-sm font-semibold tracking-wide">Memuat Dashboard...</p>
                    </div>
                  </div>
                )}
                <iframe
                  key="analytics-dashboard"
                  src="/analytics-dashboard"
                  className="w-full h-full border-0"
                  title="Analytics Dashboard"
                  onLoad={() => setIframeLoading(false)}
                />
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
                <div className="text-center bg-white/90 rounded-2xl px-8 py-6 shadow-lg backdrop-blur-sm">
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
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes dropIn { from { opacity: 0; transform: translateY(-8px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes loadingBar {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(80%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}
