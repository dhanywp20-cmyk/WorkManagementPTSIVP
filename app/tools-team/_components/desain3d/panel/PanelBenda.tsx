'use client';
import { type ReactNode, useState } from 'react';
import { Angka, f, Pilih, Segmen } from '../../ui';
import { barisTribun, type Benda, bendaBaru, type BentukMeja, berkasLineArray, BISA_PASANG, cakupanSpeakerPlafon, CELAH_PASANG, DISPLAY, type Finish, geserLensaDari, IFP_DIAG, isiRakDari, jangkauanDari, JENIS_RAK, type JenisPerangkatRak, type KontenLayar, kursiTribunPerBaris, LABEL_PASANG, LAYAR_DIAG, lengkungDari, lumenDari, lumenLampu, luxLampuLangsung, type ModelVW, modulLA, offsetLensaDari, PANEL_VW_AWAL, type PanelVW, type Pasang, pasangDari, type PasangProyektor, PERANGKAT_RAK, type PerangkatRak, PITCH_LED, RAK_U, RASIO_LAYAR, type RasioLayar, type Ruang, sebaranSpeaker, sebaranVSpeaker, SPEK_LAMPU, spekVideowall, sudutLampuDari, sudutModulLA, susunRak, svgElevasiRak, terapkanUkuran, throwRatioDari, tiltLADari, TINGGI_DENGAR, type TipeKamera, type TipeKursi, type TipeLampu, type TipeSpeaker, tipeSpeakerDari, TV_DIAG, ukuranBidang, VIDEOWALL, warnaSah, zoomLensa } from '../inti';
import { namaBerkas, unduhSvgPNG } from '../../cetak';
import { Ikon } from '@/components/shared/Ikon';
import { AturObjek } from './AturObjek';

/** Warna bawaan per jenis untuk pemilih warna (hanya titik awal pemilih; model tetap memakai bawaannya bila kosong). */
const WARNA_AWAL: Partial<Record<Benda['jenis'], string>> = {
  videowall: '#0a0a0a', led: '#1f2937', layar: '#111827', ifp: '#1f2937', tv: '#111111', meja: '#6c452b', kursi: '#30353d',
  speaker: '#16181c', 'speaker-plafon': '#f4f5f7', mic: '#111827', touchpanel: '#c7ccd3', kamera: '#50555d',
  proyektor: '#f1f2f4', rak: '#111827', lift: '#15171b', bidang: '#f3f4f6', panggung: '#6b6b6b', objek: '#e5e7eb',
};
/** Apa yang diwarnai, per jenis - supaya jelas bagian mana yang berubah. */
const BAGIAN_WARNA: Partial<Record<Benda['jenis'], string>> = {
  videowall: 'bezel & rangka', led: 'rangka cabinet', layar: 'bingkai', ifp: 'bezel', tv: 'bezel', meja: 'permukaan (laminasi polos)',
  kursi: 'kain / cangkang', speaker: 'kabinet & gril', 'speaker-plafon': 'cincin & gril', mic: 'badan / kain', touchpanel: 'badan',
  kamera: 'badan', proyektor: 'cangkang', rak: 'kabinet', lift: 'rangka & tutup', bidang: 'permukaan layar', objek: 'permukaan objek',
};

/**
 * Panel "Atur benda" - mengisi panel kanan di samping tampilan 3D, jadi
 * perubahan langsung terlihat tanpa menutupi kanvas.
 */
export function PanelBenda({ b, plafon, batas, onUbah, onGambar, onTutup, ekstra, onSimpanProduk, adaFoto = false, onGambarObjek }: {
  b: Benda; plafon: number; batas: { x: number; z: number };
  onUbah: (b: Benda) => void; onGambar: () => void; onTutup: () => void;
  /** Objek dari gambar: foto permukaannya ada di memori; buat ulang siluet dari gambar lain. */
  adaFoto?: boolean; onGambarObjek?: () => void;
  /** Isi tambahan khusus jenis (mis. info jarak lempar proyektor). */ ekstra?: ReactNode;
  /** Simpan benda ini sebagai template "Produk saya" (tim). Mengembalikan pesan galat atau null. Tanpa prop = tidak tersedia. */
  onSimpanProduk?: (label: string, ket: string) => Promise<string | null>;
}) {
  const [formProduk, setFormProduk] = useState<{ label: string; ket: string; status: string; sibuk: boolean } | null>(null);
  const set = (x: Partial<Benda>) => onUbah({ ...b, ...x });
  const setUkuran = (x: Partial<Benda>) => {
    const nb = terapkanUkuran({ ...b, ...x });
    //  Nama bawaan videowall ("Videowall 55" 2×2") ikut model/kolom/baris; nama yang sudah diganti engineer dibiarkan.
    if (nb.jenis === 'videowall' && /^Videowall \d+" \d+×\d+$/.test(b.nama)) nb.nama = `Videowall ${spekVideowall(nb).inci}" ${nb.kol}×${nb.bar}`;
    if (nb.jenis === 'tv' && /^Signage \d+(\.\d+)?"$/.test(b.nama)) nb.nama = `Signage ${nb.diag}"`;
    if (nb.jenis === 'tribun' && /^Tribun \d+ baris × \d+$/.test(b.nama)) nb.nama = `Tribun ${nb.baris} baris × ${nb.kursiBaris}`;
    onUbah(nb);
  };
  const label = 'block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1';
  /** Kotak semu untuk mengambil ukuran bawaan varian dari bendaBaru (posisi tidak dipakai). */
  const kosong = { x0: 0, p: 0, l: 0, t: plafon };

  //  Ukuran produk dalam mm (satuan datasheet), presisi 1 mm. Semua jenis bisa diubah - ukuran
  //  bawaan katalog bisa saja tidak persis sama dengan produk yang dipakai.
  const mm = (m: number) => Math.round(m * 1000);
  const bundar = b.jenis === 'mic' && b.mic === 'boundary';
  /** Ukuran bawaan untuk varian yang sedang dipilih (model/inci/U/tipe), atau null bila tidak ada patokan. */
  const ukuranBawaan = (): { w: number; h: number; d: number } | null => {
    if (b.jenis === 'model' || b.jenis === 'led' || b.jenis === 'objek') return null;
    const varian: Partial<Benda> = {};
    for (const k of ['vw', 'panel', 'kol', 'bar', 'diag', 'rasio', 'rakU', 'mic', 'bentukMeja', 'tipeKursi', 'tipeKamera', 'pasangProyektor', 'pasang', 'tipeSpeaker', 'modul',
      'baris', 'kursiBaris', 'tinggiAnak', 'bentukBidang', 'jariBidang', 'busur'] as const) {
      if (b[k] !== undefined) (varian as Record<string, unknown>)[k] = b[k];
    }
    const acuan = terapkanUkuran({ ...bendaBaru(b.jenis, kosong, varian), ...varian });
    return { w: acuan.w, h: acuan.h, d: acuan.d };
  };
  const bawaan = ukuranBawaan();
  const bedaBawaan = !!bawaan && (mm(bawaan.w) !== mm(b.w) || mm(bawaan.h) !== mm(b.h) || mm(bawaan.d) !== mm(b.d));
  const UKURAN_DARI_PILIHAN = ['videowall', 'layar', 'ifp', 'tv', 'rak', 'tribun', 'bidang'];

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

        {b.jenis === 'rak' && (
          <Segmen label="Tipe rack" nilai={b.tipeRak ?? 'kaca'} onUbah={(v: 'kaca' | 'tertutup' | 'open') => set({ tipeRak: v })}
            opsi={[{ v: 'kaca', l: 'Pintu kaca' }, { v: 'tertutup', l: 'Tertutup' }, { v: 'open', l: 'Open frame' }]} />
        )}
        {b.jenis === 'rak' && (
          <div className="grid grid-cols-2 gap-2">
            <Pilih label="Tinggi rack" nilai={RAK_U.includes(b.rakU ?? 20) ? b.rakU ?? 20 : -1}
              onUbah={v => { const u = v > 0 ? v : (b.rakU && !RAK_U.includes(b.rakU) ? b.rakU : 15); setUkuran({ rakU: u, nama: b.nama.startsWith('Rack') ? `Rack ${u}U` : b.nama }); }}
              opsi={[...RAK_U.map(u => ({ v: u, l: `${u}U` })), { v: -1, l: 'Custom...' }]} />
            <Pilih label="Kedalaman" nilai={[0.6, 0.8, 1.0].includes(b.d) ? b.d : -1} onUbah={v => v > 0 && set({ d: v })}
              opsi={[...[0.6, 0.8, 1.0].map(d => ({ v: d, l: `${d * 1000} mm` })), ...([0.6, 0.8, 1.0].includes(b.d) ? [] : [{ v: -1, l: `${Math.round(b.d * 1000)} mm (custom)` }])]} />
            {!RAK_U.includes(b.rakU ?? 20) && (
              <Angka label="Jumlah U" nilai={b.rakU ?? 20} satuan="U" step={1}
                onUbah={v => v >= 4 && v <= 60 && setUkuran({ rakU: Math.round(v), nama: b.nama.startsWith('Rack') ? `Rack ${Math.round(v)}U` : b.nama })} />
            )}
          </div>
        )}

        {b.jenis === 'rak' && <EditorRak b={b} onUbah={isiRak => set({ isiRak })} />}

        {b.jenis === 'lampu' && (() => {
          const tipe = b.tipeLampu ?? 'downlight';
          const bawahLampu = luxLampuLangsung(b, { p: 0, l: 0, t: plafon, lantai: 'kayu', r2: null } as Ruang, [b.x, 0.75, b.z], [0, 1, 0]);
          return (
            <div className="rounded-xl border border-amber-200 p-2.5 space-y-2 bg-amber-50/40">
              <Pilih label="Tipe lampu" nilai={tipe} onUbah={(v: TipeLampu) => {
                const baru = bendaBaru('lampu', kosong, { tipeLampu: v });
                const namaBawaan = Object.values(SPEK_LAMPU).some(sp => b.nama.startsWith(sp.label)) || b.nama.startsWith('Lampu');
                onUbah({ ...b, tipeLampu: v, w: baru.w, h: baru.h, d: baru.d, lumen: baru.lumen, sudutLampu: baru.sudutLampu, gantungLampu: baru.gantungLampu,
                  elev: Math.max(0.5, plafon - baru.h - (baru.gantungLampu ?? 0)), nama: namaBawaan ? baru.nama : b.nama });
              }} opsi={(Object.keys(SPEK_LAMPU) as TipeLampu[]).map(k => ({ v: k, l: `${SPEK_LAMPU[k].label} · ${SPEK_LAMPU[k].lumen} lm · ${SPEK_LAMPU[k].sudut}°` }))} />
              <div className="grid grid-cols-2 gap-2">
                <Angka label="Lumen" nilai={lumenLampu(b)} satuan="lm" step={100} onUbah={v => v >= 0 && v <= 50000 && set({ lumen: Math.round(v) })} />
                <Angka label="Sudut sinar" nilai={sudutLampuDari(b)} satuan="°" step={5} onUbah={v => v >= 10 && v <= 160 && set({ sudutLampu: v })} />
                <Angka label="Dimmer" nilai={b.dimmer ?? 100} satuan="%" step={5} onUbah={v => v >= 0 && v <= 100 && set({ dimmer: Math.round(v) })} />
                <Pilih label="Suhu warna" nilai={b.kelvin ?? 4000} onUbah={v => set({ kelvin: v })}
                  opsi={[{ v: 3000, l: '3000 K hangat' }, { v: 4000, l: '4000 K netral' }, { v: 6500, l: '6500 K daylight' }]} />
              </div>
              {SPEK_LAMPU[tipe].gantung > 0 && (
                <Angka label="Gantung dari plafon" nilai={b.gantungLampu ?? SPEK_LAMPU[tipe].gantung} satuan="m" step={0.05}
                  onUbah={v => v >= 0 && v <= 3 && set({ gantungLampu: v, elev: Math.max(0.5, plafon - b.h - v) })} />
              )}
              <p className="text-[12px] text-slate-600">Tepat di bawah lampu, di meja (0,75 m): ±{f(bawahLampu, 0)} lux langsung (dimmer lampu ini; tanpa pantulan & dimmer ruangan). Isi lumen & sudut sinar sesuai datasheet.</p>
            </div>
          );
        })()}
        {b.jenis === 'mic' && (
          <Segmen label="Tipe mic" nilai={b.mic ?? 'gooseneck'} onUbah={v => {
            const baru = bendaBaru('mic', { x0: 0, p: 0, l: 0, t: plafon }, { mic: v });
            onUbah({ ...b, mic: v, w: baru.w, h: baru.h, d: baru.d, nama: b.nama.startsWith('Mic') ? baru.nama : b.nama });
          }} opsi={[{ v: 'gooseneck', l: 'Gooseneck' }, { v: 'boundary', l: 'Boundary' }]} />
        )}

        {b.jenis === 'meja' && (
          <>
            <Pilih label="Bentuk meja" nilai={b.bentukMeja ?? 'rapat'} onUbah={(v: BentukMeja) => {
              const baru = bendaBaru('meja', kosong, { bentukMeja: v });
              const namaBawaan = /^(Meja|Podium|Kredensa)/.test(b.nama);
              onUbah({ ...b, bentukMeja: v, w: baru.w, h: baru.h, d: baru.d, finish: baru.finish, monitorMeja: baru.monitorMeja, nama: namaBawaan ? baru.nama : b.nama });
            }} opsi={[{ v: 'rapat', l: 'Meja rapat' }, { v: 'bulat', l: 'Meja bundar' }, { v: 'kelas', l: 'Meja kelas' }, { v: 'dosen', l: 'Meja dosen' },
              { v: 'podium', l: 'Podium' }, { v: 'kredensa', l: 'Kredensa (lemari rendah)' }, { v: 'operator', l: 'Meja operator (control room)' }] as { v: BentukMeja; l: string }[]} />
            {b.bentukMeja === 'operator' && (
              <Angka label="Jumlah monitor" nilai={b.monitorMeja ?? 4} step={1} onUbah={v => v >= 0 && v <= 12 && set({ monitorMeja: Math.round(v) })}
                bantuan="Berderet di sisi depan meja; keyboard 1 per 2 monitor" />
            )}
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
        {b.jenis === 'speaker' && (
          <Segmen label="Tipe speaker" nilai={tipeSpeakerDari(b)} onUbah={(v: TipeSpeaker) => {
            const baru = bendaBaru('speaker', kosong, { tipeSpeaker: v });
            const namaBawaan = /^(Speaker( dinding( kotak| 6")?| portable aktif)|Line array \d+ modul)$/.test(b.nama);
            onUbah({ ...b, tipeSpeaker: v, w: baru.w, h: baru.h, d: baru.d, elev: baru.elev, modul: baru.modul, sudutModul: baru.sudutModul, tiltLA: baru.tiltLA,
              gantung: v === 'linearray' ? b.gantung : undefined, nama: namaBawaan ? baru.nama : b.nama });
          }} opsi={[{ v: 'dinding6', l: 'Dinding 6"' }, { v: 'kotak', l: 'Kotak' }, { v: 'kolom', l: 'Portable' }, { v: 'linearray', l: 'Line array' }]} />
        )}
        {b.jenis === 'speaker' && tipeSpeakerDari(b) === 'linearray' && (() => {
          const n = modulLA(b), hm = b.h / n;
          const berkas = berkasLineArray(b).filter(x => x.jarak !== null);
          const dekat = berkas.length ? Math.min(...berkas.map(x => x.jarak!)) : null, jauh = berkas.length ? Math.max(...berkas.map(x => x.jarak!)) : null;
          const ubahModul = (v: number) => {
            const m = Math.max(1, Math.min(24, Math.round(v)));
            onUbah({ ...b, modul: m, h: hm * m, nama: /^Line array \d+ modul$/.test(b.nama) ? `Line array ${m} modul` : b.nama });
          };
          return (
            <div className="rounded-xl border border-slate-200 p-2.5 space-y-2 bg-slate-50/60">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Line array</p>
              <div className="flex items-end gap-2">
                <div className="flex-1"><Angka label="Jumlah modul" nilai={n} step={1} onUbah={v => v >= 1 && v <= 24 && ubahModul(v)} /></div>
                <button type="button" aria-label="Kurangi modul" onClick={() => ubahModul(n - 1)} disabled={n <= 1}
                  className="h-9 w-9 rounded-lg border border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40">−</button>
                <button type="button" aria-label="Tambah modul" onClick={() => ubahModul(n + 1)} disabled={n >= 24}
                  className="h-9 w-9 rounded-lg border border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40">+</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Angka label="Sudut antar modul" nilai={sudutModulLA(b)} satuan="°" step={0.5} bantuan="splay tiap sambungan"
                  onUbah={v => v >= 0 && v <= 15 && set({ sudutModul: Math.round(v * 10) / 10 })} />
                <Angka label="Kemiringan atas" nilai={tiltLADari(b)} satuan="°" step={0.5} min={-30} bantuan="+ = menunduk"
                  onUbah={v => v >= -30 && v <= 60 && set({ tiltLA: Math.round(v * 10) / 10 })} />
              </div>
              <label className="flex items-center gap-2 text-[12.5px] text-slate-700">
                <input type="checkbox" className="w-4 h-4" checked={!!b.gantung}
                  onChange={e => set(e.target.checked
                    ? { gantung: true, elev: Math.max(0.5, Math.round((plafon - 0.6 - b.h) * 100) / 100), tiltLA: b.tiltLA ?? 4, sudutModul: b.sudutModul || 2 }
                    : { gantung: false, elev: 0 })} />
                Digantung dari plafon (flown)
              </label>
              <p className="text-[12px] text-slate-600 leading-relaxed">
                Tinggi per modul {Math.round(hm * 1000)} mm · total lengkung {f(tiltLADari(b) + (n - 1) * sudutModulLA(b), 1)}°.
                {dekat !== null && jauh !== null
                  ? <> Sumbu modul jatuh di tinggi telinga ({f(TINGGI_DENGAR)} m) dari <b>{f(dekat, 1)} m</b> sampai <b>{f(jauh, 1)} m</b>{berkas.length < n ? ` (${n - berkas.length} modul teratas mengarah ke jauh)` : ''}.</>
                  : <> Sumbu modul belum turun ke tinggi telinga - tambah kemiringan atas / sudut antar modul agar suara menjangkau penonton.</>}
              </p>
            </div>
          );
        })()}
        {(b.jenis === 'speaker' || b.jenis === 'speaker-plafon') && (
          <>
            <label className="flex items-center gap-2 text-[12.5px] font-semibold text-slate-800">
              <input type="checkbox" className="w-4 h-4" checked={!!b.tampilJangkauan} onChange={e => set({ tampilJangkauan: e.target.checked })} />
              Tampilkan jangkauan suara speaker ini
            </label>
            <p className="text-[11px] text-slate-500 -mt-1">
              {tipeSpeakerDari(b) === 'linearray' && b.jenis === 'speaker'
                ? 'Warna = modul: jingga (modul teratas, ke jauh) → hijau → biru (modul terbawah, ke dekat). Bola = titik jatuh sumbu modul di tinggi telinga 1,2 m.'
                : 'Kerucut jingga = sebaran suara (H × V) sampai jarak jangkauan.'}
              {' '}Centang "Jangkauan speaker" di kanvas untuk menampilkan semua speaker sekaligus.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <Angka label="Sebaran H" nilai={sebaranSpeaker(b)} satuan="°" step={1} bantuan="horizontal (datasheet)"
                onUbah={v => v >= 10 && v <= 180 && set({ sebaran: v })} />
              {b.jenis === 'speaker' && (
                <Angka label={tipeSpeakerDari(b) === 'linearray' ? 'Sebaran V/modul' : 'Sebaran V'} nilai={sebaranVSpeaker(b)} satuan="°" step={1} bantuan="vertikal"
                  onUbah={v => v >= 4 && v <= 180 && set({ sebaranV: v })} />
              )}
              {b.jenis === 'speaker' && (
                <Angka label="Jangkauan" nilai={jangkauanDari(b)} satuan="m" step={0.5} onUbah={v => v >= 0.5 && v <= 60 && set({ jangkauan: v })} />
              )}
            </div>
            {b.jenis === 'speaker-plafon' && (
              <p className="text-[12px] text-slate-600">
                Cakupan di tinggi telinga duduk ({f(TINGGI_DENGAR)} m): lingkaran Ø {f(cakupanSpeakerPlafon(b) * 2)} m.
                {' '}Jarak antar speaker plafon ±{f(cakupanSpeakerPlafon(b) * Math.SQRT2)} m untuk cakupan rata (pola kotak).
              </p>
            )}
          </>
        )}

        {b.jenis === 'tribun' && (
          <div className="rounded-xl border border-slate-200 p-2.5 space-y-2 bg-slate-50/60">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Tribun</p>
            <div className="grid grid-cols-2 gap-2">
              <Angka label="Jumlah baris" nilai={barisTribun(b)} step={1} onUbah={v => v >= 1 && v <= 60 && setUkuran({ baris: Math.round(v) })} />
              <Angka label="Kursi per baris" nilai={kursiTribunPerBaris(b)} step={1} onUbah={v => v >= 1 && v <= 80 && setUkuran({ kursiBaris: Math.round(v) })} />
              <Angka label="Tinggi anak tangga" nilai={b.tinggiAnak ?? 0.35} satuan="m" step={0.05} onUbah={v => v >= 0.1 && v <= 1 && setUkuran({ tinggiAnak: v })} />
            </div>
            <p className="text-[12px] text-slate-600">{barisTribun(b) * kursiTribunPerBaris(b)} kursi · kedalaman baris {f(b.d / barisTribun(b))} m · baris teratas {f((barisTribun(b) - 1) * (b.tinggiAnak ?? 0.35))} m dari lantai. Kursinya ikut dihitung di Analisis tampilan.</p>
          </div>
        )}
        {b.jenis === 'bidang' && (() => {
          const u = ukuranBidang(b);
          const bentuk = b.bentukBidang ?? 'lengkung';
          const NAMA_BIDANG: Record<string, string> = { datar: 'Layar mapping datar', lengkung: 'Layar mapping cekung', cembung: 'Layar mapping cembung' };
          const namaBawaan = /^(Bidang|Layar) mapping (lengkung|cekung|cembung|datar)$/.test(b.nama);
          //  Ganti bentuk dengan lebar tetap: datar -> lengkung 10% dari lebar, lengkung -> datar selebar tali busurnya.
          const gantiBentuk = (v: 'datar' | 'lengkung' | 'cembung') => {
            const lebar = u.busur >= 180 ? 4 : u.w;
            const x: Partial<Benda> = v === 'datar' ? { bentukBidang: v, w: lebar } : { bentukBidang: v, ...(bentuk === 'datar' || u.busur >= 180 ? lengkungDari(lebar, lebar * 0.1) : {}) };
            const nb = terapkanUkuran({ ...b, ...x });
            if (namaBawaan) nb.nama = NAMA_BIDANG[v];
            onUbah(nb);
          };
          const busurPenuh = bentuk !== 'datar' && u.busur >= 180;
          return (
            <div className="rounded-xl border border-slate-200 p-2.5 space-y-2 bg-slate-50/60">
              <Segmen label="Bentuk layar / bidang" nilai={bentuk} onUbah={gantiBentuk}
                opsi={[{ v: 'datar', l: 'Datar' }, { v: 'lengkung', l: 'Cekung' }, { v: 'cembung', l: 'Cembung' }]} />
              {bentuk === 'datar' ? (
                <Angka label="Lebar layar" nilai={u.w} satuan="m" step={0.1} onUbah={v => v >= 0.2 && v <= 60 && setUkuran({ w: v })} />
              ) : !busurPenuh && (
                <div className="grid grid-cols-2 gap-2">
                  <Angka label="Lebar layar" nilai={u.w} satuan="m" step={0.1} bantuan="Lurus ujung ke ujung"
                    onUbah={v => v >= 0.2 && v <= 60 && setUkuran(lengkungDari(v, Math.min(u.d, v / 2)))} />
                  <Angka label="Kedalaman lengkung" nilai={Math.round(u.d * 100)} satuan="cm" step={5} bantuan={bentuk === 'cembung' ? 'Tengah maju ke penonton' : 'Tengah masuk ke belakang'}
                    onUbah={v => v >= 1 && v / 100 <= u.w / 2 && setUkuran(lengkungDari(u.w, v / 100))} />
                </div>
              )}
              {bentuk !== 'datar' && (
                <div className="grid grid-cols-2 gap-2">
                  <Angka label="Jari-jari" nilai={u.R} satuan="m" step={0.1} onUbah={v => v >= 0.2 && v <= 50 && setUkuran({ jariBidang: v })} />
                  <Angka label="Busur" nilai={u.busur} satuan="°" step={5} bantuan="360° = pilar / silinder" onUbah={v => v >= 10 && v <= 360 && setUkuran({ busur: v })} />
                </div>
              )}
              <p className="text-[12px] text-slate-600">
                {bentuk === 'datar' ? `Layar ${f(u.w)} × ${f(b.h)} m.` : `Panjang permukaan ${f(u.R * u.busur * Math.PI / 180)} m × tinggi ${f(b.h)} m · tapak ${f(u.w)} × ${f(u.d)} m.`}
                {' '}Tinggi & warna permukaan diatur di bagian Ukuran dan Warna. Arahkan proyektor ke layar ini - sinarnya jatuh mengikuti permukaannya.
              </p>
            </div>
          );
        })()}
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
        {(b.jenis === 'model' || b.jenis === 'objek') && <AturObjek b={b} set={set} adaFoto={adaFoto} onGambarBaru={() => onGambarObjek?.()} />}
        {ekstra}

        {b.jenis !== 'model' && (
          <div>
            <span className={label}>Warna{BAGIAN_WARNA[b.jenis] ? ` · ${BAGIAN_WARNA[b.jenis]}` : ''}</span>
            <div className="flex items-center gap-2">
              <input type="color" aria-label="Warna utama" value={warnaSah(b.warna) ?? WARNA_AWAL[b.jenis] ?? '#808080'}
                onChange={e => set({ warna: e.target.value })}
                className="h-9 w-12 rounded-lg border border-slate-200 bg-white p-0.5 cursor-pointer" />
              <span className="text-[12px] font-mono text-slate-700">{warnaSah(b.warna) ?? 'bawaan'}</span>
              {warnaSah(b.warna) && (
                <button type="button" onClick={() => set({ warna: undefined })}
                  className="ml-auto px-2 py-1 rounded-lg text-[11.5px] font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">Warna bawaan</button>
              )}
            </div>
          </div>
        )}

        <div>
          <span className={label}>Ukuran produk</span>
          <div className="grid grid-cols-3 gap-2">
            <Angka label={bundar ? 'Diameter (mm)' : 'Lebar (mm)'} nilai={mm(b.w)} step={1}
              onUbah={v => v >= 5 && v <= 30000 && set(bundar ? { w: v / 1000, d: v / 1000 } : { w: v / 1000 })} />
            <Angka label="Tinggi (mm)" nilai={mm(b.h)} step={1} onUbah={v => v >= 2 && v <= 15000 && set({ h: v / 1000 })} />
            {!bundar && (
              <Angka label={b.jenis === 'meja' ? 'Panjang (mm)' : 'Tebal (mm)'} nilai={mm(b.d)} step={1}
                onUbah={v => v >= 2 && v <= 30000 && set({ d: v / 1000 })} />
            )}
          </div>
          {bawaan && bedaBawaan && (
            <button type="button" onClick={() => set(bawaan)}
              className="mt-1.5 w-full px-2 py-1.5 rounded-lg text-[11.5px] font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
              Kembalikan ukuran bawaan ({mm(bawaan.w)} × {mm(bawaan.h)} × {mm(bawaan.d)} mm)
            </button>
          )}
          <p className="text-[11px] text-slate-500 mt-1">
            {UKURAN_DARI_PILIHAN.includes(b.jenis)
              ? 'Terisi otomatis dari model/inci/U yang dipilih. Ganti dengan angka datasheet bila berbeda; memilih model/inci/U lagi mengembalikan ukuran bawaannya.'
              : 'Sesuaikan dengan datasheet / ukuran produk sebenarnya (presisi 1 mm).'}
          </p>
        </div>

        <div>
          <span className={label}>Posisi</span>
          <div className="grid grid-cols-2 gap-2">
            <Angka label="X" nilai={b.x} satuan="m" onUbah={v => set({ x: Math.min(batas.x, Math.max(0, v)) })} />
            <Angka label="Z" nilai={b.z} satuan="m" onUbah={v => set({ z: Math.min(batas.z, Math.max(0, v)) })} />
            <Angka label="Putar" nilai={b.rot} satuan="°" onUbah={v => set({ rot: ((v % 360) + 360) % 360 })} />
            <Angka label="Dari lantai" nilai={Math.round(b.elev * 100) / 100} satuan="m" onUbah={v => v >= 0 && set({ elev: Math.min(Math.max(0, plafon - b.h), v) })} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-[12.5px] text-slate-700">
          <input type="checkbox" className="w-4 h-4" checked={!b.sembunyiLabel} onChange={e => set({ sembunyiLabel: e.target.checked ? undefined : true })} />
          Tampilkan label produk benda ini
        </label>
        {DISPLAY.includes(b.jenis) && (
          <div className="space-y-2">
            <Pilih label="Konten layar" nilai={b.konten ?? 'pola'} onUbah={(v: KontenLayar) => (v === 'gambar' ? onGambar() : set({ konten: v }))}
              opsi={[
                { v: 'pola', l: 'Pola uji (color bar)' }, { v: 'campuran', l: 'Command center: grafik + CCTV' }, { v: 'cctv', l: 'CCTV (grid kamera)' },
                { v: 'dashboard', l: 'Dashboard / grafik' }, { v: 'desktop', l: 'Home screen (IFP / signage)' }, { v: 'gambar', l: 'Gambar unggahan...' }, { v: 'mati', l: 'Mati (layar hitam)' },
              ] as { v: KontenLayar; l: string }[]} />
            <label className="flex items-center gap-2 text-[12.5px] text-slate-700">
              <input type="checkbox" className="w-4 h-4" checked={!b.sembunyiUkur} onChange={e => set({ sembunyiUkur: e.target.checked ? undefined : true })} />
              Tampilkan garis ukuran (mm) benda ini
            </label>
          </div>
        )}

        {onSimpanProduk && b.jenis !== 'model' && b.jenis !== 'objek' && (
          <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-2.5">
            {!formProduk ? (
              <button type="button" onClick={() => setFormProduk({ label: b.nama, ket: '', status: '', sibuk: false })}
                className="w-full px-3 py-2 rounded-lg text-[12.5px] font-bold text-violet-800 bg-white border border-violet-200 hover:bg-violet-100">
                <Ikon nama="⭐" ukuran={14} /> Simpan ke Produk saya
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-violet-800">Simpan sebagai template tim</p>
                <input value={formProduk.label} maxLength={80} onChange={e => setFormProduk({ ...formProduk, label: e.target.value })} placeholder="Nama produk (mis. Samsung QM55C)"
                  aria-label="Nama produk" className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-base sm:text-sm" />
                <input value={formProduk.ket} maxLength={120} onChange={e => setFormProduk({ ...formProduk, ket: e.target.value })} placeholder="Keterangan (opsional, mis. merek / tipe)"
                  aria-label="Keterangan produk" className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-base sm:text-sm" />
                <p className="text-[11px] text-slate-600">Disimpan: ukuran, model, warna, spesifikasi & tinggi pasang - muncul di Tambah → Produk saya untuk seluruh tim.</p>
                {formProduk.status && <p className="text-[12px] font-semibold text-rose-700">{formProduk.status}</p>}
                <div className="flex gap-2">
                  <button type="button" disabled={formProduk.sibuk || !formProduk.label.trim()}
                    onClick={async () => {
                      setFormProduk({ ...formProduk, sibuk: true, status: '' });
                      const galat = await onSimpanProduk(formProduk.label.trim(), formProduk.ket.trim());
                      if (galat) setFormProduk({ ...formProduk, sibuk: false, status: galat }); else setFormProduk(null);
                    }}
                    className="flex-1 px-3 py-1.5 rounded-lg text-[12.5px] font-bold text-white bg-violet-700 hover:bg-violet-800 disabled:opacity-50">
                    {formProduk.sibuk ? 'Menyimpan...' : 'Simpan'}
                  </button>
                  <button type="button" onClick={() => setFormProduk(null)}
                    className="px-3 py-1.5 rounded-lg text-[12.5px] font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">Batal</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Rack elevation: isi rack per U (urutan dari atas), diagram, dan unduh PNG. */
function EditorRak({ b, onUbah }: { b: Benda; onUbah: (isi: PerangkatRak[] | undefined) => void }) {
  const [buka, setBuka] = useState(false);
  const isi = isiRakDari(b);
  const s = susunRak(b);
  const ubah = (i: number, x: Partial<PerangkatRak>) => onUbah(isi.map((p, j) => (j === i ? { ...p, ...x } : p)));
  const pindah = (i: number, arah: -1 | 1) => {
    const j = i + arah; if (j < 0 || j >= isi.length) return;
    const baru = [...isi]; [baru[i], baru[j]] = [baru[j], baru[i]]; onUbah(baru);
  };
  const [png, setPng] = useState<'siap' | 'proses' | 'gagal'>('siap');
  const unduh = async () => {
    setPng('proses');
    try { await unduhSvgPNG(svgElevasiRak(b), namaBerkas('Rack elevation', b.nama), 2); setPng('siap'); }
    catch { setPng('gagal'); setTimeout(() => setPng('siap'), 2500); }
  };
  return (
    <div className="rounded-xl border border-slate-200 p-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-bold text-slate-800">Rack elevation</span>
        <span className={`text-[12px] tabular-nums font-semibold ${s.lewat ? 'text-rose-700' : 'text-slate-600'}`}>{s.terpakai + s.lewat} / {s.U} U</span>
      </div>
      <div className="rounded-lg border border-slate-100 bg-white p-1 [&>svg]:mx-auto [&>svg]:block max-h-72 overflow-y-auto" dangerouslySetInnerHTML={{ __html: svgElevasiRak(b, false) }} />
      {s.lewat > 0 && <p className="text-[11.5px] font-semibold text-rose-700">Melebihi kapasitas {s.lewat}U - kurangi perangkat atau tinggikan rack.</p>}
      <div className="flex gap-1.5 flex-wrap">
        <button type="button" onClick={() => setBuka(v => !v)} className="px-2.5 py-1.5 rounded-lg text-[12px] font-bold border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100">
          {buka ? 'Tutup editor' : 'Atur isi rack'}
        </button>
        <button type="button" onClick={() => void unduh()} disabled={png === 'proses'} className="px-2.5 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          {png === 'proses' ? '...' : png === 'gagal' ? 'PNG gagal' : 'PNG'}
        </button>
        {b.isiRak?.length ? <button type="button" onClick={() => onUbah(undefined)} className="px-2.5 py-1.5 rounded-lg text-[12px] font-semibold text-slate-600 hover:underline">Isi bawaan</button> : null}
      </div>
      {buka && (
        <div className="space-y-1.5">
          <p className="text-[11px] text-slate-500">Urutan dari atas (U{s.U}) ke bawah (U1). Ikut tergambar di rack 3D, cetak, dan PNG.</p>
          {isi.map((p, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_52px_auto] gap-1 items-center">
              <div className="min-w-0 space-y-1">
                <select value={p.jenis} aria-label={`Jenis perangkat ${i + 1}`}
                  onChange={e => { const j = e.target.value as JenisPerangkatRak; ubah(i, { jenis: j, u: PERANGKAT_RAK[j].u, nama: PERANGKAT_RAK[j].label }); }}
                  className="w-full rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[12px]">
                  {JENIS_RAK.map(j => <option key={j} value={j}>{PERANGKAT_RAK[j].label}</option>)}
                </select>
                <input value={p.nama} maxLength={60} aria-label={`Nama perangkat ${i + 1}`} onChange={e => ubah(i, { nama: e.target.value })}
                  className="w-full rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[12px]" />
              </div>
              <input type="number" min={1} max={12} step={1} value={p.u} aria-label={`Tinggi U perangkat ${i + 1}`}
                onChange={e => { const v = Math.round(Number(e.target.value)); if (v >= 1 && v <= 12) ubah(i, { u: v }); }}
                className="w-full rounded-md border border-slate-200 bg-white px-1 py-1 text-[12px] text-center tabular-nums" />
              <div className="flex flex-col">
                <button type="button" aria-label="Naikkan" onClick={() => pindah(i, -1)} className="px-1.5 text-[11px] text-slate-600 hover:text-blue-700">▲</button>
                <button type="button" aria-label="Turunkan" onClick={() => pindah(i, 1)} className="px-1.5 text-[11px] text-slate-600 hover:text-blue-700">▼</button>
                <button type="button" aria-label="Hapus" onClick={() => onUbah(isi.filter((_, j) => j !== i))} className="px-1.5 text-[11px] text-rose-600 hover:text-rose-800">✕</button>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => onUbah([...isi, { jenis: 'switch', u: 1, nama: PERANGKAT_RAK.switch.label }])}
            className="w-full py-1.5 rounded-lg border border-dashed border-slate-300 text-[12px] font-semibold text-slate-600 hover:bg-slate-50">+ Tambah perangkat</button>
        </div>
      )}
    </div>
  );
}
