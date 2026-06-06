'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import {
  PiketRow, KegiatanEntry, UserRow, DayOfWeek,
  DAYS_OF_WEEK, DAY_COLOR, TEAM_LABEL,
  JENIS_KEGIATAN_LIST, KEGIATAN_COLORS, PIE_COLORS,
  getMonday, addDays, toKey, getDayDate, getRollingNameForDate,
} from './_components/shared';
import { MiniPieChart } from '@/components/shared';
import { TamuSummaryCards } from './_components/TamuSummaryCards';
import { MiniCalendarPopup } from './_components/MiniCalendarPopup';
import { FillDetailModal } from './_components/FillDetailModal';
import { ScheduleModal } from './_components/ScheduleModal';
import { ViewDetailModal } from './_components/ViewDetailModal';
import { exportToExcel } from './_components/excel-export';
import { ViewIconBtn, EditIconBtn, DeleteIconBtn, ActionGroup } from '@/components/shared';

// ─── Main Page ────────────────────────────────────────────────────────────────

function PiketShowroomPageInner() {
  const searchParams = useSearchParams();
  const [currentUser,setCurrentUser]=useState<any>(null);
  const [weekStart,setWeekStart]=useState<Date>(()=>getMonday(new Date()));
  const [rows,setRows]=useState<PiketRow[]>([]);
  const [allRows,setAllRows]=useState<PiketRow[]>([]);
  const [kegiatanList,setKegiatanList]=useState<KegiatanEntry[]>([]);
  const [ptUsers,setPtUsers]=useState<UserRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [showSchedule,setShowSchedule]=useState(false);
  const [showCalendar,setShowCalendar]=useState(false);
  const [fillDetail,setFillDetail]=useState<PiketRow|null>(null);
  const [viewDetail,setViewDetail]=useState<PiketRow|null>(null);
  const [search,setSearch]=useState('');
  const [filterDay,setFilterDay]=useState<DayOfWeek|''>('');

  // ── Auto-apply filter dari Global Search (?q=...) ──
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearch(q);
  }, [searchParams]);
  const [filterTamu,setFilterTamu]=useState(false);
  const [filterKebutuhan,setFilterKebutuhan]=useState<string|null>(null);
  const [filterInstansi,setFilterInstansi]=useState<string|null>(null);
  const [filterDivision,setFilterDivision]=useState<string|null>(null);
  const [filterKegiatan,setFilterKegiatan]=useState<string|null>(null);
  const [summaryYear,setSummaryYear]=useState<number>(new Date().getFullYear());
  const [summaryMonth,setSummaryMonth]=useState<number|null>(null);
  const wk=toKey(weekStart);

  useEffect(()=>{ const u=getSession(); if(u) setCurrentUser(u as unknown as UserRow); },[]);
  const isAdmin=currentUser&&['admin','superadmin'].includes(currentUser.role?.toLowerCase()||'');

  const fetchData=useCallback(async()=>{
    setLoading(true);
    const wk2=toKey(addDays(weekStart,7));
    const[wRes,aRes,uRes,kgRes]=await Promise.all([
      supabase.from('piket_schedules').select('*').in('week_start',[wk,wk2]).order('day_date'),
      supabase.from('piket_schedules').select('id,day_date,week_start,day_of_week,pic_ivp_name,pic_ump_name,pic_mlds_name'),
      supabase.from('users').select('id,full_name,username,team_type,role').in('team_type',['Team PTS','Team PTS UMP','Team PTS MLDS']).order('full_name'),
      supabase.from('piket_tamu_detail').select('*').order('created_at'),
    ]);
    if(wRes.data)setRows(wRes.data as PiketRow[]);
    if(aRes.data)setAllRows(aRes.data as PiketRow[]);
    if(uRes.data)setPtUsers(uRes.data as UserRow[]);
    if(kgRes.data)setKegiatanList(kgRes.data as KegiatanEntry[]);
    setLoading(false);
  },[weekStart]);

  useEffect(()=>{fetchData();},[fetchData]);
  useEffect(()=>{
    const ch=supabase.channel('piket-rt').on('postgres_changes',{event:'*',schema:'public',table:'piket_schedules'},()=>{setTimeout(fetchData,300);}).on('postgres_changes',{event:'*',schema:'public',table:'piket_tamu_detail'},()=>{setTimeout(fetchData,300);}).subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[fetchData]);

  // FIX: isCurrWeek true jika salah satu dari 2 minggu yang ditampilkan adalah minggu ini
  const currMondayKey=toKey(getMonday(new Date()));
  const isCurrWeek=wk===currMondayKey||toKey(addDays(weekStart,7))===currMondayKey;
  const fmtW=(ws:Date)=>`${ws.toLocaleDateString('id-ID',{day:'2-digit',month:'short'})} – ${addDays(ws,4).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})}`;
  const wLabel=fmtW(weekStart);
  const wLabel2=fmtW(addDays(weekStart,7));

  // Generate virtual rows untuk minggu yang belum ada di DB
  // FIX 1: Selalu tampilkan semua 10 hari kerja meski rolling name belum ada (PIC kosong)
  // FIX 2: Hari yang sudah LEWAT (< hari ini) dan tidak ada di DB → tampil kosong tanpa rolling
  //         supaya perubahan rolling tidak meretroaktif mengubah data historis yang belum disave
  const effectiveRows = useMemo(()=>{
    const todayKey = toKey(new Date());
    const existingKeys = new Set(rows.map(r=>`${r.week_start}__${r.day_of_week}`));
    const virtual: PiketRow[] = [];
    [weekStart, addDays(weekStart,7)].forEach(ws=>{
      const wkKey = toKey(ws);
      DAYS_OF_WEEK.forEach((day)=>{
        if(existingKeys.has(`${wkKey}__${day}`)) return;
        const date = getDayDate(ws, day);
        const dateKey = toKey(date);
        // Hari lampau yang belum di-DB: tampilkan kosong (jangan pakai rolling)
        // supaya history tidak berubah retroaktif saat rolling di-update
        const isPast = dateKey < todayKey;
        const name = isPast ? null : getRollingNameForDate(date, allRows);
        const u = name ? ptUsers.find(x=>x.full_name===name) : undefined;
        const tt = u?.team_type||'';
        const isIVP=tt==='Team PTS', isUMP=tt==='Team PTS UMP', isMlds=tt==='Team PTS MLDS';
        virtual.push({
          id: `virtual-${wkKey}-${day}`,
          week_start: wkKey,
          day_of_week: day,
          day_date: dateKey,
          pic_ivp_id: isIVP?(u?.id||null):null,
          pic_ivp_name: isIVP?(name||null):null,
          pic_ump_id: isUMP?(u?.id||null):null,
          pic_ump_name: isUMP?(name||null):null,
          pic_mlds_id: isMlds?(u?.id||null):null,
          pic_mlds_name: isMlds?(name||null):null,
          tamu_instansi: null, kebutuhan: [],
          created_at: '', updated_at: '',
        });
      });
    });
    return [...rows, ...virtual];
  }, [rows, allRows, weekStart, ptUsers]);

  // Auto-save virtual row ke DB lalu buka FillDetailModal
  const handleFillVirtual = useCallback(async(row: PiketRow)=>{
    const{error}=await supabase.from('piket_schedules').upsert({
      week_start: row.week_start,
      day_of_week: row.day_of_week,
      day_date: row.day_date,
      pic_ivp_id: row.pic_ivp_id,
      pic_ivp_name: row.pic_ivp_name,
      pic_ump_id: row.pic_ump_id,
      pic_ump_name: row.pic_ump_name,
      pic_mlds_id: row.pic_mlds_id,
      pic_mlds_name: row.pic_mlds_name,
      tamu_instansi: null, kebutuhan: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },{onConflict:'week_start,day_of_week',ignoreDuplicates:false});
    if(error){console.error('Failed to save virtual row:',error.message);return;}
    const{data}=await supabase.from('piket_schedules').select('*').eq('week_start',row.week_start).eq('day_of_week',row.day_of_week).single();
    if(data){setFillDetail(data as PiketRow);fetchData();}
  },[fetchData]);

  const handleDeleteRow = useCallback(async(row: PiketRow)=>{
    if(!confirm(`Hapus semua kegiatan ${row.day_of_week}? Jadwal piket tetap ada.`)) return;
    await supabase.from('piket_tamu_detail').delete().eq('piket_id',row.id);
    fetchData();
  },[fetchData]);

  const formatTime = (timeStr:string) => {
    if(!timeStr) return '';
    const [h,m] = timeStr.split(':');
    return `${h}:${m}`;
  };

  const displayRows = effectiveRows.filter(row=>{
    const d=new Date(row.day_date+'T00:00:00');
    if(d.getDay()===0||d.getDay()===6)return false;
    if(filterDay&&row.day_of_week!==filterDay)return false;
    const rowKg=kegiatanList.filter(k=>k.piket_id===row.id);
    if(filterTamu&&!rowKg.some(k=>k.tamu_instansi))return false;
    if(filterKebutuhan&&!rowKg.some(k=>k.kebutuhan?.includes(filterKebutuhan)))return false;
    if(filterInstansi&&!rowKg.some(k=>k.tamu_instansi===filterInstansi))return false;
    if(filterDivision&&!rowKg.some(k=>k.sales_division===filterDivision))return false;
    if(filterKegiatan&&!rowKg.some(k=>k.jenis_kegiatan===filterKegiatan))return false;
    if(search){
      const q=search.toLowerCase();
      const mp=!!(row.pic_ivp_name?.toLowerCase().includes(q)||row.pic_ump_name?.toLowerCase().includes(q)||row.pic_mlds_name?.toLowerCase().includes(q)||row.day_of_week.toLowerCase().includes(q));
      const mk=rowKg.some(k=>k.tamu_instansi?.toLowerCase().includes(q)||k.nama_sales?.toLowerCase().includes(q)||k.kebutuhan?.some(x=>x.toLowerCase().includes(q))||k.keterangan?.toLowerCase().includes(q)||k.jenis_kegiatan?.toLowerCase().includes(q));
      return mp||mk;
    }
    return true;
  });

  const piketDateMapPie:Record<string,string>={};
  allRows.forEach(r=>{piketDateMapPie[r.id]=r.day_date;});
  const filteredKgPie=kegiatanList.filter(k=>{
    const d=piketDateMapPie[k.piket_id];
    if(!d)return false;
    if(d.slice(0,4)!==String(summaryYear))return false;
    if(summaryMonth!==null&&parseInt(d.slice(5,7),10)!==summaryMonth)return false;
    return true;
  });
  const kPieAll=Object.entries(filteredKgPie.reduce((acc,k)=>{(k.kebutuhan||[]).forEach(x=>{acc[x]=(acc[x]||0)+1;});return acc;},{}as Record<string,number>)).sort(([,a],[,b])=>b-a).slice(0,12).map(([label,value],i)=>({label,value,color:PIE_COLORS[i%PIE_COLORS.length]}));
  const divPieAll=Object.entries(filteredKgPie.reduce((acc,k)=>{if(k.sales_division)acc[k.sales_division]=(acc[k.sales_division]||0)+1;return acc;},{}as Record<string,number>)).sort(([,a],[,b])=>b-a).slice(0,12).map(([label,value],i)=>({label,value,color:PIE_COLORS[i%PIE_COLORS.length]}));
  const kgTypePie=JENIS_KEGIATAN_LIST.map(j=>({label:j,value:filteredKgPie.filter(k=>k.jenis_kegiatan===j).length,color:KEGIATAN_COLORS[j]})).filter(d=>d.value>0);
  const instansiPie=Object.entries(filteredKgPie.filter(k=>k.tamu_instansi).reduce((acc,k)=>{const key=k.tamu_instansi!;acc[key]=(acc[key]||0)+1;return acc;},{}as Record<string,number>)).sort(([,a],[,b])=>b-a).slice(0,12).map(([label,value],i)=>({label,value,color:PIE_COLORS[i%PIE_COLORS.length]}));
  const PRODUK_SPESIFIK=['Videowall','LED','IFP','Audio System','Lighting','Kiosk'];
  const produkPie=Object.entries(filteredKgPie.reduce((acc,k)=>{
    const produk=k.produk||[];
    if(produk.includes('All Product')){
      // Distribusi ke semua produk spesifik
      PRODUK_SPESIFIK.forEach(p=>{acc[p]=(acc[p]||0)+1;});
    } else {
      produk.forEach(p=>{acc[p]=(acc[p]||0)+1;});
    }
    return acc;
  },{}as Record<string,number>)).sort(([,a],[,b])=>b-a).slice(0,12).map(([label,value],i)=>({label,value,color:PIE_COLORS[i%PIE_COLORS.length]}));


  return(
    <div className="h-screen overflow-hidden flex flex-col relative" style={{backgroundImage:`url('/IVP_Background.png')`,backgroundSize:'cover',backgroundPosition:'center',backgroundAttachment:'fixed'}}>
      <div className="absolute inset-0 pointer-events-none" style={{background:'rgba(255,255,255,0.08)'}}/>
      {loading&&rows.length===0&&(
        <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{backgroundImage:`url('/IVP_Background.png')`,backgroundSize:'cover'}}>
          <div className="absolute inset-0" style={{background:'rgba(255,255,255,0.15)',backdropFilter:'blur(2px)'}}/>
          <div className="relative flex flex-col items-center gap-4 px-10 py-8 rounded-3xl" style={{background:'rgba(255,255,255,0.92)',backdropFilter:'blur(20px)',boxShadow:'0 8px 40px rgba(0,0,0,0.18)'}}>
            <svg className="w-16 h-16 animate-spin" viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="26" stroke="#f1f5f9" strokeWidth="6"/><path d="M32 6 A26 26 0 0 1 58 32" stroke="#dc2626" strokeWidth="6" strokeLinecap="round"/></svg>
            <p className="text-sm font-bold text-slate-700">Loading...</p>
          </div>
        </div>
      )}

      <div className="relative z-10 flex flex-col flex-1 overflow-hidden">
        {/* ── HEADER ── */}
        <header className="sticky top-0 z-50 animate-slide-down anim-d0" style={{background:'rgba(255,255,255,0.9)',borderBottom:'3px solid #dc2626',backdropFilter:'blur(16px)'}}>
          <div className="max-w-[1600px] mx-auto px-6 py-3.5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{background:'linear-gradient(135deg,#dc2626,#991b1b)',boxShadow:'0 3px 12px rgba(220,38,38,0.4)'}}>
                <span className="text-lg">🏪</span>
              </div>
              <div>
                <h1 className="text-base font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-red-800">Piket Showroom</h1>
                <p className="text-[10px] text-slate-500 font-medium">IndoVisual Presentama · Jadwal Piket Tim PTS</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={()=>exportToExcel(allRows,kegiatanList)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:scale-105"
                style={{background:'linear-gradient(135deg,#059669,#047857)',boxShadow:'0 4px 14px rgba(5,150,105,0.3)'}}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                Export Report
              </button>
              {isAdmin&&(
                <button onClick={()=>setShowSchedule(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:scale-105"
                  style={{background:'linear-gradient(135deg,#dc2626,#b91c1c)',boxShadow:'0 4px 14px rgba(220,38,38,0.4)'}}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                  Atur Jadwal
                </button>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto max-w-[1600px] mx-auto w-full px-5 py-5 space-y-4">
          <div className="animate-slide-up anim-d80">
            <TamuSummaryCards allRows={allRows} kegiatanList={kegiatanList} selectedYear={summaryYear} selectedMonth={summaryMonth} onYearChange={setSummaryYear} onMonthChange={setSummaryMonth}/>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 animate-zoom-in anim-d160">
            <MiniPieChart data={instansiPie} title="Tamu per Instansi" icon="🏢" activeFilter={filterInstansi} onSliceClick={l=>setFilterInstansi(filterInstansi===l?null:l)}/>
            <MiniPieChart data={kgTypePie} title="Jenis Kegiatan" icon="📋" activeFilter={filterKegiatan} onSliceClick={l=>setFilterKegiatan(filterKegiatan===l?null:l)}/>
            <MiniPieChart data={produkPie} title="Penggunaan Produk" icon="📦" activeFilter={null} onSliceClick={()=>{}}/>
            <MiniPieChart data={kPieAll} title="Kebutuhan Terbanyak" icon="🎯" activeFilter={filterKebutuhan} onSliceClick={l=>setFilterKebutuhan(filterKebutuhan===l?null:l)}/>
            <MiniPieChart data={divPieAll} title="Division Sales" icon="🏷️" activeFilter={filterDivision} onSliceClick={l=>setFilterDivision(filterDivision===l?null:l)}/>
          </div>

          {/* ── TABLE (full width) ── */}
          <div className="rounded-2xl overflow-hidden animate-slide-up anim-d320" style={{background:'rgba(255,255,255,0.97)',border:'1px solid rgba(200,200,200,0.6)'}}>
            <div className="px-5 py-3.5 border-b border-gray-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Schedule Piket</span>
                  <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2.5 py-1 rounded-full">{displayRows.length}</span>
                  {/* Week nav — 2 minggu */}
                  <div className="flex items-center gap-1">
                    <button onClick={()=>setWeekStart(d=>addDays(d,-28))} className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm text-slate-400 hover:text-red-600 border border-slate-200 hover:border-red-200 hover:bg-red-50">‹‹</button>
                    <button onClick={()=>setWeekStart(d=>addDays(d,-14))} className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-base text-slate-400 hover:text-red-600 border border-slate-200 hover:border-red-200 hover:bg-red-50">‹</button>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{background:'rgba(220,38,38,0.07)',border:'1px solid rgba(220,38,38,0.2)'}}>
                      <div className="flex flex-col">
                        <span className="text-[11px] font-bold text-red-700 leading-tight">{wLabel}</span>
                        <span className="text-[10px] text-red-400 leading-tight">{wLabel2}</span>
                      </div>
                      {!isCurrWeek&&<button onClick={()=>setWeekStart(getMonday(new Date()))} className="text-[9px] font-bold px-2 py-1 rounded-lg text-white flex-shrink-0" style={{background:'#dc2626'}}>Ini</button>}
                    </div>
                    <button onClick={()=>setWeekStart(d=>addDays(d,14))} className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-base text-slate-400 hover:text-red-600 border border-slate-200 hover:border-red-200 hover:bg-red-50">›</button>
                    <button onClick={()=>setWeekStart(d=>addDays(d,28))} className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm text-slate-400 hover:text-red-600 border border-slate-200 hover:border-red-200 hover:bg-red-50">››</button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={()=>setShowCalendar(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border"
                    style={{background:'rgba(37,99,235,0.06)',borderColor:'rgba(37,99,235,0.25)',color:'#2563eb'}}>
                    📅 Show Calendar
                  </button>
                  {(search||filterDay||filterTamu||filterKebutuhan||filterInstansi||filterDivision||filterKegiatan)&&(
                    <button onClick={()=>{setSearch('');setFilterDay('');setFilterTamu(false);setFilterKebutuhan(null);setFilterInstansi(null);setFilterDivision(null);setFilterKegiatan(null);}}
                      className="px-3 py-2 rounded-xl text-xs font-semibold" style={{background:'rgba(220,38,38,0.08)',border:'1px solid rgba(220,38,38,0.2)',color:'#dc2626'}}>
                      ✕ Reset Filter
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[160px]">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari nama, instansi, kegiatan..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl text-sm outline-none" style={{background:'rgba(248,250,252,0.9)',border:'1px solid rgba(0,0,0,0.1)'}}/>
                </div>
                <select value={filterDay} onChange={e=>setFilterDay(e.target.value as any)} className="px-3 py-2 rounded-xl text-xs font-semibold outline-none bg-white" style={{border:'1px solid rgba(0,0,0,0.1)'}}>
                  <option value="">Semua Hari</option>{DAYS_OF_WEEK.map(d=><option key={d} value={d}>{d}</option>)}
                </select>
                <select value={filterKegiatan||''} onChange={e=>setFilterKegiatan(e.target.value||null)} className="px-3 py-2 rounded-xl text-xs font-semibold outline-none bg-white" style={{border:'1px solid rgba(0,0,0,0.1)'}}>
                  <option value="">Semua Kegiatan</option>{JENIS_KEGIATAN_LIST.map(j=><option key={j} value={j}>{j}</option>)}
                </select>
                <button onClick={()=>setFilterTamu(f=>!f)} className="px-3 py-2 rounded-xl text-xs font-semibold border"
                  style={filterTamu?{background:'rgba(16,185,129,0.12)',borderColor:'rgba(16,185,129,0.4)',color:'#059669'}:{background:'transparent',borderColor:'rgba(0,0,0,0.1)',color:'#64748b'}}>
                  🏢 Ada Tamu
                </button>
              </div>
              {(filterInstansi||filterKebutuhan||filterDivision||filterKegiatan)&&(
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {filterInstansi&&(<div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{background:'rgba(14,165,233,0.1)',border:'1px solid rgba(14,165,233,0.35)'}}><span className="text-[10px] font-bold text-sky-600">🏢 {filterInstansi}</span><button onClick={()=>setFilterInstansi(null)} className="text-sky-400 text-[10px] ml-1">✕</button></div>)}
                  {filterKebutuhan&&(<div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{background:'rgba(124,58,237,0.1)',border:'1px solid rgba(124,58,237,0.35)'}}><span className="text-[10px] font-bold text-violet-600">🎯 {filterKebutuhan}</span><button onClick={()=>setFilterKebutuhan(null)} className="text-violet-400 text-[10px] ml-1">✕</button></div>)}
                  {filterDivision&&(<div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{background:'rgba(245,158,11,0.1)',border:'1px solid rgba(245,158,11,0.35)'}}><span className="text-[10px] font-bold text-amber-600">🏷️ {filterDivision}</span><button onClick={()=>setFilterDivision(null)} className="text-amber-400 text-[10px] ml-1">✕</button></div>)}
                  {filterKegiatan&&(<div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{background:`${KEGIATAN_COLORS[filterKegiatan]||'#6366f1'}18`,border:`1px solid ${KEGIATAN_COLORS[filterKegiatan]||'#6366f1'}50`}}><span className="text-[10px] font-bold" style={{color:KEGIATAN_COLORS[filterKegiatan]||'#6366f1'}}>📋 {filterKegiatan}</span><button onClick={()=>setFilterKegiatan(null)} className="text-[10px] ml-1" style={{color:KEGIATAN_COLORS[filterKegiatan]||'#6366f1'}}>✕</button></div>)}
                </div>
              )}
            </div>

            {/* ── Today Banner ── */}
            {(()=>{
              const now=new Date();
              const todayDow=now.getDay();
              const isWeekday=todayDow>=1&&todayDow<=5;
              const todayName=DAYS_OF_WEEK[todayDow-1];
              const todayDc=isWeekday&&todayName?DAY_COLOR[todayName]:null;
              const todayInView=displayRows.find(r=>r.day_date===toKey(now));
              const todayPIC=todayInView?[todayInView.pic_ivp_name,todayInView.pic_ump_name,todayInView.pic_mlds_name].filter(Boolean).join(' / ')||'Belum ada PIC':null;
              if(!isWeekday)return null;
              return(
                <div className="mx-4 mb-3 mt-1 flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{background:`${todayDc?.accent||'#dc2626'}10`,border:`1px solid ${todayDc?.accent||'#dc2626'}30`}}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-sm flex-shrink-0" style={{background:todayDc?.grad||'linear-gradient(135deg,#dc2626,#991b1b)'}}>
                    {now.getDate()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black" style={{color:todayDc?.accent||'#dc2626'}}>📍 Hari ini: {todayName}</span>
                      <span className="text-[10px] text-slate-500 font-medium">{now.toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}</span>
                      {todayInView&&todayPIC&&<span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{background:todayDc?.accent||'#dc2626'}}>PIC: {todayPIC}</span>}
                      {!todayInView&&<span className="text-[10px] text-slate-400 italic">Jadwal hari ini tidak tampil di view ini</span>}
                    </div>
                  </div>
                </div>
              );
            })()}
            {loading?(
              <div className="flex justify-center py-16"><div className="flex flex-col items-center gap-3"><div className="w-8 h-8 rounded-full border-2 border-t-red-600 border-red-200 animate-spin"/><p className="text-sm text-slate-500">Memuat jadwal...</p></div></div>
            ):(
              <div className="overflow-x-auto animate-zoom-in">
                {/* ── TABLE ── */}
                <table className="w-full text-sm border-collapse" style={{minWidth:'1050px'}}>
                  <colgroup>
                    <col style={{width:'3%'}}/><col style={{width:'8%'}}/><col style={{width:'7%'}}/><col style={{width:'15%'}}/><col style={{width:'6%'}}/><col style={{width:'9%'}}/>
                    <col style={{width:'9%'}}/><col style={{width:'7%'}}/><col style={{width:'21%'}}/><col style={{width:'5%'}}/><col style={{width:'9%'}}/>
                  </colgroup>
                  <thead>
                    <tr style={{background:'linear-gradient(135deg,#fff1f2 0%,#ffe4e6 100%)',borderBottom:'2px solid rgba(220,38,38,0.18)'}}>
                      {['No','Tanggal','PIC','Kegiatan','Jam','Produk','Tamu Instansi','Sales','Keterangan','Edit By','Action'].map((h,i)=>(
                        <th key={h} className="px-3 py-3 text-center" style={{borderRight:i<10?'1px solid rgba(220,38,38,0.1)':'none'}}><span className="text-[10px] font-black uppercase tracking-wider" style={{color:'#9f1239',letterSpacing:'0.08em'}}>{h}</span></th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayRows.length===0?(
                      <tr><td colSpan={11} className="text-center py-16 text-gray-400">
                        <div className="text-4xl mb-3">📋</div>
                        <p className="font-semibold">{rows.length===0?'Belum ada jadwal':'Tidak ada hasil filter'}</p>
                        {rows.length===0&&isAdmin&&<p className="text-xs mt-1">Klik "Atur Jadwal" untuk menambahkan jadwal piket</p>}
                      </td></tr>
                    ):displayRows.map((row,idx)=>{
                      const dc=DAY_COLOR[row.day_of_week];
                      const todayKey=toKey(new Date());
                      const todayRow=row.day_date===todayKey;
                      const rowDateMs=new Date(row.day_date+'T00:00:00').getTime();
                      const todayMs=new Date(todayKey+'T00:00:00').getTime();
                      const diffDays=Math.round((rowDateMs-todayMs)/(1000*60*60*24));
                      const isVirtual=row.id.startsWith('virtual-');
                      const rowKg=kegiatanList.filter(k=>k.piket_id===row.id);
                      const kgToShow=rowKg.length>0?rowKg:[null];
                      const countdownBadge=todayRow?null:diffDays===1?{label:'BESOK',color:'#d97706'}:diffDays>1&&diffDays<=9?{label:`${diffDays} hr lagi`,color:'#64748b'}:null;
                      return kgToShow.map((kg,kgIdx)=>(
                        <tr key={`${row.id}-${kgIdx}`} className="stagger-item transition-all duration-150"
                          style={{borderBottom:kgIdx===kgToShow.length-1?(todayRow?'2px solid #16a34a60':'2px solid #cbd5e1'):'1px solid #e2e8f0',background:todayRow?'rgba(22,163,74,0.10)':isVirtual?'rgba(148,163,184,0.04)':idx%2===0?'rgba(255,255,255,1)':'rgba(219,234,254,0.38)'}}>
                          {kgIdx===0&&(
                            <>
                              <td className="px-3 py-3 text-gray-400 text-xs align-middle" rowSpan={kgToShow.length} style={{borderRight:'1px solid #cbd5e1',verticalAlign:'middle'}}>{idx+1}</td>
                              <td className="px-3 py-3 align-middle" rowSpan={kgToShow.length} style={{borderRight:'1px solid #cbd5e1',verticalAlign:'middle'}}>
                                <div className="flex flex-col" style={{borderLeft:`3px solid ${dc.accent}`,paddingLeft:'6px'}}>
                                  <span className="text-base font-black leading-tight" style={{color:dc.accent}}>{new Date(row.day_date+'T00:00:00').getDate()}</span>
                                  <span className="text-[9px] font-bold" style={{color:dc.accent}}>{new Date(row.day_date+'T00:00:00').toLocaleDateString('id-ID',{month:'short',year:'2-digit'})}</span>
                                  <span className="text-xs font-bold mt-0.5" style={{color:dc.accent}}>{row.day_of_week}</span>
                                  {todayRow&&<span className="text-[8px] font-bold px-1.5 py-0.5 rounded-md text-white mt-0.5 w-fit" style={{background:dc.accent,boxShadow:`0 2px 6px ${dc.accent}50`}}>📍 HARI INI</span>}
                                  {countdownBadge&&<span className="text-[8px] font-bold px-1.5 py-0.5 rounded-md mt-0.5 w-fit" style={{background:`${countdownBadge.color}15`,color:countdownBadge.color,border:`1px solid ${countdownBadge.color}40`}}>{countdownBadge.label}</span>}
                                </div>
                              </td>
                              {/* PIC — tambah keterangan tim */}
                              <td className="px-3 py-3 align-middle" rowSpan={kgToShow.length} style={{borderRight:'1px solid #cbd5e1',verticalAlign:'middle'}}>
                                <div className="space-y-1.5">
                                  {([['pic_ivp_name','PTS IVP'],['pic_ump_name','PTS UMP'],['pic_mlds_name','PTS MLDS']] as [keyof PiketRow,string][]).map(([f,team])=>{
                                    const name=row[f] as string|null;if(!name)return null;
                                    const tc=TEAM_LABEL[team];
                                    return(
                                      <div key={team} className="flex items-center gap-1.5">
                                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white flex-shrink-0" style={{background:tc.dot}}>{name.charAt(0).toUpperCase()}</div>
                                        <div className="min-w-0">
                                          <p className="text-[13px] font-semibold text-slate-800 truncate leading-tight">{name}</p>
                                          <span className="text-[8px] font-bold uppercase" style={{color:tc.text}}>{team}</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {![row.pic_ivp_name,row.pic_ump_name,row.pic_mlds_name].some(Boolean)&&<span className="text-gray-300 text-xs">—</span>}
                                </div>
                              </td>
                            </>
                          )}
                          {/* Kegiatan + Kebutuhan (di bawah jenis kegiatan) */}
                          <td className="px-3 py-2.5 align-middle" style={{borderRight:'1px solid #cbd5e1'}}>
                            {kg?(
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-bold border-b-2 pb-0.5 w-fit"
                                  style={{color:KEGIATAN_COLORS[kg.jenis_kegiatan]||dc.accent,borderBottomColor:KEGIATAN_COLORS[kg.jenis_kegiatan]||dc.accent}}>
                                  {kg.jenis_kegiatan}
                                </span>
                                {/* RnD: tampilkan team_rnd dengan PTS info */}
                                {kg.jenis_kegiatan==='RnD'&&(kg as any).team_rnd&&(
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <span className="text-[9px] font-semibold text-violet-500">👥</span>
                                    <span className="text-[9px] font-semibold text-violet-700">{(kg as any).team_rnd}</span>
                                    {/* Cari PTS team dari ptUsers */}
                                    {(()=>{
                                      const u=ptUsers.find(x=>x.full_name===(kg as any).team_rnd);
                                      const teamLabel=u?.team_type==='Team PTS'?'PTS IVP':u?.team_type==='Team PTS UMP'?'PTS UMP':u?.team_type==='Team PTS MLDS'?'PTS MLDS':'';
                                      const tc=teamLabel?TEAM_LABEL[teamLabel]:null;
                                      return tc?<span className="text-[8px] font-black px-1 py-0.5 rounded text-white" style={{background:tc.dot}}>{teamLabel}</span>:null;
                                    })()}
                                  </div>
                                )}
                                {/* Kebutuhan hanya untuk Demo Product */}
                                {kg.jenis_kegiatan==='Demo Product'&&kg.kebutuhan&&kg.kebutuhan.length>0&&(
                                  <div className="flex flex-col gap-0.5 mt-0.5">
                                    {kg.kebutuhan.map(k=>(
                                      <span key={k} className="flex items-center gap-1 text-[9px] font-semibold text-slate-500 leading-tight">
                                        <span className="w-1 h-1 rounded-full flex-shrink-0" style={{background:dc.accent}}/>
                                        {k}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ):<span className="text-gray-300 text-xs">—</span>}
                          </td>
                          {/* Jam */}
                          <td className="px-3 py-3 align-middle" style={{borderRight:'1px solid #cbd5e1'}}>
                            {kg?.jam_mulai?(
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1"><span className="text-[9px] font-bold text-slate-400 w-10 flex-shrink-0">Mulai</span><span className="text-sm font-bold text-slate-700">{formatTime(kg.jam_mulai)}</span></div>
                                <div className="flex items-center gap-1"><span className="text-[9px] font-bold text-slate-400 w-10 flex-shrink-0">Selesai</span><span className="text-sm font-bold text-slate-700">{formatTime(kg.jam_selesai)}</span></div>
                              </div>
                            ):<span className="text-gray-300 text-xs">—</span>}
                          </td>
                          {/* Produk */}
                          <td className="px-3 py-3 align-middle" style={{borderRight:'1px solid #cbd5e1'}}>
                            {kg?.produk&&kg.produk.length>0?(
                              <div className="flex flex-col gap-0.5">
                                {kg.produk.map(p=><span key={p} className="text-[12px] font-semibold" style={{color:dc.accent}}>{p}</span>)}
                              </div>
                            ):<span className="text-gray-300 text-xs">—</span>}
                          </td>
                          {/* Tamu */}
                          <td className="px-3 py-3 align-middle" style={{borderRight:'1px solid #cbd5e1'}}>
                            {kg?.tamu_instansi?(<button onClick={()=>setFilterInstansi(filterInstansi===kg.tamu_instansi?null:kg.tamu_instansi!)} className="flex items-center gap-1 hover:opacity-80 text-left"><span>🏢</span><span className="text-xs font-semibold text-slate-700 underline decoration-dotted">{kg.tamu_instansi}</span></button>):<span className="text-gray-300 text-xs">—</span>}
                          </td>
                          {/* Sales */}
                          <td className="px-3 py-3 align-middle" style={{borderRight:'1px solid #cbd5e1'}}>
                            {kg?.nama_sales?(<div className="flex flex-col gap-0.5"><span className="text-[12px] font-bold text-slate-800">{kg.nama_sales}</span>{kg.sales_division&&<span className="text-[11px] text-purple-500 font-semibold">{kg.sales_division}</span>}</div>):<span className="text-gray-300 text-xs">—</span>}
                          </td>
                          {/* Keterangan */}
                          <td className="px-3 py-3 align-middle" style={{borderRight:'1px solid #cbd5e1'}}>
                            {kg?.keterangan?<span className="text-[13px] text-slate-600 leading-snug">{kg.keterangan}</span>:<span className="text-gray-300 text-xs">—</span>}
                          </td>
                          {/* Edit By — diambil dari piket_tamu_detail (kg terakhir) */}
                          {kgIdx===0&&(
                            <td className="px-3 py-3 align-middle" rowSpan={kgToShow.length} style={{borderRight:'1px solid #cbd5e1',verticalAlign:'middle'}}>
                              {(()=>{
                                // Ambil edited_by_name dari kegiatan yang paling terakhir di-update
                                const lastEdited = (kgToShow as any[])
                                  .filter(k => k != null && !!(k as KegiatanEntry).edited_by_name)
                                  .sort((a:any,b:any)=>new Date(b.updated_at||b.created_at||0).getTime()-new Date(a.updated_at||a.created_at||0).getTime())[0] as KegiatanEntry|undefined;
                                return lastEdited
                                  ?<div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-1"><span className="text-[9px]">✏️</span><span className="text-[10px] font-semibold text-slate-600 leading-tight">{lastEdited.edited_by_name}</span></div>
                                    {lastEdited.updated_at&&<span className="text-[8px] text-slate-400 leading-tight">{new Date(lastEdited.updated_at).toLocaleDateString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</span>}
                                  </div>
                                  :<span className="text-gray-300 text-xs">—</span>;
                              })()}
                            </td>
                          )}
                          {/* Action */}
                          {kgIdx===0&&(
                            <td className="px-1 py-3 align-middle text-center" rowSpan={kgToShow.length} style={{verticalAlign:'middle'}}>
                              <ActionGroup>
                                {!isVirtual&&<ViewIconBtn onClick={()=>setViewDetail(row)} />}
                                <EditIconBtn onClick={()=>isVirtual?handleFillVirtual(row):setFillDetail(row)} />
                                {!isVirtual&&isAdmin&&<DeleteIconBtn onClick={()=>handleDeleteRow(row)} />}
                              </ActionGroup>
                            </td>
                          )}
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
                <div className="flex items-center justify-between px-5 py-2.5" style={{borderTop:'1px solid #e5e7eb'}}>
                  <span className="text-[10px] text-gray-400">{displayRows.length} hari kerja ditampilkan</span>
                  <span className="text-[10px] text-gray-400">{rows.length} total · {kegiatanList.filter(k=>displayRows.some(r=>r.id===k.piket_id)).length} kegiatan</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showSchedule&&isAdmin&&<ScheduleModal weekStart={weekStart} users={ptUsers} currentUser={currentUser} onClose={()=>setShowSchedule(false)} onSaved={fetchData}/>}
      {fillDetail&&<FillDetailModal row={fillDetail} onClose={()=>setFillDetail(null)} onSaved={fetchData} currentUser={currentUser}/>}
      {viewDetail&&<ViewDetailModal row={viewDetail} kegiatanList={kegiatanList} currentUser={currentUser} onClose={()=>setViewDetail(null)} onEdit={()=>{setViewDetail(null);setFillDetail(viewDetail);}}/>}
      {showCalendar&&<MiniCalendarPopup allRows={allRows} onClose={()=>setShowCalendar(false)}/>}

      <style>{`
        @keyframes scale-in{from{opacity:0;transform:scale(0.92)}to{opacity:1;transform:scale(1)}}
        select option{background:#ffffff;color:#1e293b}
      `}</style>
    </div>
  );
}

export default function PiketShowroomPage() {
  return (
    <Suspense>
      <PiketShowroomPageInner />
    </Suspense>
  );
}
