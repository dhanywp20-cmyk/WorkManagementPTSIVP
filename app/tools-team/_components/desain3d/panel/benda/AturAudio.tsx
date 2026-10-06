'use client';
/** Atur audio: mic, speaker (tipe, sebaran, jangkauan), line array (modul, sudut, tilt). */
import { Angka, f, Segmen } from '../../../bersama/ui';
import { bendaBaru, berkasLineArray, cakupanSpeakerPlafon, jangkauanDari, modulLA, sebaranSpeaker, sebaranVSpeaker, sudutModulLA, tiltLADari, TINGGI_DENGAR, type TipeSpeaker, tipeSpeakerDari } from '../../inti';
import type { KonteksAtur } from './konteks';

export function AturAudio({ c }: { c: KonteksAtur }) {
  const { b, kosong, onUbah, plafon, set } = c;
  return (
    <>
      {b.jenis === 'mic' && (
        <Segmen label="Tipe mic" nilai={b.mic ?? 'gooseneck'} onUbah={v => {
          const baru = bendaBaru('mic', { x0: 0, p: 0, l: 0, t: plafon }, { mic: v });
          onUbah({ ...b, mic: v, w: baru.w, h: baru.h, d: baru.d, nama: b.nama.startsWith('Mic') ? baru.nama : b.nama });
        }} opsi={[{ v: 'gooseneck', l: 'Gooseneck' }, { v: 'boundary', l: 'Boundary' }]} />
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
    </>
  );
}
