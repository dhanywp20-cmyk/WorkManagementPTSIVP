'use client';
/** Atur proyektor: pemasangan, throw ratio & zoom lensa, tilt, lens shift, lumen. */
import { Angka, f, Segmen } from '../../../ui';
import { bendaBaru, geserLensaDari, lumenDari, offsetLensaDari, type PasangProyektor, throwRatioDari, zoomLensa } from '../../inti';
import type { KonteksAtur } from './konteks';

export function AturProyektor({ c }: { c: KonteksAtur }) {
  const { b, kosong, label, onUbah, set } = c;
  return (
    <>
      {b.jenis === 'proyektor' && (
        <>
          <Segmen label="Pemasangan" nilai={b.pasangProyektor ?? 'plafon'} onUbah={(v: PasangProyektor) => {
            const baru = bendaBaru('proyektor', kosong, { pasangProyektor: v });
            const namaBawaan = ['Proyektor', 'Proyektor plafon', 'Proyektor portabel'].includes(b.nama);
            onUbah({ ...b, pasangProyektor: v, w: baru.w, h: baru.h, d: baru.d, elev: baru.elev, nama: namaBawaan ? baru.nama : b.nama });
          }} opsi={[{ v: 'plafon', l: 'Gantung plafon' }, { v: 'meja', l: 'Portabel di meja' }]} />
          <div>
            <span className={label}>Pan & tilt</span>
            <div className="grid grid-cols-2 gap-2">
              <Angka label="Pan (kiri-kanan)" nilai={b.rot} satuan="°" step={1}
                onUbah={v => set({ rot: ((Math.round(v * 10) / 10 % 360) + 360) % 360 })} />
              <Angka label="Tilt (naik-turun)" nilai={b.tilt ?? 0} satuan="°" step={0.5} min={-90}
                onUbah={v => v >= -90 && v <= 45 && set({ tilt: Math.round(v * 10) / 10 })} />
            </div>
            {/*  Tombol geser halus: lebih mudah di HP daripada mengetik derajat. */}
            <div className="mt-1.5 grid grid-cols-4 gap-1" role="group" aria-label="Geser pan & tilt 1 derajat">
              {[
                { l: '◀ Pan', t: 'Pan ke kiri 1°', ubah: { rot: (((b.rot + 1) % 360) + 360) % 360 } },
                { l: 'Pan ▶', t: 'Pan ke kanan 1°', ubah: { rot: (((b.rot - 1) % 360) + 360) % 360 } },
                { l: '▲ Tilt', t: 'Tilt naik 1°', ubah: { tilt: Math.min(45, Math.round(((b.tilt ?? 0) + 1) * 10) / 10) } },
                { l: 'Tilt ▼', t: 'Tilt turun 1° (menunduk)', ubah: { tilt: Math.max(-90, Math.round(((b.tilt ?? 0) - 1) * 10) / 10) } },
              ].map(x => (
                <button key={x.l} type="button" title={x.t} aria-label={x.t} onClick={() => set(x.ubah)}
                  className="px-1 py-1.5 rounded-lg text-[11.5px] font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">{x.l}</button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Tilt negatif = menunduk; −90° = tegak lurus ke lantai (proyeksi lantai / immersive). Pan memutar proyektor ke kiri/kanan.</p>
          </div>
          {(() => {
            const [zMin, zMax] = zoomLensa(b), tr = throwRatioDari(b), tetap = zMax - zMin < 0.005;
            const setZoom = (v: number) => set({ throwRatio: Math.round(Math.min(zMax, Math.max(zMin, v)) * 100) / 100 });
            return (
              <div className="rounded-xl border border-slate-200 p-2.5 space-y-2 bg-slate-50/60">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Zoom lensa</p>
                <div className="grid grid-cols-3 gap-2">
                  <Angka label="TR terlebar" nilai={zMin} step={0.01} onUbah={v => v >= 0.1 && v <= 10 && set({ trMin: Math.round(v * 100) / 100, trMax: Math.max(v, b.trMax ?? zMax), throwRatio: Math.max(v, tr) })} />
                  <Angka label="TR terpanjang" nilai={zMax} step={0.01} onUbah={v => v >= 0.1 && v <= 10 && set({ trMax: Math.round(v * 100) / 100, trMin: Math.min(v, b.trMin ?? zMin), throwRatio: Math.min(v, tr) })} />
                  <Angka label="TR dipakai" nilai={tr} step={0.01} onUbah={v => v >= 0.1 && v <= 10 && (tetap ? set({ throwRatio: v, trMin: v, trMax: v }) : setZoom(v))} />
                </div>
                {!tetap && (
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setZoom(tr - 0.05)} title="Zoom out - gambar membesar (wide)" aria-label="Zoom out, gambar membesar"
                      className="h-8 w-9 rounded-lg border border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-50">−</button>
                    <input type="range" min={zMin} max={zMax} step={0.01} value={tr} aria-label="Zoom lensa (throw ratio)"
                      onChange={e => setZoom(Number(e.target.value))} className="flex-1 accent-blue-700" />
                    <button type="button" onClick={() => setZoom(tr + 0.05)} title="Zoom in - gambar mengecil (tele)" aria-label="Zoom in, gambar mengecil"
                      className="h-8 w-9 rounded-lg border border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-50">+</button>
                  </div>
                )}
                <p className="text-[11px] text-slate-500">
                  {tetap ? 'Lensa tetap (tanpa zoom) - isi TR terlebar & terpanjang dari datasheet bila lensanya zoom.'
                    : `Zoom ${f(zMax / zMin, 2)}× (TR ${f(zMin, 2)} - ${f(zMax, 2)} : 1). − = gambar membesar (wide), + = gambar mengecil (tele).`}
                </p>
              </div>
            );
          })()}
          <div className="rounded-xl border border-slate-200 p-2.5 space-y-2 bg-slate-50/60">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Lens shift</p>
              {(offsetLensaDari(b) !== 0 || geserLensaDari(b) !== 0) && (
                <button type="button" onClick={() => set({ offsetLensa: 0, geserLensaH: 0 })} className="text-[11.5px] font-bold text-blue-700 hover:underline">Ke tengah (0%)</button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Angka label="Vertikal" nilai={Math.round(offsetLensaDari(b) * 100)} satuan="%" step={1} min={-50}
                onUbah={v => v >= -50 && v <= 150 && set({ offsetLensa: v / 100 })} />
              <Angka label="Horizontal" nilai={Math.round(geserLensaDari(b) * 100)} satuan="%" step={1} min={-60}
                onUbah={v => v >= -60 && v <= 60 && set({ geserLensaH: v / 100 })} />
              <Angka label="Lumen" nilai={lumenDari(b)} satuan="lm" step={100} onUbah={v => v >= 100 && v <= 100000 && set({ lumen: Math.round(v) })} />
            </div>
            <p className="text-[11px] text-slate-500">
              Vertikal = geser pusat gambar dalam % tinggi gambar (relatif proyektor; gantung plafon = terbalik): 0% = tepat di sumbu lensa,
              50% = tepi gambar sejajar lensa (umum pada proyektor tanpa lens shift). Horizontal = % lebar gambar, + ke kanan.
            </p>
          </div>
        </>
      )}
    </>
  );
}
