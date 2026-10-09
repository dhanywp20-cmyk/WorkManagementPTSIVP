'use client';

/** Isi halaman Form Review Demo & BAST (page.tsx hanya membungkusnya dengan Suspense untuk useSearchParams). */
import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { bisaDiklik } from '@/components/shared/bisaDiklik';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { isPimpinan } from '@/lib/pimpinan';
import { clearSession, getSession } from '@/lib/auth';
import { sendWANotif } from '@/lib/wa';
import { createNotification } from '@/lib/notifications';
import { penerimaAdminBernomor } from '@/lib/penerima-admin';
import { logAudit } from '@/lib/audit';
import { compressImage } from '@/lib/image-compress';
import { hasFullAccess } from '@/lib/constants';
import { appLink } from '@/lib/app-url';
import { ReviewForm, Reminder, GuestUser, PIE_COLORS, formatDatetime } from './shared';
import { FormField, SectionHeader, StarRating, LoadingScreen, MiniPieChart, ViewIconBtn, EditIconBtn, DeleteIconBtn, ActionGroup, Paginasi, usePaginasi, ConfirmDialog, type ConfirmState, ErrorState, MobileListCard, MobileCardBadge, ListEmptyState, StatCard, ModalPortal } from '@/components/shared';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { Toast } from '@/components/shared/Toast';
import { PopupLonceng } from './PopupLonceng';
import { PopupNotifikasiReview } from './PopupNotifikasiReview';
import { ModalDetailReview } from './ModalDetailReview';
import { ModalFormReview } from './ModalFormReview';
import { ModalHapusReview } from './ModalHapusReview';
import { DaftarReview } from './DaftarReview';

// Main Component

export function FormReviewPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Auth
  const [currentUser, setCurrentUser] = useState<GuestUser | null>(null);
  const [dashLoading, setDashLoading] = useState(false);
  const [appReady, setAppReady] = useState(false);
  const [loadingBar, setLoadingBar] = useState(0); // 0-100 progress bar
  const [loadingMessage, setLoadingMessage] = useState('Loading...');

  // Data
  const [reviews, setReviews] = useState<ReviewForm[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string|null>(null);
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
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

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

  // hasFullAccess = admin/superadmin (bug lama: hilang cek 'superadmin' di sini
  // secara terpisah, sudah ikut benar sekarang), ATAU akun Team PTS dengan
  // toggle "Full Access" aktif (lihat lib/constants.ts hasFullAccess).
  const isAdmin = hasFullAccess(currentUser);
  //  Pimpinan (lib/pimpinan.ts) melihat SEMUA review, hanya baca - bukan "guest yang dinilai".
  const isGuest = currentUser?.role === 'guest' && !isPimpinan(currentUser);
  const isTeam = currentUser?.role === 'team';

  // Sebelumnya cek isGuest saja - artinya SEMUA akun Guest melihat tombol
  // Edit di SETIAP baris, bukan cuma review miliknya sendiri. Dipersempit ke
  // baris yang memang jadi tanggung jawabnya: Guest/Sales yang direview, atau
  // Team yang meng-handle - pola sama dengan myActivePendingReviews di atas.
  const bolehEditReview = (r: ReviewForm): boolean =>
    !isPimpinan(currentUser) && (isAdmin
    || (!!currentUser?.username && r.guest_username === currentUser.username)
    || (!!currentUser?.full_name && r.sales_name === currentUser.full_name)
    || (!!currentUser?.username && r.assigned_to === currentUser.username));

  // Init

  useEffect(() => {
    const user = getSession<GuestUser>();
    if (!user) {
      const target = window.top !== window ? window.top : window;
      if (target) target.location.href = '/dashboard';
      return;
    }
    setCurrentUser(user);

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

  // Deep-link dari notifikasi (?open=<id>): buka detail review-nya langsung,
  // bukan cuma daftar. Ref sekali-jalan - tanpa itu, reviews yang di-refetch
  // berkala akan membuka lagi detailnya tiap kali walau user sudah menutupnya.
  const sudahBukaDariNotif = useRef(false);
  useEffect(() => {
    if (sudahBukaDariNotif.current) return;
    const openId = searchParams.get('open');
    if (!openId || reviews.length === 0) return;
    const target = reviews.find(r => r.id === openId);
    if (target) {
      sudahBukaDariNotif.current = true;
      setDetailReview(target);
    }
  }, [searchParams, reviews]);

  // Fetch

  const fetchReviewsQuiet = async (user?: GuestUser | null) => {
    let activeUser: GuestUser | null = user ?? currentUser;
    if (!activeUser) activeUser = getSession<GuestUser>();

    let query = supabase.from('form_reviews').select('id,reminder_id,project_name,address,sales_name,sales_division,assign_name,assigned_to,reminder_category,review_category,product_demo,grade_product_knowledge,catatan_grade_product_knowledge,product_bast,grade_training_customer,catatan_grade_training_customer,grade_product_knowledge_bast,catatan_grade_product_knowledge_bast,foto_dokumentasi_url,guest_username,created_at,updated_at').order('created_at', { ascending: false }).limit(500);

    // Guest hanya melihat data milik mereka (OR filter untuk kompatibilitas data lama); pimpinan melihat semua
    if (activeUser?.role === 'guest' && !isPimpinan(activeUser)) {
      query = query.or(
        `guest_username.eq.${activeUser.username},sales_name.eq.${activeUser.full_name}`
      );
    }
    // Team: hanya lihat form review yang di-handle oleh mereka (assigned_to = username) -
    // KECUALI akun dengan toggle "Full Access" aktif, yang lihat semua seperti admin.
    else if (activeUser?.role === 'team' && !hasFullAccess(activeUser)) {
      query = query.eq('assigned_to', activeUser.username);
    }
    // Admin (atau Team ber-Full Access): lihat semua

    const { data, error } = await query;
    if (error) { setFetchError(error.message); return; }
    if (data) {
      setReviews(data as ReviewForm[]);

      // Notif untuk Guest: pending review yang belum diisi
      if (activeUser?.role === 'guest' && !isPimpinan(activeUser)) {
        const pending = (data as ReviewForm[]).filter(r => !r.grade_product_knowledge && !r.grade_product_knowledge_bast);
        setMyPendingReviews(pending);
        if (pending.length > 0) setTimeout(() => setShowNotificationPopup(true), 800);
      }

      // Notif untuk Team: form review milik mereka yang BELUM diisi guest
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

  // CRUD

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
      const compressed = await compressImage(fotoFile);
      const ext = compressed.name.split('.').pop();
      const fileName = `review_foto_${editingReview.id}_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('review-photos')
        .upload(fileName, compressed, { upsert: true, cacheControl: '31536000' });
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

    /*
      Kabar bahwa review sudah masuk.

      Sebelum ini pengisian review TIDAK mengabari siapa pun - tidak WA,
      tidak Telegram, tidak badge in-app. Padahal isinya penilaian atas
      pekerjaan seorang anggota tim (dan ikut terbaca di KPI): yang dinilai
      tidak pernah tahu penilaiannya sudah masuk, dan admin tidak tahu
      review yang ditunggu sudah lengkap.
    */
    try {
      const penerima = new Map<string, { id: string; full_name: string; phone_number: string | null }>();
      if (editingReview.assigned_to) {
        const { data: penangan } = await supabase.from('users')
          .select('id, full_name, phone_number').eq('username', editingReview.assigned_to).maybeSingle();
        if (penangan) penerima.set(penangan.id, penangan);
      }
      for (const a of await penerimaAdminBernomor()) {
        penerima.set(a.id, { id: a.id, full_name: a.full_name, phone_number: a.phone_number });
      }

      const pesan = [
        '📝 *FORM REVIEW SUDAH DIISI*',
        '━━━━━━━━━━━━━━━━━━',
        `📌 *Project :* ${editingReview.project_name}`,
        `👤 *Diisi   :* ${currentUser?.full_name || editingReview.guest_username || '-'}`,
        `🙋 *Ditangani:* ${editingReview.assign_name || '-'}`,
        '━━━━━━━━━━━━━━━━━━',
        'Hasil penilaian sudah bisa dilihat di menu Form Review.',
        `🔗 ${appLink()}`,
      ].join('\n');

      for (const u of penerima.values()) {
        //  sendWANotif mengirim ke WhatsApp DAN Telegram sekaligus.
        if (u.phone_number) void sendWANotif({ type: 'reminder_wa', target: u.phone_number, message: pesan });
        void createNotification({
          user_id: u.id, type: 'system',
          title: '📝 Form Review sudah diisi',
          body: `${editingReview.project_name} — ${editingReview.assign_name || ''}`.trim(),
          action_url: '/form-review', ref_id: editingReview.id,
          created_by: currentUser?.full_name ?? '',
        });
      }
    } catch { /* kabar gagal tidak boleh membatalkan review yang sudah tersimpan */ }
    void logAudit({ user_id: currentUser?.id ?? '', user_name: currentUser?.username ?? '', action: 'update', module: 'form-review', target_id: editingReview.id, target_name: editingReview.project_name, notes: `Grade ${editingReview.review_category}` });
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
    void logAudit({ user_id: currentUser?.id ?? '', user_name: currentUser?.username ?? '', action: 'delete', module: 'form-review', target_id: deleteTarget.id, target_name: deleteTarget.project_name });
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

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (!isAdmin) { notify('error', 'Hanya admin yang bisa menghapus data.'); return; }
    setConfirmState({ message: `Hapus ${selectedIds.size} review terpilih?`, danger: true, confirmLabel: 'Hapus', onConfirm: async () => {
      setBulkDeleting(true);
      const { error } = await supabase.from('form_reviews').delete().in('id', Array.from(selectedIds));
      if (!error) {
        void logAudit({ user_id: currentUser?.id ?? '', user_name: currentUser?.username ?? '', action: 'delete', module: 'form-review', notes: `Bulk delete ${selectedIds.size} reviews` });
        setReviews(p => p.filter(r => !selectedIds.has(r.id))); setSelectedIds(new Set());
      } else notify('error', 'Gagal hapus: ' + error.message);
      setBulkDeleting(false);
    }});
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

  // Login

  const handleLogout = () => {
    setSelectMode(false); setSelectedIds(new Set()); setFilterCategory('all'); setFilterReviewCat('all');
    setSearchProject(''); setSearchHandler(''); setSearchSalesName('');
    setHandlerFilter(null); setProductFilterChart(null); setSalesDivisionFilter(null);
    clearSession();
    setCurrentUser(null);
    const target = window.top !== window ? window.top : window;
    if (target) target.location.href = '/dashboard';
  };

  // Filters

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

  /*
    Paginasi mengikuti tab yang sedang aktif (Demo Product / BAST) - keduanya
    daftar terpisah, jadi berpindah tab memang seharusnya memulai lagi dari
    halaman 1. Itu terjadi sendirinya lewat pengaman "halaman melebihi total"
    di usePaginasi ketika jumlah barisnya berbeda; kalau kebetulan sama
    persis, halamannya bertahan dan itu juga masuk akal.
  */
  const hal = usePaginasi(tableReviews);

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
      (currentUser.role === 'guest' && !isPimpinan(currentUser) && (
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

  // Loading awal - tampilkan sebelum data siap (sesuai role)
  if (!appReady) return <LoadingScreen message={loadingMessage} accentColor="#7c3aed" />;

  if (dashLoading) return <LoadingScreen message="Memuat data..." accentColor="#7c3aed" />;

  // Main Render

  return (
    <div className="h-screen overflow-hidden flex flex-col relative" style={{
      background: 'var(--latar-halaman)',
      backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed',
    }}>
      <ConfirmDialog state={confirmState} onCancel={() => setConfirmState(null)} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(255,255,255,0.08)' }} />
      {/* TANPA z-index — disengaja. `relative z-10` di sini dulu membentuk
          stacking context, sehingga z-index SEMUA modal di dalamnya cuma
          dibandingkan sesama isi pembungkus ini, bukan dengan overlay yang
          di-portal ke <body>. Akibatnya modal z-[1100] bisa tampil DI BELAKANG
          modal z-[1000] yang di-portal. Urutan cat terhadap tint di atas tetap
          aman karena elemen ini datang belakangan di DOM. */}
      <div className="relative flex flex-col flex-1 overflow-hidden">

        {/* Toast */}
        <Toast notif={toast} />

        {/* ── DELETE MODAL ── */}
        <ModalHapusReview
          deleteConfirmText={deleteConfirmText} deleteTarget={deleteTarget} handleDelete={handleDelete} setDeleteConfirmText={setDeleteConfirmText} setDeleteTarget={setDeleteTarget} setShowDeleteModal={setShowDeleteModal} showDeleteModal={showDeleteModal}
        />

        {/* ── FORM MODAL (Edit/View Review) ── */}
        <ModalFormReview
          editingReview={editingReview} emptyReviewForm={emptyReviewForm} fotoPreview={fotoPreview} fotoRef={fotoRef} handleSaveReview={handleSaveReview} inputCls={inputCls} inputStyle={inputStyle} reviewFormData={reviewFormData} rfd={rfd} saving={saving} setEditingReview={setEditingReview} setFotoFile={setFotoFile} setFotoPreview={setFotoPreview} setReviewFormData={setReviewFormData} setShowFormModal={setShowFormModal} showFormModal={showFormModal}
        />

        {/* ── DETAIL MODAL ── */}
        <ModalDetailReview
          bolehEditReview={bolehEditReview} detailReview={detailReview} isAdmin={isAdmin} openDeleteModal={openDeleteModal} openEdit={openEdit} setDetailReview={setDetailReview}
        />

        {/* ── NOTIFICATION POPUP ── */}
        <PopupNotifikasiReview
          isTeam={isTeam} myPendingReviews={myPendingReviews} setDetailReview={setDetailReview} setShowNotificationPopup={setShowNotificationPopup} showNotificationPopup={showNotificationPopup}
        />

        {/* ── BELL POPUP ── */}
        <PopupLonceng
          isTeam={isTeam} myActivePendingReviews={myActivePendingReviews} setDetailReview={setDetailReview} setShowBellPopup={setShowBellPopup} showBellPopup={showBellPopup}
        />

        {/* ── HEADER ── */}
        <div className="sticky top-0 z-50 animate-slide-down anim-d0"
          style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', boxShadow: 'inset 0 2px 0 #b45309' }}>
          {/* Loading Bar */}
          {loadingBar > 0 && (
            <div className="absolute top-0 left-0 w-full h-0.5 z-[60] overflow-hidden" style={{ background: 'rgba(217,119,6,0.15)' }}>
              <div
                className="h-full transition-all duration-300 ease-out"
                style={{
                  width: `${loadingBar}%`,
                  background: 'linear-gradient(90deg,#d97706,#fbbf24,#d97706)',
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
            {/* Disamakan dengan PageHeader modul lain: ubin ikon lembut + judul tinta. */}
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: '#b4530914', color: '#b45309', border: '1px solid #b4530926' }}>
              <Ikon nama="⭐" ukuran={18} />
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight tracking-tight text-slate-900">Form Review Demo &amp; BAST</h1>
              <p className="text-[11px] font-medium text-slate-600">Penilaian pelanggan untuk demo & serah terima</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Bell */}
            <button type="button" onClick={() => setShowBellPopup(true)} aria-label="Notifikasi form review"
              className="relative p-2 rounded-xl transition-all hover:bg-amber-50 border-2 border-transparent hover:border-amber-200">
              <svg aria-hidden="true" focusable="false" className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {myActivePendingReviews.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 animate-slide-up anim-d80">
            {[
              { label: 'Total Review', value: reviews.length, sub: 'Semua form review', accent: '#4f46e5',
                onClick: () => { setFilterReviewCat('all'); setHandlerFilter(null); setProductFilterChart(null); },
                active: filterReviewCat === 'all' && !handlerFilter && !productFilterChart },
              { label: 'Demo Product', value: totalDemo, sub: 'Review demo unit', accent: '#6d28d9',
                onClick: () => setFilterReviewCat(filterReviewCat === 'Demo Product' ? 'all' : 'Demo Product'),
                active: filterReviewCat === 'Demo Product' },
              { label: 'Belum Diisi', value: reviews.filter(r => !r.grade_product_knowledge && !r.grade_product_knowledge_bast).length, sub: 'Menunggu input guest', accent: '#b45309' },
              { label: 'Sudah Diisi', value: reviews.filter(r => r.grade_product_knowledge || r.grade_product_knowledge_bast).length, sub: 'Review terselesaikan', accent: '#047857' },
            ].map((card, i) => <StatCard key={i} {...card} />)}
          </div>

          {/* Mini Pie Charts */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 sm:gap-4 animate-zoom-in anim-d160">
            <MiniPieChart data={categoryPieData} title="Kategori Kegiatan" icon="📋"
              activeFilter={filterReviewCat !== 'all' ? filterReviewCat : null}
              onSliceClick={label => setFilterReviewCat(prev => (prev === label ? 'all' : label as any))} />
            <MiniPieChart data={salesDivisionPieData} title="Divisi Sales" icon="👤"
              activeFilter={salesDivisionFilter}
              onSliceClick={label => setSalesDivisionFilter(prev => prev === label ? null : label)} />
            <MiniPieChart data={handlerPieData} title="Handler Team PTS IVP" icon="👥"
              activeFilter={handlerFilter}
              onSliceClick={label => setHandlerFilter(prev => prev === label ? null : label)} />
            <MiniPieChart data={productPieData} title="Product" icon="📦"
              activeFilter={productFilterChart}
              onSliceClick={label => setProductFilterChart(prev => prev === label ? null : label)} />
          </div>

          {/* Table */}
          <div className="rounded-2xl overflow-hidden animate-slide-up anim-d320" style={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(200,200,200,0.6)', backdropFilter: 'blur(12px)' }}>
            {/* Table Header */}
            <div className="flex flex-wrap items-center justify-between px-3 py-2 sm:px-5 sm:py-3.5 border-b border-gray-100">
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
                  <svg aria-hidden="true" focusable="false" className={`w-3.5 h-3.5 ${listLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  Refresh
                </button>
              </div>
            </div>

            {/* Filter Bar — sama persis dengan Reminder Schedule */}
            <div className="px-3 py-2 sm:px-5 sm:py-3 flex flex-wrap gap-1.5 sm:gap-3 items-end border-b border-gray-100" style={{ background: 'rgba(255,255,255,0.97)' }}>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 sm:mb-1"><IkonTeks nama="🔍" />Cari Project / Lokasi</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-[11px]"><Ikon nama="🔍" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                  <input aria-label="Search project / lokasi..." value={searchProject} onChange={e => setSearchProject(e.target.value)}
                    className="w-full rounded-lg pl-7 pr-3 py-1 sm:py-1.5 text-xs outline-none bg-gray-50 border border-gray-200 focus:bg-white focus:border-violet-300 transition-all"
                    placeholder="Cari project / lokasi..." style={{ minWidth: 180 }} />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 sm:mb-1"><IkonTeks nama="👤" />Sales Name</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-[11px]"><Ikon nama="👤" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                  <input aria-label="Search sales..." value={searchSalesName} onChange={e => setSearchSalesName(e.target.value)}
                    className="w-full rounded-lg pl-7 pr-3 py-1 sm:py-1.5 text-xs outline-none bg-gray-50 border border-gray-200 focus:bg-white focus:border-violet-300 transition-all"
                    placeholder="Cari sales..." />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 sm:mb-1">Team Handler</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-[11px]"><Ikon nama="👷" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                  <input aria-label="Search handler..." value={searchHandler} onChange={e => setSearchHandler(e.target.value)}
                    className="w-full rounded-lg pl-7 pr-3 py-1 sm:py-1.5 text-xs outline-none bg-gray-50 border border-gray-200 focus:bg-white focus:border-violet-300 transition-all"
                    placeholder="Cari handler..." />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 sm:mb-1">Kategori</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-[11px]"><Ikon nama="📋" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                  <select aria-label="Semua Kategori" value={filterReviewCat} onChange={e => setFilterReviewCat(e.target.value as any)}
                    className="w-full rounded-lg pl-7 pr-3 py-1 sm:py-1.5 text-xs outline-none bg-gray-50 border border-gray-200 focus:bg-white focus:border-violet-300 appearance-none cursor-pointer transition-all">
                    <option value="all">Semua Kategori</option>
                    <option value="Demo Product">Demo Product</option>
                    <option value="BAST">BAST</option>
                  </select>
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 text-[11px] pointer-events-none">▼</span>
                </div>
              </div>
            </div>
            {/* Bulk delete bar — admin only, selectMode only */}
            {selectMode && isAdmin && selectedIds.size > 0 && (
              <div className="px-3 py-1.5 sm:px-5 sm:py-2.5 flex items-center justify-between border-b border-gray-200" style={{ background: 'rgba(124,58,237,0.07)' }}>
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
              <div className="px-3 py-1.5 sm:px-5 sm:py-2.5 border-b border-gray-100 flex flex-wrap gap-1.5 sm:gap-2 items-center" style={{ background: 'rgba(255,255,255,0.97)' }}>
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Filter Aktif:</span>
                {filterReviewCat !== 'all' && (
                  <button onClick={() => setFilterReviewCat('all')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#7c3aed' }}><Ikon nama="📋" ukuran="1em" className="inline-block align-[-0.12em]" /> {filterReviewCat} ✕</button>
                )}
                {salesDivisionFilter && (
                  <button onClick={() => setSalesDivisionFilter(null)} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#ec4899' }}><Ikon nama="👤" ukuran="1em" className="inline-block align-[-0.12em]" /> {salesDivisionFilter} ✕</button>
                )}
                {handlerFilter && (
                  <button onClick={() => setHandlerFilter(null)} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#7c3aed' }}><Ikon nama="👷" ukuran="1em" className="inline-block align-[-0.12em]" /> {handlerFilter} ✕</button>
                )}
                {productFilterChart && (
                  <button onClick={() => setProductFilterChart(null)} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#6366f1' }}><Ikon nama="📦" ukuran="1em" className="inline-block align-[-0.12em]" /> {productFilterChart} ✕</button>
                )}
                {searchProject && (
                  <button onClick={() => setSearchProject('')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#475569' }}><Ikon nama="🔍" ukuran="1em" className="inline-block align-[-0.12em]" /> {searchProject} ✕</button>
                )}
                {searchSalesName && (
                  <button onClick={() => setSearchSalesName('')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#475569' }}><Ikon nama="👤" ukuran="1em" className="inline-block align-[-0.12em]" /> {searchSalesName} ✕</button>
                )}
                {searchHandler && (
                  <button onClick={() => setSearchHandler('')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#475569' }}><Ikon nama="👷" ukuran="1em" className="inline-block align-[-0.12em]" /> {searchHandler} ✕</button>
                )}
                <button onClick={() => { setFilterReviewCat('all'); setSalesDivisionFilter(null); setHandlerFilter(null); setProductFilterChart(null); setSearchProject(''); setSearchSalesName(''); setSearchHandler(''); }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all hover:opacity-80" style={{ background: 'rgba(220,38,38,0.12)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.25)' }}><IkonTeks nama="🗑" />Reset Semua</button>
              </div>
            )}

            <DaftarReview
              bolehEditReview={bolehEditReview} fetchError={fetchError} fetchReviews={fetchReviews} filterCategory={filterCategory} filterReviewCat={filterReviewCat} filteredReviews={filteredReviews} hal={hal} isAdmin={isAdmin} listLoading={listLoading} openDeleteModal={openDeleteModal} openEdit={openEdit} reviews={reviews} searchHandler={searchHandler} searchProject={searchProject} searchSalesName={searchSalesName} selectMode={selectMode} selectedIds={selectedIds} setDetailReview={setDetailReview} setFetchError={setFetchError} setFilterCategory={setFilterCategory} setFilterReviewCat={setFilterReviewCat} setSearchHandler={setSearchHandler} setSearchProject={setSearchProject} setSearchSalesName={setSearchSalesName} switchTab={switchTab} tableReviews={tableReviews} toggleSelectAll={toggleSelectAll} toggleSelectId={toggleSelectId}
            />
          </div>
        </div>

      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity:0; transform:translateY(14px); }
          to   { opacity:1; transform: none; }
        }
        @keyframes scale-in {
          from { opacity:0; transform:scale(0.92); }
          to   { opacity:1; transform: none; }
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
      <ModalPortal>
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border-2 border-red-400">
            <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 flex items-center gap-3">
              <span className="text-2xl"><Ikon nama="🗑" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
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
                  <IkonTeks nama="🗑" />Ya, Hapus Permanen
                </button>
              </div>
            </div>
          </div>
        </div>
      </ModalPortal>
      )}
    </div>
  );
}
