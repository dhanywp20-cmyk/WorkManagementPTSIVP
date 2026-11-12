'use client';
import { LoadingScreen, MiniPieChart, ConfirmDialog, StatCard } from '@/components/shared';
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
import { ModalHapusMassalReview } from './ModalHapusMassalReview';
import { useFormReview } from './useFormReview';

export function FormReviewPageInner() {
  const {
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
  } = useFormReview();

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
