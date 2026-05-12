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
  const [showLearningCenter, setShowLearningCenter] = useState(false);

  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminPanelTab, setAdminPanelTab] = useState<'settings' | 'userManagement' | 'picBrand'>('settings');
  const [pendingCount, setPendingCount] = useState(0);
  const [showUserProfile, setShowUserProfile] = useState(false);

  const [visibleMenuItems, setVisibleMenuItems] = useState<MenuItem[]>([]);

  const allMenuItems: MenuItem[] = [
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
      title: 'Piket Showroom', icon: '🏪', key: 'picket-showroom',
      gradient: 'from-teal-700 via-teal-600 to-cyan-500',
      description: 'Jadwal piket showroom Team PTS IVP, UMP & MLDS',
      items: [{ name: 'Piket Showroom', url: '/picket-showroom', icon: '📅', internal: true, embed: true }]
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
    // ── LEARNING CENTER ── (tambahan baru)
    {
      title: 'Learning Center', icon: '🎓', key: 'learning-center',
      gradient: 'from-blue-700 via-blue-600 to-indigo-500',
      description: 'Platform training, quiz online & analytics team',
      items: [{ name: 'Learning Center', url: '/learning-center', icon: '📚', internal: true, embed: true }]
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
    if ((divisi === 'Sales' || divisi === 'Marketing') && !sales_division) { alert('Pilih sales division!'); return; }

    let requestedDivision: string | null = null;
    if (divisi === 'PTS') requestedDivision = pts_type;
    else if (divisi === 'Sales') requestedDivision = sales_division;
    else if (divisi === 'Marketing') requestedDivision = `Marketing:${sales_division}`;

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
    setShowSidebar(false); setIframeUrl(null); setShowTicketing(false); setInternalUrl('/ticketing'); setShowLearningCenter(false);
    setShowAdminPanel(false); setShowUserProfile(false);
    router.push('/dashboard');
  };

  const handleMenuClick = (item: MenuItem['items'][0], menuTitle: string) => {
    if (item.external && !item.embed) { window.open(item.url, '_blank'); return; }
    // Learning Center — render inline langsung, tidak pakai iframe
    if (item.url === '/learning-center') {
      setIframeUrl(null); setShowTicketing(false); setInternalUrl('/ticketing');
      setShowLearningCenter(true); setShowSidebar(true);
      setIframeTitle('Learning Center');
      return;
    }
    setShowLearningCenter(false);
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
    setShowSidebar(false); setIframeUrl(null); setShowTicketing(false); setInternalUrl('/ticketing'); setIframeTitle(''); setShowLearningCenter(false);
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
      .then((res: { count: number | null }) => setPendingCount(res.count ?? 0));
  }, [isAdmin]);

  const INTERNAL_KEYS = ['reminder-schedule', 'form-require-project', 'form-bast', 'ticket-troubleshooting', 'picket-showroom'];
  const PROJECT_KEYS = ['reminder-schedule', 'form-require-project', 'form-bast', 'ticket-troubleshooting'];
  const INTERNAL_DAILY_KEYS = ['picket-showroom', 'daily-report', 'database-pts', 'unit-movement'];
  // ── Learning Center sebagai section tersendiri ──
  const LEARNING_KEYS = ['learning-center'];

  const projectMenuItems = visibleMenuItems.filter(m => PROJECT_KEYS.includes(m.key));
  const internalMenuItems = visibleMenuItems.filter(m => INTERNAL_DAILY_KEYS.includes(m.key));
  const learningMenuItems = visibleMenuItems.filter(m => LEARNING_KEYS.includes(m.key));

  const MENU_ICONS: Record<string, JSX.Element> = {
    'picket-showroom': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
    'reminder-schedule': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    'form-require-project': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
    'form-bast': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
    'ticket-troubleshooting': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>,
    'daily-report': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    'database-pts': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>,
    'unit-movement': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>,
    'learning-center': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>,
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
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-slate-800 tracking-tight">Work Management Platform</h1>
                <span className="text-slate-400 font-light text-xl select-none leading-none">|</span>
                <span className="text-sm font-bold tracking-wide" style={{ color: '#c8861d' }}>PTS Portal</span>
              </div>
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
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {internalMenuItems.map((menu, i) => renderMenuCard(menu, i, '#10b981'))}
                    </div>
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
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {learningMenuItems.map((menu, i) => renderMenuCard(menu, i, '#4338ca'))}
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
        <div
          className={`relative flex flex-col transition-all duration-300 ease-in-out ${sidebarCollapsed ? 'w-[64px]' : 'w-[272px]'}`}
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

          {/* ── SIDEBAR HEADER — Main Menu nav ── */}
          <div
            className={`flex items-center flex-shrink-0 ${sidebarCollapsed ? 'justify-center px-3 py-3' : 'px-3 py-3 gap-2'}`}
            style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}
          >
            {!sidebarCollapsed && (
              <>
                <button
                  onClick={handleBackToDashboard}
                  className="flex-1 flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-150 text-left group"
                  style={{ color: '#334155' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#92600a'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#334155'; }}
                  title="Kembali ke Main Menu"
                >
                  <svg className="w-4 h-4 flex-shrink-0 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  <span className="text-sm font-semibold tracking-wide">Main Menu</span>
                </button>
                <button
                  onClick={() => setSidebarCollapsed(true)}
                  className="w-7 h-7 rounded-md flex items-center justify-center transition-all flex-shrink-0"
                  style={{ color: '#cbd5e1' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.06)'; (e.currentTarget as HTMLButtonElement).style.color = '#64748b'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#cbd5e1'; }}
                  title="Collapse sidebar"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
                  </svg>
                </button>
              </>
            )}
            {sidebarCollapsed && (
              <button
                onClick={() => setSidebarCollapsed(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                style={{ color: '#94a3b8' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.06)'; (e.currentTarget as HTMLButtonElement).style.color = '#334155'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; }}
                title="Main Menu"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
            )}
          </div>

          {/* ── SIDEBAR SCROLLABLE CONTENT ── */}
          <div className="flex-1 overflow-y-auto py-3 px-2.5" style={{ scrollbarWidth: 'none' }}>

            {menuLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'rgba(226,168,75,0.35)', borderTopColor: '#e2a84b' }} />
              </div>
            ) : sidebarCollapsed ? (
              /* Collapsed: icon-only */
              <div className="space-y-1">
                {visibleMenuItems.map((menu) => (
                  <div key={menu.key}>
                    {menu.items.map((item, itemIndex) => {
                      const isActive = (showTicketing && item.internal && internalUrl === item.url) || (iframeUrl === item.url);
                      return (
                        <button
                          key={itemIndex}
                          onClick={() => handleMenuClick(item, menu.title)}
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
              <div className="space-y-5">

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

                {/* ── Learning Center section di sidebar (BARU) ── */}
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
          <div className="flex-1 overflow-hidden bg-white">
            {showLearningCenter && currentUser ? (
              <div className="w-full h-full overflow-auto">
                <LearningCenter currentUser={currentUser} />
              </div>
            ) : showTicketing ? (
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

// ─── LEARNING CENTER — Inlined ───────────────────────────────────────────────

// ─── Types ────────────────────────────────────────────────────────────────────

interface Material {
  id: string;
  materi_name: string;
  content_text: string | null;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  created_by: string | null;
  created_at: string;
}

interface Question {
  id: string;
  material_id: string;
  materi_name: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: 'A' | 'B' | 'C' | 'D';
  difficulty: 'easy' | 'medium' | 'hard';
  created_at: string;
}

interface QuizSession {
  id: string;
  session_name: string;
  material_id: string;
  materi_name: string;
  question_ids: string[];
  question_count: number;
  timer_minutes: number | null;
  passing_grade: number;
  is_active: boolean;
  allow_retake: boolean;
  created_at: string;
  scheduled_at: string | null;
  closed_at: string | null;
}

interface QuizAttempt {
  id: string;
  user_id: string;
  quiz_session_id: string;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  total_correct: number;
  total_questions: number;
  passed: boolean | null;
  time_taken_sec: number | null;
  is_submitted: boolean;
}

type AdminView = 'dashboard' | 'materi' | 'questions' | 'sessions' | 'team' | 'report' | 'analytics';
type TeamView = 'my-quiz' | 'history' | 'score' | 'profile';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const OPENAI_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY ?? '';

const DIFF_COLOR: Record<string, string> = {
  easy: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  hard: 'bg-rose-100 text-rose-700 border-rose-200',
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

function ScoreBadge({ score, passing }: { score: number | null; passing: number }) {
  if (score === null) return <span className="text-slate-400 text-xs">—</span>;
  const pass = score >= passing;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${pass ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>
      {pass ? '✅' : '❌'} {score.toFixed(0)}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

function LearningCenter({ currentUser }: { currentUser: User }) {
  const isAdmin = ['admin', 'superadmin'].includes(currentUser?.role?.toLowerCase() ?? '');
  const [adminView, setAdminView] = useState<AdminView>('dashboard');
  const [teamView, setTeamView] = useState<TeamView>('my-quiz');

  return (
    <div className="flex h-full bg-slate-50 font-sans overflow-hidden">
      {/* Sidebar */}
      {isAdmin
        ? <AdminSidebar view={adminView} onChange={setAdminView} user={currentUser} />
        : <TeamSidebar view={teamView} onChange={setTeamView} user={currentUser} />}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isAdmin ? (
          <>
            {adminView === 'dashboard'  && <AdminDashboard user={currentUser} />}
            {adminView === 'materi'     && <MateriPage user={currentUser} />}
            {adminView === 'questions'  && <QuestionsPage user={currentUser} />}
            {adminView === 'sessions'   && <SessionsPage user={currentUser} />}
            {adminView === 'team'       && <TeamPage />}
            {adminView === 'report'     && <ReportPage />}
            {adminView === 'analytics'  && <AnalyticsPage />}
          </>
        ) : (
          <>
            {teamView === 'my-quiz'  && <MyQuizPage user={currentUser} />}
            {teamView === 'history'  && <HistoryPage user={currentUser} />}
            {teamView === 'score'    && <ScorePage user={currentUser} />}
            {teamView === 'profile'  && <ProfilePage user={currentUser} />}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Sidebars ─────────────────────────────────────────────────────────────────

function AdminSidebar({ view, onChange, user }: { view: AdminView; onChange: (v: AdminView) => void; user: User }) {
  const items: { key: AdminView; icon: string; label: string }[] = [
    { key: 'dashboard', icon: '📊', label: 'Dashboard' },
    { key: 'materi', icon: '📚', label: 'Materi' },
    { key: 'questions', icon: '🧩', label: 'Bank Soal' },
    { key: 'sessions', icon: '🎯', label: 'Sesi Quiz' },
    { key: 'team', icon: '👥', label: 'Team' },
    { key: 'report', icon: '📋', label: 'Laporan' },
    { key: 'analytics', icon: '📈', label: 'Analytics' },
  ];
  return (
    <div className="w-56 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 h-full">
      <div className="px-4 py-5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-lg shadow">🎓</div>
          <div>
            <p className="text-sm font-bold text-slate-800 leading-tight">Learning Center</p>
            <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wider">Admin Portal</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {items.map(i => (
          <button key={i.key} onClick={() => onChange(i.key)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left
              ${view === i.key ? 'bg-blue-50 text-blue-700 border border-blue-200/60' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800 border border-transparent'}`}>
            <span className="text-base">{i.icon}</span>
            {i.label}
          </button>
        ))}
      </nav>
      <div className="p-3 border-t border-slate-100">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {user?.full_name?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-700 truncate">{user?.full_name}</p>
            <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">{user?.role}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamSidebar({ view, onChange, user }: { view: TeamView; onChange: (v: TeamView) => void; user: User }) {
  const items: { key: TeamView; icon: string; label: string }[] = [
    { key: 'my-quiz', icon: '📝', label: 'My Quiz' },
    { key: 'history', icon: '🕐', label: 'Riwayat' },
    { key: 'score', icon: '🏆', label: 'Nilai Saya' },
    { key: 'profile', icon: '👤', label: 'Profile' },
  ];
  return (
    <div className="w-56 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 h-full">
      <div className="px-4 py-5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-lg shadow">🎓</div>
          <div>
            <p className="text-sm font-bold text-slate-800 leading-tight">Learning Center</p>
            <p className="text-[10px] text-indigo-500 font-semibold uppercase tracking-wider">Team Portal</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-0.5">
        {items.map(i => (
          <button key={i.key} onClick={() => onChange(i.key)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left
              ${view === i.key ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/60' : 'text-slate-600 hover:bg-slate-50 border border-transparent'}`}>
            <span className="text-base">{i.icon}</span>
            {i.label}
          </button>
        ))}
      </nav>
      <div className="p-3 border-t border-slate-100">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {user?.full_name?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-700 truncate">{user?.full_name}</p>
            <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">{user?.role}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page Header ──────────────────────────────────────────────────────────────

function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 bg-white sticky top-0 z-10">
      <div>
        <h1 className="text-xl font-bold text-slate-800 tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ─── ADMIN: Dashboard ─────────────────────────────────────────────────────────

function AdminDashboard({ user }: { user: User }) {
  const [stats, setStats] = useState({ materials: 0, questions: 0, sessions: 0, attempts: 0 });
  const [recentAttempts, setRecentAttempts] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const [mat, que, ses, att] = await Promise.all([
        supabase.from('lc_materials').select('id', { count: 'exact', head: true }),
        supabase.from('lc_questions').select('id', { count: 'exact', head: true }),
        supabase.from('lc_quiz_sessions').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('lc_quiz_attempts').select('id', { count: 'exact', head: true }),
      ]);
      setStats({ materials: mat.count ?? 0, questions: que.count ?? 0, sessions: ses.count ?? 0, attempts: att.count ?? 0 });

      const { data } = await supabase
        .from('lc_quiz_attempts')
        .select('*, users(full_name), lc_quiz_sessions(session_name)')
        .eq('is_submitted', true)
        .order('submitted_at', { ascending: false })
        .limit(8);
      setRecentAttempts(data ?? []);
    };
    load();
  }, []);

  const cards = [
    { label: 'Total Materi', value: stats.materials, icon: '📚', color: 'from-blue-500 to-blue-600' },
    { label: 'Bank Soal', value: stats.questions, icon: '🧩', color: 'from-violet-500 to-violet-600' },
    { label: 'Sesi Aktif', value: stats.sessions, icon: '🎯', color: 'from-emerald-500 to-emerald-600' },
    { label: 'Total Attempt', value: stats.attempts, icon: '📝', color: 'from-amber-500 to-amber-600' },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`Selamat datang, ${user.full_name}`} />
      <div className="p-8 space-y-8">
        <div className="grid grid-cols-4 gap-5">
          {cards.map(c => (
            <div key={c.label} className={`bg-gradient-to-br ${c.color} rounded-2xl p-5 text-white shadow-lg`}>
              <div className="text-3xl mb-2">{c.icon}</div>
              <div className="text-3xl font-black">{c.value}</div>
              <div className="text-white/80 text-sm font-medium mt-1">{c.label}</div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-800">Aktivitas Terbaru</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {recentAttempts.length === 0 && (
              <div className="text-center text-slate-400 py-10 text-sm">Belum ada aktivitas quiz</div>
            )}
            {recentAttempts.map((a: any) => (
              <div key={a.id} className="flex items-center gap-4 px-6 py-3.5">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                  {a.users?.full_name?.[0] ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{a.users?.full_name ?? '-'}</p>
                  <p className="text-xs text-slate-500 truncate">{a.lc_quiz_sessions?.session_name ?? '-'}</p>
                </div>
                <ScoreBadge score={a.score} passing={70} />
                <span className="text-xs text-slate-400 flex-shrink-0">{a.submitted_at ? fmtDate(a.submitted_at) : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN: Materi Page ───────────────────────────────────────────────────────

function MateriPage({ user }: { user: User }) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ materi_name: '', file_url: '', file_name: '', file_type: 'pdf', content_text: '' });
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('lc_materials').select('*').order('created_at', { ascending: false });
    setMaterials(data ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const extractTextFromFile = async (f: File): Promise<string> => {
    // For PDF/PPTX we send to OpenAI with vision or just read as text
    // For simplicity, we read as text (works for .txt); for PDF the user also sets content_text manually or via copy-paste
    return new Promise((res) => {
      const reader = new FileReader();
      reader.onload = e => res((e.target?.result as string) ?? '');
      reader.readAsText(f);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setForm(prev => ({ ...prev, file_name: f.name, file_type: f.name.split('.').pop() ?? 'pdf' }));
    if (f.type === 'text/plain') {
      setExtracting(true);
      const text = await extractTextFromFile(f);
      setForm(prev => ({ ...prev, content_text: text.slice(0, 15000) }));
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!form.materi_name.trim()) return alert('Nama materi wajib diisi!');
    setUploading(true);
    const { error } = await supabase.from('lc_materials').insert([{
      materi_name: form.materi_name,
      content_text: form.content_text || null,
      file_url: form.file_url || null,
      file_name: form.file_name || null,
      file_type: form.file_type || null,
      created_by: user.id,
    }]);
    setUploading(false);
    if (error) return alert('Gagal menyimpan: ' + error.message);
    setShowForm(false);
    setForm({ materi_name: '', file_url: '', file_name: '', file_type: 'pdf', content_text: '' });
    setFile(null);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus materi ini?')) return;
    await supabase.from('lc_materials').delete().eq('id', id);
    load();
  };

  return (
    <div>
      <PageHeader title="📚 Materi Training" subtitle="Kelola materi training & sumber belajar"
        action={
          <button onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow transition-all flex items-center gap-2">
            <span>+</span> Tambah Materi
          </button>
        }
      />
      <div className="p-8">
        {showForm && (
          <div className="bg-white rounded-2xl border border-blue-100 shadow-lg p-6 mb-8">
            <h3 className="font-bold text-slate-800 mb-5 flex items-center gap-2">✏️ Form Materi Baru</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Nama Materi *</label>
                <input value={form.materi_name} onChange={e => setForm(p => ({ ...p, materi_name: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  placeholder="contoh: Pengenalan Produk Microvision" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Link Download OneDrive</label>
                <input value={form.file_url} onChange={e => setForm(p => ({ ...p, file_url: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  placeholder="https://1drv.ms/..." />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Upload File untuk AI (txt/pdf extract)</label>
                <input ref={fileRef} type="file" accept=".txt,.pdf,.pptx,.docx" onChange={handleFileChange} className="hidden" />
                <div className="flex gap-3 items-center">
                  <button onClick={() => fileRef.current?.click()}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl border border-slate-200 transition-all">
                    📁 Pilih File
                  </button>
                  {file && <span className="text-sm text-slate-600 font-medium">{file.name}</span>}
                  {extracting && <span className="text-xs text-blue-600 animate-pulse">Membaca file...</span>}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Konten Teks (untuk AI Generate Soal)</label>
                <textarea value={form.content_text} onChange={e => setForm(p => ({ ...p, content_text: e.target.value }))}
                  rows={6} placeholder="Paste isi materi di sini, atau upload file .txt di atas..."
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none" />
                <p className="text-xs text-slate-400 mt-1">{form.content_text.length} karakter — untuk PDF/PPTX, copy-paste isi slide/halaman di sini</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} disabled={uploading}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow transition-all disabled:opacity-60">
                  {uploading ? 'Menyimpan...' : '💾 Simpan Materi'}
                </button>
                <button onClick={() => setShowForm(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-all">
                  Batal
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          {materials.length === 0 && !showForm && (
            <div className="text-center py-16 text-slate-400">
              <div className="text-5xl mb-3">📭</div>
              <p className="font-semibold">Belum ada materi</p>
              <p className="text-sm mt-1">Klik + Tambah Materi untuk mulai</p>
            </div>
          )}
          {materials.map(m => (
            <div key={m.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-start gap-4 group hover:shadow-md transition-all">
              <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-2xl flex-shrink-0">📄</div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-slate-800">{m.materi_name}</h4>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  {m.file_name && <span className="text-xs text-slate-500 font-medium">📁 {m.file_name}</span>}
                  {m.content_text && <span className="text-xs bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-semibold">✅ Teks tersedia</span>}
                  <span className="text-xs text-slate-400">{fmtDate(m.created_at)}</span>
                </div>
                {m.file_url && (
                  <a href={m.file_url} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 mt-2 text-xs text-blue-600 hover:text-blue-700 font-semibold">
                    ⬇️ Download Materi
                  </a>
                )}
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button onClick={() => handleDelete(m.id)}
                  className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 transition-all" title="Hapus">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN: Questions (Bank Soal) ─────────────────────────────────────────────

function QuestionsPage({ user }: { user: User }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMat, setSelectedMat] = useState<string>('');
  const [showGenerate, setShowGenerate] = useState(false);
  const [genCount, setGenCount] = useState(10);
  const [genDiff, setGenDiff] = useState<'easy' | 'medium' | 'hard' | 'mixed'>('mixed');
  const [generating, setGenerating] = useState(false);
  const [editQ, setEditQ] = useState<Question | null>(null);

  const load = useCallback(async () => {
    const { data: mats } = await supabase.from('lc_materials').select('*').order('created_at', { ascending: false });
    setMaterials(mats ?? []);
    let q = supabase.from('lc_questions').select('*').order('created_at', { ascending: false });
    if (selectedMat) q = q.eq('material_id', selectedMat);
    const { data } = await q;
    setQuestions(data ?? []);
  }, [selectedMat]);
  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    if (!selectedMat) return alert('Pilih materi terlebih dahulu!');
    const mat = materials.find(m => m.id === selectedMat);
    if (!mat?.content_text) return alert('Materi ini belum memiliki teks konten. Tambahkan teks pada halaman Materi.');

    setGenerating(true);
    try {
      const diffInstruction = genDiff === 'mixed'
        ? 'Buat soal dengan campuran tingkat kesulitan: easy, medium, dan hard secara merata.'
        : `Semua soal tingkat kesulitan: ${genDiff}.`;

      const prompt = `Kamu adalah instruktur training profesional. Berdasarkan materi berikut, buat ${genCount} soal pilihan ganda (A, B, C, D) dalam Bahasa Indonesia.
${diffInstruction}

MATERI:
${mat.content_text.slice(0, 8000)}

Kembalikan HANYA JSON array dengan format:
[
  {
    "question": "Pertanyaan?",
    "option_a": "...",
    "option_b": "...",
    "option_c": "...",
    "option_d": "...",
    "correct_answer": "A",
    "difficulty": "easy"
  }
]
Tidak ada teks lain, hanya JSON.`;

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 4000,
        }),
      });
      const data = await res.json();
      const text: string = data.choices?.[0]?.message?.content ?? '';
      const jsonStr = text.replace(/```json|```/g, '').trim();
      const parsed: any[] = JSON.parse(jsonStr);

      const rows = parsed.map(q => ({
        material_id: selectedMat,
        materi_name: mat.materi_name,
        question: q.question,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        correct_answer: q.correct_answer.toUpperCase(),
        difficulty: q.difficulty ?? 'medium',
        created_by: user.id,
      }));

      const { error } = await supabase.from('lc_questions').insert(rows);
      if (error) throw error;
      alert(`✅ ${rows.length} soal berhasil digenerate dan disimpan!`);
      setShowGenerate(false);
      load();
    } catch (err: any) {
      alert('Gagal generate: ' + (err.message ?? String(err)));
    }
    setGenerating(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus soal ini?')) return;
    await supabase.from('lc_questions').delete().eq('id', id);
    load();
  };

  const handleSaveEdit = async () => {
    if (!editQ) return;
    await supabase.from('lc_questions').update({
      question: editQ.question, option_a: editQ.option_a, option_b: editQ.option_b,
      option_c: editQ.option_c, option_d: editQ.option_d, correct_answer: editQ.correct_answer,
      difficulty: editQ.difficulty,
    }).eq('id', editQ.id);
    setEditQ(null);
    load();
  };

  return (
    <div>
      <PageHeader title="🧩 Bank Soal" subtitle={`${questions.length} soal tersedia`}
        action={
          <button onClick={() => setShowGenerate(true)}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl shadow transition-all flex items-center gap-2">
            ✨ Generate AI
          </button>
        }
      />
      <div className="p-8 space-y-6">
        {/* Filter */}
        <div className="flex gap-3 items-center">
          <select value={selectedMat} onChange={e => setSelectedMat(e.target.value)}
            className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 bg-white">
            <option value="">Semua Materi</option>
            {materials.map(m => <option key={m.id} value={m.id}>{m.materi_name}</option>)}
          </select>
          <span className="text-sm text-slate-500">{questions.length} soal</span>
        </div>

        {/* Generate Panel */}
        {showGenerate && (
          <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-2xl border border-violet-200 p-6">
            <h3 className="font-bold text-violet-800 mb-4 flex items-center gap-2">✨ Generate Soal dengan AI</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Materi *</label>
                <select value={selectedMat} onChange={e => setSelectedMat(e.target.value)}
                  className="w-full border border-violet-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-violet-400 bg-white">
                  <option value="">-- Pilih Materi --</option>
                  {materials.map(m => <option key={m.id} value={m.id}>{m.materi_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Jumlah Soal</label>
                <input type="number" min={1} max={50} value={genCount} onChange={e => setGenCount(+e.target.value)}
                  className="w-full border border-violet-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-violet-400 bg-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Tingkat Kesulitan</label>
                <select value={genDiff} onChange={e => setGenDiff(e.target.value as any)}
                  className="w-full border border-violet-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-violet-400 bg-white">
                  <option value="mixed">Mixed (Campuran)</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleGenerate} disabled={generating}
                className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold rounded-xl shadow transition-all disabled:opacity-60 flex items-center gap-2">
                {generating ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating...</> : '✨ Generate Sekarang'}
              </button>
              <button onClick={() => setShowGenerate(false)}
                className="px-5 py-2.5 bg-white text-slate-600 text-sm font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 transition-all">
                Batal
              </button>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editQ && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <h3 className="font-bold text-slate-800 mb-4">✏️ Edit Soal</h3>
              <div className="space-y-3">
                <textarea value={editQ.question} onChange={e => setEditQ(p => p && ({ ...p, question: e.target.value }))}
                  rows={3} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 resize-none" placeholder="Pertanyaan" />
                {(['a','b','c','d'] as const).map(opt => (
                  <div key={opt} className="flex items-center gap-2">
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 ${editQ.correct_answer === opt.toUpperCase() ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-600'}`}>{opt.toUpperCase()}</span>
                    <input value={(editQ as any)[`option_${opt}`]} onChange={e => setEditQ(p => p && ({ ...p, [`option_${opt}`]: e.target.value }))}
                      className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400" />
                    <button onClick={() => setEditQ(p => p && ({ ...p, correct_answer: opt.toUpperCase() as any }))}
                      className={`text-xs px-2 py-1 rounded-lg font-semibold transition-all ${editQ.correct_answer === opt.toUpperCase() ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-slate-100 text-slate-500 hover:bg-green-50'}`}>
                      Benar
                    </button>
                  </div>
                ))}
                <select value={editQ.difficulty} onChange={e => setEditQ(p => p && ({ ...p, difficulty: e.target.value as any }))}
                  className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400">
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={handleSaveEdit} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow transition-all">Simpan</button>
                <button onClick={() => setEditQ(null)} className="px-5 py-2.5 bg-slate-100 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-all">Batal</button>
              </div>
            </div>
          </div>
        )}

        {/* Question List */}
        <div className="space-y-3">
          {questions.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <div className="text-5xl mb-3">🧩</div>
              <p className="font-semibold">Belum ada soal</p>
              <p className="text-sm mt-1">Generate soal dengan AI atau pilih materi dahulu</p>
            </div>
          )}
          {questions.map((q, idx) => (
            <div key={q.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 group hover:shadow-md transition-all">
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-black text-slate-600 flex-shrink-0 mt-0.5">{idx+1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 leading-relaxed">{q.question}</p>
                  <div className="grid grid-cols-2 gap-1.5 mt-3">
                    {(['a','b','c','d'] as const).map(opt => (
                      <div key={opt} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${q.correct_answer === opt.toUpperCase() ? 'bg-green-50 border border-green-200 text-green-700 font-bold' : 'bg-slate-50 border border-slate-200 text-slate-600'}`}>
                        <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-black flex-shrink-0 ${q.correct_answer === opt.toUpperCase() ? 'bg-green-500 text-white' : 'bg-slate-300 text-white'}`}>{opt.toUpperCase()}</span>
                        <span className="truncate">{(q as any)[`option_${opt}`]}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${DIFF_COLOR[q.difficulty]}`}>{q.difficulty}</span>
                    <span className="text-xs text-slate-400">{q.materi_name}</span>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button onClick={() => setEditQ(q)} className="p-2 rounded-lg text-blue-500 hover:bg-blue-50 transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  <button onClick={() => handleDelete(q.id)} className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN: Quiz Sessions ─────────────────────────────────────────────────────

function SessionsPage({ user }: { user: User }) {
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    session_name: '', material_id: '', question_count: 10,
    timer_minutes: 30, passing_grade: 70, allow_retake: true, scheduled_at: '',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [{ data: s }, { data: m }, { data: q }] = await Promise.all([
      supabase.from('lc_quiz_sessions').select('*').order('created_at', { ascending: false }),
      supabase.from('lc_materials').select('*'),
      supabase.from('lc_questions').select('id, material_id, difficulty'),
    ]);
    setSessions(s ?? []); setMaterials(m ?? []); setQuestions(q ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.session_name.trim()) return alert('Nama sesi wajib diisi!');
    if (!form.material_id) return alert('Pilih materi!');
    const mat = materials.find(m => m.id === form.material_id);
    const pool = questions.filter(q => q.material_id === form.material_id);
    if (pool.length < form.question_count) return alert(`Hanya ada ${pool.length} soal untuk materi ini. Kurangi jumlah soal atau generate lebih banyak.`);
    // Randomly pick questions
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, form.question_count);
    setSaving(true);
    const { error } = await supabase.from('lc_quiz_sessions').insert([{
      session_name: form.session_name,
      material_id: form.material_id,
      materi_name: mat?.materi_name ?? '',
      question_ids: shuffled.map(q => q.id),
      question_count: form.question_count,
      timer_minutes: form.timer_minutes || null,
      passing_grade: form.passing_grade,
      allow_retake: form.allow_retake,
      is_active: true,
      created_by: user.id,
      scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
    }]);
    setSaving(false);
    if (error) return alert('Error: ' + error.message);
    setShowForm(false);
    setForm({ session_name: '', material_id: '', question_count: 10, timer_minutes: 30, passing_grade: 70, allow_retake: true, scheduled_at: '' });
    load();
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from('lc_quiz_sessions').update({ is_active: !current }).eq('id', id);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus sesi quiz ini? Semua jawaban akan ikut terhapus.')) return;
    await supabase.from('lc_quiz_sessions').delete().eq('id', id);
    load();
  };

  return (
    <div>
      <PageHeader title="🎯 Sesi Quiz" subtitle="Buat & kelola sesi quiz untuk team"
        action={
          <button onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow transition-all flex items-center gap-2">
            + Buat Sesi Quiz
          </button>
        }
      />
      <div className="p-8 space-y-6">
        {showForm && (
          <div className="bg-white rounded-2xl border border-emerald-100 shadow-lg p-6">
            <h3 className="font-bold text-slate-800 mb-5">📋 Form Sesi Quiz Baru</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Nama Sesi *</label>
                <input value={form.session_name} onChange={e => setForm(p => ({ ...p, session_name: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400"
                  placeholder="contoh: Quiz Microvision — Batch 1 — Mei 2025" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Materi *</label>
                <select value={form.material_id} onChange={e => setForm(p => ({ ...p, material_id: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400 bg-white">
                  <option value="">-- Pilih Materi --</option>
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.materi_name} ({questions.filter(q => q.material_id === m.id).length} soal)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Jumlah Soal</label>
                <input type="number" min={1} max={100} value={form.question_count}
                  onChange={e => setForm(p => ({ ...p, question_count: +e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Timer (menit, 0 = tanpa timer)</label>
                <input type="number" min={0} value={form.timer_minutes}
                  onChange={e => setForm(p => ({ ...p, timer_minutes: +e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Passing Grade (%)</label>
                <input type="number" min={0} max={100} value={form.passing_grade}
                  onChange={e => setForm(p => ({ ...p, passing_grade: +e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Jadwal (opsional)</label>
                <input type="datetime-local" value={form.scheduled_at}
                  onChange={e => setForm(p => ({ ...p, scheduled_at: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400" />
              </div>
              <div className="flex items-center gap-3 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.allow_retake} onChange={e => setForm(p => ({ ...p, allow_retake: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-400" />
                  <span className="text-sm font-medium text-slate-700">Boleh Retake</span>
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleCreate} disabled={saving}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow transition-all disabled:opacity-60">
                {saving ? 'Membuat...' : '🎯 Buat Sesi Quiz'}
              </button>
              <button onClick={() => setShowForm(false)}
                className="px-5 py-2.5 bg-slate-100 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-all">
                Batal
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          {sessions.length === 0 && !showForm && (
            <div className="text-center py-16 text-slate-400">
              <div className="text-5xl mb-3">🎯</div>
              <p className="font-semibold">Belum ada sesi quiz</p>
            </div>
          )}
          {sessions.map(s => (
            <div key={s.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-slate-800">{s.session_name}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${s.is_active ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                      {s.is_active ? '🟢 Aktif' : '⭕ Non-aktif'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">{s.materi_name}</p>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
                    <span>📝 {s.question_count} soal</span>
                    <span>⏱️ {s.timer_minutes ? `${s.timer_minutes} mnt` : 'No timer'}</span>
                    <span>🎯 Passing: {s.passing_grade}%</span>
                    <span>🔁 {s.allow_retake ? 'Boleh retake' : 'Sekali submit'}</span>
                    <span>📅 {fmtDate(s.created_at)}</span>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => toggleActive(s.id, s.is_active)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${s.is_active ? 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'}`}>
                    {s.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                  <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-all border border-transparent hover:border-rose-200">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN: Team ──────────────────────────────────────────────────────────────

function TeamPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);

  useEffect(() => {
    const load = async () => {
      const [{ data: u }, { data: a }] = await Promise.all([
        supabase.from('users').select('id, full_name, username, role, jabatan, sales_division').order('full_name'),
        supabase.from('lc_quiz_attempts').select('*').eq('is_submitted', true),
      ]);
      setUsers((u ?? []).filter(u => u.role !== 'guest'));
      setAttempts(a ?? []);
    };
    load();
  }, []);

  return (
    <div>
      <PageHeader title="👥 Team" subtitle="Daftar anggota team & partisipasi quiz" />
      <div className="p-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-widest">Nama</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-widest">Role</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Quiz Diikuti</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Rata-rata Skor</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Pass Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => {
                const ua = attempts.filter(a => a.user_id === u.id);
                const avg = ua.length ? ua.reduce((s, a) => s + (a.score ?? 0), 0) / ua.length : null;
                const passed = ua.filter(a => a.passed).length;
                return (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                          {u.full_name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{u.full_name}</p>
                          <p className="text-[10px] text-slate-400">{u.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">{u.role}</span>
                    </td>
                    <td className="px-5 py-3.5 text-center font-bold text-slate-700">{ua.length}</td>
                    <td className="px-5 py-3.5 text-center">
                      {avg !== null ? <span className={`font-bold ${avg >= 70 ? 'text-emerald-600' : 'text-rose-600'}`}>{avg.toFixed(1)}</span> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {ua.length ? <span className="text-xs font-bold text-indigo-600">{Math.round(passed/ua.length*100)}%</span> : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN: Report ────────────────────────────────────────────────────────────

function ReportPage() {
  const [data, setData] = useState<any[]>([]);
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [selectedSession, setSelectedSession] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data: s } = await supabase.from('lc_quiz_sessions').select('*').order('created_at', { ascending: false });
      setSessions(s ?? []);
    };
    load();
  }, []);

  useEffect(() => {
    if (!selectedSession) { setData([]); return; }
    const load = async () => {
      const { data: a } = await supabase
        .from('lc_quiz_attempts')
        .select('*, users(full_name, username, jabatan)')
        .eq('quiz_session_id', selectedSession)
        .eq('is_submitted', true)
        .order('score', { ascending: false });
      setData(a ?? []);
    };
    load();
  }, [selectedSession]);

  const session = sessions.find(s => s.id === selectedSession);

  return (
    <div>
      <PageHeader title="📋 Laporan" subtitle="Hasil quiz per sesi" />
      <div className="p-8 space-y-6">
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Pilih Sesi Quiz</label>
          <select value={selectedSession} onChange={e => setSelectedSession(e.target.value)}
            className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 bg-white min-w-[320px]">
            <option value="">-- Pilih Sesi --</option>
            {sessions.map(s => <option key={s.id} value={s.id}>{s.session_name}</option>)}
          </select>
        </div>

        {data.length > 0 && (
          <>
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Peserta', value: data.length },
                { label: 'Rata-rata', value: (data.reduce((s,a) => s+(a.score??0),0)/data.length).toFixed(1) },
                { label: 'Lulus', value: data.filter(a => a.passed).length },
                { label: 'Pass Rate', value: `${Math.round(data.filter(a=>a.passed).length/data.length*100)}%` },
              ].map(c => (
                <div key={c.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm text-center">
                  <div className="text-2xl font-black text-slate-800">{c.value}</div>
                  <div className="text-xs text-slate-500 font-medium mt-1">{c.label}</div>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest w-10">#</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-widest">Peserta</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Benar</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Skor</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Status</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Waktu</th>
                    <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Tanggal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((a, i) => (
                    <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5 text-center">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black mx-auto ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-400 text-white' : i === 2 ? 'bg-orange-400 text-white' : 'text-slate-400'}`}>
                          {i < 3 ? ['🥇','🥈','🥉'][i] : i+1}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-slate-800">{a.users?.full_name}</td>
                      <td className="px-5 py-3.5 text-center text-slate-600">{a.total_correct}/{a.total_questions}</td>
                      <td className="px-5 py-3.5 text-center"><ScoreBadge score={a.score} passing={session?.passing_grade ?? 70} /></td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${a.passed ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>
                          {a.passed ? 'LULUS' : 'TIDAK LULUS'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center text-slate-500 text-xs">{a.time_taken_sec ? `${Math.floor(a.time_taken_sec/60)}m ${a.time_taken_sec%60}s` : '—'}</td>
                      <td className="px-5 py-3.5 text-center text-slate-400 text-xs">{a.submitted_at ? fmtDate(a.submitted_at) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {selectedSession && data.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <div className="text-5xl mb-3">📋</div>
            <p className="font-semibold">Belum ada peserta yang submit</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ADMIN: Analytics ─────────────────────────────────────────────────────────

function AnalyticsPage() {
  const [topUsers, setTopUsers] = useState<any[]>([]);
  const [sessionStats, setSessionStats] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      // Top performers
      const { data: a } = await supabase
        .from('lc_quiz_attempts')
        .select('user_id, score, passed, users(full_name)')
        .eq('is_submitted', true);

      if (a) {
        const byUser: Record<string, { name: string; scores: number[]; passed: number }> = {};
        a.forEach((att: any) => {
          if (!byUser[att.user_id]) byUser[att.user_id] = { name: att.users?.full_name ?? '-', scores: [], passed: 0 };
          byUser[att.user_id].scores.push(att.score ?? 0);
          if (att.passed) byUser[att.user_id].passed++;
        });
        const top = Object.entries(byUser).map(([uid, v]) => ({
          uid, name: v.name,
          avg: v.scores.reduce((s, n) => s + n, 0) / v.scores.length,
          total: v.scores.length,
          passed: v.passed,
        })).sort((a, b) => b.avg - a.avg).slice(0, 10);
        setTopUsers(top);
      }

      const { data: sessions } = await supabase.from('lc_quiz_sessions').select('id, session_name');
      if (sessions) {
        const stats = await Promise.all(sessions.map(async s => {
          const { data: att, count } = await supabase.from('lc_quiz_attempts').select('score, passed', { count: 'exact' }).eq('quiz_session_id', s.id).eq('is_submitted', true);
          const avg = att?.length ? att.reduce((sum, a) => sum + (a.score ?? 0), 0) / att.length : 0;
          const passed = att?.filter(a => a.passed).length ?? 0;
          return { name: s.session_name, total: count ?? 0, avg, passed };
        }));
        setSessionStats(stats.filter(s => s.total > 0));
      }
    };
    load();
  }, []);

  return (
    <div>
      <PageHeader title="📈 Analytics" subtitle="Performa team & statistik quiz" />
      <div className="p-8 space-y-8">
        <div>
          <h3 className="font-bold text-slate-800 mb-4">🏆 Top Performers</h3>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest w-10">#</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-widest">Nama</th>
                  <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Quiz</th>
                  <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Avg Score</th>
                  <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Lulus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topUsers.map((u, i) => (
                  <tr key={u.uid} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-center text-sm font-black text-slate-400">{i+1}</td>
                    <td className="px-5 py-3 font-semibold text-slate-800">{u.name}</td>
                    <td className="px-5 py-3 text-center text-slate-600">{u.total}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`font-black text-base ${u.avg >= 80 ? 'text-emerald-600' : u.avg >= 70 ? 'text-amber-600' : 'text-rose-600'}`}>{u.avg.toFixed(1)}</span>
                    </td>
                    <td className="px-5 py-3 text-center text-indigo-600 font-bold">{u.passed}</td>
                  </tr>
                ))}
                {topUsers.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-slate-400">Belum ada data</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {sessionStats.length > 0 && (
          <div>
            <h3 className="font-bold text-slate-800 mb-4">📊 Statistik Per Sesi</h3>
            <div className="grid grid-cols-1 gap-3">
              {sessionStats.map(s => (
                <div key={s.name} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-slate-800 text-sm truncate">{s.name}</span>
                    <div className="flex gap-3 text-xs flex-shrink-0">
                      <span className="text-slate-500">{s.total} peserta</span>
                      <span className="font-bold text-indigo-600">avg: {s.avg.toFixed(1)}</span>
                      <span className="font-bold text-emerald-600">{s.passed} lulus</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all" style={{ width: `${Math.min(s.avg, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TEAM: My Quiz ────────────────────────────────────────────────────────────

function MyQuizPage({ user }: { user: User }) {
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [activeAttempts, setActiveAttempts] = useState<Record<string, QuizAttempt>>({});
  const [playingSession, setPlayingSession] = useState<QuizSession | null>(null);

  const load = useCallback(async () => {
    const { data: s } = await supabase.from('lc_quiz_sessions').select('*').eq('is_active', true).order('created_at', { ascending: false });
    setSessions(s ?? []);

    const { data: a } = await supabase.from('lc_quiz_attempts')
      .select('*').eq('user_id', user.id).eq('is_submitted', false);
    const map: Record<string, QuizAttempt> = {};
    (a ?? []).forEach(att => { map[att.quiz_session_id] = att; });
    setActiveAttempts(map);
  }, [user.id]);
  useEffect(() => { load(); }, [load]);

  const handleStart = async (session: QuizSession) => {
    // Check if already has unsubmitted attempt
    if (activeAttempts[session.id]) {
      setPlayingSession(session);
      return;
    }
    // Check retake policy
    if (!session.allow_retake) {
      const { data: prev } = await supabase.from('lc_quiz_attempts')
        .select('id').eq('user_id', user.id).eq('quiz_session_id', session.id).eq('is_submitted', true);
      if (prev && prev.length > 0) {
        alert('Quiz ini tidak mengizinkan retake. Kamu sudah pernah submit.');
        return;
      }
    }
    // Create new attempt
    const { data: att, error } = await supabase.from('lc_quiz_attempts').insert([{
      user_id: user.id,
      quiz_session_id: session.id,
      total_questions: session.question_count,
    }]).select().single();
    if (error || !att) return alert('Gagal memulai quiz: ' + error?.message);
    await load();
    setPlayingSession(session);
  };

  if (playingSession) {
    return <QuizPlayer session={playingSession} user={user}
      attempt={activeAttempts[playingSession.id]!}
      onDone={() => { setPlayingSession(null); load(); }} />;
  }

  return (
    <div>
      <PageHeader title="📝 My Quiz" subtitle="Quiz yang tersedia untuk kamu" />
      <div className="p-8 grid grid-cols-1 gap-4">
        {sessions.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <div className="text-5xl mb-3">🎯</div>
            <p className="font-semibold">Belum ada quiz aktif</p>
            <p className="text-sm mt-1">Tunggu admin membuat sesi quiz baru</p>
          </div>
        )}
        {sessions.map(s => {
          const inProgress = activeAttempts[s.id];
          return (
            <div key={s.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex items-start gap-5 hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-2xl flex-shrink-0">🎯</div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-slate-800 text-lg">{s.session_name}</h4>
                <p className="text-sm text-slate-500 mt-1">{s.materi_name}</p>
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
                  <span>📝 {s.question_count} soal</span>
                  <span>⏱️ {s.timer_minutes ? `${s.timer_minutes} mnt` : 'No timer'}</span>
                  <span>🎯 Passing: {s.passing_grade}%</span>
                  <span>🔁 {s.allow_retake ? 'Boleh retake' : 'Sekali submit'}</span>
                </div>
                {inProgress && (
                  <div className="mt-2">
                    <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">
                      ⏳ Sedang Berlangsung
                    </span>
                  </div>
                )}
              </div>
              <button onClick={() => handleStart(s)}
                className={`px-5 py-2.5 text-sm font-bold rounded-xl shadow transition-all flex-shrink-0 ${inProgress ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
                {inProgress ? '▶️ Lanjutkan' : '🚀 Mulai Quiz'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Quiz Player ──────────────────────────────────────────────────────────────

function QuizPlayer({ session, user, attempt, onDone }: {
  session: QuizSession;
  user: User;
  attempt: QuizAttempt;
  onDone: () => void;
}) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [savedAnswers, setSavedAnswers] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ score: number; correct: number; passed: boolean } | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(session.timer_minutes ? session.timer_minutes * 60 : null);
  const [tabSwitches, setTabSwitches] = useState(0);
  const startTime = useRef(Date.now());

  // Load questions
  useEffect(() => {
    const load = async () => {
      if (!session.question_ids?.length) return;
      const { data } = await supabase.from('lc_questions').select('*').in('id', session.question_ids);
      // Sort by original order
      const ordered = session.question_ids.map(id => data?.find(q => q.id === id)).filter(Boolean) as Question[];
      setQuestions(ordered);
    };
    load();
    // Load existing answers
    const loadAnswers = async () => {
      const { data } = await supabase.from('lc_answers').select('*').eq('attempt_id', attempt.id);
      const map: Record<string, string> = {};
      (data ?? []).forEach(a => { map[a.question_id] = a.answer; });
      setSavedAnswers(map);
      setAnswers(map);
    };
    loadAnswers();
  }, []);

  // Timer
  useEffect(() => {
    if (timeLeft === null || submitted) return;
    if (timeLeft <= 0) { handleSubmit(true); return; }
    const t = setInterval(() => setTimeLeft(p => (p ?? 1) - 1), 1000);
    return () => clearInterval(t);
  }, [timeLeft, submitted]);

  // Anti-cheat: tab switch detection
  useEffect(() => {
    const onVisChange = () => {
      if (document.hidden && !submitted) {
        setTabSwitches(p => {
          const next = p + 1;
          supabase.from('lc_quiz_attempts').update({ tab_switches: next }).eq('id', attempt.id);
          if (next >= 3) alert('⚠️ Peringatan: Kamu telah berpindah tab sebanyak ' + next + ' kali. Data ini direkam admin.');
          return next;
        });
      }
    };
    document.addEventListener('visibilitychange', onVisChange);
    return () => document.removeEventListener('visibilitychange', onVisChange);
  }, [submitted]);

  const handleAnswer = async (questionId: string, answer: string) => {
    setAnswers(p => ({ ...p, [questionId]: answer }));
    // Upsert to DB
    const existing = savedAnswers[questionId];
    if (existing) {
      await supabase.from('lc_answers').update({ answer, answered_at: new Date().toISOString() })
        .eq('attempt_id', attempt.id).eq('question_id', questionId);
    } else {
      const q = questions.find(q => q.id === questionId);
      await supabase.from('lc_answers').insert([{
        attempt_id: attempt.id,
        user_id: user.id,
        quiz_session_id: session.id,
        question_id: questionId,
        answer,
        is_correct: q?.correct_answer === answer,
      }]);
      setSavedAnswers(p => ({ ...p, [questionId]: answer }));
    }
  };

  const handleSubmit = async (autoSubmit = false) => {
    if (!autoSubmit && !confirm('Submit jawaban? Pastikan semua soal sudah dijawab.')) return;
    const timeTaken = Math.round((Date.now() - startTime.current) / 1000);
    // Calculate score
    let correct = 0;
    questions.forEach(q => { if ((answers[q.id] ?? savedAnswers[q.id]) === q.correct_answer) correct++; });
    const score = questions.length ? (correct / questions.length) * 100 : 0;
    const passed = score >= session.passing_grade;

    // Update is_correct in lc_answers
    await Promise.all(questions.map(q => {
      const ans = answers[q.id] ?? savedAnswers[q.id];
      if (!ans) return;
      return supabase.from('lc_answers')
        .update({ is_correct: ans === q.correct_answer })
        .eq('attempt_id', attempt.id).eq('question_id', q.id);
    }));

    await supabase.from('lc_quiz_attempts').update({
      submitted_at: new Date().toISOString(),
      score, total_correct: correct, total_questions: questions.length,
      passed, is_submitted: true, time_taken_sec: timeTaken,
    }).eq('id', attempt.id);

    setResult({ score, correct, passed });
    setSubmitted(true);
  };

  const fmtTimer = (s: number) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  if (submitted && result) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-10 max-w-md w-full text-center">
          <div className="text-6xl mb-4">{result.passed ? '🎉' : '😔'}</div>
          <h2 className="text-2xl font-black text-slate-800 mb-1">{result.passed ? 'Selamat, Lulus!' : 'Belum Lulus'}</h2>
          <p className="text-slate-500 text-sm mb-6">{session.session_name}</p>
          <div className={`text-6xl font-black mb-2 ${result.passed ? 'text-emerald-500' : 'text-rose-500'}`}>{result.score.toFixed(0)}</div>
          <p className="text-slate-500 text-sm mb-6">Benar {result.correct} dari {questions.length} soal · Passing {session.passing_grade}%</p>
          <button onClick={onDone}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow transition-all">
            Kembali ke Daftar Quiz
          </button>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return <div className="flex items-center justify-center h-full text-slate-400">Memuat soal...</div>;
  }

  const q = questions[current];
  const answered = Object.keys(answers).filter(k => answers[k]).length;

  return (
    <div className="flex h-full">
      {/* Question panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-4 bg-white border-b border-slate-200 sticky top-0 z-10">
          <div>
            <h2 className="font-bold text-slate-800">{session.session_name}</h2>
            <p className="text-xs text-slate-500">{answered}/{questions.length} soal dijawab</p>
          </div>
          <div className="flex items-center gap-4">
            {timeLeft !== null && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-sm border ${timeLeft < 60 ? 'bg-rose-100 text-rose-700 border-rose-200 animate-pulse' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                ⏱️ {fmtTimer(timeLeft)}
              </div>
            )}
            <button onClick={() => handleSubmit(false)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow transition-all">
              ✅ Submit
            </button>
          </div>
        </div>

        {/* Question */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-2xl mx-auto">
            <div className="mb-6">
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Soal {current+1} dari {questions.length}</span>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                <div className="bg-indigo-500 h-1.5 rounded-full transition-all" style={{ width: `${((current+1)/questions.length)*100}%` }} />
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
              <p className="text-base font-semibold text-slate-800 leading-relaxed">{q.question}</p>
            </div>
            <div className="space-y-3">
              {(['A','B','C','D'] as const).map(opt => {
                const val = (q as any)[`option_${opt.toLowerCase()}`];
                const selected = (answers[q.id] ?? savedAnswers[q.id]) === opt;
                return (
                  <button key={opt} onClick={() => handleAnswer(q.id, opt)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all font-medium text-sm
                      ${selected ? 'bg-indigo-50 border-indigo-400 text-indigo-800 shadow-sm' : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/40'}`}>
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black flex-shrink-0 transition-all ${selected ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {opt}
                    </span>
                    {val}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between mt-8">
              <button onClick={() => setCurrent(p => Math.max(0, p-1))} disabled={current === 0}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-all disabled:opacity-40">
                ← Sebelumnya
              </button>
              <button onClick={() => setCurrent(p => Math.min(questions.length-1, p+1))} disabled={current === questions.length-1}
                className="px-5 py-2.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-sm font-semibold rounded-xl transition-all disabled:opacity-40">
                Berikutnya →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigator */}
      <div className="w-52 bg-white border-l border-slate-200 p-4 overflow-y-auto flex-shrink-0">
        <p className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-3">Navigasi Soal</p>
        <div className="grid grid-cols-5 gap-1.5">
          {questions.map((_, i) => {
            const ans = answers[questions[i].id] ?? savedAnswers[questions[i].id];
            return (
              <button key={i} onClick={() => setCurrent(i)}
                className={`w-full aspect-square rounded-lg text-xs font-bold transition-all
                  ${i === current ? 'bg-indigo-500 text-white shadow' : ans ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {i+1}
              </button>
            );
          })}
        </div>
        <div className="mt-4 space-y-1.5 text-xs">
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-emerald-200 border border-emerald-300 flex-shrink-0" />Terjawab</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-slate-100 border border-slate-200 flex-shrink-0" />Belum</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-indigo-500 flex-shrink-0" />Aktif</div>
        </div>
        {tabSwitches > 0 && (
          <div className="mt-4 p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-semibold">
            ⚠️ Tab switches: {tabSwitches}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TEAM: History ────────────────────────────────────────────────────────────

function HistoryPage({ user }: { user: User }) {
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('lc_quiz_attempts')
        .select('*, lc_quiz_sessions(session_name, passing_grade, materi_name)')
        .eq('user_id', user.id)
        .eq('is_submitted', true)
        .order('submitted_at', { ascending: false });
      setHistory(data ?? []);
    };
    load();
  }, [user.id]);

  return (
    <div>
      <PageHeader title="🕐 Riwayat Quiz" subtitle="Semua quiz yang pernah kamu ikuti" />
      <div className="p-8">
        <div className="space-y-4">
          {history.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <div className="text-5xl mb-3">🕐</div>
              <p className="font-semibold">Belum ada riwayat quiz</p>
            </div>
          )}
          {history.map(a => (
            <div key={a.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-5">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-black text-white flex-shrink-0 ${a.passed ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' : 'bg-gradient-to-br from-rose-400 to-rose-600'}`}>
                {a.score?.toFixed(0) ?? '—'}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-slate-800">{a.lc_quiz_sessions?.session_name ?? '-'}</h4>
                <p className="text-sm text-slate-500">{a.lc_quiz_sessions?.materi_name ?? '-'}</p>
                <div className="flex gap-3 mt-1.5 text-xs text-slate-400">
                  <span>✅ {a.total_correct}/{a.total_questions} benar</span>
                  <span>🎯 Passing: {a.lc_quiz_sessions?.passing_grade ?? 70}%</span>
                  {a.time_taken_sec && <span>⏱️ {Math.floor(a.time_taken_sec/60)}m {a.time_taken_sec%60}s</span>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <span className={`text-xs font-bold px-2 py-1 rounded-full border ${a.passed ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>
                  {a.passed ? '✅ LULUS' : '❌ TIDAK LULUS'}
                </span>
                <p className="text-xs text-slate-400 mt-1.5">{a.submitted_at ? fmtDate(a.submitted_at) : ''}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── TEAM: Score ──────────────────────────────────────────────────────────────

function ScorePage({ user }: { user: User }) {
  const [attempts, setAttempts] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('lc_quiz_attempts')
        .select('*, lc_quiz_sessions(session_name, passing_grade)')
        .eq('user_id', user.id).eq('is_submitted', true);
      setAttempts(data ?? []);
    };
    load();
  }, [user.id]);

  const avg = attempts.length ? attempts.reduce((s, a) => s + (a.score ?? 0), 0) / attempts.length : 0;
  const passed = attempts.filter(a => a.passed).length;

  return (
    <div>
      <PageHeader title="🏆 Nilai Saya" subtitle="Rekap performa quiz kamu" />
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-3 gap-5">
          {[
            { label: 'Quiz Diikuti', value: attempts.length, icon: '📝', color: 'from-blue-500 to-blue-600' },
            { label: 'Rata-rata Skor', value: avg.toFixed(1), icon: '📊', color: 'from-indigo-500 to-indigo-600' },
            { label: 'Total Lulus', value: passed, icon: '✅', color: 'from-emerald-500 to-emerald-600' },
          ].map(c => (
            <div key={c.label} className={`bg-gradient-to-br ${c.color} rounded-2xl p-5 text-white shadow-lg`}>
              <div className="text-3xl mb-2">{c.icon}</div>
              <div className="text-3xl font-black">{c.value}</div>
              <div className="text-white/80 text-sm font-medium mt-1">{c.label}</div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-800">Rekap Nilai Per Quiz</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-widest">Quiz</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Skor</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Benar</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Status</th>
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">Tanggal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {attempts.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-slate-400">Belum ada quiz yang diselesaikan</td></tr>
              )}
              {attempts.map(a => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3.5 font-semibold text-slate-800">{a.lc_quiz_sessions?.session_name ?? '-'}</td>
                  <td className="px-5 py-3.5 text-center"><ScoreBadge score={a.score} passing={a.lc_quiz_sessions?.passing_grade ?? 70} /></td>
                  <td className="px-5 py-3.5 text-center text-slate-600">{a.total_correct}/{a.total_questions}</td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${a.passed ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>
                      {a.passed ? 'LULUS' : 'TIDAK LULUS'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-center text-slate-400 text-xs">{a.submitted_at ? fmtDate(a.submitted_at) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── TEAM: Profile ────────────────────────────────────────────────────────────

function ProfilePage({ user }: { user: User }) {
  return (
    <div>
      <PageHeader title="👤 Profile" subtitle="Informasi akun kamu" />
      <div className="p-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 max-w-md">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white text-2xl font-black">
              {user.full_name?.[0]?.toUpperCase()}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">{user.full_name}</h3>
              <p className="text-sm text-slate-500">{user.username}</p>
            </div>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Role', value: user.role },
              { label: 'Jabatan', value: user.jabatan ?? '—' },
              { label: 'Sales Division', value: user.sales_division ?? '—' },
              { label: 'Phone', value: user.phone_number ?? '—' },
            ].map(f => (
              <div key={f.label} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{f.label}</span>
                <span className="text-sm font-semibold text-slate-800">{f.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
