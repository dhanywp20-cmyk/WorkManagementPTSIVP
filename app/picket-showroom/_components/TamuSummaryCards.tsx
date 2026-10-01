'use client';
import { PiketRow, KegiatanEntry, MONTH_NAMES } from './shared';
import { Ikon } from '@/components/shared/Ikon';

export function TamuSummaryCards({allRows,kegiatanList,selectedYear,selectedMonth,onYearChange,onMonthChange}:{
  allRows:PiketRow[];kegiatanList:KegiatanEntry[];
  selectedYear:number;selectedMonth:number|null;
  onYearChange:(y:number)=>void;onMonthChange:(m:number|null)=>void;
}) {
  const piketDateMap:Record<string,string>={};
  allRows.forEach(r=>{piketDateMap[r.id]=r.day_date;});

  // Derive available years from allRows
  const availableYears=Array.from(new Set(allRows.map(r=>r.day_date?.slice(0,4)).filter(Boolean))).sort().reverse() as string[];
  // If no data yet, at least show current year
  const now=new Date();
  const yearOptions=availableYears.length>0?availableYears:[String(now.getFullYear())];

  const activeKg=kegiatanList.filter(k=>{
    const d=piketDateMap[k.piket_id];
    if(!d)return false;
    const yr=d.slice(0,4);
    const mo=parseInt(d.slice(5,7),10);
    if(yr!==String(selectedYear))return false;
    if(selectedMonth!==null&&mo!==selectedMonth)return false;
    return true;
  });

  const demoList=activeKg.filter(k=>k.jenis_kegiatan==='Demo Product'&&k.tamu_instansi);

  // Top divisi - divisi yang paling banyak bawa tamu
  const divMap:Record<string,number>={};
  activeKg.forEach(k=>{if(k.sales_division)divMap[k.sales_division]=(divMap[k.sales_division]||0)+1;});
  const topDivisiEntry=Object.entries(divMap).sort(([,a],[,b])=>b-a)[0];
  const topDivisi=topDivisiEntry?topDivisiEntry[0]:'—';
  const topDivisiCount=topDivisiEntry?topDivisiEntry[1]:0;

  // Top produk
  const topProdukMap:Record<string,number>={};
  activeKg.forEach(k=>(k.produk||[]).forEach(p=>{topProdukMap[p]=(topProdukMap[p]||0)+1;}));
  const topProduk=Object.entries(topProdukMap).sort(([,a],[,b])=>b-a)[0]?.[0]||'—';

  // Top kebutuhan tamu terbanyak
  const kbtMap:Record<string,number>={};
  activeKg.forEach(k=>(k.kebutuhan||[]).forEach(kb=>{kbtMap[kb]=(kbtMap[kb]||0)+1;}));
  const topKbtEntry=Object.entries(kbtMap).sort(([,a],[,b])=>b-a)[0];
  const topKebutuhan=topKbtEntry?topKbtEntry[0]:'—';
  const topKebutuhanCount=topKbtEntry?topKbtEntry[1]:0;

  // Jam pakai per produk - 6 kategori tetap, All Product distribusi ke semua
  const PRODUK_KATEGORI=['Videowall','LED','IFP','Audio System','Lighting','Kiosk'] as const;
  const PRODUK_ICONS:Record<string,string>={Videowall:'🖥️',LED:'💡',IFP:'📺','Audio System':'🔊',Lighting:'🎬',Kiosk:'🏧'};
  // Tone 700: dipakai sebagai warna TEKS angka, jadi harus lolos kontras AA di latar putih.
  const PRODUK_COLORS:Record<string,string>={Videowall:'#b91c1c',LED:'#b45309',IFP:'#1d4ed8','Audio System':'#6d28d9',Lighting:'#047857',Kiosk:'#0e7490'};
  const jamPerProduk:Record<string,number>={Videowall:0,LED:0,IFP:0,'Audio System':0,Lighting:0,Kiosk:0};
  activeKg.forEach(k=>{
    if(!k.jam_mulai||!k.jam_selesai||!k.produk?.length)return;
    const[hm,mm]=k.jam_mulai.split(':').map(Number);
    const[hs,ms]=k.jam_selesai.split(':').map(Number);
    const durasi=((hs*60+ms)-(hm*60+mm))/60;
    if(durasi<=0)return;
    const targets=k.produk.includes('All Product')
      ?[...PRODUK_KATEGORI]
      :k.produk.filter((p):p is typeof PRODUK_KATEGORI[number]=>PRODUK_KATEGORI.includes(p as any));
    targets.forEach(p=>{jamPerProduk[p]=(jamPerProduk[p]||0)+durasi;});
  });
  const fmtJam=(j:number)=>j%1===0?`${j} jam`:`${j.toFixed(1)} jam`;

  const highlights=[
    {label:'Top Divisi',          val:topDivisi,    hint:`${topDivisiCount}x kegiatan`,   icon:'🏷️', color:'#0e7490'},
    {label:'Top Produk',          val:topProduk,    hint:'paling sering demo',            icon:'🥇', color:'#047857'},
    {label:'Kebutuhan Terbanyak', val:topKebutuhan, hint:`${topKebutuhanCount}x diminta`, icon:'🎯', color:'#7c3aed'},
  ];

  const periodLabel=selectedMonth!==null
    ?`${MONTH_NAMES[selectedMonth-1]} ${selectedYear}`
    :`Tahun ${selectedYear}`;
  const accentColor=selectedMonth!==null?'#7c3aed':'#047857';

  return(
    <div className="rounded-2xl overflow-hidden" style={{background:'rgba(255,255,255,0.97)',border:`1px solid ${accentColor}20`,boxShadow:`0 4px 20px ${accentColor}15`}}>
      {/* Header */}
      <div className="px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap" style={{background:'#f8fafc',borderBottom:'1px solid rgba(15,23,42,0.08)'}}>
        <div className="flex items-center gap-2">
          <span className="text-base"><Ikon nama="📊" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
          <div>
            <p className="text-xs font-black leading-none" style={{color:accentColor}}>Ringkasan Aktivitas</p>
            <p className="text-[9px] text-slate-500 mt-0.5">{periodLabel}</p>
          </div>
        </div>
        {/* Controls: Year + Month */}
        <div className="flex items-center gap-2">
          {/* Year dropdown */}
          <select value={selectedYear} onChange={e=>onYearChange(Number(e.target.value))} aria-label="Tahun"
            className="rounded-lg px-2 py-1 text-[11px] font-bold outline-none cursor-pointer"
            style={{background:'#ffffff',color:'#334155',border:'1px solid rgba(15,23,42,0.12)'}}>
            {yearOptions.map(y=><option key={y} value={y} style={{background:'#1e293b',color:'white'}}>{y}</option>)}
          </select>
          {/* Month buttons */}
          <div className="flex items-center gap-0.5 rounded-xl p-1 flex-wrap" style={{background:'rgba(15,23,42,0.05)'}}>
            <button onClick={()=>onMonthChange(null)}
              className="px-2 py-1 rounded-lg text-[10px] font-bold transition-all"
              style={selectedMonth===null?{background:accentColor,color:'white'}:{color:'#475569'}}>
              Semua
            </button>
            {MONTH_NAMES.map((mn,i)=>(
              <button key={i} onClick={()=>onMonthChange(i+1)}
                className="px-2 py-1 rounded-lg text-[10px] font-bold transition-all"
                style={selectedMonth===i+1?{background:accentColor,color:'white'}:{color:'#475569'}}>
                {mn}
              </button>
            ))}
          </div>
        </div>
      </div>
      {/* Single stats row */}
      <div className="flex divide-x divide-slate-100 overflow-x-auto">
        {highlights.map((s,i)=>(
          <div key={i} className="flex-[2] min-w-[168px] px-3 py-3 flex flex-col gap-0.5 flex-shrink-0">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-[11px]"><Ikon nama={s.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /></span>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider leading-none whitespace-nowrap">{s.label}</span>
            </div>
            <span className="text-sm font-black leading-tight" style={{color:s.color}}>{s.val}</span>
            <span className="text-[8px] text-slate-500 leading-none">{s.hint}</span>
          </div>
        ))}
        <div className="flex-shrink-0 px-1 py-3 flex items-center">
        
        </div>
        {PRODUK_KATEGORI.map(p=>(
          <div key={p} className="flex-1 min-w-[104px] px-2.5 py-3 flex flex-col gap-0.5 flex-shrink-0">
            {/* Nama produk utuh (dulu terpotong "VIDEOW..." / "AUDIO S...") dan
                ikon garis yang sama dengan kolom di kirinya, bukan emoji. */}
            <div className="flex items-center gap-1 mb-0.5 text-slate-500">
              <Ikon nama={PRODUK_ICONS[p]} ukuran={12} className="flex-shrink-0" />
              <span className="text-[9px] font-bold uppercase tracking-normal leading-none whitespace-nowrap" title={p}>{p === 'Audio System' ? 'Audio' : p}</span>
            </div>
            <span className="text-sm font-black leading-tight" style={{color:PRODUK_COLORS[p]}}>{fmtJam(jamPerProduk[p]||0)}</span>
            <span className="text-[9px] text-slate-500 leading-none">waktu pakai</span>
          </div>
        ))}
      </div>
    </div>
  );
}
