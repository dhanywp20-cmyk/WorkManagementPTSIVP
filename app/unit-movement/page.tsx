'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { MiniPieChart, ViewIconBtn, EditIconBtn, DeleteIconBtn, ActionGroup } from '@/components/shared';
import { getSession, startSessionWatcher } from '@/lib/auth';
import { User, MovementLog, EVENTS, COLORS, splitTypeLines, fmtDate } from './_components/shared';
import { ViewModal } from './_components/ViewModal';
import { AddEditModal } from './_components/AddEditModal';

// ─── Main Page ────────────────────────────────────────────────────────────────

function UnitMovementPageInner() {
  const searchParams = useSearchParams();
  const [currentUser, setCurrentUser] = useState<User|null>(null);
  const [isLoggedIn,  setIsLoggedIn]  = useState(false);
  const [appReady,    setAppReady]    = useState(false); // full page loading state

  const [logs,        setLogs]        = useState<MovementLog[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [teamMembers, setTeamMembers] = useState<string[]>([]);

  const [filterStatus, setFilterStatus] = useState<'All'|'Masuk'|'Keluar'>('All');
  const [filterEvent,  setFilterEvent]  = useState('All');
  const [filterPTS,    setFilterPTS]    = useState('All');
  const [filterYear,   setFilterYear]   = useState('All');
  const [searchQuery,  setSearchQuery]  = useState('');

  // ── Auto-apply filter dari Global Search (?q=...) ──
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearchQuery(q);
  }, [searchParams]);

  const [viewLog,       setViewLog]       = useState<MovementLog|null>(null);
  const [editLog,       setEditLog]       = useState<MovementLog|null|undefined>(undefined);
  const [deleteConfirm, setDeleteConfirm] = useState<MovementLog|null>(null);
  const [deleting,      setDeleting]      = useState(false);
  const [notif, setNotif] = useState<{type:'success'|'error';msg:string}|null>(null);

  const notify = (type:'success'|'error', msg:string) => { setNotif({type,msg}); setTimeout(()=>setNotif(null),3500); };

  useEffect(()=>{
    const u = getSession<User>();
    if (!u) {
      const target = window.top !== window ? window.top : window;
      if (target) target.location.href = '/dashboard';
      return;
    }
    setCurrentUser(u);
    setIsLoggedIn(true);
    setTimeout(() => setAppReady(true), 300);
    return startSessionWatcher();
  },[]);

  useEffect(()=>{
    if (!isLoggedIn||!appReady) return;
    fetchLogs(); fetchTeamMembers();
    const ch = supabase.channel('movement-rt')
      .on('postgres_changes',{event:'*',schema:'public',table:'movement_logs'},()=>fetchLogs())
      .subscribe();
    return ()=>{ supabase.removeChannel(ch); };
  },[isLoggedIn, appReady]);

  const fetchLogs = async () => {
    setLoading(true);
    const {data} = await supabase.from('movement_logs').select('*').order('tanggal',{ascending:false});
    if (data) setLogs(data as MovementLog[]);
    setLoading(false);
  };

  const fetchTeamMembers = async () => {
    // Hanya Team PTS
    const {data} = await supabase.from('users').select('full_name').eq('team_type','Team PTS').order('full_name');
    if (data&&data.length>0) setTeamMembers(data.map((u:any)=>u.full_name));
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    const {error} = await supabase.from('movement_logs').delete().eq('id',deleteConfirm.id);
    setDeleting(false); setDeleteConfirm(null);
    if (error) { notify('error','Gagal hapus: '+error.message); return; }
    notify('success','Log berhasil dihapus!'); fetchLogs();
  };

  const isAdmin   = ['admin','superadmin'].includes(currentUser?.role?.toLowerCase()??'');
  const canAddLog = isAdmin || ['team','team_pts'].includes(currentUser?.role?.toLowerCase()??'');

  const availableYears = useMemo(()=>{
    const yrs=new Set<string>(); logs.forEach(l=>{ if(l.tanggal) yrs.add(l.tanggal.substring(0,4)); });
    return Array.from(yrs).sort((a,b)=>b.localeCompare(a));
  },[logs]);

  const filteredLogs = useMemo(()=>logs.filter(l=>{
    if (filterStatus!=='All'&&l.status_barang!==filterStatus) return false;
    if (filterEvent !=='All'&&l.event!==filterEvent)           return false;
    if (filterPTS   !=='All'&&l.nama_pts!==filterPTS)          return false;
    if (filterYear  !=='All'&&!l.tanggal?.startsWith(filterYear)) return false;
    if (searchQuery) {
      const q=searchQuery.toLowerCase();
      if (!l.project_name?.toLowerCase().includes(q)&&!l.type_barang?.toLowerCase().includes(q)&&
          !l.serial_number?.toLowerCase().includes(q)&&!l.nama_luar?.toLowerCase().includes(q)) return false;
    }
    return true;
  }),[logs,filterStatus,filterEvent,filterPTS,filterYear,searchQuery]);

  const statusPieData = useMemo(()=>[
    {label:'Masuk',  value:filteredLogs.filter(l=>l.status_barang==='Masuk').length,  color:'#10b981'},
    {label:'Keluar', value:filteredLogs.filter(l=>l.status_barang==='Keluar').length, color:'#ef4444'},
  ].filter(d=>d.value>0),[filteredLogs]);

  const ptsPieData = useMemo(()=>{
    const c:Record<string,number>={};
    filteredLogs.forEach(l=>{ if(l.nama_pts) c[l.nama_pts]=(c[l.nama_pts]||0)+1; });
    return Object.entries(c).map(([label,value],i)=>({label,value,color:COLORS[i%COLORS.length]})).sort((a,b)=>b.value-a.value);
  },[filteredLogs]);

  const eventPieData = useMemo(()=>{
    const c:Record<string,number>={};
    filteredLogs.forEach(l=>{ if(l.event) c[l.event]=(c[l.event]||0)+1; });
    return Object.entries(c).map(([label,value],i)=>({label,value,color:COLORS[i%COLORS.length]})).sort((a,b)=>b.value-a.value);
  },[filteredLogs]);

  // ─── Loading / Not Authenticated screen ────────────────────────────────────

  if (!appReady) return (
    <div className="min-h-screen flex items-center justify-center" style={{backgroundImage:'url(/IVP_Background.png)',backgroundSize:'cover'}}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-xl" style={{background:'linear-gradient(135deg,#f59e0b,#d97706)'}}>🚚</div>
        <div className="w-10 h-10 rounded-full" style={{border:'3px solid rgba(245,158,11,0.25)',borderTopColor:'#f59e0b',animation:'spin 0.8s linear infinite'}}/>
        <p className="text-white/80 text-sm font-semibold tracking-wide">Memuat Unit Movement Log...</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!isLoggedIn) return (
    <div className="min-h-screen flex items-center justify-center" style={{backgroundImage:'url(/IVP_Background.png)',backgroundSize:'cover'}}>
      <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl p-8 text-center max-w-sm w-full mx-4">
        <div className="text-4xl mb-3">🔒</div>
        <h2 className="font-black text-gray-800 text-lg">Sesi Tidak Ditemukan</h2>
        <p className="text-gray-500 text-sm mt-2 mb-5">Silakan login terlebih dahulu melalui halaman utama.</p>
        <button onClick={()=>{ const t=window.top!==window?window.top:window; if(t) t.location.href='/dashboard'; }}
          className="w-full py-3 rounded-xl text-sm font-bold text-white"
          style={{background:'linear-gradient(135deg,#f59e0b,#d97706)'}}>
          Kembali ke Dashboard
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-cover bg-center bg-fixed" style={{backgroundImage:'url(/IVP_Background.png)'}}>

      {viewLog&&<ViewModal log={viewLog} onClose={()=>setViewLog(null)}/>}
      {editLog!==undefined&&<AddEditModal log={editLog} currentUser={currentUser!} teamMembers={teamMembers}
        onClose={()=>setEditLog(undefined)}
        onSave={()=>{setEditLog(undefined);fetchLogs();notify('success',editLog?'Log diperbarui!':'Log ditambahkan!');}}/>}
      {deleteConfirm&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.6)',backdropFilter:'blur(6px)'}}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-2xl" style={{background:'#fee2e2'}}>🗑️</div>
            <h3 className="font-bold text-gray-900">Hapus Log?</h3>
            <p className="text-sm text-gray-500">Data <strong>{deleteConfirm.project_name}</strong> akan dihapus permanen.</p>
            <div className="flex gap-3">
              <button onClick={()=>setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50">Batal</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60"
                style={{background:'linear-gradient(135deg,#ef4444,#dc2626)'}}>{deleting?'Menghapus...':'Ya, Hapus'}</button>
            </div>
          </div>
        </div>
      )}

      {notif&&(
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-xl flex items-center gap-2"
          style={{background:notif.type==='success'?'#d1fae5':'#fee2e2',color:notif.type==='success'?'#065f46':'#991b1b',border:`1px solid ${notif.type==='success'?'#6ee7b7':'#fca5a5'}`}}>
          {notif.type==='success'?'✅':'❌'} {notif.msg}
        </div>
      )}

      {/* Header — tanpa logout & nama user (handled oleh dashboard) */}
      <div className="bg-white/85 backdrop-blur-md shadow-md flex-shrink-0 z-30 animate-slide-down anim-d0" style={{borderBottom:'2px solid rgba(245,158,11,0.3)'}}>
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-md" style={{background:'linear-gradient(135deg,#f59e0b,#d97706)'}}>🚚</span>
            <div>
              <h1 className="font-black text-gray-900 text-base tracking-wide">Unit Movement Log</h1>
              <p className="text-[10px] text-gray-500 font-medium">PTS IVP — Equipment Tracking</p>
            </div>
          </div>
          {canAddLog&&(
            <button onClick={()=>setEditLog(null)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
              style={{background:'linear-gradient(135deg,#f59e0b,#d97706)',boxShadow:'0 2px 8px rgba(245,158,11,0.35)'}}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg>
              Tambah Log
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto max-w-[1600px] mx-auto px-6 py-6 space-y-6 w-full">

        {/* Stat Cards — 3 saja, tanpa Anggota PTS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-slide-up anim-d80">
          {[
            {label:'Total Log',     value:filteredLogs.length, icon:'📋', g:'linear-gradient(135deg,#6366f1,#4f46e5)', sh:'rgba(99,102,241,0.35)'},
            {label:'Barang Masuk',  value:filteredLogs.filter(l=>l.status_barang==='Masuk').length,  icon:'📥', g:'linear-gradient(135deg,#10b981,#059669)', sh:'rgba(16,185,129,0.35)'},
            {label:'Barang Keluar', value:filteredLogs.filter(l=>l.status_barang==='Keluar').length, icon:'📤', g:'linear-gradient(135deg,#ef4444,#dc2626)', sh:'rgba(239,68,68,0.35)'},
          ].map(c=>(
            <div key={c.label} className="rounded-2xl p-4 relative overflow-hidden flex flex-col gap-2" style={{background:c.g,boxShadow:`0 4px 16px ${c.sh}`}}>
              <div className="absolute right-3 top-2 text-4xl opacity-[0.15] select-none">{c.icon}</div>
              <span className="text-3xl font-black text-white leading-none">{loading?'…':c.value}</span>
              <p className="text-sm font-bold text-white">{c.label}</p>
            </div>
          ))}
        </div>

        {/* Pie Charts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-zoom-in anim-d160">
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

        {/* Table */}
        <div className="rounded-2xl overflow-hidden animate-slide-up anim-d320" style={{background:'rgba(255,255,255,0.97)',border:'1px solid rgba(200,200,200,0.6)',backdropFilter:'blur(12px)'}}>
          <div className="flex flex-wrap items-center justify-between px-6 py-4 gap-3" style={{borderBottom:'1px solid rgba(0,0,0,0.07)'}}>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Movement Log</span>
              <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full">{loading?'…':filteredLogs.length}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 bg-gray-50 outline-none focus:border-amber-400 focus:bg-white transition-all w-52"
                placeholder="🔍 Project / Type / SN / Pihak Luar..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}/>
              <select className="px-2.5 py-1.5 rounded-lg text-xs border border-gray-200 bg-gray-50 outline-none focus:border-amber-400 cursor-pointer"
                value={filterStatus} onChange={e=>setFilterStatus(e.target.value as any)}>
                <option value="All">Semua Status</option><option value="Masuk">Masuk</option><option value="Keluar">Keluar</option>
              </select>
              <select className="px-2.5 py-1.5 rounded-lg text-xs border border-gray-200 bg-gray-50 outline-none focus:border-amber-400 cursor-pointer"
                value={filterEvent} onChange={e=>setFilterEvent(e.target.value)}>
                <option value="All">Semua Event</option>
                {EVENTS.map(ev=><option key={ev} value={ev}>{ev}</option>)}
              </select>
              <select className="px-2.5 py-1.5 rounded-lg text-xs border border-gray-200 bg-gray-50 outline-none focus:border-amber-400 cursor-pointer"
                value={filterPTS} onChange={e=>setFilterPTS(e.target.value)}>
                <option value="All">Semua Anggota</option>
                {teamMembers.map(m=><option key={m} value={m}>{m}</option>)}
              </select>
              <select className="px-2.5 py-1.5 rounded-lg text-xs border border-gray-200 bg-gray-50 outline-none focus:border-amber-400 cursor-pointer"
                value={filterYear} onChange={e=>setFilterYear(e.target.value)}>
                <option value="All">Semua Tahun</option>
                {availableYears.map(y=><option key={y} value={y}>{y}</option>)}
              </select>
              <button onClick={fetchLogs} disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-60"
                style={{background:'white'}}>
                <svg className={`w-3.5 h-3.5 ${loading?'animate-spin':''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                Refresh
              </button>
            </div>
          </div>

          <div className="overflow-x-auto animate-zoom-in">
            <table className="w-full text-sm table-zebra" style={{minWidth:1100}}>
              <thead>
                <tr style={{background:'#f8fafc',borderBottom:'1px solid #e2e8f0'}}>
                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 w-10">No</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 whitespace-nowrap w-24">Tanggal</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 w-32">Nama Penerima</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 w-32">Nama Pengirim</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 w-36">Project</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 whitespace-nowrap w-24">Status</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 whitespace-nowrap w-28">Event</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400" style={{minWidth:300}}>Type &amp; SN</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 w-36">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 rounded-full animate-spin" style={{border:'3px solid #fde68a',borderTopColor:'#f59e0b'}}/>
                      <span className="text-gray-400 text-sm">Memuat data...</span>
                    </div>
                  </td></tr>
                ) : filteredLogs.length===0 ? (
                  <tr><td colSpan={9} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-4xl opacity-30">📦</span>
                      <span className="text-gray-400 text-sm">Belum ada data movement log</span>
                    </div>
                  </td></tr>
                ) : filteredLogs.map((log,idx)=>{
                  const isMasuk   = log.status_barang==='Masuk';
                  const typeLines = splitTypeLines(log.type_barang);
                  return (
                    <tr key={log.id} className="stagger-item transition-colors hover:bg-amber-50/40" style={{borderBottom:'1px solid #f1f5f9'}}>
                      <td className="px-3 py-3 text-xs font-bold text-gray-400">{idx+1}</td>
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
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100 whitespace-nowrap">
                          {log.event||'-'}
                        </span>
                      </td>
                      {/* Type & SN — wide, no truncation, each item on its own line */}
                      <td className="px-3 py-3" style={{minWidth:300}}>
                        {typeLines.length>0 ? (
                          <div className="space-y-0.5">
                            {typeLines.map((line,li)=>(
                              <p key={li} className="text-xs text-gray-800 leading-snug">{line}</p>
                            ))}
                          </div>
                        ) : <span className="text-xs text-gray-400">-</span>}
                        {log.serial_number&&(
                          <p className="text-[10px] text-gray-400 font-mono mt-1">SN: {log.serial_number}</p>
                        )}
                      </td>
                      {/* Action */}
                      <td className="px-1 py-3">
                        <ActionGroup>
                          <ViewIconBtn onClick={()=>setViewLog(log)} label="Lihat" />
                          {isAdmin&&<>
                            <EditIconBtn onClick={()=>setEditLog(log)} />
                            <DeleteIconBtn onClick={()=>setDeleteConfirm(log)} />
                          </>}
                        </ActionGroup>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100" style={{background:'rgba(255,255,255,0.97)'}}>
            <span className="text-[10px] text-gray-400">{filteredLogs.length} log ditemukan</span>
            <span className="text-[10px] text-gray-400">{filteredLogs.length>0?`1–${filteredLogs.length}`:'0'} of {logs.length}</span>
          </div>
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
