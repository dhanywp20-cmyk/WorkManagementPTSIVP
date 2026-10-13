'use client';
/** DashboardKPI-pita.tsx - dipecah dari DashboardKPI.tsx (scripts/pecah-modul.mjs); DashboardKPI.tsx tetap mengekspor ulang semuanya. */
import { KPIData } from './DashboardKPI-tipe';
import { CincinMini, LabelPita, Percik, PitaItem, RelSeksi } from './DashboardKPI-ubin';

export function PitaRingkas({ kpi, loading, catatan }: { kpi: KPIData | null; loading: boolean; catatan: string }) {
  const bln = new Date().getMonth();
  const deret = (kpi?.tickets.monthlyTickets ?? []).slice(0, bln + 1);
  const tIni  = deret[bln] ?? 0;
  const tLalu = bln > 0 ? (deret[bln - 1] ?? 0) : null;
  const beda  = tLalu === null ? null : tIni - tLalu;
  const rTot  = kpi?.reminders.total ?? 0;
  const pTot  = kpi?.piket.weekTotal ?? 0;
  const open  = kpi?.tickets.open ?? 0;
  const solvedHariIni = kpi?.tickets.resolvedToday ?? 0;
  const kosong = <span className="inline-block h-6 w-12 rounded-sm bg-slate-100 animate-pulse"/>;
  const pctPiket = pTot ? Math.round(((kpi?.piket.weekFilled ?? 0) / pTot) * 100) : 0;
  return (
    <section className="lg:col-span-12" aria-label="Ringkasan Platform">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <RelSeksi judul="Ringkasan Platform"/>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/90 border border-slate-200 text-slate-600">
            {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/90 border border-slate-200 text-slate-600">
            {catatan}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
        <PitaItem label="Tiket bulan ini" ikon="🎫" warna="#1d4ed8" angka={loading ? kosong : tIni}
          visual={!loading && <Percik nilai={deret} warna="#1d4ed8" lebar={96} tinggi={40}/>}>
          {!loading && beda !== null && (
            <span title={`Bulan lalu ${tLalu} tiket`} className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap ${beda > 0 ? 'bg-rose-50 text-rose-700' : beda < 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
              {beda > 0 ? '▲' : beda < 0 ? '▼' : '='} {Math.abs(beda)} vs bulan lalu
            </span>
          )}
        </PitaItem>

        <PitaItem label="Solved hari ini" ikon="✅" warna="#047857" angka={loading ? kosong : solvedHariIni}
          visual={!loading && <CincinMini pct={open + solvedHariIni ? (solvedHariIni / (open + solvedHariIni)) * 100 : 0} warna="#047857"/>}>
          {!loading && <LabelPita>{open} tiket masih terbuka</LabelPita>}
        </PitaItem>

        <PitaItem label="Avg resolusi" ikon="⏱" warna="#6d28d9" satuan="hari" angka={loading ? kosong : (kpi?.tickets.avgResolutionDays ?? 0)}>
          {!loading && <LabelPita>{kpi?.tickets.solved ?? 0} total selesai</LabelPita>}
        </PitaItem>

        <PitaItem label="Reminder overdue" ikon="⏰" warna="#dc2626" angka={loading ? kosong : (kpi?.reminders.overdueCount ?? 0)}
          visual={!loading && <CincinMini pct={rTot ? ((kpi?.reminders.overdueCount ?? 0) / rTot) * 100 : 0} warna="#dc2626"/>}>
          {!loading && <LabelPita>dari {rTot} reminder</LabelPita>}
        </PitaItem>

        <PitaItem label="Piket minggu ini" ikon="🏪" warna="#0f766e" satuan={pTot ? `/${pTot}` : undefined}
          angka={loading ? kosong : (kpi?.piket.weekFilled ?? 0)}
          visual={!loading && <CincinMini pct={pctPiket} warna="#0f766e"/>}>
          {!loading && <LabelPita>{pctPiket}% terisi</LabelPita>}
        </PitaItem>

        <PitaItem label="LC avg skor" ikon="🎓" warna="#4338ca" angka={loading ? kosong : (kpi?.learning.avgScore ?? 0)}
          visual={!loading && <CincinMini pct={kpi?.learning.avgScore ?? 0} warna="#4338ca"/>}>
          {!loading && <LabelPita>{kpi?.learning.totalParticipants ?? 0} peserta</LabelPita>}
        </PitaItem>
      </div>
    </section>
  );
}
