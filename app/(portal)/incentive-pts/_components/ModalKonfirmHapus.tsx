'use client';

/** ModalKonfirmHapus - dipecah dari app/(portal)/incentive-pts/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { ModalPortal } from '@/components/shared';
import { IncentiveProjectRow, formatRupiah } from './calc';

export interface ModalKonfirmHapusProps {
  jalankanHapus: () => Promise<void>;
  konfirmHapus: IncentiveProjectRow[] | null;
  menghapus: boolean;
  setKonfirmHapus: import("react").Dispatch<import("react").SetStateAction<IncentiveProjectRow[] | null>>;
}

export function ModalKonfirmHapus({ jalankanHapus, konfirmHapus, menghapus, setKonfirmHapus }: ModalKonfirmHapusProps) {
  return (
    <>
      {konfirmHapus && (
      <ModalPortal>
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(3px)' }}
          onClick={() => !menghapus && setKonfirmHapus(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()} role="dialog" aria-modal="true"
            aria-labelledby="judul-konfirmasi-hapus">
            <div className="px-5 py-4 bg-red-600 text-white">
              <h3 id="judul-konfirmasi-hapus" className="font-bold text-base">
                Keluarkan {konfirmHapus.length} project dari Incentive?
              </h3>
            </div>
            <div className="p-5 space-y-3">
              <ul className="max-h-40 overflow-y-auto space-y-1 rounded-lg bg-slate-50 border border-slate-200 p-2.5">
                {konfirmHapus.map(p => (
                  <li key={p.id} className="text-sm text-slate-700 truncate" title={p.project_name}>
                    • {p.project_name}
                    {(p.incentive_value || 0) > 0 && (
                      <span className="ml-1 text-[11px] font-bold text-emerald-700">
                        {formatRupiah(p.incentive_value || 0)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <div className="text-[13px] leading-relaxed space-y-1.5">
                <p className="text-red-700">
                  <strong>Yang hilang:</strong> project tidak lagi muncul di daftar Incentive PTS
                  dan tidak ikut dihitung pembagiannya.
                </p>
                <p className="text-emerald-700">
                  <strong>Yang tetap:</strong> jadwalnya di Request Schedule, beserta seluruh
                  riwayat dan catatan aktivitasnya — tidak ada yang dihapus.
                </p>
                <p className="text-slate-600">
                  Bisa dikembalikan kapan saja lewat tombol <strong>Sync ke Incentive</strong>
                  {' '}di Request Schedule.
                </p>
              </div>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button onClick={() => setKonfirmHapus(null)} disabled={menghapus}
                className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-50">
                Batal
              </button>
              <button onClick={jalankanHapus} disabled={menghapus}
                className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
                {menghapus && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Ya, keluarkan
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>
      )}
    </>
  );
}
