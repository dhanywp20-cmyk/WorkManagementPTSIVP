'use client';

/** PanelLampiranDetail - dipecah dari app/(portal)/form-require-project/_components/ModalDetailRequest.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { Ikon } from '@/components/shared/Ikon';
import { Desain3DTools } from '../Desain3DTools';
import { ProjectRequest, ProjectAttachment } from '../shared';
import { type TautanDesain3D, type IzinRuang } from '../desain-3d-request';

export interface PanelLampiranDetailProps {
  activeAttachTab: "all" | "sld" | "boq" | "design3d";
  attachments: ProjectAttachment[];
  bisaKelolaRequest: boolean;
  boqFileRef: import("react").RefObject<HTMLInputElement | null>;
  desain3d: { tautan: TautanDesain3D[]; izin: IzinRuang[]; galat?: string; } | null;
  desain3dTools: TautanDesain3D[];
  design3dFileRef: import("react").RefObject<HTMLInputElement | null>;
  detailRoomIdx: number;
  detailRoomStatus: "pending" | "approved" | "in_progress" | "completed" | "rejected" | undefined;
  displayFileName: (fileName: string) => string;
  fileInputRef: import("react").RefObject<HTMLInputElement | null>;
  formatFileSize: (bytes: number) => string;
  getFileRoomIdx: (fileName: string) => number;
  handleCategoryUpload: (file: File, category: "sld" | "boq" | "design3d") => Promise<void>;
  handleDeleteAttachment: (att: ProjectAttachment) => void;
  handleFileUpload: (file: File) => Promise<void>;
  isPTS: boolean;
  mintaPilih3D: number;
  muatDesain3D: (id: string) => Promise<void>;
  notify: (type: "success" | "error" | "info", msg: string) => void;
  selectedRequest: ProjectRequest;
  setActiveAttachTab: import("react").Dispatch<import("react").SetStateAction<"all" | "sld" | "boq" | "design3d">>;
  setMintaPilih3D: import("react").Dispatch<import("react").SetStateAction<number>>;
  setShowUploadChoice: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  showUploadChoice: boolean;
  sldFileRef: import("react").RefObject<HTMLInputElement | null>;
  uploadingCategory: "sld" | "boq" | "design3d" | null;
  uploadingFile: boolean;
}

export function PanelLampiranDetail({ activeAttachTab, attachments, bisaKelolaRequest, boqFileRef, desain3d, desain3dTools, design3dFileRef, detailRoomIdx, detailRoomStatus, displayFileName, fileInputRef, formatFileSize, getFileRoomIdx, handleCategoryUpload, handleDeleteAttachment, handleFileUpload, isPTS, mintaPilih3D, muatDesain3D, notify, selectedRequest, setActiveAttachTab, setMintaPilih3D, setShowUploadChoice, showUploadChoice, sldFileRef, uploadingCategory, uploadingFile }: PanelLampiranDetailProps) {
  return (
    <>
      <div className="bg-white/95 rounded-2xl p-5 border-2 border-gray-200 shadow-sm satulayar:col-span-2">
        {(() => {
          // Scope file ke room tab yang lagi aktif - pakai konvensi prefix
          // "[roomN]" yang sudah ada di nama file (lihat getFileRoomIdx).
          const roomAttachments = attachments.filter(a => getFileRoomIdx(a.file_name) === detailRoomIdx);
          return (<>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <span className="w-8 h-8 shrink-0 bg-teal-600 text-white rounded-lg flex items-center justify-center text-xs shadow"><Ikon nama="📎" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
            Dokumen & File Attachment
            {detailRoomIdx > 0 && <span className="text-[11px] font-bold text-teal-500 normal-case bg-teal-50 px-2 py-0.5 rounded-full">{(selectedRequest.rooms||[])[detailRoomIdx - 1]?.room_name || `Ruangan ${detailRoomIdx + 1}`}</span>}
          </h3>
          {(() => {
            const ptsUploadAllowed = isPTS && detailRoomStatus !== 'pending' && detailRoomStatus !== 'rejected';
            return (
              <div className="relative">
                <button
                  onClick={() => (ptsUploadAllowed ? setShowUploadChoice(v => !v) : fileInputRef.current?.click())}
                  disabled={uploadingFile}
                  className="text-xs bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 disabled:opacity-60">
                  <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  {uploadingFile ? 'Uploading...' : 'Upload File'}
                </button>
                {showUploadChoice && ptsUploadAllowed && (<>
                  <div aria-hidden="true" className="fixed inset-0 z-10" onClick={() => setShowUploadChoice(false)} />
                  <div className="absolute right-0 top-full mt-1.5 z-20 w-64 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
                    <button onClick={() => { setShowUploadChoice(false); fileInputRef.current?.click(); }}
                      className="w-full text-left px-3.5 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-start gap-2 border-b border-gray-100">
                      <span className="text-base leading-none"><Ikon nama="📷" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                      <span>Foto Survey / Require BOQ<br /><span className="font-normal text-gray-500">Foto lokasi, dokumen kebutuhan dari Sales</span></span>
                    </button>
                    <p className="px-3.5 pt-2 pb-1 text-[11px] font-bold text-gray-500 uppercase tracking-widest">File PTS - pilih kategori</p>
                    {/*
                      Tiga pilihan eksplisit, BUKAN tebak dari ekstensi file - PDF
                      bisa berarti SLD atau Design 3D (sldFileRef & design3dFileRef
                      sama-sama accept=".pdf"), jadi menebak dari ekstensi akan salah
                      tepat pada kasus yang paling sering. Memakai file input yang
                      sama persis dengan tombol kategori di panel bawah, supaya
                      filenya selalu masuk tab SLD(0)/BOQ(0)/3D(0) yang benar.
                    */}
                    {[
                      { ref: sldFileRef, icon: '📐', label: 'SLD (PDF)', hint: 'Gambar teknis instalasi' },
                      { ref: boqFileRef, icon: '📊', label: 'BOQ (Excel)', hint: 'Rincian kebutuhan & harga' },
                      { ref: design3dFileRef, icon: '🎨', label: 'Design 3D', hint: 'Render / mock-up ruangan' },
                    ].map(({ ref, icon, label, hint }) => (
                      <button key={label} onClick={() => { setShowUploadChoice(false); ref.current?.click(); }}
                        className="w-full text-left px-3.5 py-2.5 text-xs font-semibold text-gray-700 hover:bg-teal-50 flex items-start gap-2">
                        <span className="text-base leading-none"><Ikon nama={icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /></span>
                        <span>{label}<br /><span className="font-normal text-gray-500">{hint}</span></span>
                      </button>
                    ))}
                    {/* Tambahan: tautkan desain dari Tools Team (bukan unggah file). */}
                    <button onClick={() => { setShowUploadChoice(false); setActiveAttachTab(t => (t === 'all' || t === 'design3d' ? t : 'design3d')); setMintaPilih3D(n => n + 1); }}
                      className="w-full text-left px-3.5 py-2.5 text-xs font-semibold text-gray-700 hover:bg-violet-50 flex items-start gap-2 border-t border-gray-100">
                      <span className="text-base leading-none"><Ikon nama="🧊" ukuran="1.1em" className="inline-block align-[-0.18em]" /></span>
                      <span>Design 3D dari Tools Team<br /><span className="font-normal text-gray-500">Tautkan desain dari Desain 3D Ruang (opsional)</span></span>
                    </button>
                  </div>
                </>)}
              </div>
            );
          })()}
        </div>
        <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ''; }} />
        <input ref={sldFileRef} type="file" className="hidden" accept=".pdf"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleCategoryUpload(f, 'sld'); e.target.value = ''; }} />
        <input ref={boqFileRef} type="file" className="hidden" accept=".xlsx,.xls,.csv"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleCategoryUpload(f, 'boq'); e.target.value = ''; }} />
        <input ref={design3dFileRef} type="file" className="hidden" accept=".pdf,.dwg,.skp"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleCategoryUpload(f, 'design3d'); e.target.value = ''; }} />

        {isPTS && detailRoomStatus !== 'pending' && detailRoomStatus !== 'rejected' && (
          <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-gray-100">
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest self-center">Upload Dokumen:</p>
            {[
              { cat: 'sld' as const, ref: sldFileRef, label: '📐 SLD (PDF)', cls: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' },
              { cat: 'boq' as const, ref: boqFileRef, label: '📊 BOQ (Excel)', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
              { cat: 'design3d' as const, ref: design3dFileRef, label: '🎨 Design 3D', cls: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' },
            ].map(({ cat, ref, label, cls }) => (
              <button key={cat} onClick={() => ref.current?.click()} disabled={uploadingCategory === cat}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${cls}`}>
                {uploadingCategory === cat ? '⏳ Uploading...' : label}
              </button>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border border-gray-200 rounded-xl overflow-hidden mb-4">
          {(['all', 'sld', 'boq', 'design3d'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveAttachTab(tab)}
              className={`flex-1 py-2 text-xs font-bold uppercase transition-all ${activeAttachTab === tab ? 'text-white bg-teal-600' : 'text-gray-500 hover:bg-gray-50'}`}>
              {tab === 'all' ? `Semua (${roomAttachments.length + desain3dTools.filter(t => t.room_idx === detailRoomIdx).length})` : tab === 'design3d' ? `3D (${roomAttachments.filter(a => a.attachment_category === 'design3d').length + desain3dTools.filter(t => t.room_idx === detailRoomIdx).length})` : `${tab.toUpperCase()} (${roomAttachments.filter(a => a.attachment_category === tab).length})`}
            </button>
          ))}
        </div>

        {/* File grid */}
        {(activeAttachTab === 'all' ? roomAttachments : roomAttachments.filter(a => a.attachment_category === activeAttachTab)).length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-3xl mb-2">📂</div>
            <p className="text-xs font-medium">Belum ada file diupload {detailRoomIdx > 0 ? `untuk ${(selectedRequest.rooms||[])[detailRoomIdx - 1]?.room_name || `Ruangan ${detailRoomIdx + 1}`}` : ''}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* For structured categories: show LATEST prominently, history collapsed */}
            {(['sld','boq','design3d'] as const).filter(cat =>
              (activeAttachTab === 'all' || activeAttachTab === cat) &&
              roomAttachments.some(a => a.attachment_category === cat)
            ).map(cat => {
              const catFiles = [...roomAttachments.filter(a => a.attachment_category === cat)]
                .sort((a, b) => (b.revision_version || 0) - (a.revision_version || 0));
              const latest = catFiles[0];
              const history = catFiles.slice(1);
              const catLabel = cat === 'sld' ? 'SLD' : cat === 'boq' ? 'BOQ' : 'Design 3D';
              const catColor = cat === 'sld' ? 'blue' : cat === 'boq' ? 'emerald' : 'purple';
              return (
                <div key={cat} className={`rounded-xl border-2 overflow-hidden border-${catColor}-200`}>
                  <div className={`px-3 py-1.5 flex items-center justify-between bg-${catColor}-50`}>
                    <span className={`text-[11px] font-bold text-${catColor}-700 uppercase tracking-widest`}>{catLabel} — Versi Terbaru</span>
                    {history.length > 0 && <span className={`text-[10px] font-bold text-${catColor}-500`}>{history.length} versi lama</span>}
                  </div>
                  {/* Latest */}
                  <div className="flex items-center gap-1 border-b border-gray-100">
                  <a href={latest.file_url} target="_blank" rel="noopener noreferrer"
                    className="flex-1 min-w-0 flex items-center gap-3 p-3 hover:bg-teal-50 transition-all cursor-pointer">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl bg-${catColor}-100`}>
                      {latest.file_type?.includes('pdf') ? '📄' : latest.file_type?.startsWith('image') ? '🖼️' : '📊'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-gray-800 truncate">{displayFileName(latest.file_name)}</p>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full bg-${catColor}-500 text-white whitespace-nowrap`}>
                          {latest.revision_version ? `Rev ${latest.revision_version}` : 'Latest'} ★
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">{formatFileSize(latest.file_size)} · {new Date(latest.uploaded_at).toLocaleDateString('id-ID')}</p>
                    </div>
                    <svg aria-hidden="true" focusable="false" className="w-4 h-4 text-teal-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </a>
                  {bisaKelolaRequest && (
                    <button onClick={() => handleDeleteAttachment(latest)} title="Hapus file"
                      className="flex-shrink-0 mr-2 w-7 h-7 rounded-lg flex items-center justify-center text-red-600 hover:text-red-700 hover:bg-red-50 transition-all">
                      <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  )}
                  </div>
                  {/* Version history */}
                  {history.map(att => (
                    <div key={att.id} className="flex items-center gap-1 border-b border-gray-50 opacity-60">
                    <a href={att.file_url} target="_blank" rel="noopener noreferrer"
                      className="flex-1 min-w-0 flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-all cursor-pointer">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-sm bg-gray-100">
                        {att.file_type?.includes('pdf') ? '📄' : att.file_type?.startsWith('image') ? '🖼️' : '📊'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-gray-500 truncate">{displayFileName(att.file_name)}</p>
                        <p className="text-[10px] text-gray-500">{att.revision_version ? `Rev ${att.revision_version}` : ''} · {new Date(att.uploaded_at).toLocaleDateString('id-ID')}</p>
                      </div>
                      <svg aria-hidden="true" focusable="false" className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </a>
                    {bisaKelolaRequest && (
                      <button onClick={() => handleDeleteAttachment(att)} title="Hapus file"
                        className="flex-shrink-0 mr-2 w-6 h-6 rounded-lg flex items-center justify-center text-red-300 hover:text-red-600 hover:bg-red-50 transition-all">
                        <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    )}
                    </div>
                  ))}
                </div>
              );
            })}
            {/* General files */}
            {roomAttachments.filter(a => a.attachment_category === 'general' || !a.attachment_category).length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {roomAttachments.filter(a => a.attachment_category === 'general' || !a.attachment_category).map(att => (
                  <div key={att.id} className="group relative flex items-center gap-2 p-2.5 rounded-xl border border-gray-200 hover:border-teal-300 hover:bg-teal-50 transition-all">
                    <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 flex items-center gap-2 cursor-pointer">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-lg bg-gray-50">
                        {att.file_type?.startsWith('image') ? '🖼️' : att.file_type?.includes('pdf') ? '📄' : '📎'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-gray-700 truncate group-hover:text-teal-700">{displayFileName(att.file_name)}</p>
                        <p className="text-[10px] text-gray-500">{formatFileSize(att.file_size)}</p>
                      </div>
                    </a>
                    {bisaKelolaRequest && (
                      <button onClick={() => handleDeleteAttachment(att)} title="Hapus file"
                        className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-red-300 hover:text-red-600 hover:bg-red-50 transition-all">
                        <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {(activeAttachTab === 'all' || activeAttachTab === 'design3d') && (
          <div className="mt-3">
            <Desain3DTools requestId={selectedRequest.id} roomIdx={detailRoomIdx}
              namaRuang={detailRoomIdx === 0 ? (selectedRequest.room_name?.trim() || 'Ruangan 1') : ((selectedRequest.rooms || [])[detailRoomIdx - 1]?.room_name?.trim() || `Ruangan ${detailRoomIdx + 1}`)}
              projectName={selectedRequest.project_name} mintaPilih={mintaPilih3D} data={desain3d}
              muatUlang={() => muatDesain3D(selectedRequest.id)} notify={notify} />
          </div>
        )}
          </>);
        })()}
      </div>
    </>
  );
}
