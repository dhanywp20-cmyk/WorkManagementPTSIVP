'use client';
/** Atur display: videowall (termasuk panel custom), layar proyektor, IFP, TV / signage, LED, pilihan pemasangan. */
import { Angka, f, Pilih, Segmen } from '../../../bersama/ui';
import { BISA_PASANG, CELAH_PASANG, IFP_DIAG, LABEL_PASANG, LAYAR_DIAG, type ModelVW, PANEL_VW_AWAL, type PanelVW, type Pasang, pasangDari, PITCH_LED, RASIO_LAYAR, type RasioLayar, spekVideowall, TV_DIAG, VIDEOWALL } from '../../inti';
import type { KonteksAtur } from './konteks';

export function AturDisplay({ c }: { c: KonteksAtur }) {
  const { b, set, setUkuran } = c;
  return (
    <>
      {b.jenis === 'videowall' && (
        <>
          <Pilih label="Model panel" nilai={b.vw ?? '55BDL2105X'}
            onUbah={(v: ModelVW) => {
              if (v !== 'custom') { setUkuran({ vw: v }); return; }
              //  Custom dimulai dari panel yang sedang dipakai, lalu diisi ulang sesuai datasheet.
              const sp = spekVideowall(b);
              setUkuran({ vw: v, panel: b.panel ?? { w: sp.w, h: sp.h, d: sp.d, bezelMm: sp.bezelMm, resX: sp.resX, resY: sp.resY, wTipikal: sp.wTipikal, wMaks: sp.wMaks } });
            }}
            opsi={[
              ...(Object.keys(VIDEOWALL) as Exclude<ModelVW, 'custom'>[]).map(k => ({ v: k as ModelVW, l: `${VIDEOWALL[k].nama} (${VIDEOWALL[k].inci}")` })),
              { v: 'custom' as ModelVW, l: 'Custom - merek/model lain (isi datasheet)' },
            ]} />
          {b.vw === 'custom' && (() => {
            const pn: PanelVW = { ...PANEL_VW_AWAL, ...(b.panel ?? {}) };
            const setPanel = (x: Partial<PanelVW>) => setUkuran({ panel: { ...pn, ...x } });
            return (
              <div className="rounded-xl border border-slate-200 p-2.5 space-y-2 bg-slate-50/60">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Spesifikasi 1 panel</p>
                <div className="grid grid-cols-3 gap-2">
                  <Angka label="Lebar (mm)" nilai={Math.round(pn.w * 10000) / 10} step={0.1} onUbah={v => v >= 100 && v <= 3000 && setPanel({ w: v / 1000 })} />
                  <Angka label="Tinggi (mm)" nilai={Math.round(pn.h * 10000) / 10} step={0.1} onUbah={v => v >= 100 && v <= 3000 && setPanel({ h: v / 1000 })} />
                  <Angka label="Tebal (mm)" nilai={Math.round(pn.d * 10000) / 10} step={0.1} onUbah={v => v >= 5 && v <= 300 && setPanel({ d: v / 1000 })} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Angka label="Bezel (mm)" nilai={pn.bezelMm} step={0.1} bantuan="sisi ke sisi" onUbah={v => v >= 0 && v <= 60 && setPanel({ bezelMm: v })} />
                  <Angka label="Res. X (px)" nilai={pn.resX} step={1} onUbah={v => v >= 100 && v <= 8000 && setPanel({ resX: Math.round(v) })} />
                  <Angka label="Res. Y (px)" nilai={pn.resY} step={1} onUbah={v => v >= 100 && v <= 8000 && setPanel({ resY: Math.round(v) })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Angka label="Daya tipikal (W)" nilai={pn.wTipikal} step={1} onUbah={v => v >= 0 && v <= 3000 && setPanel({ wTipikal: v })} />
                  <Angka label="Daya maks (W)" nilai={pn.wMaks} step={1} onUbah={v => v >= 0 && v <= 3000 && setPanel({ wMaks: v })} />
                </div>
              </div>
            );
          })()}
          <div className="grid grid-cols-2 gap-2">
            <Angka label="Kolom" nilai={b.kol ?? 2} step={1} onUbah={v => v >= 1 && v <= 12 && setUkuran({ kol: Math.round(v) })} />
            <Angka label="Baris" nilai={b.bar ?? 2} step={1} onUbah={v => v >= 1 && v <= 8 && setUkuran({ bar: Math.round(v) })} />
          </div>
          {(() => {
            const s = spekVideowall(b); const n = (b.kol ?? 2) * (b.bar ?? 2);
            return (
              <p className="text-[12px] text-slate-600 leading-relaxed">
                Panel {+(s.w * 1000).toFixed(1)} × {+(s.h * 1000).toFixed(1)} × {+(s.d * 1000).toFixed(1)} mm, bezel {s.bezelMm} mm. Total {f(b.w)} × {f(b.h)} m,
                {' '}{(b.kol ?? 2) * s.resX} × {(b.bar ?? 2) * s.resY} px, {n} panel, daya ±{f((n * s.wTipikal) / 1000, 2)} kW (maks {f((n * s.wMaks) / 1000, 2)} kW).
              </p>
            );
          })()}
        </>
      )}
      {b.jenis === 'layar' && (
        <>
          <Pilih label="Ukuran layar" nilai={LAYAR_DIAG.includes(b.diag ?? 120) ? b.diag ?? 120 : -1}
            onUbah={v => v > 0 && setUkuran({ diag: v })} opsi={[...LAYAR_DIAG.map(d => ({ v: d, l: `${d}"` })), { v: -1, l: 'Custom...' }]} />
          {!LAYAR_DIAG.includes(b.diag ?? 120) && <Angka label="Diagonal" nilai={b.diag ?? 120} satuan="inci" onUbah={v => v >= 40 && v <= 400 && setUkuran({ diag: v })} />}
          <Segmen label="Rasio" nilai={b.rasio ?? '16:9'} onUbah={(v: RasioLayar) => setUkuran({ rasio: v })} opsi={RASIO_LAYAR.map(r => ({ v: r, l: r }))} />
          <p className="text-[12px] text-slate-600">Area gambar {f(b.w)} × {f(b.h)} m.</p>
        </>
      )}
      {b.jenis === 'ifp' && (
        <>
          <Pilih label="Ukuran" nilai={IFP_DIAG.includes(b.diag ?? 75) ? b.diag ?? 75 : -1}
            onUbah={v => setUkuran({ diag: v > 0 ? v : (b.diag && !IFP_DIAG.includes(b.diag) ? b.diag : 98) })}
            opsi={[...IFP_DIAG.map(d => ({ v: d, l: `${d}"` })), { v: -1, l: 'Custom...' }]} />
          {!IFP_DIAG.includes(b.diag ?? 75) && <Angka label="Diagonal" nilai={b.diag ?? 75} satuan="inci" onUbah={v => v >= 32 && v <= 150 && setUkuran({ diag: v })} />}
          <p className="text-[12px] text-slate-600">{f(b.w * 1000, 0)} × {f(b.h * 1000, 0)} mm (ukuran umum kelas ini - sesuaikan datasheet).</p>
        </>
      )}
      {b.jenis === 'tv' && (
        <>
          <Pilih label="Ukuran" nilai={TV_DIAG.includes(b.diag ?? 65) ? b.diag ?? 65 : -1}
            onUbah={v => setUkuran({ diag: v > 0 ? v : (b.diag && !TV_DIAG.includes(b.diag) ? b.diag : 98) })}
            opsi={[...TV_DIAG.map(d => ({ v: d, l: `${d}"` })), { v: -1, l: 'Custom...' }]} />
          {!TV_DIAG.includes(b.diag ?? 65) && <Angka label="Diagonal" nilai={b.diag ?? 65} satuan="inci" onUbah={v => v >= 20 && v <= 150 && setUkuran({ diag: v })} />}
        </>
      )}
      {BISA_PASANG.includes(b.jenis) && (() => {
        const lama = pasangDari(b);
        //  Ganti pemasangan: display maju / mundur sejauh beda tebal pemasangan, punggung tetap di tempatnya.
        const ganti = (v: Pasang) => {
          const r = (b.rot * Math.PI) / 180, maju = CELAH_PASANG[v] - CELAH_PASANG[lama];
          set({ pasang: v, x: Math.round((b.x + Math.sin(r) * maju) * 100) / 100, z: Math.round((b.z + Math.cos(r) * maju) * 100) / 100,
            //  Standfloor: display duduk di atas baki percabangan kaki (±0,72 m dari lantai).
            elev: v === 'standfloor' && (b.elev > 1.2 || b.elev < 0.66) ? 0.72 : b.elev });
        };
        return (
          <div>
            <Segmen label="Pemasangan" nilai={lama} onUbah={ganti}
              opsi={[{ v: 'dinding', l: 'Pop-up' }, { v: 'hollow', l: 'Hollow' }, { v: 'standfloor', l: 'Standfloor' }]} />
            <p className="text-[11px] text-slate-500 mt-1">{LABEL_PASANG[lama]}{lama === 'hollow' ? ' - rangka besi 40×40, tiang tiap ±0,6 m, plat siku ke dinding.' : lama === 'standfloor' ? ' - tiang & roda, bisa dipindah.' : ' - bracket gunting, display bisa ditarik keluar untuk servis.'}</p>
          </div>
        );
      })()}
      {b.jenis === 'led' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Pilih label="Pitch" nilai={PITCH_LED.includes(b.pitch ?? 2.5) ? b.pitch ?? 2.5 : -1} onUbah={v => v > 0 && set({ pitch: v })}
              opsi={[...PITCH_LED.map(p => ({ v: p, l: `P${p}` })), { v: -1, l: 'Custom...' }]} />
            <Angka label="Pitch" nilai={b.pitch ?? 2.5} satuan="mm" onUbah={v => v > 0 && set({ pitch: v })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Angka label="Lebar cabinet" nilai={b.cabW ?? 500} satuan="mm" onUbah={v => v >= 100 && set({ cabW: v })} />
            <Angka label="Tinggi cabinet" nilai={b.cabH ?? 500} satuan="mm" onUbah={v => v >= 100 && set({ cabH: v })} />
          </div>
          <p className="text-[12px] text-slate-600">Resolusi ±{Math.round((b.w * 1000) / (b.pitch ?? 2.5))} × {Math.round((b.h * 1000) / (b.pitch ?? 2.5))} px.</p>
        </>
      )}
    </>
  );
}
