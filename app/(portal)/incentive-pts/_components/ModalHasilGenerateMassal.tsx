'use client';

/** ModalHasilGenerateMassal - dipecah dari app/(portal)/incentive-pts/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { ModalPortal } from '@/components/shared';
import { IkonTeks } from '@/components/shared/Ikon';

export interface ModalHasilGenerateMassalProps {
  bulkGenerateResult: { tahun: number; berhasil: string[]; gagal: { nama: string; alasan: string; }[]; dilewati: string[]; } | null;
  setBulkGenerateResult: import("react").Dispatch<import("react").SetStateAction<{ tahun: number; berhasil: string[]; gagal: { nama: string; alasan: string; }[]; dilewati: string[]; } | null>>;
}

export function ModalHasilGenerateMassal({ bulkGenerateResult, setBulkGenerateResult }: ModalHasilGenerateMassalProps) {
  return (
    <>
      {bulkGenerateResult && (
      <ModalPortal>
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(3px)' }}
          onClick={() => setBulkGenerateResult(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()} role="dialog" aria-modal="true"
            aria-labelledby="judul-hasil-bulk-generate">
            <div className="px-5 py-4 bg-slate-800 text-white">
              <h3 id="judul-hasil-bulk-generate" className="font-bold text-base">
                Hasil Generate Tahapan Massal {bulkGenerateResult.tahun}
              </h3>
            </div>
            <div className="p-5 space-y-3 max-h-96 overflow-y-auto">
              {bulkGenerateResult.berhasil.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-emerald-700 mb-1"><IkonTeks nama="✅" />Berhasil ({bulkGenerateResult.berhasil.length})</p>
                  <ul className="text-[13px] text-slate-600 space-y-0.5">
                    {bulkGenerateResult.berhasil.map(n => <li key={n}>• {n}</li>)}
                  </ul>
                </div>
              )}
              {bulkGenerateResult.dilewati.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-amber-700 mb-1"><IkonTeks nama="⏭" />Dilewati — sudah ada tahapan ({bulkGenerateResult.dilewati.length})</p>
                  <ul className="text-[13px] text-slate-600 space-y-0.5">
                    {bulkGenerateResult.dilewati.map(n => <li key={n}>• {n}</li>)}
                  </ul>
                </div>
              )}
              {bulkGenerateResult.gagal.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-red-700 mb-1"><IkonTeks nama="❌" />Gagal ({bulkGenerateResult.gagal.length})</p>
                  <ul className="text-[13px] text-slate-600 space-y-0.5">
                    {bulkGenerateResult.gagal.map(g => <li key={g.nama}>• {g.nama} — {g.alasan}</li>)}
                  </ul>
                </div>
              )}
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button onClick={() => setBulkGenerateResult(null)}
                className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-slate-700 hover:bg-slate-800">
                Tutup
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>
      )}
    </>
  );
}
