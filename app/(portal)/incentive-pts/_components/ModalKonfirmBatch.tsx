'use client';

/** ModalKonfirmBatch - dipecah dari app/(portal)/incentive-pts/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { ModalPortal } from '@/components/shared';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { IncentiveProjectRow, IncentiveTranche } from './calc';

export interface ModalKonfirmBatchProps {
  batchConfirm: boolean;
  batchProcessing: boolean;
  batchYear: number;
  handleBatchProcess: () => Promise<void>;
  setBatchConfirm: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  tranches: (IncentiveTranche & { project: IncentiveProjectRow; })[];
}

export function ModalKonfirmBatch({ batchConfirm, batchProcessing, batchYear, handleBatchProcess, setBatchConfirm, tranches }: ModalKonfirmBatchProps) {
  return (
    <>
      {batchConfirm && (
      <ModalPortal>
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1200] p-4" onClick={e => { if (e.target === e.currentTarget) setBatchConfirm(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-red-200">
            <h3 className="text-lg font-bold text-gray-800 mb-2"><IkonTeks nama="🚀" />Konfirmasi Process Batch</h3>
            <p className="text-sm text-gray-500 mb-2">Proses semua tranche <strong>payment_year = {batchYear}</strong> status <strong>pending</strong>.</p>
            {(() => {
              const cnt = tranches.filter(t => t.payment_year === batchYear && t.status === 'pending').length;
              return cnt > 0
                ? <p className="text-sm font-bold text-rose-600 mb-3"><Ikon nama="📋" ukuran="1em" className="inline-block align-[-0.12em]" /> {cnt} tranche siap diproses</p>
                : <p className="text-sm font-bold text-amber-700 mb-3"><IkonTeks nama="⚠" />Tidak ada tranche pending untuk tahun {batchYear}. Pastikan tranche sudah di-generate terlebih dahulu.</p>;
            })()}
            {/*
              Dulu tertulis "tidak bisa di-undo". Sekarang bisa - ada tombol
              "Batalkan Batch" di sebelah tombol ini - dan menakut-nakuti dengan
              hal yang tidak lagi benar membuat orang enggan menguji fiturnya
              sama sekali. Yang tetap tidak bisa ditarik cuma tahap yang sudah
              berstatus Paid, dan itulah yang disebutkan.
            */}
            <div className="px-4 py-3 rounded-xl mb-4 bg-amber-50 border border-amber-200">
              <p className="text-xs font-bold text-amber-700 mb-1"><IkonTeks nama="↩" />Bisa dibatalkan.</p>
              <p className="text-[11px] text-amber-700 leading-relaxed">
                Setelah diproses, tombol <strong>Batalkan Batch {batchYear}</strong> akan muncul untuk
                mengembalikan tahapan ini ke Pending. Yang sudah bertanda <strong>Paid</strong> tidak
                ikut bisa dibatalkan — status itu berarti uangnya sudah keluar.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setBatchConfirm(false)} className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-gray-500 border border-gray-200 hover:bg-gray-50">Batal</button>
              <button onClick={handleBatchProcess} disabled={batchProcessing}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
                {batchProcessing && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Proses Sekarang
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>
      )}
    </>
  );
}
