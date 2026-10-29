'use client';
/** Modals-RoomSection.tsx - dipecah dari Modals.tsx (scripts/pecah-modul.mjs); Modals.tsx tetap mengekspor ulang semuanya. */
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { denganNilai, useDaftarPilihan } from '@/lib/daftar-pilihan';
import { useEffect, useRef, useState } from 'react';
import { BrandPicMapping, RoomDetail } from './shared';

// RoomSection
// Style matches Ruangan 1 exactly: larger buttons (px-3 py-2 text-sm), bold labels

export function RoomSection({ room, rIdx, onUpdate, onRemove, brandPicMappings, photos, onAddPhotos, onRemovePhoto, toggleArr, boqFile, onSetBoq, isGuest }: {
  room: RoomDetail; rIdx: number;
  onUpdate: (patch: Partial<RoomDetail>) => void;
  onRemove: () => void;
  brandPicMappings: BrandPicMapping[];
  photos: File[];
  onAddPhotos: (files: File[]) => void;
  onRemovePhoto: (i: number) => void;
  toggleArr: (arr: string[], val: string) => string[];
  boqFile?: File | null;
  onSetBoq?: (file: File | null) => void;
  isGuest?: boolean;
}) {
  const merekDisplay = useDaftarPilihan('merek-display');
  const merekMiddleware = useDaftarPilihan('merek-middleware');
  const [previews, setPreviews] = useState<string[]>([]);
  useEffect(() => { setPreviews(photos.map(f => URL.createObjectURL(f))); }, [photos]);
  const fileRef = useRef<HTMLInputElement>(null);
  const boqRef = useRef<HTMLInputElement>(null);
  const getBrandPic = (type: 'display'|'middleware', brand: string) =>
    brandPicMappings.find(m => m.brand_type === type && m.brand_name === brand);

  // Same style as Ruangan 1 RadioGroup
  const YN = ({ label, field, value }: { label: string; field: keyof RoomDetail; value: string }) => (
    <div className="mb-4">
      <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {['Yes','No'].map(opt => (
          <button key={opt} type="button" onClick={() => onUpdate({ [field]: opt } as any)}
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

  // Same style as Ruangan 1 CheckGroup
  const Chips = ({ label, opts, value, field, multi=true }: { label:string; opts:string[]; value:string[]; field:keyof RoomDetail; multi?:boolean }) => (
    <div className="mb-4">
      <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {opts.map(opt => {
          const active = value.includes(opt);
          return (
            <button aria-pressed={active} key={opt} type="button"
              onClick={() => onUpdate({ [field]: multi ? toggleArr(value, opt) : (active ? [] : [opt]) } as any)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${active ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300 hover:bg-teal-50/50'}`}>
              <div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center shrink-0 transition-all ${active ? 'border-teal-500 bg-teal-500' : 'border-gray-400'}`}>
                {active && <svg aria-hidden="true" focusable="false" className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </div>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-0">
      {/* Room name header — matches Ruangan 1 style */}
      <div className="flex items-center gap-2 mb-4 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl">
        <span className="text-xs font-black text-teal-700 shrink-0">Ruangan {rIdx + 2}</span>
        <input value={room.room_name} onChange={e => onUpdate({ room_name: e.target.value })}
          placeholder="Nama ruangan / area..."
          className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm font-medium bg-white outline-hidden focus:border-teal-400" />
        <button aria-label="Tutup" type="button" onClick={onRemove}
          className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 transition-all shrink-0">
          <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      {/* Kebutuhan */}
      {Chips({ label: "Kebutuhan *", opts: ['Signage','Immersive','Meeting Room','Mapping','Command Center','Hybrid Classroom'], value: room.kebutuhan, field: "kebutuhan", multi: false })}
      <div className="mb-4">
        <input value={room.kebutuhan_other} onChange={e => onUpdate({ kebutuhan_other: e.target.value })} placeholder="Other kebutuhan..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-hidden focus:border-teal-400" />
      </div>

      {/* Solution Product */}
      {Chips({ label: "Solution Product *", opts: ['Videowall','Signage Display','Videotron','Projector','Kiosk','IFP'], value: room.solution_product, field: "solution_product" })}
      <div className="mb-4">
        <input value={room.solution_other} onChange={e => onUpdate({ solution_other: e.target.value })} placeholder="Other solution..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-hidden focus:border-teal-400" />
      </div>

      {/* Brand Display 1 & 2 + Middleware.
          Slot display KEDUA ada karena satu ruangan bisa memakai dua produk
          display dari brand berbeda, dan tiap brand punya PIC-nya sendiri.
          Sebelumnya brand yang satunya hanya bisa dititipkan di kolom
          keterangan — dan PIC-nya tidak pernah ikut ter-mapping, jadi orang
          yang seharusnya menangani tidak pernah tahu. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 pt-2 border-t border-gray-100">
        <div>
          <label htmlFor="f-form-require-project-components-modals-1" className="block text-[11px] font-bold text-amber-700 uppercase tracking-widest mb-1.5"><IkonTeks nama="🖥" />Brand Display <span className="text-gray-500 font-normal">(opsional)</span></label>
          <select id="f-form-require-project-components-modals-1" value={room.brand_display} onChange={e => {
            const brand = e.target.value;
            const pic = getBrandPic('display', brand);
            onUpdate({ brand_display: brand, brand_display_pic_id: pic?.pic_user_id||'', brand_display_pic_name: pic?.pic_user_name||'' });
          }} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-hidden focus:border-amber-400 appearance-none">
            <option value="">— Pilih Brand Display —</option>
            {denganNilai(merekDisplay, room.brand_display).map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          {room.brand_display && room.brand_display_pic_name && <p className="mt-1 text-[11px] text-amber-700 font-semibold bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1"><IkonTeks nama="👤" />PIC: {room.brand_display_pic_name}</p>}
          {room.brand_display && !room.brand_display_pic_name && <p className="mt-1 text-[11px] text-gray-500 italic">PIC belum di-set admin</p>}
        </div>
        <div>
          <label htmlFor="f-form-require-project-components-modals-2" className="block text-[11px] font-bold text-amber-700 uppercase tracking-widest mb-1.5"><IkonTeks nama="🖥" />Brand Display 2 <span className="text-gray-500 normal-case font-normal">(opsional)</span></label>
          <select id="f-form-require-project-components-modals-2" value={room.brand_display_2 ?? ''} onChange={e => {
            const brand = e.target.value;
            const pic = getBrandPic('display', brand);
            onUpdate({ brand_display_2: brand, brand_display_2_pic_id: pic?.pic_user_id||'', brand_display_2_pic_name: pic?.pic_user_name||'' });
          }} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-hidden focus:border-amber-400">
            <option value="">— Pilih Brand Display 2 —</option>
            {denganNilai(merekDisplay, room.brand_display_2).map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          {room.brand_display_2 && room.brand_display_2_pic_name && <p className="mt-1 text-[11px] text-amber-700 font-semibold bg-amber-50 border border-amber-200 rounded-sm px-2 py-1"><IkonTeks nama="👤" />PIC: {room.brand_display_2_pic_name}</p>}
          {room.brand_display_2 && !room.brand_display_2_pic_name && <p className="mt-1 text-[11px] text-gray-500 italic">PIC belum di-mapping</p>}
        </div>
        <div>
          <label htmlFor="f-form-require-project-components-modals-3" className="block text-[11px] font-bold text-violet-600 uppercase tracking-widest mb-1.5"><IkonTeks nama="🔌" />Brand Middleware <span className="text-gray-500 font-normal">(opsional)</span></label>
          <select id="f-form-require-project-components-modals-3" value={room.brand_middleware} onChange={e => {
            const brand = e.target.value;
            const pic = getBrandPic('middleware', brand);
            onUpdate({ brand_middleware: brand, brand_middleware_pic_id: pic?.pic_user_id||'', brand_middleware_pic_name: pic?.pic_user_name||'' });
          }} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-hidden focus:border-violet-400 appearance-none">
            <option value="">— Pilih Brand Middleware —</option>
            {denganNilai(merekMiddleware, room.brand_middleware).map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          {room.brand_middleware && room.brand_middleware_pic_name && <p className="mt-1 text-[11px] text-violet-700 font-semibold bg-violet-50 border border-violet-200 rounded-lg px-2.5 py-1"><IkonTeks nama="👤" />PIC: {room.brand_middleware_pic_name}</p>}
          {room.brand_middleware && !room.brand_middleware_pic_name && <p className="mt-1 text-[11px] text-gray-500 italic">PIC belum di-set admin</p>}
        </div>
      </div>

      {/* Layout Signage — only if Signage selected */}
      {room.kebutuhan.includes('Signage') && (
        <div className="mb-4 pt-2 border-t border-gray-100">
          {Chips({ label: "Layout Signage", opts: ['Single Zone','Multi Zone','Full Screen','Custom Layout'], value: room.layout_signage, field: "layout_signage" })}
          {Chips({ label: "Jaringan CMS", opts: ['Cloud','Onpremise','USB'], value: room.jaringan_cms, field: "jaringan_cms" })}
          <div className="grid grid-cols-2 gap-3 mt-1">
            <div><label htmlFor="f-form-require-project-components-modals-4" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Input</label><input id="f-form-require-project-components-modals-4" value={room.jumlah_input} onChange={e => onUpdate({jumlah_input:e.target.value})} placeholder="e.g. 4" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-hidden focus:border-teal-400"/></div>
            <div><label htmlFor="f-form-require-project-components-modals-5" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Output</label><input id="f-form-require-project-components-modals-5" value={room.jumlah_output} onChange={e => onUpdate({jumlah_output:e.target.value})} placeholder="e.g. 2" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-hidden focus:border-teal-400"/></div>
          </div>
        </div>
      )}

      {/* Source */}
      <div className="mb-4 pt-2 border-t border-gray-100">
        {Chips({ label: "Source", opts: ['PC / Mini PC','Laptop','URL Dashboard','NVR CCTV','Media Player','IPTV','Set Top Box'], value: room.source, field: "source" })}
        <div className="flex gap-3 mb-3">
          {room.source.includes('Laptop') && <div className="flex-1 min-w-0"><label htmlFor="f-form-require-project-components-modals-6" className="block text-[11px] font-bold text-amber-700 uppercase tracking-widest mb-1">Qty Laptop</label><input id="f-form-require-project-components-modals-6" type="number" min="1" value={room.source_laptop_qty} onChange={e=>onUpdate({source_laptop_qty:e.target.value})} placeholder="1" className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm bg-amber-50 outline-hidden focus:border-amber-400"/></div>}
          {room.source.includes('PC / Mini PC') && <div className="flex-1 min-w-0"><label htmlFor="f-form-require-project-components-modals-7" className="block text-[11px] font-bold text-blue-600 uppercase tracking-widest mb-1">Qty PC</label><input id="f-form-require-project-components-modals-7" type="number" min="1" value={room.source_pc_qty} onChange={e=>onUpdate({source_pc_qty:e.target.value})} placeholder="1" className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm bg-blue-50 outline-hidden focus:border-blue-400"/></div>}
        </div>
        <input value={room.source_other} onChange={e=>onUpdate({source_other:e.target.value})} placeholder="Other source..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-hidden focus:border-teal-400"/>
      </div>

      {/* Camera + Audio — 2 kolom.
          Sebelumnya tiap Yes/No memakai satu baris penuh sendiri, KECUALI
          Wallplate+Tabletop yang berdua. Hasilnya satu baris terlihat
          berpasangan sementara sisanya menyisakan ruang kosong selebar
          setengah kartu — terbaca seperti ada isian yang lupa dipasang.
          Semua dipasangkan supaya ritmenya sama. */}
      <div className="pt-2 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
      <div>
        {YN({ label: "Camera Conference", field: "camera_conference", value: room.camera_conference })}
        {room.camera_conference==='Yes' && <div className="ml-4 mb-4 space-y-3 border-l-2 border-teal-200 pl-4">
          <div>
            <label htmlFor="f-form-require-project-components-modals-8" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Camera</label>
            <input id="f-form-require-project-components-modals-8" value={room.camera_jumlah} onChange={e=>onUpdate({camera_jumlah:e.target.value})} placeholder="e.g. 2 unit" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-hidden focus:border-teal-400"/>
          </div>
          {Chips({ label: "Tipe Tracking", opts: ['Auto Tracking','Manual PTZ','Fixed'], value: room.camera_tracking, field: "camera_tracking" })}
        </div>}
      </div>

      <div>
        {YN({ label: "Audio System", field: "audio_system", value: room.audio_system })}
        {room.audio_system==='Yes' && <div className="ml-4 mb-4 space-y-3 border-l-2 border-teal-200 pl-4">
          <div>
            <label htmlFor="f-form-require-project-components-modals-9" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Mixer / DSP</label>
            <input id="f-form-require-project-components-modals-9" value={room.audio_mixer} onChange={e=>onUpdate({audio_mixer:e.target.value})} placeholder="e.g. Yamaha QL1, QSC, etc." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-hidden focus:border-teal-400"/>
          </div>
          {Chips({ label: "Audio Detail", opts: ['Speaker Ceiling','Speaker Line Array','Subwoofer','Microphone','Amplifier'], value: room.audio_detail, field: "audio_detail" })}
        </div>}
      </div>
      </div>

      {/* Wallplate + Tabletop — 2 col */}
      <div className="pt-2 border-t border-gray-100 grid grid-cols-2 gap-3">
        <div>
          {YN({ label: "Wallplate Input", field: "wallplate_input", value: room.wallplate_input })}
          {room.wallplate_input==='Yes' && <div className="ml-4 border-l-2 border-teal-200 pl-4 mb-4">
            <label htmlFor="f-form-require-project-components-modals-10" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Wallplate</label>
            <input id="f-form-require-project-components-modals-10" value={room.wallplate_jumlah} onChange={e=>onUpdate({wallplate_jumlah:e.target.value})} placeholder="e.g. 3 unit" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-hidden focus:border-teal-400"/>
          </div>}
        </div>
        <div>
          {YN({ label: "Tabletop Input", field: "tabletop_input", value: room.tabletop_input })}
          {room.tabletop_input==='Yes' && <div className="ml-4 border-l-2 border-teal-200 pl-4 mb-4">
            <label htmlFor="f-form-require-project-components-modals-11" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Tabletop</label>
            <input id="f-form-require-project-components-modals-11" value={room.tabletop_jumlah} onChange={e=>onUpdate({tabletop_jumlah:e.target.value})} placeholder="e.g. 2 unit" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-hidden focus:border-teal-400"/>
          </div>}
        </div>
      </div>

      {/* Wireless + Controller — 2 kolom, alasan sama dengan Camera+Audio di atas. */}
      <div className="pt-2 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
      <div>
        {YN({ label: "Wireless Presentation", field: "wireless_presentation", value: room.wireless_presentation })}
        {room.wireless_presentation==='Yes' && <div className="ml-4 mb-4 space-y-3 border-l-2 border-teal-200 pl-4">
          {Chips({ label: "Wireless Mode", opts: ['Aplikasi','AirPlay','Miracast','Chromecast','BYOM'], value: room.wireless_mode, field: "wireless_mode" })}
          {YN({ label: "Dongle", field: "wireless_dongle", value: room.wireless_dongle })}
        </div>}
      </div>

      <div>
        {YN({ label: "Controller / Automation", field: "controller_automation", value: room.controller_automation })}
        {room.controller_automation==='Yes' && <div className="ml-4 mb-4 border-l-2 border-teal-200 pl-4">
          {Chips({ label: "Controller Type", opts: ['Cue','Wyrestorm','Extron','Custom'], value: room.controller_type, field: "controller_type" })}
        </div>}
      </div>
      </div>

      {/* Ukuran, Suggest, Keterangan */}
      <div className="pt-2 border-t border-gray-100 space-y-3 mb-4">
        <div>
          <label htmlFor="f-form-require-project-components-modals-12" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Ukuran Ruangan (P×L×T)</label>
          <input id="f-form-require-project-components-modals-12" value={room.ukuran_ruangan} onChange={e=>onUpdate({ukuran_ruangan:e.target.value})} placeholder="e.g. 8m×6m×3m" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-hidden focus:border-teal-400"/>
        </div>
        <div>
          <label htmlFor="f-form-require-project-components-modals-13" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Suggest Tampilan (W×H)</label>
          <input id="f-form-require-project-components-modals-13" value={room.suggest_tampilan} onChange={e=>onUpdate({suggest_tampilan:e.target.value})} placeholder="e.g. 1920×1080 atau 4K" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-hidden focus:border-teal-400"/>
        </div>
        <div>
          <label htmlFor="f-form-require-project-components-modals-14" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Keterangan Lain</label>
          <textarea id="f-form-require-project-components-modals-14" value={room.keterangan_lain} onChange={e=>onUpdate({keterangan_lain:e.target.value})} rows={2} placeholder="Info tambahan..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-hidden focus:border-teal-400 resize-none"/>
        </div>
      </div>

      {/* Foto + BOQ — 2 col, same layout as Ruangan 1 */}
      {isGuest && (
        <div className="pt-2 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Foto Survey */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2"><IkonTeks nama="📸" />Foto Survey Ruangan Ini</label>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
              id={`room-photo-${room.id}`}
              onChange={e => { const files = Array.from(e.target.files||[]); if(files.length) onAddPhotos(files); e.target.value=''; }}/>
            {previews.length === 0 ? (
              <label htmlFor={`room-photo-${room.id}`} className="w-full border-2 border-dashed border-gray-300 rounded-xl py-4 flex flex-col items-center justify-center text-gray-500 hover:border-teal-400 hover:text-teal-500 transition-all cursor-pointer">
                <span className="text-2xl mb-1"><Ikon nama="📷" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                <span className="text-xs font-medium">Klik upload foto</span>
                <span className="text-[11px] opacity-70">Max 10 foto</span>
              </label>
            ) : (
              <div>
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {previews.map((src, i) => (
                    <div key={i} className="relative group rounded-lg overflow-hidden aspect-square border border-gray-200">
                      <img src={src} alt="" className="w-full h-full object-cover"/>
                      <button aria-label="Tutup" type="button" onClick={() => onRemovePhoto(i)} className="absolute top-0.5 right-0.5 bg-red-500 text-white w-4 h-4 rounded-full text-[11px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                    </div>
                  ))}
                  {photos.length < 10 && (
                    <label htmlFor={`room-photo-${room.id}`} className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-500 hover:border-teal-400 cursor-pointer"><span className="text-xl">+</span></label>
                  )}
                </div>
                <p className="text-[11px] text-gray-500">{photos.length}/10 foto</p>
              </div>
            )}
          </div>
          {/* BOQ Excel */}
          <div>
            <label htmlFor="f-form-require-project-components-modals-15" className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2"><IkonTeks nama="📊" />BOQ Excel Ruangan Ini</label>
            <input id="f-form-require-project-components-modals-15" ref={boqRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f && onSetBoq) onSetBoq(f); e.target.value=''; }} />
            {!boqFile ? (
              <button type="button" onClick={() => boqRef.current?.click()}
                className="w-full border-2 border-dashed border-emerald-300 rounded-xl py-4 flex flex-col items-center justify-center text-emerald-700 hover:border-emerald-500 hover:bg-emerald-50 transition-all cursor-pointer">
                <span className="text-2xl mb-1"><Ikon nama="📊" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                <span className="text-xs font-medium">Klik upload BOQ</span>
                <span className="text-[11px] opacity-70">.xlsx / .xls / .csv</span>
              </button>
            ) : (
              <div>
                <div className="border-2 border-emerald-300 bg-emerald-50 rounded-xl p-3 flex items-center gap-3">
                  <span className="text-xl"><Ikon nama="📊" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-emerald-800 truncate">{boqFile.name}</p>
                    <p className="text-[11px] text-emerald-700">{(boqFile.size/1024).toFixed(1)} KB</p>
                  </div>
                  <button aria-label="Tutup" type="button" onClick={() => onSetBoq && onSetBoq(null)} className="text-red-600 hover:text-red-700 font-bold text-sm">✕</button>
                </div>
                <button type="button" onClick={() => boqRef.current?.click()}
                  className="mt-1.5 w-full text-xs text-emerald-700 hover:text-emerald-800 font-bold py-1 transition-all"><IkonTeks nama="🔄" />Ganti File</button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Foto only (no BOQ) for team users */}
      {!isGuest && (
        <div className="pt-2 border-t border-gray-100">
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2"><IkonTeks nama="📸" />Foto Survey Ruangan Ini</label>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
            id={`room-photo-ng-${room.id}`}
            onChange={e => { const files = Array.from(e.target.files||[]); if(files.length) onAddPhotos(files); e.target.value=''; }}/>
          {previews.length === 0 ? (
            <label htmlFor={`room-photo-ng-${room.id}`} className="w-full border-2 border-dashed border-gray-300 rounded-xl py-4 flex flex-col items-center justify-center text-gray-500 hover:border-teal-400 hover:text-teal-500 transition-all cursor-pointer">
              <span className="text-2xl mb-1"><Ikon nama="📷" ukuran="1em" className="inline-block align-[-0.12em]" /></span><span className="text-xs font-medium">Klik upload foto</span>
              <span className="text-[11px] opacity-70">Max 10 foto</span>
            </label>
          ) : (
            <div>
              <div className="grid grid-cols-4 gap-1.5 mb-2">
                {previews.map((src, i) => (
                  <div key={i} className="relative group rounded-lg overflow-hidden aspect-square border border-gray-200">
                    <img src={src} alt="" className="w-full h-full object-cover"/>
                    <button aria-label="Tutup" type="button" onClick={() => onRemovePhoto(i)} className="absolute top-0.5 right-0.5 bg-red-500 text-white w-4 h-4 rounded-full text-[11px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                  </div>
                ))}
                {photos.length < 10 && (
                  <label htmlFor={`room-photo-ng-${room.id}`} className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-500 hover:border-teal-400 cursor-pointer"><span className="text-xl">+</span></label>
                )}
              </div>
              <p className="text-[11px] text-gray-500">{photos.length}/10 foto</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
