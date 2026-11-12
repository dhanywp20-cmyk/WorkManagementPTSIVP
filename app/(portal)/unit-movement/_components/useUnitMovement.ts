'use client';

import { useDaftarPilihan } from '@/lib/daftar-pilihan';
import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { isPimpinan } from '@/lib/pimpinan';
import { namaKelompokPTSDitugaskan } from '@/lib/kelompok/inti';
import { usePaginasi } from '@/components/shared';
import { getSession, startSessionWatcher } from '@/lib/auth/sesi';
import { User, MovementLog, COLORS, fmtDate } from './shared';
import { logAudit } from '@/lib/audit';
import { hasFullAccess } from '@/lib/constants';
import { URL_XLSX } from '@/lib/xlsx-loader';

export function useUnitMovement() {
  const daftarEvent = useDaftarPilihan('unit-event');
  const searchParams = useSearchParams();
  const [currentUser, setCurrentUser] = useState<User|null>(null);
  const [isLoggedIn,  setIsLoggedIn]  = useState(false);
  const [appReady,    setAppReady]    = useState(false);

  const [logs,        setLogs]        = useState<MovementLog[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [fetchError,  setFetchError]  = useState<string|null>(null);
  const [teamMembers, setTeamMembers] = useState<string[]>([]);

  const [filterStatus, setFilterStatus] = useState<'All'|'Masuk'|'Keluar'>('All');
  const [filterEvent,  setFilterEvent]  = useState('All');
  const [filterPTS,    setFilterPTS]    = useState('All');
  const [filterYear,   setFilterYear]   = useState('All');
  const [searchQuery,  setSearchQuery]  = useState('');

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
    setFetchError(null);
    const peran = (currentUser?.role ?? '').toLowerCase();
    const orangDalam = hasFullAccess(currentUser) || isPimpinan(currentUser) ||
      ['admin','superadmin','team','team_pts','marketing'].includes(peran);

    const kolomLog = 'id,tanggal,nama_pts,nama_luar,status_barang,event,project_name,\
type_barang,serial_number,catatan,foto_surat_url,foto_barang_url,created_by,created_at,\
kondisi_barang,expected_return_date,return_confirmed,checkout_reference_id';
    let q = supabase.from('movement_logs').select(kolomLog).order('tanggal',{ascending:false}).limit(500);
    if (!orangDalam) {
      if (!currentUser) { setLogs([]); setLoading(false); return; }
      const nama = (currentUser.full_name ?? '').replace(/"/g,'');
      const user = (currentUser.username ?? '').replace(/"/g,'');
      q = q.or(`created_by.eq."${user}",nama_luar.eq."${nama}"`);
    }

    const {data, error} = await q;
    if (error) { setFetchError(error.message); setLoading(false); return; }
    if (data) setLogs(data as MovementLog[]);
    setLoading(false);
  };

  const fetchTeamMembers = async () => {
    const {data} = await supabase.from('users').select('full_name').in('team_type', namaKelompokPTSDitugaskan()).order('full_name');
    if (data&&data.length>0) setTeamMembers(data.map((u:any)=>u.full_name));
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    const {error} = await supabase.from('movement_logs').delete().eq('id',deleteConfirm.id);
    setDeleting(false); setDeleteConfirm(null);
    if (error) { notify('error','Gagal hapus: '+error.message); return; }
    void logAudit({ user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '', action: 'delete', module: 'movement', target_id: deleteConfirm.id, target_name: deleteConfirm.project_name ?? '' });
    notify('success','Log berhasil dihapus!'); fetchLogs();
  };

  const handleMarkReturned = async (log: MovementLog) => {
    const {error} = await supabase.from('movement_logs').update({return_confirmed:true}).eq('id',log.id);
    if (error) { notify('error','Gagal menandai kembali: '+error.message); return; }
    void logAudit({ user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '', action: 'update', module: 'movement', target_id: log.id, target_name: log.project_name ?? '', notes: 'Tandai barang sudah kembali' });
    notify('success','Barang ditandai sudah kembali!'); fetchLogs();
  };

  const isAdmin   = hasFullAccess(currentUser);
  const canAddLog = !isPimpinan(currentUser) && (isAdmin || ['team','team_pts','marketing','guest'].includes(currentUser?.role?.toLowerCase()??''));
  const bolehEditLog = (log: MovementLog): boolean =>
    isAdmin || (!!currentUser?.username && log.created_by === currentUser.username);

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

  const hal = usePaginasi(filteredLogs);

  const exportToExcel = () => {
    const runExport = (XLSX: any) => {
      const exportDate = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
      const garis = (rgb: string) => ({ style: 'thin', color: { rgb } });
      const garisHitam = { top: garis('000000'), bottom: garis('000000'), left: garis('000000'), right: garis('000000') };
      const garisAbu = { top: garis('E2E8F0'), bottom: garis('E2E8F0'), left: garis('E2E8F0'), right: garis('E2E8F0') };
      const hdr = { font: { name: 'Arial', bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '92400E' }, patternType: 'solid' }, alignment: { horizontal: 'center', vertical: 'center' }, border: garisHitam };
      const cell = (v: any) => ({ v: v ?? '-', t: 's', s: { font: { name: 'Arial', sz: 10 }, alignment: { vertical: 'center', wrapText: true }, border: garisAbu } });
      const title = { font: { name: 'Arial', bold: true, sz: 14, color: { rgb: '92400E' } }, alignment: { horizontal: 'left', vertical: 'center' } };
      const data: any[][] = [
        [{ v: '📦 UNIT MOVEMENT LOG — PTS IVP', t: 's', s: title }, ...Array(8).fill({ v: '', t: 's', s: {} })],
        [{ v: `Tanggal Export: ${exportDate}`, t: 's', s: { font: { name: 'Arial', sz: 10, color: { rgb: '6B7280' } } } }, ...Array(8).fill({ v: '', t: 's', s: {} })],
        Array(9).fill({ v: '', t: 's', s: {} }),
        [
          { v: 'No', t: 's', s: hdr }, { v: 'Tanggal', t: 's', s: hdr }, { v: 'Status', t: 's', s: hdr },
          { v: 'Nama PTS', t: 's', s: hdr }, { v: 'Nama Pihak Luar', t: 's', s: hdr }, { v: 'Event', t: 's', s: hdr },
          { v: 'Project', t: 's', s: hdr }, { v: 'Type Barang', t: 's', s: hdr }, { v: 'Serial Number', t: 's', s: hdr },
        ],
        ...filteredLogs.map((l, i) => [
          { v: i + 1, t: 'n', s: cell(i + 1).s },
          cell(fmtDate(l.tanggal, true)),
          { ...cell(l.status_barang), s: { ...cell(l.status_barang).s, font: { name: 'Arial', sz: 10, bold: true, color: { rgb: l.status_barang === 'Masuk' ? '166534' : '991B1B' } }, fill: { fgColor: { rgb: l.status_barang === 'Masuk' ? 'DCFCE7' : 'FEE2E2' }, patternType: 'solid' } } },
          cell(l.nama_pts), cell(l.nama_luar), cell(l.event),
          cell(l.project_name), cell(l.type_barang?.replace(/\n/g, ', ')), cell(l.serial_number),
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } }];
      ws['!cols'] = [{ wch: 5 }, { wch: 16 }, { wch: 10 }, { wch: 22 }, { wch: 22 }, { wch: 18 }, { wch: 30 }, { wch: 28 }, { wch: 20 }];
      ws['!rows'] = [{ hpt: 26 }, { hpt: 16 }, { hpt: 6 }, { hpt: 26 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '📦 Unit Movement');
      XLSX.writeFile(wb, `UnitMovement_${new Date().toISOString().split('T')[0]}.xlsx`, { bookType: 'xlsx', type: 'binary', cellStyles: true });
    };
    if ((window as any).XLSX) runExport((window as any).XLSX);
    else {
      const s = document.createElement('script');
      s.src = URL_XLSX;
      s.onload = () => runExport((window as any).XLSX);
      s.onerror = () => notify('error', 'Gagal memuat library Excel.');
      document.head.appendChild(s);
    }
  };

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

  const today = new Date().toISOString().split('T')[0];
  const openLoans = useMemo(()=>logs.filter(l=>
    l.status_barang === 'Keluar'
    && !l.return_confirmed
    && l.expected_return_date
    && l.expected_return_date < today
  ).sort((a,b)=>(a.expected_return_date??'').localeCompare(b.expected_return_date??'')),[logs, today]);
  return {
    appReady, isLoggedIn, viewLog, setViewLog, editLog, currentUser, teamMembers, setEditLog,
    fetchLogs, notify, deleteConfirm, setDeleteConfirm, handleDelete, deleting, notif, canAddLog,
    filteredLogs, openLoans, isAdmin, fetchError, bolehEditLog, handleMarkReturned, statusPieData, filterStatus,
    setFilterStatus, ptsPieData, filterPTS, setFilterPTS, eventPieData, filterEvent, setFilterEvent, loading,
    searchQuery, setSearchQuery, daftarEvent, filterYear, setFilterYear, availableYears, exportToExcel, hal,
    logs,
  };
}
