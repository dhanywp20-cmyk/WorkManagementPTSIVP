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
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4"
          onClick={e => { if (e.target === e.currentTarget) setDetailReview(null); }}>
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-2xl my-4 overflow-hidden flex flex-col"
            style={{ animation: 'scale-in 0.25s ease-out', border: '1px solid rgba(0,0,0,0.1)', maxHeight: '96dvh' }}>

            {/* Header */}
            <div className="px-6 py-5 flex-shrink-0 relative"
              style={{ background: detailReview.review_category === 'Demo Product' ? 'linear-gradient(135deg,#7c3aeddd,#5b21b688)' : 'linear-gradient(135deg,#0ea5e9dd,#0284c788)' }}>
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white"
                  style={{ background: detailReview.review_category === 'Demo Product' ? '#7c3aed' : '#0ea5e9', border: '2px solid rgba(255,255,255,0.6)' }}>
                  {detailReview.review_category === 'Demo Product' ? '🖥️' : '📌'} {detailReview.review_category}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white"
                  style={{ background: 'rgba(0,0,0,0.25)', border: '2px solid rgba(255,255,255,0.4)' }}>
                  <Ikon nama="📋" ukuran="1em" className="inline-block align-[-0.12em]" /> {detailReview.reminder_category}
                </span>
                {/* Status badge */}
                {(() => {
                  const hasReview = detailReview.review_category === 'Demo Product'
                    ? !!detailReview.grade_product_knowledge
                    : !!(detailReview.grade_training_customer && detailReview.grade_product_knowledge_bast);
                  return hasReview ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white"
                      style={{ background: '#059669', border: '2px solid rgba(255,255,255,0.5)' }}>
                      <IkonTeks nama="✅" />Sudah Diisi
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white animate-pulse"
                      style={{ background: '#d97706', border: '2px solid rgba(255,255,255,0.5)' }}>
                      <IkonTeks nama="⏳" />Belum Diisi
                    </span>
                  );
                })()}
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/55 mt-1 mb-0.5">Nama Project</p>
              <h2 className="text-xl font-bold text-white leading-tight">{detailReview.project_name || '—'}</h2>
              {detailReview.address && (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/55 mt-1.5 mb-0.5">Lokasi</p>
                  <p className="text-white/80 text-sm flex items-center gap-1.5"><Ikon nama="📍" ukuran="1em" className="inline-block align-[-0.12em]" /> {detailReview.address}</p>
                </>
              )}
              <button aria-label="Tutup" onClick={() => setDetailReview(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/20 hover:bg-black/35 text-white flex items-center justify-center font-bold text-sm">✕</button>
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
                    <p className="text-sm font-bold text-gray-800 mt-0.5 break-words">{item.value}</p>
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
                    className="flex-1 text-white py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.01] flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg,#7c3aed,#5b21b6)', boxShadow: '0 3px 12px rgba(124,58,237,0.3)' }}>
                    <IkonTeks nama="✏" />Edit / Isi Review
                  </button>
                )}
                {isAdmin && (
                  <button onClick={() => { setDetailReview(null); openDeleteModal(detailReview); }}
                    className="px-5 py-3 rounded-xl font-bold text-sm text-red-600 transition-all hover:bg-red-50 hover:scale-[1.01] flex items-center gap-2"
                    style={{ border: '1.5px solid rgba(220,38,38,0.35)' }}>
                    <IkonTeks nama="🗑" />Hapus
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
      </ModalPortal>
      )}
    </>
  );
}
