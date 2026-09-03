'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { hasFullAccess } from '@/lib/constants';
import { hitungLingkupProject, filterLingkup } from '@/lib/project-scope';
import { bisaLihatSemuaTamu, bisaIsiKegiatan } from '@/lib/piket-akses';
import {
  PiketRow, KegiatanEntry, UserRow, DayOfWeek,
  DAYS_OF_WEEK, DAY_COLOR, TEAM_LABEL,
  JENIS_KEGIATAN_LIST, KEGIATAN_COLORS, PIE_COLORS,
  getMonday, addDays, toKey, getDayDate, getRollingNameForDate,
} from './_components/shared';
import { MiniPieChart, PageHeader, ConfirmDialog, type ConfirmState, ErrorState, ListEmptyState, ModalPortal } from '@/components/shared';
import { TamuSummaryCards } from './_components/TamuSummaryCards';
import { MiniCalendarPopup } from './_components/MiniCalendarPopup';
import { FillDetailModal } from './_components/FillDetailModal';
import { ScheduleModal } from './_components/ScheduleModal';
import { ViewDetailModal } from './_components/ViewDetailModal';
import { exportToExcel } from './_components/excel-export';
import { ViewIconBtn, EditIconBtn, DeleteIconBtn, ActionGroup } from '@/components/shared';

// Main Page

function PiketShowroomPageInner() {
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

  // Auto-apply filter dari Global Search (?q=...)
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
  const wk=toKey(weekStart);

  useEffect(()=>{
    const u=getSession<{username?:string}>(); if(!u) return;
    setCurrentUser(u as unknown as UserRow);
    /*
      piket_akses dibaca ULANG dari basis data, tidak dipercayakan pada
      salinan sesi di peramban. Sesi bisa berumur berhari-hari, sementara
      setelannya baru saja diubah admin - dan tanpa ini resepsionis harus
      logout/login dulu sebelum halamannya terisi, tanpa ada yang memberitahu.
    */
    if(!u.username) return;
    supabase.from('users').select('piket_akses,access_level,role,team_type').eq('username',u.username).single()
      .then(({data}:{data:{piket_akses:string|null;access_level:string|null;role:string|null;team_type:string|null}|null})=>{
        if(data) setCurrentUser((prev:any)=>prev?{...prev,...data}:prev);
      });
  },[]);
  // Admin/superadmin, ATAU akun Team PTS dengan toggle "Full Access" aktif
  // (lihat lib/constants.ts hasFullAccess) - mis. Manager PTS yang mengelola
  // jadwal piket timnya sendiri.
  const isAdmin=hasFullAccess(currentUser);
  /*
    Hak MENGISI kegiatan piket - beda dari isAdmin (yang mengatur roster) dan
    beda dari hak melihat. Tombol Edit dulu dirender tanpa syarat apa pun,
    jadi setiap akun yang diberi menu Piket Showroom bisa mengubah catatan
    hari itu - termasuk akun Sales & resepsionis yang seharusnya membaca saja.
    Yang piket hari itu Tim PTS, dan merekalah yang mencatat tamunya.
  */
  const bolehIsi=bisaIsiKegiatan(currentUser);

  const fetchData=useCallback(async()=>{
    setLoading(true);
    setFetchError(null);
    const wk2=toKey(addDays(weekStart,7));
    try {
      // Isolasi antar-Sales pada catatan kegiatan tamu
      // piket_tamu_detail mencatat nama_sales & sales_division: siapa membawa
      // tamu mana, untuk project apa. Jadwal piketnya sendiri memang terbuka
      // (itu roster PTS), tapi catatan kegiatannya tidak - Sales divisi lain
      // tidak berkepentingan dengan daftar kunjungan pelanggan divisi tetangga.
      //
      // Batas dipasang DI QUERY, bukan saat render, supaya barisnya tidak
      // pernah sampai ke browser dan terbaca lewat DevTools.
      //  Batasnya HANYA untuk yang memang Sales. Resepsionis / front desk
      //  bukan Sales - namanya tidak pernah muncul sebagai nama_sales - jadi
      //  aturan lingkup Sales menyisakan NOL baris untuknya, dan seluruh
      //  ringkasan halaman ini tampil kosong (total jam 0, semua pie chart
      //  kosong). Bukan disembunyikan dengan sengaja, tapi efeknya sama.
      //  Siapa yang dikecualikan diatur per akun (users.piket_akses), bukan
      //  ditebak dari role atau dari kepemilikan menu.
      let kgQ = supabase.from('piket_tamu_detail').select('*').order('created_at');
      if (!bisaLihatSemuaTamu(currentUser)) {
        const lingkup = await hitungLingkupProject(currentUser as never);
        //  sertakanTanpaPemilik: kegiatan tanpa nama sales sama sekali
        //  (training internal, maintenance, standby - hampir separuh isi
        //  tabel) bukan kunjungan pelanggan siapa pun. Tanpa ini, Sales pun
        //  kehilangan separuh halaman, padahal batasannya cuma dimaksudkan
        //  untuk menutup pelanggan divisi tetangga.
        const batas = filterLingkup(lingkup, 'nama_sales', 'sales_division', { sertakanTanpaPemilik: true });
        if (batas) kgQ = kgQ.or(batas);
      }

      const[wRes,aRes,uRes,kgRes,plRes]=await Promise.all([
        supabase.from('piket_schedules').select('*').in('week_start',[wk,wk2]).order('day_date'),
        supabase.from('piket_schedules').select('id,day_date,week_start,day_of_week,pic_ivp_name,pic_ump_name,pic_mvi_name'),
        supabase.from('users').select('id,full_name,username,team_type,role').in('team_type',['Team PTS IVP','Team PTS UMP','Team PTS MVI']).order('full_name'),
        kgQ,
        supabase.from('piket_produk_lain').select('kegiatan_id,nama,watt'), // optional — tabel mungkin belum ada
      ]);
      const firstErr = wRes.error || aRes.error || uRes.error || kgRes.error; // plRes sengaja tidak diikutkan (opsional)
      if (firstErr) { setFetchError(firstErr.message); setLoading(false); return; }
      if(wRes.data)setRows(wRes.data as PiketRow[]);
      if(aRes.data)setAllRows(aRes.data as PiketRow[]);
      if(uRes.data)setPtUsers(uRes.data.filter((u:any)=>u.role!=='admin'&&u.role!=='superadmin') as UserRow[]);
      if(kgRes.data){
        const plByKg:Record<string,{nama:string;watt:number}[]>={};
        (plRes.data||[]).forEach((pl:{kegiatan_id:string;nama:string;watt:number})=>{(plByKg[pl.kegiatan_id]=plByKg[pl.kegiatan_id]||[]).push({nama:pl.nama||'',watt:pl.watt||0});});
        setKegiatanList((kgRes.data as KegiatanEntry[]).map(k=>({...k,produk_lain:plByKg[k.id||'']||[]})));
      }
      // Holidays: optional - if table doesn't exist yet, silently ignore
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

  // FIX: isCurrWeek true jika salah satu dari 2 minggu yang ditampilkan adalah minggu ini
  const currMondayKey=toKey(getMonday(new Date()));
  const isCurrWeek=wk===currMondayKey||toKey(addDays(weekStart,7))===currMondayKey;
  const fmtW=(ws:Date)=>`${ws.toLocaleDateString('id-ID',{day:'2-digit',month:'short'})} – ${addDays(ws,4).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})}`;
  const wLabel=fmtW(weekStart);
  const wLabel2=fmtW(addDays(weekStart,7));

  // Generate virtual rows untuk minggu yang belum ada di DB
  // FIX 1: Selalu tampilkan semua 10 hari kerja meski rolling name belum ada (PIC kosong)
  // FIX 2: Hari yang sudah LEWAT (< hari ini) dan tidak ada di DB  tampil kosong tanpa rolling
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
        const name = isPast ? null : getRollingNameForDate(date, allRows, holidays);
        const u = name ? ptUsers.find(x=>x.full_name===name) : undefined;
        const tt = u?.team_type||'';
        const isIVP=tt==='Team PTS IVP', isUMP=tt==='Team PTS UMP', isMvi=tt==='Team PTS MVI';
        virtual.push({
          id: `virtual-${wkKey}-${day}`,
          week_start: wkKey,
          day_of_week: day,
          day_date: dateKey,
          pic_ivp_id: isIVP?(u?.id||null):null,
          pic_ivp_name: isIVP?(name||null):null,
          pic_ump_id: isUMP?(u?.id||null):null,
          pic_ump_name: isUMP?(name||null):null,
          pic_mvi_id: isMvi?(u?.id||null):null,
          pic_mvi_name: isMvi?(name||null):null,
          tamu_instansi: null, kebutuhan: [],
          created_at: '', updated_at: '',
        });
      });
    });
    return [...rows, ...virtual];
  }, [rows, allRows, weekStart, ptUsers, holidays]);

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
        //  Diperiksa: fetchData() di bawah tetap membaca ulang dari server
        //  (jadi layar tidak berbohong), tapi tanpa ini kegagalan lewat tanpa
        //  penjelasan - kelihatannya "tidak terjadi apa-apa".
        const { data, error } = await supabase.from('piket_tamu_detail').delete().eq('piket_id',row.id).select('id');
        if (error || !data || data.length === 0) alert('Gagal menghapus kegiatan. Coba lagi.');
        else void logAudit({ user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? currentUser?.username ?? '', action: 'delete', module: 'picket-showroom', target_id: row.id, notes: `Hapus kegiatan ${row.day_of_week} ${row.day_date}` });
        fetchData();
      },
    });
  },[fetchData, currentUser, setConfirmState]);

  const toggleHoliday = useCallback(async (date: string) => {
    /*
      Diperiksa hasilnya sebelum mengubah state layar - sebelumnya state
      lokal diubah TANPA PEDULI hasil tulisannya. Kalau RLS menolak (0 baris,
      tanpa galat), tanda libur hilang dari layar sesaat lalu MUNCUL LAGI
      begitu halaman di-refresh, tanpa satu pun pesan yang menjelaskan
      kenapa. Sekarang layar hanya berubah kalau basis data benar-benar
      berubah.
    */
    if (holidays.includes(date)) {
      const { data, error } = await supabase.from('picket_holidays').delete().eq('date', date).select('date');
      if (error || !data || data.length === 0) { alert('Gagal membatalkan libur. Coba lagi.'); return; }
      setHolidays(prev => prev.filter(d => d !== date));
    } else {
      const { data, error } = await supabase.from('picket_holidays')
        .insert({ date, label: 'Libur', created_by: currentUser?.full_name ?? '' }).select('date');
      if (error || !data || data.length === 0) { alert('Gagal menandai libur. Coba lagi.'); return; }
      setHolidays(prev => [...prev, date]);
    }
  }, [holidays, currentUser]);

  const formatTime = (timeStr:string) => {
    if(!timeStr) return '';
    const [h,m] = timeStr.split(':');
    return `${h}:${m}`;
  };

  // Holiday cascade
  // When a saved row's date is a holiday, its PIC is not consumed from the pool.
  // The next non-holiday row takes that PIC instead - cascading forward.
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
  const kPieAll=Object.entries(filteredKgPie.reduce((acc,k)=>{(k.kebutuhan||[]).forEach(x=>{acc[x]=(acc[x]||0)+1;});return acc;},{}as Record<string,number>)).sort(([,a],[,b])=>b-a).slice(0,12).map(([label,value],i)=>({label,value,color:PIE_COLORS[i%PIE_COLORS.length]}));
  const divPieAll=Object.entries(filteredKgPie.reduce((acc,k)=>{if(k.sales_division)acc[k.sales_division]=(acc[k.sales_division]||0)+1;return acc;},{}as Record<string,number>)).sort(([,a],[,b])=>b-a).slice(0,12).map(([label,value],i)=>({label,value,color:PIE_COLORS[i%PIE_COLORS.length]}));
  const kgTypePie=JENIS_KEGIATAN_LIST.map(j=>({label:j,value:filteredKgPie.filter(k=>k.jenis_kegiatan===j).length,color:KEGIATAN_COLORS[j]})).filter(d=>d.value>0);
  const instansiPie=Object.entries(filteredKgPie.filter(k=>k.tamu_instansi).reduce((acc,k)=>{const key=k.tamu_instansi!;acc[key]=(acc[key]||0)+1;return acc;},{}as Record<string,number>)).sort(([,a],[,b])=>b-a).slice(0,12).map(([label,value],i)=>({label,value,color:PIE_COLORS[i%PIE_COLORS.length]}));
  const PRODUK_SPESIFIK=['Videowall','LED','IFP','Projector','Audio System','Lighting','Kiosk'];
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

  // Export Excel per-bulan (format sama dgn Export All) berdasarkan bulan terpilih di ringkasan.
  const MONTH_NAMES=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const exportMonth=()=>{
    if(summaryMonth===null)return;
    const monthRows=allRows.filter(r=>{const d=r.day_date||'';return !!d&&parseInt(d.slice(0,4),10)===summaryYear&&parseInt(d.slice(5,7),10)===summaryMonth;});
    const ids=new Set(monthRows.map(r=>r.id));
    const monthKg=kegiatanList.filter(k=>ids.has(k.piket_id));
    exportToExcel(monthRows,monthKg,`${MONTH_NAMES[summaryMonth-1]}_${summaryYear}`);
  };

  return(
    <div className="h-screen overflow-hidden flex flex-col relative" style={{backgroundImage:`url('/IVP_Background.png')`,backgroundSize:'cover',backgroundPosition:'center',backgroundAttachment:'fixed'}}>
      <ConfirmDialog state={confirmState} onCancel={()=>setConfirmState(null)} />
      <div className="absolute inset-0 pointer-events-none" style={{background:'rgba(255,255,255,0.08)'}}/>
      {loading&&rows.length===0&&(
      <ModalPortal>
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1000] flex items-center justify-center" style={{backgroundImage:`url('/IVP_Background.png')`,backgroundSize:'cover'}}>
          <div className="absolute inset-0" style={{background:'rgba(255,255,255,0.15)',backdropFilter:'blur(2px)'}}/>
          <div className="relative flex flex-col items-center gap-4 px-10 py-8 rounded-3xl" style={{background:'rgba(255,255,255,0.92)',backdropFilter:'blur(20px)',boxShadow:'0 8px 40px rgba(0,0,0,0.18)'}}>
            <svg aria-hidden="true" focusable="false" className="w-16 h-16 animate-spin" viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="26" stroke="#f1f5f9" strokeWidth="6"/><path d="M32 6 A26 26 0 0 1 58 32" stroke="#dc2626" strokeWidth="6" strokeLinecap="round"/></svg>
            <p className="text-sm font-bold text-slate-700">Loading...</p>
          </div>
        </div>
      </ModalPortal>
      )}

      {/* TANPA z-index — disengaja. `relative z-10` di sini dulu membentuk
          stacking context, sehingga z-index SEMUA modal di dalamnya cuma
          dibandingkan sesama isi pembungkus ini, bukan dengan overlay yang
          di-portal ke <body>. Akibatnya modal z-[1100] bisa tampil DI BELAKANG
          modal z-[1000] yang di-portal. Urutan cat terhadap tint di atas tetap
          aman karena elemen ini datang belakangan di DOM. */}
      <div className="relative flex flex-col flex-1 overflow-hidden">
        {/* ── HEADER ── */}
        <PageHeader icon="🏪" title="Piket Showroom" subtitle="IndoVisual Presentama · Jadwal Piket Tim PTS" color="#0d9488" colorLight="#0f766e">
          <button onClick={()=>exportToExcel(allRows,kegiatanList)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:scale-105"
            style={{background:'linear-gradient(135deg,#059669,#047857)',boxShadow:'0 4px 14px rgba(5,150,105,0.3)'}}>
            <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            Export Semua
          </button>
          {summaryMonth!==null&&(
            <button onClick={exportMonth} title="Export Excel hanya bulan terpilih"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:scale-105"
              style={{background:'linear-gradient(135deg,#0d9488,#0f766e)',boxShadow:'0 4px 14px rgba(13,148,136,0.3)'}}>
              <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              Export {MONTH_NAMES[summaryMonth-1]}
            </button>
          )}
          {isAdmin&&(
            <button onClick={()=>setShowSchedule(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:scale-105"
              style={{background:'linear-gradient(135deg,#dc2626,#b91c1c)',boxShadow:'0 4px 14px rgba(220,38,38,0.4)'}}>
              <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              Atur Jadwal
            </button>
          )}
        </PageHeader>

        <div className="flex-1 overflow-y-auto max-w-[1600px] mx-auto w-full px-5 py-5 space-y-4">
          <div className="animate-slide-up anim-d80">
            <TamuSummaryCards allRows={allRows} kegiatanList={kegiatanList} selectedYear={summaryYear} selectedMonth={summaryMonth} onYearChange={setSummaryYear} onMonthChange={setSummaryMonth}/>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4 animate-zoom-in anim-d160">
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
                    <button aria-label="Sebelumnya" onClick={()=>setWeekStart(d=>addDays(d,-14))} className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-base text-slate-400 hover:text-red-600 border border-slate-200 hover:border-red-200 hover:bg-red-50">‹</button>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{background:'rgba(220,38,38,0.07)',border:'1px solid rgba(220,38,38,0.2)'}}>
                      <div className="flex flex-col">
                        <span className="text-[11px] font-bold text-red-700 leading-tight">{wLabel}</span>
                        <span className="text-[10px] text-red-400 leading-tight">{wLabel2}</span>
                      </div>
                      {!isCurrWeek&&<button onClick={()=>setWeekStart(getMonday(new Date()))} className="text-[9px] font-bold px-2 py-1 rounded-lg text-white flex-shrink-0" style={{background:'#dc2626'}}>Ini</button>}
                    </div>
                    <button aria-label="Berikutnya" onClick={()=>setWeekStart(d=>addDays(d,14))} className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-base text-slate-400 hover:text-red-600 border border-slate-200 hover:border-red-200 hover:bg-red-50">›</button>
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
                  <svg aria-hidden="true" focusable="false" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                  <input aria-label="Cari nama, instansi, kegiatan..." value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari nama, instansi, kegiatan..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl text-sm outline-none" style={{background:'rgba(248,250,252,0.9)',border:'1px solid rgba(0,0,0,0.1)'}}/>
                </div>
                <select aria-label="Semua Hari" value={filterDay} onChange={e=>setFilterDay(e.target.value as any)} className="px-3 py-2 rounded-xl text-xs font-semibold outline-none bg-white" style={{border:'1px solid rgba(0,0,0,0.1)'}}>
                  <option value="">Semua Hari</option>{DAYS_OF_WEEK.map(d=><option key={d} value={d}>{d}</option>)}
                </select>
                <select aria-label="Semua Kegiatan" value={filterKegiatan||''} onChange={e=>setFilterKegiatan(e.target.value||null)} className="px-3 py-2 rounded-xl text-xs font-semibold outline-none bg-white" style={{border:'1px solid rgba(0,0,0,0.1)'}}>
                  <option value="">Semua Kegiatan</option>{JENIS_KEGIATAN_LIST.map(j=><option key={j} value={j}>{j}</option>)}
                </select>
                <button onClick={()=>setFilterTamu(f=>!f)} className="px-3 py-2 rounded-xl text-xs font-semibold border"
                  style={filterTamu?{background:'rgba(16,185,129,0.12)',borderColor:'rgba(16,185,129,0.4)',color:'#059669'}:{background:'transparent',borderColor:'rgba(0,0,0,0.1)',color:'#64748b'}}>
                  🏢 Ada Tamu
                </button>
              </div>
              {(filterInstansi||filterKebutuhan||filterDivision||filterKegiatan)&&(
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {filterInstansi&&(<div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{background:'rgba(14,165,233,0.1)',border:'1px solid rgba(14,165,233,0.35)'}}><span className="text-[10px] font-bold text-sky-600">🏢 {filterInstansi}</span><button aria-label="Tutup" onClick={()=>setFilterInstansi(null)} className="text-sky-400 text-[10px] ml-1">✕</button></div>)}
                  {filterKebutuhan&&(<div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{background:'rgba(124,58,237,0.1)',border:'1px solid rgba(124,58,237,0.35)'}}><span className="text-[10px] font-bold text-violet-600">🎯 {filterKebutuhan}</span><button aria-label="Tutup" onClick={()=>setFilterKebutuhan(null)} className="text-violet-400 text-[10px] ml-1">✕</button></div>)}
                  {filterDivision&&(<div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{background:'rgba(245,158,11,0.1)',border:'1px solid rgba(245,158,11,0.35)'}}><span className="text-[10px] font-bold text-amber-600">🏷️ {filterDivision}</span><button aria-label="Tutup" onClick={()=>setFilterDivision(null)} className="text-amber-400 text-[10px] ml-1">✕</button></div>)}
                  {filterKegiatan&&(<div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{background:`${KEGIATAN_COLORS[filterKegiatan]||'#6366f1'}18`,border:`1px solid ${KEGIATAN_COLORS[filterKegiatan]||'#6366f1'}50`}}><span className="text-[10px] font-bold" style={{color:KEGIATAN_COLORS[filterKegiatan]||'#6366f1'}}>📋 {filterKegiatan}</span><button aria-label="Tutup" onClick={()=>setFilterKegiatan(null)} className="text-[10px] ml-1" style={{color:KEGIATAN_COLORS[filterKegiatan]||'#6366f1'}}>✕</button></div>)}
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
              const todayPIC=todayInView?[todayInView.pic_ivp_name,todayInView.pic_ump_name,todayInView.pic_mvi_name].filter(Boolean).join(' / ')||'Belum ada PIC':null;
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
            {fetchError?(
              <ErrorState message={fetchError} onRetry={()=>{setFetchError(null);fetchData();}} />
            ):loading?(
              <div className="flex justify-center py-16"><div className="flex flex-col items-center gap-3"><div className="w-8 h-8 rounded-full border-2 border-t-red-600 border-red-200 animate-spin"/><p className="text-sm text-slate-500">Memuat jadwal...</p></div></div>
            ):(
              <>
              {/* ── MOBILE: list PIC per hari (kalender penuh hanya di web/desktop) ── */}
              <div className="md:hidden divide-y divide-gray-100">
                {displayRows.length===0?(
                  <div className="px-4 py-10 text-center text-sm text-gray-400">Belum ada jadwal.</div>
                ):displayRows.map((row)=>{
                  const dc=DAY_COLOR[row.day_of_week];
                  const todayRow=row.day_date===toKey(new Date());
                  const isHoliday=holidays.includes(row.day_date);
                  const pics=([['pic_ivp_name','PTS IVP'],['pic_ump_name','PTS UMP'],['pic_mvi_name','PTS MVI']] as [keyof PiketRow,string][])
                    .map(([f,team])=>({team,name:row[f] as string|null})).filter(p=>p.name);
                  return (
                    <div key={row.id} className={`px-4 py-3 flex items-start gap-3 ${todayRow?'bg-green-50/60':''}`}>
                      <div className="flex flex-col items-center w-11 flex-shrink-0" style={{color:dc.accent}}>
                        <span className="text-lg font-black leading-none">{new Date(row.day_date+'T00:00:00').getDate()}</span>
                        <span className="text-[10px] font-bold">{row.day_of_week}</span>
                        {todayRow&&<span className="text-[7px] font-bold px-1 py-0.5 rounded text-white mt-0.5" style={{background:dc.accent}}>HARI INI</span>}
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        {isHoliday?(
                          <span className="text-[11px] font-black px-2 py-0.5 rounded-full text-white" style={{background:'#dc2626'}}>🎌 LIBUR</span>
                        ):pics.length===0?(
                          <span className="text-xs text-gray-400 italic">Belum ada PIC</span>
                        ):(
                          <div className="space-y-1">
                            {pics.map(p=>(
                              <div key={p.team} className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white flex-shrink-0" style={{background:TEAM_LABEL[p.team]?.dot??'#64748b'}}>{p.name!.charAt(0).toUpperCase()}</div>
                                <span className="text-[13px] font-semibold text-slate-800 truncate">{p.name}</span>
                                <span className="text-[9px] text-slate-400 flex-shrink-0">{p.team.replace('PTS ','')}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── DESKTOP: kalender/tabel penuh (TIDAK diubah) ── */}
              <div className="hidden md:block overflow-x-auto animate-zoom-in">
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
                      <tr><td colSpan={11} className="p-0">
                        <ListEmptyState
                          adaFilterAktif={rows.length > 0}
                          onReset={() => {
                            setSearch(''); setFilterDay(''); setFilterTamu(false);
                            setFilterKebutuhan(null); setFilterInstansi(null); setFilterDivision(null);
                          }}
                          icon="🏪"
                          judulKosong="Belum ada jadwal piket"
                          deskripsiKosong={isAdmin ? 'Klik "Atur Jadwal" untuk menambahkan jadwal piket.' : undefined}
                        />
                      </td></tr>
                    ):displayRows.map((row,idx)=>{
                      const dc=DAY_COLOR[row.day_of_week];
                      const todayKey=toKey(new Date());
                      const todayRow=row.day_date===todayKey;
                      const rowDateMs=new Date(row.day_date+'T00:00:00').getTime();
                      const todayMs=new Date(todayKey+'T00:00:00').getTime();
                      const diffDays=Math.round((rowDateMs-todayMs)/(1000*60*60*24));
                      const isVirtual=row.id.startsWith('virtual-');
                      const isHoliday=holidays.includes(row.day_date);
                      const rowKg=kegiatanList.filter(k=>k.piket_id===row.id);
                      const kgToShow=rowKg.length>0?rowKg:[null];
                      const countdownBadge=todayRow?null:diffDays===1?{label:'BESOK',color:'#d97706'}:diffDays>1&&diffDays<=9?{label:`${diffDays} hr lagi`,color:'#64748b'}:null;
                      return kgToShow.map((kg,kgIdx)=>(
                        <tr key={`${row.id}-${kgIdx}`} className="stagger-item transition-all duration-150"
                          style={{borderBottom:kgIdx===kgToShow.length-1?(todayRow?'2px solid #16a34a60':isHoliday?'2px solid #fca5a580':'2px solid #cbd5e1'):'1px solid #e2e8f0',background:isHoliday?'rgba(254,226,226,0.45)':todayRow?'rgba(22,163,74,0.10)':isVirtual?'rgba(148,163,184,0.04)':idx%2===0?'rgba(255,255,255,1)':'rgba(219,234,254,0.38)'}}>
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
                                  {isHoliday&&<span className="text-[10px] font-black px-2 py-0.5 rounded-full text-white mt-0.5 w-fit" style={{background:'#dc2626',letterSpacing:'0.03em'}}>🎌 LIBUR</span>}
                                </div>
                              </td>
                              {/* PIC — tambah keterangan tim */}
                              <td className="px-3 py-3 align-middle" rowSpan={kgToShow.length} style={{borderRight:'1px solid #cbd5e1',verticalAlign:'middle'}}>
                                <div className="space-y-1.5">
                                  {([['pic_ivp_name','PTS IVP'],['pic_ump_name','PTS UMP'],['pic_mvi_name','PTS MVI']] as [keyof PiketRow,string][]).map(([f,team])=>{
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
                                  {![row.pic_ivp_name,row.pic_ump_name,row.pic_mvi_name].some(Boolean)&&<span className="text-gray-300 text-xs">—</span>}
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
                                      const teamLabel=u?.team_type==='Team PTS IVP'?'PTS IVP':u?.team_type==='Team PTS UMP'?'PTS UMP':u?.team_type==='Team PTS MVI'?'PTS MVI':'';
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
                                {bolehIsi&&<EditIconBtn onClick={()=>isVirtual?handleFillVirtual(row):setFillDetail(row)} />}
                                {!isVirtual&&isAdmin&&<DeleteIconBtn onClick={()=>handleDeleteRow(row)} />}
                              </ActionGroup>
                              {isAdmin&&(
                                <button aria-label={isHoliday?'Batalkan libur':'Tandai sebagai hari libur'}
                                  onClick={()=>toggleHoliday(row.day_date)}
                                  className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md transition-all mx-auto"
                                  style={isHoliday
                                    ?{background:'#fef2f2',color:'#dc2626',border:'1px solid #fca5a5'}
                                    :{background:'#f8fafc',color:'#64748b',border:'1px solid #e2e8f0'}}
                                  title={isHoliday?'Batalkan libur':'Tandai sebagai hari libur'}
                                >
                                  {isHoliday?'✕ Batal':'🎌 Libur'}
                                </button>
                              )}
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
              </>
            )}
          </div>
        </div>
      </div>

      {showSchedule&&isAdmin&&<ScheduleModal weekStart={weekStart} users={ptUsers} currentUser={currentUser} onClose={()=>setShowSchedule(false)} onSaved={fetchData}/>}
      {fillDetail&&<FillDetailModal row={fillDetail} onClose={()=>setFillDetail(null)} onSaved={fetchData} currentUser={currentUser}/>}
      {viewDetail&&<ViewDetailModal row={viewDetail} kegiatanList={kegiatanList} currentUser={currentUser} onClose={()=>setViewDetail(null)} onEdit={bolehIsi?()=>{setViewDetail(null);setFillDetail(viewDetail);}:undefined}/>}
      {showCalendar&&<MiniCalendarPopup allRows={allRows} holidays={holidays} onClose={()=>setShowCalendar(false)}/>}

      <style>{`
        @keyframes scale-in{from{opacity:0;transform:scale(0.92)}to{opacity:1;transform: none;}}
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
