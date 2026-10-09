'use client';

/** ModalHapusTahapan - dipecah dari app/(portal)/incentive-pts/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { ModalPortal } from '@/components/shared';
import { IkonTeks } from '@/components/shared/Ikon';
import { IncentiveProjectRow, IncentiveTranche } from './calc';

export interface ModalHapusTahapanProps {
  hapusTahapan: IncentiveProjectRow | null;
  jalankanHapusTahapan: () => Promise<void>;
  ketikHapusTahapan: string;
  membatalkan: boolean;
  setHapusTahapan: import("react").Dispatch<import("react").SetStateAction<IncentiveProjectRow | null>>;
  setKetikHapusTahapan: import("react").Dispatch<import("react").SetStateAction<string>>;
  tranches: (IncentiveTranche & { project: IncentiveProjectRow; })[];
}

export function ModalHapusTahapan({ hapusTahapan, jalankanHapusTahapan, ketikHapusTahapan, membatalkan, setHapusTahapan, setKetikHapusTahapan, tranches }: ModalHapusTahapanProps) {
  return (
    <>
      {hapusTahapan && (() => {
        const punya = tranches.filter(t => t.project_id === hapusTahapan.id);
        const paid = punya.filter(t => t.status === 'paid').length;
        const kunci = 'HAPUS TAHAPAN';
        return (
        <ModalPortal>
          <div role="dialog" aria-modal="true" aria-labelledby="judul-hapus-tahapan"
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1200] p-4"
            onClick={e => { if (e.target === e.currentTarget) { setHapusTahapan(null); setKetikHapusTahapan(''); } }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-amber-200">
              <h3 id="judul-hapus-tahapan" className="text-lg font-bold text-gray-800 mb-2"><IkonTeks nama="↩" />Hapus Tahapan Pencairan</h3>
              <p className="text-sm text-gray-500 mb-1">Project: <strong className="text-gray-800">{hapusTahapan.project_name}</strong></p>
              <p className="text-sm text-gray-500 mb-3">
                {punya.length} tahapan berikut pembagiannya akan dihapus. Sesudah itu
                nominal pool bisa disunting lagi dan tahapannya dibuat ulang.
              </p>
              {paid > 0 ? (
                <div className="px-4 py-3 rounded-xl mb-4 bg-red-50 border border-red-200">
                  <p className="text-xs font-bold text-red-600">
                    Ditolak — {paid} tahapan sudah berstatus Paid. Tahap yang uangnya sudah keluar
                    tidak boleh dihapus dari sini; itu perkara koreksi pembukuan.
                  </p>
                </div>
              ) : (
                <>
                  <div className="px-4 py-3 rounded-xl mb-3 bg-amber-50 border border-amber-200">
                    <p className="text-[11px] text-amber-700 leading-relaxed">
                      Yang dihapus hanya tahapan &amp; pembagiannya. Data proyeknya sendiri —
                      nominal, BAST, mode, PIC — tidak disentuh.
                    </p>
                  </div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    Ketik <span className="font-mono text-amber-700">{kunci}</span> untuk melanjutkan
                  </label>
                  <input type="text" value={ketikHapusTahapan} autoFocus
                    onChange={e => setKetikHapusTahapan(e.target.value)}
                    placeholder={kunci}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </>
              )}
              <div className="flex gap-3">
                <button onClick={() => { setHapusTahapan(null); setKetikHapusTahapan(''); }}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-gray-500 border border-gray-200 hover:bg-gray-50">Tutup</button>
                <button onClick={jalankanHapusTahapan}
                  disabled={membatalkan || paid > 0 || ketikHapusTahapan.trim().toUpperCase() !== kunci}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,#d97706,#b45309)' }}>
                  {membatalkan && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  Hapus Tahapan
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
