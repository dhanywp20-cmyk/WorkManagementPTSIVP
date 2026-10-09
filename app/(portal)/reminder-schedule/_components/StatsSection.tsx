'use client';
import { StatCard, MiniPieChart } from '@/components/shared';
import type { Status } from './shared';

type PieDatum = { label?: string; name?: string; value: number; color: string };

/**
 * Kartu ringkasan (clickable filter) + 4 pie chart - dipindah dari
 * app/reminder-schedule/page.tsx apa adanya (JSX identik). State & handler
 * tetap di page.tsx, komponen ini murni presentasional.
 */
export function StatsSection({
  totalCount, pendingCount, doneCount, todayCount,
  filterStatus, setFilterStatus, selectedCalDay, setSelectedCalDay,
  projectPieData, salesPieData, teamPtsPieData, productPieData,
  filterCategory, setFilterCategory,
  searchDivisionSales, setSearchDivisionSales,
  searchTeamHandler, setSearchTeamHandler,
  productFilter, setProductFilter,
}: {
  totalCount: number;
  pendingCount: number;
  doneCount: number;
  todayCount: number;
  filterStatus: Status | 'all';
  setFilterStatus: (v: Status | 'all') => void;
  selectedCalDay: string | null;
  setSelectedCalDay: (v: string | null) => void;
  projectPieData: PieDatum[];
  salesPieData: PieDatum[];
  teamPtsPieData: PieDatum[];
  productPieData: PieDatum[];
  filterCategory: string;
  setFilterCategory: (v: string) => void;
  searchDivisionSales: string;
  setSearchDivisionSales: (v: string) => void;
  searchTeamHandler: string;
  setSearchTeamHandler: (v: string) => void;
  productFilter: string | null;
  setProductFilter: (v: string | null) => void;
}) {
  return (
    <>
      {/* ── Stat cards (clickable filter) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: 'Total Jadwal', value: totalCount, sub: 'Semua reminder', accent: '#4f46e5',
            onClick: () => { setFilterStatus('all'); setSelectedCalDay(null); },
            active: filterStatus === 'all' && !selectedCalDay },
          { label: 'Pending', value: pendingCount, sub: 'Menunggu tindakan', accent: '#b45309',
            onClick: () => setFilterStatus(filterStatus === 'pending' ? 'all' : 'pending'),
            active: filterStatus === 'pending' },
          { label: 'Selesai', value: doneCount, sub: 'Terselesaikan', accent: '#047857',
            onClick: () => setFilterStatus(filterStatus === 'done' ? 'all' : 'done'),
            active: filterStatus === 'done' },
          { label: 'Hari Ini', value: todayCount, sub: 'Jadwal hari ini', accent: '#0e7490',
            onClick: () => setSelectedCalDay(selectedCalDay === new Date().toISOString().split('T')[0] ? null : new Date().toISOString().split('T')[0]),
            active: selectedCalDay === new Date().toISOString().split('T')[0] },
        ].map((card, i) => <StatCard key={i} {...card} />)}
      </div>

      {/* ── Pie Charts — klick untuk filter ── */}
      {/*
        2 kolom di ponsel, menyusul 9 modul lain yang sudah begini
        (lihat commit "Grafik lingkaran: dua kolom di ponsel"). Sempat
        DIKUNCI ke 1 kolom di sini secara khusus karena saat itu isi kartu
        (donat + legenda) masih ~171px sementara kolom di HP 360px cuma
        menyediakan ~167px - meleset tipis, dan grid tidak bisa menyusutkan
        kartu di bawah lebar isinya sehingga baris ini saja yang mendorong
        SELURUH halaman melebar ke samping.

        MiniPieChart sendiri sudah diperketat lagi sejak itu (lihat
        catatan di dalamnya) sampai ~148px - sekarang 2 kolom aman dengan
        selisih yang cukup, bukan cuma pas-pasan seperti modul lain.
      */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 sm:gap-4">
        <MiniPieChart
          data={projectPieData} title="Kegiatan / Kategori" icon="🖥️"
          activeFilter={filterCategory !== 'all' ? filterCategory : null}
          onSliceClick={label => setFilterCategory(filterCategory === label ? 'all' : label)}
        />
        <MiniPieChart
          data={salesPieData} title="Divisi Sales" icon="👤"
          activeFilter={searchDivisionSales || null}
          onSliceClick={label => setSearchDivisionSales(searchDivisionSales === label ? '' : label)}
        />
        <MiniPieChart
          data={teamPtsPieData} title="Team PTS IVP" icon="👥"
          activeFilter={searchTeamHandler || null}
          onSliceClick={label => setSearchTeamHandler(searchTeamHandler === label ? '' : label)}
        />
        <MiniPieChart
          data={productPieData} title="Product / Unit" icon="📦"
          activeFilter={productFilter}
          onSliceClick={label => setProductFilter(productFilter === label ? null : label)}
        />
      </div>
    </>
  );
}
