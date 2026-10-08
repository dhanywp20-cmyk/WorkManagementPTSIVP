'use client';

/** BarisTicketKPI - dipecah dari app/(portal)/kpi-team/_components/DashboardKPI.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { UBIN, BAYANG_UBIN, RelAksen } from '@/app/(portal)/dashboard/_components/widgets/primitives';
import { AKSEN, BAIK, BarisRincian, Cincin, HATI, KRITIS, KakiUbin, KartuModul, KepalaUbin, batasDenganLainnya, type KPIData, type Scope } from '../DashboardKPI';

export interface BarisTicketKPIProps {
  kpi: KPIData | null;
  loading: boolean;
  scope: Scope;
}

export function BarisTicketKPI({ kpi, loading, scope }: BarisTicketKPIProps) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:contents">

        {/* TICKET */}
        <KartuModul
          kelas="lg:col-span-3" ikon="🎫" judul="Ticket" warna="#e11d48"
          catatan={scope.kind==='pts_sup'?scope.ptsTeamType:'Semua'}
          angka={loading?'—':(kpi?.tickets.total??0)}
          satuan="tiket"
          percik={loading?undefined:(kpi?.tickets.monthlyTickets??[]).slice(0, new Date().getMonth()+1)}
          kaki={!loading&&kpi
            ? <KakiUbin kiri="Avg resolusi" warna={BAIK} kanan={`${kpi.tickets.avgResolutionDays} hari`}/>
            : undefined}>
          {loading
            ? [0,1,2].map(i=><div key={i} className="h-1.5 rounded bg-slate-100 animate-pulse"/>)
            : batasDenganLainnya(kpi?.tickets.byStatus??[], 4, count=>({status:'Lainnya',count,color:'#94a3b8'}))
                .map(s=>(
                  <BarisRincian key={s.status} label={s.status} value={s.count}
                    total={kpi?.tickets.total??0}
                    warna={/overdue/i.test(s.status)?KRITIS:/solved|selesai/i.test(s.status)?BAIK:AKSEN}/>
                ))}
        </KartuModul>

        {/* REMINDER SCHEDULE */}
        <KartuModul
          kelas="lg:col-span-3" ikon="📅" judul="Reminder Schedule" warna="#7c3aed"
          angka={loading?'—':(kpi?.reminders.total??0)}
          satuan="jadwal"
          kaki={!loading&&kpi
            ? <KakiUbin kiri="Done rate" warna={BAIK}
                kanan={`${kpi.reminders.total>0?Math.round((kpi.reminders.done/kpi.reminders.total)*100):0}%`}/>
            : undefined}>
          {loading
            ? [0,1,2].map(i=><div key={i} className="h-1.5 rounded bg-slate-100 animate-pulse"/>)
            : <>
                <BarisRincian label="Done"    value={kpi?.reminders.done??0}         total={kpi?.reminders.total??0} warna={BAIK}/>
                <BarisRincian label="Pending" value={kpi?.reminders.pending??0}      total={kpi?.reminders.total??0} warna={HATI}/>
                <BarisRincian label="Overdue" value={kpi?.reminders.overdueCount??0} total={kpi?.reminders.total??0} warna={KRITIS}/>
              </>}
        </KartuModul>

        {/* PIKET SHOWROOM — cincin + papan nama, bukan bilah */}
        <div className={`${UBIN} lg:col-span-3 h-full`} style={{ boxShadow: BAYANG_UBIN }}>
          <RelAksen warna="#0891b2"/>
          <KepalaUbin ikon="🏪" judul="Piket Showroom" warna="#0891b2"
            catatan={new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'short'})}/>
          <div className="flex items-center gap-3.5">
            <Cincin ukuran={82} warna="#0891b2"
              nilai={kpi?.piket.weekFilled??0} dari={kpi?.piket.weekTotal??0}
              teks={loading?'—':`${kpi?.piket.weekFilled??0}/${kpi?.piket.weekTotal??0}`}/>
            {/*  PIC piket adalah NAMA, bukan angka - bilah sepanjang nol
                untuk "belum diisi" cuma menipu mata: terbaca seperti
                nilai nol padahal artinya "belum ada datanya". */}
            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
              {[
                {team:'IVP', person:kpi?.piket.todayIVP},
                {team:'UMP', person:kpi?.piket.todayUMP},
                {team:'MVI', person:kpi?.piket.todayMvi},
              ].map(p=>(
                <div key={p.team} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-[10px] bg-slate-50 border border-black/[0.05]">
                  <span className="text-[11px] font-black tracking-[0.08em] flex-shrink-0" style={{color:'#0e7490'}}>{p.team}</span>
                  {loading
                    ? <span className="inline-block h-2.5 w-16 rounded bg-slate-100 animate-pulse"/>
                    : p.person
                      ? <span className="text-[11px] font-bold text-slate-600 truncate">{p.person}</span>
                      : <span className="text-[11px] font-semibold text-slate-500 italic truncate">Belum diisi</span>}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-auto">
            {!loading&&kpi&&<KakiUbin kiri={`${kpi.piket.kegiatanToday} tamu hari ini`} warna="#0891b2"
              kanan={`${Math.min(100,Math.round((kpi.piket.weekFilled/Math.max(kpi.piket.weekTotal,1))*100))}% terpenuhi`}/>}
          </div>
        </div>

        {/* UNIT MOVEMENT */}
        <KartuModul
          kelas="lg:col-span-3" ikon="🚚" judul="Unit Movement" warna="#d97706"
          catatan="Bulan ini"
          angka={loading?'—':(kpi?.units.totalLogs??0)}
          satuan="log tercatat"
          kaki={!loading&&kpi
            ? <KakiUbin kiri="Saldo bulan ini" warna="#d97706"
                kanan={`${kpi.units.masukThisMonth-kpi.units.keluarThisMonth>0?'+':''}${kpi.units.masukThisMonth-kpi.units.keluarThisMonth} unit`}/>
            : undefined}>
          {loading
            ? [0,1].map(i=><div key={i} className="h-1.5 rounded bg-slate-100 animate-pulse"/>)
            : <>
                <BarisRincian label="Keluar" value={kpi?.units.keluarThisMonth??0} total={kpi?.units.totalLogs??0} warna={HATI}/>
                <BarisRincian label="Masuk"  value={kpi?.units.masukThisMonth??0}  total={kpi?.units.totalLogs??0} warna={BAIK}/>
              </>}
        </KartuModul>
      </div>
    </>
  );
}
