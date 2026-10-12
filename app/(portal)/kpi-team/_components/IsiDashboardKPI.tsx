'use client';

/** IsiDashboardKPI - dipecah dari app/(portal)/kpi-team/_components/DashboardKPI.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { PitaRingkas } from './DashboardKPI-pita';
import { RelSeksi } from './DashboardKPI-ubin';
import { BarisTicketKPI } from './dasbor/BarisTicketKPI';
import { BarisRingkasanKPI } from './dasbor/BarisRingkasanKPI';
import { BarisTrenKPI } from './dasbor/BarisTrenKPI';
import { AuditEntry, KPIData, Scope } from './DashboardKPI-tipe';
import { AuditRow } from './DashboardKPI-tren';
import React from 'react';

export interface IsiDashboardKPIProps {
  auditFilter: "all" | "ticket" | "reminder" | "piket" | "user";
  auditLoading: boolean;
  auditSearch: string;
  filteredAudit: AuditEntry[];
  kpi: KPIData | null;
  loading: boolean;
  scope: Scope;
  setAuditFilter: React.Dispatch<React.SetStateAction<"all" | "ticket" | "reminder" | "piket" | "user">>;
  setAuditSearch: React.Dispatch<React.SetStateAction<string>>;
  tab: "analytics";
}

export function IsiDashboardKPI({ auditFilter, auditLoading, auditSearch, filteredAudit, kpi, loading, scope, setAuditFilter, setAuditSearch, tab }: IsiDashboardKPIProps) {
  return (
    <>
      <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-4 items-start">

        {/* ══════════ TAB ANALYTICS ══════════ */}
        {tab==='analytics' && (
          <div className="grid grid-cols-1 gap-3 lg:contents">

            {/*  Jangkar halaman. Lihat PitaRingkas untuk alasannya. */}
            <PitaRingkas kpi={kpi} loading={loading}
              catatan={scope.kind==='pts_sup' ? (scope.ptsTeamType ?? 'Tim') : scope.kind==='admin' ? 'Semua Tim' : 'Tim Saya'}/>

            <RelSeksi judul="Operasional"/>

            {/*
              Empat ubin operasional. Anatominya SENADA (permukaan, kepala,
              angka utama) tapi tidak identik: Ticket/Reminder/Unit memakai
              bilah rasio, Piket memakai cincin + papan nama karena isinya
              memang NAMA, bukan besaran yang bisa dibandingkan panjangnya.
            */}
            <BarisTicketKPI
              kpi={kpi} loading={loading} scope={scope}
            />

            <RelSeksi judul="Distribusi Tiket"/>

            <BarisRingkasanKPI
              kpi={kpi} loading={loading}
            />

            <RelSeksi judul="Tim & Pembelajaran"/>

            <BarisTrenKPI
              kpi={kpi} loading={loading} scope={scope}
            />

          </div>
        )}

        {/* Cross-Module and Audit Trail tabs removed — moved to Analytics Platform page */}

        {(tab as string)==='audit_removed'&&(
          <div className="rounded-2xl p-4 space-y-3"
            style={{ background:'rgba(255,255,255,0.92)', backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)', border:'1px solid rgba(0,0,0,0.07)', boxShadow:'0 2px 16px rgba(0,0,0,0.08)' }}>
            {/* Search + filter */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <svg aria-hidden="true" focusable="false" className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <input aria-label="Cari actor, aksi, target..." value={auditSearch} onChange={e=>setAuditSearch(e.target.value)}
                  placeholder="Cari actor, aksi, target..."
                  className="w-full rounded-lg pl-8 pr-3 py-2 text-sm outline-none bg-slate-50 border border-slate-200 text-slate-700 focus:border-blue-300 focus:ring-1 focus:ring-blue-100 transition-all"/>
              </div>
              {(['all','ticket','reminder','piket','user'] as const).map(f=>(
                <button key={f} onClick={()=>setAuditFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold tracking-wide transition-all border ${auditFilter===f ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                  {f==='all'?'SEMUA':f.toUpperCase()}
                </button>
              ))}
              <span className="text-sm ml-auto tracking-widest text-slate-500">{filteredAudit.length} ENTRI</span>
            </div>
            {/* List */}
            <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1"
              style={{ scrollbarWidth:'thin', scrollbarColor:'rgba(0,0,0,0.1) transparent' }}>
              {auditLoading
                ? Array.from({length:6}).map((_,i)=>(
                    <div key={i} className="h-12 rounded-lg animate-pulse bg-slate-100"/>
                  ))
                : filteredAudit.length===0
                  ? <div className="text-center py-12 text-sm tracking-widest text-slate-500">TIDAK ADA DATA</div>
                  : filteredAudit.map((entry:AuditEntry,idx:number)=>(
                      <div key={entry.id??idx}><AuditRow entry={entry}/></div>
                    ))}
            </div>
          </div>
        )}

      </div>
    </>
  );
}
