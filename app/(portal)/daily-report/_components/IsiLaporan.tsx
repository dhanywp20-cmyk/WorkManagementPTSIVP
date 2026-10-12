'use client';

/** IsiLaporan - dipecah dari app/(portal)/daily-report/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { MiniPieChart, StatCardGrid, Paginasi, TombolEkspor } from '@/components/shared';
import { todayISO, type DailyReport, RENTANG_HARI } from './shared';
import { Ikon } from '@/components/shared/Ikon';
import { card, cardHdr, type FlatRow } from './bantu-halaman';
import { FilterLaporanHarian } from './FilterLaporanHarian';
import { DaftarLaporanHarian } from './DaftarLaporanHarian';
import { type TeamUser } from '@/app/(portal)/reminder-schedule/_components/shared';
import type { Ekspor } from '@/lib/ekspor-tabel';

export interface IsiLaporanProps {
  belumLaporHariIni: TeamUser[];
  bolehHapus: (row: any) => boolean;
  catPieData: { label: string; value: number; color: string; }[];
  dataEkspor: () => Ekspor<FlatRow>;
  divisionPieData: { label: string; value: number; color: string; }[];
  filterCategory: string | null;
  filterDate: string;
  filterDivision: string | null;
  filterHandler: string | null;
  filterProduct: string | null;
  filterSource: string;
  filterStatus: string;
  filterUser: string;
  filteredRows: FlatRow[];
  hal: import("@/components/shared/Paginasi").HasilPaginasi<FlatRow>;
  handlerPieData: { label: string; value: number; color: string; }[];
  judulKelompokPTS: string;
  lihatSemua: boolean;
  liveLoading: boolean;
  loadLiveData: () => Promise<void>;
  loadReports: () => Promise<void>;
  mintaHapus: (row: any) => void;
  openEditForm: (report: DailyReport) => Promise<void>;
  pimpinan: boolean;
  productPieData: { label: string; value: number; color: string; }[];
  reports: DailyReport[];
  searchProject: string;
  setFilterCategory: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setFilterDate: import("react").Dispatch<import("react").SetStateAction<string>>;
  setFilterDivision: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setFilterHandler: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setFilterProduct: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setFilterSource: import("react").Dispatch<import("react").SetStateAction<string>>;
  setFilterStatus: import("react").Dispatch<import("react").SetStateAction<string>>;
  setFilterUser: import("react").Dispatch<import("react").SetStateAction<string>>;
  setModalRow: import("react").Dispatch<any>;
  setSearchProject: import("react").Dispatch<import("react").SetStateAction<string>>;
  stats: { total: number; pending: number; selesai: number; hariIni: number; fromTicket: number; fromReminder: number; fromManual: number; };
  teamUsers: TeamUser[];
}

export function IsiLaporan({ belumLaporHariIni, bolehHapus, catPieData, dataEkspor, divisionPieData, filterCategory, filterDate, filterDivision, filterHandler, filterProduct, filterSource, filterStatus, filterUser, filteredRows, hal, handlerPieData, judulKelompokPTS, lihatSemua, liveLoading, loadLiveData, loadReports, mintaHapus, openEditForm, pimpinan, productPieData, reports, searchProject, setFilterCategory, setFilterDate, setFilterDivision, setFilterHandler, setFilterProduct, setFilterSource, setFilterStatus, setFilterUser, setModalRow, setSearchProject, stats, teamUsers }: IsiLaporanProps) {
  return (
    <>
      <div className="flex-1 overflow-y-auto max-w-[1600px] mx-auto px-5 py-5 space-y-5 pb-12 w-full">

        {/* ── Stat cards besar (identik reminder-schedule) ── */}
        <StatCardGrid cols={4} items={[
          { label: 'Total Aktivitas', sub: 'Semua platform', value: stats.total, accent: '#4f46e5' },
          { label: 'Pending', sub: 'Menunggu tindakan', value: stats.pending, accent: '#b45309' },
          { label: 'Selesai', sub: 'Terselesaikan', value: stats.selesai, accent: '#047857' },
          { label: 'Hari Ini', sub: todayISO(), value: stats.hariIni, accent: '#0e7490' },
        ]} />

        {/* M7: siapa yang belum lapor hari ini - hanya untuk admin/supervisor */}
        {belumLaporHariIni.length > 0 && (
          // Latar SEBELUMNYA rgba(220,38,38,0.06) - opasitas 6% - hampir
          // tembus pandang. Halaman ini punya foto latar tetap
          // (backgroundAttachment: fixed di PW di atas), jadi panel ini
          // dulu nyaris hanya berupa teks merah tua mengambang langsung di
          // atas foto gedung, tanpa kartu solid di belakangnya - persis
          // yang bikin tulisan "sangat transparan"/susah dibaca. Kartu lain
          // di halaman ini (mis. strip "Sumber Data" di bawah) sudah pakai
          // latar putih ~92% + backdrop-blur; panel ini disamakan, dengan
          // aksen merah tetap dipertahankan di border supaya nuansa
          // "peringatan"-nya tidak hilang.
          <div className="rounded-2xl px-5 py-3.5 flex items-center gap-3 flex-wrap" style={{ background: 'rgba(255,255,255,0.94)', border: '1px solid rgba(220,38,38,0.25)', backdropFilter: 'blur(10px)', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
            <span className="text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5" style={{ color: '#b91c1c' }}>
              🔴 Belum Lapor Hari Ini ({belumLaporHariIni.length})
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {belumLaporHariIni.map(u => (
                <span key={u.id} className="px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: 'rgba(220,38,38,0.1)', color: '#991b1b' }}>
                  {u.full_name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Source breakdown strip ── */}
        <div className="rounded-2xl px-5 py-3.5 flex items-center gap-6 flex-wrap" style={{ background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
          <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Sumber Data</span>
          {([
            { label: 'Ticketing', value: stats.fromTicket,   icon: '🎫', bg: 'rgba(251,113,133,0.12)', color: '#be185d',  source: 'ticket' },
            { label: 'Schedule',  value: stats.fromReminder, icon: '🔔', bg: 'rgba(16,185,129,0.1)',   color: '#047857',  source: 'reminder' },
            { label: 'Manual',    value: stats.fromManual,   icon: '✍️', bg: 'rgba(245,158,11,0.1)',   color: '#b45309',  source: 'manual' },
          ] as const).map(s => (
            <button key={s.source}
              onClick={() => setFilterSource(filterSource === s.source ? '' : s.source)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all hover:scale-[1.03]"
              style={{ background: filterSource === s.source ? s.bg : 'rgba(0,0,0,0.03)', color: filterSource === s.source ? s.color : '#64748b', border: filterSource === s.source ? `1.5px solid ${s.color}40` : '1.5px solid transparent' }}>
              <span><Ikon nama={s.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /></span>
              <span>{s.label}</span>
              <span className="ml-1 font-black text-sm" style={{ color: s.color }}>{s.value}</span>
              {filterSource === s.source && <span className="text-[10px] ml-0.5">✕</span>}
            </button>
          ))}
          {filterSource && (
            <span className="text-[11px] text-slate-500 italic ml-auto">Klik badge untuk reset filter</span>
          )}
        </div>

        {/* ── Charts row ── */}
        {/* Satu-satunya grafik di platform ini yang dulu memakai grid-cols-4
            tanpa titik henti - semua halaman lain sudah grid-cols-1 md:...
            Di ponsel itu berarti empat kolom selebar ~80px, dan di situlah
            legendanya terhimpit habis. */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          <MiniPieChart
            data={catPieData} title="Kegiatan / Kategori" icon="🖥️"
            activeFilter={filterCategory}
            onSliceClick={label => setFilterCategory(filterCategory === label ? null : label)}
          />
          <MiniPieChart
            data={handlerPieData} title={judulKelompokPTS} icon="👥"
            activeFilter={filterHandler}
            onSliceClick={label => setFilterHandler(filterHandler === label ? null : label)}
          />
          <MiniPieChart
            data={divisionPieData} title="Divisi Sales" icon="👔"
            activeFilter={filterDivision}
            onSliceClick={label => setFilterDivision(filterDivision === label ? null : label)}
          />
          <MiniPieChart
            data={productPieData} title="Distribusi Produk" icon="🏷️"
            activeFilter={filterProduct}
            onSliceClick={label => setFilterProduct(filterProduct === label ? null : label)}
          />
        </div>

        {/* ── Schedule/Activity List ── */}
        <div style={card}>
          <div style={cardHdr}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Activity List</span>
              <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2.5 py-1 rounded-full">{filteredRows.length}</span>
              {liveLoading && <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />}
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
            <TombolEkspor jumlah={filteredRows.length} data={dataEkspor} />
            <button onClick={() => { loadLiveData(); loadReports(); }} disabled={liveLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:bg-slate-100 disabled:opacity-50"
              style={{ background: 'rgba(0,0,0,0.04)', border: '1.5px solid rgba(0,0,0,0.09)', color: '#475569' }}>
              <svg aria-hidden="true" focusable="false" className={`w-3.5 h-3.5 ${liveLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Refresh
            </button>
            </div>
          </div>

          {/* Active filter chips from pie charts */}
          {(filterCategory || filterHandler || filterDivision || filterProduct) && (
            <div className="px-5 pt-3 flex flex-wrap gap-2">
              {filterCategory && (
                <button onClick={() => setFilterCategory(null)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80"
                  style={{ background: '#7c3aed' }}>
                  <Ikon nama="🏷" ukuran="1em" className="inline-block align-[-0.12em]" /> {filterCategory} ✕
                </button>
              )}
              {filterHandler && (
                <button onClick={() => setFilterHandler(null)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80"
                  style={{ background: '#0ea5e9' }}>
                  <Ikon nama="👥" ukuran="1em" className="inline-block align-[-0.12em]" /> {filterHandler} ✕
                </button>
              )}
              {filterDivision && (
                <button onClick={() => setFilterDivision(null)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80"
                  style={{ background: '#10b981' }}>
                  <Ikon nama="👔" ukuran="1em" className="inline-block align-[-0.12em]" /> {filterDivision} ✕
                </button>
              )}
              {filterProduct && (
                <button onClick={() => setFilterProduct(null)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80"
                  style={{ background: '#f59e0b' }}>
                  <Ikon nama="🏷" ukuran="1em" className="inline-block align-[-0.12em]" /> {filterProduct} ✕
                </button>
              )}
            </div>
          )}

          {/* Search + filter bar identik reminder-schedule */}
          <FilterLaporanHarian
            filterDate={filterDate} filterSource={filterSource} filterStatus={filterStatus} filterUser={filterUser} lihatSemua={lihatSemua} searchProject={searchProject} setFilterDate={setFilterDate} setFilterSource={setFilterSource} setFilterStatus={setFilterStatus} setFilterUser={setFilterUser} setSearchProject={setSearchProject} teamUsers={teamUsers}
          />
          {!filterDate && (
            <p className="text-[11.5px] text-slate-500 -mt-1 mb-2">
              Menampilkan {RENTANG_HARI} hari terakhir. Pilih tanggal untuk melihat hari yang lebih lama.
            </p>
          )}

          {/* Table */}
          <DaftarLaporanHarian
            bolehHapus={bolehHapus} filterCategory={filterCategory} filterDate={filterDate} filterSource={filterSource} filterStatus={filterStatus} filterUser={filterUser} filteredRows={filteredRows} hal={hal} liveLoading={liveLoading} mintaHapus={mintaHapus} openEditForm={openEditForm} pimpinan={pimpinan} reports={reports} searchProject={searchProject} setFilterCategory={setFilterCategory} setFilterDate={setFilterDate} setFilterSource={setFilterSource} setFilterStatus={setFilterStatus} setFilterUser={setFilterUser} setModalRow={setModalRow} setSearchProject={setSearchProject}
          />
        </div>
      </div>
    </>
  );
}
