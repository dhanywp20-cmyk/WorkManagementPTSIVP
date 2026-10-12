'use client';

/** IsiTechNote - dipecah dari app/(portal)/tech-note/_components/bagian-tech-note.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { ListEmptyState, ErrorState } from '@/components/shared';
import { bisaDiklik } from '@/components/shared/bisaDiklik';
import { TechNoteFolder, TechNote, formatDateShort } from './shared';
import React from 'react';
import { User } from '@/app/(portal)/dashboard/_components/shared';
import { Avatar, FolderSidebar, Spinner, StatusBadge, TechNoteKPISummary, hrefAman } from './bagian-tech-note';

export interface IsiTechNoteProps {
  canManage: boolean;
  currentUser: User | null;
  fetchError: string | null;
  fetchNotes: () => Promise<void>;
  filterStatus: string;
  filtered: TechNote[];
  folders: TechNoteFolder[];
  loading: boolean;
  openDetail: (tn: TechNote) => Promise<void>;
  pendingCount: number;
  search: string;
  selectedFolder: string | null;
  setFilterStatus: React.Dispatch<React.SetStateAction<string>>;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  setSelectedFolder: React.Dispatch<React.SetStateAction<string | null>>;
  setShowFolderDrawer: React.Dispatch<React.SetStateAction<boolean>>;
  setShowFolderModal: React.Dispatch<React.SetStateAction<boolean>>;
  setTab: React.Dispatch<React.SetStateAction<"pending" | "all" | "mine">>;
  showFolderDrawer: boolean;
  tab: "pending" | "all" | "mine";
  technotes: TechNote[];
  year: number;
}

export function IsiTechNote({ canManage, currentUser, fetchError, fetchNotes, filterStatus, filtered, folders, loading, openDetail, pendingCount, search, selectedFolder, setFilterStatus, setSearch, setSelectedFolder, setShowFolderDrawer, setShowFolderModal, setTab, showFolderDrawer, tab, technotes, year }: IsiTechNoteProps) {
  return (
    <>
      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ── */}
        <FolderSidebar folders={folders} technotes={technotes}
          selected={selectedFolder} onSelect={setSelectedFolder}
          onAdd={()=>setShowFolderModal(true)} canManage={canManage}
          mobileOpen={showFolderDrawer} onCloseMobile={()=>setShowFolderDrawer(false)} />

        {/* ── Main Content ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
            {currentUser && <TechNoteKPISummary technotes={technotes} currentUser={currentUser} year={year} />}

            {/* Tabs + Search */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {/* Sidebar Folder disembunyikan di ponsel (lihat FolderSidebar) -
                  tombol ini satu-satunya jalan membukanya di sana. */}
              <button onClick={()=>setShowFolderDrawer(true)}
                className="md:hidden px-3 py-1.5 rounded-xl text-[13px] font-bold border border-gray-200 text-slate-600 flex items-center gap-1.5"
                style={{ background: 'rgba(255,255,255,0.92)' }}>
                <IkonTeks nama="📁" />Folder{selectedFolder && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
              </button>
              {([
                { id:'all',     label:`Semua (${technotes.length})` },
                ...(canManage ? [{ id:'pending', label:`⏳ Approval${pendingCount>0?` (${pendingCount})`:''}`  }] : []),
                { id:'mine',    label:`📁 Milik Saya (${technotes.filter(t=>t.author_id===currentUser?.id).length})` },
              ] as { id:string; label:string }[]).map(t => (
                <button key={t.id} onClick={()=>setTab(t.id as typeof tab)}
                  className="px-4 py-1.5 rounded-xl text-[13px] font-bold transition-all border"
                  style={{
                    background: tab===t.id ? 'linear-gradient(135deg,#be185d,#9d174d)' : 'rgba(255,255,255,0.92)',
                    color: tab===t.id ? '#fff' : '#64748b',
                    borderColor: tab===t.id ? '#be185d' : '#e2e8f0',
                    boxShadow: tab===t.id ? '0 2px 8px rgba(190,24,93,0.25)' : 'none',
                  }}>
                  {t.label}
                </button>
              ))}
              {/* ml-auto hanya berlaku saat barisnya memang muat. Di ponsel ia
                  mendorong kotak cari keluar layar, jadi di sana kelompok ini
                  mengisi barisnya sendiri. */}
              <div className="w-full sm:w-auto sm:ml-auto flex items-center gap-2">
                <div className="relative flex-1 sm:flex-initial min-w-0">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm"><Ikon nama="🔍" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                  <input aria-label="Cari judul, produk, tag..." value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari judul, produk, tag..."
                    className="pl-8 pr-3 py-2 text-[13px] rounded-xl outline-none w-full sm:w-52 text-slate-700 border border-gray-200 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 placeholder-slate-400" style={{ background: 'rgba(255,255,255,0.95)' }} />
                </div>
                <select aria-label="Semua Status" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
                  className="px-3 py-2 text-[13px] rounded-xl outline-none text-slate-700 border border-gray-200 focus:border-rose-400" style={{ background: 'rgba(255,255,255,0.95)' }}>
                  <option value="all">Semua Status</option>
                  <option value="approved">Approved</option>
                  {/* Team user hanya bisa filter approved & pending (note milik sendiri) */}
                  {(canManage || true) && <option value="pending">Pending</option>}
                  <option value="revision">Perlu Revisi</option>
                  <option value="rejected">Ditolak</option>
                </select>
              </div>
            </div>

            {/* Cards */}
            {loading ? <Spinner /> : fetchError ? (
              <ErrorState message={`Gagal memuat Tech Note: ${fetchError}`} onRetry={fetchNotes} />
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl shadow-sm" style={{ background: 'rgba(255,255,255,0.90)' }}>
                <ListEmptyState
                  adaFilterAktif={search.trim() !== '' || filterStatus !== 'all' || tab !== 'all' || selectedFolder !== null}
                  onReset={() => { setSearch(''); setFilterStatus('all'); setTab('all'); setSelectedFolder(null); }}
                  icon="📝"
                  judulKosong={`Belum ada Tech Note di ${year}`}
                  deskripsiKosong="Catatan teknis yang diunggah tim akan muncul di sini."
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map(tn => {
                  const folder = folders.find(f=>f.id===tn.folder_id);
                  return (
                    <div key={tn.id} {...bisaDiklik(()=>openDetail(tn))}
                      className="rounded-2xl p-4 cursor-pointer transition-all group bg-white border border-gray-200 hover:border-rose-300 hover:shadow-md"
                      style={{ boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
                      <div className="flex items-start justify-between mb-2 gap-2">
                        {folder && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background:`${folder.color}15`, color:folder.color, border:`1px solid ${folder.color}30` }}>
                            <Ikon nama={folder.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /> {folder.name}
                          </span>
                        )}
                        <StatusBadge status={tn.status} />
                      </div>
                      <h4 className="font-bold text-[14px] text-slate-800 leading-snug mb-1.5 group-hover:text-rose-600 transition-colors">{tn.title}</h4>
                      <p className="text-[12px] text-slate-500 mb-3 line-clamp-2">{tn.description}</p>
                      {(tn.tags??[]).length>0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {(tn.tags??[]).slice(0,3).map(tag=>(
                            <span key={tag} className="text-[11px] px-1.5 py-0.5 rounded-md font-medium text-slate-500 bg-slate-100">#{tag}</span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-2.5 border-t border-gray-100">
                        <div className="flex items-center gap-1.5">
                          <Avatar name={tn.author_name} size={22} />
                          <span className="text-[11px] text-slate-500 font-medium truncate max-w-[100px]">{tn.author_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-500">{formatDateShort(tn.submitted_at)}</span>
                          {tn.one_drive_link && (
                            <a href={hrefAman(tn.one_drive_link)} target="_blank" rel="noopener noreferrer"
                              onClick={e=>e.stopPropagation()}
                              className="text-[11px] font-bold px-1.5 py-0.5 rounded-lg transition-colors text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100">
                              <IkonTeks nama="☁" />Drive
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
      </div>
    </>
  );
}
