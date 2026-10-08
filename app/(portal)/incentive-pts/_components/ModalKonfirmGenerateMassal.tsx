'use client';

/** ModalKonfirmGenerateMassal - dipecah dari app/(portal)/incentive-pts/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { ModalPortal } from '@/components/shared';
import { IkonTeks } from '@/components/shared/Ikon';
import { IncentiveProjectRow, formatRupiah } from './calc';

export interface ModalKonfirmGenerateMassalProps {
  bulkGenerateConfirm: IncentiveProjectRow[] | null;
  bulkGenerating: boolean;
  filterBastYear: number | null;
  jalankanBulkGenerate: () => Promise<void>;
  setBulkGenerateConfirm: import("react").Dispatch<import("react").SetStateAction<IncentiveProjectRow[] | null>>;
}

export function ModalKonfirmGenerateMassal({ bulkGenerateConfirm, bulkGenerating, filterBastYear, jalankanBulkGenerate, setBulkGenerateConfirm }: ModalKonfirmGenerateMassalProps) {
  return (
    <>
      {bulkGenerateConfirm && (
      <ModalPortal>
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(3px)' }}
          onClick={() => !bulkGenerating && setBulkGenerateConfirm(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()} role="dialog" aria-modal="true"
            aria-labelledby="judul-bulk-generate">
            <div className="px-5 py-4 bg-blue-600 text-white">
              <h3 id="judul-bulk-generate" className="font-bold text-base">
                <IkonTeks nama="🚀" />Generate Tahapan untuk {bulkGenerateConfirm.length} project — Tahun BAST {filterBastYear}?
              </h3>
            </div>
            <div className="p-5 space-y-3">
              <ul className="max-h-52 overflow-y-auto space-y-1 rounded-lg bg-slate-50 border border-slate-200 p-2.5">
                {bulkGenerateConfirm.map(p => (
                  <li key={p.id} className="text-sm text-slate-700 truncate" title={p.project_name}>
                    • {p.project_name}
                    <span className="ml-1 text-[11px] font-bold text-emerald-700">
                      {formatRupiah(p.incentive_value || 0)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="text-[13px] leading-relaxed space-y-1.5">
                <p className="text-slate-600">
                  Tiap project diproses satu-satu lewat fungsi yang sama dengan tombol{' '}
                  <strong>Generate Tranche</strong> perorangan — persentase per tahap dan tahun
                  pembayaran dihitung dari BAST masing-masing project, bukan tanggal hari ini.
                </p>
                <p className="text-slate-600">
                  Project yang <strong>sudah</strong> punya tahapan (dibuat orang lain sesudah
                  daftar ini dimuat) otomatis dilewati — tidak akan dibuat dobel.
                </p>
              </div>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button onClick={() => setBulkGenerateConfirm(null)} disabled={bulkGenerating}
                className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-50">
                Batal
              </button>
              <button onClick={jalankanBulkGenerate} disabled={bulkGenerating}
                className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                {bulkGenerating && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Generate {bulkGenerateConfirm.length} Tahapan
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>
      )}
    </>
  );
}
