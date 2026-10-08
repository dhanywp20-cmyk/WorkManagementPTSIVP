'use client';

/** TabJadwalTranche - dipecah dari app/(portal)/incentive-pts/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { bisaKonfig, bisaInput, type CurrentUser, type TabKey } from './aturan-halaman';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { IncentiveProjectRow, IncentiveTranche, type SkemaInsentif, TRANCHE_STATUS } from './calc';

export interface TabJadwalTrancheProps {
  currentUser: CurrentUser | null;
  exporting: boolean;
  filteredTranches: (IncentiveTranche & { project: IncentiveProjectRow; })[];
  handleExportBatch: () => Promise<void>;
  konfirmasiMarkPaid: (trancheId: string, projectName: string, trancheNumber: number) => void;
  loading: boolean;
  markingPaid: string | null;
  setBatalBatch: import("react").Dispatch<import("react").SetStateAction<number | null>>;
  setBatchConfirm: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setBatchYear: import("react").Dispatch<import("react").SetStateAction<number>>;
  setFilterYear: import("react").Dispatch<import("react").SetStateAction<number>>;
  setKetikBatalBatch: import("react").Dispatch<import("react").SetStateAction<string>>;
  skema: SkemaInsentif | null;
  tab: TabKey;
  tahunAktif: number;
  thCls: "px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider border border-gray-200";
  uniqueYears: number[];
}

export function TabJadwalTranche({ currentUser, exporting, filteredTranches, handleExportBatch, konfirmasiMarkPaid, loading, markingPaid, setBatalBatch, setBatchConfirm, setBatchYear, setFilterYear, setKetikBatalBatch, skema, tab, tahunAktif, thCls, uniqueYears }: TabJadwalTrancheProps) {
  return (
    <>
      {tab === 'tranches' && bisaInput(currentUser) && !loading && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex gap-2 items-center">
              {/*
                "Tahun Bayar", bukan cuma "Tahun" - dropdown ini menyaring
                lewat payment_year tranche (kapan UANGNYA cair), BUKAN tahun
                BAST proyek. Proyek dengan BAST 2026 wajar muncul di sini
                saat "Tahun Bayar: 2027" karena itu tahun Tahap 1-nya cair -
                label generik "Tahun" saja gampang disalahsangka sebagai
                tahun proyek/BAST.
              */}
              <label htmlFor="f-incentive-pts-page-1" className="text-xs font-bold text-gray-500">Tahun Bayar:</label>
              <select id="f-incentive-pts-page-1" value={tahunAktif} onChange={e => setFilterYear(Number(e.target.value))}
                className="px-3 py-2 rounded-lg text-sm border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-rose-400">
                {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
                {uniqueYears.length === 0 && <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>}
              </select>
            </div>
            <div className="flex gap-2">
              {bisaKonfig(currentUser) && (
                <button onClick={() => { setBatchYear(tahunAktif); setBatchConfirm(true); }}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90" style={{ background: 'linear-gradient(135deg,#e11d48,#7c3aed)' }}>
                  <IkonTeks nama="🚀" />Process Batch {tahunAktif}
                </button>
              )}
              {/*
                Jalan kembali dari Process Batch. Sengaja ditaruh bersebelahan
                dengan tombol yang dibatalkannya - kalau tersembunyi di layar
                lain, orang yang baru saja salah pencet tidak akan menemukannya
                saat justru paling dibutuhkan.
              */}
              {bisaKonfig(currentUser) && filteredTranches.some(t => t.status === 'processed') && (
                <button onClick={() => { setBatalBatch(tahunAktif); setKetikBatalBatch(''); }}
                  title={`Kembalikan tahapan ${tahunAktif} dari Processed ke Pending`}
                  className="px-4 py-2 rounded-xl text-sm font-bold border-2 border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100">
                  <IkonTeks nama="↩" />Batalkan Batch {tahunAktif}
                </button>
              )}
              {/*
                Export batch tahun bayar yang lagi aktif di dropdown "Tahun"
                atas - beda dari "Export Summary" di tab Project (yang
                menyaring lewat BAST). Sengaja ditaruh di sini juga: begitu
                platform ini sudah jalan tahunan dan banyak tahun tercatat,
                Finance perlu bisa re-export SATU batch tahun bayar tertentu
                saja (mis. menjelang Process Batch, atau setelah ada Support
                baru terdeteksi) tanpa harus mengutak-atik filter BAST di
                tab lain. Lihat handleExportBatch.
              */}
              <button onClick={handleExportBatch} disabled={exporting}
                title={`Export project pada batch Tahun Bayar ${tahunAktif} (mengikuti dropdown Tahun Bayar di atas) - BUKAN tahun BAST proyeknya`}
                className="px-3 py-2 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50 flex items-center gap-1.5">
                {exporting ? <div className="w-3 h-3 border-2 border-emerald-400/30 border-t-emerald-500 rounded-full animate-spin" /> : '📊'} Export Batch Tahun Bayar {tahunAktif}
              </button>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.10),rgba(139,92,246,0.07))' }}>
                    {['Project', 'Handler', 'Tranche', '%', 'Tahun Bayar', 'Status', 'Aksi'].map(h => (
                      <th key={h} className={thCls}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredTranches.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center border border-gray-200">
                      <p className="text-3xl mb-2"><Ikon nama="📅" ukuran="1em" className="inline-block align-[-0.12em]" /></p>
                      <p className="text-gray-500 font-medium">Tidak ada tranche untuk Tahun Bayar {tahunAktif}</p>
                    </td></tr>
                  ) : filteredTranches.map((t, idx) => {
                    const st = TRANCHE_STATUS[t.status] || TRANCHE_STATUS.pending;
                    const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-rose-50/30';
                    return (
                      <tr key={t.id} className={`hover:bg-rose-50/60 transition-colors ${rowBg}`}>
                        <td className="px-3 py-2.5 border border-gray-200">
                          <p className="font-bold text-gray-800">{t.project?.project_name || '—'}</p>
                          <p className="text-[11px] text-gray-500">{t.project?.category}</p>
                        </td>
                        <td className="px-3 py-2.5 border border-gray-200 text-sm text-gray-700">{t.project?.assign_name || '—'}</td>
                        <td className="px-3 py-2.5 border border-gray-200"><span className="px-2 py-1 rounded-lg text-xs font-bold bg-gray-100 text-gray-600">T{t.tranche_number}</span></td>
                        <td className="px-3 py-2.5 border border-gray-200 font-bold text-gray-700">{t.percentage}%</td>
                        <td className="px-3 py-2.5 border border-gray-200 text-gray-600">
                          {/*
                            Tahun bayar dibandingkan dengan yang SEHARUSNYA
                            menurut skema: tahun BAST + tahunKe tahap itu.

                            Perlu ditandai karena tahapan lama tidak ikut
                            berubah ketika aturannya diperbaiki - baris yang
                            dibuat sebelum perbaikan tetap membawa tahun
                            lamanya, dan dari layar ia terlihat sama sahnya
                            dengan baris yang benar. Selisih seperti ini
                            memindahkan uang antar tahun anggaran, jadi lebih
                            baik terlihat mencolok daripada rapi tapi keliru.
                          */}
                          {(() => {
                            const bast = t.project?.bast_date;
                            const tahunKe = skema?.tranche.find(x => x.nomor === t.tranche_number)?.tahunKe;
                            const seharusnya = bast && tahunKe != null
                              ? new Date(bast).getFullYear() + tahunKe : null;
                            const menyimpang = seharusnya != null && seharusnya !== t.payment_year;
                            return (
                              <span className="flex items-center gap-1.5 flex-wrap">
                                <span className={menyimpang ? 'font-bold text-amber-700' : ''}>{t.payment_year}</span>
                                {menyimpang && (
                                  <span title={`Menurut skema seharusnya ${seharusnya} (BAST ${bast} + tahun ke-${tahunKe}). `
                                    + 'Tahapan ini kemungkinan dibuat sebelum aturannya diperbaiki — hapus tahapannya lalu Generate ulang.'}
                                    className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-700 whitespace-nowrap cursor-help">
                                    <IkonTeks nama="⚠" />harusnya {seharusnya}
                                  </span>
                                )}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-3 py-2.5 border border-gray-200"><span className="px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: st.bg, color: st.color }}><Ikon nama={st.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /> {st.label}</span></td>
                        <td className="px-3 py-2.5 border border-gray-200">
                          {t.status === 'processed' && bisaKonfig(currentUser) && (
                            <button onClick={() => konfirmasiMarkPaid(t.id, t.project?.project_name || '—', t.tranche_number)}
                              disabled={markingPaid === t.id}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 border border-emerald-200 transition-all disabled:opacity-50">
                              {markingPaid === t.id ? '⏳...' : '✅ Tandai Paid'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
