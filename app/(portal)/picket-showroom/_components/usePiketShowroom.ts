'use client';

import { denganNilai, useDaftarPilihan, produkSpesifik } from '@/lib/daftar-pilihan';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth/sesi';
import { logAudit } from '@/lib/audit';
import { hasFullAccess } from '@/lib/constants';
import { hitungLingkupProject, filterLingkup } from '@/lib/project-scope';
import { bisaLihatSemuaTamu, bisaIsiKegiatan } from '@/lib/piket/akses';
import { PiketRow, KegiatanEntry, UserRow, DayOfWeek, DAYS_OF_WEEK, KEGIATAN_COLORS, PIE_COLORS, getMonday, addDays, toKey, getDayDate, getRollingNameForDate, tulisPicPiket } from './shared';
import { namaKelompokPTS } from '@/lib/kelompok/inti';
import { type ConfirmState, type Notif } from '@/components/shared';
import { exportToExcel } from './excel-export';

export function usePiketShowroom() {
  const daftarKegiatan = useDaftarPilihan('piket-kegiatan');
  const daftarProduk = useDaftarPilihan('piket-produk');
  const searchParams = useSearchParams();
  const [currentUser,setCurrentUser]=useState<any>(null);
  const [weekStart,setWeekStart]=useState<Date>(()=>getMonday(new Date()));
  const [rows,setRows]=useState<PiketRow[]>([]);
  const [allRows,setAllRows]=useState<PiketRow[]>([]);
  const [kegiatanList,setKegiatanList]=useState<KegiatanEntry[]>([]);
  const [ptUsers,setPtUsers]=useState<UserRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [fetchError,setFetchError]=useState<string|null>(null);
  const [holidays,setHolidays]=useState<string[]>([]);
  const [showSchedule,setShowSchedule]=useState(false);
  const [showCalendar,setShowCalendar]=useState(false);
  const [fillDetail,setFillDetail]=useState<PiketRow|null>(null);
  const [viewDetail,setViewDetail]=useState<PiketRow|null>(null);
  const [search,setSearch]=useState('');
  const [filterDay,setFilterDay]=useState<DayOfWeek|''>('');

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
  const [confirmState,setConfirmState]=useState<ConfirmState|null>(null);
  const [toast,setToast]=useState<Notif|null>(null);
  const beritahu=(type:'success'|'error',msg:string)=>{ setToast({type,msg}); setTimeout(()=>setToast(null),3200); };
  const wk=toKey(weekStart);

  useEffect(()=>{
    const u=getSession<{username?:string}>(); if(!u) return;
    setCurrentUser(u as unknown as UserRow);
    if(!u.username) return;
    supabase.from('users').select('piket_akses,piket_ubah,access_level,role,team_type').eq('username',u.username).single()
      .then(({data}:{data:{piket_akses:string|null;piket_ubah:boolean|null;access_level:string|null;role:string|null;team_type:string|null}|null})=>{
        if(data) setCurrentUser((prev:any)=>prev?{...prev,...data}:prev);
      });
  },[]);
  const isAdmin=hasFullAccess(currentUser);
  const bolehIsi=bisaIsiKegiatan(currentUser);

  const fetchData=useCallback(async()=>{
    setLoading(true);
    setFetchError(null);
    const wk2=toKey(addDays(weekStart,7));
    try {
      let kgQ = supabase.from('piket_tamu_detail').select('*').order('created_at');
      if (!bisaLihatSemuaTamu(currentUser)) {
        const lingkup = await hitungLingkupProject(currentUser as never);
        const batas = filterLingkup(lingkup, 'nama_sales', 'sales_division', { sertakanTanpaPemilik: true });
        if (batas) kgQ = kgQ.or(batas);
      }

      const[wRes,aRes,uRes,kgRes,plRes]=await Promise.all([
        supabase.from('piket_schedules').select('*').in('week_start',[wk,wk2]).order('day_date'),
        supabase.from('piket_schedules').select('id,day_date,week_start,day_of_week,pic,pic_ivp_name,pic_ump_name,pic_mvi_name,pic_ivp_id,pic_ump_id,pic_mvi_id'),
        supabase.from('users').select('id,full_name,username,team_type,role').in('team_type',namaKelompokPTS()).order('full_name'),
        kgQ,
        supabase.from('piket_produk_lain').select('kegiatan_id,nama,watt'),
      ]);
      const firstErr = wRes.error || aRes.error || uRes.error || kgRes.error;
      if (firstErr) { setFetchError(firstErr.message); setLoading(false); return; }
      if(wRes.data)setRows(wRes.data as PiketRow[]);
      if(aRes.data)setAllRows(aRes.data as PiketRow[]);
      if(uRes.data)setPtUsers(uRes.data.filter((u:any)=>u.role!=='admin'&&u.role!=='superadmin') as UserRow[]);
      if(kgRes.data){
        const plByKg:Record<string,{nama:string;watt:number}[]>={};
        (plRes.data||[]).forEach((pl:{kegiatan_id:string;nama:string;watt:number})=>{(plByKg[pl.kegiatan_id]=plByKg[pl.kegiatan_id]||[]).push({nama:pl.nama||'',watt:pl.watt||0});});
        setKegiatanList((kgRes.data as KegiatanEntry[]).map(k=>({...k,produk_lain:plByKg[k.id||'']||[]})));
      }
      const hRes = await supabase.from('picket_holidays').select('date');
      if (hRes.data) setHolidays(hRes.data.map((h: any) => h.date));
    } catch (err: any) {
      setFetchError(err?.message ?? 'Gagal memuat data');
    }
    setLoading(false);
  },[weekStart,currentUser]);

  useEffect(()=>{fetchData();},[fetchData]);
  useEffect(()=>{
    const ch=supabase.channel('piket-rt').on('postgres_changes',{event:'*',schema:'public',table:'piket_schedules'},()=>{setTimeout(fetchData,300);}).on('postgres_changes',{event:'*',schema:'public',table:'piket_tamu_detail'},()=>{setTimeout(fetchData,300);}).subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[fetchData]);

  const currMondayKey=toKey(getMonday(new Date()));
  const isCurrWeek=wk===currMondayKey||toKey(addDays(weekStart,7))===currMondayKey;
  const fmtW=(ws:Date)=>`${ws.toLocaleDateString('id-ID',{day:'2-digit',month:'short'})} – ${addDays(ws,4).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})}`;
  const wLabel=fmtW(weekStart);
  const wLabel2=fmtW(addDays(weekStart,7));

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
        const isPast = dateKey < todayKey;
        const name = isPast ? null : getRollingNameForDate(date, allRows, holidays);
        const u = name ? ptUsers.find(x=>x.full_name===name) : undefined;
        virtual.push({
          id: `virtual-${wkKey}-${day}`,
          week_start: wkKey,
          day_of_week: day,
          day_date: dateKey,
          ...tulisPicPiket(u ? { id: u.id, full_name: name, team_type: u.team_type } : null),
          tamu_instansi: null, kebutuhan: [],
          created_at: '', updated_at: '',
        } as PiketRow);
      });
    });
    return [...rows, ...virtual];
  }, [rows, allRows, weekStart, ptUsers, holidays]);

  const handleFillVirtual = useCallback(async(row: PiketRow)=>{
    const{error}=await supabase.from('piket_schedules').upsert({
      week_start: row.week_start,
      day_of_week: row.day_of_week,
      day_date: row.day_date,
      pic_ivp_id: row.pic_ivp_id,
      pic_ivp_name: row.pic_ivp_name,
      pic_ump_id: row.pic_ump_id,
      pic_ump_name: row.pic_ump_name,
      pic_mvi_id: row.pic_mvi_id,
      pic_mvi_name: row.pic_mvi_name,
      tamu_instansi: null, kebutuhan: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },{onConflict:'week_start,day_of_week',ignoreDuplicates:false});
    if(error){console.error('Failed to save virtual row:',error.message);return;}
    const{data}=await supabase.from('piket_schedules').select('*').eq('week_start',row.week_start).eq('day_of_week',row.day_of_week).single();
    if(data){setFillDetail(data as PiketRow);fetchData();}
  },[fetchData]);

  const handleDeleteRow = useCallback((row: PiketRow)=>{
    setConfirmState({
      message: `Hapus semua kegiatan ${row.day_of_week}?`,
      description: 'Jadwal piket tetap ada.',
      danger: true,
      confirmLabel: 'Hapus',
      onConfirm: async () => {
        const { data, error } = await supabase.from('piket_tamu_detail').delete().eq('piket_id',row.id).select('id');
        if (error || !data || data.length === 0) beritahu('error','Gagal menghapus kegiatan. Coba lagi.');
        else void logAudit({ user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? currentUser?.username ?? '', action: 'delete', module: 'picket-showroom', target_id: row.id, notes: `Hapus kegiatan ${row.day_of_week} ${row.day_date}` });
        fetchData();
      },
    });
  },[fetchData, currentUser, setConfirmState]);

  const toggleHoliday = useCallback(async (date: string) => {
    if (holidays.includes(date)) {
      const { data, error } = await supabase.from('picket_holidays').delete().eq('date', date).select('date');
      if (error || !data || data.length === 0) { beritahu('error','Gagal membatalkan libur. Coba lagi.'); return; }
      setHolidays(prev => prev.filter(d => d !== date));
    } else {
      const { data, error } = await supabase.from('picket_holidays')
        .insert({ date, label: 'Libur', created_by: currentUser?.full_name ?? '' }).select('date');
      if (error || !data || data.length === 0) { beritahu('error','Gagal menandai libur. Coba lagi.'); return; }
      setHolidays(prev => [...prev, date]);
    }
  }, [holidays, currentUser]);

  const formatTime = (timeStr:string) => {
    if(!timeStr) return '';
    const [h,m] = timeStr.split(':');
    return `${h}:${m}`;
  };

  const cascadedRows = useMemo(() => {
    if (holidays.length === 0) return effectiveRows;
    const holidaySet = new Set(holidays);
    const savedSorted = [...effectiveRows]
      .filter(r => !r.id.startsWith('virtual-'))
      .sort((a, b) => a.day_date.localeCompare(b.day_date));
    if (savedSorted.length === 0) return effectiveRows;
    const picPool = savedSorted.map(r => ({
      pic_ivp_id: r.pic_ivp_id, pic_ivp_name: r.pic_ivp_name,
      pic_ump_id: r.pic_ump_id, pic_ump_name: r.pic_ump_name,
      pic_mvi_id: r.pic_mvi_id, pic_mvi_name: r.pic_mvi_name,
    }));
    let poolIdx = 0;
    const remapped = new Map(savedSorted.map(row => {
      if (holidaySet.has(row.day_date)) {
        return [row.id, { ...row, pic_ivp_id: null, pic_ivp_name: null, pic_ump_id: null, pic_ump_name: null, pic_mvi_id: null, pic_mvi_name: null }];
      }
      const pic = picPool[Math.min(poolIdx++, picPool.length - 1)];
      return [row.id, { ...row, ...pic }];
    }));
    return effectiveRows.map(r => remapped.get(r.id) ?? r);
  }, [effectiveRows, holidays]);

  const displayRows = cascadedRows.filter(row=>{
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
      const mp=!!(row.pic_ivp_name?.toLowerCase().includes(q)||row.pic_ump_name?.toLowerCase().includes(q)||row.pic_mvi_name?.toLowerCase().includes(q)||row.day_of_week.toLowerCase().includes(q));
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
  const kPieAll=Object.entries(filteredKgPie.reduce((acc,k)=>{(k.kebutuhan||[]).forEach(x=>{acc[x]=(acc[x]||0)+1;});return acc;},{}as Record<string,number>)).sort(([,a],[,b])=>b-a).map(([label,value],i)=>({label,value,color:PIE_COLORS[i%PIE_COLORS.length]}));
  const divPieAll=Object.entries(filteredKgPie.reduce((acc,k)=>{if(k.sales_division)acc[k.sales_division]=(acc[k.sales_division]||0)+1;return acc;},{}as Record<string,number>)).sort(([,a],[,b])=>b-a).map(([label,value],i)=>({label,value,color:PIE_COLORS[i%PIE_COLORS.length]}));
  const kgTypePie=denganNilai(daftarKegiatan, filteredKgPie.map(k=>k.jenis_kegiatan)).map((j,i)=>({label:j,value:filteredKgPie.filter(k=>k.jenis_kegiatan===j).length,color:KEGIATAN_COLORS[j]||PIE_COLORS[i%PIE_COLORS.length]})).filter(d=>d.value>0);
  const instansiPie=Object.entries(filteredKgPie.filter(k=>k.tamu_instansi).reduce((acc,k)=>{const key=k.tamu_instansi!;acc[key]=(acc[key]||0)+1;return acc;},{}as Record<string,number>)).sort(([,a],[,b])=>b-a).map(([label,value],i)=>({label,value,color:PIE_COLORS[i%PIE_COLORS.length]}));
  const PRODUK_SPESIFIK=produkSpesifik(daftarProduk);
  const produkPie=Object.entries(filteredKgPie.reduce((acc,k)=>{
    const produk=k.produk||[];
    if(produk.includes('All Product')){
      PRODUK_SPESIFIK.forEach(p=>{acc[p]=(acc[p]||0)+1;});
    } else {
      produk.forEach(p=>{acc[p]=(acc[p]||0)+1;});
    }
    return acc;
  },{}as Record<string,number>)).sort(([,a],[,b])=>b-a).map(([label,value],i)=>({label,value,color:PIE_COLORS[i%PIE_COLORS.length]}));

  const MONTH_NAMES=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const exportMonth=()=>{
    if(summaryMonth===null)return;
    const monthRows=allRows.filter(r=>{const d=r.day_date||'';return !!d&&parseInt(d.slice(0,4),10)===summaryYear&&parseInt(d.slice(5,7),10)===summaryMonth;});
    const ids=new Set(monthRows.map(r=>r.id));
    const monthKg=kegiatanList.filter(k=>ids.has(k.piket_id));
    exportToExcel(monthRows,monthKg,`${MONTH_NAMES[summaryMonth-1]}_${summaryYear}`);
  };
  return {
    confirmState, setConfirmState, toast, loading, rows, allRows, kegiatanList, summaryMonth,
    exportMonth, MONTH_NAMES, isAdmin, setShowSchedule, currentUser, bolehIsi, summaryYear, setSummaryYear,
    setSummaryMonth, instansiPie, filterInstansi, setFilterInstansi, kgTypePie, filterKegiatan, setFilterKegiatan, produkPie,
    kPieAll, filterKebutuhan, setFilterKebutuhan, divPieAll, filterDivision, setFilterDivision, displayRows, wLabel,
    wLabel2, isCurrWeek, setWeekStart, setShowCalendar, search, filterDay, filterTamu, setSearch,
    setFilterDay, setFilterTamu, daftarKegiatan, fetchError, setFetchError, fetchData, holidays, setViewDetail,
    setFillDetail, handleFillVirtual, handleDeleteRow, toggleHoliday, ptUsers, formatTime, showSchedule, weekStart,
    fillDetail, viewDetail, showCalendar,
  };
}
