'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@/app/dashboard/_components/shared';
import {
  TechNoteFolder, TechNote, TechNoteHistory,
  STATUS_CONFIG, ACTION_CONFIG, KKM_REQUIRED,
  formatDate, formatDateShort, getInitials,
} from './_components/shared';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GLASS     = 'rgba(255,255,255,0.10)';
const GLASS_MID = 'rgba(255,255,255,0.15)';
const GLASS_NAV = 'rgba(15,23,42,0.72)';
const BORDER    = 'rgba(255,255,255,0.18)';

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="flex flex-col items-center gap-3">
        <div className="w-9 h-9 rounded-full border-[3px] border-white/20 border-t-pink-400 animate-spin" />
        <span className="text-white/50 text-xs font-medium tracking-wide">Memuat...</span>
      </div>
    </div>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const cols = ['#3b82f6','#8b5cf6','#ec4899','#10b981','#f59e0b','#ef4444'];
  const bg = cols[name.charCodeAt(0) % cols.length];
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, flexShrink: 0,
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 700, fontFamily: 'monospace', border: '1.5px solid rgba(255,255,255,0.3)' }}>
      {getInitials(name)}
    </div>
  );
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: TechNote['status'] }) {
  const cfg = STATUS_CONFIG[status];
  const glassMap: Record<string,string> = {
    approved: 'rgba(16,185,129,0.25)', pending: 'rgba(245,158,11,0.25)',
    revision: 'rgba(239,68,68,0.25)',  rejected: 'rgba(107,114,128,0.25)',
  };
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4,
      padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700,
      color: cfg.color, background: glassMap[status],
      border: `1.5px solid ${cfg.color}60`, backdropFilter:'blur(8px)' }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ─── KPI Summary ──────────────────────────────────────────────────────────────
function TechNoteKPISummary({ technotes, currentUser, year }:
  { technotes: TechNote[]; currentUser: User; year: number }) {
  const isTeam = currentUser.role === 'team' || currentUser.role === 'team_pts';

  if (isTeam) {
    const my = technotes.filter(t => t.author_id === currentUser.id);
    const approved = my.filter(t => t.status === 'approved').length;
    const pending  = my.filter(t => t.status === 'pending').length;
    const pct = Math.min(100, Math.round((approved / KKM_REQUIRED) * 100));
    const met = approved >= KKM_REQUIRED;
    return (
      <div className="rounded-2xl p-4 mb-5 backdrop-blur-md"
        style={{ background: met ? 'rgba(16,185,129,0.18)' : 'rgba(236,72,153,0.15)', border: `1.5px solid ${met ? 'rgba(52,211,153,0.4)' : 'rgba(236,72,153,0.35)'}` }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-white/90">
              📝 KPI R&D Tech Note {year} — Progres Saya
            </div>
            <div className="text-[11px] text-white/60 mt-0.5">Target KKM: <b className="text-white/80">{KKM_REQUIRED} Tech Note approved</b> per tahun (bobot 10%)</div>
          </div>
          <span className="text-[11px] font-black px-3 py-1 rounded-full text-white"
            style={{ background: met ? 'rgba(5,150,105,0.7)' : pct >= 50 ? 'rgba(146,64,14,0.7)' : 'rgba(153,27,27,0.7)' }}>
            {met ? '✅ KKM Terpenuhi' : `${pct}% — ${KKM_REQUIRED - approved} lagi`}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width:`${pct}%`, background: met
                ? 'linear-gradient(90deg,#10b981,#34d399)'
                : pct >= 50 ? 'linear-gradient(90deg,#f59e0b,#fcd34d)'
                : 'linear-gradient(90deg,#ec4899,#f9a8d4)' }} />
          </div>
          <div className="shrink-0 text-right">
            <span className="text-2xl font-black" style={{ color: met ? '#34d399' : '#f9a8d4' }}>{approved}</span>
            <span className="text-sm text-white/50 font-medium"> / {KKM_REQUIRED}</span>
          </div>
        </div>
        {pending > 0 && <div className="mt-2 text-[11px] text-amber-300 font-semibold">⏳ {pending} sedang menunggu review</div>}
      </div>
    );
  }

  const totalApproved = technotes.filter(t => t.status === 'approved').length;
  const totalPending  = technotes.filter(t => t.status === 'pending').length;
  return (
    <div className="rounded-2xl p-4 mb-5 backdrop-blur-md"
      style={{ background: 'rgba(236,72,153,0.13)', border: '1.5px solid rgba(236,72,153,0.30)' }}>
      <div className="text-[11px] font-bold uppercase tracking-wider text-pink-300 mb-3">
        📝 Ringkasan KPI R&D Tech Note {year} — Semua Tim (Target: {KKM_REQUIRED}/orang)
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label:'Total Approved', value: totalApproved, color:'#34d399', bg:'rgba(16,185,129,0.18)' },
          { label:'Pending Review', value: totalPending,  color:'#fcd34d', bg:'rgba(245,158,11,0.18)' },
          { label:'Total Submissions', value: technotes.length, color:'#c4b5fd', bg:'rgba(139,92,246,0.18)' },
        ].map(c => (
          <div key={c.label} className="rounded-xl p-3 text-center backdrop-blur-sm"
            style={{ background: c.bg, border: `1px solid ${c.color}40` }}>
            <div className="text-2xl font-black" style={{ color: c.color }}>{c.value}</div>
            <div className="text-[11px] text-white/60 font-medium mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Folder Sidebar ───────────────────────────────────────────────────────────
function FolderSidebar({ folders, technotes, selected, onSelect, onAdd, canManage }:{
  folders: TechNoteFolder[]; technotes: TechNote[];
  selected: string | null; onSelect: (id: string | null) => void;
  onAdd: () => void; canManage: boolean;
}) {
  const [expanded, setExpanded] = useState<Record<string,boolean>>({});
  const roots = folders.filter(f => !f.parent_id);

  function countNotes(fid: string): number {
    const direct = technotes.filter(t => t.folder_id === fid).length;
    return direct + folders.filter(f => f.parent_id === fid).reduce((s,c) => s + countNotes(c.id), 0);
  }

  function FolderItem({ folder, depth = 0 }: { folder: TechNoteFolder; depth?: number }) {
    const children = folders.filter(f => f.parent_id === folder.id);
    const isOpen   = expanded[folder.id];
    const isSel    = selected === folder.id;
    const count    = countNotes(folder.id);
    return (
      <div>
        <div onClick={() => { onSelect(isSel ? null : folder.id); if (children.length) setExpanded(e => ({ ...e, [folder.id]: !e[folder.id] })); }}
          className="flex items-center gap-2 rounded-xl cursor-pointer transition-all mb-0.5"
          style={{ padding:`7px 10px 7px ${10+depth*18}px`,
            background: isSel ? `${folder.color}25` : 'transparent',
            border: isSel ? `1.5px solid ${folder.color}55` : '1.5px solid transparent' }}>
          {children.length > 0
            ? <span className="text-[9px] text-white/40 transition-transform" style={{ transform: isOpen ? 'rotate(90deg)':'none' }}>▶</span>
            : <span className="w-3" />}
          <span className="text-base">{folder.icon}</span>
          <span className="flex-1 text-[13px] font-semibold truncate" style={{ color: isSel ? folder.color : 'rgba(255,255,255,0.80)' }}>{folder.name}</span>
          {count > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: folder.color }}>{count}</span>}
        </div>
        {isOpen && children.map(c => <FolderItem key={c.id} folder={c} depth={depth+1} />)}
      </div>
    );
  }

  return (
    <div className="w-56 shrink-0 overflow-y-auto flex flex-col gap-1 p-3"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter:'blur(16px)', borderRight:`1px solid ${BORDER}` }}>
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Folder</span>
        {canManage && (
          <button onClick={onAdd} className="text-[11px] font-bold px-2 py-0.5 rounded-lg transition-colors"
            style={{ background:'rgba(236,72,153,0.25)', color:'#f9a8d4', border:'1px solid rgba(236,72,153,0.4)' }}
            onMouseEnter={e=>(e.currentTarget.style.background='rgba(236,72,153,0.40)')}
            onMouseLeave={e=>(e.currentTarget.style.background='rgba(236,72,153,0.25)')}>
            + Folder
          </button>
        )}
      </div>
      {/* All */}
      <div onClick={() => onSelect(null)}
        className="flex items-center gap-2 rounded-xl px-2.5 py-2 cursor-pointer transition-all mb-1"
        style={{ background: selected===null ? 'rgba(236,72,153,0.22)':'transparent',
          border: selected===null ? '1.5px solid rgba(236,72,153,0.45)':'1.5px solid transparent' }}>
        <span className="text-base">🏠</span>
        <span className="flex-1 text-[13px] font-semibold" style={{ color: selected===null ? '#f9a8d4':'rgba(255,255,255,0.75)' }}>Semua Tech Note</span>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white bg-pink-500">{technotes.length}</span>
      </div>
      {roots.map(f => <FolderItem key={f.id} folder={f} />)}
    </div>
  );
}

// ─── Approval History ─────────────────────────────────────────────────────────
function HistoryTimeline({ history }: { history: TechNoteHistory[] }) {
  if (!history.length) return null;
  return (
    <div className="mt-4">
      <div className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-3">📋 Riwayat Approval</div>
      <div className="space-y-2">
        {history.map((h, i) => {
          const cfg = ACTION_CONFIG[h.action as keyof typeof ACTION_CONFIG] ?? { label: h.action, color:'#6b7280', icon:'📌' };
          return (
            <div key={h.id ?? i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 border"
                  style={{ background:`${cfg.color}22`, borderColor:`${cfg.color}50` }}>{cfg.icon}</div>
                {i < history.length-1 && <div className="w-0.5 flex-1 mt-1 mb-1 min-h-[12px]" style={{ background:'rgba(255,255,255,0.15)' }} />}
              </div>
              <div className="pb-3 flex-1">
                <div className="text-[12px] font-bold capitalize" style={{ color: cfg.color }}>{cfg.label}</div>
                <div className="text-[11px] text-white/50">oleh <b className="text-white/80">{h.performed_by_name}</b> · {formatDate(h.created_at)}</div>
                {h.note && <div className="mt-1.5 text-[12px] text-white/70 rounded-lg px-3 py-2 border-l-2" style={{ background:'rgba(255,255,255,0.08)', borderColor: cfg.color }}>{h.note}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, width=560, children }:{
  open:boolean; onClose:()=>void; title:string; width?:number; children:React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)' }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ width:'100%', maxWidth:width, maxHeight:'90vh',
        overflowY:'auto', borderRadius:20, border:`1px solid ${BORDER}`,
        background:'rgba(15,23,42,0.88)', backdropFilter:'blur(24px)', boxShadow:'0 24px 64px rgba(0,0,0,0.5)' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom:`1px solid ${BORDER}` }}>
          <h3 className="text-[15px] font-bold text-white">{title}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg text-white/50 hover:text-white text-lg transition-colors"
            style={{ background:'rgba(255,255,255,0.10)' }}>×</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }:{ label:string; children:React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-[12px] font-bold text-white/70 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputCls = [
  'w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none transition-all',
  'placeholder-white/30 backdrop-blur-sm',
].join(' ');
const inputStyle = { background:'rgba(255,255,255,0.10)', border:'1.5px solid rgba(255,255,255,0.20)' };

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TechNotePage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [folders,    setFolders]    = useState<TechNoteFolder[]>([]);
  const [technotes,  setTechnotes]  = useState<TechNote[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [tab,         setTab]         = useState<'all'|'pending'|'mine'>('all');
  const [search,      setSearch]      = useState('');
  const [filterStatus,setFilterStatus]= useState('all');
  const [year,        setYear]        = useState(new Date().getFullYear());

  const [showFolderModal,  setShowFolderModal]  = useState(false);
  const [showUploadModal,  setShowUploadModal]  = useState(false);
  const [detailNote,       setDetailNote]       = useState<TechNote | null>(null);
  const [detailHistory,    setDetailHistory]    = useState<TechNoteHistory[]>([]);
  const [approveModal,     setApproveModal]     = useState<TechNote | null>(null);

  const [folderForm,   setFolderForm]   = useState({ name:'', icon:'📄', color:'#ec4899', parent_id:'' });
  const [uploadForm,   setUploadForm]   = useState({ title:'', description:'', product:'', one_drive_link:'', folder_id:'', tags:'' });
  const [approvalForm, setApprovalForm] = useState({ action:'approved', note:'' });
  const [saving, setSaving] = useState(false);

  const canManage = ['admin','superadmin','supervisor'].includes(currentUser?.role ?? '');
  const isTeam = !canManage;

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('currentUser') : null;
    if (stored) { try { setCurrentUser(JSON.parse(stored) as User); } catch {} }
  }, []);

  const fetchFolders = useCallback(async () => {
    const { data } = await supabase.from('tech_note_folders').select('*').order('name');
    setFolders((data ?? []) as TechNoteFolder[]);
  }, []);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('tech_notes').select('*')
      .gte('submitted_at', `${year}-01-01`)
      .lte('submitted_at', `${year}-12-31T23:59:59`)
      .order('submitted_at', { ascending:false });
    if (isTeam && currentUser) q = q.eq('author_id', currentUser.id);
    const { data } = await q;
    setTechnotes((data ?? []) as TechNote[]);
    setLoading(false);
  }, [year, currentUser, isTeam]);

  useEffect(() => { fetchFolders(); }, [fetchFolders]);
  useEffect(() => { if (currentUser) fetchNotes(); }, [fetchNotes, currentUser]);

  async function openDetail(tn: TechNote) {
    setDetailNote(tn);
    const { data } = await supabase.from('tech_note_history').select('*').eq('tech_note_id', tn.id).order('created_at');
    setDetailHistory((data ?? []) as TechNoteHistory[]);
  }

  async function saveFolder() {
    if (!folderForm.name.trim()) return;
    setSaving(true);
    await supabase.from('tech_note_folders').insert({
      name: folderForm.name.trim(), icon: folderForm.icon || '📄',
      color: folderForm.color, parent_id: folderForm.parent_id || null,
      created_by: currentUser?.full_name ?? 'Admin',
    });
    setFolderForm({ name:'', icon:'📄', color:'#ec4899', parent_id:'' });
    setSaving(false); setShowFolderModal(false); fetchFolders();
  }

  async function submitTechNote() {
    if (!uploadForm.title.trim() || !uploadForm.folder_id || !uploadForm.one_drive_link.trim() || !currentUser) return;
    setSaving(true);
    const now = new Date().toISOString();
    const tags = uploadForm.tags.split(',').map(s=>s.trim()).filter(Boolean);
    const { data: inserted } = await supabase.from('tech_notes').insert({
      title: uploadForm.title.trim(), description: uploadForm.description.trim(),
      folder_id: uploadForm.folder_id, author_id: currentUser.id, author_name: currentUser.full_name,
      one_drive_link: uploadForm.one_drive_link.trim(), product: uploadForm.product.trim(),
      tags, status:'pending', submitted_at: now, team_type: currentUser.team_type ?? '',
    }).select('id').single();
    if (inserted && (inserted as { id:string }).id) {
      await supabase.from('tech_note_history').insert({
        tech_note_id: (inserted as { id:string }).id, action:'submitted',
        performed_by: currentUser.id, performed_by_name: currentUser.full_name,
        note:'Submitted for review', created_at: now,
      });
    }
    setUploadForm({ title:'', description:'', product:'', one_drive_link:'', folder_id:'', tags:'' });
    setSaving(false); setShowUploadModal(false); fetchNotes();
  }

  async function submitApproval() {
    if (!approveModal || !currentUser) return;
    setSaving(true);
    const now = new Date().toISOString();
    const newStatus = approvalForm.action === 'approved' ? 'approved' : approvalForm.action === 'rejected' ? 'rejected' : 'revision';
    await supabase.from('tech_notes').update({ status:newStatus, reviewed_at:now,
      reviewed_by:currentUser.id, reviewed_by_name:currentUser.full_name, review_note:approvalForm.note||null }).eq('id',approveModal.id);
    await supabase.from('tech_note_history').insert({
      tech_note_id:approveModal.id, action:approvalForm.action,
      performed_by:currentUser.id, performed_by_name:currentUser.full_name,
      note:approvalForm.note||null, created_at:now,
    });
    setSaving(false); setApproveModal(null); setDetailNote(null);
    setApprovalForm({ action:'approved', note:'' }); fetchNotes();
  }

  const pendingCount = technotes.filter(t=>t.status==='pending').length;
  const filtered = technotes.filter(t => {
    if (selectedFolder && t.folder_id !== selectedFolder) return false;
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (tab === 'pending' && t.status !== 'pending') return false;
    if (tab === 'mine' && t.author_id !== currentUser?.id) return false;
    const q = search.toLowerCase();
    if (q && !t.title.toLowerCase().includes(q) && !t.product.toLowerCase().includes(q) && !(t.tags??[]).some(g=>g.toLowerCase().includes(q))) return false;
    return true;
  });

  const curY = new Date().getFullYear();

  return (
    <div className="flex flex-col h-screen font-sans"
      style={{ backgroundImage:"linear-gradient(rgba(0,0,0,0.45),rgba(0,0,0,0.45)),url('/IVP_Background.png')",
        backgroundSize:'cover', backgroundPosition:'center', backgroundAttachment:'fixed' }}>

      {/* ── Top Nav ── */}
      <div className="flex items-center gap-3 px-5 py-3 shrink-0 sticky top-0 z-30"
        style={{ background: GLASS_NAV, backdropFilter:'blur(20px)', borderBottom:`1px solid ${BORDER}` }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl"
          style={{ background:'rgba(236,72,153,0.30)', border:'1.5px solid rgba(236,72,153,0.50)' }}>📝</div>
        <div>
          <h1 className="text-white font-black text-[16px] leading-tight tracking-tight">Tech Note R&D</h1>
          <p className="text-white/50 text-[11px]">Dokumentasi teknikal & R&D · KPI 10% · Target {KKM_REQUIRED} approved/tahun</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <select value={year} onChange={e=>setYear(Number(e.target.value))}
            className="text-white text-sm font-bold outline-none rounded-xl px-3 py-1.5"
            style={{ background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.25)' }}>
            {[curY,curY-1,curY-2].map(y=><option key={y} value={y} className="text-slate-800">{y}</option>)}
          </select>
          <button onClick={()=>setShowUploadModal(true)}
            className="text-sm font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-1.5"
            style={{ background:'rgba(236,72,153,0.85)', color:'#fff', border:'1.5px solid rgba(236,72,153,0.6)' }}
            onMouseEnter={e=>(e.currentTarget.style.background='rgba(236,72,153,1)')}
            onMouseLeave={e=>(e.currentTarget.style.background='rgba(236,72,153,0.85)')}>
            ➕ Upload Tech Note
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ── */}
        <FolderSidebar folders={folders} technotes={technotes}
          selected={selectedFolder} onSelect={setSelectedFolder}
          onAdd={()=>setShowFolderModal(true)} canManage={canManage} />

        {/* ── Main Content ── */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {currentUser && <TechNoteKPISummary technotes={technotes} currentUser={currentUser} year={year} />}

          {/* Tabs + Search */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {([
              { id:'all',     label:`Semua (${technotes.length})` },
              ...(canManage ? [{ id:'pending', label:`⏳ Approval${pendingCount>0?` (${pendingCount})`:''}` }] : []),
              { id:'mine',    label:`📁 Milik Saya (${technotes.filter(t=>t.author_id===currentUser?.id).length})` },
            ] as { id:string; label:string }[]).map(t => (
              <button key={t.id} onClick={()=>setTab(t.id as typeof tab)}
                className="px-4 py-1.5 rounded-xl text-[13px] font-bold transition-all"
                style={{ background: tab===t.id ? 'rgba(190,24,93,0.80)' : 'rgba(255,255,255,0.10)',
                  color: tab===t.id ? '#fff' : 'rgba(255,255,255,0.65)',
                  border: tab===t.id ? '1.5px solid rgba(190,24,93,0.70)' : `1.5px solid ${BORDER}`,
                  backdropFilter:'blur(8px)' }}>
                {t.label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 text-sm">🔍</span>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari judul, produk, tag..."
                  className="pl-8 pr-3 py-2 text-[13px] rounded-xl outline-none w-52 text-white placeholder-white/30"
                  style={{ background:'rgba(255,255,255,0.10)', border:`1.5px solid ${BORDER}`, backdropFilter:'blur(8px)' }} />
              </div>
              <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
                className="px-3 py-2 text-[13px] rounded-xl outline-none text-white"
                style={{ background:'rgba(255,255,255,0.10)', border:`1.5px solid ${BORDER}`, backdropFilter:'blur(8px)' }}>
                <option value="all" className="text-slate-800">Semua Status</option>
                <option value="approved" className="text-slate-800">✅ Approved</option>
                <option value="pending" className="text-slate-800">⏳ Pending</option>
                <option value="revision" className="text-slate-800">🔄 Perlu Revisi</option>
                <option value="rejected" className="text-slate-800">❌ Ditolak</option>
              </select>
            </div>
          </div>

          {/* Cards */}
          {loading ? <Spinner /> : filtered.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-5xl mb-3">📭</div>
              <div className="font-bold text-base text-white/70">Tidak ada Tech Note ditemukan</div>
              <div className="text-sm mt-1 text-white/40">Coba ubah filter atau upload Tech Note baru</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(tn => {
                const folder = folders.find(f=>f.id===tn.folder_id);
                return (
                  <div key={tn.id} onClick={()=>openDetail(tn)}
                    className="rounded-2xl p-4 cursor-pointer transition-all group"
                    style={{ background: GLASS_MID, backdropFilter:'blur(16px)', border:`1.5px solid ${BORDER}` }}
                    onMouseEnter={e=>{ e.currentTarget.style.background='rgba(255,255,255,0.20)'; e.currentTarget.style.borderColor='rgba(236,72,153,0.50)'; }}
                    onMouseLeave={e=>{ e.currentTarget.style.background=GLASS_MID; e.currentTarget.style.borderColor=BORDER; }}>
                    <div className="flex items-start justify-between mb-2 gap-2">
                      {folder && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background:`${folder.color}25`, color:folder.color, border:`1px solid ${folder.color}40` }}>
                          {folder.icon} {folder.name}
                        </span>
                      )}
                      <StatusBadge status={tn.status} />
                    </div>
                    <h4 className="font-bold text-[14px] text-white leading-snug mb-1.5 group-hover:text-pink-300 transition-colors">{tn.title}</h4>
                    <p className="text-[12px] text-white/55 mb-3 line-clamp-2">{tn.description}</p>
                    {(tn.tags??[]).length>0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {(tn.tags??[]).slice(0,3).map(tag=>(
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-md font-medium text-white/60"
                            style={{ background:'rgba(255,255,255,0.10)' }}>#{tag}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2.5" style={{ borderTop:`1px solid ${BORDER}` }}>
                      <div className="flex items-center gap-1.5">
                        <Avatar name={tn.author_name} size={22} />
                        <span className="text-[11px] text-white/60 font-medium truncate max-w-[100px]">{tn.author_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/40">{formatDateShort(tn.submitted_at)}</span>
                        {tn.one_drive_link && (
                          <a href={tn.one_drive_link} target="_blank" rel="noopener noreferrer"
                            onClick={e=>e.stopPropagation()}
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg transition-colors"
                            style={{ background:'rgba(59,130,246,0.25)', color:'#93c5fd', border:'1px solid rgba(59,130,246,0.40)' }}>
                            ☁️ Drive
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ══ MODAL: Add Folder ══ */}
      <Modal open={showFolderModal} onClose={()=>setShowFolderModal(false)} title="➕ Buat Folder Baru">
        <Field label="Nama Folder *">
          <input className={inputCls} style={inputStyle} value={folderForm.name}
            onChange={e=>setFolderForm(p=>({...p,name:e.target.value}))} placeholder="cth: Display Panel" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Icon (emoji)">
            <input className={inputCls} style={inputStyle} value={folderForm.icon}
              onChange={e=>setFolderForm(p=>({...p,icon:e.target.value}))} placeholder="📄" />
          </Field>
          <Field label="Warna">
            <input type="color" value={folderForm.color} onChange={e=>setFolderForm(p=>({...p,color:e.target.value}))}
              className="w-full h-11 rounded-xl cursor-pointer p-1" style={{ background:'rgba(255,255,255,0.10)', border:`1.5px solid ${BORDER}` }} />
          </Field>
        </div>
        <Field label="Parent Folder (opsional)">
          <select className={inputCls} style={inputStyle} value={folderForm.parent_id}
            onChange={e=>setFolderForm(p=>({...p,parent_id:e.target.value}))}>
            <option value="" className="text-slate-800">— Root (tidak ada parent) —</option>
            {folders.filter(f=>!f.parent_id).map(f=><option key={f.id} value={f.id} className="text-slate-800">{f.icon} {f.name}</option>)}
          </select>
        </Field>
        <div className="flex gap-3 justify-end mt-2">
          <button onClick={()=>setShowFolderModal(false)} className="px-4 py-2 rounded-xl text-sm font-bold text-white/70 transition-colors"
            style={{ background:'rgba(255,255,255,0.08)', border:`1.5px solid ${BORDER}` }}>Batal</button>
          <button onClick={saveFolder} disabled={saving||!folderForm.name.trim()}
            className="px-4 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-40 transition-colors"
            style={{ background:'rgba(236,72,153,0.80)', border:'1.5px solid rgba(236,72,153,0.60)' }}>
            {saving ? '⏳ Menyimpan...' : '💾 Simpan Folder'}
          </button>
        </div>
      </Modal>

      {/* ══ MODAL: Upload Tech Note ══ */}
      <Modal open={showUploadModal} onClose={()=>setShowUploadModal(false)} title="📤 Upload Tech Note" width={600}>
        <Field label="Judul Tech Note *">
          <input className={inputCls} style={inputStyle} value={uploadForm.title}
            onChange={e=>setUploadForm(p=>({...p,title:e.target.value}))} placeholder="cth: Prosedur Setup Display Newline" />
        </Field>
        <Field label="Deskripsi">
          <textarea className={inputCls} style={inputStyle} rows={3} value={uploadForm.description}
            onChange={e=>setUploadForm(p=>({...p,description:e.target.value}))} placeholder="Jelaskan isi Tech Note secara singkat..." />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nama Produk *">
            <input className={inputCls} style={inputStyle} value={uploadForm.product}
              onChange={e=>setUploadForm(p=>({...p,product:e.target.value}))} placeholder="cth: Newline NT-86" />
          </Field>
          <Field label="Folder *">
            <select className={inputCls} style={inputStyle} value={uploadForm.folder_id}
              onChange={e=>setUploadForm(p=>({...p,folder_id:e.target.value}))}>
              <option value="" className="text-slate-800">— Pilih Folder —</option>
              {folders.map(f=><option key={f.id} value={f.id} className="text-slate-800">{f.icon} {f.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="🔗 Link OneDrive *">
          <input className={inputCls} style={inputStyle} value={uploadForm.one_drive_link}
            onChange={e=>setUploadForm(p=>({...p,one_drive_link:e.target.value}))} placeholder="https://1drv.ms/b/..." />
        </Field>
        <Field label="Tags (pisahkan koma)">
          <input className={inputCls} style={inputStyle} value={uploadForm.tags}
            onChange={e=>setUploadForm(p=>({...p,tags:e.target.value}))} placeholder="cth: setup, display, newline" />
        </Field>
        <div className="rounded-xl px-4 py-3 text-[12px] font-medium mb-4"
          style={{ background:'rgba(245,158,11,0.15)', border:'1px solid rgba(245,158,11,0.35)', color:'#fcd34d' }}>
          ⚠️ Tech Note akan masuk ke <b>Approval Queue</b>. Setelah disetujui Admin/Supervisor, otomatis terhitung dalam KPI R&D.
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={()=>setShowUploadModal(false)} className="px-4 py-2 rounded-xl text-sm font-bold text-white/70"
            style={{ background:'rgba(255,255,255,0.08)', border:`1.5px solid ${BORDER}` }}>Batal</button>
          <button onClick={submitTechNote} disabled={saving||!uploadForm.title.trim()||!uploadForm.folder_id||!uploadForm.one_drive_link.trim()}
            className="px-4 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-40 transition-colors"
            style={{ background:'rgba(236,72,153,0.80)', border:'1.5px solid rgba(236,72,153,0.60)' }}>
            {saving ? '⏳ Mengirim...' : '📤 Submit untuk Review'}
          </button>
        </div>
      </Modal>

      {/* ══ MODAL: Detail Tech Note ══ */}
      {detailNote && (
        <Modal open={!!detailNote} onClose={()=>setDetailNote(null)} title="📄 Detail Tech Note" width={640}>
          <div className="rounded-xl p-4 mb-4" style={{ background:'rgba(255,255,255,0.07)', border:`1px solid ${BORDER}` }}>
            <div className="flex items-start justify-between gap-3 mb-2">
              <h3 className="font-black text-[16px] text-white leading-snug flex-1">{detailNote.title}</h3>
              <StatusBadge status={detailNote.status} />
            </div>
            <p className="text-[13px] text-white/65 leading-relaxed mb-3">{detailNote.description}</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[12px] text-white/55">
              <span>🏷️ <b className="text-white/80">Produk:</b> {detailNote.product}</span>
              <span>👤 <b className="text-white/80">Author:</b> {detailNote.author_name}</span>
              <span>📅 <b className="text-white/80">Submit:</b> {formatDate(detailNote.submitted_at)}</span>
              {detailNote.reviewed_by_name && <span>✅ <b className="text-white/80">Reviewed by:</b> {detailNote.reviewed_by_name}</span>}
            </div>
            {(detailNote.tags??[]).length>0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {(detailNote.tags??[]).map(tag=>(
                  <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    style={{ background:'rgba(59,130,246,0.25)', color:'#93c5fd', border:'1px solid rgba(59,130,246,0.40)' }}>#{tag}</span>
                ))}
              </div>
            )}
            {detailNote.one_drive_link && (
              <a href={detailNote.one_drive_link} target="_blank" rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 text-[12px] font-bold px-4 py-2 rounded-xl transition-colors"
                style={{ background:'rgba(37,99,235,0.70)', color:'#fff', border:'1px solid rgba(59,130,246,0.50)' }}>
                ☁️ Buka di OneDrive →
              </a>
            )}
          </div>

          {detailNote.review_note && (
            <div className="rounded-xl px-4 py-3 mb-4 text-[12px]"
              style={{ background: STATUS_CONFIG[detailNote.status].bg+'33',
                border:`1px solid ${STATUS_CONFIG[detailNote.status].color}50`,
                color: STATUS_CONFIG[detailNote.status].color }}>
              <b>Catatan Reviewer:</b> {detailNote.review_note}
            </div>
          )}

          <HistoryTimeline history={detailHistory} />

          {canManage && detailNote.status==='pending' && (
            <div className="flex gap-2 mt-4 pt-4 justify-end" style={{ borderTop:`1px solid ${BORDER}` }}>
              <button onClick={()=>{setApproveModal(detailNote);setApprovalForm({action:'approved',note:''}); }}
                className="px-4 py-2 rounded-xl text-white text-sm font-bold transition-colors"
                style={{ background:'rgba(16,185,129,0.75)', border:'1px solid rgba(52,211,153,0.50)' }}>✅ Approve</button>
              <button onClick={()=>{setApproveModal(detailNote);setApprovalForm({action:'revision_requested',note:''}); }}
                className="px-4 py-2 rounded-xl text-white text-sm font-bold transition-colors"
                style={{ background:'rgba(245,158,11,0.75)', border:'1px solid rgba(252,211,77,0.50)' }}>🔄 Revisi</button>
              <button onClick={()=>{setApproveModal(detailNote);setApprovalForm({action:'rejected',note:''}); }}
                className="px-4 py-2 rounded-xl text-white text-sm font-bold transition-colors"
                style={{ background:'rgba(107,114,128,0.70)', border:'1px solid rgba(156,163,175,0.40)' }}>❌ Tolak</button>
            </div>
          )}
        </Modal>
      )}

      {/* ══ MODAL: Approval Decision ══ */}
      {approveModal && (
        <Modal open={!!approveModal} onClose={()=>setApproveModal(null)} title="📋 Keputusan Approval" width={460}>
          <p className="text-[13px] text-white/70 mb-4">
            Tech Note: <b className="text-white">"{approveModal.title}"</b><br/>
            <span className="text-[11px] text-white/40">oleh {approveModal.author_name} · {formatDateShort(approveModal.submitted_at)}</span>
          </p>
          <Field label="Keputusan *">
            <select className={inputCls} style={inputStyle} value={approvalForm.action}
              onChange={e=>setApprovalForm(p=>({...p,action:e.target.value}))}>
              <option value="approved" className="text-slate-800">✅ Approve — Setujui Tech Note</option>
              <option value="revision_requested" className="text-slate-800">🔄 Minta Revisi — Perlu perbaikan</option>
              <option value="rejected" className="text-slate-800">❌ Tolak — Tech Note ditolak</option>
            </select>
          </Field>
          <Field label={`Catatan ${approvalForm.action==='approved'?'(opsional)':'*'}`}>
            <textarea className={inputCls} style={inputStyle} rows={3} value={approvalForm.note}
              onChange={e=>setApprovalForm(p=>({...p,note:e.target.value}))}
              placeholder={approvalForm.action==='approved'?'Berikan komentar positif...':'Jelaskan apa yang perlu diperbaiki...'} />
          </Field>
          {approvalForm.action==='approved' && (
            <div className="rounded-xl px-4 py-2.5 text-[12px] font-medium mb-4"
              style={{ background:'rgba(16,185,129,0.15)', border:'1px solid rgba(52,211,153,0.35)', color:'#6ee7b7' }}>
              ✅ Tech Note akan otomatis terhitung dalam KPI R&D ({KKM_REQUIRED} target/tahun)
            </div>
          )}
          <div className="flex gap-3 justify-end">
            <button onClick={()=>setApproveModal(null)} className="px-4 py-2 rounded-xl text-sm font-bold text-white/70"
              style={{ background:'rgba(255,255,255,0.08)', border:`1.5px solid ${BORDER}` }}>Batal</button>
            <button onClick={submitApproval} disabled={saving}
              className="px-4 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-40 transition-colors"
              style={{ background: approvalForm.action==='approved'?'rgba(16,185,129,0.80)':approvalForm.action==='revision_requested'?'rgba(245,158,11,0.80)':'rgba(107,114,128,0.80)',
                border:'1.5px solid rgba(255,255,255,0.20)' }}>
              {saving?'⏳...':approvalForm.action==='approved'?'✅ Konfirmasi Approve':approvalForm.action==='revision_requested'?'🔄 Kirim Revisi':'❌ Tolak'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
