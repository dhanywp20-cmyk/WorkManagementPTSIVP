'use client';
import { denganNilai } from '@/lib/daftar-pilihan';

import { Suspense } from 'react';
import { bisaLihatSemuaTamu } from '@/lib/piket/akses';
import { KegiatanEntry, DAYS_OF_WEEK, DAY_COLOR, TEAM_LABEL, DEFAULT_TEAM_COLOR, KEGIATAN_COLORS, toKey, bacaPicPiket } from './_components/shared';
import { labelKelompokPTS } from '@/lib/kelompok/inti';
import { MiniPieChart, PageHeader, ConfirmDialog, ErrorState, ListEmptyState, Toast } from '@/components/shared';
import { TamuSummaryCards } from './_components/TamuSummaryCards';
import { MiniCalendarPopup } from './_components/MiniCalendarPopup';
import { FillDetailModal } from './_components/FillDetailModal';
import { ScheduleModal } from './_components/ScheduleModal';
import { ViewDetailModal } from './_components/ViewDetailModal';
import { exportToExcel } from './_components/excel-export';
import { ViewIconBtn, EditIconBtn, DeleteIconBtn, ActionGroup } from '@/components/shared';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { DaftarPiketHp } from './_components/DaftarPiketHp';
import { SpandukHariIni } from './_components/SpandukHariIni';
import { LapisanMemuatPiket, NavigasiMinggu, ChipFilterAktif } from './_components/bilah-piket';
import { usePiketShowroom } from './_components/usePiketShowroom';

function PiketShowroomPageInner() {
  const {
    confirmState, setConfirmState, toast, loading, rows, allRows, kegiatanList, summaryMonth,
    exportMonth, MONTH_NAMES, isAdmin, setShowSchedule, currentUser, bolehIsi, summaryYear, setSummaryYear,
    setSummaryMonth, instansiPie, filterInstansi, setFilterInstansi, kgTypePie, filterKegiatan, setFilterKegiatan, produkPie,
    kPieAll, filterKebutuhan, setFilterKebutuhan, divPieAll, filterDivision, setFilterDivision, displayRows, wLabel,
    wLabel2, isCurrWeek, setWeekStart, setShowCalendar, search, filterDay, filterTamu, setSearch,
    setFilterDay, setFilterTamu, daftarKegiatan, fetchError, setFetchError, fetchData, holidays, setViewDetail,
    setFillDetail, handleFillVirtual, handleDeleteRow, toggleHoliday, ptUsers, formatTime, showSchedule, weekStart,
    fillDetail, viewDetail, showCalendar,
  } = usePiketShowroom();

  return(
    <div className="h-screen overflow-hidden flex flex-col relative" style={{background: 'var(--latar-halaman)',backgroundSize:'cover',backgroundPosition:'center',backgroundAttachment:'fixed'}}>
      <ConfirmDialog state={confirmState} onCancel={()=>setConfirmState(null)} />
      <Toast notif={toast} />
      <div className="absolute inset-0 pointer-events-none" style={{background:'rgba(255,255,255,0.08)'}}/>
      {loading&&rows.length===0&&<LapisanMemuatPiket />}

      <div className="relative flex flex-col flex-1 overflow-hidden">
        <PageHeader icon="🏪" title="Piket Showroom" subtitle="IndoVisual Presentama · Jadwal Piket Tim PTS">
          <button onClick={()=>exportToExcel(allRows,kegiatanList)}
            className="tombol-kedua flex items-center gap-1.5 px-4 py-2 rounded-kontrol text-sm font-bold transition-all hover:scale-105">
            <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            Export Semua
          </button>
          {summaryMonth!==null&&(
            <button onClick={exportMonth} title="Export Excel hanya bulan terpilih"
              className="tombol-kedua flex items-center gap-1.5 px-4 py-2 rounded-kontrol text-sm font-bold transition-all hover:scale-105">
              <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              Export {MONTH_NAMES[summaryMonth-1]}
            </button>
          )}
          {isAdmin&&(
            <button onClick={()=>setShowSchedule(true)}
              className="tombol-utama flex items-center gap-1.5 px-4 py-2 rounded-kontrol text-sm font-bold transition-all hover:scale-105">
              <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              Atur Jadwal
            </button>
          )}
        </PageHeader>

        <div className="flex-1 overflow-y-auto max-w-[1600px] mx-auto w-full px-5 py-5 space-y-4">
          {currentUser&&!bolehIsi&&(
            <p className="text-[12px] text-slate-700 bg-white/90 border border-slate-200 rounded-xl px-3.5 py-2">
              {bisaLihatSemuaTamu(currentUser)
                ? 'Akun ini bisa melihat seluruh catatan piket dan export Excel. Mengisi, menyunting, dan menghapus kegiatan hanya untuk Tim PTS.'
                : 'Akun ini dibatasi: yang tampil jadwal piket, kegiatan internal PTS, dan kunjungan atas nama atau divisi Anda. Export Excel tersedia; mengisi dan menyunting hanya untuk Tim PTS.'}
            </p>
          )}
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

          <div className="rounded-2xl overflow-hidden animate-slide-up anim-d320" style={{background:'rgba(255,255,255,0.97)',border:'1px solid rgba(200,200,200,0.6)'}}>
            <div className="px-5 py-3.5 border-b border-gray-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Schedule Piket</span>
                  <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2.5 py-1 rounded-full">{displayRows.length}</span>
                  <NavigasiMinggu wLabel={wLabel} wLabel2={wLabel2} isCurrWeek={isCurrWeek} setWeekStart={setWeekStart} />
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={()=>setShowCalendar(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border"
                    style={{background:'rgba(37,99,235,0.06)',borderColor:'rgba(37,99,235,0.25)',color:'#2563eb'}}>
                    <IkonTeks nama="📅" />Show Calendar
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
                  <svg aria-hidden="true" focusable="false" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                  <input aria-label="Cari nama, instansi, kegiatan..." value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari nama, instansi, kegiatan..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl text-sm outline-hidden" style={{background:'rgba(248,250,252,0.9)',border:'1px solid rgba(0,0,0,0.1)'}}/>
                </div>
                <select aria-label="Semua Hari" value={filterDay} onChange={e=>setFilterDay(e.target.value as any)} className="px-3 py-2 rounded-xl text-xs font-semibold outline-hidden bg-white" style={{border:'1px solid rgba(0,0,0,0.1)'}}>
                  <option value="">Semua Hari</option>{DAYS_OF_WEEK.map(d=><option key={d} value={d}>{d}</option>)}
                </select>
                <select aria-label="Semua Kegiatan" value={filterKegiatan||''} onChange={e=>setFilterKegiatan(e.target.value||null)} className="px-3 py-2 rounded-xl text-xs font-semibold outline-hidden bg-white" style={{border:'1px solid rgba(0,0,0,0.1)'}}>
                  <option value="">Semua Kegiatan</option>{denganNilai(daftarKegiatan, filterKegiatan).map(j=><option key={j} value={j}>{j}</option>)}
                </select>
                <button onClick={()=>setFilterTamu(f=>!f)} className="px-3 py-2 rounded-xl text-xs font-semibold border"
                  style={filterTamu?{background:'rgba(16,185,129,0.12)',borderColor:'rgba(16,185,129,0.4)',color:'#047857'}:{background:'transparent',borderColor:'rgba(0,0,0,0.1)',color:'#64748b'}}>
                  <IkonTeks nama="🏢" />Ada Tamu
                </button>
              </div>
              <ChipFilterAktif filterInstansi={filterInstansi} setFilterInstansi={setFilterInstansi} filterKebutuhan={filterKebutuhan}
                setFilterKebutuhan={setFilterKebutuhan} filterDivision={filterDivision} setFilterDivision={setFilterDivision}
                filterKegiatan={filterKegiatan} setFilterKegiatan={setFilterKegiatan} />
            </div>

            <SpandukHariIni displayRows={displayRows} />
            {fetchError?(
              <ErrorState message={fetchError} onRetry={()=>{setFetchError(null);fetchData();}} />
            ):loading?(
              <div className="flex justify-center py-16"><div className="flex flex-col items-center gap-3"><div className="w-8 h-8 rounded-full border-2 border-t-red-600 border-red-200 animate-spin"/><p className="text-sm text-slate-500">Memuat jadwal...</p></div></div>
            ):(
              <>
              <DaftarPiketHp displayRows={displayRows} holidays={holidays} kegiatanList={kegiatanList} isAdmin={isAdmin} bolehIsi={bolehIsi}
                setViewDetail={setViewDetail} setFillDetail={setFillDetail} handleFillVirtual={handleFillVirtual}
                handleDeleteRow={handleDeleteRow} toggleHoliday={toggleHoliday} />

              <div className="hidden md:block overflow-x-auto animate-zoom-in">
                <table className="w-full text-sm border-collapse" style={{minWidth:'1050px'}}>
                  <colgroup>
                    <col style={{width:'3%'}}/><col style={{width:'8%'}}/><col style={{width:'7%'}}/><col style={{width:'15%'}}/><col style={{width:'6%'}}/><col style={{width:'9%'}}/>
                    <col style={{width:'9%'}}/><col style={{width:'7%'}}/><col style={{width:'21%'}}/><col style={{width:'5%'}}/><col style={{width:'116px'}}/>
                  </colgroup>
                  <thead>
                    <tr style={{background:'linear-gradient(135deg,#fff1f2 0%,#ffe4e6 100%)',borderBottom:'2px solid rgba(220,38,38,0.18)'}}>
                      {['No','Tanggal','PIC','Kegiatan','Jam','Produk','Tamu Instansi','Sales','Keterangan','Edit By','Action'].map((h,i)=>(
                        <th key={h} className="px-3 py-3 text-center" style={{borderRight:i<10?'1px solid rgba(220,38,38,0.1)':'none'}}><span className="text-[11px] font-black uppercase tracking-wider" style={{color:'#9f1239',letterSpacing:'0.08em'}}>{h}</span></th>
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
                      const countdownBadge=todayRow?null:diffDays===1?{label:'BESOK',color:'#b45309'}:diffDays>1&&diffDays<=9?{label:`${diffDays} hr lagi`,color:'#64748b'}:null;
                      return kgToShow.map((kg,kgIdx)=>(
                        <tr key={`${row.id}-${kgIdx}`} className="stagger-item transition-all duration-150"
                          style={{borderBottom:kgIdx===kgToShow.length-1?(todayRow?'2px solid #16a34a60':isHoliday?'2px solid #fca5a580':'2px solid #cbd5e1'):'1px solid #e2e8f0',background:isHoliday?'rgba(254,226,226,0.45)':todayRow?'rgba(22,163,74,0.10)':isVirtual?'rgba(148,163,184,0.04)':idx%2===0?'rgba(255,255,255,1)':'rgba(219,234,254,0.38)'}}>
                          {kgIdx===0&&(
                            <>
                              <td className="px-3 py-3 text-gray-500 text-xs align-middle" rowSpan={kgToShow.length} style={{borderRight:'1px solid #cbd5e1',verticalAlign:'middle'}}>{idx+1}</td>
                              <td className="px-3 py-3 align-middle" rowSpan={kgToShow.length} style={{borderRight:'1px solid #cbd5e1',verticalAlign:'middle'}}>
                                <div className="flex flex-col" style={{borderLeft:`3px solid ${dc.accent}`,paddingLeft:'6px'}}>
                                  <span className="text-base font-black leading-tight" style={{color:dc.accent}}>{new Date(row.day_date+'T00:00:00').getDate()}</span>
                                  <span className="text-[10px] font-bold" style={{color:dc.accent}}>{new Date(row.day_date+'T00:00:00').toLocaleDateString('id-ID',{month:'short',year:'2-digit'})}</span>
                                  <span className="text-xs font-bold mt-0.5" style={{color:dc.accent}}>{row.day_of_week}</span>
                                  {todayRow&&<span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md text-white mt-0.5 w-fit" style={{background:dc.accent,boxShadow:`0 2px 6px ${dc.accent}50`}}><IkonTeks nama="📍" />HARI INI</span>}
                                  {countdownBadge&&<span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md mt-0.5 w-fit" style={{background:`${countdownBadge.color}15`,color:countdownBadge.color,border:`1px solid ${countdownBadge.color}40`}}>{countdownBadge.label}</span>}
                                  {isHoliday&&<span className="text-[11px] font-black px-2 py-0.5 rounded-full text-white mt-0.5 w-fit" style={{background:'#dc2626',letterSpacing:'0.03em'}}><IkonTeks nama="🎌" />LIBUR</span>}
                                </div>
                              </td>
                              <td className="px-3 py-3 align-middle" rowSpan={kgToShow.length} style={{borderRight:'1px solid #cbd5e1',verticalAlign:'middle'}}>
                                <div className="space-y-1.5">
                                  {(()=>{
                                    const picBaris=bacaPicPiket(row);
                                    if(!picBaris) return <span className="text-gray-400 text-xs">—</span>;
                                    const team=labelKelompokPTS(picBaris.team_type)||picBaris.team_type;
                                    const tc=TEAM_LABEL[team]??DEFAULT_TEAM_COLOR;
                                    return(
                                      <div className="flex items-center gap-1.5">
                                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0" style={{background:tc.dot}}>{picBaris.name.charAt(0).toUpperCase()}</div>
                                        <div className="min-w-0">
                                          <p className="text-[13px] font-semibold text-slate-800 truncate leading-tight">{picBaris.name}</p>
                                          <span className="text-[10px] font-bold uppercase" style={{color:tc.text}}>{team}</span>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </td>
                            </>
                          )}
                          <td className="px-3 py-2.5 align-middle" style={{borderRight:'1px solid #cbd5e1'}}>
                            {kg?(
                              <div className="flex flex-col gap-1">
                                <span className="text-[11px] font-bold border-b-2 pb-0.5 w-fit"
                                  style={{color:KEGIATAN_COLORS[kg.jenis_kegiatan]||dc.accent,borderBottomColor:KEGIATAN_COLORS[kg.jenis_kegiatan]||dc.accent}}>
                                  {kg.jenis_kegiatan}
                                </span>
                                {kg.jenis_kegiatan==='RnD'&&(kg as any).team_rnd&&(
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <span className="text-[10px] font-semibold text-violet-500"><Ikon nama="👥" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                                    <span className="text-[10px] font-semibold text-violet-700">{(kg as any).team_rnd}</span>
                                    {(()=>{
                                      const u=ptUsers.find(x=>x.full_name===(kg as any).team_rnd);
                                      const teamLabel=u?.team_type?labelKelompokPTS(u.team_type):'';
                                      const tc=teamLabel?TEAM_LABEL[teamLabel]:null;
                                      return tc?<span className="text-[10px] font-black px-1 py-0.5 rounded-sm text-white" style={{background:tc.dot}}>{teamLabel}</span>:null;
                                    })()}
                                  </div>
                                )}
                                {kg.jenis_kegiatan==='Demo Product'&&kg.kebutuhan&&kg.kebutuhan.length>0&&(
                                  <div className="flex flex-col gap-0.5 mt-0.5">
                                    {kg.kebutuhan.map(k=>(
                                      <span key={k} className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 leading-tight">
                                        <span className="w-1 h-1 rounded-full shrink-0" style={{background:dc.accent}}/>
                                        {k}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ):<span className="text-gray-400 text-xs">—</span>}
                          </td>
                          <td className="px-3 py-3 align-middle" style={{borderRight:'1px solid #cbd5e1'}}>
                            {kg?.jam_mulai?(
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1"><span className="text-[10px] font-bold text-slate-500 w-10 shrink-0">Mulai</span><span className="text-sm font-bold text-slate-700">{formatTime(kg.jam_mulai)}</span></div>
                                <div className="flex items-center gap-1"><span className="text-[10px] font-bold text-slate-500 w-10 shrink-0">Selesai</span><span className="text-sm font-bold text-slate-700">{formatTime(kg.jam_selesai)}</span></div>
                              </div>
                            ):<span className="text-gray-400 text-xs">—</span>}
                          </td>
                          <td className="px-3 py-3 align-middle" style={{borderRight:'1px solid #cbd5e1'}}>
                            {kg?.produk&&kg.produk.length>0?(
                              <div className="flex flex-col gap-0.5">
                                {kg.produk.map(p=><span key={p} className="text-[12px] font-semibold" style={{color:dc.accent}}>{p}</span>)}
                              </div>
                            ):<span className="text-gray-400 text-xs">—</span>}
                          </td>
                          <td className="px-3 py-3 align-middle" style={{borderRight:'1px solid #cbd5e1'}}>
                            {kg?.tamu_instansi?(<button onClick={()=>setFilterInstansi(filterInstansi===kg.tamu_instansi?null:kg.tamu_instansi!)} className="flex items-center gap-1 hover:opacity-80 text-left"><span><Ikon nama="🏢" ukuran="1em" className="inline-block align-[-0.12em]" /></span><span className="text-xs font-semibold text-slate-700 underline decoration-dotted">{kg.tamu_instansi}</span></button>):<span className="text-gray-400 text-xs">—</span>}
                          </td>
                          <td className="px-3 py-3 align-middle" style={{borderRight:'1px solid #cbd5e1'}}>
                            {kg?.nama_sales?(<div className="flex flex-col gap-0.5"><span className="text-[12px] font-bold text-slate-800">{kg.nama_sales}</span>{kg.sales_division&&<span className="text-[11px] text-purple-500 font-semibold">{kg.sales_division}</span>}</div>):<span className="text-gray-400 text-xs">—</span>}
                          </td>
                          <td className="px-3 py-3 align-middle" style={{borderRight:'1px solid #cbd5e1'}}>
                            {kg?.keterangan?<span className="text-[13px] text-slate-600 leading-snug">{kg.keterangan}</span>:<span className="text-gray-400 text-xs">—</span>}
                          </td>
                          {kgIdx===0&&(
                            <td className="px-3 py-3 align-middle" rowSpan={kgToShow.length} style={{borderRight:'1px solid #cbd5e1',verticalAlign:'middle'}}>
                              {(()=>{
                                const lastEdited = (kgToShow as any[])
                                  .filter(k => k != null && !!(k as KegiatanEntry).edited_by_name)
                                  .sort((a: any,b: any)=>new Date(b.updated_at||b.created_at||0).getTime()-new Date(a.updated_at||a.created_at||0).getTime())[0] as KegiatanEntry|undefined;
                                return lastEdited
                                  ?<div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-1"><span className="text-[10px]"><Ikon nama="✏" ukuran="1em" className="inline-block align-[-0.12em]" /></span><span className="text-[11px] font-semibold text-slate-600 leading-tight">{lastEdited.edited_by_name}</span></div>
                                    {lastEdited.updated_at&&<span className="text-[10px] text-slate-500 leading-tight">{new Date(lastEdited.updated_at).toLocaleDateString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</span>}
                                  </div>
                                  :<span className="text-gray-400 text-xs">—</span>;
                              })()}
                            </td>
                          )}
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
                  <span className="text-[11px] text-gray-500">{displayRows.length} hari kerja ditampilkan</span>
                  <span className="text-[11px] text-gray-500">{rows.length} total · {kegiatanList.filter(k=>displayRows.some(r=>r.id===k.piket_id)).length} kegiatan</span>
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
