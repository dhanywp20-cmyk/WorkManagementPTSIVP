'use client';

import { IkonTeks } from '@/components/shared/Ikon';
import { formatRupiah } from './calc';
import { FilterProyekInsentif } from './FilterProyekInsentif';
import { DaftarProyekInsentifHP } from './DaftarProyekInsentifHP';
import { TabelProyekInsentif } from './TabelProyekInsentif';
import { TabJadwalTranche } from './TabJadwalTranche';
import { TabLateTicket } from './TabLateTicket';
import { bisaKonfig } from './aturan-halaman';
import { SchemeTab } from './SchemeTab';
import { TabPengaturanAkses } from './TabPengaturanAkses';
import { useKonteksInsentif } from './konteks-insentif';

export function IsiInsentif() {
  const k = useKonteksInsentif();
  const { currentUser, loading, notify, tab } = k.sesi;
  const { exportingSaya, handleExportInsentifSaya, myPaidInsentif, myPendingInsentif, myProjectCount, mySplitsInYear, myTotalInsentif } = k.saya;
  const { filterBastYear } = k.proyek;
  return (
    <>
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: 'rgba(99,102,241,0.2)', borderTopColor: '#f43f5e' }} />
          </div>
        )}

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
            <FilterProyekInsentif />
            <DaftarProyekInsentifHP />

            <TabelProyekInsentif />
          </div>
        </>)}

        <TabJadwalTranche />

        <TabLateTicket />

        {tab === 'skema' && bisaKonfig(currentUser) && (
          <SchemeTab
            olehNama={(currentUser?.full_name as string) || (currentUser?.username as string) || 'admin'}
            notify={notify}
          />
        )}

        <TabPengaturanAkses />
      </div>
    </>
  );
}
