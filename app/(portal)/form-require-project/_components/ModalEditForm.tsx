'use client';

/** ModalEditForm - dipecah dari app/(portal)/form-require-project/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { SalesPicker, ModalPortal } from '@/components/shared';
import { Z } from '@/lib/z-index';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { namaRuangan, type EditRoomFields } from './ruangan';
import { CheckGroup, RadioGroup } from './InputPilihan';
import { ProjectRequest, RoomDetail } from './shared';

export interface ModalEditFormProps {
  editCur: EditRoomFields;
  editDueDate: string;
  editFormData: { project_name: string; room_name: string; project_location: string; sales_name: string; sales_division: string; sales_user_id: string | null; kebutuhan: string[]; kebutuhan_other: string; solution_product: string[]; solution_other: string; layout_signage: string[]; jaringan_cms: string[]; jumlah_input: string; jumlah_output: string; source: string[]; source_other: string; camera_conference: string; camera_jumlah: string; camera_tracking: string[]; audio_system: string; audio_mixer: string; audio_detail: string[]; wallplate_input: string; wallplate_jumlah: string; tabletop_input: string; tabletop_jumlah: string; wireless_presentation: string; wireless_mode: string[]; wireless_dongle: string; controller_automation: string; controller_type: string[]; ukuran_ruangan: string; suggest_tampilan: string; keterangan_lain: string; };
  editFormModal: boolean;
  editNewRoomIds: string[];
  editRoomAktifBaru: boolean;
  editRoomIdx: number;
  editRooms: RoomDetail[];
  editUpd: (patch: Partial<EditRoomFields>) => void;
  handleEditAddRoom: () => void;
  handleEditFormSubmit: () => Promise<void>;
  handleEditRemoveNewRoom: () => void;
  isPTS: boolean;
  salesGuestUsers: { id: string; full_name: string; username: string; sales_division?: string; is_internal_sales?: boolean; }[];
  selectedRequest: ProjectRequest | null;
  setEditDueDate: import("react").Dispatch<import("react").SetStateAction<string>>;
  setEditFormData: import("react").Dispatch<import("react").SetStateAction<{ project_name: string; room_name: string; project_location: string; sales_name: string; sales_division: string; sales_user_id: string | null; kebutuhan: string[]; kebutuhan_other: string; solution_product: string[]; solution_other: string; layout_signage: string[]; jaringan_cms: string[]; jumlah_input: string; jumlah_output: string; source: string[]; source_other: string; camera_conference: string; camera_jumlah: string; camera_tracking: string[]; audio_system: string; audio_mixer: string; audio_detail: string[]; wallplate_input: string; wallplate_jumlah: string; tabletop_input: string; tabletop_jumlah: string; wireless_presentation: string; wireless_mode: string[]; wireless_dongle: string; controller_automation: string; controller_type: string[]; ukuran_ruangan: string; suggest_tampilan: string; keterangan_lain: string; }>>;
  setEditFormModal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setEditRoomIdx: import("react").Dispatch<import("react").SetStateAction<number>>;
}

export function ModalEditForm({ editCur, editDueDate, editFormData, editFormModal, editNewRoomIds, editRoomAktifBaru, editRoomIdx, editRooms, editUpd, handleEditAddRoom, handleEditFormSubmit, handleEditRemoveNewRoom, isPTS, salesGuestUsers, selectedRequest, setEditDueDate, setEditFormData, setEditFormModal, setEditRoomIdx }: ModalEditFormProps) {
  return (
    <>
      {editFormModal && selectedRequest && (
      <ModalPortal>
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: Z.overlayTop }}>
          <div className="bg-white/90 rounded-3xl shadow-2xl w-full max-w-2xl max-h-full flex flex-col border-2 border-amber-400 animate-scale-in overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-amber-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-white"><IkonTeks nama="✏" />Edit Kebutuhan Project</h2>
                <p className="text-amber-100 text-xs mt-0.5">{selectedRequest.project_name}</p>
              </div>
              <button aria-label="Tutup" onClick={() => setEditFormModal(false)} className="bg-white/20 hover:bg-white/30 text-white w-9 h-9 rounded-xl flex items-center justify-center font-bold text-lg">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-gray-50">

              <div className="bg-white/95 rounded-2xl p-5 border-2 border-gray-200 shadow-sm">
                <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 shrink-0 bg-amber-500 text-white rounded-lg flex items-center justify-center text-xs shadow"><Ikon nama="📁" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                  Informasi Project
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label htmlFor="f-form-require-project-page-3" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Nama Project *</label>
                    <input id="f-form-require-project-page-3" value={editFormData.project_name} onChange={e => setEditFormData(p => ({ ...p, project_name: e.target.value }))}
                      placeholder="Nama project..." className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none bg-white" />
                  </div>
                  <div>
                    <label htmlFor="f-form-require-project-page-4" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Lokasi Project</label>
                    <textarea id="f-form-require-project-page-4" value={editFormData.project_location} onChange={e => setEditFormData(p => ({ ...p, project_location: e.target.value }))}
                      placeholder="Contoh: Gedung Wisma 46 Lt.12, Jl. MH Thamrin No.1, Jakarta Pusat" rows={4}
                      className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-amber-400 outline-none bg-white resize-none" />
                  </div>
                  {/* Sales: hidden for guest (auto from account), admin/team can edit */}
                  {isPTS && (
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Sales / Account</label>
                      <SalesPicker
                        value={editFormData.sales_name}
                        users={salesGuestUsers}
                        onChange={(name, div, userId) => setEditFormData(p => ({ ...p, sales_name: name, sales_division: div || p.sales_division, sales_user_id: userId }))}
                        triggerClassName="border-2 border-gray-200 rounded-xl px-3 py-2.5 bg-white"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Target Selesai — semua role termasuk Guest bisa ubah */}
              <div className="bg-white/95 rounded-2xl p-5 border-2 border-gray-200 shadow-sm">
                <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 shrink-0 bg-teal-500 text-white rounded-lg flex items-center justify-center text-xs shadow"><Ikon nama="📅" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                  Target Selesai
                </h3>
                <div>
                  <label htmlFor="f-form-require-project-page-5" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Target Selesai</label>
                  <input id="f-form-require-project-page-5" type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 focus:border-amber-400 transition-all text-sm bg-white outline-none cursor-pointer"
                    style={{ color: editDueDate ? '#374151' : '#9ca3af' }} />
                  {editDueDate && (
                    <p className="text-xs text-teal-700 font-semibold mt-1.5">
                      <IkonTeks nama="📅" />Target: {new Date(editDueDate + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  )}
                </div>
              </div>

              {/* Tab per ruangan - Ruangan 1 = kolom request, Ruangan 2+ = rooms[] */}
              <div className="sticky top-0 z-10 bg-gray-50 pb-1">
                <div className="flex items-center bg-amber-50 border border-amber-200 rounded-2xl px-2 py-1.5 gap-1 overflow-x-auto">
                  <button aria-label="Sebelumnya" type="button" onClick={() => setEditRoomIdx(i => Math.max(0, i - 1))} disabled={editRoomIdx === 0}
                    className="p-1.5 rounded-lg text-amber-700 hover:bg-amber-100 disabled:opacity-30 transition-all flex-shrink-0">
                    <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7"/></svg>
                  </button>
                  {Array.from({ length: 1 + editRooms.length }).map((_, i) => {
                    const label = i === 0 ? namaRuangan(editFormData, 1) : namaRuangan(editRooms[i - 1], i + 1);
                    const baruDitambah = i > 0 && editNewRoomIds.includes(editRooms[i - 1].id);
                    return (
                      <button key={i} type="button" onClick={() => setEditRoomIdx(i)}
                        className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${editRoomIdx === i ? 'bg-amber-500 text-white shadow' : 'text-amber-800 hover:bg-amber-100'}`}>
                        {label}
                        {baruDitambah && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${editRoomIdx === i ? 'bg-white/25 text-white' : 'bg-amber-200 text-amber-800'}`}>baru</span>}
                      </button>
                    );
                  })}
                  <button aria-label="Berikutnya" type="button" onClick={() => setEditRoomIdx(i => Math.min(editRooms.length, i + 1))} disabled={editRoomIdx === editRooms.length}
                    className="p-1.5 rounded-lg text-amber-700 hover:bg-amber-100 disabled:opacity-30 transition-all flex-shrink-0">
                    <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7"/></svg>
                  </button>
                  <button type="button" onClick={handleEditAddRoom}
                    className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-teal-500 text-white text-xs font-bold hover:bg-teal-600 transition-all whitespace-nowrap ml-1">
                    + Ruangan Lain
                  </button>
                  <span className="text-[11px] text-amber-700 font-bold ml-auto mr-1 flex-shrink-0">{editRoomIdx + 1}/{1 + editRooms.length}</span>
                  {editRoomAktifBaru && (
                    <button aria-label="Hapus ruangan baru" title="Hapus ruangan baru ini" type="button" onClick={handleEditRemoveNewRoom}
                      className="flex-shrink-0 p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 transition-all">
                      <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-white/95 rounded-2xl p-5 border-2 border-gray-200 shadow-sm">
                <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 shrink-0 bg-amber-500 text-white rounded-lg flex items-center justify-center text-xs shadow">🛋️</span>
                  Ruangan {editRoomIdx + 1}
                </h3>
                <label htmlFor="f-form-require-project-page-6" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Nama Ruangan</label>
                <input id="f-form-require-project-page-6" value={editCur.room_name} onChange={e => editUpd({ room_name: e.target.value })}
                  placeholder="Nama ruangan / area" className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-amber-400 outline-none bg-white" />
                {editRoomAktifBaru && selectedRequest.status !== 'pending' && (
                  <p className="text-xs text-amber-700 font-semibold mt-2">Ruangan baru ini akan berstatus Pending dan perlu di-approve admin.</p>
                )}
              </div>

              <div className="bg-white/95 rounded-2xl p-5 border-2 border-gray-200 shadow-sm">
                <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 shrink-0 bg-amber-500 text-white rounded-lg flex items-center justify-center text-xs shadow"><Ikon nama="🎯" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                  Kategori Kebutuhan & Solution
                </h3>
                <CheckGroup label="Kebutuhan" options={['Signage', 'Immersive', 'Meeting Room', 'Mapping', 'Command Center', 'Hybrid Classroom']}
                  value={editCur.kebutuhan} onChange={v => editUpd({ kebutuhan: v })} />
                <div className="mb-4">
                  <label htmlFor="f-form-require-project-page-7" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Other Kebutuhan</label>
                  <input id="f-form-require-project-page-7" value={editCur.kebutuhan_other} onChange={e => editUpd({ kebutuhan_other: e.target.value })}
                    placeholder="Tuliskan jika ada..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-amber-400 outline-none bg-white" />
                </div>
                <CheckGroup label="Solution Product" options={['Videowall', 'Signage Display', 'Videotron', 'Projector', 'Kiosk', 'IFP']}
                  value={editCur.solution_product} onChange={v => editUpd({ solution_product: v })} />
                <div>
                  <label htmlFor="f-form-require-project-page-8" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Other Solution</label>
                  <input id="f-form-require-project-page-8" value={editCur.solution_other} onChange={e => editUpd({ solution_other: e.target.value })}
                    placeholder="Tuliskan jika ada..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-amber-400 outline-none bg-white" />
                </div>
              </div>

              {editCur.kebutuhan.includes('Signage') && (
              <div className="bg-white/95 rounded-2xl p-5 border-2 border-gray-200 shadow-sm">
                <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 shrink-0 bg-amber-500 text-white rounded-lg flex items-center justify-center text-xs shadow">📺</span>
                  Layout Konten & Jaringan
                </h3>
                <RadioGroup label="Layout Signage" options={['Single Zone', 'Multi Zone', 'Full Screen', 'Custom Layout']}
                  value={editCur.layout_signage?.[0] || ''} onChange={v => editUpd({ layout_signage: v ? [v] : [] })} />
                <CheckGroup label="Jaringan / CMS" options={['Offline', 'Online LAN', 'Online WiFi', 'Cloud CMS', 'Local CMS']}
                  value={editCur.jaringan_cms} onChange={v => editUpd({ jaringan_cms: v })} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <div>
                    <label htmlFor="f-form-require-project-page-9" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Input</label>
                    <input id="f-form-require-project-page-9" value={editCur.jumlah_input} onChange={e => editUpd({ jumlah_input: e.target.value })}
                      placeholder="e.g. 4 input" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-amber-400 outline-none bg-white" />
                  </div>
                  <div>
                    <label htmlFor="f-form-require-project-page-10" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Output</label>
                    <input id="f-form-require-project-page-10" value={editCur.jumlah_output} onChange={e => editUpd({ jumlah_output: e.target.value })}
                      placeholder="e.g. 2 output" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-amber-400 outline-none bg-white" />
                  </div>
                </div>
              </div>
              )}

              <div className="bg-white/95 rounded-2xl p-5 border-2 border-gray-200 shadow-sm">
                <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 shrink-0 bg-amber-500 text-white rounded-lg flex items-center justify-center text-xs shadow"><Ikon nama="🔌" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                  Source & Peripheral
                </h3>
                <CheckGroup label="Source" options={['PC / Mini PC', 'Laptop', 'URL Dashboard', 'NVR CCTV', 'Media Player', 'IPTV', 'Set Top Box']}
                  value={editCur.source} onChange={v => editUpd({ source: v })} />
                <div className="mb-4">
                  <label htmlFor="f-form-require-project-page-11" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Other Source</label>
                  <input id="f-form-require-project-page-11" value={editCur.source_other} onChange={e => editUpd({ source_other: e.target.value })}
                    placeholder="Tuliskan jika ada..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-amber-400 outline-none bg-white" />
                </div>

                <RadioGroup label="Camera Conference" options={['Yes', 'No']} value={editCur.camera_conference}
                  onChange={v => editUpd({ camera_conference: v })} />
                {editCur.camera_conference === 'Yes' && (
                  <div className="ml-4 mb-4 space-y-3 border-l-2 border-amber-200 pl-4">
                    <div>
                      <label htmlFor="f-form-require-project-page-12" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Camera</label>
                      <input id="f-form-require-project-page-12" value={editCur.camera_jumlah} onChange={e => editUpd({ camera_jumlah: e.target.value })}
                        placeholder="e.g. 2 unit" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-amber-400 outline-none bg-white" />
                    </div>
                    <CheckGroup label="Camera Tracking" options={['Auto Tracking', 'Manual PTZ', 'Fixed']}
                      value={editCur.camera_tracking} onChange={v => editUpd({ camera_tracking: v })} />
                  </div>
                )}

                <RadioGroup label="Audio System" options={['Yes', 'No']} value={editCur.audio_system}
                  onChange={v => editUpd({ audio_system: v })} />
                {editCur.audio_system === 'Yes' && (
                  <div className="ml-4 mb-4 space-y-3 border-l-2 border-amber-200 pl-4">
                    <div>
                      <label htmlFor="f-form-require-project-page-13" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Mixer / DSP</label>
                      <input id="f-form-require-project-page-13" value={editCur.audio_mixer} onChange={e => editUpd({ audio_mixer: e.target.value })}
                        placeholder="e.g. Yamaha QL1, QSC, etc." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-amber-400 outline-none bg-white" />
                    </div>
                    <CheckGroup label="Audio Detail" options={['Speaker Ceiling', 'Speaker Line Array', 'Subwoofer', 'Microphone', 'Amplifier']}
                      value={editCur.audio_detail} onChange={v => editUpd({ audio_detail: v })} />
                  </div>
                )}

                <RadioGroup label="Wallplate Input" options={['Yes', 'No']} value={editCur.wallplate_input}
                  onChange={v => editUpd({ wallplate_input: v })} />
                {editCur.wallplate_input === 'Yes' && (
                  <div className="ml-4 mb-4 border-l-2 border-amber-200 pl-4">
                    <label htmlFor="f-form-require-project-page-14" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Wallplate</label>
                    <input id="f-form-require-project-page-14" value={editCur.wallplate_jumlah} onChange={e => editUpd({ wallplate_jumlah: e.target.value })}
                      placeholder="e.g. 3 unit" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-amber-400 outline-none bg-white" />
                  </div>
                )}

                <RadioGroup label="Tabletop Input" options={['Yes', 'No']} value={editCur.tabletop_input}
                  onChange={v => editUpd({ tabletop_input: v })} />
                {editCur.tabletop_input === 'Yes' && (
                  <div className="ml-4 mb-4 border-l-2 border-amber-200 pl-4">
                    <label htmlFor="f-form-require-project-page-15" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Tabletop</label>
                    <input id="f-form-require-project-page-15" value={editCur.tabletop_jumlah} onChange={e => editUpd({ tabletop_jumlah: e.target.value })}
                      placeholder="e.g. 2 unit" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-amber-400 outline-none bg-white" />
                  </div>
                )}

                <RadioGroup label="Wireless Presentation" options={['Yes', 'No']} value={editCur.wireless_presentation}
                  onChange={v => editUpd({ wireless_presentation: v })} />
                {editCur.wireless_presentation === 'Yes' && (
                  <div className="ml-4 mb-4 space-y-3 border-l-2 border-amber-200 pl-4">
                    <CheckGroup label="Wireless Mode" options={['Aplikasi', 'AirPlay', 'Miracast', 'Chromecast', 'BYOM']}
                      value={editCur.wireless_mode} onChange={v => editUpd({ wireless_mode: v })} />
                    <RadioGroup label="Dongle" options={['Yes', 'No']} value={editCur.wireless_dongle}
                      onChange={v => editUpd({ wireless_dongle: v })} />
                  </div>
                )}

                <RadioGroup label="Controller / Automation" options={['Yes', 'No']} value={editCur.controller_automation}
                  onChange={v => editUpd({ controller_automation: v })} />
                {editCur.controller_automation === 'Yes' && (
                  <div className="ml-4 mb-4 border-l-2 border-amber-200 pl-4">
                    <RadioGroup label="Controller Type" options={['Cue', 'Wyrestorm', 'Extron', 'Custom']}
                      value={editCur.controller_type?.[0] || ''} onChange={v => editUpd({ controller_type: v ? [v] : [] })} />
                  </div>
                )}
              </div>

              <div className="bg-white/95 rounded-2xl p-5 border-2 border-gray-200 shadow-sm">
                <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 shrink-0 bg-amber-500 text-white rounded-lg flex items-center justify-center text-xs shadow"><Ikon nama="📐" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                  Ruangan & Informasi Lainnya
                </h3>
                <div className="space-y-3">
                  <div>
                    <label htmlFor="f-form-require-project-page-16" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Ukuran Ruangan (P × L × T)</label>
                    <input id="f-form-require-project-page-16" value={editCur.ukuran_ruangan} onChange={e => editUpd({ ukuran_ruangan: e.target.value })}
                      placeholder="e.g. 8m × 6m × 3m" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-amber-400 outline-none bg-white" />
                  </div>
                  <div>
                    <label htmlFor="f-form-require-project-page-17" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Suggest Tampilan (W × H)</label>
                    <input id="f-form-require-project-page-17" value={editCur.suggest_tampilan} onChange={e => editUpd({ suggest_tampilan: e.target.value })}
                      placeholder="e.g. 1920 × 1080 px atau 4K" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-amber-400 outline-none bg-white" />
                  </div>
                  <div>
                    <label htmlFor="f-form-require-project-page-18" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Keterangan Lain</label>
                    <textarea id="f-form-require-project-page-18" value={editCur.keterangan_lain} onChange={e => editUpd({ keterangan_lain: e.target.value })}
                      rows={3} placeholder="Tuliskan informasi tambahan..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-amber-400 outline-none resize-none bg-white" />
                  </div>
                </div>
              </div>
            </div>
            <div className="border-t-2 border-gray-200 p-4 flex gap-3 bg-white/90 flex-shrink-0">
              <button onClick={() => setEditFormModal(false)} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-50">Batal</button>
              <button onClick={handleEditFormSubmit} className="flex-[2] bg-gradient-to-r from-amber-500 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-white py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2">
                <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>
      )}
    </>
  );
}
