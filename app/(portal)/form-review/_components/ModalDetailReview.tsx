'use client';

/** ModalDetailReview - dipecah dari app/(portal)/form-review/_components/FormReviewPageInner.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { StarRating, ModalPortal } from '@/components/shared';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { ReviewForm, formatDatetime } from './shared';

export interface ModalDetailReviewProps {
  bolehEditReview: (r: ReviewForm) => boolean;
  detailReview: ReviewForm | null;
  isAdmin: boolean;
  openDeleteModal: (r: ReviewForm) => void;
  openEdit: (r: ReviewForm) => void;
  setDetailReview: import("react").Dispatch<import("react").SetStateAction<ReviewForm | null>>;
}

export function ModalDetailReview({ bolehEditReview, detailReview, isAdmin, openDeleteModal, openEdit, setDetailReview }: ModalDetailReviewProps) {
  return (
    <>
      {detailReview && (
      <ModalPortal>
        <div role="dialog" aria-modal="true" className="fixed inset-0 flex items-center justify-center z-1000 p-4" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setDetailReview(null); }}>
          <div className="bg-white rounded-kartu shadow-modal w-full max-w-2xl my-4 overflow-hidden flex flex-col"
            style={{ maxHeight: '96dvh' }}>

            {/* Header */}
            {/*  Kepala putih baku (sama dengan Modal bersama) - dulu ungu / biru menurut kategori. */}
            <div className="px-6 py-5 pr-12 shrink-0 relative border-b border-slate-100 bg-white">
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                  {detailReview.review_category}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                  <Ikon nama="📋" ukuran="1em" className="inline-block align-[-0.12em]" /> {detailReview.reminder_category}
                </span>
                {/* Status badge */}
                {(() => {
                  const hasReview = detailReview.review_category === 'Demo Product'
                    ? !!detailReview.grade_product_knowledge
                    : !!(detailReview.grade_training_customer && detailReview.grade_product_knowledge_bast);
                  return hasReview ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                      Sudah Diisi
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                      Belum Diisi
                    </span>
                  );
                })()}
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1 mb-0.5">Nama Project</p>
              <h2 className="text-lg font-bold text-slate-800 leading-tight">{detailReview.project_name || '—'}</h2>
              {detailReview.address && (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1.5 mb-0.5">Lokasi</p>
                  <p className="text-slate-600 text-sm flex items-center gap-1.5"><Ikon nama="📍" ukuran="1em" className="inline-block align-[-0.12em]" /> {detailReview.address}</p>
                </>
              )}
              <button aria-label="Tutup" onClick={() => setDetailReview(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-kecil flex items-center justify-center text-slate-500 hover:text-rose-600 bg-black/5 font-bold text-sm">✕</button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">

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
                    <p className="text-[10px] font-bold tracking-widest uppercase text-gray-500"><Ikon nama={item.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /> {item.label}</p>
                    <p className="text-sm font-bold text-gray-800 mt-0.5 wrap-break-word">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Demo Product review detail */}
              {detailReview.review_category === 'Demo Product' && (
                <div className="rounded-xl p-4 space-y-4" style={{ background: 'rgba(124,58,237,0.04)', border: '1.5px solid rgba(124,58,237,0.15)' }}>
                  <p className="text-[11px] font-bold tracking-widest uppercase text-violet-600"><IkonTeks nama="🖥" />Review Demo Product</p>

                  {detailReview.product_demo ? (
                    <div>
                      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1">Product yang Di-Demo</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap bg-white/60 rounded-lg px-3 py-2 border border-violet-100">{detailReview.product_demo}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 italic px-2">Product belum diisi</p>
                  )}

                  <div>
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">Grade Product Knowledge</p>
                    {detailReview.grade_product_knowledge ? (
                      <>
                        <StarRating value={detailReview.grade_product_knowledge} disabled />
                        {detailReview.catatan_grade_product_knowledge && (
                          <div className="mt-2 bg-white/60 rounded-lg px-3 py-2 border border-violet-100">
                            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1">Catatan</p>
                            <p className="text-xs text-gray-600 italic">{detailReview.catatan_grade_product_knowledge}</p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                        <span className="text-sm"><Ikon nama="⏳" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                        <p className="text-xs font-semibold text-amber-700">Belum diisi oleh guest</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* BAST review detail */}
              {detailReview.review_category === 'BAST' && (
                <div className="rounded-xl p-4 space-y-4" style={{ background: 'rgba(14,165,233,0.04)', border: '1.5px solid rgba(14,165,233,0.15)' }}>
                  <p className="text-[11px] font-bold tracking-widest uppercase text-sky-700"><IkonTeks nama="📌" />Review BAST (Training)</p>

                  {detailReview.product_bast ? (
                    <div>
                      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1">Product yang Di-Training</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap bg-white/60 rounded-lg px-3 py-2 border border-sky-100">{detailReview.product_bast}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 italic px-2">Product belum diisi</p>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">Grade Training Customer</p>
                      {detailReview.grade_training_customer ? (
                        <>
                          <StarRating value={detailReview.grade_training_customer} disabled />
                          {detailReview.catatan_grade_training_customer && (
                            <p className="text-xs text-gray-500 mt-2 italic bg-white/60 rounded-lg px-3 py-2 border border-sky-100">{detailReview.catatan_grade_training_customer}</p>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                          <span className="text-sm"><Ikon nama="⏳" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                          <p className="text-xs font-semibold text-amber-700">Belum diisi</p>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">Grade Product Knowledge</p>
                      {detailReview.grade_product_knowledge_bast ? (
                        <>
                          <StarRating value={detailReview.grade_product_knowledge_bast} disabled />
                          {detailReview.catatan_grade_product_knowledge_bast && (
                            <p className="text-xs text-gray-500 mt-2 italic bg-white/60 rounded-lg px-3 py-2 border border-sky-100">{detailReview.catatan_grade_product_knowledge_bast}</p>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                          <span className="text-sm"><Ikon nama="⏳" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
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
                  <p className="text-[11px] font-bold tracking-widest uppercase text-gray-500 px-4 pt-3 pb-2"><IkonTeks nama="📸" />Foto Dokumentasi</p>
                  <img
                    src={detailReview.foto_dokumentasi_url}
                    alt="Foto Dokumentasi"
                    loading="lazy"
                    decoding="async"
                    className="w-full max-h-56 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => window.open(detailReview.foto_dokumentasi_url!, '_blank')}
                  />
                  <div className="px-4 pb-3 pt-1">
                    <a href={detailReview.foto_dokumentasi_url} target="_blank" rel="noopener noreferrer"
                      className="text-[11px] font-bold text-violet-600 hover:text-violet-800 transition-colors">
                      <IkonTeks nama="🔗" />Buka foto di tab baru
                    </a>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl px-4 py-3 flex items-center gap-2" style={{ background: 'rgba(0,0,0,0.03)', border: '1px dashed rgba(0,0,0,0.15)' }}>
                  <span className="text-gray-400 text-xl"><Ikon nama="📷" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                  <p className="text-xs text-gray-500">Belum ada foto dokumentasi</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-1">
                {/* Edit untuk admin/Full Access, atau Guest/Sales/Team yang memang pemilik baris ini */}
                {bolehEditReview(detailReview) && (
                  <button onClick={() => openEdit(detailReview)}
                    className="tombol-utama flex-1 py-3 rounded-kontrol font-bold text-sm flex items-center justify-center gap-2">
                    Edit / Isi Review
                  </button>
                )}
                {isAdmin && (
                  <button onClick={() => { setDetailReview(null); openDeleteModal(detailReview); }}
                    className="tombol-kedua text-rose-700! px-5 py-3 rounded-kontrol font-bold text-sm flex items-center gap-2">
                    Hapus
                  </button>
                )}
                <button onClick={() => setDetailReview(null)}
                  className="tombol-kedua px-5 py-3 rounded-kontrol font-bold text-sm">
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      </ModalPortal>
      )}
    </>
  );
}
