'use client';
import { Copy } from 'lucide-react';
import { Angka, f, Pilih, Segmen, Catatan } from '../../bersama/ui';
import { type Benda, type Bukaan, daftarRuang, JENDELA_AWAL, type Kotak, LUX_LUAR, luxBidangKerja, luxSiang, MAKS_RUANG, panjangDinding, pintuSekat, type Ruang, ruangDari, type RuangSambung, sambungan, sambunganKe, type Siang, type SisiDinding, sisiLuar, ukuranPintu } from '../inti';
import { PilihWarna } from './ModalBuka';

/** Panel samping "Ruangan": ukuran, lantai, dinding, cahaya, bukaan, ruang tambahan & salin isi (dipisah dari Desain3D.tsx). */
export function PanelRuang({ ruang, setRuang, ubahUkuran, benda, kotakRuang, tambahBukaan, ubahBukaan, tambahRuang, hapusRuangTerakhir, ubahSambungan, pasangSambungan, gantiIsi, setGantiIsi, salinIsiRuang, duaRuang }: {
  ruang: Ruang;
  setRuang: (fn: (r: Ruang) => Ruang) => void;
  ubahUkuran: (fn: (r: Ruang) => Ruang) => void;
  benda: Benda[];
  kotakRuang: Kotak[];
  tambahBukaan: (jenis: Bukaan['jenis']) => void;
  ubahBukaan: (id: string, x: Partial<Bukaan>) => void;
  tambahRuang: () => void;
  hapusRuangTerakhir: () => void;
  ubahSambungan: (j: number, x: Partial<RuangSambung>, ukur?: boolean) => void;
  pasangSambungan: (r: Ruang, j: number, x: RuangSambung | null) => Ruang;
  gantiIsi: boolean;
  setGantiIsi: (v: boolean) => void;
  salinIsiRuang: (asal: number, ganti: boolean, ke?: number) => void;
  duaRuang: boolean;
}) {
  return (
    <>
      <div className="space-y-4">
        <div>
          <p className="text-[12.5px] font-bold text-slate-800 mb-1.5">Ruang 1</p>
          <div className="grid grid-cols-3 gap-2">
            <Angka label="Panjang" nilai={ruang.p} onUbah={v => v >= 2 && v <= 30 && ubahUkuran(r => ({ ...r, p: v }))} satuan="m" />
            <Angka label="Lebar" nilai={ruang.l} onUbah={v => v >= 2 && v <= 30 && ubahUkuran(r => ({ ...r, l: v }))} satuan="m" />
            <Angka label="Plafon" nilai={ruang.t} onUbah={v => v >= 2 && v <= 15 && ubahUkuran(r => ({ ...r, t: v }))} satuan="m" />
          </div>
          <div className="mt-2">
            <Segmen label="Lantai" nilai={ruang.lantai} onUbah={v => setRuang(r => ({ ...r, lantai: v }))}
              opsi={[{ v: 'kayu', l: 'Kayu' }, { v: 'karpet', l: 'Karpet' }, { v: 'keramik', l: 'Keramik' }, { v: 'polos', l: 'Warna' }]} />
            {ruang.lantai === 'polos' && (
              <PilihWarna label="Warna lantai" nilai={ruang.warnaLantai} awal="#9ca3af" onUbah={w => setRuang(r => ({ ...r, warnaLantai: w }))} />
            )}
          </div>
        </div>
        <PilihWarna label="Warna dinding (semua ruang)" nilai={ruang.warnaDinding} awal="#f5f5f4" onUbah={w => setRuang(r => ({ ...r, warnaDinding: w }))} />
        <Segmen label="Dinding depan (feature wall)" nilai={ruang.dindingDepan ?? 'polos'} onUbah={(v: 'polos' | 'marmer' | 'kayu') => setRuang(r => ({ ...r, dindingDepan: v }))}
          opsi={[{ v: 'polos', l: 'Polos' }, { v: 'marmer', l: 'Marmer' }, { v: 'kayu', l: 'Panel kayu' }]} />
        <div>
          <Segmen label="Cahaya ruangan" nilai={ruang.cahaya ?? 'terang'} onUbah={v => setRuang(r => ({ ...r, cahaya: v }))}
            opsi={[{ v: 'terang', l: 'Terang' }, { v: 'redup', l: 'Redup' }, { v: 'gelap', l: 'Gelap' }]} />
          <Catatan>Gelap = ruang mapping / immersive: cahaya proyektor & layar terlihat jelas.</Catatan>
        </div>
        {(ruang.bukaan ?? []).some(b => b.jenis === 'jendela') && (
          <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3 space-y-2">
            <Segmen label="Cahaya siang dari jendela" nilai={ruang.siang ?? 'malam'} onUbah={(v: Siang) => setRuang(r => ({ ...r, siang: v }))}
              opsi={[{ v: 'malam', l: 'Malam' }, { v: 'mendung', l: 'Mendung' }, { v: 'cerah', l: 'Cerah' }, { v: 'terik', l: 'Terik' }]} />
            <div>
              <div className="flex items-center justify-between text-[12px]"><span className="font-semibold text-slate-700">Tirai / blind tertutup</span><b className="tabular-nums text-slate-800">{ruang.tirai ?? 0}%</b></div>
              <input type="range" min={0} max={100} step={10} value={ruang.tirai ?? 0} aria-label="Tirai tertutup"
                onChange={e => setRuang(r => ({ ...r, tirai: Number(e.target.value) }))} className="w-full accent-sky-600" />
            </div>
            {kotakRuang.map((_, i) => {
              const sg = luxSiang(ruang, i);
              if (!sg.luasJendela) return null;
              return (
                <p key={i} className="text-[12px] text-slate-700">
                  {kotakRuang.length > 1 ? `Ruang ${i + 1}: ` : ''}jendela {f(sg.luasJendela, 1)} m² · daylight factor {f(sg.df, 2)}% → <b>±{f(sg.lux, 0)} lux</b> di dalam ruang
                </p>
              );
            })}
            <Catatan>Langit {ruang.siang ?? 'malam'} ±{LUX_LUAR[ruang.siang ?? 'malam'].toLocaleString('id-ID')} lux di luar (tanpa sinar matahari langsung). Ikut dihitung di kontras proyektor & lux meja.</Catatan>
          </div>
        )}
        {benda.some(b => b.jenis === 'lampu') && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[12.5px] font-bold text-slate-800">Lampu plafon (dimmer semua)</p>
              <span className="text-[12.5px] font-extrabold text-amber-900 tabular-nums">{ruang.dimmer ?? 100}%</span>
            </div>
            <input type="range" min={0} max={100} step={5} value={ruang.dimmer ?? 100} aria-label="Dimmer semua lampu"
              onChange={e => setRuang(r => ({ ...r, dimmer: Number(e.target.value) }))} className="w-full accent-amber-600" />
            <div className="flex gap-1.5">
              {[100, 50, 20, 0].map(v => (
                <button key={v} type="button" onClick={() => setRuang(r => ({ ...r, dimmer: v }))}
                  className={`flex-1 px-2 py-1 rounded-lg text-[12px] font-bold border ${(ruang.dimmer ?? 100) === v ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-amber-900 border-amber-200 hover:bg-amber-50'}`}>
                  {v === 0 ? 'Mati' : `${v}%`}
                </button>
              ))}
            </div>
            {kotakRuang.map((k, i) => {
              if (!benda.some(b => b.jenis === 'lampu' && ruangDari(ruang, b.x) === i)) return null;
              const lx = luxBidangKerja(benda, ruang, i);
              return (
                <p key={i} className="text-[12px] text-slate-700">
                  {kotakRuang.length > 1 ? `Ruang ${i + 1}: ` : ''}rata-rata di meja (0,75 m) <b>±{f(lx.rata, 0)} lux</b> <span className="text-slate-500">(min {f(lx.min, 0)}, maks {f(lx.maks, 0)})</span>
                </p>
              );
            })}
            <Catatan>Acuan: rapat / kelas ±300–500 lux. Saat presentasi proyektor, lampu diredupkan supaya kontras gambar cukup (lihat panel proyektor).</Catatan>
          </div>
        )}
        <div className="rounded-xl border border-slate-200 p-3">
          <p className="text-[12.5px] font-bold text-slate-800">Pintu & jendela dinding luar</p>
          <Catatan>Posisi = jarak dari ujung kiri dinding ke tengah bukaan, dilihat dari dalam ruang. Pintu/jendela di sekat antar ruang diatur di bagian ruang sebelahnya.</Catatan>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => tambahBukaan('pintu')} className="flex-1 px-3 py-1.5 rounded-lg text-[12.5px] font-bold text-blue-800 bg-blue-50 border border-blue-200 hover:bg-blue-100">+ Pintu</button>
            <button type="button" onClick={() => tambahBukaan('jendela')} className="flex-1 px-3 py-1.5 rounded-lg text-[12.5px] font-bold text-blue-800 bg-blue-50 border border-blue-200 hover:bg-blue-100">+ Jendela</button>
          </div>
          {(ruang.bukaan ?? []).map((b, idx) => {
            const ruangAda = b.ruang < kotakRuang.length;
            const sisiAda = sisiLuar(ruang, b.ruang);
            const sah = ruangAda && sisiAda.includes(b.sisi);
            const kb = daftarRuang(ruang)[b.ruang];
            return (
              <div key={b.id} className="mt-2 rounded-lg border border-slate-200 bg-slate-50/60 p-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12.5px] font-bold text-slate-800">{b.jenis === 'pintu' ? 'Pintu' : 'Jendela'} {idx + 1}</span>
                  <button type="button" onClick={() => setRuang(r => ({ ...r, bukaan: (r.bukaan ?? []).filter(x => x.id !== b.id) }))}
                    className="text-[12px] font-bold text-rose-700 hover:underline">Hapus</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {duaRuang && (
                    <Segmen label="Ruang" nilai={String(b.ruang)} onUbah={v => {
                      const ri = Number(v) || 0;
                      const sa = sisiLuar(ruang, ri);
                      ubahBukaan(b.id, { ruang: ri, sisi: sa.includes(b.sisi) ? b.sisi : sa[0] });
                    }} opsi={kotakRuang.map((_, i) => ({ v: String(i), l: String(i + 1) }))} />
                  )}
                  <Pilih label="Dinding" nilai={b.sisi} onUbah={(v: SisiDinding) => ubahBukaan(b.id, { sisi: v })}
                    opsi={(['depan', 'belakang', 'kiri', 'kanan'] as SisiDinding[]).filter(x => sisiAda.includes(x) || x === b.sisi).map(x => ({ v: x, l: x[0].toUpperCase() + x.slice(1) }))} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2">
                  <Angka label="Posisi" nilai={b.posisi} satuan="m" onUbah={v => v >= 0 && v <= 40 && ubahBukaan(b.id, { posisi: v })} />
                  <Angka label="Lebar" nilai={b.lebar} satuan="m" onUbah={v => v >= 0.3 && v <= 20 && ubahBukaan(b.id, { lebar: v })} />
                  <Angka label="Tinggi" nilai={b.tinggi} satuan="m" onUbah={v => v >= 0.2 && v <= 10 && ubahBukaan(b.id, { tinggi: v })} />
                  {b.jenis === 'jendela' && <Angka label="Dari lantai" nilai={b.ambang} satuan="m" onUbah={v => v >= 0 && v <= 8 && ubahBukaan(b.id, { ambang: v })} />}
                </div>
                {!sah && <p className="text-[11.5px] font-semibold text-amber-700">{ruangAda ? 'Dinding ini sekarang sekat antar ruang - pilih dinding lain.' : `Ruang ${b.ruang + 1} tidak ada - bukaan ini tidak digambar.`}</p>}
                {sah && kb && <Catatan>Panjang dinding {f(panjangDinding(kb, b.sisi))} m.</Catatan>}
              </div>
            );
          })}
        </div>
        {sambungan(ruang).map((r2, idx) => {
          const j = idx + 1;
          const up = ukuranPintu(ruang, j), zp = pintuSekat(ruang, j) ?? 0;
          const setP = (x: Partial<{ lebar: number; tinggi: number; z: number }>) =>
            setRuang(r => { const s0 = sambunganKe(r, j); return s0 ? pasangSambungan(r, j, { ...s0, pintuUkuran: { lebar: ukuranPintu(r, j).lebar, tinggi: ukuranPintu(r, j).tinggi, z: pintuSekat(r, j) ?? undefined, ...x } }) : r; });
          const jd = { ...JENDELA_AWAL, ...(r2.jendela ?? {}) };
          const setJ = (x: Partial<typeof jd>) => ubahSambungan(j, { jendela: { ...jd, ...x } });
          const terakhir = j === kotakRuang.length - 1;
          return (
            <div key={j} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <p className="text-[12.5px] font-bold text-slate-800">Ruang {j + 1} <span className="font-normal text-slate-500">· di kanan Ruang {j}</span></p>
                {terakhir && <button type="button" onClick={hapusRuangTerakhir} className="text-[12px] font-bold text-rose-700 hover:underline">Hapus ruang</button>}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Angka label="Panjang" nilai={r2.p} onUbah={v => v >= 2 && v <= 30 && ubahSambungan(j, { p: v }, true)} satuan="m" />
                <Angka label="Lebar" nilai={r2.l} onUbah={v => v >= 2 && v <= 30 && ubahSambungan(j, { l: v }, true)} satuan="m" />
                <Angka label="Plafon" nilai={r2.t} onUbah={v => v >= 2 && v <= 15 && ubahSambungan(j, { t: v }, true)} satuan="m" />
              </div>
              <div className="mt-2">
                <Segmen label="Lantai" nilai={r2.lantai} onUbah={v => ubahSambungan(j, { lantai: v })}
                  opsi={[{ v: 'kayu', l: 'Kayu' }, { v: 'karpet', l: 'Karpet' }, { v: 'keramik', l: 'Keramik' }, { v: 'polos', l: 'Warna' }]} />
                {r2.lantai === 'polos' && (
                  <PilihWarna label="Warna lantai" nilai={r2.warnaLantai} awal="#9ca3af" onUbah={w => ubahSambungan(j, { warnaLantai: w })} />
                )}
              </div>
              <div className="mt-2">
                <Pilih label={`Sekat dengan Ruang ${j}`} nilai={r2.sekat ?? 'tembok'} onUbah={(v: NonNullable<RuangSambung['sekat']>) => ubahSambungan(j, { sekat: v })}
                  opsi={[{ v: 'tembok', l: 'Tembok' }, { v: 'jendela', l: 'Tembok + jendela kaca' }, { v: 'kaca', l: 'Kaca penuh' }, { v: 'terbuka', l: 'Terbuka (menyatu / ruang bentuk L)' }]} />
                <Catatan>
                  {r2.sekat === 'terbuka' ? 'Tanpa sekat: kedua ruang menyatu. Bedakan lebar ruang untuk membuat ruang bentuk L - sisa dinding tetap tembok.'
                    : r2.sekat === 'jendela' ? 'Satu jendela kaca persegi di sekat untuk melihat ke ruang sebelah. Geser: + ke belakang, − ke depan; otomatis menghindari pintu.'
                      : r2.sekat === 'kaca' ? 'Kaca penuh: seluruh sekat tembus pandang.' : 'Sekat tembok biasa.'}
                </Catatan>
              </div>
              {r2.sekat === 'jendela' && (
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2">
                  <Angka label="Lebar jendela" nilai={jd.lebar} satuan="m" onUbah={v => v >= 0.3 && v <= 20 && setJ({ lebar: v })} />
                  <Angka label="Tinggi jendela" nilai={jd.tinggi} satuan="m" onUbah={v => v >= 0.2 && v <= 5 && setJ({ tinggi: v })} />
                  <Angka label="Dari lantai" nilai={jd.ambang} satuan="m" onUbah={v => v >= 0.1 && v <= 3 && setJ({ ambang: v })} />
                  <Angka label="Geser" nilai={jd.geser} satuan="m" min={-20} onUbah={v => v >= -20 && v <= 20 && setJ({ geser: v })} />
                </div>
              )}
              {r2.sekat !== 'terbuka' && (
                <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" className="w-4 h-4" checked={r2.pintu} onChange={e => ubahSambungan(j, { pintu: e.target.checked })} /> Pintu penghubung
                </label>
              )}
              {r2.pintu && r2.sekat !== 'terbuka' && (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <Angka label="Lebar pintu" nilai={Math.round(up.lebar * 100) / 100} satuan="m" onUbah={v => v >= 0.5 && v <= 6 && setP({ lebar: v })} />
                  <Angka label="Tinggi pintu" nilai={Math.round(up.tinggi * 100) / 100} satuan="m" onUbah={v => v >= 1.5 && v <= 5 && setP({ tinggi: v })} />
                  <Angka label="Dari depan" nilai={Math.round(zp * 100) / 100} satuan="m" onUbah={v => v >= 0 && v <= 30 && setP({ z: v })} />
                </div>
              )}
            </div>
          );
        })}
        {kotakRuang.length < MAKS_RUANG && (
          <button type="button" onClick={tambahRuang}
            className="w-full px-3 py-2 rounded-xl text-[12.5px] font-bold text-blue-800 bg-blue-50 border border-dashed border-blue-300 hover:bg-blue-100">
            + Tambah ruang bersebelahan (Ruang {kotakRuang.length + 1}, maks {MAKS_RUANG})
          </button>
        )}
        {duaRuang && (
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-[12.5px] font-bold text-slate-800">Salin perangkat & interior ke ruang lain</p>
            <p className="text-[12px] text-slate-600 mt-0.5 leading-relaxed">
              Benda yang menempel dinding tetap menempel, perangkat plafon tetap di plafon, susunan meja-kursi tetap di tengah ruang - walau ukuran ruang berbeda.
            </p>
            <label className="mt-2 flex items-center gap-2 text-[12.5px] text-slate-700">
              <input type="checkbox" className="w-4 h-4" checked={gantiIsi} onChange={e => setGantiIsi(e.target.checked)} /> Kosongkan ruang tujuan dulu
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {kotakRuang.flatMap((_, i) => kotakRuang.map((__, t) => [i, t] as const)).filter(([i, t]) => i !== t && (kotakRuang.length <= 2 || Math.abs(i - t) === 1)).map(([i, t]) => (
                <button key={`${i}-${t}`} type="button" onClick={() => salinIsiRuang(i, gantiIsi, t)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[12.5px] font-bold text-blue-800 bg-blue-50 border border-blue-200 hover:bg-blue-100">
                  <Copy size={14} /> Ruang {i + 1} → Ruang {t + 1}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
