'use client';

/** ModalDetailRequest - dipecah dari app/(portal)/form-require-project/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { AuditTrailPanel, FlowSteps, ModalPortal } from '@/components/shared';
import { Z } from '@/lib/z-index';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { unduhPaketRequest } from './paket-unduhan';
import { cetakRequest } from './cetak-request';
import { User, ProjectRequest, ProjectMessage, ProjectAttachment, getRoomStatus } from './shared';
import { Desain3DTools } from './Desain3DTools';
import { supabase } from '@/lib/supabase';
import { type TautanDesain3D, type IzinRuang } from './desain-3d-request';
import { PanelChatDetail } from './detail/PanelChatDetail';
import { RiwayatDetail } from './detail/RiwayatDetail';
import { AlurDetail } from './detail/AlurDetail';
import { KontrolAdminDetail } from './detail/KontrolAdminDetail';
import { PanelLampiranDetail } from './detail/PanelLampiranDetail';
import { KartuRuanganDetail } from './detail/KartuRuanganDetail';
import { KartuPeripheralDetail } from './detail/KartuPeripheralDetail';
import { KartuLayoutDetail } from './detail/KartuLayoutDetail';
import { KartuKategoriDetail } from './detail/KartuKategoriDetail';
import { KartuInfoDetail } from './detail/KartuInfoDetail';
import { HeaderDetail } from './detail/HeaderDetail';

export interface ModalDetailRequestProps {
  activeAttachTab: "all" | "sld" | "boq" | "design3d";
  attachments: ProjectAttachment[];
  bisaKelolaRequest: boolean;
  bolehEditRequest: (req: ProjectRequest) => boolean;
  bolehRerouteRequest: (r: ProjectRequest) => boolean;
  boqFileRef: import("react").RefObject<HTMLInputElement | null>;
  canInternalApproveProject: (req: ProjectRequest) => boolean;
  chatFileRef: import("react").RefObject<HTMLInputElement | null>;
  chatRoomFilter: string;
  currentUser: User;
  desain3d: { tautan: TautanDesain3D[]; izin: IzinRuang[]; galat?: string; } | null;
  desain3dTools: TautanDesain3D[];
  design3dFileRef: import("react").RefObject<HTMLInputElement | null>;
  detailDueStatus: { type: string; label: string; days: number; } | null;
  detailIsPending: boolean;
  detailMobileTab: "info" | "chat";
  detailRoomAssignName: string | undefined;
  detailRoomIdx: number;
  detailRoomStatus: "pending" | "approved" | "in_progress" | "completed" | "rejected" | undefined;
  detailSc: { label: string; color: string; bg: string; border: string; } | null;
  displayFileName: (fileName: string) => string;
  downloadingPackage: boolean;
  fetchRequests: () => Promise<void>;
  fileInputRef: import("react").RefObject<HTMLInputElement | null>;
  formatDate: (dt: string) => string;
  formatDueDate: (dt: string) => string;
  formatFileSize: (bytes: number) => string;
  getCCLabel: (req: ProjectRequest) => string;
  getFileRoomIdx: (fileName: string) => number;
  handleCategoryUpload: (file: File, category: "sld" | "boq" | "design3d") => Promise<void>;
  handleCloseDetail: () => void;
  handleDeleteAttachment: (att: ProjectAttachment) => void;
  handleFileUpload: (file: File) => Promise<void>;
  handleOpenEditForm: () => void;
  handleReject: (req: ProjectRequest) => void;
  handleResubmit: (req: ProjectRequest) => Promise<void>;
  handleSendMessage: () => Promise<void>;
  handleStatusUpdate: (req: ProjectRequest, newStatus: string, roomIdx?: number) => Promise<void>;
  isIVPGuest: boolean;
  isNonIVPGuest: boolean;
  isPTS: boolean;
  isTeamPTS: boolean;
  messages: ProjectMessage[];
  messagesEndRef: import("react").RefObject<HTMLDivElement | null>;
  mintaPilih3D: number;
  msgText: string;
  muatDesain3D: (id: string) => Promise<void>;
  notify: (type: "success" | "error" | "info", msg: string) => void;
  selectedRequest: ProjectRequest | null;
  sendingMsg: boolean;
  setActiveAttachTab: import("react").Dispatch<import("react").SetStateAction<"all" | "sld" | "boq" | "design3d">>;
  setAssignModal: import("react").Dispatch<import("react").SetStateAction<{ open: boolean; req: ProjectRequest | null; roomIdx: number; }>>;
  setChatRoomFilter: import("react").Dispatch<import("react").SetStateAction<string>>;
  setDeleteConfirmText: import("react").Dispatch<import("react").SetStateAction<string>>;
  setDeleteModal: import("react").Dispatch<import("react").SetStateAction<{ open: boolean; req: ProjectRequest | null; }>>;
  setDetailMobileTab: import("react").Dispatch<import("react").SetStateAction<"info" | "chat">>;
  setDetailRoomIdx: import("react").Dispatch<import("react").SetStateAction<number>>;
  setDownloadingPackage: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setInternalApproveTarget: import("react").Dispatch<import("react").SetStateAction<ProjectRequest | null>>;
  setMintaPilih3D: import("react").Dispatch<import("react").SetStateAction<number>>;
  setMsgText: import("react").Dispatch<import("react").SetStateAction<string>>;
  setRerouteTarget: import("react").Dispatch<import("react").SetStateAction<ProjectRequest | null>>;
  setRerouteTo: import("react").Dispatch<import("react").SetStateAction<string>>;
  setSelectedNewStatus: import("react").Dispatch<import("react").SetStateAction<string>>;
  setSelectedRequest: import("react").Dispatch<import("react").SetStateAction<ProjectRequest | null>>;
  setShowUploadChoice: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setStatusUpdateModal: import("react").Dispatch<import("react").SetStateAction<{ open: boolean; req: ProjectRequest | null; roomIdx: number; }>>;
  showDetailModal: boolean;
  showUploadChoice: boolean;
  sldFileRef: import("react").RefObject<HTMLInputElement | null>;
  uploadingCategory: "sld" | "boq" | "design3d" | null;
  uploadingFile: boolean;
}

export function ModalDetailRequest({ activeAttachTab, attachments, bisaKelolaRequest, bolehEditRequest, bolehRerouteRequest, boqFileRef, canInternalApproveProject, chatFileRef, chatRoomFilter, currentUser, desain3d, desain3dTools, design3dFileRef, detailDueStatus, detailIsPending, detailMobileTab, detailRoomAssignName, detailRoomIdx, detailRoomStatus, detailSc, displayFileName, downloadingPackage, fetchRequests, fileInputRef, formatDate, formatDueDate, formatFileSize, getCCLabel, getFileRoomIdx, handleCategoryUpload, handleCloseDetail, handleDeleteAttachment, handleFileUpload, handleOpenEditForm, handleReject, handleResubmit, handleSendMessage, handleStatusUpdate, isIVPGuest, isNonIVPGuest, isPTS, isTeamPTS, messages, messagesEndRef, mintaPilih3D, msgText, muatDesain3D, notify, selectedRequest, sendingMsg, setActiveAttachTab, setAssignModal, setChatRoomFilter, setDeleteConfirmText, setDeleteModal, setDetailMobileTab, setDetailRoomIdx, setDownloadingPackage, setInternalApproveTarget, setMintaPilih3D, setMsgText, setRerouteTarget, setRerouteTo, setSelectedNewStatus, setSelectedRequest, setShowUploadChoice, setStatusUpdateModal, showDetailModal, showUploadChoice, sldFileRef, uploadingCategory, uploadingFile }: ModalDetailRequestProps) {
  return (
    <>
      {showDetailModal && selectedRequest && detailSc && (
      <ModalPortal>
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-0" style={{ zIndex: Z.overlay }}
          onClick={e => { if (e.target === e.currentTarget) handleCloseDetail(); }}>
          <div className="bg-white w-full h-full animate-slide-up flex flex-col overflow-hidden"
            style={{ border: 'none' }}>

            {/* Detail Modal Header */}
            {/* flex-col sm:flex-row: sebelumnya SATU baris (flex items-center) berisi
                tombol tutup + judul + sampai 6 tombol aksi (Update Status/Edit/
                Hapus/Download/Print, dst). Tombol aksinya flex-shrink-0 - menolak
                menyusut - jadi begitu semuanya tidak muat di satu baris di HP,
                yang terjadi bukan tombolnya turun ke bawah, tapi seluruh baris
                header memaksa lebih lebar dari layar dan tombol paling kanan
                (mis. Download) terpotong. Sekarang tutup+judul jadi baris sendiri,
                tombol aksi jadi baris sendiri di bawahnya (bebas melipat) - di HP;
                di layar besar (sm:) keduanya kembali sejajar seperti semula. */}
            <HeaderDetail
              attachments={attachments} bisaKelolaRequest={bisaKelolaRequest} bolehEditRequest={bolehEditRequest} bolehRerouteRequest={bolehRerouteRequest} canInternalApproveProject={canInternalApproveProject} currentUser={currentUser} desain3dTools={desain3dTools} detailIsPending={detailIsPending} detailRoomAssignName={detailRoomAssignName} detailRoomIdx={detailRoomIdx} detailRoomStatus={detailRoomStatus} detailSc={detailSc} downloadingPackage={downloadingPackage} formatDate={formatDate} getCCLabel={getCCLabel} handleCloseDetail={handleCloseDetail} handleOpenEditForm={handleOpenEditForm} handleReject={handleReject} handleStatusUpdate={handleStatusUpdate} isPTS={isPTS} isTeamPTS={isTeamPTS} notify={notify} selectedRequest={selectedRequest} setAssignModal={setAssignModal} setDeleteConfirmText={setDeleteConfirmText} setDeleteModal={setDeleteModal} setDownloadingPackage={setDownloadingPackage} setInternalApproveTarget={setInternalApproveTarget} setRerouteTarget={setRerouteTarget} setRerouteTo={setRerouteTo} setSelectedNewStatus={setSelectedNewStatus} setStatusUpdateModal={setStatusUpdateModal}
            />

            {/* Warning: non-IVP guest has no sales_division */}
            {isNonIVPGuest && !currentUser.sales_division && (
              <div className="mx-4 my-2 px-4 py-3 rounded-xl flex items-center gap-3 border-2 border-amber-300" style={{ background: 'rgba(254,243,199,0.9)' }}>
                <span className="text-2xl flex-shrink-0"><Ikon nama="⚠" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                <div>
                  <p className="text-sm font-bold text-amber-800">Sales Division belum diset di akun kamu!</p>
                  <p className="text-xs text-amber-700 mt-0.5">Hubungi admin untuk set <strong>Sales Division</strong> di profil akunmu. Tanpa ini, request tidak bisa di-link ke IVP Sales internal.</p>
                </div>
              </div>
            )}

            {/* Rejection reason banner */}
            {selectedRequest.status === 'rejected' && (
              <div className="mx-4 my-2 px-4 py-3 rounded-xl flex items-start gap-3 border-2 border-red-300" style={{ background: 'rgba(254,226,226,0.9)' }}>
                <span className="text-2xl flex-shrink-0 mt-0.5"><Ikon nama="❌" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-red-800">Request ini ditolak</p>
                  {selectedRequest.rejection_reason && (
                    <p className="text-xs text-red-700 mt-1">
                      <strong>Alasan:</strong> {selectedRequest.rejection_reason}
                    </p>
                  )}
                  {!isPTS && (
                    <button
                      onClick={() => handleResubmit(selectedRequest)}
                      className="mt-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-1.5 rounded-lg transition-all"
                    >
                      <IkonTeks nama="🔄" />Submit Ulang Request
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* IVP Guest info banner */}
            {isIVPGuest && selectedRequest.ivp_assignee === currentUser.full_name && selectedRequest.requester_id !== currentUser.id && (
              <div className="px-5 py-2 flex items-center gap-2 text-xs flex-shrink-0"
                style={{ background: 'rgba(99,102,241,0.10)', borderBottom: '1px solid rgba(99,102,241,0.2)' }}>
                <span><Ikon nama="🔗" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                <span className="text-indigo-700 font-semibold">
                  Anda di-assign sebagai <strong>IVP Sales Internal</strong> untuk request dari divisi eksternal
                  <strong> {selectedRequest.sales_division}</strong>. Anda dapat ikut chat dan memantau progress.
                </span>
              </div>
            )}

            {/* Detail Modal Body — 2 columns: LEFT (info + attachments) | RIGHT (chat) */}
            {/* Mobile: tab switcher to toggle between Info and Chat panels */}
            <div className="flex sm:hidden border-b border-gray-200 bg-white flex-shrink-0">
              <button onClick={() => setDetailMobileTab('info')}
                className={`flex-1 py-2.5 text-xs font-bold transition-all border-b-2 ${detailMobileTab === 'info' ? 'text-teal-700 border-teal-600' : 'text-gray-500 border-transparent'}`}>
                <IkonTeks nama="📋" />Info Project
              </button>
              <button onClick={() => setDetailMobileTab('chat')}
                className={`flex-1 py-2.5 text-xs font-bold transition-all border-b-2 ${detailMobileTab === 'chat' ? 'text-teal-700 border-teal-600' : 'text-gray-500 border-transparent'}`}>
                <IkonTeks nama="💬" />Chat
              </button>
            </div>
            <div className="flex-1 flex flex-col sm:flex-row overflow-hidden min-h-0">

              {/* LEFT: Detail Info + Attachments */}
              <div className={`${detailMobileTab === 'info' ? 'flex flex-col' : 'hidden'} sm:flex sm:flex-col flex-[3] min-w-0 border-r border-gray-200 overflow-y-auto bg-gray-50`}>
                {/* Room Tab Navigator — STICKY di atas scroll area, supaya bisa pindah
                    section tanpa perlu scroll balik ke atas dulu. Ditaruh DI LUAR
                    "p-5 space-y-5" (bukan ikut scroll bareng konten) tapi tetap di
                    dalam container overflow-y-auto yang sama, supaya sticky-nya nempel
                    relatif terhadap scroll area ini (bukan seluruh modal). */}
                {(() => {
                  const detailRooms = selectedRequest.rooms || [];
                  const totalDetailRooms = 1 + detailRooms.length;
                  if (totalDetailRooms <= 1) return null;
                  return (
                    <div className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-sm px-5 pt-4 pb-3 border-b border-gray-200 shadow-sm">
                      <div className="flex items-center bg-teal-50 border border-teal-200 rounded-2xl px-2 py-1.5 gap-1 overflow-x-auto">
                        <button aria-label="Sebelumnya" type="button" onClick={() => setDetailRoomIdx(i => Math.max(0, i-1))} disabled={detailRoomIdx === 0}
                          className="p-1.5 rounded-lg text-teal-700 hover:bg-teal-100 disabled:opacity-30 transition-all flex-shrink-0">
                          <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7"/></svg>
                        </button>
                        {Array.from({length: totalDetailRooms}).map((_, i) => {
                          const label = i === 0 ? (selectedRequest.room_name?.trim() || 'Ruangan 1') : (detailRooms[i-1]?.room_name?.trim() || `Ruangan ${i+1}`);
                          // Titik status per ruangan - supaya admin lihat sekilas Command
                          // Center masih dikerjakan sementara Smart ClassRoom sudah selesai,
                          // tanpa harus buka satu-satu tab-nya.
                          const roomSt = getRoomStatus(selectedRequest, i);
                          const dotColor: Record<string, string> = {
                            pending: 'bg-amber-400', approved: 'bg-teal-400', in_progress: 'bg-blue-400',
                            completed: 'bg-purple-400', rejected: 'bg-red-400',
                          };
                          return (
                            <button key={i} type="button" onClick={() => setDetailRoomIdx(i)}
                              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${detailRoomIdx === i ? 'bg-teal-600 text-white shadow' : 'text-teal-700 hover:bg-teal-100'}`}>
                              {roomSt && <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor[roomSt] || 'bg-gray-300'}`} />}
                              {label}
                            </button>
                          );
                        })}
                        <button aria-label="Berikutnya" type="button" onClick={() => setDetailRoomIdx(i => Math.min(totalDetailRooms-1, i+1))} disabled={detailRoomIdx === totalDetailRooms-1}
                          className="p-1.5 rounded-lg text-teal-700 hover:bg-teal-100 disabled:opacity-30 transition-all flex-shrink-0">
                          <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7"/></svg>
                        </button>
                        <span className="text-[11px] text-teal-700 font-bold ml-auto mr-1">{detailRoomIdx+1}/{totalDetailRooms}</span>
                      </div>
                    </div>
                  );
                })()}
                {/* Kartu detail disusun dua kolom di layar lebar, bukan satu deret
                    memanjang ke bawah - mengikuti tata letak satu layar yang sudah
                    dipakai form pembuatannya. Sebelumnya membaca satu request
                    berarti menggulir melewati lima kartu penuh.

                    Ambangnya `satulayar`, sama seperti form pembuatan: yang
                    menentukan bukan lebar saja tapi juga alat penunjuknya, supaya
                    zoom Chrome tidak menjatuhkannya jadi satu kolom.

                    items-start supaya kartu pendek tidak ikut meregang mengikuti
                    kartu Source & Peripheral yang paling tinggi. */}
                <div className="p-5 grid grid-cols-1 satulayar:grid-cols-2 gap-5 items-start [&>*]:min-w-0">

                  {/* Assigned PTS — "in_progress" nudge */}
                  {isTeamPTS && detailRoomStatus === 'approved' && detailRoomAssignName === currentUser.full_name && (
                    <div className="rounded-xl px-4 py-3 flex items-center gap-3 satulayar:col-span-2"
                      style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.25)' }}>
                      <svg aria-hidden="true" focusable="false" className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                      <div>
                        <p className="text-sm font-bold text-blue-700">Request ini di-assign ke kamu</p>
                        <p className="text-xs text-blue-600 mt-0.5">Klik <strong>Mulai In Progress</strong> di atas untuk memulai pengerjaan. Setelah in progress, kamu dapat update status dan berkomunikasi via chat.</p>
                      </div>
                    </div>
                  )}

                  {/* Compute active room data for display */}
                  {(() => {
                    const detailRooms = selectedRequest.rooms || [];
                    // For detailRoomIdx > 0, use rooms[detailRoomIdx-1]; for 0 use selectedRequest fields
                    const activeRoom = detailRoomIdx > 0 ? detailRooms[detailRoomIdx - 1] : null;
                    const dr = activeRoom ? {
                      room_name: activeRoom.room_name,
                      kebutuhan: activeRoom.kebutuhan, kebutuhan_other: activeRoom.kebutuhan_other,
                      solution_product: activeRoom.solution_product, solution_other: activeRoom.solution_other,
                      layout_signage: activeRoom.layout_signage, jaringan_cms: activeRoom.jaringan_cms,
                      jumlah_input: activeRoom.jumlah_input, jumlah_output: activeRoom.jumlah_output,
                      source: activeRoom.source, source_other: activeRoom.source_other,
                      camera_conference: activeRoom.camera_conference, camera_jumlah: activeRoom.camera_jumlah, camera_tracking: activeRoom.camera_tracking,
                      audio_system: activeRoom.audio_system, audio_mixer: activeRoom.audio_mixer, audio_detail: activeRoom.audio_detail,
                      wallplate_input: activeRoom.wallplate_input, wallplate_jumlah: activeRoom.wallplate_jumlah,
                      tabletop_input: activeRoom.tabletop_input, tabletop_jumlah: activeRoom.tabletop_jumlah,
                      wireless_presentation: activeRoom.wireless_presentation, wireless_mode: activeRoom.wireless_mode, wireless_dongle: activeRoom.wireless_dongle,
                      controller_automation: activeRoom.controller_automation, controller_type: activeRoom.controller_type,
                      ukuran_ruangan: activeRoom.ukuran_ruangan, suggest_tampilan: activeRoom.suggest_tampilan, keterangan_lain: activeRoom.keterangan_lain,
                      brand_display: activeRoom.brand_display, brand_display_pic_name: activeRoom.brand_display_pic_name,
                      brand_display_2: activeRoom.brand_display_2, brand_display_2_pic_name: activeRoom.brand_display_2_pic_name,
                      brand_middleware: activeRoom.brand_middleware, brand_middleware_pic_name: activeRoom.brand_middleware_pic_name,
                    } : {
                      room_name: selectedRequest.room_name,
                      kebutuhan: selectedRequest.kebutuhan, kebutuhan_other: selectedRequest.kebutuhan_other,
                      solution_product: selectedRequest.solution_product, solution_other: selectedRequest.solution_other,
                      layout_signage: selectedRequest.layout_signage, jaringan_cms: selectedRequest.jaringan_cms,
                      jumlah_input: selectedRequest.jumlah_input, jumlah_output: selectedRequest.jumlah_output,
                      source: selectedRequest.source, source_other: selectedRequest.source_other,
                      camera_conference: selectedRequest.camera_conference, camera_jumlah: selectedRequest.camera_jumlah, camera_tracking: selectedRequest.camera_tracking,
                      audio_system: selectedRequest.audio_system, audio_mixer: selectedRequest.audio_mixer, audio_detail: selectedRequest.audio_detail,
                      wallplate_input: selectedRequest.wallplate_input, wallplate_jumlah: selectedRequest.wallplate_jumlah,
                      tabletop_input: selectedRequest.tabletop_input, tabletop_jumlah: selectedRequest.tabletop_jumlah,
                      wireless_presentation: selectedRequest.wireless_presentation, wireless_mode: selectedRequest.wireless_mode, wireless_dongle: selectedRequest.wireless_dongle,
                      controller_automation: selectedRequest.controller_automation, controller_type: selectedRequest.controller_type,
                      ukuran_ruangan: selectedRequest.ukuran_ruangan, suggest_tampilan: selectedRequest.suggest_tampilan, keterangan_lain: selectedRequest.keterangan_lain,
                      brand_display: selectedRequest.brand_display, brand_display_pic_name: selectedRequest.brand_display_pic_name,
                      brand_display_2: selectedRequest.brand_display_2, brand_display_2_pic_name: selectedRequest.brand_display_2_pic_name,
                      brand_middleware: selectedRequest.brand_middleware, brand_middleware_pic_name: selectedRequest.brand_middleware_pic_name,
                    };

                    // Helper renderers for detail display
                    // Dikecilkan khusus di HP (sm: kembali ke ukuran semula) - request
                    // dengan banyak field terisi bisa punya belasan ChipDisplay/YNDisplay
                    // bertumpuk, dan ukuran chip sebesar form isian membuat detail
                    // sepanjang ini di ponsel jadi scroll yang sangat panjang.
                    const ChipDisplay = ({ items }: { items: (string | undefined)[] }) => {
                      const filtered = items.filter(Boolean) as string[];
                      if (!filtered.length) return <span className="text-sm text-gray-500 italic">—</span>;
                      return <div className="flex flex-wrap gap-1.5 sm:gap-2">{filtered.map(item => (
                        <span key={item} className="flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-2 rounded-lg sm:rounded-xl border-2 border-teal-500 bg-teal-50 text-teal-700 text-xs sm:text-sm font-medium">
                          <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded border-2 border-teal-500 bg-teal-500 flex items-center justify-center flex-shrink-0"><svg aria-hidden="true" focusable="false" className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg></div>
                          {item}
                        </span>
                      ))}</div>;
                    };
                    const YNDisplay = ({ value, label }: { value: string; label: string }) => (
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 sm:mb-2">{label}</label>
                        <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-1 sm:mb-2">{['Yes','No'].map(opt => (<span key={opt} className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-2 rounded-lg sm:rounded-xl border-2 text-xs sm:text-sm font-medium ${value === opt ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-300 bg-white text-gray-500'}`}><div className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${value === opt ? 'border-teal-500' : 'border-gray-400'}`}>{value === opt && <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-teal-500" />}</div>{opt}</span>))}</div>
                      </div>
                    );

                    return (<>
                  {/* Project Info — form style */}
                  <KartuInfoDetail
                    detailDueStatus={detailDueStatus} detailRoomAssignName={detailRoomAssignName} detailSc={detailSc} dr={dr} formatDueDate={formatDueDate} getCCLabel={getCCLabel} selectedRequest={selectedRequest}
                  />

                  {/* Kategori & Solution — form style */}
                  <KartuKategoriDetail
                    ChipDisplay={ChipDisplay} dr={dr}
                  />

                  {/* Layout Konten & Jaringan — form style */}
                  <KartuLayoutDetail
                    ChipDisplay={ChipDisplay} dr={dr}
                  />

                  {/* Source & Peripheral — form style */}
                  <KartuPeripheralDetail
                    ChipDisplay={ChipDisplay} YNDisplay={YNDisplay} dr={dr}
                  />

                  {/* Ruangan & Keterangan — form style */}
                  <KartuRuanganDetail
                    dr={dr}
                  />
                  </>);
                  })()}

                  {/* Attachments Panel — prominent */}
                  <PanelLampiranDetail
                    activeAttachTab={activeAttachTab} attachments={attachments} bisaKelolaRequest={bisaKelolaRequest} boqFileRef={boqFileRef} desain3d={desain3d} desain3dTools={desain3dTools} design3dFileRef={design3dFileRef} detailRoomIdx={detailRoomIdx} detailRoomStatus={detailRoomStatus} displayFileName={displayFileName} fileInputRef={fileInputRef} formatFileSize={formatFileSize} getFileRoomIdx={getFileRoomIdx} handleCategoryUpload={handleCategoryUpload} handleDeleteAttachment={handleDeleteAttachment} handleFileUpload={handleFileUpload} isPTS={isPTS} mintaPilih3D={mintaPilih3D} muatDesain3D={muatDesain3D} notify={notify} selectedRequest={selectedRequest} setActiveAttachTab={setActiveAttachTab} setMintaPilih3D={setMintaPilih3D} setShowUploadChoice={setShowUploadChoice} showUploadChoice={showUploadChoice} sldFileRef={sldFileRef} uploadingCategory={uploadingCategory} uploadingFile={uploadingFile}
                  />

                  {/* Admin controls */}
                  <KontrolAdminDetail
                    detailDueStatus={detailDueStatus} detailRoomIdx={detailRoomIdx} detailRoomStatus={detailRoomStatus} fetchRequests={fetchRequests} formatDueDate={formatDueDate} isPTS={isPTS} isTeamPTS={isTeamPTS} notify={notify} selectedRequest={selectedRequest} setAssignModal={setAssignModal} setSelectedRequest={setSelectedRequest}
                  />

                  {/* Alur request — menjawab "sudah sampai mana perkara ini",
                      sejalan dengan Request Schedule. Riwayat di bawahnya
                      menceritakan yang SUDAH terjadi; alur ini menunjukkan yang
                      MASIH tersisa. */}
                  <AlurDetail
                    detailRoomAssignName={detailRoomAssignName} detailRoomStatus={detailRoomStatus} getCCLabel={getCCLabel} selectedRequest={selectedRequest}
                  />

                  {/* Riwayat perubahan — approve internal, approve admin, assign,
                      reject, ganti status. Baris pembuatan diturunkan dari request
                      itu sendiri karena logAudit baru mencatat 'create' sejak
                      perbaikan terakhir; tanpa itu request LAMA tampak tidak
                      punya pangkal padahal requester_name & created_at-nya ada. */}
                  <RiwayatDetail
                    selectedRequest={selectedRequest}
                  />
                </div>
              </div>

              {/* RIGHT: Chat */}
              <PanelChatDetail
                chatFileRef={chatFileRef} chatRoomFilter={chatRoomFilter} currentUser={currentUser} detailMobileTab={detailMobileTab} handleFileUpload={handleFileUpload} handleSendMessage={handleSendMessage} isPTS={isPTS} messages={messages} messagesEndRef={messagesEndRef} msgText={msgText} selectedRequest={selectedRequest} sendingMsg={sendingMsg} setChatRoomFilter={setChatRoomFilter} setMsgText={setMsgText} uploadingFile={uploadingFile}
              />
            </div>
          </div>
        </div>
      </ModalPortal>
      )}
    </>
  );
}
