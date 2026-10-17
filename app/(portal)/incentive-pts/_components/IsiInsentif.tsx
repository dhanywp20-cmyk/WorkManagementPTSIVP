'use client';

/** IsiInsentif - dipecah dari app/(portal)/incentive-pts/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { IncentiveProjectRow, IncentiveTranche, IncentiveSplit, LateTicketLink, type KandidatGabung, type SkemaInsentif, formatRupiah } from './calc';
import { FilterProyekInsentif } from './FilterProyekInsentif';
import { DaftarProyekInsentifHP } from './DaftarProyekInsentifHP';
import { TabelProyekInsentif } from './TabelProyekInsentif';
import { TabJadwalTranche } from './TabJadwalTranche';
import { bisaKonfig, bisaInput, type CurrentUser, type TabKey } from './aturan-halaman';
import { SchemeTab } from './SchemeTab';
import { TabPengaturanAkses } from './TabPengaturanAkses';
import { type TingkatAkses } from '@/lib/incentive-akses';
import { Paginasi } from '@/components/shared';

export interface IsiInsentifProps {
  allUsers: CurrentUser[];
  bastYearsProjects: number[];
  bolehHapus: boolean;
  brandEditFor: string | null;
  cariUser: string;
  currentUser: CurrentUser | null;
  exporting: boolean;
  exportingSaya: boolean;
  filterBastYear: number | null;
  filteredProjects: IncentiveProjectRow[];
  filteredTranches: (IncentiveTranche & { project: IncentiveProjectRow; })[];
  hal: import("@/components/shared/Paginasi").HasilPaginasi<IncentiveProjectRow>;
  handleExportBatch: () => Promise<void>;
  handleExportInsentifSaya: () => Promise<void>;
  handleExportSummary: () => Promise<void>;
  handleSetAkses: (userId: string, nilai: TingkatAkses) => Promise<void>;
  handleSetBrandScope: (userId: string, scope: string | null) => Promise<void>;
  handleSetProjectBrand: (projectId: string, brand: "MVI" | "IVP" | "BOTH") => Promise<void>;
  kandidatBulkGenerate: (tahun: number) => IncentiveProjectRow[];
  kandidatGabung: KandidatGabung[];
  konfirmasiMarkPaid: (trancheId: string, projectName: string, trancheNumber: number) => void;
  lateTickets: LateTicketLink[];
  loading: boolean;
  markingPaid: string | null;
  mintaKonfirmasiHapus: (target: IncentiveProjectRow[]) => Promise<void>;
  myPaidInsentif: number;
  myPendingInsentif: number;
  myProjectCount: number;
  mySplitsInYear: IncentiveSplit[];
  myTotalInsentif: number;
  notify: (type: "success" | "error", msg: string) => void;
  openProjectDetail: (p: IncentiveProjectRow) => Promise<void>;
  pilihHapus: Set<string>;
  searchProject: string;
  setBatalBatch: import("react").Dispatch<import("react").SetStateAction<number | null>>;
  setBatchConfirm: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setBatchYear: import("react").Dispatch<import("react").SetStateAction<number>>;
  setBrandEditFor: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setBulkGenerateConfirm: import("react").Dispatch<import("react").SetStateAction<IncentiveProjectRow[] | null>>;
  setCariUser: import("react").Dispatch<import("react").SetStateAction<string>>;
  setFilterBastYear: import("react").Dispatch<import("react").SetStateAction<number | null>>;
  setFilterYear: import("react").Dispatch<import("react").SetStateAction<number>>;
  setGenerateProject: import("react").Dispatch<import("react").SetStateAction<IncentiveProjectRow | null>>;
  setHapusTahapan: import("react").Dispatch<import("react").SetStateAction<IncentiveProjectRow | null>>;
  setKetikBatalBatch: import("react").Dispatch<import("react").SetStateAction<string>>;
  setKetikHapusTahapan: import("react").Dispatch<import("react").SetStateAction<string>>;
  setKonfirmGabung: import("react").Dispatch<import("react").SetStateAction<KandidatGabung | null>>;
  setNominalBast: import("react").Dispatch<import("react").SetStateAction<string>>;
  setNominalProject: import("react").Dispatch<import("react").SetStateAction<IncentiveProjectRow | null>>;
  setNominalValue: import("react").Dispatch<import("react").SetStateAction<string>>;
  setPilihHapus: import("react").Dispatch<import("react").SetStateAction<Set<string>>>;
  setSearchProject: import("react").Dispatch<import("react").SetStateAction<string>>;
  setShowGenerateModal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setSummaryExportYear: import("react").Dispatch<import("react").SetStateAction<number | null>>;
  skema: SkemaInsentif | null;
  summaryExportYear: number | null;
  tab: TabKey;
  tahunAktif: number;
  thCls: "px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider border border-gray-200";
  togglePilih: (id: string) => void;
  totalPool: number;
  tranches: (IncentiveTranche & { project: IncentiveProjectRow; })[];
  uniqueYears: number[];
}

export function IsiInsentif({ allUsers, bastYearsProjects, bolehHapus, brandEditFor, cariUser, currentUser, exporting, exportingSaya, filterBastYear, filteredProjects, filteredTranches, hal, handleExportBatch, handleExportInsentifSaya, handleExportSummary, handleSetAkses, handleSetBrandScope, handleSetProjectBrand, kandidatBulkGenerate, kandidatGabung, konfirmasiMarkPaid, lateTickets, loading, markingPaid, mintaKonfirmasiHapus, myPaidInsentif, myPendingInsentif, myProjectCount, mySplitsInYear, myTotalInsentif, notify, openProjectDetail, pilihHapus, searchProject, setBatalBatch, setBatchConfirm, setBatchYear, setBrandEditFor, setBulkGenerateConfirm, setCariUser, setFilterBastYear, setFilterYear, setGenerateProject, setHapusTahapan, setKetikBatalBatch, setKetikHapusTahapan, setKonfirmGabung, setNominalBast, setNominalProject, setNominalValue, setPilihHapus, setSearchProject, setShowGenerateModal, setSummaryExportYear, skema, summaryExportYear, tab, tahunAktif, thCls, togglePilih, totalPool, tranches, uniqueYears }: IsiInsentifProps) {
  return (
    <>
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: 'rgba(99,102,241,0.2)', borderTopColor: '#f43f5e' }} />
          </div>
        )}

        {/* ─── Projects tab ─── */}
        {tab === 'projects' && !loading && (<>
          {currentUser && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-linear-to-br from-rose-50 via-white to-purple-50 p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-black text-gray-700 flex items-center gap-1.5"><IkonTeks nama="💰" />Insentif Saya
                  <span className="text-[11px] font-semibold text-gray-500">
                    {filterBastYear == null ? '· semua tahun BAST' : `· tahun BAST ${filterBastYear}`}
                  </span>
                </h3>
                {mySplitsInYear.length > 0 && (
                  <button onClick={handleExportInsentifSaya} disabled={exportingSaya}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 disabled:opacity-50 flex items-center gap-1.5">
                    {exportingSaya ? <div className="w-3 h-3 border-2 border-rose-400/30 border-t-rose-500 rounded-full animate-spin" /> : '📥'} Export Bagian Saya
                  </button>
                )}
              </div>
              {mySplitsInYear.length === 0 ? (
                <p className="text-xs text-gray-500">Belum ada bagian insentif tercatat untuk kamu di periode ini.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <p className="text-[11px] text-gray-500 uppercase font-bold tracking-wider">Total</p>
                    <p className="text-lg font-black text-gray-700">{formatRupiah(myTotalInsentif)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500 uppercase font-bold tracking-wider">Sudah Cair</p>
                    <p className="text-lg font-black text-emerald-700">{formatRupiah(myPaidInsentif)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500 uppercase font-bold tracking-wider">Belum Cair</p>
                    <p className="text-lg font-black text-amber-700">{formatRupiah(myPendingInsentif)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500 uppercase font-bold tracking-wider">Jumlah Project</p>
                    <p className="text-lg font-black text-rose-600">{myProjectCount}</p>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
            <FilterProyekInsentif
              bastYearsProjects={bastYearsProjects} bolehHapus={bolehHapus} currentUser={currentUser} exporting={exporting} filterBastYear={filterBastYear} filteredProjects={filteredProjects} handleExportSummary={handleExportSummary} kandidatBulkGenerate={kandidatBulkGenerate} kandidatGabung={kandidatGabung} mintaKonfirmasiHapus={mintaKonfirmasiHapus} pilihHapus={pilihHapus} searchProject={searchProject} setBulkGenerateConfirm={setBulkGenerateConfirm} setFilterBastYear={setFilterBastYear} setKonfirmGabung={setKonfirmGabung} setPilihHapus={setPilihHapus} setSearchProject={setSearchProject} setSummaryExportYear={setSummaryExportYear} summaryExportYear={summaryExportYear}
            />
            {/* ── MOBILE: kartu ringkas (nama + total incentive, tap utk detail) ── */}
            <DaftarProyekInsentifHP
              currentUser={currentUser} filteredProjects={filteredProjects} hal={hal} openProjectDetail={openProjectDetail} setGenerateProject={setGenerateProject} setHapusTahapan={setHapusTahapan} setKetikHapusTahapan={setKetikHapusTahapan} setNominalBast={setNominalBast} setNominalProject={setNominalProject} setNominalValue={setNominalValue} setShowGenerateModal={setShowGenerateModal} skema={skema} tranches={tranches}
            />

            {/* ── DESKTOP: tabel penuh (TIDAK diubah) ── */}
            <TabelProyekInsentif
              bolehHapus={bolehHapus} brandEditFor={brandEditFor} currentUser={currentUser} filteredProjects={filteredProjects} hal={hal} handleSetProjectBrand={handleSetProjectBrand} mintaKonfirmasiHapus={mintaKonfirmasiHapus} openProjectDetail={openProjectDetail} pilihHapus={pilihHapus} setBrandEditFor={setBrandEditFor} setGenerateProject={setGenerateProject} setHapusTahapan={setHapusTahapan} setKetikHapusTahapan={setKetikHapusTahapan} setNominalBast={setNominalBast} setNominalProject={setNominalProject} setNominalValue={setNominalValue} setShowGenerateModal={setShowGenerateModal} skema={skema} thCls={thCls} togglePilih={togglePilih} totalPool={totalPool} tranches={tranches}
            />
          </div>
        </>)}

        {/* ─── Tranches tab ─── */}
        <TabJadwalTranche
          currentUser={currentUser} exporting={exporting} filteredTranches={filteredTranches} handleExportBatch={handleExportBatch} konfirmasiMarkPaid={konfirmasiMarkPaid} loading={loading} markingPaid={markingPaid} setBatalBatch={setBatalBatch} setBatchConfirm={setBatchConfirm} setBatchYear={setBatchYear} setFilterYear={setFilterYear} setKetikBatalBatch={setKetikBatalBatch} skema={skema} tab={tab} tahunAktif={tahunAktif} thCls={thCls} uniqueYears={uniqueYears}
        />

        {/* ─── Late Ticket Queue tab ─── */}
        {tab === 'late' && bisaInput(currentUser) && !loading && (
          <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200" style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.08),rgba(234,88,12,0.05))' }}>
              <h2 className="font-bold text-gray-800"><IkonTeks nama="🕐" />Late Ticket Queue</h2>
              <p className="text-xs text-gray-500 mt-0.5">Ticket Troubleshooting yang masuk setelah cutoff project induk — dilampirkan ke tranche berikutnya yang belum dibayar.</p>
            </div>
            {lateTickets.length === 0
              ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-2xl mb-2"><Ikon nama="📭" ukuran="1em" className="inline-block align-[-0.12em]" /></p>
                  <p className="text-sm text-gray-500 italic">Belum ada late ticket yang dilampirkan.</p>
                </div>
              )
              : (
                <div className="divide-y divide-gray-100">
                  {lateTickets.map(lt => (
                    <div key={lt.id} className="px-5 py-3 flex items-center justify-between hover:bg-amber-50/40 transition-colors">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Tranche {lt.attached_tranche_number}</p>
                        <p className="text-xs text-gray-500">{new Date(lt.attached_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}{lt.note ? ` · ${lt.note}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-amber-700">{formatRupiah(lt.ticket_value || 0)}</span>
                        {lt.is_sunset && <span className="px-2 py-0.5 rounded-sm text-[11px] font-bold text-orange-600 bg-orange-50 border border-orange-200">Sunset</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        )}

        {/* ─── Skema pembagian (admin) ─── */}
        {tab === 'skema' && bisaKonfig(currentUser) && (
          <SchemeTab
            olehNama={(currentUser?.full_name as string) || (currentUser?.username as string) || 'admin'}
            notify={notify}
          />
        )}

        {/* ─── Settings tab ─── */}
        <TabPengaturanAkses
          allUsers={allUsers} cariUser={cariUser} currentUser={currentUser} handleSetAkses={handleSetAkses} handleSetBrandScope={handleSetBrandScope} loading={loading} setCariUser={setCariUser} tab={tab}
        />
      </div>
    </>
  );
}
