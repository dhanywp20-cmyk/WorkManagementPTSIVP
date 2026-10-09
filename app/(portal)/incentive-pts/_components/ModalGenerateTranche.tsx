'use client';

/** ModalGenerateTranche - dipecah dari app/(portal)/incentive-pts/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { ModalPortal } from '@/components/shared';
import { IkonTeks } from '@/components/shared/Ikon';
import { IncentiveProjectRow, generateTranches, petaPorsiBerlaku, type SkemaInsentif, formatRupiah } from './calc';

export interface ModalGenerateTrancheProps {
  generateProject: IncentiveProjectRow | null;
  generating: boolean;
  handleGenerateTranches: () => Promise<void>;
  setGenerateProject: import("react").Dispatch<import("react").SetStateAction<IncentiveProjectRow | null>>;
  setShowGenerateModal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  showGenerateModal: boolean;
  skema: SkemaInsentif | null;
}

export function ModalGenerateTranche({ generateProject, generating, handleGenerateTranches, setGenerateProject, setShowGenerateModal, showGenerateModal, skema }: ModalGenerateTrancheProps) {
  return (
    <>
      {showGenerateModal && generateProject && (
      <ModalPortal>
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1200] p-4" onClick={e => { if (e.target === e.currentTarget) { setShowGenerateModal(false); setGenerateProject(null); } }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4"><IkonTeks nama="⚡" />Generate Tranche</h3>
            <p className="text-sm text-gray-500 mb-1">Project: <strong className="text-gray-800">{generateProject.project_name}</strong></p>
            <p className="text-sm text-gray-500 mb-4">BAST: <strong>{generateProject.bast_date}</strong> · Pool: <strong className="text-emerald-700">{formatRupiah(generateProject.incentive_value || 0)}</strong></p>
            {/*
              Pratinjau memisahkan porsi Tim PTS dan porsi Installer, karena
              keduanya memang dibayar dengan cara berbeda: Tim PTS dipecah
              menurut tahapan, Installer lunas sekali di tahap pertama.
              Sebelumnya baris ini menampilkan pool x persen tahap begitu saja -
              angka yang tidak pernah benar untuk proyek Remote, sebab porsi
              Installer sudah dipotong lebih dulu dari pool Tim PTS.
            */}
            {(() => {
              if (!skema) return <p className="text-sm text-gray-500 mb-6">Memuat skema insentif...</p>;
              //  Pratinjau ini jalan begitu modal dibuka, sebelum tombol Generate
              //  ditekan - kalau proyeknya belum punya BAST, generateTranches()
              //  di bawah menghitung tanggal dari nilai yang tidak valid dan
              //  crash. handleGenerateTranches() sudah menolak kasus ini saat
              //  submit; pratinjau perlu penjagaan yang sama karena jalan lebih
              //  dulu.
              if (!generateProject.bast_date) return <p className="text-sm text-amber-700 mb-6"><IkonTeks nama="⚠" />BAST belum diisi - isi lewat 💲 Input Nominal dulu.</p>;
              const pool = generateProject.incentive_value || 0;
              //  Lewat petaPorsiBerlaku, bukan persenInstaller: saat tabel Porsi
              //  Remote diatur sendiri, porsi Installer diambil dari baris di
              //  tabel itu - bukan dari kolom "Porsi Installer".
              const pctInst = petaPorsiBerlaku(
                skema, generateProject.mode_penyelesaian === 'remote', true,
              ).pctInstaller;
              const poolTim = pool * ((100 - pctInst) / 100);
              const daftar = generateTranches(skema, generateProject.id, generateProject.bast_date!, generateProject.mode_penyelesaian);
              const tahapPertama = daftar.length ? Math.min(...daftar.map(t => t.tranche_number)) : 1;
              return (
                <div className="space-y-2 mb-6">
                  {daftar.map(t => {
                    const installerDiSini = pctInst > 0 && skema.installerBayarDiMuka && t.tranche_number === tahapPertama;
                    return (
                      <div key={t.tranche_number} className="rounded-lg px-4 py-2.5 border border-gray-100" style={{ background: 'rgb(249,250,251)' }}>
                        <div className="flex justify-between items-baseline gap-2 flex-wrap">
                          <span className="text-sm font-bold text-gray-700">Tahap {t.tranche_number} · Bayar {t.payment_year}</span>
                          <span className="text-sm text-gray-500">
                            Tim PTS {t.percentage}% · {formatRupiah(Math.round(poolTim * t.percentage / 100))}
                          </span>
                        </div>
                        {installerDiSini && (
                          <div className="flex justify-between items-baseline gap-2 flex-wrap mt-1 pt-1 border-t border-gray-100">
                            <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">+ PTS Daerah — lunas sekali</span>
                            <span className="text-sm text-amber-700 font-bold">{pctInst}% · {formatRupiah(Math.round(pool * pctInst / 100))}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {pctInst > 0 && (
                    <p className="text-[11px] text-gray-500 leading-relaxed pt-1">
                      Porsi PTS Daerah {pctInst}% dipotong dari pool lebih dulu; sisa {100 - pctInst}% milik Tim PTS
                      itulah yang dipecah {daftar.map(t => `${t.percentage}%`).join(' / ')} selama {daftar.length} tahun.
                    </p>
                  )}
                </div>
              );
            })()}
            <div className="flex gap-3">
              <button onClick={() => { setShowGenerateModal(false); setGenerateProject(null); }} className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-gray-500 border border-gray-200 hover:bg-gray-50">Batal</button>
              <button onClick={handleGenerateTranches} disabled={generating}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#e11d48,#7c3aed)' }}>
                {generating && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Generate
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>
      )}
    </>
  );
}
