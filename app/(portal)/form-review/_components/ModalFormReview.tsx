'use client';

/** ModalFormReview - dipecah dari app/(portal)/form-review/_components/FormReviewPageInner.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { FormField, SectionHeader, StarRating, ModalPortal } from '@/components/shared';
import { IkonTeks } from '@/components/shared/Ikon';
import { ReviewForm } from './shared';

export interface ModalFormReviewProps {
  editingReview: ReviewForm | null;
  emptyReviewForm: { product_demo: string; grade_product_knowledge: number; catatan_grade_product_knowledge: string; product_bast: string; grade_training_customer: number; catatan_grade_training_customer: string; grade_product_knowledge_bast: number; catatan_grade_product_knowledge_bast: string; foto_dokumentasi_url: string; };
  fotoPreview: string | null;
  fotoRef: import("react").RefObject<HTMLInputElement | null>;
  handleSaveReview: () => Promise<void>;
  inputCls: "w-full rounded-xl px-4 py-3 text-sm outline-none transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-violet-500/40";
  inputStyle: { background: string; border: string; };
  reviewFormData: { product_demo: string; grade_product_knowledge: number; catatan_grade_product_knowledge: string; product_bast: string; grade_training_customer: number; catatan_grade_training_customer: string; grade_product_knowledge_bast: number; catatan_grade_product_knowledge_bast: string; foto_dokumentasi_url: string; };
  rfd: (patch: Partial<{ product_demo: string; grade_product_knowledge: number; catatan_grade_product_knowledge: string; product_bast: string; grade_training_customer: number; catatan_grade_training_customer: string; grade_product_knowledge_bast: number; catatan_grade_product_knowledge_bast: string; foto_dokumentasi_url: string; }>) => void;
  saving: boolean;
  setEditingReview: import("react").Dispatch<import("react").SetStateAction<ReviewForm | null>>;
  setFotoFile: import("react").Dispatch<import("react").SetStateAction<File | null>>;
  setFotoPreview: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setReviewFormData: import("react").Dispatch<import("react").SetStateAction<{ product_demo: string; grade_product_knowledge: number; catatan_grade_product_knowledge: string; product_bast: string; grade_training_customer: number; catatan_grade_training_customer: string; grade_product_knowledge_bast: number; catatan_grade_product_knowledge_bast: string; foto_dokumentasi_url: string; }>>;
  setShowFormModal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  showFormModal: boolean;
}

export function ModalFormReview({ editingReview, emptyReviewForm, fotoPreview, fotoRef, handleSaveReview, inputCls, inputStyle, reviewFormData, rfd, saving, setEditingReview, setFotoFile, setFotoPreview, setReviewFormData, setShowFormModal, showFormModal }: ModalFormReviewProps) {
  return (
    <>
      {showFormModal && editingReview && (
      <ModalPortal>
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1100] p-4 overflow-y-auto"
          onClick={e => { if (e.target === e.currentTarget) { setShowFormModal(false); setEditingReview(null); setReviewFormData(emptyReviewForm); } }}>
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-2xl max-h-full flex flex-col overflow-hidden"
            style={{ animation: 'scale-in 0.25s ease-out', border: '1.5px solid rgba(124,58,237,0.25)' }}>
            {/* Header */}
            <div className="px-8 py-6 rounded-t-2xl flex-shrink-0" style={{ background: 'linear-gradient(135deg,#7c3aed,#5b21b6)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white"><IkonTeks nama="✏" />Isi Review</h2>
                  <p className="text-violet-200/80 text-xs mt-1">{editingReview.project_name}</p>
                  <p className="text-violet-300/70 text-xs mt-0.5">
                    {editingReview.review_category === 'Demo Product' ? '🖥️ Demo Product' : '📌 BAST (Training)'}
                  </p>
                </div>
                <button aria-label="Tutup" onClick={() => { setShowFormModal(false); setEditingReview(null); setReviewFormData(emptyReviewForm); }}
                  className="bg-white/15 hover:bg-white/25 text-white p-2 rounded-lg transition-all">
                  <svg aria-hidden="true" focusable="false" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            <div className="p-8 space-y-5 flex-1 min-h-0 overflow-y-auto">
              {/* Project Info (Read-only) */}
              <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)' }}>
                <p className="text-[11px] font-bold tracking-widest uppercase text-violet-600">Informasi Project</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div><span className="text-gray-500">Project:</span> <span className="font-semibold text-gray-700">{editingReview.project_name}</span></div>
                  <div><span className="text-gray-500">Lokasi:</span> <span className="font-semibold text-gray-700">{editingReview.address}</span></div>
                  <div><span className="text-gray-500">Sales:</span> <span className="font-semibold text-gray-700">{editingReview.sales_name}</span></div>
                  <div><span className="text-gray-500">Divisi:</span> <span className="font-semibold text-gray-700">{editingReview.sales_division}</span></div>
                  <div><span className="text-gray-500">Handler:</span> <span className="font-semibold text-gray-700">{editingReview.assign_name}</span></div>
                  <div><span className="text-gray-500">Kategori:</span> <span className="font-semibold text-gray-700">{editingReview.reminder_category}</span></div>
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
                  <IkonTeks nama="📸" />Upload Foto Dokumentasi
                </button>
                {(fotoPreview || reviewFormData.foto_dokumentasi_url) && (
                  <img src={fotoPreview || reviewFormData.foto_dokumentasi_url} alt="Foto" loading="lazy" decoding="async" className="mt-3 rounded-xl w-full max-h-48 object-cover" />
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
                  <IkonTeks nama="💾" />Simpan Review
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
