'use client';

/** BarisRingkasanKPI - dipecah dari app/(portal)/kpi-team/_components/DashboardKPI.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { UBIN, BAYANG_UBIN, RelAksen } from '@/app/(portal)/dashboard/_components/widgets/primitives';
import { AKSEN, HBarChart, KakiUbin, KepalaUbin, inisial, type KPIData } from '../DashboardKPI';

export interface BarisRingkasanKPIProps {
  kpi: KPIData | null;
  loading: boolean;
}

export function BarisRingkasanKPI({ kpi, loading }: BarisRingkasanKPIProps) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:contents">

        {/*
          Beban handler sebagai PAPAN PERINGKAT, bukan bar chart.
          Datanya sering cuma satu atau dua orang, dan grafik batang
          berisi satu batang tidak membandingkan apa pun - yang dibaca
          orang di sana adalah nama dan angkanya. Orang teratas diberi
          aksen penuh, sisanya abu: penekanan, bukan peringkat berwarna.
        */}
        <div className={`${UBIN} lg:col-span-3 h-full`} style={{ boxShadow: BAYANG_UBIN }}>
          <RelAksen warna={AKSEN}/>
          <KepalaUbin ikon="🏅" judul="Beban Handler" warna={AKSEN} catatan="Open"/>
          {loading ? <div className="h-28 rounded animate-pulse bg-slate-100"/>
            : kpi?.tickets.byHandler.length ? <>
              <div className="flex flex-col">
                {kpi.tickets.byHandler.slice(0,5).map((h,i)=>(
                  <div key={h.name} className="flex items-center gap-2.5 py-[7px] border-b border-black/[0.05] last:border-b-0">
                    <span aria-hidden="true" className="w-7 h-7 rounded-[10px] grid place-items-center text-[11px] font-black text-white flex-shrink-0"
                      style={{ background: i===0 ? AKSEN : '#cbd5e1' }}>{inisial(h.name)}</span>
                    <span className="text-[12px] font-extrabold text-slate-800 flex-1 truncate">{h.name}</span>
                    <span className="text-[16px] font-black tabular-nums flex-shrink-0"
                      style={{ color: i===0 ? AKSEN : '#94a3b8' }}>{h.count}</span>
                  </div>
                ))}
              </div>
              <div className="mt-auto">
                <KakiUbin kiri="Rata-rata beban" warna={AKSEN}
                  kanan={`${(kpi.tickets.open/Math.max(kpi.tickets.byHandler.length,1)).toFixed(1).replace('.',',')} tiket/orang`}/>
              </div>
            </> : <p className="text-sm text-center py-6 text-slate-500">Tidak ada data</p>}
        </div>

        {/* DIVISI */}
        <div className={`${UBIN} lg:col-span-3 h-full`} style={{ boxShadow: BAYANG_UBIN }}>
          <RelAksen warna={AKSEN}/>
          <KepalaUbin ikon="🏢" judul="Ticket per Divisi" warna={AKSEN}/>
          {loading?<div className="h-32 rounded animate-pulse bg-slate-100"/>:
            kpi?.tickets.byDivision.length
              ? <HBarChart data={kpi.tickets.byDivision.map(d=>({label:d.div,value:d.count}))}/>
              : <p className="text-sm text-center py-6 text-slate-500">Tidak ada data</p>}
        </div>

        {/*
          Produk enam kolom: labelnya yang paling panjang di baris ini
          ("Philips 55BDL2105X", "Microvision MV-U55…"), dan 3+3+6
          menggenapkan barisnya jadi dua belas tanpa slot menggantung.
        */}
        <div className={`${UBIN} lg:col-span-6 h-full`} style={{ boxShadow: BAYANG_UBIN }}>
          <RelAksen warna={AKSEN}/>
          <KepalaUbin ikon="📦" judul="Ticket per Produk" warna={AKSEN} catatan="6 teratas"/>
          {loading?<div className="h-32 rounded animate-pulse bg-slate-100"/>:
            kpi?.tickets.byProduct?.length
              ? <HBarChart lebarLabel="10rem" data={kpi.tickets.byProduct.map(p=>({label:p.product,value:p.count}))}/>
              : <p className="text-sm text-center py-6 text-slate-500">Tidak ada data produk</p>}
        </div>
      </div>
    </>
  );
}
