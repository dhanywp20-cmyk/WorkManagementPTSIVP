'use client';
/** Kartu spesifikasi: brand / modul / cabinet, mode ukuran atau jumlah, daya & berat per unit, refresh & bit. */
import { Angka, f, Kartu, Pilih, Segmen } from '../../bersama/ui';
import { kunciModul } from '@/lib/av-hitung';
import { CABINET, PITCH } from '../data';
import { TombolRef } from './komponen';
import type { AlatLED } from './alat';

export function KartuSpesifikasi({ a }: { a: AlatLED }) {
  const { barisIn, beratUnit, beratUnitEf, bit, brandAda, brandAktif, bulat, cabH, cabKey, cabW, dayaUnit, dayaUnitEf, faktorDaya, faktorRata, kolomIn, lingkungan, mode, modul, modulBrand, namaUnit, opsiBulat, pilihBrand, pilihCab, pilihModul, pitch, px, pxIn, refLED, refresh, resetUnit, satuan, screen, setBarisIn, setBeratUnit, setBit, setBukaRef, setBulat, setCabH, setCabW, setDayaUnit, setFaktorDaya, setFaktorRata, setKolomIn, setLingkungan, setMode, setPitch, setPxIn, setRefresh, setSatuan, setScreen, setTargetH, setTargetW, setTegangan, targetH, targetW, tegangan, u } = a.K;
  return (
    <>
      <Kartu judul="Spesifikasi" aksi={<TombolRef onKlik={() => setBukaRef(true)} diubah={refLED.diubah} />}>
        <div className="space-y-3">
          <Segmen label="Satuan" nilai={satuan} onUbah={v => { setSatuan(v); resetUnit(); }}
            opsi={[{ v: 'modul', l: 'Referensi brand' }, { v: 'cabinet', l: 'Cabinet bebas' }]} />
          {satuan === 'modul' ? (
            <>
              <Pilih label="Brand" nilai={brandAktif} onUbah={pilihBrand}
                opsi={brandAda.map(b => ({ v: b.nama, l: `${b.sendiri ? '★ ' : ''}${b.nama}${b.sendiri ? ' (brand sendiri)' : ''} · ${b.jumlah} produk` }))} />
              <Pilih label="Model / pitch" nilai={kunciModul(modul)} onUbah={pilihModul}
                opsi={modulBrand.map(m => ({ v: kunciModul(m), l: `${m.model ? `${m.model} · ` : ''}${m.kode} · ${m.w}×${m.h} mm · ${m.pxW}×${m.pxH} px · ${m.tipe}${m.unit === 'cabinet' ? ' · cabinet' : ''}` }))} />
              <p className="text-[12px] text-slate-600 -mt-1">{modul.guna}</p>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Pilih label="Pixel pitch" nilai={PITCH.includes(pitch) ? pitch : -1} onUbah={v => { if (v > 0) { setPitch(v); setPxIn(null); } }}
                  opsi={[...PITCH.map(p => ({ v: p, l: `P${p}` })), { v: -1, l: 'Custom...' }]} />
                <Angka label="Pitch (mm)" nilai={pitch} onUbah={v => { if (v > 0) { setPitch(v); setPxIn(null); } }} satuan="mm" />
              </div>
              <Pilih label="Ukuran cabinet" nilai={cabKey} onUbah={pilihCab} opsi={CABINET.map(c => ({ v: c.v, l: c.l }))} />
              {cabKey === 'custom' && (
                <div className="grid grid-cols-2 gap-3">
                  <Angka label="Lebar cabinet" nilai={cabW} onUbah={v => { if (v > 0) { setCabW(v); setPxIn(null); } }} satuan="mm" />
                  <Angka label="Tinggi cabinet" nilai={cabH} onUbah={v => { if (v > 0) { setCabH(v); setPxIn(null); } }} satuan="mm" />
                </div>
              )}
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Angka label={`Pixel/${namaUnit} (W)`} nilai={px.x} step={1} satuan="px"
              onUbah={v => v >= 1 && setPxIn({ x: Math.round(v), y: px.y })} />
            <Angka label={`Pixel/${namaUnit} (H)`} nilai={px.y} step={1} satuan="px"
              onUbah={v => v >= 1 && setPxIn({ x: px.x, y: Math.round(v) })} />
          </div>
          <Segmen label="Lingkungan" nilai={lingkungan} onUbah={v => { setLingkungan(v); setDayaUnit(null); setBeratUnit(null); }}
            opsi={[{ v: 'indoor', l: 'Indoor' }, { v: 'semi-outdoor', l: 'Semi' }, { v: 'outdoor', l: 'Outdoor' }]} />

          <Segmen label="Hitung dari" nilai={mode} onUbah={setMode}
            opsi={[{ v: 'ukuran', l: 'Ukuran target' }, { v: 'jumlah', l: `Jumlah ${namaUnit}` }]} />
          {mode === 'ukuran' ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Angka label="Lebar target" nilai={targetW} onUbah={v => v > 0 && setTargetW(v)} satuan="m" />
                <Angka label="Tinggi target" nilai={targetH} onUbah={v => v > 0 && setTargetH(v)} satuan="m" />
              </div>
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">Pembulatan</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {opsiBulat.map(o => {
                    const on = o.v === bulat;
                    return (
                      <button key={o.v} type="button" onClick={() => setBulat(o.v)} aria-pressed={on}
                        className={`rounded-xl border px-2 py-1.5 text-left ${on ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                        <span className={`block text-[12px] font-bold ${on ? 'text-blue-800' : 'text-slate-700'}`}>{o.l}</span>
                        <span className="block text-[11px] text-slate-600 tabular-nums">{o.kolom}×{o.baris} · {f((o.kolom * u.w) / 1000)}×{f((o.baris * u.h) / 1000)} m</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Angka label="Kolom" nilai={kolomIn} onUbah={v => v >= 1 && setKolomIn(Math.round(v))} step={1} />
              <Angka label="Baris" nilai={barisIn} onUbah={v => v >= 1 && setBarisIn(Math.round(v))} step={1} />
            </div>
          )}
          <Angka label="Jumlah screen identik" nilai={screen} onUbah={v => v >= 1 && setScreen(Math.round(v))} step={1} satuan="screen" />

          <details className="rounded-xl border border-slate-200 p-3">
            <summary className="text-[12.5px] font-semibold text-slate-700 cursor-pointer">Daya, berat & sinyal (opsional)</summary>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Angka label={`Daya maks/${namaUnit}`} nilai={dayaUnitEf} onUbah={setDayaUnit} satuan="W" />
              <Angka label={`Berat/${namaUnit}`} nilai={beratUnitEf} onUbah={setBeratUnit} satuan="kg" />
              <Angka label="Rata-rata pemakaian" nilai={faktorRata} onUbah={v => setFaktorRata(Math.min(100, Math.max(5, v)))} satuan="%" />
              <Angka label="Tegangan" nilai={tegangan} onUbah={v => v > 0 && setTegangan(v)} satuan="V" />
              <Angka label="Faktor daya (PF)" nilai={faktorDaya} step={0.01} onUbah={v => v >= 0.5 && v <= 1 && setFaktorDaya(v)} />
              <Pilih label="Refresh" nilai={refresh} onUbah={setRefresh} opsi={[60, 120, 144, 240].map(v => ({ v: v as 60, l: `${v} Hz` }))} />
              <Pilih label="Bit depth" nilai={bit} onUbah={setBit} opsi={[8, 10, 12].map(v => ({ v: v as 8, l: `${v}-bit` }))} />
            </div>
            {(dayaUnit !== null || beratUnit !== null || pxIn !== null) && (
              <button type="button" onClick={resetUnit}
                className="mt-2 text-[12px] font-semibold text-blue-700 hover:underline">Kembalikan ke nilai umum</button>
            )}
          </details>
        </div>
      </Kartu>
    </>
  );
}
