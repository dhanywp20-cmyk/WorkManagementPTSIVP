'use client';
/** Atur perangkat: laptop + dongle WyreStorm, layar tujuan share nirkabel (bawaan: terdekat). */
import { bisaJadiTujuan, nirkabel, tipePerangkatDari, tujuanShare } from '../../inti';
import type { KonteksAtur } from './konteks';

export function AturPerangkat({ c }: { c: KonteksAtur }) {
  const { b, label, semua, set } = c;
  if (b.jenis !== 'perangkat') return null;
  const tipe = tipePerangkatDari(b);
  const tujuan = semua.filter(bisaJadiTujuan);
  const otomatis = !b.layarTujuan || !tujuan.some(t => t.id === b.layarTujuan) ? tujuanShare({ ...b, layarTujuan: undefined }, semua) : null;
  return (
    <div className="space-y-2.5">
      {tipe === 'laptop' && (
        <label className="flex items-center gap-2 text-[13px] font-semibold text-slate-800" title="Dongle USB-C share layar nirkabel - tanpa kabel ke rack">
          <input type="checkbox" className="w-4 h-4" checked={!!b.pakaiDongle}
            onChange={e => set({ pakaiDongle: e.target.checked, nama: e.target.checked ? 'Laptop + dongle WyreStorm' : 'Laptop' })} />
          Dongle WyreStorm
        </label>
      )}
      {nirkabel(b) && (
        <label className="block">
          <span className={label} title="Display, LED, layar atau proyektor yang menerima share layar">Layar tujuan 📶</span>
          <select value={b.layarTujuan && tujuan.some(t => t.id === b.layarTujuan) ? b.layarTujuan : ''}
            onChange={e => set({ layarTujuan: e.target.value || undefined })}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base sm:text-sm">
            <option value="">{otomatis ? `Terdekat · ${otomatis.nama}` : 'Terdekat'}</option>
            {tujuan.map(t => <option key={t.id} value={t.id}>{t.nama}</option>)}
          </select>
          {!tujuan.length && <span className="block mt-1 text-[12px] text-amber-700">Belum ada display</span>}
        </label>
      )}
    </div>
  );
}
