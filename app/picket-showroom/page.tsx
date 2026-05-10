'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  PiketRow, KegiatanEntry, UserRow, DayOfWeek,
  DAYS_OF_WEEK, DAY_COLOR, TEAM_LABEL,
  JENIS_KEGIATAN_LIST, KEGIATAN_COLORS, PIE_COLORS,
  getMonday, addDays, toKey, getDayDate, getRollingNameForDate,
} from './_components/shared';
import { MiniPieChart } from './_components/MiniPieChart';
import { TamuSummaryCards } from './_components/TamuSummaryCards';
import { MiniCalendarPopup } from './_components/MiniCalendarPopup';
import { FillDetailModal } from './_components/FillDetailModal';
import { ScheduleModal } from './_components/ScheduleModal';
import { ViewDetailModal } from './_components/ViewDetailModal';
import { exportToExcel } from './_components/excel-export';

export default function PiketShowroomPage() {
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
  const [filterTamu,setFilterTamu]=useState(false);
  const [filterKebutuhan,setFilterKebutuhan]=useState<string|null>(null);
  const [filterInstansi,setFilterInstansi]=useState<string|null>(null);
  const [filterDivision,setFilterDivision]=useState<string|null>(null);
  const [filterKegiatan,setFilterKegiatan]=useState<string|null>(null);
  const [summaryYear,setSummaryYear]=useState<number>(new Date().getFullYear());
  const [summaryMonth,setSummaryMonth]=useState<number|null>(null);
  const wk=toKey(weekStart);

  useEffect(()=>{try{const s=localStorage.getItem('currentUser');if(s)setCurrentUser(JSON.parse(s));}catch{}});
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
    const ch=supabase.channel('piket-rt').on('postgres_changes',{event:'*',schema:'public',table:'piket_schedules'},()=>{setTimeout(fetchData,300);}).subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[fetchData]);

  const isCurrWeek=wk===toKey(getMonday(new Date()));
  const fmtW=(ws:Date)=>`${ws.toLocaleDateString('id-ID',{day:'2-digit',month:'short'})} – ${addDays(ws,4).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})}`;
  const wLabel=fmtW(weekStart);
  const wLabel2=fmtW(addDays(weekStart,7));

  const effectiveRows = useMemo(()=>{
    const existingKeys = new Set(rows.map(r=>`${r.week_start}__${r.day_of_week}`));
    const virtual: PiketRow[] = [];
    [weekStart, addDays(weekStart,7)].forEach(ws=>{
      const wkKey = toKey(ws);
      DAYS_OF_WEEK.forEach((day)=>{
        if(existingKeys.has(`${wkKey}__${day}`)) return;
        const date = getDayDate(ws, day);
        const name = getRollingNameForDate(date, allRows);
        if(!name) return;
        const u = ptUsers.find(x=>x.full_name===name);
        const tt = u?.team_type||'';
        const isIVP=tt==='Team PTS', isUMP=tt==='Team PTS UMP', isMlds=tt==='Team PTS MLDS';
        virtual.push({
          id: `virtual-${wkKey}-${day}`,
          week_start: wkKey,
          day_of_week: day,
          day_date: toKey(date),
          pic_ivp_id: isIVP?(u?.id||null):null,
          pic_ivp_name: isIVP?name:null,
          pic_ump_id: isUMP?(u?.id||null):null,
          pic_ump_name: isUMP?name:null,
          pic_mlds_id: isMlds?(u?.id||null):null,
          pic_mlds_name: isMlds?name:null,
          tamu_instansi: null, kebutuhan: [],
          created_at: '', updated_at: '',
        });
      });
    });
    return [...rows, ...virtual];
  }, [rows, allRows, weekStart, ptUsers]);

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
    if(!confirm(`Hapus jadwal ${row.day_of_week}? (Data kegiatan juga akan dihapus)`)) return;
    await supabase.from('piket_tamu_detail').delete().eq('piket_id',row.id);
    await supabase.from('piket_schedules').delete().eq('id',row.id);
    fetchData();
  },[fetchData]);

  const displayRows = effectiveRows.filter(row=>{
    const matchSearch = !search || row.pic_ivp_name?.toLowerCase().includes(search.toLowerCase()) || row.pic_ump_name?.toLowerCase().includes(search.toLowerCase()) || row.pic_mlds_name?.toLowerCase().includes(search.toLowerCase());
    const matchDay = !filterDay || row.day_of_week === filterDay;
    const kgs = kegiatanList.filter(k=>k.piket_id===row.id);
    const matchTamu = !filterTamu || kgs.some(k=>k.jenis_kegiatan==='Demo Product'&&k.tamu_instansi);
    const matchKebutuhan = !filterKebutuhan || kgs.some(k=>k.kebutuhan?.includes(filterKebutuhan));
    const matchInstansi = !filterInstansi || kgs.some(k=>k.tamu_instansi===filterInstansi);
    const matchDivision = !filterDivision || kgs.some(k=>k.sales_division===filterDivision);
    const matchKegiatan = !filterKegiatan || kgs.some(k=>k.jenis_kegiatan===filterKegiatan);
    return matchSearch && matchDay && matchTamu && matchKebutuhan && matchInstansi && matchDivision && matchKegiatan;
  });

  const formatTime = (timeStr:string) => {
    if(!timeStr) return '';
    const [h,m] = timeStr.split(':');
    return `${h}:${m}`;
  };

  return(
    <div className="min-h-screen" style={{background:'linear-gradient(135deg,rgba(15,23,42,0.95),rgba(30,41,59,0.95))'}}>
      <div className="max-w-7xl mx-auto px-3 py-6 space-y-4">
        {/* Header */}
        <div className="rounded-2xl px-6 py-5 flex flex-col gap-3" style={{background:'rgba(255,255,255,0.95)',boxShadow:'0 10px 40px rgba(0,0,0,0.1)'}}>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h1 className="text-2xl font-black" style={{background:'linear-gradient(135deg,#dc2626,#b91c1c)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>📅 Jadwal Piket Showroom</h1>
                <p className="text-xs text-gray-500 mt-1">PTS Showroom Management System</p>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin&&<button onClick={()=>setShowSchedule(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs text-white" style={{background:'linear-gradient(135deg,#2563eb,#1e40af)',boxShadow:'0 4px 12px rgba(37,99,235,0.3)'}}>📋 Atur Jadwal</button>}
                <button onClick={()=>setShowCalendar(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs" style={{background:'rgba(100,116,139,0.1)',color:'#475569',border:'1px solid rgba(100,116,139,0.25)'}}>📆 Kalender</button>
                <button onClick={()=>exportToExcel(displayRows,kegiatanList)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs" style={{background:'rgba(34,197,94,0.1)',color:'#15803d',border:'1px solid rgba(34,197,94,0.3)'}}>📊 Export</button>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl px-6 py-4 grid grid-cols-1 lg:grid-cols-4 gap-4" style={{background:'rgba(255,255,255,0.97)'}}>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Cari PIC</label>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Ketik nama..." className="w-full px-3 py-2.5 text-sm rounded-lg outline-none" style={{border:'1px solid rgba(0,0,0,0.12)',background:'rgba(255,255,255,0.8)'}}/>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Hari</label>
            <select value={filterDay} onChange={e=>setFilterDay(e.target.value as any)} className="w-full px-3 py-2.5 text-sm rounded-lg outline-none bg-white" style={{border:'1px solid rgba(0,0,0,0.12)'}}>
              <option value="">— Semua Hari —</option>
              {DAYS_OF_WEEK.map(d=><option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Filter</label>
            <select value={filterKegiatan||''} onChange={e=>setFilterKegiatan(e.target.value||null)} className="w-full px-3 py-2.5 text-sm rounded-lg outline-none bg-white" style={{border:'1px solid rgba(0,0,0,0.12)'}}>
              <option value="">— Semua Kegiatan —</option>
              {JENIS_KEGIATAN_LIST.map(j=><option key={j} value={j}>{j}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button onClick={()=>{setSearch('');setFilterDay('');setFilterKegiatan(null);}} className="flex-1 px-3 py-2.5 rounded-lg font-bold text-xs text-gray-600" style={{background:'rgba(100,116,139,0.1)',border:'1px solid rgba(100,116,139,0.25)'}}>🔄 Reset</button>
          </div>
        </div>

        {/* Summary Cards */}
        <TamuSummaryCards allRows={allRows} kegiatanList={kegiatanList} selectedYear={summaryYear} selectedMonth={summaryMonth} onYearChange={setSummaryYear} onMonthChange={setSummaryMonth}/>

        {/* Pie Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {(()=>{
            const kegiatan_map: Record<string,number> = {};
            const produk_map: Record<string,number> = {};
            const kebutuhan_map: Record<string,number> = {};
            displayRows.forEach(r=>{
              const kgs = kegiatanList.filter(k=>k.piket_id===r.id);
              kgs.forEach(kg=>{
                kegiatan_map[kg.jenis_kegiatan] = (kegiatan_map[kg.jenis_kegiatan]||0)+1;
                (kg.produk||[]).forEach(p=>{produk_map[p]=(produk_map[p]||0)+1;});
                (kg.kebutuhan||[]).forEach(k=>{kebutuhan_map[k]=(kebutuhan_map[k]||0)+1;});
              });
            });
            const kegiatanData = Object.entries(kegiatan_map).map(([k,v],i)=>({label:k,value:v,color:KEGIATAN_COLORS[k]||PIE_COLORS[i]}));
            const produkData = Object.entries(produk_map).map(([k,v],i)=>({label:k,value:v,color:PIE_COLORS[i]}));
            const kebutuhanData = Object.entries(kebutuhan_map).map(([k,v],i)=>({label:k,value:v,color:PIE_COLORS[i]})).slice(0,6);
            return(
              <>
                <MiniPieChart data={kegiatanData} title="Kegiatan" icon="📋" activeFilter={filterKegiatan} onSliceClick={setFilterKegiatan}/>
                <MiniPieChart data={produkData} title="Produk" icon="📦" activeFilter={filterKegiatan} unitSuffix="×"/>
                <MiniPieChart data={kebutuhanData} title="Top 6 Kebutuhan" icon="🎯" activeFilter={filterKebutuhan} onSliceClick={setFilterKebutuhan} unitSuffix="×"/>
              </>
            );
          })()}
        </div>

        {/* Table */}
        <div className="rounded-2xl overflow-hidden" style={{background:'rgba(255,255,255,0.97)',boxShadow:'0 10px 40px rgba(0,0,0,0.08)'}}>
          {loading?(
            <div className="flex justify-center py-20"><div className="w-8 h-8 rounded-full border-3 border-t-red-600 border-red-200 animate-spin"/></div>
          ):(
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{background:'linear-gradient(135deg,#1e293b,#0f172a)'}}>
                      <th className="px-4 py-3.5 text-left text-xs font-black text-white tracking-wider" style={{borderRight:'1px solid rgba(255,255,255,0.1)'}}>No</th>
                      <th className="px-4 py-3.5 text-left text-xs font-black text-white tracking-wider" style={{borderRight:'1px solid rgba(255,255,255,0.1)'}}>Hari</th>
                      <th className="px-4 py-3.5 text-left text-xs font-black text-white tracking-wider" style={{borderRight:'1px solid rgba(255,255,255,0.1)'}}>Tanggal</th>
                      <th className="px-4 py-3.5 text-left text-xs font-black text-white tracking-wider" style={{borderRight:'1px solid rgba(255,255,255,0.1)'}}>PIC</th>
                      <th className="px-4 py-3.5 text-left text-xs font-black text-white tracking-wider" style={{borderRight:'1px solid rgba(255,255,255,0.1)'}}>Kegiatan</th>
                      <th className="px-4 py-3.5 text-left text-xs font-black text-white tracking-wider" style={{borderRight:'1px solid rgba(255,255,255,0.1)'}}>Jam</th>
                      <th className="px-4 py-3.5 text-left text-xs font-black text-white tracking-wider" style={{borderRight:'1px solid rgba(255,255,255,0.1)'}}>Produk</th>
                      <th className="px-4 py-3.5 text-left text-xs font-black text-white tracking-wider" style={{borderRight:'1px solid rgba(255,255,255,0.1)'}}>Tamu</th>
                      <th className="px-4 py-3.5 text-left text-xs font-black text-white tracking-wider" style={{borderRight:'1px solid rgba(255,255,255,0.1)'}}>Sales</th>
                      <th className="px-4 py-3.5 text-left text-xs font-black text-white tracking-wider" style={{borderRight:'1px solid rgba(255,255,255,0.1)'}}>Keterangan</th>
                      <th className="px-4 py-3.5 text-left text-xs font-black text-white tracking-wider" style={{borderRight:'1px solid rgba(255,255,255,0.1)'}}>Edit By</th>
                      <th className="px-4 py-3.5 text-center text-xs font-black text-white tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayRows.map((row,rowIdx)=>{
                      const kgToShow=kegiatanList.filter(k=>k.piket_id===row.id);
                      const isVirtual=row.id.startsWith('virtual-');
                      const dc=DAY_COLOR[row.day_of_week];
                      const dateObj=new Date(row.day_date+'T00:00:00');
                      const dateLabel=dateObj.toLocaleDateString('id-ID',{day:'2-digit',month:'2-digit'});
                      return kgToShow.length===0?(
                        <tr key={row.id} style={{borderBottom:'1px solid #e5e7eb'}}>
                          <td className="px-4 py-3 text-xs font-semibold text-slate-600">{rowIdx+1}</td>
                          <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-black flex-shrink-0" style={{background:dc.grad}}>{row.day_of_week.slice(0,3).toUpperCase()}</div><span className="text-xs font-bold" style={{color:dc.accent}}>{row.day_of_week}</span></div></td>
                          <td className="px-4 py-3 text-xs font-semibold text-slate-700">{dateLabel}</td>
                          <td className="px-4 py-3"><div className="flex items-center gap-1">{[row.pic_ivp_name,row.pic_ump_name,row.pic_mlds_name].filter(Boolean).map((n,i)=><span key={i} className="text-[10px] font-bold px-2 py-1 rounded-lg" style={{background:`${dc.accent}15`,color:dc.accent}}>{n}</span>)}{![row.pic_ivp_name,row.pic_ump_name,row.pic_mlds_name].some(Boolean)&&<span className="text-gray-300 text-xs">—</span>}</div></td>
                          <td colSpan={7} className="px-4 py-3 text-xs text-gray-400">—</td>
                          <td className="px-4 py-3 text-[10px] font-semibold text-slate-600">{row.edited_by_name?<><span>✏️</span> {row.edited_by_name}</>:<span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3 text-center"><div className="flex items-center justify-center gap-2">{isVirtual?<button onClick={()=>handleFillVirtual(row)} className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-sm transition-all hover:scale-110" style={{background:'#2563eb15',color:'#2563eb'}}>➕</button>:<><button onClick={()=>setViewDetail(row)} className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-sm transition-all hover:scale-110 hover:bg-blue-100">👁️</button><button onClick={()=>setFillDetail(row)} className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-sm transition-all hover:scale-110 hover:bg-orange-100">✏️</button><button onClick={()=>handleDeleteRow(row)} className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-sm transition-all hover:scale-110 hover:bg-red-100">🗑️</button></>}</div></td>
                        </tr>
                      ):(
                        kgToShow.map((kg,kgIdx)=>(
                          <tr key={`${row.id}-${kgIdx}`} style={{borderBottom:'1px solid #e5e7eb'}}>
                            {kgIdx===0&&<td className="px-4 py-3 text-xs font-semibold text-slate-600" rowSpan={kgToShow.length}>{rowIdx+1}</td>}
                            {kgIdx===0&&<td className="px-4 py-3" rowSpan={kgToShow.length}><div className="flex items-center gap-2"><div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-black flex-shrink-0" style={{background:dc.grad}}>{row.day_of_week.slice(0,3).toUpperCase()}</div><span className="text-xs font-bold" style={{color:dc.accent}}>{row.day_of_week}</span></div></td>}
                            {kgIdx===0&&<td className="px-4 py-3 text-xs font-semibold text-slate-700" rowSpan={kgToShow.length}>{dateLabel}</td>}
                            {kgIdx===0&&<td className="px-4 py-3" rowSpan={kgToShow.length}><div className="flex items-center gap-1">{[row.pic_ivp_name,row.pic_ump_name,row.pic_mlds_name].filter(Boolean).map((n,i)=><span key={i} className="text-[10px] font-bold px-2 py-1 rounded-lg" style={{background:`${dc.accent}15`,color:dc.accent}}>{n}</span>)}{![row.pic_ivp_name,row.pic_ump_name,row.pic_mlds_name].some(Boolean)&&<span className="text-gray-300 text-xs">—</span>}</div></td>}
                            <td className="px-4 py-3"><div className="flex flex-col gap-1"><span className="text-[10px] font-bold border-b-2 pb-0.5 w-fit" style={{color:KEGIATAN_COLORS[kg.jenis_kegiatan]||dc.accent,borderBottomColor:KEGIATAN_COLORS[kg.jenis_kegiatan]||dc.accent}}>{kg.jenis_kegiatan}</span>{kg.jenis_kegiatan==='RnD'&&(kg as any).team_rnd&&<div className="flex items-center gap-1 mt-0.5"><span className="text-[9px] font-semibold text-violet-500">👥</span><span className="text-[9px] font-semibold text-violet-700">{(kg as any).team_rnd}</span>{(()=>{const u=ptUsers.find(x=>x.full_name===(kg as any).team_rnd);const teamLabel=u?.team_type==='Team PTS'?'PTS IVP':u?.team_type==='Team PTS UMP'?'PTS UMP':u?.team_type==='Team PTS MLDS'?'PTS MLDS':'';const tc=teamLabel?TEAM_LABEL[teamLabel]:null;return tc?<span className="text-[8px] font-black px-1 py-0.5 rounded text-white" style={{background:tc.dot}}>{teamLabel}</span>:null;})()}</div>}{kg.jenis_kegiatan==='Demo Product'&&kg.kebutuhan&&kg.kebutuhan.length>0&&<div className="flex flex-col gap-0.5 mt-0.5">{kg.kebutuhan.map(k=><span key={k} className="flex items-center gap-1 text-[9px] font-semibold text-slate-500 leading-tight"><span className="w-1 h-1 rounded-full flex-shrink-0" style={{background:dc.accent}}/>{k}</span>)}</div>}</div></td>
                            <td className="px-4 py-3">{kg?.jam_mulai?<div className="flex flex-col gap-0.5"><div className="flex items-center gap-1"><span className="text-[8px] font-bold text-slate-400 w-10 flex-shrink-0">Mulai</span><span className="text-xs font-bold text-slate-700">{formatTime(kg.jam_mulai)}</span></div><div className="flex items-center gap-1"><span className="text-[8px] font-bold text-slate-400 w-10 flex-shrink-0">Selesai</span><span className="text-xs font-bold text-slate-700">{formatTime(kg.jam_selesai)}</span></div></div>:<span className="text-gray-300 text-xs">—</span>}</td>
                            <td className="px-4 py-3">{kg?.produk&&kg.produk.length>0?<div className="flex flex-col gap-0.5">{kg.produk.map(p=><span key={p} className="text-[10px] font-semibold" style={{color:dc.accent}}>{p}</span>)}</div>:<span className="text-gray-300 text-xs">—</span>}</td>
                            <td className="px-4 py-3">{kg?.tamu_instansi?<button onClick={()=>setFilterInstansi(filterInstansi===kg.tamu_instansi?null:kg.tamu_instansi!)} className="flex items-center gap-1 hover:opacity-80 text-left"><span>🏢</span><span className="text-xs font-semibold text-slate-700 underline decoration-dotted">{kg.tamu_instansi}</span></button>:<span className="text-gray-300 text-xs">—</span>}</td>
                            <td className="px-4 py-3">{kg?.nama_sales?<div className="flex flex-col gap-0.5"><span className="text-[10px] font-bold text-slate-800">{kg.nama_sales}</span>{kg.sales_division&&<span className="text-[9px] text-purple-500 font-semibold">{kg.sales_division}</span>}</div>:<span className="text-gray-300 text-xs">—</span>}</td>
                            <td className="px-4 py-3">{kg?.keterangan?<span className="text-xs text-slate-600 leading-snug">{kg.keterangan}</span>:<span className="text-gray-300 text-xs">—</span>}</td>
                            {kgIdx===0&&<td className="px-4 py-3 text-[10px] font-semibold text-slate-600" rowSpan={kgToShow.length}>{row.edited_by_name?<><span>✏️</span> {row.edited_by_name}</>:<span className="text-gray-300">—</span>}</td>}
                            {kgIdx===0&&<td className="px-4 py-3 text-center" rowSpan={kgToShow.length}><div className="flex items-center justify-center gap-2">{isVirtual?<button onClick={()=>handleFillVirtual(row)} className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-sm transition-all hover:scale-110" style={{background:'#2563eb15',color:'#2563eb'}}>➕</button>:<><button onClick={()=>setViewDetail(row)} className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-sm transition-all hover:scale-110 hover:bg-blue-100">👁️</button><button onClick={()=>setFillDetail(row)} className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-sm transition-all hover:scale-110 hover:bg-orange-100">✏️</button><button onClick={()=>handleDeleteRow(row)} className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-sm transition-all hover:scale-110 hover:bg-red-100">🗑️</button></>}</div></td>}
                          </tr>
                        ))
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between px-5 py-2.5" style={{borderTop:'1px solid #e5e7eb',background:'rgba(0,0,0,0.02)'}}>
                <span className="text-[10px] text-gray-400">{displayRows.length} hari kerja ditampilkan</span>
                <span className="text-[10px] text-gray-400">{rows.length} total · {kegiatanList.filter(k=>displayRows.some(r=>r.id===k.piket_id)).length} kegiatan</span>
              </div>
            </>
          )}
        </div>
      </div>

      {showSchedule&&isAdmin&&<ScheduleModal weekStart={weekStart} users={ptUsers} currentUser={currentUser} onClose={()=>setShowSchedule(false)} onSaved={fetchData}/>}
      {fillDetail&&<FillDetailModal row={fillDetail} onClose={()=>setFillDetail(null)} onSaved={fetchData} currentUser={currentUser}/>}
      {viewDetail&&<ViewDetailModal row={viewDetail} kegiatanList={kegiatanList} currentUser={currentUser} onClose={()=>setViewDetail(null)} onEdit={()=>{setViewDetail(null);const dbRow=rows.find(r=>r.id===viewDetail.id);if(dbRow)setFillDetail(dbRow);}}/>}
      {showCalendar&&<MiniCalendarPopup allRows={allRows} onClose={()=>setShowCalendar(false)}/>}

      <style jsx>{`
        @keyframes scale-in{from{opacity:0;transform:scale(0.92)}to{opacity:1;transform:scale(1)}}
        select option{background:#ffffff;color:#1e293b}
      `}</style>
    </div>
  );
}
