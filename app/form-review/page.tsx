'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { setSession, clearSession, getSession } from '@/lib/auth';
import {
  ReviewCategory, ReviewForm, Reminder, GuestUser,
  PIE_COLORS, REVIEW_TRIGGER_CATEGORIES,
  getCategoryType, formatDate, formatDatetime,
} from './_components/shared';
import {
  FormField, SectionHeader, StarRating, LoadingScreen, MiniPieChart,
  ViewIconBtn, EditIconBtn, DeleteIconBtn, ActionGroup,
} from '@/components/shared';

// ─── Main Component ────────────────────────────────────────────────────────────

export default function FormReviewPage() {
  const router = useRouter();

  // Auth
  const [initializing, setInitializing] = useState(true); // prevent flash login
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<GuestUser | null>(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [dashLoading, setDashLoading] = useState(false);
  const [appReady, setAppReady] = useState(false);
  const [loadingBar, setLoadingBar] = useState(0); // 0-100 progress bar
  const [loadingMessage, setLoadingMessage] = useState('Loading...');

  // Data
  const [reviews, setReviews] = useState<ReviewForm[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Notifications
  const [showNotificationPopup, setShowNotificationPopup] = useState(false);
  const [showBellPopup, setShowBellPopup] = useState(false);
  const [myPendingReviews, setMyPendingReviews] = useState<ReviewForm[]>([]);

  // Filters
  const [filterCategory, setFilterCategory] = useState<'all' | 'Demo Product' | 'BAST'>('all');
  const [searchProject, setSearchProject] = useState('');
  const [searchHandler, setSearchHandler] = useState('');
  const [searchSalesName, setSearchSalesName] = useState('');
  const [filterReviewCat, setFilterReviewCat] = useState<'all' | 'Demo Product' | 'BAST'>('all');
  const [handlerFilter, setHandlerFilter] = useState<string | null>(null);
  const [productFilterChart, setProductFilterChart] = useState<string | null>(null);
  const [salesDivisionFilter, setSalesDivisionFilter] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState(false);

  // Switch tabs
  const [switchTab, setSwitchTab] = useState<'Demo Product' | 'BAST'>('Demo Product');

  // Modals
  const [detailReview, setDetailReview] = useState<ReviewForm | null>(null);
  const [editingReview, setEditingReview] = useState<ReviewForm | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ReviewForm | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Review form data
  const emptyReviewForm = {
    product_demo: '', grade_product_knowledge: 0, catatan_grade_product_knowledge: '',
    product_bast: '', grade_training_customer: 0, catatan_grade_training_customer: '',
    grade_product_knowledge_bast: 0, catatan_grade_product_knowledge_bast: '',
    foto_dokumentasi_url: '',
  };
  const [reviewFormData, setReviewFormData] = useState(emptyReviewForm);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const fotoRef = useRef<HTMLInputElement>(null);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const notify = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const rfd = (patch: Partial<typeof emptyReviewForm>) =>
    setReviewFormData(prev => ({ ...prev, ...patch }));

  const isAdmin = currentUser?.role === 'admin';
  const isGuest = currentUser?.role === 'guest';
  const isTeam = currentUser?.role === 'team';

  // ─── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const user = getSession<GuestUser>();
    if (user) {
      setCurrentUser(user);
      setIsLoggedIn(true);
    }
    setInitializing(false);

    // Set pesan loading sesuai role
    if (user?.role === 'guest') setLoadingMessage('Memuat form review Anda...');
    else if (user?.role === 'team') setLoadingMessage('Memuat jadwal review tim...');
    else if (user?.role === 'admin') setLoadingMessage('Memuat semua data review...');
    else setLoadingMessage('Loading Form Review...');

    // Loading bar animasi
    setLoadingBar(20);
    const t1 = setTimeout(() => setLoadingBar(60), 200);
    const t2 = setTimeout(() => setLoadingBar(85), 500);

    fetchReviewsQuiet(user).then(() => {
      setLoadingBar(100);
      setTimeout(() => { setLoadingBar(0); setAppReady(true); }, 300);
    });

    // Realtime subscription
    const ch = supabase.channel('form-reviews-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'form_reviews' }, () => {
        const u = getSession<GuestUser>() ?? user;
        fetchReviewsQuiet(u);
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Session timeout
  useEffect(() => {
    const check = () => {
      if (!getSession()) {
        clearSession();
        const target = window.top !== window ? window.top : window;
        if (target) target.location.href = '/dashboard';
      }
    };
    check();
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, []);

  // ─── Fetch ─────────────────────────────────────────────────────────────────

  const fetchReviewsQuiet = async (user?: GuestUser | null) => {
    let activeUser: GuestUser | null = user ?? currentUser;
    if (!activeUser) activeUser = getSession<GuestUser>();

    let query = supabase.from('form_reviews').select('*').order('created_at', { ascending: false });

    // Guest hanya melihat data milik mereka (OR filter untuk kompatibilitas data lama)
    if (activeUser?.role === 'guest') {
      query = query.or(
        `guest_username.eq.${activeUser.username},sales_name.eq.${activeUser.full_name}`
      );
    }
    // Team: hanya lihat form review yang di-handle oleh mereka (assigned_to = username)
    else if (activeUser?.role === 'team') {
      query = query.eq('assigned_to', activeUser.username);
    }
    // Admin: lihat semua

    const { data, error } = await query;
    if (!error && data) {
      setReviews(data as ReviewForm[]);

      // ── Notif untuk Guest: pending review yang belum diisi
      if (activeUser?.role === 'guest') {
        const pending = (data as ReviewForm[]).filter(r => !r.grade_product_knowledge && !r.grade_product_knowledge_bast);
        setMyPendingReviews(pending);
        if (pending.length > 0) setTimeout(() => setShowNotificationPopup(true), 800);
      }

      // ── Notif untuk Team: form review milik mereka yang BELUM diisi guest
      if (activeUser?.role === 'team') {
        const pendingByGuest = (data as ReviewForm[]).filter(r =>
          !r.grade_product_knowledge && !r.grade_product_knowledge_bast
        );
        setMyPendingReviews(pendingByGuest);
        if (pendingByGuest.length > 0) setTimeout(() => setShowNotificationPopup(true), 800);
      }
    }
  };

  const fetchReviews = async () => {
    setListLoading(true);
    setLoadingBar(30);
    setTimeout(() => setLoadingBar(70), 200);
    await fetchReviewsQuiet();
    setLoadingBar(100);
    setTimeout(() => { setLoadingBar(0); setListLoading(false); }, 300);
  };

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  const handleSaveReview = async () => {
    if (!editingReview) return;

    const isDemo = editingReview.review_category === 'Demo Product';

    if (isDemo) {
      if (!reviewFormData.product_demo?.trim()) { notify('error', 'Product wajib diisi!'); return; }
      if (!reviewFormData.grade_product_knowledge) { notify('error', 'Grade Product Knowledge wajib diisi!'); return; }
    } else {
      if (!reviewFormData.product_bast?.trim()) { notify('error', 'Product wajib diisi!'); return; }
      if (!reviewFormData.grade_training_customer) { notify('error', 'Grade Training Customer wajib diisi!'); return; }
      if (!reviewFormData.grade_product_knowledge_bast) { notify('error', 'Grade Product Knowledge wajib diisi!'); return; }
    }

    setSaving(true);

    let fotoUrl = reviewFormData.foto_dokumentasi_url;
    if (fotoFile) {
      const ext = fotoFile.name.split('.').pop();
      const fileName = `review_foto_${editingReview.id}_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('review-photos')
        .upload(fileName, fotoFile, { upsert: true });
      if (upErr) {
        notify('error', 'Gagal upload foto: ' + upErr.message);
        setSaving(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('review-photos').getPublicUrl(fileName);
      fotoUrl = urlData?.publicUrl;
    }

    const payload: Partial<ReviewForm> = {
      foto_dokumentasi_url: fotoUrl,
      updated_at: new Date().toISOString(),
    };

    if (isDemo) {
      payload.product_demo = reviewFormData.product_demo;
      payload.grade_product_knowledge = reviewFormData.grade_product_knowledge;
      payload.catatan_grade_product_knowledge = reviewFormData.catatan_grade_product_knowledge;
    } else {
      payload.product_bast = reviewFormData.product_bast;
      payload.grade_training_customer = reviewFormData.grade_training_customer;
      payload.catatan_grade_training_customer = reviewFormData.catatan_grade_training_customer;
      payload.grade_product_knowledge_bast = reviewFormData.grade_product_knowledge_bast;
      payload.catatan_grade_product_knowledge_bast = reviewFormData.catatan_grade_product_knowledge_bast;
    }

    const { error } = await supabase.from('form_reviews').update(payload).eq('id', editingReview.id);
    setSaving(false);

    if (error) { notify('error', 'Gagal menyimpan: ' + error.message); return; }
    notify('success', 'Review berhasil disimpan!');
    setShowFormModal(false);
    setEditingReview(null);
    setReviewFormData(emptyReviewForm);
    setFotoFile(null);
    setFotoPreview(null);
    fetchReviewsQuiet();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('form_reviews').delete().eq('id', deleteTarget.id);
    if (error) { notify('error', 'Gagal menghapus.'); return; }
    notify('success', 'Review dihapus.');
    setDetailReview(null);
    setShowDeleteModal(false);
    setDeleteTarget(null);
    setDeleteConfirmText('');
    fetchReviewsQuiet();
  };

  const openEdit = (r: ReviewForm) => {
    setEditingReview(r);
    setReviewFormData({
      product_demo: r.product_demo ?? '',
      grade_product_knowledge: r.grade_product_knowledge ?? 0,
      catatan_grade_product_knowledge: r.catatan_grade_product_knowledge ?? '',
      product_bast: r.product_bast ?? '',
      grade_training_customer: r.grade_training_customer ?? 0,
      catatan_grade_training_customer: r.catatan_grade_training_customer ?? '',
      grade_product_knowledge_bast: r.grade_product_knowledge_bast ?? 0,
      catatan_grade_product_knowledge_bast: r.catatan_grade_product_knowledge_bast ?? '',
      foto_dokumentasi_url: r.foto_dokumentasi_url ?? '',
    });
    setFotoFile(null);
    setFotoPreview(null);
    setDetailReview(null);
    setShowFormModal(true);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Hapus ${selectedIds.size} review terpilih?`)) return;
    setBulkDeleting(true);
    const { error } = await supabase.from('form_reviews').delete().in('id', Array.from(selectedIds));
    if (!error) { setReviews(p => p.filter(r => !selectedIds.has(r.id))); setSelectedIds(new Set()); }
    else notify('error', 'Gagal hapus: ' + error.message);
    setBulkDeleting(false);
  };
  const toggleSelectId = (id: string) => setSelectedIds(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const toggleSelectAll = () => setSelectedIds(
    prev => prev.size === filteredReviews.length ? new Set() : new Set(filteredReviews.map(r => r.id))
  );

  const openDeleteModal = (r: ReviewForm) => {
    setDeleteTarget(r);
    setDeleteConfirmText('');
    setShowDeleteModal(true);
  };

  // ─── Login ─────────────────────────────────────────────────────────────────

  const handleLogin = async () => {
    try {
      const { data, error } = await supabase.from('users').select('*')
        .eq('username', loginForm.username).eq('password', loginForm.password).single();
      if (error || !data) { notify('error', 'Username atau password salah!'); return; }
      setDashLoading(true);
      setCurrentUser(data);
      setIsLoggedIn(true);
      setSession(data);
      await fetchReviewsQuiet(data);
      setTimeout(() => setDashLoading(false), 1800);
    } catch { notify('error', 'Terjadi kesalahan.'); }
  };

  const handleLogout = () => {
    setSelectMode(false); setSelectedIds(new Set()); setFilterCategory('all'); setFilterReviewCat('all');
    setSearchProject(''); setSearchHandler(''); setSearchSalesName('');
    setHandlerFilter(null); setProductFilterChart(null); setSalesDivisionFilter(null);
    clearSession();
    setCurrentUser(null); setIsLoggedIn(false);
    const target = window.top !== window ? window.top : window;
    if (target) target.location.href = '/dashboard';
  };

  // ─── Filters ───────────────────────────────────────────────────────────────

  const filteredReviews = reviews.filter(r => {
    if (filterReviewCat !== 'all' && r.review_category !== filterReviewCat) return false;
    if (handlerFilter && r.assign_name !== handlerFilter) return false;
    if (salesDivisionFilter && r.sales_division !== salesDivisionFilter) return false;
    if (productFilterChart) {
      const prod = r.review_category === 'Demo Product' ? r.product_demo : r.product_bast;
      if (prod !== productFilterChart) return false;
    }
    if (searchProject && !r.project_name?.toLowerCase().includes(searchProject.toLowerCase()) &&
        !r.address?.toLowerCase().includes(searchProject.toLowerCase())) return false;
    if (searchHandler && !r.assign_name?.toLowerCase().includes(searchHandler.toLowerCase())) return false;
    if (searchSalesName && !r.sales_name?.toLowerCase().includes(searchSalesName.toLowerCase())) return false;
    return true;
  });

  // Demo vs BAST split for table switch
  const demoReviews = filteredReviews.filter(r => r.review_category === 'Demo Product');
  const bastReviews = filteredReviews.filter(r => r.review_category === 'BAST');
  const tableReviews = switchTab === 'Demo Product' ? demoReviews : bastReviews;

  // Dashboard counts
  const totalDemo = reviews.filter(r => r.review_category === 'Demo Product').length;
  const totalTraining = reviews.filter(r => r.review_category === 'BAST').length;

  // Pie data
  const categoryPieData = (() => {
    const map: Record<string, number> = {};
    reviews.forEach(r => { map[r.reminder_category] = (map[r.reminder_category] || 0) + 1; });
    return Object.entries(map).map(([label, value], i) => ({ label, value, color: PIE_COLORS[i % PIE_COLORS.length] }));
  })();

  const salesDivisionPieData = (() => {
    const map: Record<string, number> = {};
    reviews.forEach(r => { if (r.sales_division) map[r.sales_division] = (map[r.sales_division] || 0) + 1; });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([label, value], i) => ({ label, value, color: PIE_COLORS[i % PIE_COLORS.length] }));
  })();

  const handlerPieData = (() => {
    const map: Record<string, number> = {};
    reviews.forEach(r => { if (r.assign_name) map[r.assign_name] = (map[r.assign_name] || 0) + 1; });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([label, value], i) => ({ label, value, color: PIE_COLORS[i % PIE_COLORS.length] }));
  })();

  const productPieData = (() => {
    const map: Record<string, number> = {};
    reviews.forEach(r => {
      const prod = r.review_category === 'Demo Product' ? r.product_demo : r.product_bast;
      if (prod) map[prod] = (map[prod] || 0) + 1;
    });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([label, value], i) => ({ label, value, color: PIE_COLORS[i % PIE_COLORS.length] }));
  })();

  const myActivePendingReviews = reviews.filter(r =>
    currentUser && (
      // Guest: review miliknya yang belum diisi
      (currentUser.role === 'guest' && (
        r.guest_username === currentUser.username ||
        r.sales_name === currentUser.full_name
      )) ||
      // Team: review yang dia handle, tapi guest belum isi
      (currentUser.role === 'team' && r.assigned_to === currentUser.username)
    ) &&
    !r.grade_product_knowledge && !r.grade_product_knowledge_bast
  );

  const inputCls = "w-full rounded-xl px-4 py-3 text-sm outline-none transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-violet-500/40";
  const inputStyle = { background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(0,0,0,0.12)' };

  // ─── Login Page ─────────────────────────────────────────────────────────────

  if (!isLoggedIn) {
    // Saat masih baca localStorage, jangan tampilkan login — hindari flash
    if (initializing) return null;
    return (
      <div className="min-h-screen flex items-center justify-center relative"
        style={{ backgroundImage: `url('/IVP_Background.png')`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.45)' }} />
        {toast && (
          <div className={`fixed top-5 right-5 z-[200] px-5 py-3.5 rounded-xl shadow-2xl text-sm font-bold flex items-center gap-2 text-white ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
            {toast.type === 'success' ? '✅' : '❌'} {toast.msg}
          </div>
        )}
        <div className="relative z-10 bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl p-8 w-full max-w-md" style={{ border: '2px solid rgba(124,58,237,0.3)' }}>
          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#5b21b6)', boxShadow: '0 6px 24px rgba(124,58,237,0.4)' }}>
              <span className="text-3xl">⭐</span>
            </div>
          </div>
          <h1 className="text-3xl font-black text-center mb-1 text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-purple-800">Login</h1>
          <p className="text-center text-gray-600 font-semibold mb-6 text-sm">Form Review Demo Produk & BAST<br /><span className="text-violet-600 font-bold">PTS IVP — Survey Team</span></p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-2 text-gray-700">Username</label>
              <input type="text" value={loginForm.username}
                onChange={e => setLoginForm({ ...loginForm, username: e.target.value })}
                className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 focus:border-violet-600 focus:ring-4 focus:ring-violet-200 transition-all font-medium bg-white"
                placeholder="Masukkan username"
                onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            </div>
            <div>
              <label className="block text-sm font-bold mb-2 text-gray-700">Password</label>
              <input type="password" value={loginForm.password}
                onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 focus:border-violet-600 focus:ring-4 focus:ring-violet-200 transition-all font-medium bg-white"
                placeholder="Masukkan password"
                onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            </div>
            <button onClick={handleLogin}
              className="w-full text-white py-3 rounded-xl font-bold shadow-xl transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#5b21b6)' }}>
              🔐 Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading awal — tampilkan sebelum data siap (sesuai role)
  if (!appReady) return <LoadingScreen message={loadingMessage} accentColor="#7c3aed" />;

  if (dashLoading) return <LoadingScreen message="Memuat data..." accentColor="#7c3aed" />;

  // ─── Main Render ────────────────────────────────────────────────────────────

  return (
    <div className="h-screen overflow-hidden flex flex-col relative" style={{
      backgroundImage: `url('/IVP_Background.png')`,
      backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed',
    }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(255,255,255,0.08)' }} />
      <div className="relative z-10 flex flex-col flex-1 overflow-hidden">

        {/* Toast */}
        {toast && (
          <div className={`fixed top-5 right-5 z-[200] px-5 py-3.5 rounded-xl shadow-2xl text-sm font-bold flex items-center gap-2 text-white animate-bounce`}
            style={{
              background: toast.type === 'success' ? '#059669' : '#dc2626',
              boxShadow: toast.type === 'success' ? '0 4px 20px rgba(5,150,105,0.4)' : '0 4px 20px rgba(220,38,38,0.4)',
            }}>
            {toast.type === 'success' ? '✅' : '❌'} {toast.msg}
          </div>
        )}

        {/* ── DELETE MODAL ── */}
        {showDeleteModal && deleteTarget && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[110] p-4">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-md w-full p-6"
              style={{ animation: 'scale-in 0.25s ease-out', border: '2px solid rgba(220,38,38,0.5)' }}>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">🗑️</span>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">Hapus Review</h3>
                  <p className="text-xs font-medium text-gray-500">{deleteTarget.project_name}</p>
                  <p className="text-xs text-gray-400">{deleteTarget.review_category}</p>
                </div>
              </div>
              <div className="rounded-xl p-3 mb-4 text-xs"
                style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: '#b91c1c' }}>
                ⚠️ <strong>Tindakan ini tidak dapat dibatalkan.</strong> Review ini akan dihapus permanen dari database.
              </div>
              <div className="mb-4">
                <label className="block text-sm font-bold mb-1 text-gray-700">
                  Ketik <span className="font-mono bg-red-100 text-red-700 px-1.5 py-0.5 rounded">HAPUS</span> untuk konfirmasi
                </label>
                <input type="text" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder="Ketik HAPUS di sini..."
                  className="w-full rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                  style={{ border: '2px solid rgba(220,38,38,0.3)', background: 'white' }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={handleDelete} disabled={deleteConfirmText !== 'HAPUS'}
                  className="bg-gradient-to-r from-red-600 to-red-800 text-white py-2.5 rounded-xl font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  🗑️ Hapus Permanen
                </button>
                <button onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); setDeleteConfirmText(''); }}
                  className="bg-gray-100 text-gray-700 py-2.5 rounded-xl font-bold hover:bg-gray-200 transition-all">
                  ✕ Batal
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── FORM MODAL (Edit/View Review) ── */}
        {showFormModal && editingReview && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[110] p-4 overflow-y-auto"
            onClick={e => { if (e.target === e.currentTarget) { setShowFormModal(false); setEditingReview(null); setReviewFormData(emptyReviewForm); } }}>
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-2xl my-4"
              style={{ animation: 'scale-in 0.25s ease-out', border: '1.5px solid rgba(124,58,237,0.25)' }}>
              {/* Header */}
              <div className="px-8 py-6 rounded-t-2xl" style={{ background: 'linear-gradient(135deg,#7c3aed,#5b21b6)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white">✏️ Isi Review</h2>
                    <p className="text-violet-200/80 text-xs mt-1">{editingReview.project_name}</p>
                    <p className="text-violet-300/70 text-xs mt-0.5">
                      {editingReview.review_category === 'Demo Product' ? '🖥️ Demo Product' : '📌 BAST (Training)'}
                    </p>
                  </div>
                  <button onClick={() => { setShowFormModal(false); setEditingReview(null); setReviewFormData(emptyReviewForm); }}
                    className="bg-white/15 hover:bg-white/25 text-white p-2 rounded-lg transition-all">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>

              <div className="p-8 space-y-5 max-h-[75vh] overflow-y-auto">
                {/* Project Info (Read-only) */}
                <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)' }}>
                  <p className="text-[10px] font-bold tracking-widest uppercase text-violet-600">Informasi Project</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div><span className="text-gray-400">Project:</span> <span className="font-semibold text-gray-700">{editingReview.project_name}</span></div>
                    <div><span className="text-gray-400">Lokasi:</span> <span className="font-semibold text-gray-700">{editingReview.address}</span></div>
                    <div><span className="text-gray-400">Sales:</span> <span className="font-semibold text-gray-700">{editingReview.sales_name}</span></div>
                    <div><span className="text-gray-400">Divisi:</span> <span className="font-semibold text-gray-700">{editingReview.sales_division}</span></div>
                    <div><span className="text-gray-400">Handler:</span> <span className="font-semibold text-gray-700">{editingReview.assign_name}</span></div>
                    <div><span className="text-gray-400">Kategori:</span> <span className="font-semibold text-gray-700">{editingReview.reminder_category}</span></div>
                  </div>
                </div>

                {editingReview.review_category === 'Demo Product' ? (
                  <>
                    <SectionHeader icon="🖥️" title="Review Demo Product" />
                    <FormField label="Product *">
                      <textarea value={reviewFormData.product_demo} onChange={e => rfd({ product_demo: e.target.value })}
                        rows={3} className={`${inputCls} resize-none`} style={inputStyle}
                        placeholder="Deskripsikan product yang di-demo-kan..." />
                    </FormField>
                    <FormField label="Grade Product Knowledge *">
                      <StarRating value={reviewFormData.grade_product_knowledge} onChange={v => rfd({ grade_product_knowledge: v })} />
                    </FormField>
                    <FormField label="Catatan Grade Product Knowledge">
                      <textarea value={reviewFormData.catatan_grade_product_knowledge} onChange={e => rfd({ catatan_grade_product_knowledge: e.target.value })}
                        rows={2} className={`${inputCls} resize-none`} style={inputStyle}
                        placeholder="Catatan penilaian product knowledge..." />
                    </FormField>
                  </>
                ) : (
                  <>
                    <SectionHeader icon="📌" title="Review BAST (Training)" />
                    <FormField label="Product *">
                      <textarea value={reviewFormData.product_bast} onChange={e => rfd({ product_bast: e.target.value })}
                        rows={3} className={`${inputCls} resize-none`} style={inputStyle}
                        placeholder="Deskripsikan product yang di-training-kan..." />
                    </FormField>
                    <FormField label="Grade Training Customer *">
                      <StarRating value={reviewFormData.grade_training_customer} onChange={v => rfd({ grade_training_customer: v })} />
                    </FormField>
                    <FormField label="Catatan Grade Training Customer">
                      <textarea value={reviewFormData.catatan_grade_training_customer} onChange={e => rfd({ catatan_grade_training_customer: e.target.value })}
                        rows={2} className={`${inputCls} resize-none`} style={inputStyle}
                        placeholder="Catatan penilaian training customer..." />
                    </FormField>
                    <FormField label="Grade Product Knowledge *">
                      <StarRating value={reviewFormData.grade_product_knowledge_bast} onChange={v => rfd({ grade_product_knowledge_bast: v })} />
                    </FormField>
                    <FormField label="Catatan Grade Product Knowledge">
                      <textarea value={reviewFormData.catatan_grade_product_knowledge_bast} onChange={e => rfd({ catatan_grade_product_knowledge_bast: e.target.value })}
                        rows={2} className={`${inputCls} resize-none`} style={inputStyle}
                        placeholder="Catatan penilaian product knowledge..." />
                    </FormField>
                  </>
                )}

                <SectionHeader icon="📸" title="Foto Dokumentasi" />
                <div>
                  <input ref={fotoRef} type="file" accept="image/*" className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setFotoFile(file);
                        const reader = new FileReader();
                        reader.onload = ev => setFotoPreview(ev.target?.result as string);
                        reader.readAsDataURL(file);
                      }
                    }} />
                  <button type="button" onClick={() => fotoRef.current?.click()}
                    className="w-full rounded-xl py-4 border-2 border-dashed transition-all text-sm font-semibold text-violet-600 hover:bg-violet-50"
                    style={{ borderColor: 'rgba(124,58,237,0.4)' }}>
                    📸 Upload Foto Dokumentasi
                  </button>
                  {(fotoPreview || reviewFormData.foto_dokumentasi_url) && (
                    <img src={fotoPreview || reviewFormData.foto_dokumentasi_url} alt="Foto" className="mt-3 rounded-xl w-full max-h-48 object-cover" />
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => { setShowFormModal(false); setEditingReview(null); setReviewFormData(emptyReviewForm); }}
                    className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all"
                    style={{ background: 'rgba(255,255,255,0.95)', color: '#64748b', border: '1px solid rgba(0,0,0,0.12)' }}>
                    Batal
                  </button>
                  <button onClick={handleSaveReview} disabled={saving}
                    className="flex-1 text-white py-3 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2 hover:scale-[1.02]"
                    style={{ background: 'linear-gradient(135deg,#7c3aed,#5b21b6)', boxShadow: '0 4px 14px rgba(124,58,237,0.35)' }}>
                    {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    💾 Simpan Review
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── DETAIL MODAL ── */}
        {detailReview && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 overflow-y-auto"
            onClick={e => { if (e.target === e.currentTarget) setDetailReview(null); }}>
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-2xl my-4 overflow-hidden"
              style={{ animation: 'scale-in 0.25s ease-out', border: '1px solid rgba(0,0,0,0.1)', maxHeight: '96vh' }}>

              {/* Header */}
              <div className="px-6 py-5 relative"
                style={{ background: detailReview.review_category === 'Demo Product' ? 'linear-gradient(135deg,#7c3aeddd,#5b21b688)' : 'linear-gradient(135deg,#0ea5e9dd,#0284c788)' }}>
                <button onClick={() => setDetailReview(null)}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/20 hover:bg-black/30 text-white flex items-center justify-center font-bold text-lg">✕</button>
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white"
                    style={{ background: detailReview.review_category === 'Demo Product' ? '#7c3aed' : '#0ea5e9', border: '2px solid rgba(255,255,255,0.6)' }}>
                    {detailReview.review_category === 'Demo Product' ? '🖥️' : '📌'} {detailReview.review_category}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white"
                    style={{ background: 'rgba(0,0,0,0.25)', border: '2px solid rgba(255,255,255,0.4)' }}>
                    📋 {detailReview.reminder_category}
                  </span>
                  {/* Status badge */}
                  {(() => {
                    const hasReview = detailReview.review_category === 'Demo Product'
                      ? !!detailReview.grade_product_knowledge
                      : !!(detailReview.grade_training_customer && detailReview.grade_product_knowledge_bast);
                    return hasReview ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white"
                        style={{ background: '#059669', border: '2px solid rgba(255,255,255,0.5)' }}>
                        ✅ Sudah Diisi
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white animate-pulse"
                        style={{ background: '#d97706', border: '2px solid rgba(255,255,255,0.5)' }}>
                        ⏳ Belum Diisi
                      </span>
                    );
                  })()}
                </div>
                <h2 className="text-xl font-bold text-white leading-tight">{detailReview.project_name || '—'}</h2>
                {detailReview.address && <p className="text-white/80 text-sm mt-1 flex items-center gap-1.5">📍 {detailReview.address}</p>}
              </div>

              <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(95vh - 180px)' }}>

                {/* Info Cards Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {[
                    { icon: '👤', label: 'Sales', value: detailReview.sales_name },
                    { icon: '🏢', label: 'Divisi', value: detailReview.sales_division },
                    { icon: '🛠️', label: 'Handler PTS', value: detailReview.assign_name },
                    { icon: '👥', label: 'Guest Reviewer', value: detailReview.guest_username },
                    { icon: '📅', label: 'Dibuat', value: formatDatetime(detailReview.created_at) },
                    { icon: '🔄', label: 'Update', value: detailReview.updated_at ? formatDatetime(detailReview.updated_at) : null },
                  ].filter(x => x.value).map((item, i) => (
                    <div key={i} className="rounded-xl px-4 py-3" style={{ background: 'rgba(248,250,252,0.9)', border: '1px solid rgba(0,0,0,0.07)' }}>
                      <p className="text-[9px] font-bold tracking-widest uppercase text-gray-400">{item.icon} {item.label}</p>
                      <p className="text-sm font-bold text-gray-800 mt-0.5 break-words">{item.value}</p>
                    </div>
                  ))}
                </div>

                {/* Demo Product review detail */}
                {detailReview.review_category === 'Demo Product' && (
                  <div className="rounded-xl p-4 space-y-4" style={{ background: 'rgba(124,58,237,0.04)', border: '1.5px solid rgba(124,58,237,0.15)' }}>
                    <p className="text-[10px] font-bold tracking-widest uppercase text-violet-600">🖥️ Review Demo Product</p>

                    {detailReview.product_demo ? (
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Product yang Di-Demo</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap bg-white/60 rounded-lg px-3 py-2 border border-violet-100">{detailReview.product_demo}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic px-2">Product belum diisi</p>
                    )}

                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Grade Product Knowledge</p>
                      {detailReview.grade_product_knowledge ? (
                        <>
                          <StarRating value={detailReview.grade_product_knowledge} disabled />
                          {detailReview.catatan_grade_product_knowledge && (
                            <div className="mt-2 bg-white/60 rounded-lg px-3 py-2 border border-violet-100">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Catatan</p>
                              <p className="text-xs text-gray-600 italic">{detailReview.catatan_grade_product_knowledge}</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                          <span className="text-sm">⏳</span>
                          <p className="text-xs font-semibold text-amber-700">Belum diisi oleh guest</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* BAST review detail */}
                {detailReview.review_category === 'BAST' && (
                  <div className="rounded-xl p-4 space-y-4" style={{ background: 'rgba(14,165,233,0.04)', border: '1.5px solid rgba(14,165,233,0.15)' }}>
                    <p className="text-[10px] font-bold tracking-widest uppercase text-sky-600">📌 Review BAST (Training)</p>

                    {detailReview.product_bast ? (
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Product yang Di-Training</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap bg-white/60 rounded-lg px-3 py-2 border border-sky-100">{detailReview.product_bast}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic px-2">Product belum diisi</p>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Grade Training Customer</p>
                        {detailReview.grade_training_customer ? (
                          <>
                            <StarRating value={detailReview.grade_training_customer} disabled />
                            {detailReview.catatan_grade_training_customer && (
                              <p className="text-xs text-gray-500 mt-2 italic bg-white/60 rounded-lg px-3 py-2 border border-sky-100">{detailReview.catatan_grade_training_customer}</p>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                            <span className="text-sm">⏳</span>
                            <p className="text-xs font-semibold text-amber-700">Belum diisi</p>
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Grade Product Knowledge</p>
                        {detailReview.grade_product_knowledge_bast ? (
                          <>
                            <StarRating value={detailReview.grade_product_knowledge_bast} disabled />
                            {detailReview.catatan_grade_product_knowledge_bast && (
                              <p className="text-xs text-gray-500 mt-2 italic bg-white/60 rounded-lg px-3 py-2 border border-sky-100">{detailReview.catatan_grade_product_knowledge_bast}</p>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                            <span className="text-sm">⏳</span>
                            <p className="text-xs font-semibold text-amber-700">Belum diisi</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Foto Dokumentasi */}
                {detailReview.foto_dokumentasi_url ? (
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.08)' }}>
                    <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 px-4 pt-3 pb-2">📸 Foto Dokumentasi</p>
                    <img
                      src={detailReview.foto_dokumentasi_url}
                      alt="Foto Dokumentasi"
                      className="w-full max-h-56 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => window.open(detailReview.foto_dokumentasi_url!, '_blank')}
                    />
                    <div className="px-4 pb-3 pt-1">
                      <a href={detailReview.foto_dokumentasi_url} target="_blank" rel="noopener noreferrer"
                        className="text-[11px] font-bold text-violet-600 hover:text-violet-800 transition-colors">
                        🔗 Buka foto di tab baru
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl px-4 py-3 flex items-center gap-2" style={{ background: 'rgba(0,0,0,0.03)', border: '1px dashed rgba(0,0,0,0.15)' }}>
                    <span className="text-gray-300 text-xl">📷</span>
                    <p className="text-xs text-gray-400">Belum ada foto dokumentasi</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-1">
                  {/* Edit hanya untuk admin dan guest (bukan team) */}
                  {(isAdmin || isGuest) && (
                    <button onClick={() => openEdit(detailReview)}
                      className="flex-1 text-white py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.01] flex items-center justify-center gap-2"
                      style={{ background: 'linear-gradient(135deg,#7c3aed,#5b21b6)', boxShadow: '0 3px 12px rgba(124,58,237,0.3)' }}>
                      ✏️ Edit / Isi Review
                    </button>
                  )}
                  {isAdmin && (
                    <button onClick={() => { setDetailReview(null); openDeleteModal(detailReview); }}
                      className="px-5 py-3 rounded-xl font-bold text-sm text-red-600 transition-all hover:bg-red-50 hover:scale-[1.01] flex items-center gap-2"
                      style={{ border: '1.5px solid rgba(220,38,38,0.35)' }}>
                      🗑️ Hapus
                    </button>
                  )}
                  <button onClick={() => setDetailReview(null)}
                    className="px-5 py-3 rounded-xl font-bold text-sm text-gray-500 transition-all hover:bg-gray-100"
                    style={{ border: '1px solid rgba(0,0,0,0.12)' }}>
                    ✕ Tutup
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── NOTIFICATION POPUP ── */}
        {showNotificationPopup && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
            <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden border-4 border-yellow-400"
              style={{ animation: 'scale-in 0.3s ease-out' }}>
              <div className="p-5 border-b-2 border-yellow-300" style={{ background: isTeam ? 'linear-gradient(135deg,#7c3aed,#5b21b6)' : 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl animate-bounce">{isTeam ? '⭐' : '🔔'}</span>
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        {isTeam ? 'Review Belum Diisi Guest' : 'Review Menunggu Kamu'}
                      </h3>
                      <p className="text-sm text-white/90">
                        {isTeam
                          ? `${myPendingReviews.length} jadwal kamu belum di-review oleh Guest`
                          : `${myPendingReviews.length} form review yang perlu kamu isi`}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setShowNotificationPopup(false)} className="text-white hover:bg-white/20 rounded-lg p-2 font-bold">✕</button>
                </div>
              </div>
              <div className="max-h-[calc(80vh-140px)] overflow-y-auto p-4 space-y-2">
                {myPendingReviews.map(r => (
                  <div key={r.id} onClick={() => { setDetailReview(r); setShowNotificationPopup(false); }}
                    className="rounded-xl p-3 border-2 cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all"
                    style={{ background: 'rgba(249,250,251,0.9)', borderColor: '#e5e7eb' }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-violet-700"
                            style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)' }}>
                            {r.review_category === 'Demo Product' ? '🖥️' : '📌'} {r.review_category}
                          </span>
                        </div>
                        <p className="font-bold text-sm text-gray-800 truncate">{r.project_name || '—'}</p>
                        {r.address && <p className="text-xs text-gray-500 mt-0.5">📍 {r.address}</p>}
                        {isTeam && r.sales_name && (
                          <p className="text-xs text-violet-600 font-semibold mt-0.5">👤 Guest: {r.sales_name}</p>
                        )}
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-amber-700"
                          style={{ background: '#fef3c7', border: '1px solid #f59e0b' }}>⏳ Belum Diisi</span>
                        <p className="text-[10px] text-gray-500 mt-1">{isTeam ? r.sales_name : r.assign_name}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t-2 border-gray-200 bg-gray-50">
                <button onClick={() => setShowNotificationPopup(false)}
                  className="w-full text-white py-3 rounded-xl font-bold transition-all"
                  style={{ background: isTeam ? 'linear-gradient(135deg,#7c3aed,#5b21b6)' : 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                  ✕ Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── BELL POPUP ── */}
        {showBellPopup && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
            <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden border-4 border-yellow-400"
              style={{ animation: 'scale-in 0.3s ease-out' }}>
              <div className="p-5 border-b-2 border-yellow-300" style={{ background: isTeam ? 'linear-gradient(135deg,#7c3aed,#5b21b6)' : 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{isTeam ? '⭐' : '🔔'}</span>
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        {isTeam ? 'Review Belum Diisi Guest' : 'Review Aktif Kamu'}
                      </h3>
                      <p className="text-sm text-white/90">
                        {myActivePendingReviews.length} belum diisi
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setShowBellPopup(false)} className="text-white hover:bg-white/20 rounded-lg p-2 font-bold">✕</button>
                </div>
              </div>
              <div className="max-h-[calc(80vh-140px)] overflow-y-auto p-4 space-y-2">
                {myActivePendingReviews.length === 0 ? (
                  <div className="text-center py-10 text-gray-500">
                    <div className="text-5xl mb-3">✅</div>
                    <p className="font-semibold">
                      {isTeam ? 'Semua Guest sudah mengisi review' : 'Semua review sudah diisi'}
                    </p>
                  </div>
                ) : myActivePendingReviews.map(r => (
                  <div key={r.id} onClick={() => { setDetailReview(r); setShowBellPopup(false); }}
                    className="rounded-xl p-3 border-2 cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all"
                    style={{ background: 'rgba(249,250,251,0.9)', borderColor: '#e5e7eb' }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-violet-700 mb-1"
                          style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)' }}>
                          {r.review_category === 'Demo Product' ? '🖥️' : '📌'} {r.review_category}
                        </span>
                        <p className="font-bold text-sm text-gray-800 truncate">{r.project_name || '—'}</p>
                        {r.address && <p className="text-xs text-gray-500 mt-0.5">📍 {r.address}</p>}
                        {isTeam && r.sales_name && (
                          <p className="text-xs text-violet-600 font-semibold mt-0.5">👤 Guest: {r.sales_name}</p>
                        )}
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-amber-700"
                        style={{ background: '#fef3c7', border: '1px solid #f59e0b' }}>⏳ Belum</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t-2 border-gray-200 bg-gray-50">
                <button onClick={() => setShowBellPopup(false)}
                  className="w-full text-white py-3 rounded-xl font-bold transition-all"
                  style={{ background: isTeam ? 'linear-gradient(135deg,#7c3aed,#5b21b6)' : 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                  ✕ Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── HEADER ── */}
        <div className="sticky top-0 z-50 animate-slide-down anim-d0"
          style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          {/* Loading Bar */}
          {loadingBar > 0 && (
            <div className="absolute top-0 left-0 w-full h-0.5 z-[60] overflow-hidden" style={{ background: 'rgba(124,58,237,0.15)' }}>
              <div
                className="h-full transition-all duration-300 ease-out"
                style={{
                  width: `${loadingBar}%`,
                  background: 'linear-gradient(90deg,#7c3aed,#a78bfa,#7c3aed)',
                  backgroundSize: '200% 100%',
                  animation: loadingBar < 100 ? 'shimmer 1.2s infinite' : 'none',
                  opacity: loadingBar === 100 ? 0 : 1,
                  transition: 'width 0.3s ease-out, opacity 0.3s ease-out',
                }}
              />
            </div>
          )}
          <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#5b21b6)' }}>
              <span className="text-white text-base">⭐</span>
            </div>
            <div>
              <p className="text-[10px] font-semibold tracking-[0.2em] uppercase" style={{ color: '#7c3aed' }}>IndoVisual</p>
              <p className="font-bold text-sm leading-none tracking-wide text-slate-800">Form Review Demo & BAST</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Bell */}
            <button onClick={() => setShowBellPopup(true)}
              className="relative p-2 rounded-xl transition-all hover:bg-red-50 border-2 border-transparent hover:border-red-200">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {myActivePendingReviews.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ background: '#f59e0b' }}>
                  {myActivePendingReviews.length}
                </span>
              )}
            </button>
          </div>
        </div>
        </div>

        {/* ── MAIN CONTENT ── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-slide-up anim-d80">
            {[
              {
                label: 'Total Review', value: reviews.length, sub: 'Semua form review',
                gradient: 'linear-gradient(135deg,#4f46e5,#6d28d9)', icon: '⭐', shadow: 'rgba(79,70,229,0.35)',
                onClick: () => { setFilterReviewCat('all'); setHandlerFilter(null); setProductFilterChart(null); },
                active: filterReviewCat === 'all' && !handlerFilter && !productFilterChart,
              },
              {
                label: 'Demo Product', value: totalDemo, sub: 'Review demo unit',
                gradient: 'linear-gradient(135deg,#7c3aed,#5b21b6)', icon: '🖥️', shadow: 'rgba(124,58,237,0.35)',
                onClick: () => setFilterReviewCat(filterReviewCat === 'Demo Product' ? 'all' : 'Demo Product'),
                active: filterReviewCat === 'Demo Product',
              },
              {
                label: 'Belum Diisi', value: reviews.filter(r => !r.grade_product_knowledge && !r.grade_product_knowledge_bast).length, sub: 'Menunggu input guest',
                gradient: 'linear-gradient(135deg,#d97706,#b45309)', icon: '⏳', shadow: 'rgba(217,119,6,0.35)',
                onClick: () => {},
                active: false,
              },
              {
                label: 'Sudah Diisi', value: reviews.filter(r => r.grade_product_knowledge || r.grade_product_knowledge_bast).length, sub: 'Review terselesaikan',
                gradient: 'linear-gradient(135deg,#059669,#047857)', icon: '✅', shadow: 'rgba(5,150,105,0.35)',
                onClick: () => {},
                active: false,
              },
            ].map(card => (
              <div key={card.label}
                onClick={card.onClick}
                className="rounded-2xl p-4 relative overflow-hidden flex flex-col gap-2 cursor-pointer transition-all hover:scale-[1.03] select-none"
                style={{
                  background: card.gradient,
                  boxShadow: card.active ? `0 6px 24px ${card.shadow}` : `0 4px 16px ${card.shadow}`,
                  outline: card.active ? '3px solid white' : 'none',
                  transform: card.active ? 'scale(1.04)' : undefined,
                }}>
                <div className="absolute right-3 top-2 text-4xl opacity-[0.15] select-none">{card.icon}</div>
                {card.active && (
                  <div className="absolute inset-0 rounded-2xl border-4 border-white/50 pointer-events-none" />
                )}
                <span className="text-3xl font-black text-white leading-none">{card.value}</span>
                <div>
                  <p className="text-sm font-bold text-white leading-tight">{card.label}</p>
                  <p className="text-[10px] font-medium leading-tight" style={{ color: 'rgba(255,255,255,0.75)' }}>{card.sub}</p>
                </div>
                {card.active && <span className="absolute top-2 left-2 text-white/80 text-[9px] font-bold uppercase tracking-widest">Filter Aktif ✓</span>}
              </div>
            ))}
          </div>

          {/* Mini Pie Charts */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-zoom-in anim-d160">
            <MiniPieChart data={categoryPieData} title="Kategori Kegiatan" icon="📋"
              activeFilter={filterReviewCat !== 'all' ? filterReviewCat : null}
              onSliceClick={label => setFilterReviewCat(prev => (prev === label ? 'all' : label as any))} />
            <MiniPieChart data={salesDivisionPieData} title="Divisi Sales" icon="👤"
              activeFilter={salesDivisionFilter}
              onSliceClick={label => setSalesDivisionFilter(prev => prev === label ? null : label)} />
            <MiniPieChart data={handlerPieData} title="Handler Team PTS" icon="👥"
              activeFilter={handlerFilter}
              onSliceClick={label => setHandlerFilter(prev => prev === label ? null : label)} />
            <MiniPieChart data={productPieData} title="Product" icon="📦"
              activeFilter={productFilterChart}
              onSliceClick={label => setProductFilterChart(prev => prev === label ? null : label)} />
          </div>

          {/* Table */}
          <div className="rounded-2xl overflow-hidden animate-slide-up anim-d320" style={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(200,200,200,0.6)', backdropFilter: 'blur(12px)' }}>
            {/* Table Header */}
            <div className="flex flex-wrap items-center justify-between px-5 py-3.5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Review List</span>
                <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2.5 py-1 rounded-full">{tableReviews.length}</span>
              </div>
              <div className="flex items-center gap-2">
                {/* Switch Tab */}
                <div className="flex rounded-xl overflow-hidden" style={{ border: '1.5px solid rgba(124,58,237,0.25)' }}>
                  {(['Demo Product', 'BAST'] as const).map(tab => (
                    <button key={tab} onClick={() => setSwitchTab(tab)}
                      className="px-4 py-2 text-xs font-bold transition-all"
                      style={switchTab === tab
                        ? { background: 'linear-gradient(135deg,#7c3aed,#5b21b6)', color: 'white' }
                        : { background: 'transparent', color: '#7c3aed' }}>
                      {tab === 'Demo Product' ? '🖥️' : '📌'} {tab}
                    </button>
                  ))}
                </div>
                {isAdmin && (
                  <button onClick={() => { setSelectMode(m => !m); setSelectedIds(new Set()); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${selectMode ? 'bg-red-50 border-red-300 text-red-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    {selectMode ? '✕ Batal' : '☑ Select'}
                  </button>
                )}
                <button onClick={fetchReviews} disabled={listLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:bg-gray-100 border border-gray-200 text-gray-600 disabled:opacity-60 bg-white">
                  <svg className={`w-3.5 h-3.5 ${listLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  Refresh
                </button>
              </div>
            </div>

            {/* Filter Bar — sama persis dengan Reminder Schedule */}
            <div className="px-5 py-3 flex flex-wrap gap-3 items-end border-b border-gray-100" style={{ background: 'rgba(255,255,255,0.97)' }}>
              <div>
                <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">🔍 Search Project / Lokasi</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[11px]">🔍</span>
                  <input value={searchProject} onChange={e => setSearchProject(e.target.value)}
                    className="w-full rounded-lg pl-7 pr-3 py-1.5 text-xs outline-none bg-gray-50 border border-gray-200 focus:bg-white focus:border-violet-300 transition-all"
                    placeholder="Search project / lokasi..." style={{ minWidth: 180 }} />
                </div>
              </div>
              <div>
                <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">👤 Sales Name</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[11px]">👤</span>
                  <input value={searchSalesName} onChange={e => setSearchSalesName(e.target.value)}
                    className="w-full rounded-lg pl-7 pr-3 py-1.5 text-xs outline-none bg-gray-50 border border-gray-200 focus:bg-white focus:border-violet-300 transition-all"
                    placeholder="Search sales..." />
                </div>
              </div>
              <div>
                <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Team Handler</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[11px]">👷</span>
                  <input value={searchHandler} onChange={e => setSearchHandler(e.target.value)}
                    className="w-full rounded-lg pl-7 pr-3 py-1.5 text-xs outline-none bg-gray-50 border border-gray-200 focus:bg-white focus:border-violet-300 transition-all"
                    placeholder="Search handler..." />
                </div>
              </div>
              <div>
                <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Kategori</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[11px]">📋</span>
                  <select value={filterReviewCat} onChange={e => setFilterReviewCat(e.target.value as any)}
                    className="w-full rounded-lg pl-7 pr-3 py-1.5 text-xs outline-none bg-gray-50 border border-gray-200 focus:bg-white focus:border-violet-300 appearance-none cursor-pointer transition-all">
                    <option value="all">Semua Kategori</option>
                    <option value="Demo Product">Demo Product</option>
                    <option value="BAST">BAST</option>
                  </select>
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px] pointer-events-none">▼</span>
                </div>
              </div>
            </div>
            {/* Bulk delete bar — admin only, selectMode only */}
            {selectMode && isAdmin && selectedIds.size > 0 && (
              <div className="px-5 py-2.5 flex items-center justify-between border-b border-gray-200" style={{ background: 'rgba(124,58,237,0.07)' }}>
                <span className="text-sm font-bold text-violet-700">{selectedIds.size} review dipilih</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-500 px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50">Batal Pilih</button>
                  <button onClick={() => setBulkConfirm(true)} disabled={bulkDeleting}
                    className="text-xs font-bold text-white px-4 py-1.5 rounded-lg disabled:opacity-50 flex items-center gap-1"
                    style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}>
                    {bulkDeleting ? '⏳ Menghapus...' : `🗑️ Hapus ${selectedIds.size}`}
                  </button>
                </div>
              </div>
            )}

            {/* Active Filters Chips */}
            {(handlerFilter || productFilterChart || salesDivisionFilter || filterReviewCat !== 'all' || searchProject || searchSalesName || searchHandler) && (
              <div className="px-5 py-2.5 border-b border-gray-100 flex flex-wrap gap-2 items-center" style={{ background: 'rgba(255,255,255,0.97)' }}>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Filter Aktif:</span>
                {filterReviewCat !== 'all' && (
                  <button onClick={() => setFilterReviewCat('all')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#7c3aed' }}>📋 {filterReviewCat} ✕</button>
                )}
                {salesDivisionFilter && (
                  <button onClick={() => setSalesDivisionFilter(null)} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#ec4899' }}>👤 {salesDivisionFilter} ✕</button>
                )}
                {handlerFilter && (
                  <button onClick={() => setHandlerFilter(null)} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#7c3aed' }}>👷 {handlerFilter} ✕</button>
                )}
                {productFilterChart && (
                  <button onClick={() => setProductFilterChart(null)} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#6366f1' }}>📦 {productFilterChart} ✕</button>
                )}
                {searchProject && (
                  <button onClick={() => setSearchProject('')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#475569' }}>🔍 {searchProject} ✕</button>
                )}
                {searchSalesName && (
                  <button onClick={() => setSearchSalesName('')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#475569' }}>👤 {searchSalesName} ✕</button>
                )}
                {searchHandler && (
                  <button onClick={() => setSearchHandler('')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#475569' }}>👷 {searchHandler} ✕</button>
                )}
                <button onClick={() => { setFilterReviewCat('all'); setSalesDivisionFilter(null); setHandlerFilter(null); setProductFilterChart(null); setSearchProject(''); setSearchSalesName(''); setSearchHandler(''); }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all hover:opacity-80" style={{ background: 'rgba(220,38,38,0.12)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.25)' }}>🗑️ Reset Semua</button>
              </div>
            )}

            {listLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'rgba(124,58,237,0.3)', borderTopColor: '#7c3aed' }} />
              </div>
            ) : tableReviews.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-5xl mb-3">📭</p>
                <p className="font-bold text-gray-600">Tidak ada data {switchTab}</p>
                <p className="text-sm text-gray-400 mt-1">Form review muncul otomatis dari Reminder Schedule yang Solved</p>
              </div>
            ) : (
              <div className="overflow-x-auto animate-zoom-in">
                <table className="w-full border-collapse table-zebra" style={{ tableLayout: 'fixed', background: 'transparent', minWidth: '920px' }}>
                  <colgroup>
                    <col style={{ width: '3%' }} />   {/* No */}
                    <col style={{ width: '14%' }} />  {/* Project */}
                    <col style={{ width: '10%' }} />  {/* Kategori */}
                    <col style={{ width: '9%' }} />   {/* Sales */}
                    <col style={{ width: '11%' }} />   {/* Handler */}
                    <col style={{ width: '11%' }} />  {/* Product */}
                    <col style={{ width: '10%' }} />  {/* Grade 1 */}
                    {switchTab === 'BAST' && <col style={{ width: '10%' }} />}  {/* Grade 2 */}
                    <col style={{ width: '9%' }} />   {/* Status */}
                    <col style={{ width: '9%' }} />   {/* ACT */}
                  </colgroup>
                  <thead>
                    <tr className="border-b-2 border-gray-300" style={{ background: 'rgba(255,255,255,0.97)' }}>
                      {['No', 'Project',  'Kategori', 'Sales', 'Handler',
                        switchTab === 'Demo Product' ? 'Product Demo' : 'Product BAST',
                        switchTab === 'Demo Product' ? 'Grade PK' : 'Grade Training',
                        switchTab === 'BAST' ? 'Grade PK' : null,
                        'Status', 'ACT'].filter(Boolean).map((h, i) => (
                        <th key={i} className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wide border-r border-gray-200">
                          {h === 'No' && selectMode && isAdmin
                            ? <input type="checkbox"
                                checked={selectedIds.size === filteredReviews.length && filteredReviews.length > 0}
                                onChange={toggleSelectAll} className="w-4 h-4 rounded accent-violet-600 cursor-pointer" title="Pilih Semua" />
                            : h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableReviews.map((r, idx) => {
                      const isDemo = r.review_category === 'Demo Product';
                      const hasReview = isDemo
                        ? !!r.grade_product_knowledge
                        : !!(r.grade_training_customer && r.grade_product_knowledge_bast);
                      return (
                        <tr key={r.id}
                          onClick={() => setDetailReview(r)}
                          className="stagger-item border-b border-gray-200 hover:bg-violet-50/20 transition-colors cursor-pointer border-l-4 border-l-transparent"
                          >
                          {/* No / Checkbox combined */}
                          <td className="px-3 py-3 border-r border-gray-200 align-middle text-center" onClick={e => e.stopPropagation()}>
                            {selectMode && isAdmin
                              ? <input type="checkbox" checked={selectedIds.has(r.id)}
                                  onChange={() => toggleSelectId(r.id)} className="w-4 h-4 rounded accent-violet-600 cursor-pointer" />
                              : <span className="text-[11px] font-bold text-gray-400">{idx + 1}</span>}
                          </td>
                          {/* Project */}
                          <td className="px-3 py-3 border-r border-gray-200 align-middle">
                            <div className="text-xs font-bold text-gray-800 leading-tight break-words">{r.project_name || '—'}</div>
                            {r.address && <div className="text-[10px] text-gray-400 truncate mt-0.5">📍 {r.address}</div>}
                            <div className="text-[10px] text-gray-400 mt-0.5">{r.created_at ? formatDatetime(r.created_at) : '—'}</div>
                          </td>
                          {/* Kategori */}
                          <td className="px-3 py-3 border-r border-gray-200 align-middle">
                            <div className="text-[12px] font-semibold text-violet-600 leading-tight">{r.reminder_category || '—'}</div>
                          </td>
                          {/* Sales */}
                          <td className="px-3 py-3 border-r border-gray-200 align-middle">
                            <div className="text-[12px] font-semibold text-gray-700 truncate max-w-[100px]">{r.sales_name || '—'}</div>
                            {r.sales_division && <div className="text-[10px] text-purple-600 font-semibold">{r.sales_division}</div>}
                          </td>
                          {/* Handler */}
                          <td className="px-3 py-3 border-r border-gray-200 align-middle">
                            <div className="flex items-center gap-1">
                              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                                style={{ background: 'linear-gradient(135deg,#7c3aed,#5b21b6)' }}>
                                {r.assign_name?.charAt(0)?.toUpperCase() || '?'}
                              </div>
                              <span className="text-[12px] font-bold text-gray-800 leading-tight break-words">{r.assign_name}</span>
                            </div>
                          </td>
                          {/* Product */}
                          <td className="px-3 py-3 border-r border-gray-200 align-middle">
                            <div className="text-[10px] font-semibold text-gray-700 leading-tight">
                              {isDemo ? (r.product_demo || '—') : (r.product_bast || '—')}
                            </div>
                          </td>
                          {/* Grade 1 */}
                          <td className="px-3 py-3 border-r border-gray-200 align-middle">
                            {isDemo
                              ? (r.grade_product_knowledge ? <StarRating value={r.grade_product_knowledge} disabled /> : <span className="text-gray-300 text-xs">—</span>)
                              : (r.grade_training_customer ? <StarRating value={r.grade_training_customer} disabled /> : <span className="text-gray-300 text-xs">—</span>)
                            }
                          </td>
                          {/* Grade 2 (BAST only) */}
                          {!isDemo && (
                            <td className="px-3 py-3 border-r border-gray-200 align-middle">
                              {r.grade_product_knowledge_bast ? <StarRating value={r.grade_product_knowledge_bast} disabled /> : <span className="text-gray-300 text-xs">—</span>}
                            </td>
                          )}
                          {/* Status */}
                          <td className="px-3 py-3 border-r border-gray-200 align-middle">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[12px] font-bold"
                              style={hasReview
                                ? { background: '#d1fae5', color: '#065f46', border: '1px solid #10b981' }
                                : { background: '#fef3c7', color: '#92400e', border: '1px solid #f59e0b' }}>
                              {hasReview ? '✅ Terisi' : '⏳ Belum'}
                            </span>
                          </td>
                          {/* Actions */}
                          <td className="px-3 py-1 align-middle text-center" onClick={e => e.stopPropagation()}>
                            <ActionGroup>
                              <ViewIconBtn onClick={() => setDetailReview(r)} label="Detail" />
                              {(isAdmin || isGuest) && (
                                <EditIconBtn onClick={() => openEdit(r)} label="Edit" />
                              )}
                              {isAdmin && (
                                <DeleteIconBtn onClick={() => openDeleteModal(r)} label="Hapus" />
                              )}
                            </ActionGroup>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="flex items-center justify-between px-5 py-2.5 border-t border-gray-200" style={{ background: 'rgba(255,255,255,0.97)' }}>
                  <span className="text-[10px] text-gray-400">{tableReviews.length} review ditemukan ({switchTab})</span>
                  <span className="text-[10px] text-gray-400">{tableReviews.length} of {reviews.length} total</span>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity:0; transform:translateY(14px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes scale-in {
          from { opacity:0; transform:scale(0.92); }
          to   { opacity:1; transform:scale(1); }
        }
        @keyframes shimmer {
          0% { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
        select option { background: #ffffff; color: #1e293b; }
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(0.3); cursor: pointer; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(124,58,237,0.25); border-radius: 4px; }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      `}</style>
      {/* Bulk Delete Confirm Modal */}
      {bulkConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border-2 border-red-400">
            <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 flex items-center gap-3">
              <span className="text-2xl">🗑️</span>
              <div><h3 className="font-bold text-white">Hapus {selectedIds.size} Review?</h3>
              <p className="text-red-100 text-xs mt-0.5">Tindakan ini tidak dapat dibatalkan</p></div>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-5">Kamu akan menghapus <strong>{selectedIds.size} review</strong> yang dipilih secara permanen.</p>
              <div className="flex gap-3">
                <button onClick={() => setBulkConfirm(false)} className="flex-1 border-2 border-gray-300 text-gray-700 py-2.5 rounded-xl font-bold hover:bg-gray-50 transition-all text-sm">Batal</button>
                <button onClick={async () => {
                  setBulkConfirm(false); setBulkDeleting(true);
                  const { error } = await supabase.from('form_reviews').delete().in('id', Array.from(selectedIds));
                  if (!error) { setReviews(p => p.filter(r => !selectedIds.has(r.id))); setSelectedIds(new Set()); setSelectMode(false); }
                  else notify('error', 'Gagal: ' + error.message);
                  setBulkDeleting(false);
                }} className="flex-[2] bg-gradient-to-r from-violet-600 to-violet-700 text-white py-2.5 rounded-xl font-bold shadow-lg transition-all text-sm">
                  🗑️ Ya, Hapus Permanen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
