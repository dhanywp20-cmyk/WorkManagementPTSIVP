'use client';

/** ModalNominalProyek - dipecah dari app/(portal)/incentive-pts/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { ModalPortal } from '@/components/shared';
import { IkonTeks } from '@/components/shared/Ikon';
import { IncentiveProjectRow, persenPicBerlaku, type SkemaInsentif, formatRupiah, formatPct } from './calc';
import { calcHandlerSplit } from './aturan-halaman';

export interface ModalNominalProyekProps {
  handleSaveNominal: () => Promise<void>;
  nominalBast: string;
  nominalProject: IncentiveProjectRow | null;
  nominalValue: string;
  savingNominal: boolean;
  setNominalBast: import("react").Dispatch<import("react").SetStateAction<string>>;
  setNominalProject: import("react").Dispatch<import("react").SetStateAction<IncentiveProjectRow | null>>;
  setNominalValue: import("react").Dispatch<import("react").SetStateAction<string>>;
  skema: SkemaInsentif | null;
}

export function ModalNominalProyek({ handleSaveNominal, nominalBast, nominalProject, nominalValue, savingNominal, setNominalBast, setNominalProject, setNominalValue, skema }: ModalNominalProyekProps) {
  return (
    <>
      {nominalProject && (
      <ModalPortal>
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1100] p-4" onClick={e => { if (e.target === e.currentTarget) setNominalProject(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" style={{ border: '1.5px solid rgba(99,102,241,0.3)' }}>
            <div className="px-5 py-4" style={{ background: 'linear-gradient(135deg,#e11d48,#7c3aed)' }}>
              <h3 className="text-base font-bold text-white"><IkonTeks nama="💰" />Input Nominal Incentive</h3>
              <p className="text-xs text-rose-200 mt-0.5 truncate">{nominalProject.project_name}</p>
            </div>
            <div className="p-5 space-y-4">
              {/*
                BAST - terisi otomatis saat Handler klik Completed, TAPI tetap
                bisa dibetulkan di sini.

                Alasannya bukan kelengkapan fitur: status Completed sengaja
                dikunci di Reminder Schedule ("tidak dapat diubah kembali"), dan
                formulir Edit-nya tidak punya input BAST sama sekali. Jadi
                begitu sebuah proyek terlanjur selesai tanpa BAST - mis. jadwal
                multi-tanggal yang BAST-nya menempel di baris lain, atau jadwal
                lama dari sebelum modal penyelesaian ada - tidak ada satu pun
                jalan di layar untuk membetulkannya, dan tombol Generate Tahapan
                tidak akan pernah muncul karena syaratnya adalah adanya BAST.
                Satu-satunya jalan keluar tersisa adalah menyunting basis data
                langsung, dan itu bukan sesuatu yang boleh jadi prosedur normal
                untuk data yang menentukan pembayaran.
              */}
              <div className="px-4 py-3 rounded-xl bg-gray-50 border border-gray-200">
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Tanggal BAST</p>
                  {nominalProject.bast_date
                    ? <span className="flex-shrink-0 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">Auto ✓</span>
                    : <span className="flex-shrink-0 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">Perlu diisi</span>}
                </div>
                <input aria-label="Perlu diisi" type="date" value={nominalBast} onChange={e => setNominalBast(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-rose-400" />
                <p className="text-[11px] text-gray-500 mt-1.5">
                  {nominalBast
                    ? <>Tahapan akan jatuh di {new Date(nominalBast).getFullYear() + 1} · {new Date(nominalBast).getFullYear() + 2} · {new Date(nominalBast).getFullYear() + 3}</>
                    : 'Biasanya terisi sendiri saat Handler klik Completed. Isi di sini kalau kosong — tanpa BAST, tahapan pencairan tidak bisa dibuat.'}
                </p>
              </div>

              {/* Mode info */}
              {nominalProject.mode_penyelesaian && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-50 border border-gray-200">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${nominalProject.mode_penyelesaian === 'onsite' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                    {nominalProject.mode_penyelesaian === 'onsite' ? '🏢 Onsite' : '💻 Remote'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {/*
                      Dulu ditulis literal ('100%'/'85%'/'60%'/'51%'), lepas dari skema
                      yang sedang berlaku - begitu Scheme Setting diubah, angka di sini
                      diam-diam berbeda dari yang benar-benar dibayar (dihitung
                      calcHandlerSplit beberapa baris di bawah). Sekarang pakai fungsi
                      yang sama dengan mesin pembayaran (persenPicBerlaku), dengan
                      asumsi "ada Troubleshooting" - konvensi yang sama dipakai
                      calcHandlerSplit di atas untuk ringkasan ini.
                    */}
                    {nominalProject.pic_type === 'manager_pic' ? 'Manager PIC → ' : 'Standard → '}
                    {skema ? formatPct(persenPicBerlaku(
                      skema, nominalProject.mode_penyelesaian === 'remote', true,
                      nominalProject.pic_type === 'manager_pic',
                    )) : '—'} handler
                  </span>
                </div>
              )}

              {/* Nominal */}
              <div>
                <label className="block text-xs font-bold mb-1.5 text-gray-500 uppercase tracking-widest">Nilai Incentive (Rp) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 font-medium">Rp</span>
                  <input type="number" min={0} value={nominalValue} onChange={e => setNominalValue(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-rose-400"
                    placeholder="Contoh: 15000000" autoFocus />
                </div>
                {nominalValue && Number(nominalValue) > 0 && (
                  <div className="mt-2 p-3 rounded-xl bg-rose-50 border border-rose-100 space-y-1">
                    <p className="text-xs font-bold text-rose-600">{formatRupiah(Number(nominalValue))}</p>
                    {nominalProject.mode_penyelesaian && (() => {
                      const split = calcHandlerSplit(skema, { ...nominalProject, incentive_value: Number(nominalValue) });
                      return split ? <p className="text-[11px] text-gray-500">Bagian handler: <strong className="text-rose-700">{formatRupiah(split.amt)}</strong> ({formatPct(split.pct)})</p> : null;
                    })()}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => { setNominalProject(null); setNominalValue(''); setNominalBast(''); }} className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-gray-500 border border-gray-200 hover:bg-gray-50">Batal</button>
              <button onClick={handleSaveNominal} disabled={savingNominal}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#e11d48,#7c3aed)' }}>
                {savingNominal && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Simpan
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>
      )}
    </>
  );
}
