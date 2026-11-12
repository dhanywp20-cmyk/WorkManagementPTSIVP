'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { isPimpinan } from '@/lib/pimpinan';
import { clearSession, getSession } from '@/lib/auth/sesi';
import { sendWANotif } from '@/lib/wa/inti';
import { createNotification } from '@/lib/notifications';
import { penerimaAdminBernomor } from '@/lib/penerima-admin';
import { logAudit } from '@/lib/audit';
import { compressImage } from '@/lib/image-compress';
import { hasFullAccess } from '@/lib/constants';
import { appLink } from '@/lib/app-url';
import { ReviewForm, GuestUser } from './shared';
import { usePaginasi, type ConfirmState } from '@/components/shared';
import { hitungPieReview } from './hitung-pie-review';

export function useFormReview() {
  const searchParams = useSearchParams();

  const [currentUser, setCurrentUser] = useState<GuestUser | null>(null);
  const [dashLoading, ] = useState(false);
  const [appReady, setAppReady] = useState(false);
  const [loadingBar, setLoadingBar] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Loading...');

  const [reviews, setReviews] = useState<ReviewForm[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string|null>(null);
  const [saving, setSaving] = useState(false);

  const [showNotificationPopup, setShowNotificationPopup] = useState(false);
  const [showBellPopup, setShowBellPopup] = useState(false);
  const [myPendingReviews, setMyPendingReviews] = useState<ReviewForm[]>([]);

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

  const [switchTab, setSwitchTab] = useState<'Demo Product' | 'BAST'>('Demo Product');

  const [detailReview, setDetailReview] = useState<ReviewForm | null>(null);
  const [editingReview, setEditingReview] = useState<ReviewForm | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ReviewForm | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

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

  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const notify = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const rfd = (patch: Partial<typeof emptyReviewForm>) =>
    setReviewFormData(prev => ({ ...prev, ...patch }));

  const isAdmin = hasFullAccess(currentUser);
  const isTeam = currentUser?.role === 'team';

  const bolehEditReview = (r: ReviewForm): boolean =>
    !isPimpinan(currentUser) && (isAdmin
    || (!!currentUser?.username && r.guest_username === currentUser.username)
    || (!!currentUser?.full_name && r.sales_name === currentUser.full_name)
    || (!!currentUser?.username && r.assigned_to === currentUser.username));

  useEffect(() => {
    const user = getSession<GuestUser>();
    if (!user) {
      const target = window.top !== window ? window.top : window;
      if (target) target.location.href = '/dashboard';
      return;
    }
    setCurrentUser(user);

    if (user?.role === 'guest') setLoadingMessage('Memuat form review Anda...');
    else if (user?.role === 'team') setLoadingMessage('Memuat jadwal review tim...');
    else if (user?.role === 'admin') setLoadingMessage('Memuat semua data review...');
    else setLoadingMessage('Loading Form Review...');

    setLoadingBar(20);
    const t1 = setTimeout(() => setLoadingBar(60), 200);
    const t2 = setTimeout(() => setLoadingBar(85), 500);

    fetchReviewsQuiet(user).then(() => {
      setLoadingBar(100);
      setTimeout(() => { setLoadingBar(0); setAppReady(true); }, 300);
    });

    const ch = supabase.channel('form-reviews-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'form_reviews' }, () => {
        const u = getSession<GuestUser>() ?? user;
        fetchReviewsQuiet(u);
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); clearTimeout(t1); clearTimeout(t2); };
  }, []);

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

  const fetchReviewsQuiet = async (user?: GuestUser | null) => {
    let activeUser: GuestUser | null = user ?? currentUser;
    if (!activeUser) activeUser = getSession<GuestUser>();

    const kolomReview = 'id,reminder_id,project_name,address,sales_name,sales_division,assign_name,\
assigned_to,reminder_category,review_category,product_demo,grade_product_knowledge,catatan_grade_product_knowledge,product_bast,\
grade_training_customer,catatan_grade_training_customer,grade_product_knowledge_bast,catatan_grade_product_knowledge_bast,foto_dokumentasi_url,guest_username,created_at,\
updated_at';
    let query = supabase.from('form_reviews').select(kolomReview).order('created_at', { ascending: false }).limit(500);

    if (activeUser?.role === 'guest' && !isPimpinan(activeUser)) {
      query = query.or(
        `guest_username.eq.${activeUser.username},sales_name.eq.${activeUser.full_name}`
      );
    }
    else if (activeUser?.role === 'team' && !hasFullAccess(activeUser)) {
      query = query.eq('assigned_to', activeUser.username);
    }

    const { data, error } = await query;
    if (error) { setFetchError(error.message); return; }
    if (data) {
      setReviews(data as ReviewForm[]);

      if (activeUser?.role === 'guest' && !isPimpinan(activeUser)) {
        const pending = (data as ReviewForm[]).filter(r => !r.grade_product_knowledge && !r.grade_product_knowledge_bast);
        setMyPendingReviews(pending);
        if (pending.length > 0) setTimeout(() => setShowNotificationPopup(true), 800);
      }

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
        .upload(fileName, compressed, { upsert: false, cacheControl: '31536000' });
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
        if (u.phone_number) void sendWANotif({ type: 'reminder_wa', target: u.phone_number, message: pesan });
        void createNotification({
          user_id: u.id, type: 'system',
          title: '📝 Form Review sudah diisi',
          body: `${editingReview.project_name} — ${editingReview.assign_name || ''}`.trim(),
          action_url: '/form-review', ref_id: editingReview.id,
          created_by: currentUser?.full_name ?? '',
        });
      }
    } catch {  }
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

  const demoReviews = filteredReviews.filter(r => r.review_category === 'Demo Product');
  const bastReviews = filteredReviews.filter(r => r.review_category === 'BAST');
  const tableReviews = switchTab === 'Demo Product' ? demoReviews : bastReviews;

  const hal = usePaginasi(tableReviews);

  const totalDemo = reviews.filter(r => r.review_category === 'Demo Product').length;

  const { categoryPieData, salesDivisionPieData, handlerPieData, productPieData } = hitungPieReview(reviews);

  const myActivePendingReviews = reviews.filter(r =>
    currentUser && (
      (currentUser.role === 'guest' && !isPimpinan(currentUser) && (
        r.guest_username === currentUser.username ||
        r.sales_name === currentUser.full_name
      )) ||
      (currentUser.role === 'team' && r.assigned_to === currentUser.username)
    ) &&
    !r.grade_product_knowledge && !r.grade_product_knowledge_bast
  );

  const inputCls = "w-full rounded-xl px-4 py-3 text-sm outline-hidden transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-violet-500/40" as const;
  const inputStyle = { background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(0,0,0,0.12)' };
  return {
    appReady, loadingMessage, dashLoading, confirmState, setConfirmState, toast, deleteConfirmText, deleteTarget,
    handleDelete, setDeleteConfirmText, setDeleteTarget, setShowDeleteModal, showDeleteModal, editingReview, emptyReviewForm, fotoPreview,
    fotoRef, handleSaveReview, inputCls, inputStyle, reviewFormData, rfd, saving, setEditingReview,
    setFotoFile, setFotoPreview, setReviewFormData, setShowFormModal, showFormModal, bolehEditReview, detailReview, isAdmin,
    openDeleteModal, openEdit, setDetailReview, isTeam, myPendingReviews, setShowNotificationPopup, showNotificationPopup, myActivePendingReviews,
    setShowBellPopup, showBellPopup, loadingBar, reviews, setFilterReviewCat, setHandlerFilter, setProductFilterChart, filterReviewCat,
    handlerFilter, productFilterChart, totalDemo, categoryPieData, salesDivisionPieData, salesDivisionFilter, setSalesDivisionFilter, handlerPieData,
    productPieData, tableReviews, setSwitchTab, switchTab, setSelectMode, setSelectedIds, selectMode, fetchReviews,
    listLoading, searchProject, setSearchProject, searchSalesName, setSearchSalesName, searchHandler, setSearchHandler, selectedIds,
    setBulkConfirm, bulkDeleting, fetchError, filterCategory, filteredReviews, hal, setFetchError, setFilterCategory,
    toggleSelectAll, toggleSelectId, bulkConfirm, setBulkDeleting, setReviews, currentUser, notify,
  };
}
