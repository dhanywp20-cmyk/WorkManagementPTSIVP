'use client';
/** Atur proyektor: pemasangan, throw ratio & zoom lensa, tilt, lens shift, lumen, warna sinar. */
import { Angka, f, Segmen, Catatan } from '../../../bersama/ui';
import { batasShift, bendaBaru, geserLensaDari, koreksiJarakDari, lumenDari, offsetLensaDari, type PasangProyektor, RASIO_PROYEKTOR, type RasioProyektor, throwRatioDari, warnaSah, warnaSinarProyektor, zoomLensa } from '../../inti';
import type { KonteksAtur } from './konteks';

export function AturProyektor({ c }: { c: KonteksAtur }) {
  const { b, kosong, label, onUbah, set, semua } = c;
  const proyektor = semua.filter(x => x.jenis === 'proyektor');
  const warnaSinar = warnaSinarProyektor(b, Math.max(0, proyektor.findIndex(x => x.id === b.id)), proyektor.length);
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
            <Catatan>Tilt negatif = menunduk; −90° = tegak lurus ke lantai (proyeksi lantai / immersive). Pan memutar proyektor ke kiri/kanan.</Catatan>
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
                <Catatan>
                  {tetap ? 'Lensa tetap (tanpa zoom) - isi TR terlebar & terpanjang dari datasheet bila lensanya zoom.'
                    : `Zoom ${f(zMax / zMin, 2)}× (TR ${f(zMin, 2)} - ${f(zMax, 2)} : 1). − = gambar membesar (wide), + = gambar mengecil (tele).`}
                </Catatan>
                {/*  Rumus lensa pabrikan: L = a x SW - b. a = TR terlebar / terpanjang di atas, b = koreksi ini. */}
                <Angka label="Koreksi jarak b (rumus L = TR × lebar − b)" nilai={koreksiJarakDari(b)} satuan="m" step={0.001} min={-1}
                  onUbah={v => v >= -1 && v <= 1 && set({ koreksiJarak: Math.round(v * 1000) / 1000 || undefined })} />
                <Catatan>Isi dari rumus jarak lempar di datasheet lensa, mis. Panasonic ET-D3QW200: L = 0,566 × SW − 0,082 → TR 0,566 & b 0,082. Kosong / 0 = L = TR × lebar.</Catatan>
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
            {(() => {
              //  Batas lens shift lensa dari datasheet (Panasonic: VS atas / bawah, HS kiri-kanan, % tinggi / lebar gambar).
              const bs = batasShift(b);
              const persen = (v: number | null) => (v === null ? undefined : Math.round(v * 100));
              const isi = (k: 'shiftAtasMaks' | 'shiftBawahMaks' | 'shiftHMaks', v: number) => v >= 0 && v <= 150 && set({ [k]: v ? v / 100 : undefined });
              return (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <Angka label="Batas atas" nilai={persen(bs.atas) ?? 0} satuan="%" step={1} onUbah={v => isi('shiftAtasMaks', v)} />
                    <Angka label="Batas bawah" nilai={persen(bs.bawah) ?? 0} satuan="%" step={1} onUbah={v => isi('shiftBawahMaks', v)} />
                    <Angka label="Batas kiri-kanan" nilai={persen(bs.h) ?? 0} satuan="%" step={1} onUbah={v => isi('shiftHMaks', v)} />
                  </div>
                  {(bs.lewatV || bs.lewatH) && (
                    <p className="text-[12px] font-semibold text-rose-700">
                      Lens shift melebihi kemampuan lensa ({bs.lewatV ? `vertikal ${Math.round(offsetLensaDari(b) * 100)}% di luar +${persen(bs.atas) ?? '∞'}/−${persen(bs.bawah) ?? '∞'}%` : ''}{bs.lewatV && bs.lewatH ? '; ' : ''}{bs.lewatH ? `horizontal ${Math.round(geserLensaDari(b) * 100)}% di luar ±${persen(bs.h)}%` : ''}) - geser proyektor atau pakai tilt.
                    </p>
                  )}
                </>
              );
            })()}
            {/*  Rasio aspek panel proyektor: ukuran gambar, cakupan layar, lux & piksel blending mengikuti. */}
            <Segmen label="Rasio aspek gambar" nilai={b.rasioProyektor ?? '16:9'} onUbah={(v: RasioProyektor) => set({ rasioProyektor: v })}
              opsi={(Object.keys(RASIO_PROYEKTOR) as RasioProyektor[]).map(k => ({ v: k, l: k }))} />
            <Catatan>
              Vertikal = geser pusat gambar dalam % tinggi gambar (relatif proyektor; gantung plafon = terbalik): 0% = tepat di sumbu lensa,
              50% = tepi gambar sejajar lensa (umum pada proyektor tanpa lens shift). Horizontal = % lebar gambar, + ke kanan.
              Batas = kemampuan lens shift lensa dari datasheet (Panasonic: VS1 / VS2 / HS); 0 = tidak dibatasi.
            </Catatan>
          </div>
          {/*  Warna sinar di kanvas: otomatis beda per proyektor (>= 2) supaya cakupan tiap bidang mudah dibedakan. */}
          <div>
            <span className={label}>Warna sinar</span>
            <div className="flex items-center gap-2">
              <input type="color" aria-label="Warna sinar proyektor" value={warnaSinar} onChange={e => set({ warnaSinar: e.target.value })}
                className="h-9 w-12 rounded-lg border border-slate-200 bg-white p-0.5 cursor-pointer" />
              <span className="text-[12px] font-mono text-slate-700">{warnaSah(b.warnaSinar) ?? 'otomatis'}</span>
              {warnaSah(b.warnaSinar) && (
                <button type="button" onClick={() => set({ warnaSinar: undefined })}
                  className="ml-auto px-2 py-1 rounded-lg text-[11.5px] font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">Otomatis</button>
              )}
            </div>
            <Catatan>Hanya untuk tampilan rancangan: tiap proyektor beda warna supaya bidang yang disinarinya mudah dibedakan (area tumpang tindih tampak bercampur).</Catatan>
          </div>
        </>
      )}
    </>
  );
}
