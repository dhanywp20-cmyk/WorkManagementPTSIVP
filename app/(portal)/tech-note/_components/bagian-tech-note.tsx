'use client';

/** Deklarasi tingkat modul tech-note/page.tsx (scripts/pindah-tingkat-modul.mjs). */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { bisaDiklik } from '@/components/shared/bisaDiklik';
import { useSearchParams } from 'next/navigation';
import { PageHeader, ListEmptyState, ModalPortal, ConfirmDialog, type ConfirmState, ErrorState, Toast, type Notif } from '@/components/shared';
import { supabase } from '@/lib/supabase';
import { User } from '@/app/(portal)/dashboard/_components/shared';
import { getSession, startSessionWatcher } from '@/lib/auth';
import { TechNoteFolder, TechNote, TechNoteHistory, STATUS_CONFIG, ACTION_CONFIG, formatDate, formatDateShort, getInitials } from './shared';
import { logAudit } from '@/lib/audit';
import { sendWANotif } from '@/lib/wa';
import { createNotification, createNotificationForAdmins } from '@/lib/notifications';
import { hasFullAccess } from '@/lib/constants';
import { appLink } from '@/lib/app-url';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { useAksiTechNote } from './useAksiTechNote';
import { useMuatTechNote } from './useMuatTechNote';
import { ModalApprovalNote } from './ModalApprovalNote';
import { ModalDetailNote } from './ModalDetailNote';
import { ModalUnggahNote } from './ModalUnggahNote';
import { ModalBuatFolder } from './ModalBuatFolder';
import { IsiTechNote } from './IsiTechNote';import { linkOneDriveSah, KATEGORI_FOLDER } from './aturan-tech-note';
//  Dipindah ke aturan-tech-note.ts (dipakai juga oleh hook); diekspor ulang untuk pemakai lama.
export { DOMAIN_ONEDRIVE, linkOneDriveSah, KATEGORI_FOLDER, type KategoriFolder } from './aturan-tech-note';


/**
 * Link Tech Note wajib berkas OneDrive / SharePoint lewat https. Dulu link apa pun diterima -
 * termasuk 'javascript:' yang ikut dirender sebagai <a href> dan bisa dijalankan saat orang
 * lain mengekliknya.
 */
/** href aman untuk link lama yang mungkin belum lolos aturan di atas. */
export const hrefAman = (u: string | null | undefined) => (u && /^https?:\/\//i.test(u.trim()) ? u.trim() : undefined);

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="flex flex-col items-center gap-3">
        <div className="w-9 h-9 rounded-full border-[3px] border-gray-200 border-t-rose-500 animate-spin" />
        <span className="text-gray-500 text-xs font-medium tracking-wide">Memuat...</span>
      </div>
    </div>
  );
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const cols = ['#3b82f6','#8b5cf6','#ec4899','#10b981','#f59e0b','#ef4444'];
  const bg = cols[name.charCodeAt(0) % cols.length];
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, flexShrink: 0,
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 700, fontFamily: 'monospace', border: '1.5px solid rgba(255,255,255,0.6)' }}>
      {getInitials(name)}
    </div>
  );
}

export function StatusBadge({ status }: { status: TechNote['status'] }) {
  const cfg = STATUS_CONFIG[status];
  const bgMap: Record<string,string> = {
    approved: 'rgba(16,185,129,0.12)', pending: 'rgba(245,158,11,0.12)',
    revision: 'rgba(239,68,68,0.12)',  rejected: 'rgba(107,114,128,0.12)',
  };
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4,
      padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700,
      color: cfg.color, background: bgMap[status],
      border: `1.5px solid ${cfg.color}40` }}>
      <Ikon nama={cfg.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /> {cfg.label}
    </span>
  );
}

// KPI Summary
// Admin/supervisor: tampilkan ringkasan semua tim (tanpa menyebut target per orang)
// Team/user: TIDAK tampilkan progress pribadi & target KKM - cukup info singkat
export function TechNoteKPISummary({ technotes, currentUser, year }:
  { technotes: TechNote[]; currentUser: User; year: number }) {
  // Sama dengan canManage di komponen induk - akun Full Access juga melihat
  // ringkasan seluruh tim, bukan cuma catatannya sendiri.
  const isAdmin = hasFullAccess(currentUser as never)
    || ['admin','superadmin','supervisor'].includes(currentUser.role);

  if (isAdmin) {
    // Admin: ringkasan global - tanpa menyebut "Target: X/orang"
    const totalApproved = technotes.filter(t => t.status === 'approved').length;
    const totalPending  = technotes.filter(t => t.status === 'pending').length;
    return (
      <div className="rounded-2xl p-4 mb-5 shadow-xs" style={{ background: '#ffffff', border: '1.5px solid #fce7f3', borderLeft: '4px solid #ec4899' }}>
        <div className="text-[11px] font-bold uppercase tracking-wider text-rose-600 mb-3">
          <IkonTeks nama="📝" />Ringkasan KPI R&D Tech Note {year} — Semua Tim
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label:'Total Approved', value: totalApproved, color:'#047857', bg:'#ffffff', border:'#d1fae5' },
            { label:'Pending Review', value: totalPending,  color:'#b45309', bg:'#ffffff', border:'#fef3c7' },
            { label:'Total Submissions', value: technotes.length, color:'#7c3aed', bg:'#ffffff', border:'#ede9fe' },
          ].map(c => (
            <div key={c.label} className="rounded-xl p-3 text-center border shadow-xs"
              style={{ background: c.bg, borderColor: c.border }}>
              <div className="text-lg sm:text-2xl font-black" style={{ color: c.color }}>{c.value}</div>
              <div className="text-[11px] text-slate-500 font-medium mt-0.5">{c.label}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Team/user biasa: tidak tampilkan progress pribadi & target KKM
  // Hanya tampilkan jumlah note yang visible bagi mereka
  const approvedCount = technotes.filter(t => t.status === 'approved').length;
  const myPendingCount = technotes.filter(t => t.author_id === currentUser.id && t.status === 'pending').length;
  return (
    <div className="rounded-2xl p-4 mb-5 shadow-xs"
      style={{ background: '#ffffff', border: '1.5px solid #ede9fe', borderLeft: '4px solid #8b5cf6' }}>
      <div className="text-[11px] font-bold uppercase tracking-wider text-violet-600 mb-3">
        <IkonTeks nama="📝" />Tech Note R&D {year}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl p-3 text-center border shadow-xs" style={{ borderColor:'#d1fae5' }}>
          <div className="text-lg sm:text-2xl font-black text-emerald-700">{approvedCount}</div>
          <div className="text-[11px] text-slate-500 font-medium mt-0.5">Approved (Semua Tim)</div>
        </div>
        <div className="rounded-xl p-3 text-center border shadow-xs" style={{ borderColor:'#fef3c7' }}>
          <div className="text-lg sm:text-2xl font-black text-amber-700">{myPendingCount}</div>
          <div className="text-[11px] text-slate-500 font-medium mt-0.5">Milik Saya — Pending</div>
        </div>
      </div>
    </div>
  );
}

export function FolderSidebar({ folders, technotes, selected, onSelect, onAdd, canManage, mobileOpen, onCloseMobile }:{
  folders: TechNoteFolder[]; technotes: TechNote[];
  selected: string | null; onSelect: (id: string | null) => void;
  onAdd: () => void; canManage: boolean;
  // Di layar sempit sidebar ini SELALU makan ~224px tetap - sisa lebar
  // buat daftar Tech Note jadi terlalu sempit untuk dibaca. mobileOpen
  // mengubahnya jadi drawer yang disembunyikan sampai tombol "📁 Folder"
  // ditekan, sama seperti pola drawer sidebar utama di dashboard.
  mobileOpen: boolean; onCloseMobile: () => void;
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
        <div {...bisaDiklik(() => { onSelect(isSel ? null : folder.id); if (children.length) setExpanded(e => ({ ...e, [folder.id]: !e[folder.id] })); })}
          className="flex items-center gap-2 rounded-xl cursor-pointer transition-all mb-0.5"
          style={{ padding:`7px 10px 7px ${10+depth*18}px`,
            background: isSel ? `${folder.color}15` : 'transparent',
            border: isSel ? `1.5px solid ${folder.color}40` : '1.5px solid transparent' }}>
          {children.length > 0
            ? <span className="text-[10px] text-slate-500 transition-transform" style={{ transform: isOpen ? 'rotate(90deg)':'none' }}><Ikon nama="▶" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
            : <span className="w-3" />}
          <span className="text-base"><Ikon nama={folder.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /></span>
          <span className="flex-1 text-[13px] font-semibold truncate" style={{ color: isSel ? folder.color : '#475569' }}>{folder.name}</span>
          {count > 0 && <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: folder.color }}>{count}</span>}
        </div>
        {isOpen && children.map(c => <FolderItem key={c.id} folder={c} depth={depth+1} />)}
      </div>
    );
  }

  return (<>
    {/* Backdrop - mobile drawer only */}
    {mobileOpen && (
      <div aria-hidden="true" className="fixed inset-0 z-30 md:hidden" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={onCloseMobile} />
    )}
    <div className={`w-56 shrink-0 overflow-y-auto flex flex-col gap-1 p-3 border-r border-gray-200 z-40
        fixed top-0 bottom-0 left-0 md:static
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        transition-transform duration-200`}
      style={{ background: '#f8fafc' }}>
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Folder</span>
        <div className="flex items-center gap-1.5">
          {canManage && (
            <button onClick={onAdd} className="text-[11px] font-bold px-2 py-0.5 rounded-lg transition-colors text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100">
              + Folder
            </button>
          )}
          <button onClick={onCloseMobile} aria-label="Tutup daftar folder" className="md:hidden w-6 h-6 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100">✕</button>
        </div>
      </div>
      {/* All */}
      <div {...bisaDiklik(() => onSelect(null))}
        className="flex items-center gap-2 rounded-xl px-2.5 py-2 cursor-pointer transition-all mb-1"
        style={{ background: selected===null ? 'rgba(236,72,153,0.10)':'transparent',
          border: selected===null ? '1.5px solid rgba(236,72,153,0.30)':'1.5px solid transparent' }}>
        <span className="text-base"><Ikon nama="🏠" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
        <span className="flex-1 text-[13px] font-semibold" style={{ color: selected===null ? '#db2777':'#475569' }}>Semua Tech Note</span>
        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full text-white bg-rose-500">{technotes.length}</span>
      </div>
      {roots.map(f => <FolderItem key={f.id} folder={f} />)}
    </div>
  </>);
}

// Approval History
export function HistoryTimeline({ history }: { history: TechNoteHistory[] }) {
  if (!history.length) return null;
  return (
    <div className="mt-4">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3"><IkonTeks nama="📋" />Riwayat Approval</div>
      <div className="space-y-2">
        {history.map((h, i) => {
          const cfg = ACTION_CONFIG[h.action as keyof typeof ACTION_CONFIG] ?? { label: h.action, color:'#6b7280', icon:'📌' };
          return (
            <div key={h.id ?? i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 border"
                  style={{ background:`${cfg.color}15`, borderColor:`${cfg.color}40` }}><Ikon nama={cfg.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /></div>
                {i < history.length-1 && <div className="w-0.5 flex-1 mt-1 mb-1 min-h-[12px] bg-gray-200" />}
              </div>
              <div className="pb-3 flex-1">
                <div className="text-[12px] font-bold capitalize" style={{ color: cfg.color }}>{cfg.label}</div>
                <div className="text-[11px] text-slate-500">oleh <b className="text-slate-600">{h.performed_by_name}</b> · {formatDate(h.created_at)}</div>
                {h.note && <div className="mt-1.5 text-[12px] text-slate-600 rounded-lg px-3 py-2 border-l-2 bg-gray-50" style={{ borderColor: cfg.color }}>{h.note}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Modal({ open, onClose, title, width=560, children }:{
  open:boolean; onClose:()=>void; title:string; width?:number; children:React.ReactNode;
}) {
  if (!open) return null;
  return (
  <ModalPortal>
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-1000 flex items-center justify-center p-4"
      style={{ background:'rgba(0,0,0,0.45)', backdropFilter:'blur(4px)' }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ width:'100%', maxWidth:width, maxHeight:'100%',
        overflowY:'auto', borderRadius:20, border:'1px solid rgba(0,0,0,0.08)',
        background:'#fff', boxShadow:'0 24px 64px rgba(0,0,0,0.18)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-[15px] font-bold text-slate-800">{title}</h3>
          <button aria-label="Tutup" onClick={onClose} className="w-7 h-7 rounded-lg text-slate-500 hover:text-slate-700 text-lg transition-colors bg-gray-100 hover:bg-gray-200">×</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  </ModalPortal>
  );
}

export function Field({ label, children }:{ label:string; children:React.ReactNode }) {
  //  Isian dibungkus DI DALAM <label> - lihat catatan yang sama di FormField
  //  bersama (components/shared/FormParts.tsx). <label> yang cuma berdiri di
  //  atasnya tidak menamai isiannya secara program.
  return (
    <label className="block mb-4">
      <span className="block text-[12px] font-bold text-slate-600 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

export const inputCls = [
  'w-full px-3 py-2.5 rounded-xl text-sm text-slate-800 outline-hidden transition-all',
  'placeholder-slate-400 bg-gray-50 border border-gray-200 focus:border-rose-400 focus:ring-2 focus:ring-rose-100',
].join(' ');

// Main Page
export function TechNotePageInner() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [folders,    setFolders]    = useState<TechNoteFolder[]>([]);
  const [technotes,  setTechnotes]  = useState<TechNote[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [tab,         setTab]         = useState<'all'|'pending'|'mine'>('all');
  const [search,      setSearch]      = useState('');
  const [filterStatus,setFilterStatus]= useState('all');
  const [year,        setYear]        = useState(new Date().getFullYear());

  const [showFolderModal,  setShowFolderModal]  = useState(false);
  const [showFolderDrawer, setShowFolderDrawer] = useState(false);
  const [showUploadModal,  setShowUploadModal]  = useState(false);
  // Edit & hapus tech note.
  const [editingNote, setEditingNote] = useState<TechNote | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  /*
    Toast menggantikan alert() bawaan browser (4 titik) - tampilannya beda
    total dari seluruh platform, menyebutkan nama domain, dan memblokir
    halaman sampai ditekan OK.
  */
  const [toast, setToast] = useState<Notif | null>(null);
  const beritahu = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3600);
  };
  const [detailNote,       setDetailNote]       = useState<TechNote | null>(null);
  const [detailHistory,    setDetailHistory]    = useState<TechNoteHistory[]>([]);
  const [approveModal,     setApproveModal]     = useState<TechNote | null>(null);

  const [folderForm,   setFolderForm]   = useState({ name:'', icon:'🖥️', color:'#ec4899', parent_id:'', category:'display' as string });
  const [uploadForm,   setUploadForm]   = useState({ title:'', description:'', product:'', one_drive_link:'', folder_id:'', tags:'' });
  // Minor (docs/UX-WORKFLOW-AUDIT.md): dulu tidak ada proteksi unsaved-changes
  // di modal Upload/Edit - snapshot diambil saat modal dibuka, dibandingkan
  // saat mau ditutup.
  const uploadSnapshotRef = useRef<typeof uploadForm | null>(null);
  const closeUploadModal = () => {
    const dirty = uploadSnapshotRef.current
      ? JSON.stringify(uploadForm) !== JSON.stringify(uploadSnapshotRef.current)
      : Object.values(uploadForm).some(v => v);
    const tutup = () => {
      setShowUploadModal(false); setEditingNote(null);
      setUploadForm({ title:'', description:'', product:'', one_drive_link:'', folder_id:'', tags:'' });
    };
    //  ConfirmDialog, bukan window.confirm: yang bawaan memblokir seluruh
    //  halaman, tidak bisa diberi gaya, dan menyebutkan nama domain di
    //  judulnya - padahal ini pertanyaan biasa tentang isian yang belum
    //  disimpan.
    if (!dirty) { tutup(); return; }
    setConfirmState({
      message: 'Tutup tanpa menyimpan?',
      description: 'Ada isian yang belum disimpan. Kalau ditutup sekarang, isian itu hilang.',
      confirmLabel: 'Tutup tanpa simpan',
      danger: true,
      onConfirm: () => { setConfirmState(null); tutup(); },
    });
  };
  const [approvalForm, setApprovalForm] = useState({ action:'approved', note:'' });
  const [saving, setSaving] = useState(false);

  /**
   * Boleh mengelola: admin/superadmin, Supervisor, atau akun Team PTS yang
   * diberi Full Access lewat Admin Panel. Lewat helper terpusat di
   * lib/constants.ts, sama dengan modul lain - mencocokkan daftar role sendiri
   * membuat toggle Full Access tidak berlaku di sini.
   */
  const canManage = hasFullAccess(currentUser as never)
    || ['admin','superadmin','supervisor'].includes(currentUser?.role ?? '');
  const isTeam = !canManage;

  /**
   * Penulis note sendiri boleh Edit (mis. salah ketik, atau perlu revisi
   * setelah ditolak) walau bukan canManage - tapi tidak boleh Hapus, itu
   * tetap khusus canManage sesuai aturan Full Access platform ini.
   */
  const bolehEditNote = (n: TechNote): boolean =>
    canManage || (!!currentUser?.id && n.author_id === currentUser.id);

  useEffect(() => {
    const user = getSession<User>();
    if (!user) {
      const target = window.top !== window ? window.top : window;
      if (target) target.location.href = '/dashboard';
      return;
    }
    setCurrentUser(user);
    return startSessionWatcher();
  }, []);

  const { fetchFolders, fetchNotes } = useMuatTechNote({ canManage, currentUser, setFetchError, setFolders, setLoading, setTechnotes, year });

  useEffect(() => { fetchFolders(); }, [fetchFolders]);
  useEffect(() => { if (currentUser) fetchNotes(); }, [fetchNotes, currentUser]);

  /*
    Deep-link dari notifikasi (?open=<id>): buka Tech Note-nya langsung,
    bukan cuma daftarnya. Ketiga notifikasi Tech Note ("menunggu review",
    "diajukan ulang", "sudah direview") membawa ref_id catatannya, dan
    tanpa ini penerimanya mendarat di daftar lalu harus mencari sendiri
    catatan mana yang dimaksud.

    Ref sekali-jalan: daftar catatan di-fetch ulang tiap kali tahun/filter
    berubah, dan tanpa penjaga ini detailnya akan terbuka lagi setiap fetch
    walau sudah ditutup.
  */
  const searchParams = useSearchParams();
  const sudahBukaDariNotif = useRef(false);
  useEffect(() => {
    if (sudahBukaDariNotif.current) return;
    const openId = searchParams.get('open');
    if (!openId || technotes.length === 0) return;
    const target = technotes.find(t => t.id === openId);
    if (target) {
      sudahBukaDariNotif.current = true;
      void openDetail(target);
    }
  }, [searchParams, technotes]);

  const { openDetail, saveFolder, bukaEditNote, hapusNote, submitTechNote, submitApproval } = useAksiTechNote({ approvalForm, approveModal, beritahu, canManage, currentUser, editingNote, fetchFolders, fetchNotes, folderForm, setApprovalForm, setApproveModal, setConfirmState, setDetailHistory, setDetailNote, setEditingNote, setFolderForm, setSaving, setShowFolderModal, setShowUploadModal, setUploadForm, uploadForm, uploadSnapshotRef });

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
    <div className="flex flex-col h-screen font-sans bg-gray-50"
      style={{ background: 'var(--latar-halaman)', backgroundSize:'cover', backgroundPosition:'center', backgroundAttachment:'fixed' }}>

      {/* ── Top Nav ── header baku semua modul (components/shared/PageHeader) */}
      <PageHeader icon="📝" title="Tech Note R&D" subtitle="Dokumentasi teknikal & R&D · KPI 10%" color="#ec4899">
            <select aria-label="Tahun" value={year} onChange={e=>setYear(Number(e.target.value))}
              className="text-slate-700 text-sm font-bold outline-hidden rounded-xl px-3 py-1.5 bg-gray-100 border border-gray-200 focus:border-rose-400">
              {[curY,curY-1,curY-2].map(y=><option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={()=>{ uploadSnapshotRef.current = uploadForm; setShowUploadModal(true); }}
              className="text-sm font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 text-white hover:opacity-90 hover:scale-105"
              style={{ background:'linear-gradient(135deg,#ec4899,#be185d)', boxShadow:'0 4px 14px rgba(236,72,153,0.35)' }}>
              <IkonTeks nama="➕" />Upload Tech Note
            </button>
      </PageHeader>

      <IsiTechNote
        canManage={canManage} currentUser={currentUser} fetchError={fetchError} fetchNotes={fetchNotes} filterStatus={filterStatus} filtered={filtered} folders={folders} loading={loading} openDetail={openDetail} pendingCount={pendingCount} search={search} selectedFolder={selectedFolder} setFilterStatus={setFilterStatus} setSearch={setSearch} setSelectedFolder={setSelectedFolder} setShowFolderDrawer={setShowFolderDrawer} setShowFolderModal={setShowFolderModal} setTab={setTab} showFolderDrawer={showFolderDrawer} tab={tab} technotes={technotes} year={year}
      />

      {/* ══ MODAL: Add Folder ══ */}
      <ModalBuatFolder
        folderForm={folderForm} folders={folders} saveFolder={saveFolder} saving={saving} setFolderForm={setFolderForm} setShowFolderModal={setShowFolderModal} showFolderModal={showFolderModal}
      />

      <ConfirmDialog state={confirmState} onCancel={()=>setConfirmState(null)} />
      <Toast notif={toast} />

      {/* ══ MODAL: Upload Tech Note ══ */}
      <ModalUnggahNote
        closeUploadModal={closeUploadModal} editingNote={editingNote} folders={folders} saving={saving} setUploadForm={setUploadForm} showUploadModal={showUploadModal} submitTechNote={submitTechNote} uploadForm={uploadForm}
      />

      {/* ══ MODAL: Detail Tech Note ══ */}
      <ModalDetailNote
        bolehEditNote={bolehEditNote} bukaEditNote={bukaEditNote} canManage={canManage} detailHistory={detailHistory} detailNote={detailNote} hapusNote={hapusNote} setApprovalForm={setApprovalForm} setApproveModal={setApproveModal} setDetailNote={setDetailNote}
      />

      {/* ══ MODAL: Approval Decision ══ */}
      <ModalApprovalNote
        approvalForm={approvalForm} approveModal={approveModal} saving={saving} setApprovalForm={setApprovalForm} setApproveModal={setApproveModal} submitApproval={submitApproval}
      />
    </div>
  );
}
