'use client';
import { BatalButton, ModalPortal, SubmitFormButton, KepalaModal, LATAR_MODAL, KARTU_MODAL } from '@/components/shared';
import { IkonTeks } from '@/components/shared/Ikon';
import { useRef, useState } from 'react';
import { FormRuanganUtama } from './form-baru/FormRuanganUtama';
import { KolomInfoProyekBaru } from './form-baru/KolomInfoProyekBaru';
import { BrandPicMapping, emptyRoom, RoomDetail, User } from './shared';

// NewFormModal

export type InitialFormType = {
  project_name: string; room_name: string; project_location: string; sales_name: string; sales_division: string;
  kebutuhan: string[]; kebutuhan_other: string;
  solution_product: string[]; solution_other: string;
  layout_signage: string[]; jaringan_cms: string[];
  jumlah_input: string; jumlah_output: string;
  source: string[]; source_other: string;
  camera_conference: string; camera_jumlah: string; camera_tracking: string[];
  audio_system: string; audio_mixer: string; audio_detail: string[];
  wallplate_input: string; wallplate_jumlah: string;
  tabletop_input: string; tabletop_jumlah: string;
  wireless_presentation: string; wireless_mode: string[]; wireless_dongle: string;
  controller_automation: string; controller_type: string[];
  ukuran_ruangan: string; suggest_tampilan: string; keterangan_lain: string;
  brand_display: string; brand_display_pic_id: string; brand_display_pic_name: string;
  /**
   * Display KEDUA - satu ruangan bisa memakai dua produk display dari brand
   * berbeda, dan tiap brand punya PIC-nya sendiri. Tanpa slot kedua, brand
   * yang satunya hanya bisa dititipkan di kolom keterangan dan PIC-nya tidak
   * pernah ikut ter-mapping.
   *
   * Opsional: ruangan yang dibuat sebelum kolom ini ada tidak memilikinya.
   * Rooms disimpan sebagai JSONB, jadi tidak perlu migrasi basis data.
   */
  brand_display_2?: string; brand_display_2_pic_id?: string; brand_display_2_pic_name?: string;
  brand_middleware: string; brand_middleware_pic_id: string; brand_middleware_pic_name: string;
  source_laptop_qty: string; source_pc_qty: string;
  brand?: string; // Marketing Brand: 'MVI' | 'IVP' | 'BOTH' - Sales External pilih (routing Sales Internal)
};

export interface NewFormModalProps {
  currentUser: User;
  form: InitialFormType;
  setForm: React.Dispatch<React.SetStateAction<InitialFormType>>;
  initialForm: InitialFormType;
  dueDateForm: string;
  setDueDateForm: React.Dispatch<React.SetStateAction<string>>;
  surveyPhotos: File[];
  setSurveyPhotos: React.Dispatch<React.SetStateAction<File[]>>;
  surveyPhotosPreviews: string[];
  setSurveyPhotosPreviews: React.Dispatch<React.SetStateAction<string[]>>;
  boqFormFile: File | null;
  setBoqFormFile: React.Dispatch<React.SetStateAction<File | null>>;
  submitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
  salesGuestUsers: {id:string;full_name:string;username:string;sales_division?:string;is_internal_sales?:boolean}[];
  isInternalSalesGuest?: boolean; // creator = Sales Internal (guest)  tampilkan field SBU
  rooms: RoomDetail[];
  setRooms: React.Dispatch<React.SetStateAction<RoomDetail[]>>;
  brandPicMappings: BrandPicMapping[];
  roomPhotoMap: Record<string, File[]>;
  setRoomPhotoMap: React.Dispatch<React.SetStateAction<Record<string, File[]>>>;
  boqRoomMap: Record<string, File | null>;
  setBoqRoomMap: React.Dispatch<React.SetStateAction<Record<string, File | null>>>;
}

export function NewFormModal({
  currentUser, form, setForm, initialForm, dueDateForm, setDueDateForm,
  surveyPhotos, setSurveyPhotos, surveyPhotosPreviews, setSurveyPhotosPreviews,
  boqFormFile, setBoqFormFile,
  submitting, onClose, onSubmit,
  salesGuestUsers, isInternalSalesGuest = false, rooms, setRooms, brandPicMappings, roomPhotoMap, setRoomPhotoMap,
  boqRoomMap, setBoqRoomMap,
}: NewFormModalProps) {
  const surveyPhotoRef = useRef<HTMLInputElement>(null);
  const boqFormRef = useRef<HTMLInputElement>(null);
  const boqRoom1Ref = useRef<HTMLInputElement>(null);

  const toggleArr = (arr: string[], val: string): string[] =>
    arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];

  // Active room tab index for navigation (0 = Ruangan 1 / main form)
  const [activeRoomIdx, setActiveRoomIdx] = useState(0);
  const totalRooms = 1 + rooms.length; // main room + extra rooms
  const goLeft = () => setActiveRoomIdx(i => Math.max(0, i - 1));
  const goRight = () => setActiveRoomIdx(i => Math.min(totalRooms - 1, i + 1));
  const addAndGoToRoom = () => {
    setRooms(p => [...p, emptyRoom()]);
    setActiveRoomIdx(1 + rooms.length); // go to new room
  };

  const CheckGroup = ({ label, options, value, onChange }: { label: string; options: string[]; value: string[]; onChange: (v: string[]) => void }) => (
    <div className="mb-4">
      <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => {
          const checked = value.includes(opt);
          return (
            <button key={opt} type="button" onClick={() => onChange(toggleArr(value, opt))}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${checked ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300 hover:bg-teal-50/50'}`}>
              <div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center shrink-0 transition-all ${checked ? 'border-teal-500 bg-teal-500' : 'border-gray-400'}`}>
                {checked && <svg aria-hidden="true" focusable="false" className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </div>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );

  const RadioGroup = ({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) => (
    <div className="mb-4">
      <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button key={opt} type="button" onClick={() => onChange(opt)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${value === opt ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300'}`}>
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${value === opt ? 'border-teal-500' : 'border-gray-400'}`}>
              {value === opt && <div className="w-2 h-2 rounded-full bg-teal-500" />}
            </div>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );

  return (
  <ModalPortal>
    <div role="dialog" aria-modal="true" className="fixed inset-0 flex items-center justify-center z-1100 p-4" style={LATAR_MODAL}>
      {/*  Kartu, kepala & tombol baku (components/shared/Modal.tsx) - dulu kepala bergradasi teal sendiri. */}
      <div className={`${KARTU_MODAL} w-full max-w-[1500px] h-full max-h-full flex flex-col overflow-hidden`}>
        <KepalaModal judul="Form Equipment Request — IVP & MVI" keterangan={<>Requester: <span className="font-bold">{currentUser.full_name}</span></>} onTutup={onClose} />

        {/* Dua kolom, BUKAN tiga seperti form lain — pembagiannya mengikuti
            isinya, bukan angka. Konfigurator ruangan di kanan berisi tab per
            ruangan dengan puluhan isian perangkat; dipaksa selebar sepertiga
            layar, tab-nya berdesakan dan justru lebih sulit dipakai daripada
            saat harus digulir. Info project yang ringkas cukup di kolom kiri. */}
        <div className="flex-1 min-h-0 overflow-y-auto satulayar:overflow-hidden bg-gray-50">
          <div className="p-5 grid grid-cols-1 satulayar:grid-cols-3 gap-4 satulayar:h-full satulayar:overflow-hidden">

          <KolomInfoProyekBaru
            currentUser={currentUser} dueDateForm={dueDateForm} form={form} isInternalSalesGuest={isInternalSalesGuest} salesGuestUsers={salesGuestUsers} setDueDateForm={setDueDateForm} setForm={setForm}
          />

          <div className="satulayar:col-span-2 space-y-4 satulayar:overflow-y-auto satulayar:pr-1 satulayar:min-h-0">
          {/* ── Room Tab Navigator ── */}
          <div className="bg-white/95 rounded-2xl border-2 border-teal-200 shadow-xs overflow-hidden">
            {/* Tab bar */}
            <div className="flex items-center bg-teal-50 border-b border-teal-200 px-2 py-1.5 gap-1 overflow-x-auto">
              <button aria-label="Sebelumnya" type="button" onClick={goLeft} disabled={activeRoomIdx === 0}
                className="p-1.5 rounded-lg text-teal-700 hover:bg-teal-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0">
                <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7"/></svg>
              </button>
              {Array.from({length: totalRooms}).map((_, i) => {
                const label = i === 0 ? (form.room_name.trim() || 'Ruangan 1') : (rooms[i-1]?.room_name?.trim() || `Ruangan ${i+1}`);
                const isActive = activeRoomIdx === i;
                return (
                  <button key={i} type="button" onClick={() => setActiveRoomIdx(i)}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isActive ? 'bg-teal-600 text-white shadow-sm' : 'text-teal-700 hover:bg-teal-100'}`}>
                    {label}
                  </button>
                );
              })}
              <button aria-label="Berikutnya" type="button" onClick={goRight} disabled={activeRoomIdx === totalRooms - 1}
                className="p-1.5 rounded-lg text-teal-700 hover:bg-teal-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0">
                <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7"/></svg>
              </button>
              <button type="button" onClick={addAndGoToRoom}
                className="shrink-0 px-3 py-1.5 rounded-xl bg-teal-500 text-white text-xs font-bold hover:bg-teal-600 transition-all whitespace-nowrap ml-1">
                + Ruangan Lain
              </button>
              {/* Pendorong ini hanya dipakai saat barisnya memang muat. Di ponsel
                  ia mendorong penghitung ruangan keluar dari bagian yang terlihat. */}
              <div className="hidden sm:block flex-1"/>
              <span className="text-[11px] text-teal-700 font-bold mr-1">{activeRoomIdx+1}/{totalRooms}</span>
              {activeRoomIdx > 0 && (
                <button aria-label="Tutup" type="button" onClick={() => { setRooms(p => p.filter((_,i)=>i!==activeRoomIdx-1)); setActiveRoomIdx(a=>Math.max(0,a-1)); }}
                  className="shrink-0 p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 transition-all">
                  <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              )}
            </div>

            {/* Content — 2 columns */}
            <div className="p-5">
              <FormRuanganUtama
                activeRoomIdx={activeRoomIdx} boqFormFile={boqFormFile} boqRoom1Ref={boqRoom1Ref} boqRoomMap={boqRoomMap} brandPicMappings={brandPicMappings} currentUser={currentUser} form={form} roomPhotoMap={roomPhotoMap} rooms={rooms} setActiveRoomIdx={setActiveRoomIdx} setBoqFormFile={setBoqFormFile} setBoqRoomMap={setBoqRoomMap} setForm={setForm} setRoomPhotoMap={setRoomPhotoMap} setRooms={setRooms} setSurveyPhotos={setSurveyPhotos} setSurveyPhotosPreviews={setSurveyPhotosPreviews} surveyPhotoRef={surveyPhotoRef} surveyPhotos={surveyPhotos} surveyPhotosPreviews={surveyPhotosPreviews} toggleArr={toggleArr}
              />
            </div>
          </div>



          </div>
          </div>
        </div>

        <div className="border-t border-gray-200 px-4 py-3 flex gap-2 justify-end bg-white/90 shrink-0">
          <BatalButton onClick={onClose} />
          <SubmitFormButton onClick={onSubmit} loading={submitting}
            />
        </div>
      </div>
    </div>
  </ModalPortal>
  );
}
export * from './Modals-AssignPTSModal';
export * from './Modals-RoomSection';
