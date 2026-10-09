'use client';
import { TombolEkspor } from '@/components/shared/TombolEkspor';
import type { Ekspor } from '@/lib/ekspor-tabel';

/** DaftarReview - dipecah dari app/(portal)/form-review/_components/FormReviewPageInner.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { StarRating, ViewIconBtn, EditIconBtn, DeleteIconBtn, ActionGroup, Paginasi, ErrorState, MobileListCard, MobileCardBadge, ListEmptyState } from '@/components/shared';
import { Ikon } from '@/components/shared/Ikon';
import { ReviewForm, formatDatetime } from './shared';
import { type CSSProperties } from 'react';

export interface DaftarReviewProps {
  bolehEditReview: (r: ReviewForm) => boolean;
  fetchError: string | null;
  fetchReviews: () => Promise<void>;
  filterCategory: "Demo Product" | "BAST" | "all";
  filterReviewCat: "Demo Product" | "BAST" | "all";
  filteredReviews: ReviewForm[];
  hal: import("@/components/shared/Paginasi").HasilPaginasi<ReviewForm>;
  isAdmin: boolean;
  listLoading: boolean;
  openDeleteModal: (r: ReviewForm) => void;
  openEdit: (r: ReviewForm) => void;
  reviews: ReviewForm[];
  searchHandler: string;
  searchProject: string;
  searchSalesName: string;
  selectMode: boolean;
  selectedIds: Set<string>;
  setDetailReview: import("react").Dispatch<import("react").SetStateAction<ReviewForm | null>>;
  setFetchError: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setFilterCategory: import("react").Dispatch<import("react").SetStateAction<"Demo Product" | "BAST" | "all">>;
  setFilterReviewCat: import("react").Dispatch<import("react").SetStateAction<"Demo Product" | "BAST" | "all">>;
  setSearchHandler: import("react").Dispatch<import("react").SetStateAction<string>>;
  setSearchProject: import("react").Dispatch<import("react").SetStateAction<string>>;
  setSearchSalesName: import("react").Dispatch<import("react").SetStateAction<string>>;
  switchTab: "Demo Product" | "BAST";
  tableReviews: ReviewForm[];
  toggleSelectAll: () => void;
  toggleSelectId: (id: string) => void;
}

export function DaftarReview({ bolehEditReview, fetchError, fetchReviews, filterCategory, filterReviewCat, filteredReviews, hal, isAdmin, listLoading, openDeleteModal, openEdit, reviews, searchHandler, searchProject, searchSalesName, selectMode, selectedIds, setDetailReview, setFetchError, setFilterCategory, setFilterReviewCat, setSearchHandler, setSearchProject, setSearchSalesName, switchTab, tableReviews, toggleSelectAll, toggleSelectId }: DaftarReviewProps) {
  return (
    <>
      {listLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'rgba(124,58,237,0.3)', borderTopColor: '#7c3aed' }} />
        </div>
      ) : fetchError ? (
        <ErrorState message={fetchError} onRetry={() => { setFetchError(null); fetchReviews(); }} />
      ) : tableReviews.length === 0 ? (
        <ListEmptyState
          adaFilterAktif={
            filterCategory !== 'all' || filterReviewCat !== 'all' ||
            [searchProject, searchHandler, searchSalesName].some(v => v.trim() !== '')
          }
          onReset={() => {
            setFilterCategory('all'); setFilterReviewCat('all');
            setSearchProject(''); setSearchHandler(''); setSearchSalesName('');
          }}
          icon="⭐"
          judulKosong={`Belum ada data ${switchTab}`}
          deskripsiKosong="Form review muncul otomatis dari Reminder Schedule yang sudah Solved."
        />
      ) : (
        <>
        {/* ── MOBILE: kartu (pola Ticket Troubleshooting) ── */}
        <div className="md:hidden bg-gray-50/70 p-1.5 space-y-1.5">
          {hal.potongan.map((r) => {
            const isDemo = r.review_category === 'Demo Product';
            const hasReview = isDemo ? !!r.grade_product_knowledge : !!(r.grade_training_customer && r.grade_product_knowledge_bast);
            const grade1 = isDemo ? r.grade_product_knowledge : r.grade_training_customer;
            return (
              <MobileListCard
                key={r.id}
                title={r.project_name || '—'}
                onClick={() => setDetailReview(r)}
                meta={<>
                  {r.address && <div className="truncate"><Ikon nama="📍" ukuran="1em" className="inline-block align-[-0.12em]" /> {r.address}</div>}
                  <div className="truncate">{r.reminder_category || '—'} · {r.created_at ? formatDatetime(r.created_at) : '—'}</div>
                </>}
                badges={<MobileCardBadge style={hasReview ? { background: '#d1fae5', color: '#065f46', border: '1px solid #10b981' } : { background: '#fef3c7', color: '#92400e', border: '1px solid #f59e0b' }}>{hasReview ? '✅ Terisi' : '⏳ Belum'}</MobileCardBadge>}
                fields={[
                  { label: 'Sales', value: <>{r.sales_name || '—'}{r.sales_division ? <span className="text-purple-600 font-semibold"> · {r.sales_division}</span> : null}</> },
                  { label: 'Handler', value: r.assign_name || '—' },
                  { label: 'Product', value: (isDemo ? r.product_demo : r.product_bast) || '—', span2: true },
                  { label: isDemo ? 'Grade' : 'Training', value: grade1 ? <StarRating value={grade1} disabled /> : '—' },
                  { label: 'Prod. Knowledge', value: r.grade_product_knowledge_bast ? <StarRating value={r.grade_product_knowledge_bast} disabled /> : '—', hide: isDemo },
                ]}
                actions={<>
                  <ViewIconBtn onClick={() => setDetailReview(r)} label="Detail" />
                  {bolehEditReview(r) && <EditIconBtn onClick={() => openEdit(r)} label="Edit" />}
                  {isAdmin && <DeleteIconBtn onClick={() => openDeleteModal(r)} label="Hapus" />}
                </>}
              />
            );
          })}
          <Paginasi {...hal} satuan="review" />
        </div>

        {/* ── DESKTOP: tabel ── */}
        <div className="hidden md:block overflow-x-auto animate-zoom-in bg-slate-100/60 px-3 pb-2">
          <table className="w-full tabel-kartu" style={{ tableLayout: 'fixed', background: 'transparent', minWidth: '920px' }}>
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
              {/*  Piksel, bukan persen. Isi kolom ini tombol ikon
                  berukuran TETAP (32px + gap 4px), jadi persen adalah
                  satuan yang keliru: 7% dari 920px cuma ~64px, sementara
                  tiga tombol butuh 104px - dan makin lebar layarnya,
                  makin banyak ruang terbuang untuk isi yang ukurannya
                  tidak pernah berubah. */}
              <col style={{ width: '116px' }} />   {/* Action */}
            </colgroup>
            <thead>
              {/* Latar & garis bawah header diatur .tabel-kartu di globals.css. */}
              <tr>
                {['No', 'Project',  'Kategori', 'Sales', 'Handler',
                  switchTab === 'Demo Product' ? 'Product Demo' : 'Product BAST',
                  switchTab === 'Demo Product' ? 'Grade PK' : 'Grade Training',
                  switchTab === 'BAST' ? 'Grade PK' : null,
                  'Status', 'Action'].filter(Boolean).map((h, i, arr) => (
                  <th key={i} className={`px-3 py-2.5 text-[11px] font-bold text-gray-500 uppercase tracking-wide border-r border-gray-200 ${h === 'Action' || h === 'No' ? 'text-center' : 'text-left'}`}>
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
              {hal.potongan.map((r, idx) => {
                const isDemo = r.review_category === 'Demo Product';
                const hasReview = isDemo
                  ? !!r.grade_product_knowledge
                  : !!(r.grade_training_customer && r.grade_product_knowledge_bast);
                return (
                  <tr key={r.id}
                    onClick={() => setDetailReview(r)}
                    className="stagger-item cursor-pointer"
                    style={{ '--aksen-baris': '#c4b5fd', '--bg-baris-sorot': '#faf5ff' } as CSSProperties}
                    >
                    {/* No / Checkbox combined */}
                    <td className="px-3 py-3 border-r border-gray-200 align-middle text-center" onClick={e => e.stopPropagation()}>
                      {selectMode && isAdmin
                        ? <input type="checkbox" checked={selectedIds.has(r.id)}
                            onChange={() => toggleSelectId(r.id)} className="w-4 h-4 rounded accent-violet-600 cursor-pointer" />
                        : <span className="text-[11px] font-bold text-gray-500">{hal.mulai + idx + 1}</span>}
                    </td>
                    {/* Project */}
                    <td className="px-3 py-3 border-r border-gray-200 align-middle">
                      <div className="text-xs font-bold text-gray-800 leading-tight break-words">{r.project_name || '—'}</div>
                      {r.address && <div className="text-[11px] text-gray-500 truncate mt-0.5"><Ikon nama="📍" ukuran="1em" className="inline-block align-[-0.12em]" /> {r.address}</div>}
                      <div className="text-[11px] text-gray-500 mt-0.5">{r.created_at ? formatDatetime(r.created_at) : '—'}</div>
                    </td>
                    {/* Kategori */}
                    <td className="px-3 py-3 border-r border-gray-200 align-middle">
                      <div className="text-[12px] font-semibold text-violet-600 leading-tight">{r.reminder_category || '—'}</div>
                    </td>
                    {/* Sales */}
                    <td className="px-3 py-3 border-r border-gray-200 align-middle">
                      <div className="text-[12px] font-semibold text-gray-700 truncate max-w-[100px]">{r.sales_name || '—'}</div>
                      {r.sales_division && <div className="text-[11px] text-purple-600 font-semibold">{r.sales_division}</div>}
                    </td>
                    {/* Handler */}
                    <td className="px-3 py-3 border-r border-gray-200 align-middle">
                      <div className="flex items-center gap-1">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg,#7c3aed,#5b21b6)' }}>
                          {r.assign_name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <span className="text-[12px] font-bold text-gray-800 leading-tight break-words">{r.assign_name}</span>
                      </div>
                    </td>
                    {/* Product */}
                    <td className="px-3 py-3 border-r border-gray-200 align-middle">
                      <div className="text-[11px] font-semibold text-gray-700 leading-tight">
                        {isDemo ? (r.product_demo || '—') : (r.product_bast || '—')}
                      </div>
                    </td>
                    {/* Grade 1 */}
                    <td className="px-3 py-3 border-r border-gray-200 align-middle">
                      {isDemo
                        ? (r.grade_product_knowledge ? <StarRating value={r.grade_product_knowledge} disabled /> : <span className="text-gray-400 text-xs">—</span>)
                        : (r.grade_training_customer ? <StarRating value={r.grade_training_customer} disabled /> : <span className="text-gray-400 text-xs">—</span>)
                      }
                    </td>
                    {/* Grade 2 (BAST only) */}
                    {!isDemo && (
                      <td className="px-3 py-3 border-r border-gray-200 align-middle">
                        {r.grade_product_knowledge_bast ? <StarRating value={r.grade_product_knowledge_bast} disabled /> : <span className="text-gray-400 text-xs">—</span>}
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
                        {bolehEditReview(r) && (
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
            <span className="text-[11px] text-gray-500">{tableReviews.length} review ditemukan ({switchTab}) · dari {reviews.length} review keseluruhan</span>
            <TombolEkspor jumlah={tableReviews.length} data={() => dataEksporReview(tableReviews, switchTab, [['Project', searchProject], ['Teknisi', searchHandler], ['Sales', searchSalesName]])} />
          </div>
          <Paginasi {...hal} satuan="review" />
        </div>
        </>
      )}
    </>
  );
}

/** Rekap nilai review untuk Excel / cetak - kolom mengikuti tab (Demo Product / BAST). */
function dataEksporReview(baris: ReviewForm[], tab: string, filter: [string, string][]): Ekspor<ReviewForm> {
  const demo = tab === 'Demo Product';
  const umum: Ekspor<ReviewForm>['kolom'] = [
    { judul: 'Tanggal', ambil: r => formatDatetime(r.created_at) }, { judul: 'Project', ambil: r => r.project_name },
    { judul: 'Sales', ambil: r => [r.sales_name, r.sales_division].filter(Boolean).join(' · ') }, { judul: 'Engineer PTS', ambil: r => r.assign_name },
  ];
  return {
    judul: `Rekap Review ${tab}`, menu: 'Form Review Demo & BAST', warna: demo ? ['#7c3aed', '#5b21b6'] : ['#0ea5e9', '#0284c7'], baris, filter,
    kolom: demo
      ? [...umum, { judul: 'Produk demo', ambil: r => r.product_demo }, { judul: 'Product knowledge', ambil: r => r.grade_product_knowledge, angka: true },
        { judul: 'Catatan', ambil: r => r.catatan_grade_product_knowledge }]
      : [...umum, { judul: 'Produk', ambil: r => r.product_bast }, { judul: 'Training customer', ambil: r => r.grade_training_customer, angka: true },
        { judul: 'Product knowledge', ambil: r => r.grade_product_knowledge_bast, angka: true },
        { judul: 'Catatan', ambil: r => [r.catatan_grade_training_customer, r.catatan_grade_product_knowledge_bast].filter(Boolean).join(' · ') }],
  };
}
