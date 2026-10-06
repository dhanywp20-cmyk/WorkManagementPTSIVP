'use client';
/** Ukuran receiving card: ikut kalkulator atau custom per kolom / baris (px), sel kosong. */
import { Angka, Segmen } from '../../bersama/ui';
import { AngkaKecil, kelasJudul, kelasTombol } from './komponen';
import { SquareDashed } from 'lucide-react';
import type { AlatRuangKoneksi } from './useRuangKoneksi';

export function PanelUkuranRC({ a }: { a: AlatRuangKoneksi }) {
  const { alatEf, d, keCustom, nUnit, s, samaH, samaW, setAlat, setSamaH, setSamaW, t, ubah, ubahJumlah } = a;
  return (
    <>
      <section className="rounded-2xl bg-white border border-slate-200 p-3 space-y-3">
        <Segmen label="Ukuran receiving card" nilai={t.custom ? 'custom' : 'ikut'} onUbah={v => (v === 'custom' ? keCustom() : ubah({ lebarKol: null, tinggiBaris: null }))}
          opsi={[{ v: 'ikut', l: 'Ikut kalkulator' }, { v: 'custom', l: 'Custom (px)' }]} />
        {!t.custom ? (
          <div>
            <div className="grid grid-cols-2 gap-3">
              <Angka label={`${nUnit} mendatar`} nilai={t.rcKol} step={1} onUbah={v => v >= 1 && ubah({ rcKol: Math.round(v) })} />
              <Angka label={`${nUnit} tegak`} nilai={t.rcBaris} step={1} onUbah={v => v >= 1 && ubah({ rcBaris: Math.round(v) })} />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Per receiving card: {t.rcKol}×{t.rcBaris} {nUnit} = {t.rcKol * d.pxX}×{t.rcBaris * d.pxY} px{s.rcKol === null && s.rcBaris === null && ' (otomatis)'}
              {(s.rcKol !== null || s.rcBaris !== null) && <button type="button" onClick={() => ubah({ rcKol: null, rcBaris: null })} className="ml-1.5 font-semibold text-blue-700 hover:underline">Otomatis</button>}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-3">
              <Angka label="Kolom RC" nilai={t.K} step={1} onUbah={v => v >= 1 && v <= 256 && ubahJumlah('lebarKol', Math.round(v))} />
              <Angka label="Baris RC" nilai={t.B} step={1} onUbah={v => v >= 1 && v <= 256 && ubahJumlah('tinggiBaris', Math.round(v))} />
            </div>
            <div>
              <span className={kelasJudul}>Lebar tiap kolom (px)</span>
              <div className="flex gap-1 overflow-x-auto pb-1 mt-1">
                {t.lebar.map((w, i) => <AngkaKecil key={i} nilai={w} label={`Lebar kolom ${i + 1}`} onUbah={v => ubah({ lebarKol: t.lebar.map((x, j) => (j === i ? v : x)), tinggiBaris: [...t.tinggi] })} />)}
              </div>
            </div>
            <div>
              <span className={kelasJudul}>Tinggi tiap baris (px)</span>
              <div className="flex gap-1 overflow-x-auto pb-1 mt-1">
                {t.tinggi.map((h, i) => <AngkaKecil key={i} nilai={h} label={`Tinggi baris ${i + 1}`} onUbah={v => ubah({ tinggiBaris: t.tinggi.map((x, j) => (j === i ? v : x)), lebarKol: [...t.lebar] })} />)}
              </div>
            </div>
            <div className="flex items-end gap-1.5 flex-wrap">
              <span className="text-[11.5px] text-slate-600 w-full">Samakan semua receiving card:</span>
              <AngkaKecil nilai={samaW} label="Lebar semua (px)" onUbah={setSamaW} /><span className="text-slate-500 text-sm pb-1">×</span>
              <AngkaKecil nilai={samaH} label="Tinggi semua (px)" onUbah={setSamaH} />
              <button type="button" className={kelasTombol} onClick={() => ubah({ lebarKol: t.lebar.map(() => samaW), tinggiBaris: t.tinggi.map(() => samaH) })}>Terapkan</button>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[11.5px] text-slate-600">Sel kosong: <b className="text-slate-800">{t.kosong.size}</b></span>
          <div className="flex gap-1.5">
            <button type="button" className={`${kelasTombol} ${alatEf === 'kosong' ? 'ring-2 ring-blue-300 border-blue-400 text-blue-800 bg-blue-50' : ''}`}
              onClick={() => setAlat(alatEf === 'kosong' ? (s.mode === 'manual' ? 'kabel' : null) : 'kosong')} aria-pressed={alatEf === 'kosong'}>
              <SquareDashed size={13} /> {alatEf === 'kosong' ? 'Selesai' : 'Kosongkan sel'}
            </button>
            {t.kosong.size > 0 && <button type="button" className={kelasTombol} onClick={() => ubah({ kosong: [] })}>Isi semua</button>}
          </div>
        </div>
      </section>
    </>
  );
}
