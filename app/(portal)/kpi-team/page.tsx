'use client';
import { isPimpinan } from '@/lib/pimpinan';
import { PageHeader } from '@/components/shared';
import { PERIODS, KPI_COLOR } from './_components/shared';
import { DrillModal } from './_components/DrillModal';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { ModalPengaturanKPI } from './_components/ModalPengaturanKPI';
import { ModalDetailSnapshot } from './_components/ModalDetailSnapshot';
import { ModalMulaiKPI } from './_components/ModalMulaiKPI';
import { ModalDetailAnggotaKPI } from './_components/ModalDetailAnggotaKPI';
import { BagianRiwayatKPI } from './_components/BagianRiwayatKPI';
import { TabelKinerjaHandler } from './_components/TabelKinerjaHandler';
import { BagianPenilaianKPI } from './_components/BagianPenilaianKPI';
import { useKpiTeam } from './_components/useKpiTeam';

export default function KPITeamPage() {
  const {
    isLoggedIn, appReady, scopeReady, scope, currentUser, fetchAllData, fetchKPIMembers,
    setShowStartKPI, kpiLoading, kpiMembers, kpiYear, setShowSettings, sortedMembers, period, kpiSettings,
    calcKPI, filterTeam, kpiFiltered, kpiPeriodLabel, kpiPeriodLen, kpiScoreColor, kpiScoreLabel, kpiStartMonth,
    setKpiPeriodLen, setKpiStartMonth, setKpiYear, setSelectedKPIMember, setPeriod, periodLabel, loading, allTeamTypes,
    setFilterTeam, SortIcon, handleSort, searchQ, setDrillMember, setSearchQ, expandedSnapshot, kpiSnapshots,
    setExpandedSnapshot, setSelectedSnapMember, drillMember, selectedKPIMember, saveKPISnapshot, savingSnapshot, showStartKPI, selectedSnapMember,
    saveKpiSettings, setKpiSettings, showSettings,
  } = useKpiTeam();

  if (!isLoggedIn || !appReady) return (
    <div className="flex items-center justify-center min-h-screen"
      style={{ background: 'var(--latar-halaman)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>
      <div className="w-8 h-8 border-[3px] rounded-full animate-spin" style={{ borderColor: 'rgba(2,132,199,0.2)', borderTopColor: '#0284c7' }} />
    </div>
  );

  if (scopeReady && scope.kind === 'none') return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3"
      style={{ background: 'var(--latar-halaman)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>
      <div className="flex flex-col items-center gap-3 px-8 py-6 rounded-2xl"
        style={{ background: 'rgba(255,255,255,0.92)', boxShadow: '0 8px 32px rgba(0,0,0,0.14)' }}>
        <span className="text-5xl"><Ikon nama="🔒" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
        <p className="text-slate-600 text-sm font-semibold">Akses Terbatas</p>
        <p className="text-slate-500 text-xs">Halaman ini hanya untuk Admin & Supervisor PTS</p>
      </div>
    </div>
  );

  return (
    <div className="h-screen overflow-hidden flex flex-col"
      style={{ background: 'var(--latar-halaman)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>
      <PageHeader icon="📊" title="KPI Team" subtitle="PTS IVP — Key Performance Indicators">
        {scope.kind === 'team' && (
          <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg"
            style={{ background: 'rgba(14,165,233,0.12)', color: '#0369a1', border: '1px solid rgba(14,165,233,0.3)' }}>
            <IkonTeks nama="👤" />Profil KPI Saya
          </span>
        )}
        {!isPimpinan(currentUser) && (
        <button onClick={() => { fetchAllData(); fetchKPIMembers(); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all"
          style={{ background: 'rgba(255,255,255,0.9)', borderColor: '#e2e8f0', color: '#64748b' }}>
          <svg aria-hidden="true" focusable="false" className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          Sync
        </button>
        )}
        {scope.kind !== 'team' && !isPimpinan(currentUser) && (
          <>
            <button onClick={() => setShowStartKPI(true)}
              disabled={kpiLoading || kpiMembers.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#047857', borderColor: '#047857', color: '#fff', boxShadow: '0 2px 8px rgba(4,120,87,0.3)' }}>
              <IkonTeks nama="🚀" />Mulai KPI {kpiYear}
            </button>
            <button onClick={() => setShowSettings(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all"
              style={{ background: 'rgba(255,255,255,0.9)', borderColor: '#ddd6fe', color: '#7c3aed' }}>
              <svg aria-hidden="true" focusable="false" className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              Pengaturan KPI
            </button>
            <button onClick={async () => { const { exportKPIExcel } = await import('./_components/ekspor-kpi'); exportKPIExcel(sortedMembers, period, kpiSettings, `${kpiYear}`); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all"
              style={{ background: KPI_COLOR, borderColor: KPI_COLOR, color: '#fff', boxShadow: `0 2px 8px ${KPI_COLOR}40` }}>
              <IkonTeks nama="⬇" />Export KPI Excel
            </button>
          </>
        )}
      </PageHeader>

      <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1600px] mx-auto px-4 py-4 space-y-4">

        <BagianPenilaianKPI
          calcKPI={calcKPI} currentUser={currentUser} fetchKPIMembers={fetchKPIMembers} filterTeam={filterTeam} kpiFiltered={kpiFiltered} kpiLoading={kpiLoading} kpiPeriodLabel={kpiPeriodLabel} kpiPeriodLen={kpiPeriodLen} kpiScoreColor={kpiScoreColor} kpiScoreLabel={kpiScoreLabel} kpiSettings={kpiSettings} kpiStartMonth={kpiStartMonth} kpiYear={kpiYear} setKpiPeriodLen={setKpiPeriodLen} setKpiStartMonth={setKpiStartMonth} setKpiYear={setKpiYear} setSelectedKPIMember={setSelectedKPIMember}
        />

        <div className="flex items-center gap-2 flex-wrap rounded-2xl px-3 py-2 border border-slate-200 shadow-xs"
          style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)' }}>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">Periode</span>
          {PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all"
              style={{
                background:   period === p ? KPI_COLOR : 'rgba(255,255,255,0.85)',
                color:        period === p ? '#fff' : '#64748b',
                borderColor:  period === p ? KPI_COLOR : '#e2e8f0',
                boxShadow:    period === p ? `0 2px 10px ${KPI_COLOR}50` : '0 1px 4px rgba(0,0,0,0.08)',
              }}>
              {p}
            </button>
          ))}
          <span className="ml-2 text-[11px] text-slate-500">{periodLabel}</span>

          {loading && (
            <div className="ml-2 w-4 h-4 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin shrink-0" />
          )}

          {scope.kind === 'admin' && allTeamTypes.length > 1 && (
            <select aria-label="Semua Tim" value={filterTeam} onChange={e => setFilterTeam(e.target.value)}
              className="ml-auto text-[11px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 font-medium focus:outline-hidden focus:ring-2 focus:ring-sky-200">
              <option value="all">Semua Tim</option>
              {allTeamTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
        </div>

        <TabelKinerjaHandler
          SortIcon={SortIcon} filterTeam={filterTeam} handleSort={handleSort} loading={loading} period={period} searchQ={searchQ} setDrillMember={setDrillMember} setFilterTeam={setFilterTeam} setSearchQ={setSearchQ} sortedMembers={sortedMembers}
        />

        <BagianRiwayatKPI
          expandedSnapshot={expandedSnapshot} kpiSnapshots={kpiSnapshots} kpiYear={kpiYear} setExpandedSnapshot={setExpandedSnapshot} setSelectedSnapMember={setSelectedSnapMember}
        />

      </div>
      </div>

      {drillMember && (
        <DrillModal member={drillMember} period={period} onClose={() => setDrillMember(null)}
          onViewBreakdown={() => { const id = drillMember.id; setDrillMember(null); setSelectedKPIMember(id); }} />
      )}

      <ModalDetailAnggotaKPI
        kpiMembers={kpiMembers} kpiSettings={kpiSettings} kpiYear={kpiYear} selectedKPIMember={selectedKPIMember} setSelectedKPIMember={setSelectedKPIMember}
      />

      <ModalMulaiKPI
        kpiMembers={kpiMembers} kpiPeriodLabel={kpiPeriodLabel} kpiSettings={kpiSettings} kpiYear={kpiYear} saveKPISnapshot={saveKPISnapshot} savingSnapshot={savingSnapshot} setShowStartKPI={setShowStartKPI} showStartKPI={showStartKPI}
      />

      <ModalDetailSnapshot
        kpiSnapshots={kpiSnapshots} selectedSnapMember={selectedSnapMember} setSelectedSnapMember={setSelectedSnapMember}
      />

      <ModalPengaturanKPI
        kpiSettings={kpiSettings} saveKpiSettings={saveKpiSettings} setKpiSettings={setKpiSettings} setShowSettings={setShowSettings} showSettings={showSettings}
      />
    </div>
  );
}
