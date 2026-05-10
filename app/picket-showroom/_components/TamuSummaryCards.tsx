'use client';
import { PiketRow, KegiatanEntry, MONTH_NAMES } from './shared';

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

  // Top divisi — divisi yang paling banyak bawa tamu
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

  // Jam pakai per produk — 6 kategori tetap, All Product distribusi ke semua
  const PRODUK_KATEGORI=['Videowall','LED','IFP','Audio System','Lighting','Kiosk'] as const;
  const PRODUK_ICONS:Record<string,string>={Videowall:'🖥️',LED:'💡',IFP:'📺','Audio System':'🔊',Lighting:'🎬',Kiosk:'🏧'};
  const PRODUK_COLORS:Record<string,string>={Videowall:'#dc2626',LED:'#d97706',IFP:'#2563eb','Audio System':'#7c3aed',Lighting:'#059669',Kiosk:'#0891b2'};
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
  const fmtJam=(j:number)=>j===0?'0j':j%1===0?`${j}j`:`${j.toFixed(1)}j`;

  const stats=[
    {label:'Top Divisi',          val:topDivisi,    hint:`${topDivisiCount}x kegiatan`,   icon:'🏷️', color:'#0891b2', isText:true},
    {label:'Top Produk',          val:topProduk,    hint:'paling sering demo',            icon:'🥇', color:'#059669', isText:true},
    {label:'Kebutuhan Terbanyak', val:topKebutuhan, hint:`${topKebutuhanCount}x diminta`, icon:'🎯', color:'#7c3aed', isText:true},
  ];

  const periodLabel=selectedMonth!==null
    ?`${MONTH_NAMES[selectedMonth-1]} ${selectedYear}`
    :`Tahun ${selectedYear}`;
  const accentColor=selectedMonth!==null?'#7c3aed':'#059669';
  const accentGrad=selectedMonth!==null?'linear-gradient(135deg,#7c3aed,#4c1d95)':'linear-gradient(135deg,#059669,#047857)';

  return(
    <div className="rounded-2xl overflow-hidden" style={{background:'rgba(255,255,255,0.97)',border:`1px solid ${accentColor}20`,boxShadow:`0 4px 20px ${accentColor}15`}}>
      {/* Header */}
      <div className="px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap" style={{background:accentGrad}}>
        <div className="flex items-center gap-2">
          <span className="text-base">📊</span>
          <div>
            <p className="text-xs font-black text-white leading-none">Ringkasan Aktivitas</p>
            <p className="text-[9px] text-white/70 mt-0.5">{periodLabel}</p>
          </div>
        </div>
        {/* Controls: Year + Month */}
        <div className="flex items-center gap-2">
          {/* Year dropdown */}
          <select value={selectedYear} onChange={e=>onYearChange(Number(e.target.value))}
            className="rounded-lg px-2 py-1 text-[11px] font-bold outline-none cursor-pointer"
            style={{background:'rgba(255,255,255,0.2)',color:'white',border:'1px solid rgba(255,255,255,0.3)'}}>
            {yearOptions.map(y=><option key={y} value={y} style={{background:'#1e293b',color:'white'}}>{y}</option>)}
          </select>
          {/* Month buttons */}
          <div className="flex items-center gap-0.5 bg-black/20 rounded-xl p-1 flex-wrap">
            <button onClick={()=>onMonthChange(null)}
              className="px-2 py-1 rounded-lg text-[10px] font-bold transition-all"
              style={selectedMonth===null?{background:'white',color:accentColor}:{color:'rgba(255,255,255,0.65)'}}>
              Semua
            </button>
            {MONTH_NAMES.map((mn,i)=>(
              <button key={i} onClick={()=>onMonthChange(i+1)}
                className="px-2 py-1 rounded-lg text-[10px] font-bold transition-all"
                style={selectedMonth===i+1?{background:'white',color:accentColor}:{color:'rgba(255,255,255,0.65)'}}>
                {mn}
              </button>
            ))}
          </div>
        </div>
      </div>
      {/* Stats horizontal */}
      <div className="flex divide-x divide-slate-100 overflow-x-auto">
        {stats.map((s,i)=>(
          <div key={i} className="flex-1 min-w-[90px] px-3 py-3 flex flex-col gap-0.5 flex-shrink-0">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-[11px]">{s.icon}</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none truncate">{s.label}</span>
            </div>
            {(s as any).isText
              ?<span className="text-[12px] font-black leading-tight truncate" style={{color:s.color}}>{s.val}</span>
              :<span className="text-2xl font-black leading-none" style={{color:s.color}}>{s.val}</span>
            }
            <span className="text-[8px] text-slate-300 leading-none">{s.hint}</span>
          </div>
        ))}
      </div>
      {/* Jam pakai per produk */}
      <div className="border-t border-slate-100 px-3 py-2.5">
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">⚡ Akumulasi Jam Pakai Produk</p>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {PRODUK_KATEGORI.map(p=>{
            const jam=jamPerProduk[p]||0;
            const color=PRODUK_COLORS[p];
            const maxJam=Math.max(...PRODUK_KATEGORI.map(x=>jamPerProduk[x]||0),1);
            const pct=Math.round((jam/maxJam)*100);
            return(
              <div key={p} className="flex flex-col gap-1 p-2 rounded-xl" style={{background:`${color}08`,border:`1px solid ${color}20`}}>
                <div className="flex items-center gap-1">
                  <span className="text-[11px]">{PRODUK_ICONS[p]}</span>
                  <span className="text-[9px] font-bold truncate" style={{color}}>{p}</span>
                </div>
                <span className="text-base font-black leading-none" style={{color}}>{fmtJam(jam)}</span>
                <div className="w-full rounded-full overflow-hidden" style={{height:'3px',background:`${color}20`}}>
                  <div className="h-full rounded-full transition-all" style={{width:`${pct}%`,background:color}}/>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
