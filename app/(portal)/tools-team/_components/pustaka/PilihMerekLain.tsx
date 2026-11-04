'use client';
import { useEffect, useMemo, useState } from 'react';
import { Catatan } from '../bersama/ui';
import {
  type KatalogLain, type LensaLain, MEREK_LAIN, type MerekLain, type ModelLain, muatKatalogLain, type RasioProyektor, rasioUntukLensa, SUMBER_LAIN,
} from '../desain3d/inti';

export function PilihMerekLain({ rasio: rasioSekarang, sumber, onPakai }: {
  rasio?: RasioProyektor; sumber?: string; onPakai: (k: KatalogLain, m: ModelLain, l: LensaLain, rasio: RasioProyektor) => void;
}) {
  const [buka, setBuka] = useState(false);
  const [merek, setMerek] = useState<MerekLain>('Epson');
  const [katalog, setKatalog] = useState<Partial<Record<MerekLain, KatalogLain>>>({});
  const [galat, setGalat] = useState<string | null>(null);
  const [cari, setCari] = useState('');
  const [jenis, setJenis] = useState(0);
  const [model, setModel] = useState('');
  const [lensa, setLensa] = useState('');
  const kat = katalog[merek] ?? null;
  useEffect(() => {
    if (!buka || kat) return;
    let hidup = true;
    setGalat(null);
    muatKatalogLain(merek).then(k => { if (hidup) setKatalog(x => ({ ...x, [merek]: k })); })
      .catch(() => { if (hidup) setGalat(`Katalog ${merek} gagal dimuat - periksa koneksi lalu buka lagi.`); });
    return () => { hidup = false; };
  }, [buka, kat, merek]);

  const daftar = useMemo(() => {
    if (!kat) return [];
    const q = cari.trim().toUpperCase().replace(/[\s-]/g, '');
    return kat.model.filter(m => (!jenis || m.kat === jenis) && (!q || m.n.toUpperCase().replace(/[\s-]/g, '').includes(q)));
  }, [kat, cari, jenis]);
  const m = kat?.model.find(x => x.n === model) ?? null;
  const l = m?.l.find(x => x.n === lensa) ?? m?.l[0] ?? null;
  const rasio = m && l ? rasioUntukLensa(m, l, rasioSekarang) : null;
  const gantiMerek = (v: MerekLain) => { setMerek(v); setJenis(0); setModel(''); setLensa(''); setCari(''); };

  if (!buka) {
    return (
      <button type="button" onClick={() => setBuka(true)}
        className="w-full px-2.5 py-2 rounded-lg text-[12px] font-bold border border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100 text-left">
        Pilih model &amp; lensa merek lain ({MEREK_LAIN.join(', ')}){sumber && !sumber.startsWith('Panasonic') ? ` · sekarang: ${sumber}` : ''}
      </button>
    );
  }
  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-violet-900">Katalog merek lain{kat ? ` · ${SUMBER_LAIN[merek].singkat} ${kat.versi}` : ''}</p>
        <button type="button" onClick={() => setBuka(false)} className="text-[11.5px] font-bold text-slate-600 hover:text-slate-900">Tutup</button>
      </div>
      <div role="radiogroup" aria-label="Merek" className="flex gap-1 p-1 rounded-lg bg-white border border-slate-200">
        {MEREK_LAIN.map(v => (
          <button key={v} type="button" role="radio" aria-checked={merek === v} onClick={() => gantiMerek(v)}
            className={`flex-1 py-1 rounded-md text-[12px] font-bold ${merek === v ? 'bg-violet-700 text-white' : 'text-slate-700 hover:bg-slate-50'}`}>{v}</button>
        ))}
      </div>
      {galat && <p className="text-[12px] font-semibold text-rose-700">{galat}</p>}
      {!kat && !galat && <p className="text-[12px] text-slate-600">Memuat katalog {merek}…</p>}
      {kat && (
        <>
          <div className="flex items-center gap-2">
            <input type="search" value={cari} onChange={e => setCari(e.target.value)} placeholder={merek === 'Epson' ? 'Cari model, mis. L610U' : 'Cari model, mis. DU8190Z'}
              aria-label={`Cari model ${merek}`} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[12.5px]" />
            <select aria-label="Kategori" value={jenis} onChange={e => setJenis(Number(e.target.value))}
              className="min-w-0 max-w-[45%] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[12.5px]">
              {kat.kategori.map(k => <option key={k.v} value={k.v}>{k.l}</option>)}
            </select>
          </div>
          <select aria-label={`Model ${merek}`} value={model} onChange={e => { setModel(e.target.value); setLensa(''); }}
            className="block w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[12.5px]">
            <option value="">{daftar.length ? `Pilih model (${daftar.length})` : 'Tidak ada model yang cocok'}</option>
            {daftar.map(x => <option key={x.n} value={x.n}>{x.n} · {x.lm.toLocaleString('id-ID')} lm · {x.a}{x.r ? ` · ${x.r}` : ''}</option>)}
          </select>
          {m && (
            <select aria-label="Lensa" value={l?.n ?? ''} onChange={e => setLensa(e.target.value)}
              className="block w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[12.5px]">
              {m.l.map(x => <option key={x.n} value={x.n}>{x.n}{x.z ? '' : ' (fixed)'}{x.ket ? ` · TR ${x.ket}` : ''}{x.lm ? ` · ${x.lm.toLocaleString('id-ID')} lm` : ''}{x.k ? ' · jarak khusus' : ''}</option>)}
            </select>
          )}
          {m && l && rasio && (
            <>
              <p className="text-[12px] text-slate-700 leading-snug">
                Panel {m.a}{m.r ? ` (${m.r})` : ''}, {(l.lm || m.lm).toLocaleString('id-ID')} lm, rasio sinyal {rasio}{rasioSekarang && rasio !== rasioSekarang && !l.ar[rasioSekarang] ? ` (${rasioSekarang} tidak didukung lensa ini)` : ''}.
                {' '}TR {l.ar[rasio]![0].toFixed(4)}{l.z ? `–${l.ar[rasio]![1].toFixed(4)}` : ''}, b {l.ar[rasio]![2].toFixed(4)} m{l.pg ? '' : `, tanpa lens shift (offset ${Math.round(l.off * 100)}%)`}.
              </p>
              {l.k && <p className="text-[12px] font-semibold text-amber-700">Lensa ultra short throw: kalkulator {merek} mengukur jaraknya dengan cara khusus - jarak L di sini dari muka lensa, cek ulang dengan kalkulator {merek}.</p>}
              <button type="button" onClick={() => { onPakai(kat, m, l, rasio); setBuka(false); }}
                className="px-2.5 py-1.5 rounded-lg text-[12px] font-bold border border-violet-700 bg-violet-700 text-white hover:bg-violet-800">
                Pakai {merek} {m.n} + {l.n}
              </button>
            </>
          )}
          <Catatan>Data dari {kat.sumber} ({SUMBER_LAIN[merek].situs}). Angka L, ukuran, lens shift &amp; lumen mengikuti rumus kalkulator itu, per rasio sinyal.</Catatan>
        </>
      )}
    </div>
  );
}
