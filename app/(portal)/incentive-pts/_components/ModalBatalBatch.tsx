'use client';

/** ModalBatalBatch - dipecah dari app/(portal)/incentive-pts/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { ModalPortal } from '@/components/shared';
import { IkonTeks } from '@/components/shared/Ikon';
import { IncentiveProjectRow, IncentiveTranche } from './calc';

export interface ModalBatalBatchProps {
  batalBatch: number | null;
  jalankanBatalBatch: () => Promise<void>;
  ketikBatalBatch: string;
  membatalkan: boolean;
  setBatalBatch: import("react").Dispatch<import("react").SetStateAction<number | null>>;
  setKetikBatalBatch: import("react").Dispatch<import("react").SetStateAction<string>>;
  tranches: (IncentiveTranche & { project: IncentiveProjectRow; })[];
}

export function ModalBatalBatch({ batalBatch, jalankanBatalBatch, ketikBatalBatch, membatalkan, setBatalBatch, setKetikBatalBatch, tranches }: ModalBatalBatchProps) {
  return (
    <>
      {batalBatch !== null && (() => {
        const bisa = tranches.filter(t => t.payment_year === batalBatch && t.status === 'processed').length;
        const paid = tranches.filter(t => t.payment_year === batalBatch && t.status === 'paid').length;
        const kunci = `BATALKAN ${batalBatch}`;
        return (
        <ModalPortal>
          <div role="dialog" aria-modal="true" aria-labelledby="judul-batal-batch"
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1200] p-4"
            onClick={e => { if (e.target === e.currentTarget) { setBatalBatch(null); setKetikBatalBatch(''); } }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-amber-200">
              <h3 id="judul-batal-batch" className="text-lg font-bold text-gray-800 mb-2"><IkonTeks nama="↩" />Batalkan Batch {batalBatch}</h3>
              <p className="text-sm text-gray-500 mb-3">
                Baris pembagian hasil batch tahun ini dihapus, dan tahapannya kembali ke
                status <strong>Pending</strong> supaya bisa diproses ulang.
              </p>
              <div className="rounded-xl border border-gray-100 bg-gray-50 divide-y divide-gray-100 mb-3 text-sm">
                <div className="flex justify-between px-3 py-2">
                  <span className="text-gray-600">Dikembalikan ke Pending</span>
                  <strong className="text-amber-700">{bisa} tahapan</strong>
                </div>
                <div className="flex justify-between px-3 py-2">
                  <span className="text-gray-600">Dilewati (sudah Paid)</span>
                  <strong className={paid ? 'text-emerald-700' : 'text-gray-500'}>{paid} tahapan</strong>
                </div>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed mb-3">
                Tahapannya sendiri TIDAK dihapus — hanya hasil pemrosesannya. Nominal proyek
                tetap terkunci. Untuk menghapus tahapan, pakai tombol ↩️ di baris proyeknya.
              </p>
              <label htmlFor="f-incentive-pts-page-2" className="block text-xs font-bold text-gray-600 mb-1">
                Ketik <span className="font-mono text-amber-700">{kunci}</span> untuk melanjutkan
              </label>
              <input id="f-incentive-pts-page-2" type="text" value={ketikBatalBatch} autoFocus
                onChange={e => setKetikBatalBatch(e.target.value)}
                placeholder={kunci}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-amber-400" />
              <div className="flex gap-3">
                <button onClick={() => { setBatalBatch(null); setKetikBatalBatch(''); }}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-gray-500 border border-gray-200 hover:bg-gray-50">Tutup</button>
                <button onClick={jalankanBatalBatch}
                  disabled={membatalkan || ketikBatalBatch.trim().toUpperCase() !== kunci || bisa === 0}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,#d97706,#b45309)' }}>
                  {membatalkan && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  Batalkan
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
        );
      })()}
    </>
  );
}
