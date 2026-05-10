'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
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

export default function Dashboard() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
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

  const [visibleMenuItems, setVisibleMenuItems] = useState<MenuItem[]>([]);

  const allMenuItems: MenuItem[] = [
    {
      title: 'Piket Showroom', icon: '🏪', key: 'picket-showroom',
      gradient: 'from-teal-700 via-teal-600 to-cyan-500',
      description: 'Jadwal piket showroom Team PTS IVP, UMP & MLDS',
      items: [{ name: 'Piket Showroom', url: '/picket-showroom', icon: '📅', internal: true, embed: true }]
    },
    {
      title: 'Reminder Schedule', icon: '🗓️', key: 'reminder-schedule',
      gradient: 'from-cyan-700 via-cyan-600 to-teal-500',
      description: 'Jadwal & reminder pekerjaan team PTS',
      items: [{ name: 'Reminder', url: '/reminder-schedule', icon: '⏰', internal: true, embed: true }]
    },
    {
      title: 'Form Require Project', icon: '🏗️', key: 'form-require-project',
      gradient: 'from-violet-700 via-violet-600 to-violet-500',
      description: 'Solution request form untuk project Sales',
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
      title: 'Daily Report', icon: '📈', key: 'daily-report',
      gradient: 'from-emerald-700 via-emerald-600 to-emerald-500',
      description: 'Activity tracking & performance metrics',
      items: [
        { name: 'Submit Daily Report', url: 'https://docs.google.com/forms/d/e/1FAIpQLSf2cCEPlQQcCR1IZ3GRx-ImgdJJ15rMxAoph77aNYmbl15gvw/viewform?embedded=true', icon: '✍️', embed: true },
        { name: 'View Daily Report', url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRMeC3gBgeCAe5YNoVE4RfdANVyjx7xmtTA7C-G40KhExzgvAJ4cGTcyFcgbp4WWx7laBdC3VZrBGd0/pubhtml?gid=1408443365&single=true', icon: '📑', embed: true },
      ]
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
      if (error || !data) { alert('Username atau password salah!'); return; }
      if (data.team_type === 'Pending Approval') {
        alert('Akun kamu masih menunggu persetujuan admin.\nKamu akan dihubungi setelah akun diaktifkan.');
        return;
      }
      setCurrentUser(data);
      setIsLoggedIn(true);
      const now = Date.now();
      localStorage.setItem('currentUser', JSON.stringify(data));
      localStorage.setItem('loginTime', now.toString());
    } catch { alert('Login gagal!'); }
  };

  const handleRegister = async () => {
    const { full_name, username, password, confirm_password, divisi, pts_type, sales_division } = registerForm;
    if (!full_name.trim()) { alert('Nama lengkap wajib diisi!'); return; }
    if (!username.trim()) { alert('Email / username wajib diisi!'); return; }
    if (!password || password.length < 6) { alert('Password minimal 6 karakter!'); return; }
    if (password !== confirm_password) { alert('Konfirmasi password tidak cocok!'); return; }
    if (!divisi) { alert('Pilih divisi!'); return; }
    if (divisi === 'PTS' && !pts_type) { alert('Pilih tipe PTS!'); return; }
    if (divisi === 'Sales' && !sales_division) { alert('Pilih sales division!'); return; }

    // Simpan divisi request di sales_division sementara, admin yg approve nanti
    let requestedDivision: string | null = null;
    if (divisi === 'PTS') requestedDivision = pts_type; // 'PTS IVP' / 'PTS UMP' / 'PTS MLDS'
    else if (divisi === 'Sales') requestedDivision = sales_division;
    else if (divisi === 'Marketing') requestedDivision = 'Marketing';

    setRegisterLoading(true);
    try {
      const { data: existing } = await supabase.from('users').select('id').eq('username', username.trim().toLowerCase()).maybeSingle();
      if (existing) { alert('Username / email sudah terdaftar. Gunakan username lain.'); setRegisterLoading(false); return; }
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
      alert('Registrasi gagal: ' + err.message);
    }
    setRegisterLoading(false);
  };

  const handleLogout = () => {
    setIsLoggedIn(false); setCurrentUser(null);
    localStorage.removeItem('currentUser');
    setShowSidebar(false); setIframeUrl(null); setShowTicketing(false); setInternalUrl('/ticketing');
    setShowAdminPanel(false); setShowUserProfile(false);
    router.push('/dashboard');
  };

  const handleMenuClick = (item: MenuItem['items'][0], menuTitle: string) => {
    if (item.external && !item.embed) { window.open(item.url, '_blank'); return; }
    setIframeUrl(null); setShowTicketing(false); setInternalUrl('/ticketing');
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
    setShowSidebar(false); setIframeUrl(null); setShowTicketing(false); setInternalUrl('/ticketing'); setIframeTitle('');
  };

  useEffect(() => {
    const load = async () => {
      const saved = localStorage.getItem('currentUser');
      const savedTime = localStorage.getItem('loginTime');
      if (!saved) { setLoading(false); return; }
      if (savedTime) {
        const sixHours = 6 * 60 * 60 * 1000;
        if (Date.now() - parseInt(savedTime) > sixHours) {
          localStorage.removeItem('currentUser'); localStorage.removeItem('loginTime');
          setLoading(false); return;
        }
      }
      try {
        const parsed: User = JSON.parse(saved);
        setCurrentUser(parsed);
        setIsLoggedIn(true);
        const { data, error } = await supabase.from('users').select('*').eq('id', parsed.id).single();
        if (!error && data) {
          setCurrentUser(data);
          localStorage.setItem('currentUser', JSON.stringify(data));
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, []);

  const isAdmin = ['admin', 'superadmin'].includes(currentUser?.role?.toLowerCase() ?? '');

  useEffect(() => {
    if (!isAdmin) return;
    supabase.from('users').select('id', { count: 'exact', head: true }).eq('team_type', 'Pending Approval')
      .then(({ count }) => setPendingCount(count ?? 0));
  }, [isAdmin]);

  const INTERNAL_KEYS = ['reminder-schedule', 'form-require-project', 'form-bast', 'ticket-troubleshooting', 'picket-showroom'];
  const PROJECT_KEYS = ['reminder-schedule', 'form-require-project', 'form-bast', 'ticket-troubleshooting', 'picket-showroom'];
  const INTERNAL_DAILY_KEYS = ['daily-report', 'database-pts', 'unit-movement'];

  const projectMenuItems = visibleMenuItems.filter(m => PROJECT_KEYS.includes(m.key));
  const internalMenuItems = visibleMenuItems.filter(m => INTERNAL_DAILY_KEYS.includes(m.key));

  const MENU_ICONS: Record<string, JSX.Element> = {
    'picket-showroom': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
    'reminder-schedule': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    'form-require-project': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
    'form-bast': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
    'ticket-troubleshooting': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>,
    'daily-report': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    'database-pts': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>,
    'unit-movement': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>,
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
        <div className={`bg-gradient-to-br ${menu.gradient} ${isSingleInternal ? 'p-8' : 'p-6'} relative overflow-hidden`}>
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
      <div className="min-h-screen flex items-center justify-center bg-cover bg-center" style={{ backgroundImage: 'url(/IVP_Background.png)' }}>
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
      <div className="min-h-screen flex items-center justify-center bg-cover bg-center bg-fixed p-4" style={{ backgroundImage: 'url(/IVP_Background.png)' }}>
        <div className={`w-full rounded-3xl shadow-2xl overflow-hidden transition-all ${showRegister ? 'max-w-2xl' : 'max-w-md'}`} style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(20px)' }}>
          <div className="p-8">
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
                    placeholder="Enter your password" onKeyDown={(e) => e.key === 'Enter' && handleLogin()} />
                </div>
                <button onClick={handleLogin} className="w-full bg-gradient-to-r from-rose-600 to-rose-700 text-white py-3.5 rounded-xl hover:from-rose-700 hover:to-rose-800 font-bold shadow-lg transition-all tracking-wide text-sm mt-2">
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
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
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
                            <label className="block text-xs font-bold mb-1.5 text-slate-600 tracking-widest uppercase">Tipe PTS *</label>
                            <select value={registerForm.pts_type} onChange={e => setRegisterForm({ ...registerForm, pts_type: e.target.value })}
                              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all bg-white">
                              <option value="">-- Pilih Tipe PTS --</option>
                              <option value="PTS IVP">PTS IVP</option>
                              <option value="PTS UMP">PTS UMP</option>
                              <option value="PTS MLDS">PTS MLDS</option>
                            </select>
                          </div>
                        )}
                        {registerForm.divisi === 'Sales' && (
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
                          <label className="block text-xs font-bold mb-1.5 text-slate-600 tracking-widest uppercase">No. Telepon / WhatsApp</label>
                          <input type="tel" value={registerForm.phone_number} onChange={e => setRegisterForm({ ...registerForm, phone_number: e.target.value })}
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="Contoh: 08123456789" />
                        </div>
                      </div>
                    </div>
                    <button onClick={handleRegister} disabled={registerLoading}
                      className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 text-white py-3.5 rounded-xl font-bold shadow-lg transition-all text-sm disabled:opacity-60 flex items-center justify-center gap-2">
                      {registerLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                      📝 Daftar Akun
                    </button>
                    <p className="text-center text-xs text-slate-400">Sudah punya akun? <button onClick={() => setShowRegister(false)} className="text-rose-600 font-bold hover:underline">Login</button></p>
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
    <div className="bg-white/80 backdrop-blur-md shadow-md border-b border-slate-200/70" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', position: 'relative', zIndex: 9999 }}>
      <div className="w-full px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* LEFT */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="w-12 h-12 bg-gradient-to-br from-rose-600 to-rose-700 rounded-xl shadow-md flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 tracking-tight">Work Management Portal</h1>
              <p className="text-slate-500 text-xs font-medium mt-0.5">IndoVisual Professional Tools</p>
            </div>
          </div>

          {/* CENTER — hanya di main menu (non-sidebar), notif di tengah */}
          {!showSidebar && currentUser && (
            <div className="flex-1 flex justify-center px-4">
              <NotificationBar currentUser={currentUser} onNavigate={handleNotifNavigate} />
            </div>
          )}
          {showSidebar && <div className="flex-1" />}

          {/* RIGHT */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* NotificationBar — di kanan hanya saat sidebar view */}
            {showSidebar && currentUser && (
              <NotificationBar currentUser={currentUser} onNavigate={handleNotifNavigate} />
            )}

            {/* User badge — hanya di main menu (non-sidebar) */}
            {!showSidebar && (
              <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl border border-slate-200/80 bg-white/70 backdrop-blur-sm">
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

            {/* User Profile — hanya di main menu */}
            {!showSidebar && (
              <button onClick={() => setShowUserProfile(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: '#065f46' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(16,185,129,0.15)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(16,185,129,0.08)'; }}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                User Profile
              </button>
            )}

            {/* Sign Out — hanya di main menu */}
            {!showSidebar && (
              <button onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.22)', color: '#b91c1c' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.13)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.07)'; }}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
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
      <div className="min-h-screen flex flex-col bg-cover bg-center bg-fixed" style={{ backgroundImage: 'url(/IVP_Background.png)' }}>
        {renderModals()}
        {renderHeader()}

        <div className="flex-1 overflow-y-auto py-8 px-4 md:px-8">
          <div className="max-w-[1600px] mx-auto space-y-8">
            {menuLoading ? <MenuLoadingOverlay /> : (
              <>
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
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {projectMenuItems.map((menu, i) => renderMenuCard(menu, i, '#0ea5e9'))}
                    </div>
                  </div>
                )}

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
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {internalMenuItems.map((menu, i) => renderMenuCard(menu, i, '#10b981'))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="bg-white/70 backdrop-blur-sm border-t border-slate-200/60">
          <div className="max-w-[1600px] mx-auto px-6 py-4">
            <p className="text-slate-500 text-xs font-medium tracking-wide text-center">© 2026 IndoVisual — Work Management Support (PTS IVP)</p>
          </div>
        </div>

        <style jsx>{`
          @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes dropIn { from { opacity: 0; transform: translateY(-8px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        `}</style>
      </div>
    );
  }

  // ── VIEW: SIDEBAR ──
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-cover bg-center bg-fixed" style={{ backgroundImage: 'url(/IVP_Background.png)' }}>
      {renderModals()}
      {renderHeader()}

      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR */}
        <div className={`relative flex flex-col transition-all duration-300 ease-in-out ${sidebarCollapsed ? 'w-[72px]' : 'w-[288px]'}`}
          style={{ background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', boxShadow: '4px 0 24px rgba(0,0,0,0.12)' }}>
          <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, #c8861d, transparent)' }} />

          <div className={`flex items-center border-b px-4 py-5 ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`} style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
            {!sidebarCollapsed && (
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #e2a84b, #c8861d)' }}>
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
                  </svg>
                </div>
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.2em] uppercase" style={{ color: '#c8861d' }}>IndoVisual</p>
                  <p className="font-bold text-sm leading-none tracking-wide" style={{ color: '#0f172a' }}>PTS Portal</p>
                </div>
              </div>
            )}
            {sidebarCollapsed && (
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #e2a84b, #c8861d)' }}>
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
                </svg>
              </div>
            )}
            {!sidebarCollapsed && (
              <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="p-1.5 rounded-md transition-all hover:bg-black/10 text-slate-400 hover:text-slate-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M18 19l-7-7 7-7" /></svg>
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-3" style={{ scrollbarWidth: 'none' }}>
            <button onClick={handleBackToDashboard}
              className={`w-full group flex items-center gap-3 px-3 py-2.5 mb-4 font-bold transition-all ${sidebarCollapsed ? 'justify-center' : 'justify-center'}`}
              style={{ color: '#334155' }}
              //onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.08)'; (e.currentTarget as HTMLButtonElement).style.color = '#0f172a'; }}
             //</div> onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.04)'; (e.currentTarget as HTMLButtonElement).style.color = '#334155'; }}
             >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              {!sidebarCollapsed && <span className="text-sm tracking-wide">Main Menu</span>}
            </button>

            {!sidebarCollapsed && <div className="mb-3" />}

            {menuLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'rgba(226,168,75,0.4)', borderTopColor: '#e2a84b' }} />
              </div>
            ) : sidebarCollapsed ? (
              <div className="space-y-1">
                {visibleMenuItems.map((menu) => (
                  <div key={menu.key} className="group relative">
                    <div className="flex flex-col gap-1">
                      {menu.items.map((item, itemIndex) => {
                        const isActive = (showTicketing && item.internal && internalUrl === item.url) || (iframeUrl === item.url);
                        return (
                          <button key={itemIndex} onClick={() => handleMenuClick(item, menu.title)} title={`${menu.title} — ${item.name}`}
                            className="w-full h-9 rounded-lg flex items-center justify-center text-base transition-all"
                            style={isActive ? { background: 'rgba(200,134,29,0.18)', border: '1px solid rgba(200,134,29,0.4)', color: '#92600a' } : { background: 'transparent', border: '1px solid transparent', color: '#64748b' }}
                            onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.07)'; }}
                            onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
                            {MENU_ICONS[menu.key] ?? <span>{menu.icon}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {visibleMenuItems.filter(m => PROJECT_KEYS.includes(m.key)).length > 0 && (
                  <div>
                    <p className="px-1 mb-2 text-xs font-bold tracking-wide uppercase" style={{ color: 'rgba(0,0,0,0.55)' }}>Project</p>
                    <div className="space-y-0.5">
                      {visibleMenuItems.filter(m => PROJECT_KEYS.includes(m.key)).map(menu => {
                        if (menu.items.length === 1) {
                          const item = menu.items[0];
                          const isActive = (showTicketing && item.internal && internalUrl === item.url) || (iframeUrl === item.url);
                          return (
                            <button key={menu.key} onClick={() => handleMenuClick(item, menu.title)}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left font-medium transition-all"
                              style={isActive ? { background: 'rgba(200,134,29,0.12)', border: '1px solid rgba(200,134,29,0.3)', color: '#92600a' } : { background: 'transparent', border: '1px solid transparent', color: '#1e293b' }}
                              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.06)'; }}
                              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
                              <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: isActive ? 'rgba(200,134,29,0.15)' : 'rgba(0,0,0,0.07)', color: isActive ? '#92600a' : '#475569' }}>
                                {MENU_ICONS[menu.key] ?? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth={2}/></svg>}
                              </span>
                              <span className="truncate text-sm tracking-wide">{menu.title}</span>
                              {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#b8760d' }} />}
                            </button>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                )}

                {visibleMenuItems.filter(m => INTERNAL_DAILY_KEYS.includes(m.key)).length > 0 && (
                  <div>
                    <p className="px-1 mb-2 text-xs font-bold tracking-wide uppercase" style={{ color: 'rgba(0,0,0,0.55)' }}>Internal Daily</p>
                    <div className="space-y-0.5">
                      {visibleMenuItems.filter(m => INTERNAL_DAILY_KEYS.includes(m.key)).flatMap(menu =>
                        menu.items.map((item, itemIndex) => {
                          const isActive = (showTicketing && item.internal && internalUrl === item.url) || (iframeUrl === item.url);
                          return (
                            <button key={`${menu.key}-${itemIndex}`} onClick={() => handleMenuClick(item, menu.title)}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left font-medium transition-all"
                              style={isActive ? { background: 'rgba(200,134,29,0.12)', border: '1px solid rgba(200,134,29,0.3)', color: '#92600a' } : { background: 'transparent', border: '1px solid transparent', color: '#1e293b' }}
                              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.06)'; }}
                              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
                              <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: isActive ? 'rgba(200,134,29,0.15)' : 'rgba(0,0,0,0.07)', color: isActive ? '#92600a' : '#475569' }}>
                                {MENU_ICONS[menu.key] ?? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth={2}/></svg>}
                              </span>
                              <span className="truncate text-sm tracking-wide">{item.name}</span>
                              {item.external && !item.embed && <svg className="ml-auto w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>}
                              {isActive && !item.external && <div className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#b8760d' }} />}
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

          {/* SIDEBAR BOTTOM: User Profile + Admin Panel (admin only) + Sign Out */}
          <div className="flex-shrink-0" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
            {sidebarCollapsed ? (
              /* ── Collapsed state: icon-only buttons ── */
              <div className="p-2 flex flex-col items-center gap-1.5">
                <button onClick={() => setSidebarCollapsed(false)} className="w-9 h-9 rounded-lg flex items-center justify-center transition-all text-slate-400 hover:text-slate-600" style={{ background: 'rgba(0,0,0,0.04)' }} title="Expand sidebar">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M6 5l7 7-7 7" /></svg>
                </button>
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 cursor-pointer"
                  style={{ background: 'linear-gradient(135deg, #fde68a, #f59e0b)', color: '#78350f' }}
                  title={currentUser?.full_name ?? ''}
                  onClick={() => setShowUserProfile(true)}>
                  {currentUser?.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
                </div>
                {isAdmin && (
                  <button onClick={() => { setAdminPanelTab('settings'); setShowAdminPanel(true); }} className="relative w-9 h-9 rounded-lg flex items-center justify-center transition-all" style={{ color: '#94a3b8' }} title="Admin Panel"
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#4338ca'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.1)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {pendingCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">{pendingCount}</span>}
                  </button>
                )}
                <button onClick={handleLogout} className="w-9 h-9 rounded-lg flex items-center justify-center transition-all" style={{ color: '#94a3b8' }} title="Sign Out"
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#b91c1c'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.07)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            ) : (
              /* ── Expanded state: user profile row + admin panel (if admin) + sign out ── */
              <div className="p-3 space-y-1">
                {/* User profile row — di atas, dengan arrow lebih visible */}
                <button
                  onClick={() => setShowUserProfile(true)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left group"
                  style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.05)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.07)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(200,134,29,0.25)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.03)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,0,0,0.05)'; }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #fde68a, #f59e0b)', color: '#78350f' }}>
                    {currentUser?.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate leading-tight" style={{ color: '#1e293b' }}>{currentUser?.full_name ?? '-'}</p>
                    <p className="text-[10px] font-bold tracking-widest uppercase mt-0.5" style={{ color: '#c8861d' }}>{currentUser?.role ?? '-'}</p>
                  </div>
                  {/* Arrow lebih visible dengan background */}
                  <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 transition-all"
                    style={{ background: 'rgba(200,134,29,0.12)', color: '#c8861d' }}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>

                {/* Admin Panel — hanya admin/superadmin */}
                {isAdmin && (
                  <button onClick={() => { setAdminPanelTab('settings'); setShowAdminPanel(true); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                    style={{ color: '#64748b', border: '1px solid transparent' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.07)'; (e.currentTarget as HTMLButtonElement).style.color = '#4338ca'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(99,102,241,0.18)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#64748b'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'; }}>
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Admin Panel
                  </button>
                )}

                {/* Sign out — di bawah */}
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{ color: '#94a3b8', border: '1px solid transparent' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.06)'; (e.currentTarget as HTMLButtonElement).style.color = '#b91c1c'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.15)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'; }}>
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
          <div className="flex-1 overflow-hidden bg-white">
            {showTicketing ? (
              <div className="w-full h-full overflow-auto">
                <iframe src={internalUrl} className="w-full h-full border-0" title={iframeTitle} />
              </div>
            ) : iframeUrl ? (
              <div className="w-full h-full overflow-auto">
                <iframe src={iframeUrl} className="w-full h-full border-0" title={iframeTitle} />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                <div className="text-center">
                  <div className="text-6xl mb-4">📂</div>
                  <p className="font-semibold text-lg">Pilih menu dari sidebar</p>
                  <p className="text-sm mt-1">Klik salah satu menu di sebelah kiri untuk memulai</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes dropIn { from { opacity: 0; transform: translateY(-8px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
    </div>
  );
}
