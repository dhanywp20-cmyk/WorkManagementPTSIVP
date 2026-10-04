'use client';
import type { ReactNode } from 'react';
import { Angka, Pilih, Segmen, f } from '../ui';
import { Ikon } from '@/components/shared/Ikon';
import {
  type Benda, type ModelVW, type BentukMeja, type Finish, type TipeKursi, type TipeKamera, type PasangProyektor, DISPLAY, VIDEOWALL, LAYAR_DIAG, RAK_U, PITCH_LED, terapkanUkuran, bendaBaru,
} from './model';

/**
 * Panel "Atur benda" - melayang di atas tampilan 3D supaya perubahan langsung
 * terlihat tanpa menutup apa pun.
 */
export function PanelBenda({ b, plafon, batas, onUbah, onGambar, onTutup, ekstra }: {
  b: Benda; plafon: number; batas: { x: number; z: number };
  onUbah: (b: Benda) => void; onGambar: () => void; onTutup: () => void;
  /** Isi tambahan khusus jenis (mis. info jarak lempar proyektor). */ ekstra?: ReactNode;
}) {
  const set = (x: Partial<Benda>) => onUbah({ ...b, ...x });
  const setUkuran = (x: Partial<Benda>) => onUbah(terapkanUkuran({ ...b, ...x }));
  const label = 'block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1';
  /** Kotak semu untuk mengambil ukuran bawaan varian dari bendaBaru (posisi tidak dipakai). */
  const kosong = { x0: 0, p: 0, l: 0, t: plafon };

  return (
    <div className="absolute top-2 right-2 bottom-2 z-10 w-[310px] max-w-[calc(100%-16px)] flex flex-col rounded-xl bg-white/95 backdrop-blur border border-slate-200 shadow-xl">
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

        {b.jenis === 'videowall' && (
          <>
            <Pilih label="Model panel" nilai={b.vw ?? '55BDL2105X'} onUbah={(v: ModelVW) => setUkuran({ vw: v })}
              opsi={(Object.keys(VIDEOWALL) as ModelVW[]).map(k => ({ v: k, l: `${VIDEOWALL[k].nama} (${VIDEOWALL[k].inci}")` }))} />
            <div className="grid grid-cols-2 gap-2">
              <Angka label="Kolom" nilai={b.kol ?? 2} step={1} onUbah={v => v >= 1 && v <= 12 && setUkuran({ kol: Math.round(v) })} />
              <Angka label="Baris" nilai={b.bar ?? 2} step={1} onUbah={v => v >= 1 && v <= 8 && setUkuran({ bar: Math.round(v) })} />
            </div>
            {(() => {
              const s = VIDEOWALL[b.vw ?? '55BDL2105X']; const n = (b.kol ?? 2) * (b.bar ?? 2);
              return (
                <p className="text-[12px] text-slate-600 leading-relaxed">
                  Panel {s.w * 1000} × {s.h * 1000} × {s.d * 1000} mm, bezel {s.bezelMm} mm. Total {f(b.w)} × {f(b.h)} m,
                  {' '}{(b.kol ?? 2) * 1920} × {(b.bar ?? 2) * 1080} px, {n} panel, daya ±{f((n * s.wTipikal) / 1000, 2)} kW (maks {f((n * s.wMaks) / 1000, 2)} kW).
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
            <Segmen label="Rasio" nilai={b.rasio ?? '16:9'} onUbah={v => setUkuran({ rasio: v })} opsi={[{ v: '16:9', l: '16:9' }, { v: '4:3', l: '4:3' }]} />
            <p className="text-[12px] text-slate-600">Area gambar {f(b.w)} × {f(b.h)} m.</p>
          </>
        )}

        {b.jenis === 'ifp' && (
          <>
            <Segmen label="Ukuran" nilai={String(b.diag ?? 75)} onUbah={v => setUkuran({ diag: Number(v) })}
              opsi={['65', '75', '86'].map(v => ({ v, l: `${v}"` }))} />
            <p className="text-[12px] text-slate-600">{f(b.w * 1000, 0)} × {f(b.h * 1000, 0)} mm (ukuran umum kelas ini - sesuaikan datasheet).</p>
          </>
        )}

        {b.jenis === 'tv' && (
          <Angka label="Diagonal" nilai={b.diag ?? 65} satuan="inci" onUbah={v => v >= 20 && v <= 120 && setUkuran({ diag: v })} />
        )}

        {(b.jenis === 'videowall' || b.jenis === 'ifp' || b.jenis === 'tv') && (
          <Segmen label="Pemasangan" nilai={b.pasang ?? 'dinding'} onUbah={v => set({ pasang: v, elev: v === 'standfloor' && b.elev > 1 ? 0.72 : b.elev })}
            opsi={[{ v: 'dinding', l: 'Dinding' }, { v: 'standfloor', l: 'Standfloor' }]} />
        )}

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

        {b.jenis === 'rak' && (
          <div className="grid grid-cols-2 gap-2">
            <Pilih label="Tinggi rack" nilai={b.rakU ?? 20} onUbah={v => setUkuran({ rakU: v, nama: `Rack ${v}U` })} opsi={RAK_U.map(u => ({ v: u, l: `${u}U` }))} />
            <Pilih label="Kedalaman" nilai={b.d} onUbah={v => set({ d: v })} opsi={[0.6, 0.8, 1.0].map(d => ({ v: d, l: `${d * 1000} mm` }))} />
          </div>
        )}

        {b.jenis === 'mic' && (
          <Segmen label="Tipe mic" nilai={b.mic ?? 'gooseneck'} onUbah={v => {
            const baru = bendaBaru('mic', { x0: 0, p: 0, l: 0, t: plafon }, { mic: v });
            onUbah({ ...b, mic: v, w: baru.w, h: baru.h, d: baru.d, nama: b.nama.startsWith('Mic') ? baru.nama : b.nama });
          }} opsi={[{ v: 'gooseneck', l: 'Gooseneck' }, { v: 'boundary', l: 'Boundary' }]} />
        )}

        {b.jenis === 'meja' && (
          <>
            <Segmen label="Bentuk meja" nilai={b.bentukMeja ?? 'rapat'} onUbah={(v: BentukMeja) => {
              const baru = bendaBaru('meja', kosong, { bentukMeja: v });
              onUbah({ ...b, bentukMeja: v, w: baru.w, d: baru.d, finish: baru.finish, nama: b.nama.startsWith('Meja') ? baru.nama : b.nama });
            }} opsi={[{ v: 'rapat', l: 'Rapat' }, { v: 'bulat', l: 'Bundar' }, { v: 'kelas', l: 'Kelas' }]} />
            <Segmen label="Permukaan" nilai={b.finish ?? (b.bentukMeja === 'kelas' ? 'oak' : 'walnut')} onUbah={(v: Finish) => set({ finish: v })}
              opsi={[{ v: 'walnut', l: 'Walnut' }, { v: 'oak', l: 'Oak' }, { v: 'putih', l: 'Putih' }]} />
            {b.bentukMeja === 'bulat' && <p className="text-[12px] text-slate-600">Lebar = Panjang untuk bundar; beda nilai = oval.</p>}
          </>
        )}

        {b.jenis === 'kursi' && (
          <Segmen label="Tipe kursi" nilai={b.tipeKursi ?? 'kantor'} onUbah={(v: TipeKursi) => {
            const baru = bendaBaru('kursi', kosong, { tipeKursi: v });
            onUbah({ ...b, tipeKursi: v, w: baru.w, h: baru.h, d: baru.d, nama: b.nama.startsWith('Kursi') ? baru.nama : b.nama });
          }} opsi={[{ v: 'kantor', l: 'Kantor (beroda)' }, { v: 'kelas', l: 'Kelas' }]} />
        )}

        {b.jenis === 'kamera' && (
          <Segmen label="Tipe kamera" nilai={b.tipeKamera ?? 'ptz'} onUbah={(v: TipeKamera) => {
            const baru = bendaBaru('kamera', kosong, { tipeKamera: v });
            const namaBawaan = ['Kamera', 'Kamera PTZ', 'Kamera PTZ AI', 'Camera soundbar'].includes(b.nama);
            onUbah({ ...b, tipeKamera: v, w: baru.w, h: baru.h, d: baru.d, nama: namaBawaan ? baru.nama : b.nama });
          }} opsi={[{ v: 'ptz', l: 'PTZ' }, { v: 'ptz-ai', l: 'PTZ AI' }, { v: 'xbar', l: 'Soundbar' }]} />
        )}

        {b.jenis === 'lift' && (
          <>
            <Segmen label="Layar" nilai={b.naik === false ? 'turun' : 'naik'} onUbah={v => set({ naik: v === 'naik' })}
              opsi={[{ v: 'naik', l: 'Naik' }, { v: 'turun', l: 'Turun (rata meja)' }]} />
            <p className="text-[12px] text-slate-600">Letakkan di atas meja: "Dari lantai" = tinggi meja (umumnya 0,75 m).</p>
          </>
        )}

        {b.jenis === 'proyektor' && (
          <>
            <Segmen label="Pemasangan" nilai={b.pasangProyektor ?? 'plafon'} onUbah={(v: PasangProyektor) => {
              const baru = bendaBaru('proyektor', kosong, { pasangProyektor: v });
              const namaBawaan = ['Proyektor', 'Proyektor plafon', 'Proyektor portabel'].includes(b.nama);
              onUbah({ ...b, pasangProyektor: v, w: baru.w, h: baru.h, d: baru.d, elev: baru.elev, nama: namaBawaan ? baru.nama : b.nama });
            }} opsi={[{ v: 'plafon', l: 'Gantung plafon' }, { v: 'meja', l: 'Portabel di meja' }]} />
            <Angka label="Throw ratio lensa" nilai={b.throwRatio ?? 1.5} satuan=": 1" step={0.01}
              onUbah={v => v >= 0.2 && v <= 10 && set({ throwRatio: Math.round(v * 100) / 100 })}
              bantuan="Jarak lempar ÷ lebar gambar (lihat datasheet; lensa zoom = rentang)." />
          </>
        )}
        {ekstra}

        {!['videowall', 'layar', 'ifp', 'tv', 'rak', 'mic', 'lift'].includes(b.jenis) && (
          <div className="grid grid-cols-3 gap-2">
            <Angka label="Lebar" nilai={Math.round(b.w * 100) / 100} satuan="m" onUbah={v => v > 0 && set({ w: v })} />
            <Angka label="Tinggi" nilai={Math.round(b.h * 100) / 100} satuan="m" onUbah={v => v > 0 && set({ h: v })} />
            <Angka label={b.jenis === 'meja' ? 'Panjang' : 'Tebal'} nilai={Math.round(b.d * 100) / 100} satuan="m" onUbah={v => v > 0 && set({ d: v })} />
          </div>
        )}

        <div>
          <span className={label}>Posisi</span>
          <div className="grid grid-cols-2 gap-2">
            <Angka label="X" nilai={b.x} satuan="m" onUbah={v => set({ x: Math.min(batas.x, Math.max(0, v)) })} />
            <Angka label="Z" nilai={b.z} satuan="m" onUbah={v => set({ z: Math.min(batas.z, Math.max(0, v)) })} />
            <Angka label="Putar" nilai={b.rot} satuan="°" onUbah={v => set({ rot: ((v % 360) + 360) % 360 })} />
            <Angka label="Dari lantai" nilai={Math.round(b.elev * 100) / 100} satuan="m" onUbah={v => v >= 0 && set({ elev: Math.min(Math.max(0, plafon - b.h), v) })} />
          </div>
        </div>

        {DISPLAY.includes(b.jenis) && (
          <Segmen label="Konten layar" nilai={b.konten ?? 'pola'} onUbah={v => (v === 'gambar' ? onGambar() : set({ konten: v }))}
            opsi={[{ v: 'pola', l: 'Pola uji' }, { v: 'gambar', l: 'Gambar...' }, { v: 'mati', l: 'Mati' }]} />
        )}
      </div>
    </div>
  );
}
