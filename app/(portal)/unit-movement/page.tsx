'use client';
import { denganNilai } from '@/lib/daftar-pilihan';

import { Suspense, type CSSProperties } from 'react';
import { isPimpinan } from '@/lib/pimpinan';
import { MiniPieChart, ViewIconBtn, EditIconBtn, DeleteIconBtn, ActionGroup, PageHeader, ErrorState, MobileListCard, MobileCardBadge, ListEmptyState, StatCard, ModalPortal, Paginasi } from '@/components/shared';
import { splitTypeLines, fmtDate } from './_components/shared';
import { ViewModal } from './_components/ViewModal';
import { AddEditModal } from './_components/AddEditModal';
import { Ikon } from '@/components/shared/Ikon';
import { Toast } from '@/components/shared/Toast';
import { useUnitMovement } from './_components/useUnitMovement';

function UnitMovementPageInner() {
  const {
    appReady, isLoggedIn, viewLog, setViewLog, editLog, currentUser, teamMembers, setEditLog,
    fetchLogs, notify, deleteConfirm, setDeleteConfirm, handleDelete, deleting, notif, canAddLog,
    filteredLogs, openLoans, isAdmin, fetchError, bolehEditLog, handleMarkReturned, statusPieData, filterStatus,
    setFilterStatus, ptsPieData, filterPTS, setFilterPTS, eventPieData, filterEvent, setFilterEvent, loading,
    searchQuery, setSearchQuery, daftarEvent, filterYear, setFilterYear, availableYears, exportToExcel, hal,
    logs,
  } = useUnitMovement();

  if (!appReady) return (
    <div className="min-h-screen flex items-center justify-center" style={{background: 'var(--latar-halaman)',backgroundSize:'cover'}}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-xl" style={{background:'linear-gradient(135deg,#f59e0b,#d97706)'}}><Ikon nama="🚚" ukuran="1em" className="inline-block align-[-0.12em]" /></div>
        <div className="w-10 h-10 rounded-full" style={{border:'3px solid rgba(245,158,11,0.25)',borderTopColor:'#f59e0b',animation:'spin 0.8s linear infinite'}}/>
        <p className="text-slate-600 text-sm font-semibold tracking-wide">Memuat Unit Movement Log...</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!isLoggedIn) return (
    <div className="min-h-screen flex items-center justify-center" style={{background: 'var(--latar-halaman)',backgroundSize:'cover'}}>
      <div className="bg-white rounded-kartu shadow-modal p-8 text-center max-w-sm w-full mx-4">
        <div className="text-4xl mb-3"><Ikon nama="🔒" ukuran="1em" className="inline-block align-[-0.12em]" /></div>
        <h2 className="font-black text-gray-800 text-lg">Sesi Tidak Ditemukan</h2>
        <p className="text-gray-500 text-sm mt-2 mb-5">Silakan login terlebih dahulu melalui halaman utama.</p>
        <button onClick={()=>{ const t=window.top!==window?window.top:window; if(t) t.location.href='/dashboard'; }}
          className="tombol-utama w-full py-3 rounded-kontrol text-sm font-bold">
          Kembali ke Dashboard
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-cover bg-center bg-fixed" style={{background: 'var(--latar-halaman)'}}>

      {viewLog&&<ViewModal log={viewLog} onClose={()=>setViewLog(null)}/>}
      {editLog!==undefined&&<AddEditModal log={editLog} currentUser={currentUser!} teamMembers={teamMembers}
        onClose={()=>setEditLog(undefined)}
        onSave={()=>{setEditLog(undefined);fetchLogs();notify('success',editLog?'Log diperbarui!':'Log ditambahkan!');}}/>}
      {deleteConfirm&&(
      <ModalPortal>
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-1100 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.6)',backdropFilter:'blur(6px)'}}>
          <div className="bg-white rounded-kartu shadow-modal p-6 w-full max-w-sm text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-2xl" style={{background:'#fee2e2'}}><Ikon nama="🗑" ukuran="1em" className="inline-block align-[-0.12em]" /></div>
            <h3 className="font-bold text-gray-900">Hapus Log?</h3>
            <p className="text-sm text-gray-500">Data <strong>{deleteConfirm.project_name}</strong> akan dihapus permanen.</p>
            <div className="flex gap-3">
              <button onClick={()=>setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50">Batal</button>
              <button onClick={handleDelete} disabled={deleting} className="tombol-bahaya flex-1 py-2.5 rounded-kontrol text-sm font-bold disabled:opacity-60">{deleting?'Menghapus...':'Ya, Hapus'}</button>
            </div>
          </div>
        </div>
      </ModalPortal>
      )}

      <Toast notif={notif} />

      <PageHeader icon="🚚" title="Unit Movement Log" subtitle="PTS IVP — Equipment Tracking">
        {canAddLog&&(
          <button onClick={()=>setEditLog(null)}
            className="tombol-utama flex items-center gap-2 px-4 py-2 rounded-kontrol text-sm font-bold transition-all hover:opacity-90">
            <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg>
            Tambah Log
          </button>
        )}
      </PageHeader>

      <div className="flex-1 overflow-y-auto max-w-[1600px] mx-auto px-6 py-6 space-y-6 w-full">

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-4 animate-slide-up anim-d80">
          {[
            { label:'Total Log',     value:filteredLogs.length, sub:'Semua catatan', accent:'#4f46e5' },
            { label:'Barang Masuk',  value:filteredLogs.filter(l=>l.status_barang==='Masuk').length,  sub:'Diterima', accent:'#047857' },
            { label:'Barang Keluar', value:filteredLogs.filter(l=>l.status_barang==='Keluar').length, sub:'Dikirim',  accent:'#b91c1c' },
          ].map((card, i) => <StatCard key={i} {...card} />)}
        </div>

        {openLoans.length > 0 && (
          <div className="rounded-2xl overflow-hidden animate-slide-up" style={{background:'rgba(255,255,255,0.97)',border:'1px solid rgba(239,68,68,0.3)',boxShadow:'0 4px 16px rgba(239,68,68,0.12)'}}>
            <div className="flex items-center gap-3 px-5 py-3" style={{background:'rgba(239,68,68,0.07)',borderBottom:'1px solid rgba(239,68,68,0.15)'}}>
              <span className="text-base select-none animate-pulse"><Ikon nama="⚠" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
              <span className="font-bold text-sm text-red-700 flex-1">
                Open Loan — {openLoans.length} barang belum dikembalikan (lewat tanggal)
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">{openLoans.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{minWidth:700}}>
                <thead>
                  <tr style={{background:'#fef2f2',borderBottom:'1px solid #fecaca'}}>
                    <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-widest text-red-600">Project</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-widest text-red-600">Nama PTS</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-widest text-red-600">Type Barang</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-widest text-red-600">Serial Number</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-widest text-red-600">Tgl Keluar</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-widest text-red-600">Jatuh Tempo</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-widest text-red-600">Kondisi</th>
                    {isAdmin && <th className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-widest text-red-600">Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  {fetchError ? (
                    <tr><td colSpan={8} className="py-2"><ErrorState message={fetchError} onRetry={fetchLogs} /></td></tr>
                  ) : openLoans.map((loan, idx)=>{
                    const daysLate = Math.max(0, Math.round((new Date().getTime() - new Date(loan.expected_return_date!).getTime())/(24*60*60*1000)));
                    const typeLines = splitTypeLines(loan.type_barang);
                    return (
                      <tr key={loan.id} className="hover:bg-red-50/40 transition-colors" style={{borderBottom:'1px solid #e5e7eb'}}>
                        <td className="px-4 py-2.5 text-xs font-semibold text-gray-800">{loan.project_name||'-'}</td>
                        <td className="px-4 py-2.5">
                          <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg">{loan.nama_pts||'-'}</span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-700">{typeLines.join(', ')||'-'}</td>
                        <td className="px-4 py-2.5 text-[11px] font-mono text-gray-500">{loan.serial_number||'-'}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">{fmtDate(loan.tanggal)}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-red-700 whitespace-nowrap">{fmtDate(loan.expected_return_date!)}</span>
                            {daysLate > 0 && (
                              <span className="text-[11px] font-black px-1.5 py-0.5 rounded-sm bg-red-100 text-red-700 whitespace-nowrap">+{daysLate}h</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          {loan.kondisi_barang
                            ? <span className={`text-[11px] font-bold px-2 py-0.5 rounded-sm whitespace-nowrap`}
                                style={loan.kondisi_barang==='Baik'
                                  ? {background:'#d1fae5',color:'#065f46'}
                                  : loan.kondisi_barang==='Perlu Service'
                                  ? {background:'#fef3c7',color:'#92400e'}
                                  : {background:'#fee2e2',color:'#991b1b'}}>
                                {loan.kondisi_barang==='Baik'?'✅':loan.kondisi_barang==='Perlu Service'?'⚠️':'❌'} {loan.kondisi_barang}
                              </span>
                            : <span className="text-[11px] text-gray-400">—</span>}
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-2.5 text-center">
                            <ActionGroup>
                              <ViewIconBtn onClick={()=>setViewLog(loan)} label="Lihat" />
                              {bolehEditLog(loan) && <EditIconBtn onClick={()=>setEditLog(loan)} />}
                              {!isPimpinan(currentUser) && (
                                <button onClick={()=>handleMarkReturned(loan)} title="Tandai barang sudah kembali"
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white transition-all hover:opacity-90"
                                  style={{background:'linear-gradient(135deg,#10b981,#059669)'}}><Ikon nama="✅" ukuran="1em" className="inline-block align-[-0.12em]" /></button>
                              )}
                            </ActionGroup>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 sm:gap-4 animate-zoom-in anim-d160">
          <MiniPieChart data={statusPieData} title="Status Barang" icon="📦"
            activeFilter={filterStatus!=='All'?filterStatus:null}
            onSliceClick={l=>setFilterStatus(p=>p===l?'All':l as any)}/>
          <MiniPieChart data={ptsPieData} title="Anggota PTS" icon="👤"
            activeFilter={filterPTS!=='All'?filterPTS:null}
            onSliceClick={l=>setFilterPTS(p=>p===l?'All':l)}/>
          <MiniPieChart data={eventPieData} title="Event" icon="🎯"
            activeFilter={filterEvent!=='All'?filterEvent:null}
            onSliceClick={l=>setFilterEvent(p=>p===l?'All':l)}/>
        </div>

        <div className="rounded-2xl overflow-hidden animate-slide-up anim-d320" style={{background:'rgba(255,255,255,0.97)',border:'1px solid rgba(200,200,200,0.6)',backdropFilter:'blur(12px)'}}>
          <div className="flex flex-wrap items-center justify-between px-3 py-2 sm:px-6 sm:py-4 gap-2 sm:gap-3" style={{borderBottom:'1px solid rgba(0,0,0,0.07)'}}>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Movement Log</span>
              <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full">{loading?'…':filteredLogs.length}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input aria-label="Cari project, type, SN, pihak luar" className="px-3 py-1.5 rounded-lg text-base sm:text-xs border border-gray-200 bg-gray-50 outline-hidden focus:border-amber-400 focus:bg-white transition-all w-52"
                placeholder="Project / Type / SN / Pihak Luar..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}/>
              <select aria-label="Semua Status" className="px-2.5 py-1.5 rounded-lg text-base sm:text-xs border border-gray-200 bg-gray-50 outline-hidden focus:border-amber-400 cursor-pointer"
                value={filterStatus} onChange={e=>setFilterStatus(e.target.value as any)}>
                <option value="All">Semua Status</option><option value="Masuk">Masuk</option><option value="Keluar">Keluar</option>
              </select>
              <select aria-label="Semua Event" className="px-2.5 py-1.5 rounded-lg text-base sm:text-xs border border-gray-200 bg-gray-50 outline-hidden focus:border-amber-400 cursor-pointer"
                value={filterEvent} onChange={e=>setFilterEvent(e.target.value)}>
                <option value="All">Semua Event</option>
                {denganNilai(daftarEvent, filterEvent === 'All' ? null : filterEvent).map(ev=><option key={ev} value={ev}>{ev}</option>)}
              </select>
              <select aria-label="Semua Anggota" className="px-2.5 py-1.5 rounded-lg text-base sm:text-xs border border-gray-200 bg-gray-50 outline-hidden focus:border-amber-400 cursor-pointer"
                value={filterPTS} onChange={e=>setFilterPTS(e.target.value)}>
                <option value="All">Semua Anggota</option>
                {teamMembers.map(m=><option key={m} value={m}>{m}</option>)}
              </select>
              <select aria-label="Semua Tahun" className="px-2.5 py-1.5 rounded-lg text-base sm:text-xs border border-gray-200 bg-gray-50 outline-hidden focus:border-amber-400 cursor-pointer"
                value={filterYear} onChange={e=>setFilterYear(e.target.value)}>
                <option value="All">Semua Tahun</option>
                {availableYears.map(y=><option key={y} value={y}>{y}</option>)}
              </select>
              <button onClick={fetchLogs} disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-60"
                style={{background:'white'}}>
                <svg aria-hidden="true" focusable="false" className={`w-3.5 h-3.5 ${loading?'animate-spin':''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                Refresh
              </button>
              <button onClick={exportToExcel} disabled={filteredLogs.length === 0}
                className="tombol-utama flex items-center gap-1.5 px-3 py-1.5 rounded-kontrol text-xs font-semibold border transition-all hover:opacity-90 disabled:opacity-40">
                <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                Export Excel
              </button>
            </div>
          </div>

          <div className="md:hidden bg-gray-50/70 p-1.5 space-y-1.5">
            {filteredLogs.length === 0 && (
              <ListEmptyState
                adaFilterAktif={filterStatus !== 'All' || filterEvent !== 'All' || filterPTS !== 'All' || filterYear !== 'All'}
                onReset={() => { setFilterStatus('All'); setFilterEvent('All'); setFilterPTS('All'); setFilterYear('All'); }}
                icon="📦"
                judulKosong="Belum ada log pergerakan"
                deskripsiKosong="Perpindahan unit yang tercatat akan muncul di sini."
              />
            )}
            {hal.potongan.map((log) => {
              const isMasuk = log.status_barang === 'Masuk';
              const typeLines = splitTypeLines(log.type_barang);
              return (
                <MobileListCard
                  key={log.id}
                  title={log.project_name || '-'}
                  onClick={() => setViewLog(log)}
                  meta={<div className="truncate">{fmtDate(log.tanggal)}{log.event ? ` · ${log.event}` : ''}</div>}
                  badges={<MobileCardBadge style={isMasuk ? { background: '#d1fae5', color: '#065f46' } : { background: '#fee2e2', color: '#991b1b' }}>{isMasuk ? '📥' : '📤'} {log.status_barang}</MobileCardBadge>}
                  fields={[
                    { label: 'PTS', value: log.nama_pts || '-' },
                    { label: 'Pihak Luar', value: log.nama_luar || '-' },
                    { label: 'Type', value: typeLines.length > 0 ? typeLines.join(', ') : '-', span2: true },
                    { label: 'SN', value: log.serial_number, span2: true, hide: !log.serial_number, valueClass: 'text-gray-600 font-mono text-[11px]' },
                  ]}
                  actions={<>
                    <ViewIconBtn onClick={() => setViewLog(log)} label="Lihat" />
                    {bolehEditLog(log) && <EditIconBtn onClick={() => setEditLog(log)} />}
                    {isAdmin && <DeleteIconBtn onClick={() => setDeleteConfirm(log)} />}
                  </>}
                />
              );
            })}
          </div>

          <div className="hidden md:block overflow-x-auto animate-zoom-in bg-slate-100/60 px-3 pb-2">
            <table className="w-full text-sm tabel-kartu" style={{minWidth:1100}}>
              <thead>
                <tr style={{background:'#f8fafc',borderBottom:'1px solid #e2e8f0'}}>
                  <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-gray-500 w-10">No</th>
                  <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-gray-500 whitespace-nowrap w-24">Tanggal</th>
                  <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-gray-500 w-32">Nama Penerima</th>
                  <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-gray-500 w-32">Nama Pengirim</th>
                  <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-gray-500 w-36">Project</th>
                  <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-gray-500 whitespace-nowrap w-24">Status</th>
                  <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-gray-500 whitespace-nowrap w-28">Event</th>
                  <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-gray-500" style={{minWidth:300}}>Type &amp; SN</th>
                  <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-widest text-gray-500 w-36">Action</th>
                </tr>
              </thead>
              <tbody>
                {fetchError ? (
                  <tr><td colSpan={9} className="py-2"><ErrorState message={fetchError} onRetry={fetchLogs} /></td></tr>
                ) : loading ? (
                  <tr><td colSpan={9} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 rounded-full animate-spin" style={{border:'3px solid #fde68a',borderTopColor:'#f59e0b'}}/>
                      <span className="text-gray-500 text-sm">Memuat data...</span>
                    </div>
                  </td></tr>
                ) : filteredLogs.length===0 ? (
                  <tr><td colSpan={9} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-4xl"><Ikon nama="📦" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                      <p className="font-semibold text-gray-600 text-sm">Belum ada data movement log</p>
                      <p className="text-xs text-gray-500">Coba ubah filter atau tambahkan log baru</p>
                    </div>
                  </td></tr>
                ) : hal.potongan.map((log,idx)=>{
                  const isMasuk   = log.status_barang==='Masuk';
                  const typeLines = splitTypeLines(log.type_barang);
                  return (
                    <tr key={log.id} className="stagger-item" style={{ '--aksen-baris': '#fbbf24', '--bg-baris-sorot': '#fffbeb' } as CSSProperties}>
                      <td className="px-3 py-3 text-xs font-bold text-gray-500">{hal.mulai + idx + 1}</td>
                      <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">{fmtDate(log.tanggal)}</td>
                      <td className="px-3 py-3">
                        {isMasuk
                          ? <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg whitespace-nowrap">{log.nama_pts||'-'}</span>
                          : <span className="text-xs text-gray-600">{log.nama_luar||'-'}</span>}
                      </td>
                      <td className="px-3 py-3">
                        {!isMasuk
                          ? <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-lg whitespace-nowrap">{log.nama_pts||'-'}</span>
                          : <span className="text-xs text-gray-600">{log.nama_luar||'-'}</span>}
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs font-semibold text-gray-800 leading-snug">{log.project_name||'-'}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap"
                          style={isMasuk?{background:'#d1fae5',color:'#065f46'}:{background:'#fee2e2',color:'#991b1b'}}>
                          {isMasuk?'📥':'📤'} {log.status_barang}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-100 whitespace-nowrap">
                          {log.event||'-'}
                        </span>
                      </td>
                      <td className="px-3 py-3" style={{minWidth:300}}>
                        {typeLines.length>0 ? (
                          <div className="space-y-0.5">
                            {typeLines.map((line,li)=>(
                              <p key={li} className="text-xs text-gray-800 leading-snug">{line}</p>
                            ))}
                          </div>
                        ) : <span className="text-xs text-gray-500">-</span>}
                        {log.serial_number&&(
                          <p className="text-[11px] text-gray-500 font-mono mt-1">SN: {log.serial_number}</p>
                        )}
                      </td>
                      <td className="px-1 py-3 text-center">
                        <ActionGroup>
                          <ViewIconBtn onClick={()=>setViewLog(log)} label="Lihat" />
                          {bolehEditLog(log) && <EditIconBtn onClick={()=>setEditLog(log)} />}
                          {isAdmin && <DeleteIconBtn onClick={()=>setDeleteConfirm(log)} />}
                        </ActionGroup>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100" style={{background:'rgba(255,255,255,0.97)'}}>
            <span className="text-[11px] text-gray-500">{filteredLogs.length} log ditemukan</span>
            <span className="text-[11px] text-gray-500">dari {logs.length} log keseluruhan</span>
          </div>
          <Paginasi {...hal} satuan="log" />
        </div>

      </div>
    </div>
  );
}

export default function UnitMovementPage() {
  return (
    <Suspense>
      <UnitMovementPageInner />
    </Suspense>
  );
}
