'use client';

/** ModalApproveInternal - dipecah dari app/(portal)/form-require-project/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { ModalPortal } from '@/components/shared';
import { Z } from '@/lib/z-index';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { ProjectRequest } from './shared';

export interface ModalApproveInternalProps {
  formatDate: (dt: string) => string;
  handleInternalApproveProject: (req: ProjectRequest) => Promise<void>;
  internalApproveSaving: boolean;
  internalApproveTarget: ProjectRequest | null;
  setInternalApproveTarget: import("react").Dispatch<import("react").SetStateAction<ProjectRequest | null>>;
}

export function ModalApproveInternal({ formatDate, handleInternalApproveProject, internalApproveSaving, internalApproveTarget, setInternalApproveTarget }: ModalApproveInternalProps) {
  return (
    <>
      {internalApproveTarget && (
      <ModalPortal>
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center p-4" style={{ zIndex: Z.overlayTop }}
          onClick={e => { if (e.target === e.currentTarget && !internalApproveSaving) setInternalApproveTarget(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            style={{ animation: 'scale-in 0.25s ease-out', border: '2px solid rgba(245,158,11,0.4)' }}>
            <div className="px-6 py-5" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
              <h3 className="text-lg font-bold text-white"><IkonTeks nama="✅" />Approve Request?</h3>
              <p className="text-amber-100/90 text-xs mt-0.5">Teruskan ke Admin/Manager untuk di-assign</p>
            </div>
            <div className="p-6 space-y-3">
              <div className="rounded-xl p-3 space-y-1.5 text-sm" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.08)' }}>
                <div className="flex justify-between gap-3"><span className="text-slate-500 text-xs">Project</span><span className="font-bold text-slate-800 text-right">{internalApproveTarget.project_name}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500 text-xs">Ruangan</span><span className="font-semibold text-slate-700 text-right">{internalApproveTarget.room_name || '-'}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500 text-xs">Sales</span><span className="font-semibold text-slate-700 text-right">{internalApproveTarget.sales_name}{internalApproveTarget.sales_division ? ` · ${internalApproveTarget.sales_division}` : ''}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500 text-xs">Requester</span><span className="font-semibold text-slate-700 text-right">{internalApproveTarget.requester_name}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500 text-xs">Lokasi</span><span className="font-semibold text-slate-700 text-right">{internalApproveTarget.project_location || '-'}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500 text-xs">Kebutuhan</span><span className="font-semibold text-slate-700 text-right">{(internalApproveTarget.kebutuhan ?? []).join(', ') || '-'}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500 text-xs">Diajukan</span><span className="font-semibold text-slate-700 text-right">{formatDate(internalApproveTarget.created_at)}</span></div>
              </div>

              {/* Brand BOTH: dua reviewer, dan approve ini belum tentu yang terakhir. */}
              {internalApproveTarget.internal_sales_id_2 && (
                <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)' }}>
                  <span className="text-base flex-shrink-0"><Ikon nama="🤝" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                  <p className="text-xs text-indigo-700 leading-relaxed">
                    Request ini <strong>Kedua Brand</strong> — perlu approve dari dua Sales Internal.
                    Kalau yang satunya belum, request menunggu dia dulu sebelum diteruskan ke Admin.
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setInternalApproveTarget(null)} disabled={internalApproveSaving}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
                  style={{ background: 'rgba(255,255,255,0.95)', color: '#64748b', border: '1px solid rgba(0,0,0,0.12)' }}>Batal</button>
                <button onClick={() => handleInternalApproveProject(internalApproveTarget)} disabled={internalApproveSaving}
                  className="flex-[2] text-white py-3 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2 hover:scale-[1.02] disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                  {internalApproveSaving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  <IkonTeks nama="✅" />Ya, Approve &amp; Teruskan
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
