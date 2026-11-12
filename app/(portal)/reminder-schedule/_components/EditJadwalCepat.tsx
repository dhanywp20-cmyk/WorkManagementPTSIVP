'use client';

import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { StatusJadwal } from '@/lib/jadwal/aturan';
import { Reminder, Status, INCENTIVE_TRIGGER_CATEGORIES, STATUS_CONFIG } from './shared';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';

export interface EditJadwalCepatProps {
  bolehEditReminder: (r: Reminder) => boolean;
  detailReminder: Reminder;
  pendingStatus: StatusJadwal | null;
  setPendingStatus: (v: Status | null) => void;
  setStatusPhoto: Dispatch<SetStateAction<File | null>>;
  setStatusPhotoPreview: Dispatch<SetStateAction<string | null>>;
  setShowModeModal: (v: boolean) => void;
  setPendingPhotoUrl: Dispatch<SetStateAction<string | undefined>>;
  setModePenyelesaian: Dispatch<SetStateAction<"onsite" | "remote" | null>>;
  setInstallerName: Dispatch<SetStateAction<string>>;
  setInstallerUserId: Dispatch<SetStateAction<string | null>>;
  setInstallerDaerah: Dispatch<SetStateAction<string>>;
  setBastDate: Dispatch<SetStateAction<string>>;
  setDisplayType: Dispatch<SetStateAction<"led" | "lcd" | "mix" | null>>;
  setRequiresMiddleware: Dispatch<SetStateAction<boolean>>;
  setRequiresControllerAuto: Dispatch<SetStateAction<boolean>>;
  setControllerBrand: Dispatch<SetStateAction<"cue" | "extron" | "wyrestorm" | null>>;
  showModeModal: boolean;
  statusPhotoRef: RefObject<HTMLInputElement | null>;
  statusPhotoPreview: string | null;
  statusPhoto: File | null;
  handleConfirmStatusUpdate: () => Promise<void>;
  updatingStatus: boolean;
}

export function EditJadwalCepat({
  bolehEditReminder, detailReminder, pendingStatus, setPendingStatus, setStatusPhoto, setStatusPhotoPreview, setShowModeModal, setPendingPhotoUrl,
  setModePenyelesaian, setInstallerName, setInstallerUserId, setInstallerDaerah, setBastDate, setDisplayType, setRequiresMiddleware, setRequiresControllerAuto,
  setControllerBrand, showModeModal, statusPhotoRef, statusPhotoPreview, statusPhoto, handleConfirmStatusUpdate, updatingStatus,
}: EditJadwalCepatProps) {
  return (
    <>{bolehEditReminder(detailReminder) && detailReminder.assigned_to && (
    <div>
      <p className="text-[11px] font-bold tracking-widest uppercase mb-3" style={{ color: '#64748b' }}>Update Status</p>
      {detailReminder.status === 'done' ? (
        <div className="rounded-xl px-4 py-3 flex items-center gap-2 mb-3" style={{ background: 'rgba(16,185,129,0.1)', border: '1.5px solid rgba(16,185,129,0.35)' }}>
          <span className="text-lg"><Ikon nama="✅" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
          <div>
            <p className="text-xs font-bold text-emerald-700">Jadwal Selesai</p>
            <p className="text-[11px] text-emerald-700">Status completed tidak dapat diubah kembali.</p>
          </div>
        </div>
      ) : (
      <div className="flex flex-wrap gap-2 mb-3">
        {(Object.keys(STATUS_CONFIG) as Status[]).filter(s => s !== 'done' || detailReminder.status !== 'done').map(s => {
          const c = STATUS_CONFIG[s];
          const isActive = (pendingStatus ?? detailReminder.status) === s;
          return (
            <button key={s}
              onClick={() => {
                setPendingStatus(s);
                if (s !== 'done') { setStatusPhoto(null); setStatusPhotoPreview(null); setShowModeModal(false); }
                else if ((INCENTIVE_TRIGGER_CATEGORIES as readonly string[]).includes(detailReminder.category)) {
                  setPendingPhotoUrl(undefined);
                  setModePenyelesaian(null); setInstallerName(''); setInstallerUserId(null); setInstallerDaerah('');
                  setBastDate(new Date().toISOString().split('T')[0]);
                  setDisplayType(null); setRequiresMiddleware(false);
                  setRequiresControllerAuto(false); setControllerBrand(null);
                  setShowModeModal(true);
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isActive ? 'ring-2 ring-offset-1 scale-105' : 'opacity-70 hover:opacity-100'}`}
              style={{ background: c.bg, color: c.color, border: `2px solid ${c.border}`, '--tw-ring-color': c.border } as React.CSSProperties}>
              <Ikon nama={c.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /> {c.label}
            </button>
          );
        })}
      </div>
      )}
    
      {detailReminder.status !== 'done' && (pendingStatus ?? detailReminder.status) === 'done' && !showModeModal && (
        <div className="rounded-xl p-3 mb-3" style={{ background: 'rgba(16,185,129,0.07)', border: '1.5px solid rgba(16,185,129,0.3)' }}>
          <p className="text-[11px] font-bold tracking-widest uppercase mb-2" style={{ color: '#047857' }}>
            <IkonTeks nama="📸" />Foto Bukti Selesai <span className="text-gray-500 font-normal normal-case">(opsional)</span>
          </p>
          <input
            ref={statusPhotoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) {
                setStatusPhoto(file);
                const reader = new FileReader();
                reader.onload = ev => setStatusPhotoPreview(ev.target?.result as string);
                reader.readAsDataURL(file);
              }
            }}
          />
          {statusPhotoPreview ? (
            <div className="relative">
              <img src={statusPhotoPreview} alt="preview" className="w-full max-h-40 object-cover rounded-lg" />
              <button aria-label="Tutup"
                onClick={() => { setStatusPhoto(null); setStatusPhotoPreview(null); if (statusPhotoRef.current) statusPhotoRef.current.value = ''; }}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold hover:bg-red-600">
                ✕
              </button>
              <p className="text-[11px] text-emerald-700 font-semibold mt-1.5"><Ikon nama="✅" ukuran="1em" className="inline-block align-[-0.12em]" /> {statusPhoto?.name}</p>
            </div>
          ) : (
            <button
              onClick={() => statusPhotoRef.current?.click()}
              className="w-full border-2 border-dashed rounded-xl py-6 flex flex-col items-center gap-2 transition-all hover:bg-emerald-50"
              style={{ borderColor: 'rgba(16,185,129,0.5)' }}>
              <span className="text-2xl"><Ikon nama="📷" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
              <span className="text-xs font-bold text-emerald-700">Klik untuk upload foto</span>
              <span className="text-[11px] text-gray-500">JPG, PNG, WEBP — maks. 10MB</span>
            </button>
          )}
        </div>
      )}
    
      {pendingStatus && pendingStatus !== detailReminder.status && !showModeModal && (
        <div className="flex gap-2">
          <button
            onClick={() => { setPendingStatus(null); setStatusPhoto(null); setStatusPhotoPreview(null); }}
            className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
            style={{ background: 'rgba(0,0,0,0.06)', color: '#64748b', border: '1px solid rgba(0,0,0,0.12)' }}>
            Batal
          </button>
          <button
            onClick={handleConfirmStatusUpdate}
            disabled={updatingStatus}
            className="tombol-utama flex-1 py-2 rounded-kontrol text-xs font-bold flex items-center justify-center gap-2">
            {updatingStatus
              ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
            }
            {updatingStatus ? 'Menyimpan...' : 'Konfirmasi Update'}
          </button>
        </div>
      )}
    </div>
    )}</>
  );
}
