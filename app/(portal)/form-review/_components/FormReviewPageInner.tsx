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
import { LoadingScreen, MiniPieChart, usePaginasi, ConfirmDialog, type ConfirmState, StatCard } from '@/components/shared';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { Toast } from '@/components/shared/Toast';
import { PopupLonceng } from './PopupLonceng';
import { PopupNotifikasiReview } from './PopupNotifikasiReview';
import { ModalDetailReview } from './ModalDetailReview';
import { ModalFormReview } from './ModalFormReview';
import { ModalHapusReview } from './ModalHapusReview';
import { DaftarReview } from './DaftarReview';
import { KonteksDaftarReview } from './konteks-daftar-review';
import { GayaReview } from './GayaReview';
import { KepalaReview } from './KepalaReview';
import { hitungPieReview } from './hitung-pie-review';
import { ModalHapusMassalReview } from './ModalHapusMassalReview';

export function FormReviewPageInner() {
  const searchParams = useSearchParams();

  const [currentUser, setCurrentUser] = useState<GuestUser | null>(null);
  const [dashLoading, setDashLoading] = useState(false);
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

    let query = supabase.from('form_reviews').select('id,reminder_id,project_name,address,sales_name,sales_division,assign_name,assigned_to,reminder_category,review_category,product_demo,grade_product_knowledge,catatan_grade_product_knowledge,product_bast,grade_training_customer,catatan_grade_training_customer,grade_product_knowledge_bast,catatan_grade_product_knowledge_bast,foto_dokumentasi_url,guest_username,created_at,updated_at').order('created_at', { ascending: false }).limit(500);

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

  const inputCls = "w-full rounded-xl px-4 py-3 text-sm outline-hidden transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-violet-500/40";
  const inputStyle = { background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(0,0,0,0.12)' };

  if (!appReady) return <LoadingScreen message={loadingMessage} accentColor="#7c3aed" />;

  if (dashLoading) return <LoadingScreen message="Memuat data..." accentColor="#7c3aed" />;

  return (
    <div className="h-screen overflow-hidden flex flex-col relative" style={{
      background: 'var(--latar-halaman)',
      backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed',
    }}>
      <ConfirmDialog state={confirmState} onCancel={() => setConfirmState(null)} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(255,255,255,0.08)' }} />
      <div className="relative flex flex-col flex-1 overflow-hidden">

        <Toast notif={toast} />

        <ModalHapusReview
          deleteConfirmText={deleteConfirmText} deleteTarget={deleteTarget} handleDelete={handleDelete} setDeleteConfirmText={setDeleteConfirmText} setDeleteTarget={setDeleteTarget} setShowDeleteModal={setShowDeleteModal} showDeleteModal={showDeleteModal}
        />

        <ModalFormReview
          editingReview={editingReview} emptyReviewForm={emptyReviewForm} fotoPreview={fotoPreview} fotoRef={fotoRef} handleSaveReview={handleSaveReview} inputCls={inputCls} inputStyle={inputStyle} reviewFormData={reviewFormData} rfd={rfd} saving={saving} setEditingReview={setEditingReview} setFotoFile={setFotoFile} setFotoPreview={setFotoPreview} setReviewFormData={setReviewFormData} setShowFormModal={setShowFormModal} showFormModal={showFormModal}
        />

        <ModalDetailReview
          bolehEditReview={bolehEditReview} detailReview={detailReview} isAdmin={isAdmin} openDeleteModal={openDeleteModal} openEdit={openEdit} setDetailReview={setDetailReview}
        />

        <PopupNotifikasiReview
          isTeam={isTeam} myPendingReviews={myPendingReviews} setDetailReview={setDetailReview} setShowNotificationPopup={setShowNotificationPopup} showNotificationPopup={showNotificationPopup}
        />

        <PopupLonceng
          isTeam={isTeam} myActivePendingReviews={myActivePendingReviews} setDetailReview={setDetailReview} setShowBellPopup={setShowBellPopup} showBellPopup={showBellPopup}
        />

        <KepalaReview loadingBar={loadingBar} setShowBellPopup={setShowBellPopup} jumlahAktif={myActivePendingReviews.length} />

        <div className="flex-1 overflow-y-auto p-5 space-y-5">

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

          <div className="rounded-2xl overflow-hidden animate-slide-up anim-d320" style={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(200,200,200,0.6)', backdropFilter: 'blur(12px)' }}>
            <div className="flex flex-wrap items-center justify-between px-3 py-2 sm:px-5 sm:py-3.5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Review List</span>
                <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2.5 py-1 rounded-full">{tableReviews.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex rounded-xl overflow-hidden" style={{ border: '1.5px solid rgba(124,58,237,0.25)' }}>
                  {(['Demo Product', 'BAST'] as const).map(tab => (
                    <button key={tab} onClick={() => setSwitchTab(tab)}
                      className="px-4 py-2 text-xs font-bold transition-all"
                      style={switchTab === tab
                        ? { background: 'linear-gradient(135deg, var(--merek-utama), var(--merek-utama-2))', color: 'white' }
                        : { background: 'transparent', color: 'var(--merek-utama)' }}>
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

            <div className="px-3 py-2 sm:px-5 sm:py-3 flex flex-wrap gap-1.5 sm:gap-3 items-end border-b border-gray-100" style={{ background: 'rgba(255,255,255,0.97)' }}>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 sm:mb-1"><IkonTeks nama="🔍" />Cari Project / Lokasi</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-[11px]"><Ikon nama="🔍" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                  <input aria-label="Search project / lokasi..." value={searchProject} onChange={e => setSearchProject(e.target.value)}
                    className="w-full rounded-lg pl-7 pr-3 py-1 sm:py-1.5 text-xs outline-hidden bg-gray-50 border border-gray-200 focus:bg-white focus:border-violet-300 transition-all"
                    placeholder="Cari project / lokasi..." style={{ minWidth: 180 }} />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 sm:mb-1"><IkonTeks nama="👤" />Sales Name</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-[11px]"><Ikon nama="👤" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                  <input aria-label="Search sales..." value={searchSalesName} onChange={e => setSearchSalesName(e.target.value)}
                    className="w-full rounded-lg pl-7 pr-3 py-1 sm:py-1.5 text-xs outline-hidden bg-gray-50 border border-gray-200 focus:bg-white focus:border-violet-300 transition-all"
                    placeholder="Cari sales..." />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 sm:mb-1">Team Handler</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-[11px]"><Ikon nama="👷" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                  <input aria-label="Search handler..." value={searchHandler} onChange={e => setSearchHandler(e.target.value)}
                    className="w-full rounded-lg pl-7 pr-3 py-1 sm:py-1.5 text-xs outline-hidden bg-gray-50 border border-gray-200 focus:bg-white focus:border-violet-300 transition-all"
                    placeholder="Cari handler..." />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 sm:mb-1">Kategori</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-[11px]"><Ikon nama="📋" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                  <select aria-label="Semua Kategori" value={filterReviewCat} onChange={e => setFilterReviewCat(e.target.value as any)}
                    className="w-full rounded-lg pl-7 pr-3 py-1 sm:py-1.5 text-xs outline-hidden bg-gray-50 border border-gray-200 focus:bg-white focus:border-violet-300 appearance-none cursor-pointer transition-all">
                    <option value="all">Semua Kategori</option>
                    <option value="Demo Product">Demo Product</option>
                    <option value="BAST">BAST</option>
                  </select>
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 text-[11px] pointer-events-none">▼</span>
                </div>
              </div>
            </div>
            {selectMode && isAdmin && selectedIds.size > 0 && (
              <div className="px-3 py-1.5 sm:px-5 sm:py-2.5 flex items-center justify-between border-b border-gray-200" style={{ background: 'rgba(124,58,237,0.07)' }}>
                <span className="text-sm font-bold text-violet-700">{selectedIds.size} review dipilih</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-500 px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50">Batal Pilih</button>
                  <button onClick={() => setBulkConfirm(true)} disabled={bulkDeleting}
                    className="tombol-utama text-xs font-bold  px-4 py-1.5 rounded-kontrol disabled:opacity-50 flex items-center gap-1">
                    {bulkDeleting ? '⏳ Menghapus...' : `🗑️ Hapus ${selectedIds.size}`}
                  </button>
                </div>
              </div>
            )}

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

            <KonteksDaftarReview.Provider value={{
              nilai: { fetchError, filterCategory, filterReviewCat, filteredReviews, hal, isAdmin, listLoading, reviews, searchHandler,
                searchProject, searchSalesName, selectMode, selectedIds, switchTab, tableReviews },
              ubah: { setDetailReview, setFetchError, setFilterCategory, setFilterReviewCat, setSearchHandler, setSearchProject, setSearchSalesName },
              aksi: { bolehEditReview, fetchReviews, openDeleteModal, openEdit, toggleSelectAll, toggleSelectId },
            }}>
              <DaftarReview />
            </KonteksDaftarReview.Provider>
          </div>
        </div>

      </div>

      <GayaReview />
      {bulkConfirm && (
        <ModalHapusMassalReview selectedIds={selectedIds} setSelectedIds={setSelectedIds} setBulkConfirm={setBulkConfirm} setBulkDeleting={setBulkDeleting}
          setSelectMode={setSelectMode} setReviews={setReviews} currentUser={currentUser} notify={notify} />
      )}
    </div>
  );
}
