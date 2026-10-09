'use client';

/** BarisTrenKPI - dipecah dari app/(portal)/kpi-team/_components/DashboardKPI.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { UBIN, BAYANG_UBIN, RelAksen } from '@/app/(portal)/dashboard/_components/widgets/primitives';
import { Ikon } from '@/components/shared/Ikon';
import { AKSEN, BAIK, Cincin, HATI, KRITIS, KepalaUbin, TrenBulanan, type KPIData, type Scope } from '../DashboardKPI';

export interface BarisTrenKPIProps {
  kpi: KPIData | null;
  loading: boolean;
  scope: Scope;
}

export function BarisTrenKPI({ kpi, loading, scope }: BarisTrenKPIProps) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:contents">

        {/* TREND — area, lihat TrenBulanan */}
        <div className={`${UBIN} ${scope.kind==='admin'?'lg:col-span-6':'lg:col-span-12'} h-full`} style={{ boxShadow: BAYANG_UBIN }}>
          <RelAksen warna={AKSEN}/>
          <KepalaUbin ikon="📈" judul={`Trend Ticket Bulanan ${new Date().getFullYear()}`} warna={AKSEN}
            catatan={!loading&&kpi ? `${kpi.tickets.monthlyTickets.reduce((s,v)=>s+v,0)} total` : undefined}/>
          {loading ? <div className="h-36 rounded animate-pulse bg-slate-100"/>
            : kpi?.tickets.monthlyTickets?.some(v=>v>0)
              ? <TrenBulanan data={kpi.tickets.monthlyTickets}
                  {...(scope.kind!=='admin' ? { viewW: 1400, viewH: 220 } : {})}/>
              : <div className="flex flex-col items-center gap-2 py-10">
                  <span className="text-3xl opacity-20" aria-hidden="true"><Ikon nama="📊" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                  <p className="text-[11px] text-slate-500">Belum ada data ticket tahun ini.</p>
                </div>}
        </div>

        {scope.kind==='admin' && <>
          {/* LEARNING CENTER */}
          <div className={`${UBIN} lg:col-span-3 h-full`} style={{ boxShadow: BAYANG_UBIN }}>
            <RelAksen warna={BAIK}/>
            <KepalaUbin ikon="🎓" judul="Learning Center" warna={BAIK}/>
            <div className="grid grid-cols-3 gap-3">
              {[
                {label:'Peserta',  value:kpi?.learning.totalParticipants??0, w:'#0f172a'},
                {label:'Attempt',  value:kpi?.learning.totalSessions??0,     w:'#0f172a'},
                {label:'Avg skor', value:kpi?.learning.avgScore??0,          w:BAIK},
              ].map(s=>(
                <div key={s.label}>
                  <p className="text-[10px] font-black uppercase tracking-[0.07em] text-slate-500 truncate">{s.label}</p>
                  {loading
                    ? <div className="h-6 w-10 rounded bg-slate-100 animate-pulse mt-1"/>
                    : <p className="text-[24px] font-black leading-none mt-1 tabular-nums" style={{color:s.w,letterSpacing:'-0.03em'}}>{s.value}</p>}
                </div>
              ))}
            </div>
            {/*  Pass rate sebagai satu cincin - bagian-dari-keseluruhan
                yang sesungguhnya, menggantikan dua donat yang dulu
                menyatakan rasio yang sama dua kali. */}
            {!loading&&kpi&&(()=>{
              const gagal = Math.max(kpi.learning.totalSessions-kpi.learning.completedSessions,0);
              const pct = kpi.learning.totalSessions>0
                ? Math.round((kpi.learning.completedSessions/kpi.learning.totalSessions)*100) : 0;
              const w = pct>=80?BAIK:pct>=60?HATI:KRITIS;
              return (
                <div className="flex items-center gap-3.5 mt-auto pt-4">
                  <Cincin ukuran={72} warna={w} nilai={kpi.learning.completedSessions} dari={kpi.learning.totalSessions} teks={`${pct}%`}/>
                  <div className="min-w-0">
                    <p className="text-[11px] font-extrabold text-slate-700">Pass rate</p>
                    <div className="flex flex-col gap-1 mt-1.5">
                      <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                        <i className="w-2.5 h-2.5 rounded-[3px] flex-shrink-0" style={{background:w}}/>{kpi.learning.completedSessions} lulus</span>
                      <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                        <i className="w-2.5 h-2.5 rounded-[3px] flex-shrink-0" style={{background:'#e2e8f0'}}/>{gagal} gagal</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/*
            Pengguna: satu bilah bertumpuk, bukan empat bilah terpisah.
            Yang ditanyakan tentang peran akun adalah KOMPOSISI - berapa
            bagian dari seluruh akun - dan itu justru hilang kalau tiap
            peran diberi bilah sendiri dengan patokan panjang yang sama.
          */}
          <div className={`${UBIN} lg:col-span-3 h-full`} style={{ boxShadow: BAYANG_UBIN }}>
            <RelAksen warna="#475569"/>
            <KepalaUbin ikon="👥" judul="Pengguna" warna="#475569"/>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[38px] font-black leading-[0.92] text-slate-900 tabular-nums" style={{letterSpacing:'-0.035em'}}>
                {loading?'—':(kpi?.users.total??0)}</span>
              <span className="text-[11px] font-bold text-slate-500">akun terdaftar</span>
            </div>
            {!loading&&kpi&&(()=>{
              const WARNA = ['#4f46e5','#7c3aed','#d97706','#94a3b8','#0891b2','#e11d48'];
              const peran = kpi.users.byRole.filter(r=>r.count>0);
              return (
                <div className="mt-auto pt-4">
                  <div className="flex gap-[2px] h-3 rounded-full overflow-hidden">
                    {peran.map((r,i)=>(
                      <span key={r.role??i} title={`${(r.role??'—').toUpperCase()}: ${r.count}`}
                        style={{flex:r.count, background:WARNA[i%WARNA.length]}}/>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 mt-2.5">
                    {peran.map((r,i)=>(
                      <span key={r.role??i} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                        <i className="w-2.5 h-2.5 rounded-[3px] flex-shrink-0" style={{background:WARNA[i%WARNA.length]}}/>
                        {(r.role??'Belum diatur').toUpperCase()} {r.count}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </>}
      </div>
    </>
  );
}
