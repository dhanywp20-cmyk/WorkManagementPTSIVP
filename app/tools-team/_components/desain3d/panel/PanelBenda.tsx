'use client';
import { Ikon } from '@/components/shared/Ikon';
import { AturObjek } from './AturObjek';
import { AturDisplay } from './benda/AturDisplay';
import { AturRak } from './benda/AturRak';
import { AturLampu } from './benda/AturLampu';
import { AturAudio } from './benda/AturAudio';
import { AturFurnitur } from './benda/AturFurnitur';
import { AturKonferensi } from './benda/AturKonferensi';
import { AturBidang } from './benda/AturBidang';
import { AturProyektor } from './benda/AturProyektor';
import { BagianUmum } from './benda/BagianUmum';
import { useKonteksAtur, type PropsPanelBenda } from './benda/konteks';

/**
 * Panel "Atur benda" - mengisi panel kanan di samping tampilan 3D, jadi
 * perubahan langsung terlihat tanpa menutupi kanvas. Bagian per jenis ada di panel/benda/.
 */
export function PanelBenda({ b, plafon, batas, onUbah, onGambar, onTutup, ekstra, onSimpanProduk, adaFoto = false, onGambarObjek }: PropsPanelBenda) {
  const c = useKonteksAtur({ b, plafon, batas, onUbah, onGambar, onTutup, ekstra, onSimpanProduk, adaFoto, onGambarObjek });
  const { label, set } = c;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100">
        <p className="text-[13px] font-bold text-slate-900 truncate">Atur: {b.nama}</p>
        <button type="button" onClick={onTutup} aria-label="Tutup panel" className="w-8 h-8 grid place-items-center rounded-lg text-slate-600 hover:bg-slate-100">
          <Ikon nama="❌" ukuran={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <label className="block">
          <span className={label}>Nama</span>
          <input value={b.nama} onChange={e => set({ nama: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-base sm:text-sm" />
        </label>

        {/* Bagian khusus jenis - tiap komponen hanya tampil untuk jenisnya sendiri. */}
        <AturDisplay c={c} />
        <AturRak c={c} />
        <AturLampu c={c} />
        <AturAudio c={c} />
        <AturFurnitur c={c} />
        <AturKonferensi c={c} />
        <AturBidang c={c} />
        <AturProyektor c={c} />
        {(b.jenis === 'model' || b.jenis === 'objek') && <AturObjek b={b} set={set} adaFoto={adaFoto} onGambarBaru={() => onGambarObjek?.()} />}
        {ekstra}

        <BagianUmum c={c} />
      </div>
    </div>
  );
}

