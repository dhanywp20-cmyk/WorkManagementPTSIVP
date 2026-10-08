'use client';

/** FormRuanganUtama - dipecah dari app/(portal)/form-require-project/_components/Modals.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { User, RoomDetail, BrandPicMapping, DISPLAY_BRANDS, MIDDLEWARE_BRANDS } from '../shared';
import { RoomSection, type InitialFormType } from '../Modals';

export interface FormRuanganUtamaProps {
  activeRoomIdx: number;
  boqFormFile: File | null;
  boqRoom1Ref: import("react").RefObject<HTMLInputElement | null>;
  boqRoomMap: Record<string, File | null>;
  brandPicMappings: BrandPicMapping[];
  currentUser: User;
  form: InitialFormType;
  roomPhotoMap: Record<string, File[]>;
  rooms: RoomDetail[];
  setActiveRoomIdx: import("react").Dispatch<import("react").SetStateAction<number>>;
  setBoqFormFile: import("react").Dispatch<import("react").SetStateAction<File | null>>;
  setBoqRoomMap: import("react").Dispatch<import("react").SetStateAction<Record<string, File | null>>>;
  setForm: import("react").Dispatch<import("react").SetStateAction<InitialFormType>>;
  setRoomPhotoMap: import("react").Dispatch<import("react").SetStateAction<Record<string, File[]>>>;
  setRooms: import("react").Dispatch<import("react").SetStateAction<RoomDetail[]>>;
  setSurveyPhotos: import("react").Dispatch<import("react").SetStateAction<File[]>>;
  setSurveyPhotosPreviews: import("react").Dispatch<import("react").SetStateAction<string[]>>;
  surveyPhotoRef: import("react").RefObject<HTMLInputElement | null>;
  surveyPhotos: File[];
  surveyPhotosPreviews: string[];
  toggleArr: (arr: string[], val: string) => string[];
}

export function FormRuanganUtama({ activeRoomIdx, boqFormFile, boqRoom1Ref, boqRoomMap, brandPicMappings, currentUser, form, roomPhotoMap, rooms, setActiveRoomIdx, setBoqFormFile, setBoqRoomMap, setForm, setRoomPhotoMap, setRooms, setSurveyPhotos, setSurveyPhotosPreviews, surveyPhotoRef, surveyPhotos, surveyPhotosPreviews, toggleArr }: FormRuanganUtamaProps) {
  return (
    <>
      {activeRoomIdx === 0 ? (
        /* Ruangan 1 (main form) - same style as RoomSection */
        <>
        {/* Nama Ruangan 1 */}
        <div className="flex items-center gap-2 mb-4 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl">
          <span className="text-xs font-black text-teal-700 flex-shrink-0">Ruangan 1</span>
          <input value={form.room_name} onChange={e => setForm(prev => ({ ...prev, room_name: e.target.value }))}
            placeholder="Nama ruangan / area..."
            className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm font-medium bg-white outline-none focus:border-teal-400" />
        </div>

        {/* Kebutuhan */}
        <div className="mb-4">
          <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">Kebutuhan *</label>
          <div className="flex flex-wrap gap-2">
            {['Signage','Immersive','Meeting Room','Mapping','Command Center','Hybrid Classroom'].map(opt => {
              const active = form.kebutuhan[0] === opt;
              return <button aria-pressed={active} key={opt} type="button" onClick={() => setForm(prev => ({ ...prev, kebutuhan: active ? [] : [opt] }))}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${active ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300 hover:bg-teal-50/50'}`}>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${active ? 'border-teal-500' : 'border-gray-400'}`}>{active && <div className="w-2 h-2 rounded-full bg-teal-500" />}</div>
                {opt}
              </button>;
            })}
          </div>
        </div>
        <div className="mb-4">
          <input value={form.kebutuhan_other} onChange={e => setForm(prev => ({ ...prev, kebutuhan_other: e.target.value }))}
            placeholder="Other kebutuhan..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-teal-400 bg-white outline-none" />
        </div>

        {/* Solution Product */}
        <div className="mb-4">
          <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">Solution Product *</label>
          <div className="flex flex-wrap gap-2">
            {['Videowall','Signage Display','Videotron','Projector','Kiosk','IFP'].map(opt => {
              const active = form.solution_product.includes(opt);
              return <button aria-pressed={active} key={opt} type="button" onClick={() => setForm(prev => ({ ...prev, solution_product: active ? prev.solution_product.filter(x=>x!==opt) : [...prev.solution_product,opt] }))}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${active ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300 hover:bg-teal-50/50'}`}>
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${active ? 'border-teal-500 bg-teal-500' : 'border-gray-400'}`}>{active && <svg aria-hidden="true" focusable="false" className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}</div>
                {opt}
              </button>;
            })}
          </div>
        </div>
        <div className="mb-4">
          <input value={form.solution_other} onChange={e => setForm(prev => ({ ...prev, solution_other: e.target.value }))}
            placeholder="Other solution..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-teal-400 bg-white outline-none" />
        </div>

        {/* Brand Display 1 & 2 + Middleware — kembar dari RoomSection di atas. */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 pt-2 border-t border-gray-100">
          <div>
            <label htmlFor="f-form-require-project-components-modals-19" className="block text-[11px] font-bold text-amber-700 uppercase tracking-widest mb-1.5"><IkonTeks nama="🖥" />Brand Display <span className="text-gray-500 font-normal">(opsional)</span></label>
            <select id="f-form-require-project-components-modals-19" value={form.brand_display||''} onChange={e => {
              const brand = e.target.value;
              const pic = brandPicMappings.find(m => m.brand_type==='display' && m.brand_name===brand);
              setForm(prev => ({...prev, brand_display:brand, brand_display_pic_id:pic?.pic_user_id||'', brand_display_pic_name:pic?.pic_user_name||''}));
            }} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-amber-400 appearance-none">
              <option value="">— Pilih Brand Display —</option>
              {DISPLAY_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            {form.brand_display && form.brand_display_pic_name && <p className="mt-1 text-[11px] text-amber-700 font-semibold bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1"><IkonTeks nama="👤" />PIC: {form.brand_display_pic_name}</p>}
            {form.brand_display && !form.brand_display_pic_name && <p className="mt-1 text-[11px] text-gray-500 italic">PIC belum di-set admin</p>}
          </div>
        <div>
          <label htmlFor="f-form-require-project-components-modals-20" className="block text-[11px] font-bold text-amber-700 uppercase tracking-widest mb-1.5"><IkonTeks nama="🖥" />Brand Display 2 <span className="text-gray-500 normal-case font-normal">(opsional)</span></label>
          <select id="f-form-require-project-components-modals-20" value={form.brand_display_2||''} onChange={e => {
            const brand = e.target.value;
            const pic = brandPicMappings.find(m => m.brand_type==='display' && m.brand_name===brand);
            setForm(prev => ({...prev, brand_display_2:brand, brand_display_2_pic_id:pic?.pic_user_id||'', brand_display_2_pic_name:pic?.pic_user_name||''}));
          }} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-amber-400">
            <option value="">— Pilih Brand Display 2 —</option>
            {DISPLAY_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          {form.brand_display_2 && form.brand_display_2_pic_name && <p className="mt-1 text-[11px] text-amber-700 font-semibold bg-amber-50 border border-amber-200 rounded px-2 py-1"><IkonTeks nama="👤" />PIC: {form.brand_display_2_pic_name}</p>}
          {form.brand_display_2 && !form.brand_display_2_pic_name && <p className="mt-1 text-[11px] text-gray-500 italic">PIC belum di-mapping</p>}
        </div>
          <div>
            <label htmlFor="f-form-require-project-components-modals-21" className="block text-[11px] font-bold text-violet-600 uppercase tracking-widest mb-1.5"><IkonTeks nama="🔌" />Brand Middleware <span className="text-gray-500 font-normal">(opsional)</span></label>
            <select id="f-form-require-project-components-modals-21" value={form.brand_middleware||''} onChange={e => {
              const brand = e.target.value;
              const pic = brandPicMappings.find(m => m.brand_type==='middleware' && m.brand_name===brand);
              setForm(prev => ({...prev, brand_middleware:brand, brand_middleware_pic_id:pic?.pic_user_id||'', brand_middleware_pic_name:pic?.pic_user_name||''}));
            }} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-violet-400 appearance-none">
              <option value="">— Pilih Brand Middleware —</option>
              {MIDDLEWARE_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            {form.brand_middleware && form.brand_middleware_pic_name && <p className="mt-1 text-[11px] text-violet-700 font-semibold bg-violet-50 border border-violet-200 rounded-lg px-2.5 py-1"><IkonTeks nama="👤" />PIC: {form.brand_middleware_pic_name}</p>}
            {form.brand_middleware && !form.brand_middleware_pic_name && <p className="mt-1 text-[11px] text-gray-500 italic">PIC belum di-set admin</p>}
          </div>
        </div>

        {/* Layout Signage — only if Signage */}
        {form.kebutuhan.includes('Signage') && (
          <div className="mb-4 pt-2 border-t border-gray-100">
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">Layout Signage</label>
              <div className="flex flex-wrap gap-2">
                {['Single Zone','Multi Zone','Full Screen','Custom Layout'].map(opt => {
                  const active = form.layout_signage[0] === opt;
                  return <button aria-pressed={active} key={opt} type="button" onClick={() => setForm(prev => ({ ...prev, layout_signage: active ? [] : [opt] }))}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${active ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300'}`}>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${active ? 'border-teal-500' : 'border-gray-400'}`}>{active && <div className="w-2 h-2 rounded-full bg-teal-500" />}</div>
                    {opt}
                  </button>;
                })}
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">Jaringan / CMS</label>
              <div className="flex flex-wrap gap-2">
                {['Cloud','Onpremise','USB'].map(opt => {
                  const active = form.jaringan_cms.includes(opt);
                  return <button aria-pressed={active} key={opt} type="button" onClick={() => setForm(prev => ({ ...prev, jaringan_cms: active ? prev.jaringan_cms.filter(x=>x!==opt) : [...prev.jaringan_cms,opt] }))}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${active ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300 hover:bg-teal-50/50'}`}>
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${active ? 'border-teal-500 bg-teal-500' : 'border-gray-400'}`}>{active && <svg aria-hidden="true" focusable="false" className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}</div>
                    {opt}
                  </button>;
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label htmlFor="f-form-require-project-components-modals-22" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Input</label><input id="f-form-require-project-components-modals-22" value={form.jumlah_input} onChange={e => setForm(prev => ({...prev, jumlah_input: e.target.value}))} placeholder="e.g. 4" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400"/></div>
              <div><label htmlFor="f-form-require-project-components-modals-23" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Output</label><input id="f-form-require-project-components-modals-23" value={form.jumlah_output} onChange={e => setForm(prev => ({...prev, jumlah_output: e.target.value}))} placeholder="e.g. 2" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400"/></div>
            </div>
          </div>
        )}

        {/* Source */}
        <div className="mb-4 pt-2 border-t border-gray-100">
          <div className="mb-4">
            <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">Source</label>
            <div className="flex flex-wrap gap-2">
              {['PC / Mini PC','Laptop','URL Dashboard','NVR CCTV','Media Player','IPTV','Set Top Box'].map(opt => {
                const active = form.source.includes(opt);
                return <button aria-pressed={active} key={opt} type="button" onClick={() => setForm(prev => ({ ...prev, source: active ? prev.source.filter(x=>x!==opt) : [...prev.source,opt] }))}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${active ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300 hover:bg-teal-50/50'}`}>
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${active ? 'border-teal-500 bg-teal-500' : 'border-gray-400'}`}>{active && <svg aria-hidden="true" focusable="false" className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}</div>
                  {opt}
                </button>;
              })}
            </div>
          </div>
          <div className="flex gap-3 mb-3">
            {form.source.includes('Laptop') && <div className="flex-1 min-w-0"><label htmlFor="f-form-require-project-components-modals-24" className="block text-[11px] font-bold text-amber-700 uppercase tracking-widest mb-1">Qty Laptop</label><input id="f-form-require-project-components-modals-24" type="number" min="1" value={(form as any).source_laptop_qty||''} onChange={e=>setForm(prev=>({...prev, source_laptop_qty:e.target.value} as any))} placeholder="1" className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm bg-amber-50 outline-none focus:border-amber-400"/></div>}
            {form.source.includes('PC / Mini PC') && <div className="flex-1 min-w-0"><label htmlFor="f-form-require-project-components-modals-25" className="block text-[11px] font-bold text-blue-600 uppercase tracking-widest mb-1">Qty PC</label><input id="f-form-require-project-components-modals-25" type="number" min="1" value={(form as any).source_pc_qty||''} onChange={e=>setForm(prev=>({...prev, source_pc_qty:e.target.value} as any))} placeholder="1" className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm bg-blue-50 outline-none focus:border-blue-400"/></div>}
          </div>
          <input value={form.source_other} onChange={e => setForm(prev => ({ ...prev, source_other: e.target.value }))}
            placeholder="Other source..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400" />
        </div>

        {/* Camera + Audio — 2 kolom.
            Blok ini DUPLIKAT dari RoomSection di atas: form ruangan ditulis
            dua kali — inline untuk Ruangan 1 (terikat `form`), dan sebagai
            komponen untuk ruangan ke-2 dst (terikat `rooms[i]`). Perubahan
            tata letak WAJIB dikerjakan di keduanya, kalau tidak yang berubah
            hanya ruangan yang jarang dibuka. */}
        <div className="mb-4 pt-2 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
        <div>
          <div className="mb-4">
            <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">Camera Conference</label>
            <div className="flex flex-wrap gap-2">
              {['Yes','No'].map(opt => <button key={opt} type="button" onClick={() => setForm(prev => ({ ...prev, camera_conference: opt }))}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${form.camera_conference === opt ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300'}`}>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${form.camera_conference === opt ? 'border-teal-500' : 'border-gray-400'}`}>{form.camera_conference === opt && <div className="w-2 h-2 rounded-full bg-teal-500" />}</div>
                {opt}
              </button>)}
            </div>
          </div>
          {form.camera_conference === 'Yes' && <div className="ml-4 mb-4 space-y-3 border-l-2 border-teal-200 pl-4">
            <div><label htmlFor="f-form-require-project-components-modals-26" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Camera</label><input id="f-form-require-project-components-modals-26" value={form.camera_jumlah} onChange={e => setForm(prev => ({ ...prev, camera_jumlah: e.target.value }))} placeholder="e.g. 2 unit" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400"/></div>
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">Tipe Tracking</label>
              <div className="flex flex-wrap gap-2">
                {['Auto Tracking','Manual PTZ','Fixed'].map(opt => {
                  const active = form.camera_tracking.includes(opt);
                  return <button aria-pressed={active} key={opt} type="button" onClick={() => setForm(prev => ({ ...prev, camera_tracking: active ? prev.camera_tracking.filter(x=>x!==opt) : [...prev.camera_tracking,opt] }))}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${active ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300 hover:bg-teal-50/50'}`}>
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${active ? 'border-teal-500 bg-teal-500' : 'border-gray-400'}`}>{active && <svg aria-hidden="true" focusable="false" className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}</div>
                    {opt}
                  </button>;
                })}
              </div>
            </div>
          </div>}
        </div>

        <div>
          <div className="mb-4">
            <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">Audio System</label>
            <div className="flex flex-wrap gap-2">
              {['Yes','No'].map(opt => <button key={opt} type="button" onClick={() => setForm(prev => ({ ...prev, audio_system: opt }))}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${form.audio_system === opt ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300'}`}>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${form.audio_system === opt ? 'border-teal-500' : 'border-gray-400'}`}>{form.audio_system === opt && <div className="w-2 h-2 rounded-full bg-teal-500" />}</div>
                {opt}
              </button>)}
            </div>
          </div>
          {form.audio_system === 'Yes' && <div className="ml-4 mb-4 space-y-3 border-l-2 border-teal-200 pl-4">
            <div><label htmlFor="f-form-require-project-components-modals-27" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Mixer / DSP</label><input id="f-form-require-project-components-modals-27" value={form.audio_mixer} onChange={e => setForm(prev => ({ ...prev, audio_mixer: e.target.value }))} placeholder="e.g. Yamaha QL1, QSC, etc." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400"/></div>
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">Audio Detail</label>
              <div className="flex flex-wrap gap-2">
                {['Speaker Ceiling','Speaker Line Array','Subwoofer','Microphone','Amplifier'].map(opt => {
                  const active = form.audio_detail.includes(opt);
                  return <button aria-pressed={active} key={opt} type="button" onClick={() => setForm(prev => ({ ...prev, audio_detail: active ? prev.audio_detail.filter(x=>x!==opt) : [...prev.audio_detail,opt] }))}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${active ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300 hover:bg-teal-50/50'}`}>
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${active ? 'border-teal-500 bg-teal-500' : 'border-gray-400'}`}>{active && <svg aria-hidden="true" focusable="false" className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}</div>
                    {opt}
                  </button>;
                })}
              </div>
            </div>
          </div>}
        </div>
        </div>

        {/* Wallplate + Tabletop — 2 col */}
        <div className="mb-4 pt-2 border-t border-gray-100 grid grid-cols-2 gap-3">
          <div>
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">Wallplate Input</label>
              <div className="flex flex-wrap gap-2">
                {['Yes','No'].map(opt => <button key={opt} type="button" onClick={() => setForm(prev => ({ ...prev, wallplate_input: opt }))}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${form.wallplate_input === opt ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300'}`}>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${form.wallplate_input === opt ? 'border-teal-500' : 'border-gray-400'}`}>{form.wallplate_input === opt && <div className="w-2 h-2 rounded-full bg-teal-500" />}</div>
                  {opt}
                </button>)}
              </div>
            </div>
            {form.wallplate_input === 'Yes' && <div className="ml-4 border-l-2 border-teal-200 pl-4 mb-4"><label htmlFor="f-form-require-project-components-modals-28" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Wallplate</label><input id="f-form-require-project-components-modals-28" value={form.wallplate_jumlah} onChange={e => setForm(prev => ({ ...prev, wallplate_jumlah: e.target.value }))} placeholder="e.g. 3 unit" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400"/></div>}
          </div>
          <div>
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">Tabletop Input</label>
              <div className="flex flex-wrap gap-2">
                {['Yes','No'].map(opt => <button key={opt} type="button" onClick={() => setForm(prev => ({ ...prev, tabletop_input: opt }))}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${form.tabletop_input === opt ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300'}`}>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${form.tabletop_input === opt ? 'border-teal-500' : 'border-gray-400'}`}>{form.tabletop_input === opt && <div className="w-2 h-2 rounded-full bg-teal-500" />}</div>
                  {opt}
                </button>)}
              </div>
            </div>
            {form.tabletop_input === 'Yes' && <div className="ml-4 border-l-2 border-teal-200 pl-4 mb-4"><label htmlFor="f-form-require-project-components-modals-29" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Tabletop</label><input id="f-form-require-project-components-modals-29" value={form.tabletop_jumlah} onChange={e => setForm(prev => ({ ...prev, tabletop_jumlah: e.target.value }))} placeholder="e.g. 2 unit" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400"/></div>}
          </div>
        </div>

        {/* Wireless + Controller — 2 kolom, sama seperti Camera+Audio. */}
        <div className="mb-4 pt-2 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
        <div>
          <div className="mb-4">
            <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">Wireless Presentation</label>
            <div className="flex flex-wrap gap-2">
              {['Yes','No'].map(opt => <button key={opt} type="button" onClick={() => setForm(prev => ({ ...prev, wireless_presentation: opt }))}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${form.wireless_presentation === opt ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300'}`}>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${form.wireless_presentation === opt ? 'border-teal-500' : 'border-gray-400'}`}>{form.wireless_presentation === opt && <div className="w-2 h-2 rounded-full bg-teal-500" />}</div>
                {opt}
              </button>)}
            </div>
          </div>
          {form.wireless_presentation === 'Yes' && <div className="ml-4 mb-4 space-y-3 border-l-2 border-teal-200 pl-4">
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">Wireless Mode</label>
              <div className="flex flex-wrap gap-2">
                {['Aplikasi','AirPlay','Miracast','Chromecast','BYOM'].map(opt => {
                  const active = form.wireless_mode.includes(opt);
                  return <button aria-pressed={active} key={opt} type="button" onClick={() => setForm(prev => ({ ...prev, wireless_mode: active ? prev.wireless_mode.filter(x=>x!==opt) : [...prev.wireless_mode,opt] }))}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${active ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300 hover:bg-teal-50/50'}`}>
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${active ? 'border-teal-500 bg-teal-500' : 'border-gray-400'}`}>{active && <svg aria-hidden="true" focusable="false" className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}</div>
                    {opt}
                  </button>;
                })}
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">Dongle</label>
              <div className="flex flex-wrap gap-2">
                {['Yes','No'].map(opt => <button key={opt} type="button" onClick={() => setForm(prev => ({ ...prev, wireless_dongle: opt }))}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${form.wireless_dongle === opt ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300'}`}>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${form.wireless_dongle === opt ? 'border-teal-500' : 'border-gray-400'}`}>{form.wireless_dongle === opt && <div className="w-2 h-2 rounded-full bg-teal-500" />}</div>
                  {opt}
                </button>)}
              </div>
            </div>
          </div>}
        </div>

        <div>
          <div className="mb-4">
            <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">Controller / Automation</label>
            <div className="flex flex-wrap gap-2">
              {['Yes','No'].map(opt => <button key={opt} type="button" onClick={() => setForm(prev => ({ ...prev, controller_automation: opt }))}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${form.controller_automation === opt ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300'}`}>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${form.controller_automation === opt ? 'border-teal-500' : 'border-gray-400'}`}>{form.controller_automation === opt && <div className="w-2 h-2 rounded-full bg-teal-500" />}</div>
                {opt}
              </button>)}
            </div>
          </div>
          {form.controller_automation === 'Yes' && <div className="ml-4 mb-4 border-l-2 border-teal-200 pl-4">
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">Controller Type</label>
              <div className="flex flex-wrap gap-2">
                {['Cue','Wyrestorm','Extron','Custom'].map(opt => {
                  const active = form.controller_type.includes(opt);
                  return <button aria-pressed={active} key={opt} type="button" onClick={() => setForm(prev => ({ ...prev, controller_type: active ? prev.controller_type.filter(x=>x!==opt) : [...prev.controller_type,opt] }))}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${active ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300 hover:bg-teal-50/50'}`}>
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${active ? 'border-teal-500 bg-teal-500' : 'border-gray-400'}`}>{active && <svg aria-hidden="true" focusable="false" className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}</div>
                    {opt}
                  </button>;
                })}
              </div>
            </div>
          </div>}
        </div>
        </div>

        {/* Ukuran, Suggest, Keterangan */}
        <div className="mb-4 pt-2 border-t border-gray-100 space-y-3">
          <div><label htmlFor="f-form-require-project-components-modals-30" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Ukuran Ruangan (P×L×T)</label><input id="f-form-require-project-components-modals-30" value={form.ukuran_ruangan} onChange={e=>setForm(p=>({...p,ukuran_ruangan:e.target.value}))} placeholder="e.g. 8m×6m×3m" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400"/></div>
          <div><label htmlFor="f-form-require-project-components-modals-31" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Suggest Tampilan (W×H)</label><input id="f-form-require-project-components-modals-31" value={form.suggest_tampilan} onChange={e=>setForm(p=>({...p,suggest_tampilan:e.target.value}))} placeholder="e.g. 1920×1080 atau 4K" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400"/></div>
          <div><label htmlFor="f-form-require-project-components-modals-32" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Keterangan Lain</label><textarea id="f-form-require-project-components-modals-32" value={form.keterangan_lain} onChange={e=>setForm(p=>({...p,keterangan_lain:e.target.value}))} rows={2} placeholder="Info tambahan..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400 resize-none"/></div>
        </div>

        {/* Foto + BOQ — 2 col, only for non-team */}
        {!['admin','superadmin','team_pts','team'].includes((currentUser?.role || '').toLowerCase().trim()) && (
          <div className="pt-2 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="f-form-require-project-components-modals-33" className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2"><IkonTeks nama="📸" />Foto Survey Ruangan Ini</label>
              <input id="f-form-require-project-components-modals-33" ref={surveyPhotoRef} type="file" accept="image/*" multiple className="hidden"
                onChange={e => { const files = Array.from(e.target.files||[]); if(!files.length) return; const c=[...surveyPhotos,...files].slice(0,10); setSurveyPhotos(c); setSurveyPhotosPreviews(c.map(f=>URL.createObjectURL(f))); e.target.value=''; }} />
              {surveyPhotosPreviews.length === 0 ? (
                <label onClick={() => surveyPhotoRef.current?.click()} className="w-full border-2 border-dashed border-gray-300 rounded-xl py-4 flex flex-col items-center justify-center text-gray-500 hover:border-teal-400 hover:text-teal-500 transition-all cursor-pointer">
                  <span className="text-2xl mb-1"><Ikon nama="📷" ukuran="1em" className="inline-block align-[-0.12em]" /></span><span className="text-xs font-medium">Klik upload foto</span><span className="text-[11px] opacity-70">Max 10 foto</span>
                </label>
              ) : (
                <div>
                  <div className="grid grid-cols-4 gap-1.5 mb-2">
                    {surveyPhotosPreviews.map((src,i) => (
                      <div key={i} className="relative group rounded-lg overflow-hidden aspect-square border border-gray-200">
                        <img src={src} alt="" className="w-full h-full object-cover"/>
                        <button aria-label="Tutup" type="button" onClick={() => { const n=surveyPhotos.filter((_,j)=>j!==i); setSurveyPhotos(n); setSurveyPhotosPreviews(n.map(f=>URL.createObjectURL(f))); }} className="absolute top-0.5 right-0.5 bg-red-500 text-white w-4 h-4 rounded-full text-[11px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                      </div>
                    ))}
                    {surveyPhotos.length < 10 && <button type="button" onClick={() => surveyPhotoRef.current?.click()} className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-500 hover:border-teal-400 cursor-pointer"><span className="text-xl">+</span></button>}
                  </div>
                  <p className="text-[11px] text-gray-500">{surveyPhotos.length}/10 foto</p>
                </div>
              )}
            </div>
            <div>
              <label htmlFor="f-form-require-project-components-modals-34" className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2"><IkonTeks nama="📊" />BOQ Excel Ruangan Ini</label>
              <input id="f-form-require-project-components-modals-34" ref={boqRoom1Ref} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={e => { const f=e.target.files?.[0]; if(f) setBoqFormFile(f); e.target.value=''; }} />
              {!boqFormFile ? (
                <button type="button" onClick={() => boqRoom1Ref.current?.click()}
                  className="w-full border-2 border-dashed border-emerald-300 rounded-xl py-4 flex flex-col items-center justify-center text-emerald-700 hover:border-emerald-500 hover:bg-emerald-50 transition-all cursor-pointer">
                  <span className="text-2xl mb-1"><Ikon nama="📊" ukuran="1em" className="inline-block align-[-0.12em]" /></span><span className="text-xs font-medium">Klik upload BOQ</span><span className="text-[11px] opacity-70">.xlsx / .xls / .csv</span>
                </button>
              ) : (
                <div>
                  <div className="border-2 border-emerald-300 bg-emerald-50 rounded-xl p-3 flex items-center gap-3">
                    <span className="text-xl"><Ikon nama="📊" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                    <div className="flex-1 min-w-0"><p className="text-xs font-bold text-emerald-800 truncate">{boqFormFile.name}</p><p className="text-[11px] text-emerald-700">{(boqFormFile.size/1024).toFixed(1)} KB</p></div>
                    <button aria-label="Tutup" type="button" onClick={() => setBoqFormFile(null)} className="text-red-600 hover:text-red-700 font-bold text-sm">✕</button>
                  </div>
                  <button type="button" onClick={() => boqRoom1Ref.current?.click()} className="mt-1.5 w-full text-xs text-emerald-700 hover:text-emerald-800 font-bold py-1 transition-all"><IkonTeks nama="🔄" />Ganti File</button>
                </div>
              )}
            </div>
          </div>
        )}
        </>
      ) : (
        /* Extra Room (RoomSection component) */
        <RoomSection
          room={rooms[activeRoomIdx - 1]}
          rIdx={activeRoomIdx - 1}
          onUpdate={patch => setRooms(p => p.map((r,i) => i === activeRoomIdx-1 ? {...r,...patch} : r))}
          onRemove={() => { setRooms(p => p.filter((_,i) => i !== activeRoomIdx-1)); setActiveRoomIdx(a => Math.max(0,a-1)); }}
          brandPicMappings={brandPicMappings}
          photos={roomPhotoMap[rooms[activeRoomIdx-1]?.id] || []}
          onAddPhotos={files => setRoomPhotoMap(p => ({ ...p, [rooms[activeRoomIdx-1].id]: [...(p[rooms[activeRoomIdx-1].id]||[]),...files].slice(0,10) }))}
          onRemovePhoto={i => setRoomPhotoMap(p => { const arr=[...(p[rooms[activeRoomIdx-1].id]||[])]; arr.splice(i,1); return {...p,[rooms[activeRoomIdx-1].id]:arr}; })}
          boqFile={boqRoomMap[rooms[activeRoomIdx-1]?.id] || null}
          onSetBoq={file => setBoqRoomMap(p => ({ ...p, [rooms[activeRoomIdx-1].id]: file }))}
          toggleArr={toggleArr}
          isGuest={!['admin','superadmin','team_pts','team'].includes((currentUser?.role || '').toLowerCase().trim())}
        />
      )}
    </>
  );
}
