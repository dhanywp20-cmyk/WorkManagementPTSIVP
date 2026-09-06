'use client';
import { InstallerPicker } from './InstallerPicker';

/**
 * Panel "Mode Penyelesaian" (muncul saat klik Completed) — dipindah dari
 * app/reminder-schedule/page.tsx apa adanya (JSX identik). State & handler
 * tetap di page.tsx, komponen ini murni presentasional.
 */
export function ModePenyelesaianPanel({
  modePenyelesaian, setModePenyelesaian,
  bastDate, setBastDate,
  displayType, setDisplayType,
  requiresControllerAuto, setRequiresControllerAuto,
  controllerBrand, setControllerBrand,
  requiresMiddleware, setRequiresMiddleware,
  installerName, setInstallerName,
  installerUserId, setInstallerUserId,
  daftarCabang,
  installerDaerah, setInstallerDaerah,
  savingMode,
  handleModeConfirm,
  modeEditSaja = false,
  setShowModeModal, setPendingStatus, setStatusPhoto, setStatusPhotoPreview, setPendingPhotoUrl,
}: {
  modePenyelesaian: 'onsite' | 'remote' | null;
  setModePenyelesaian: (v: 'onsite' | 'remote' | null) => void;
  bastDate: string;
  setBastDate: (v: string) => void;
  displayType: 'led' | 'lcd' | 'mix' | null;
  setDisplayType: (v: 'led' | 'lcd' | 'mix' | null) => void;
  requiresControllerAuto: boolean;
  setRequiresControllerAuto: (v: boolean) => void;
  controllerBrand: 'cue' | 'extron' | 'wyrestorm' | null;
  setControllerBrand: (v: 'cue' | 'extron' | 'wyrestorm' | null) => void;
  requiresMiddleware: boolean;
  setRequiresMiddleware: (v: boolean) => void;
  installerName: string;
  setInstallerName: (v: string) => void;
  installerUserId: string | null;
  setInstallerUserId: (v: string | null) => void;
  daftarCabang: { id: string; full_name: string; pts_daerah: string | null }[];
  installerDaerah: string;
  setInstallerDaerah: (v: string) => void;
  savingMode: boolean;
  handleModeConfirm: () => void;
  /**
   * true = panel dibuka untuk MENGISI/MENGUBAH detail jadwal yang statusnya
   * sudah Completed, bukan sebagai syarat sebelum menyelesaikan. Statusnya
   * tidak ikut berubah, jadi judul & tombolnya tidak boleh menjanjikan
   * "menyelesaikan" - itu yang bikin orang ragu menekannya.
   */
  modeEditSaja?: boolean;
  setShowModeModal: (v: boolean) => void;
  setPendingStatus: (v: null) => void;
  setStatusPhoto: (v: null) => void;
  setStatusPhotoPreview: (v: null) => void;
  setPendingPhotoUrl: (v: undefined) => void;
}) {
  const batalkan = () => { setShowModeModal(false); setPendingStatus(null); setStatusPhoto(null); setStatusPhotoPreview(null); setPendingPhotoUrl(undefined); };

  return (
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex-shrink-0 overflow-hidden flex flex-col"
      style={{ animation: 'scale-in 0.2s ease-out', border: '1px solid rgba(0,0,0,0.1)', height: '100%' }}>
      <div className="px-5 py-4 flex-shrink-0 relative" style={{ background: 'linear-gradient(135deg,#059669,#047857)' }}>
        <h3 className="text-white font-bold text-base">📍 {modeEditSaja ? 'Detail Pelaksanaan' : 'Mode Penyelesaian'}</h3>
        <p className="text-emerald-100 text-[11px] mt-0.5">
          {modeEditSaja ? 'Status tetap Completed — hanya detailnya yang disimpan' : 'Lengkapi data sebelum status jadi Completed'}
        </p>
        <button aria-label="Tutup" onClick={batalkan}
          className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/20 hover:bg-black/35 text-white flex items-center justify-center font-bold text-sm">✕</button>
      </div>
      <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
        <div>
          <p className="text-sm font-bold text-gray-700 mb-3">Pilih mode pelaksanaan: <span className="text-red-500">*</span></p>
          <div className="grid grid-cols-2 gap-3">
            {(['onsite', 'remote'] as const).map(m => (
              <button key={m} onClick={() => setModePenyelesaian(m)}
                className={`py-4 rounded-xl border-2 font-bold text-sm transition-all flex flex-col items-center gap-2 ${modePenyelesaian === m ? (m === 'onsite' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-blue-500 bg-blue-50 text-blue-700') : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'}`}>
                <span className="text-2xl">{m === 'onsite' ? '🏠' : '📡'}</span>
                {m === 'onsite' ? 'ONSITE' : 'REMOTE'}
                <span className="text-[10px] font-normal opacity-70">{m === 'onsite' ? 'Tim hadir langsung' : 'Tim dari jarak jauh'}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 mb-2">📅 Tanggal BAST <span className="text-red-500">*</span></label>
          <input type="date" value={bastDate} onChange={e => setBastDate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white" />
          {bastDate && (
            <p className="text-[10px] text-gray-400 mt-1">Tranche T1 bayar {new Date(bastDate).getFullYear()+1} · T2 bayar {new Date(bastDate).getFullYear()+2} · T3 bayar {new Date(bastDate).getFullYear()+3}</p>
          )}
        </div>

        {/* 1. Display Type — wajib pilih LED / LCD / Mix */}
        <div>
          <p className="text-xs font-bold text-gray-600 mb-2">🖥️ Tipe Display <span className="text-red-500">*</span> <span className="font-normal text-gray-400">(Mix = LED + LCD)</span></p>
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: 'led', label: 'LED' },
              { value: 'lcd', label: 'LCD' },
              { value: 'mix', label: 'Mix' },
            ] as { value: 'led' | 'lcd' | 'mix'; label: string }[]).map(opt => (
              <button key={opt.value} type="button" onClick={() => setDisplayType(opt.value)}
                className={`py-2 rounded-xl border-2 text-xs font-bold transition-all ${displayType === opt.value ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Controller Automation — Yes/No + brand */}
        <div>
          <p className="text-xs font-bold text-gray-600 mb-2">🎛️ Controller Automation <span className="text-red-500">*</span></p>
          <div className="grid grid-cols-2 gap-2">
            {([{ v: false, l: 'Tidak' }, { v: true, l: 'Ya' }] as { v: boolean; l: string }[]).map(opt => (
              <button key={opt.l} type="button"
                onClick={() => { setRequiresControllerAuto(opt.v); if (!opt.v) setControllerBrand(null); }}
                className={`py-2 rounded-xl border-2 text-xs font-bold transition-all ${requiresControllerAuto === opt.v ? 'border-cyan-500 bg-cyan-50 text-cyan-700' : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'}`}>
                {opt.l}
              </button>
            ))}
          </div>
          {requiresControllerAuto && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              {([
                { value: 'cue', label: 'Cue' },
                { value: 'extron', label: 'Extron' },
                { value: 'wyrestorm', label: 'Wyrestorm' },
              ] as { value: 'cue' | 'extron' | 'wyrestorm'; label: string }[]).map(b => (
                <button key={b.value} type="button" onClick={() => setControllerBrand(b.value)}
                  className={`py-2 rounded-xl border-2 text-xs font-bold transition-all ${controllerBrand === b.value ? 'border-cyan-500 bg-cyan-50 text-cyan-700' : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'}`}>
                  {b.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 3. Middleware — Yes/No */}
        <div>
          <p className="text-xs font-bold text-gray-600 mb-2">🔌 Middleware / System / Matrix <span className="text-red-500">*</span></p>
          <div className="grid grid-cols-2 gap-2">
            {([{ v: false, l: 'Tidak' }, { v: true, l: 'Ya' }] as { v: boolean; l: string }[]).map(opt => (
              <button key={opt.l} type="button" onClick={() => setRequiresMiddleware(opt.v)}
                className={`py-2 rounded-xl border-2 text-xs font-bold transition-all ${requiresMiddleware === opt.v ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'}`}>
                {opt.l}
              </button>
            ))}
          </div>
        </div>

        {modePenyelesaian === 'remote' && (
          <div className="space-y-3 p-4 rounded-xl" style={{ background: 'rgba(59,130,246,0.06)', border: '1.5px solid rgba(59,130,246,0.25)' }}>
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">🔧 Data PTS Daerah</p>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">PTS Daerah <span className="text-red-500">*</span></label>
              <InstallerPicker
                daftarCabang={daftarCabang}
                installerUserId={installerUserId}
                installerName={installerName}
                onPilihAkun={(id, nama, daerah) => {
                  setInstallerUserId(id); setInstallerName(nama);
                  if (daerah) setInstallerDaerah(daerah);
                }}
                onKetikManual={nama => { setInstallerUserId(null); setInstallerName(nama); }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Daerah / Kota <span className="text-red-500">*</span></label>
              <input value={installerDaerah} onChange={e => setInstallerDaerah(e.target.value)}
                placeholder="Contoh: Surabaya, Bandung, Medan..."
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button onClick={batalkan}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all">
            Batal
          </button>
          <button onClick={handleModeConfirm} disabled={savingMode || !modePenyelesaian}
            className="flex-[2] py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all"
            style={{ background: 'linear-gradient(135deg,#059669,#047857)' }}>
            {savingMode ? 'Menyimpan...' : (modeEditSaja ? '💾 Simpan Detail' : '✅ Konfirmasi & Selesaikan')}
          </button>
        </div>
      </div>
    </div>
  );
}
