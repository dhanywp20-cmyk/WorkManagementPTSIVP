'use client';
import { f, Segmen, Catatan } from '../../bersama/ui';
import { kodePort, SUDUT, warnaPort } from './data';
import { IkonPola, kelasJudul, kelasTombol } from './komponen';
import { Cable, Eraser, Plus, Trash2, Wand2 } from 'lucide-react';
import type { AlatRuangKoneksi } from './useRuangKoneksi';
import type { SelRC } from '@/lib/av/hitung';

const labelKartu = (g: string) => { const [c, k] = g.slice(1).split('/'); return k ? `C${c} · Kartu ${k}` : `Kartu ${c}`; };

export function PanelCara({ a }: { a: AlatRuangKoneksi }) {
  const { alatEf, gantiManual, keManual, nPortManual, off, pAktif, portAktif, s, setAlat, setPortAktif, t, ubah } = a;
  const perUnit = t.lanKartu > 0 && t.ppk > 0 ? Math.ceil(t.ppk / t.lanKartu) : 0;
  const nUnit = perUnit ? Math.max(1, t.controller, Math.ceil((off + nPortManual) / t.ppk)) : 1;
  const tk = { ...t, controller: Math.max(t.controller, nUnit) };
  const kunciKartu = (p: number) => kodePort(tk, p).split(':')[0];
  const daftar = (s.manual ?? []).map((rt, i) => ({ rt, p: i + 1, g: kunciKartu(off + i + 1) }));
  const grup = Array.from({ length: perUnit * nUnit }, (_, i) => Math.floor(i / perUnit) * t.ppk + (i % perUnit) * t.lanKartu + 1)
    .filter(p0 => p0 + t.lanKartu - 1 > off).map(p0 => ({ p0: Math.max(1, p0 - off), g: kunciKartu(p0) }));
  const grupAktif = grup.some(x => x.g === kunciKartu(off + portAktif)) ? kunciKartu(off + portAktif) : grup[0]?.g;
  const bukaKartu = (p0: number, ada: number | undefined) => {
    if (ada) { setPortAktif(ada); return; }
    gantiManual(m => [...m, ...Array.from({ length: Math.max(0, p0 - m.length) }, (): SelRC[] => [])]);
    setPortAktif(p0);
  };
  return (
    <>
      <section className="rounded-2xl bg-white border border-slate-200 p-3 space-y-3">
        <Segmen label="Cara menyambung" nilai={s.mode} onUbah={v => (v === 'manual' ? keManual(false) : (ubah({ mode: 'template' }), setAlat(null)))}
          opsi={[{ v: 'template', l: 'Template cepat' }, { v: 'manual', l: 'Manual (klik / seret)' }]} />
        {s.mode === 'template' ? (
          <>
            <div>
              <span className={kelasJudul}>Pola koneksi cepat</span>
              <div className="grid grid-cols-4 gap-1.5 mt-1" role="radiogroup" aria-label="Pola koneksi cepat">
                {(['horizontal', 'vertikal'] as const).flatMap(arah => SUDUT.map(sd => {
                  const on = s.mulai === sd.v && s.arah === arah;
                  return (
                    <button key={`${arah}-${sd.v}`} type="button" role="radio" aria-checked={on} onClick={() => ubah({ mulai: sd.v, arah })}
                      title={`Mulai ${sd.l.toLowerCase()}, kabel ${arah === 'horizontal' ? 'mendatar' : 'tegak'}`}
                      className={`grid place-items-center rounded-xl border p-1 ${on ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-300' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                      <IkonPola mulai={sd.v} arah={arah} pola={s.pola} />
                    </button>
                  );
                }))}
              </div>
              <Catatan>Titik hijau = receiving card pertama. Baris atas: kabel mendatar, baris bawah: kabel tegak.</Catatan>
            </div>
            <Segmen label="Pola" nilai={s.pola} onUbah={v => ubah({ pola: v })} opsi={[{ v: 'S', l: 'S · bolak-balik' }, { v: 'Z', l: 'Z · balik ke awal' }]} />
            <Segmen label="Pembagian port" nilai={s.bagi} onUbah={v => ubah({ bagi: v })}
              opsi={[{ v: 'baris', l: s.arah === 'horizontal' ? 'Baris utuh' : 'Kolom utuh' }, { v: 'penuh', l: 'Isi penuh' }]} />
            <button type="button" onClick={() => keManual(true)} className={`${kelasTombol} w-full justify-center`}>
              <Wand2 size={14} /> Edit manual dari pola ini
            </button>
          </>
        ) : (
          <>
            <div>
              <div className="flex items-center justify-between">
                <span className={kelasJudul}>Port aktif</span>
                <button type="button" className={kelasTombol} onClick={() => { gantiManual(m => [...m, []]); setPortAktif(nPortManual + 1); }}><Plus size={13} /> Port</button>
              </div>
              {grup.length > 0 && (
                <div role="tablist" aria-label="Kartu output" className="flex flex-wrap gap-1 mt-1.5 p-1 rounded-xl bg-slate-100">
                  {grup.map(({ g, p0 }) => {
                    const isi = daftar.filter(x => x.g === g), on = g === grupAktif, pakai = isi.filter(x => x.rt.length).length;
                    return (
                      <button key={g} type="button" role="tab" aria-selected={on} onClick={() => bukaKartu(p0, isi[0]?.p)} title={`${pakai} port terpakai`}
                        className={`flex-1 min-w-[64px] px-2 py-1 rounded-lg text-[12px] font-semibold ${on ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}>
                        {labelKartu(g)} <span className="font-normal text-slate-500">{pakai}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {daftar.filter(x => !grup.length || x.g === grupAktif).map(({ rt, p: i1 }) => {
                  const i = i1 - 1, on = portAktif === i1;
                  return (
                    <button key={i} type="button" onClick={() => setPortAktif(i + 1)} aria-pressed={on}
                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-bold border ${on ? 'text-white border-transparent' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                      style={on ? { background: warnaPort(off + i + 1) } : undefined}>
                      {!on && <span className="w-2 h-2 rounded-xs" style={{ background: warnaPort(off + i + 1) }} />}{kodePort(tk, off + i + 1)}<span className={`font-semibold ${on ? 'text-white/85' : 'text-slate-500'}`}>{rt.length}</span>
                    </button>
                  );
                })}
                {!nPortManual && <span className="text-[12px] text-slate-500">Belum ada port - tambah port dulu.</span>}
              </div>
              {pAktif && (
                <p className="text-[11.5px] text-slate-600 mt-1.5">
                  {kodePort(tk, off + portAktif)}: {pAktif.jumlah} RC · {pAktif.px.toLocaleString('id-ID')} px · <b className={pAktif.beban > s.beban ? 'text-rose-700' : 'text-slate-800'}>{f(pAktif.beban, 0)}%</b>
                </p>
              )}
            </div>
            <Segmen label="Klik sel untuk" nilai={alatEf ?? 'kabel'} onUbah={v => setAlat(v)}
              opsi={[{ v: 'kabel', l: 'Sambung kabel' }, { v: 'kosong', l: 'Kosong / isi' }]} />
            <p className="text-[11.5px] text-slate-600 leading-relaxed">
              {alatEf === 'kabel'
                ? 'Klik receiving card berurutan (atau tekan lalu seret) untuk menyambung ke port aktif. Klik kartu yang sudah tersambung di port ini untuk memutus dari kartu itu ke belakang.'
                : 'Klik sel untuk menandai tidak ada receiving card (layar tidak persegi), klik lagi untuk mengisi.'}
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <button type="button" className={kelasTombol} disabled={!pAktif?.jumlah} onClick={() => gantiManual(m => m.map((rt, i) => (i === portAktif - 1 ? [] : rt)))}><Eraser size={13} /> Putus port ini</button>
              <button type="button" className={kelasTombol} disabled={!nPortManual} onClick={() => { gantiManual(m => m.filter((_, i) => i !== portAktif - 1)); setPortAktif(p => Math.max(1, p - 1)); }}><Trash2 size={13} /> Hapus port</button>
              <button type="button" className={kelasTombol} onClick={() => gantiManual(m => m.map(() => []))}><Cable size={13} /> Putus semua</button>
              <button type="button" className={kelasTombol} onClick={() => keManual(true)}><Wand2 size={13} /> Dari template</button>
            </div>
          </>
        )}
      </section>
    </>
  );
}
