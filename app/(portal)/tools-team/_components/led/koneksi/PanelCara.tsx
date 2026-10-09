'use client';
/** Pengaturan cara menyambung: template (pojok mulai, arah, pola, pembagian port) atau manual. */
import { f, Segmen, Catatan } from '../../bersama/ui';
import { SUDUT, warnaPort } from './data';
import { IkonPola, kelasJudul, kelasTombol } from './komponen';
import { Cable, Eraser, Plus, Trash2, Wand2 } from 'lucide-react';
import type { AlatRuangKoneksi } from './useRuangKoneksi';

export function PanelCara({ a }: { a: AlatRuangKoneksi }) {
  const { alatEf, gantiManual, keManual, nPortManual, pAktif, portAktif, s, setAlat, setPortAktif, ubah } = a;
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
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {(s.manual ?? []).map((rt, i) => {
                  const on = portAktif === i + 1;
                  return (
                    <button key={i} type="button" onClick={() => setPortAktif(i + 1)} aria-pressed={on}
                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-bold border ${on ? 'text-white border-transparent' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                      style={on ? { background: warnaPort(i + 1) } : undefined}>
                      {!on && <span className="w-2 h-2 rounded-sm" style={{ background: warnaPort(i + 1) }} />}P{i + 1}<span className={`font-semibold ${on ? 'text-white/85' : 'text-slate-500'}`}>{rt.length}</span>
                    </button>
                  );
                })}
                {!nPortManual && <span className="text-[12px] text-slate-500">Belum ada port - tambah port dulu.</span>}
              </div>
              {pAktif && (
                <p className="text-[11.5px] text-slate-600 mt-1.5">
                  P{portAktif}: {pAktif.jumlah} RC · {pAktif.px.toLocaleString('id-ID')} px · <b className={pAktif.beban > s.beban ? 'text-rose-700' : 'text-slate-800'}>{f(pAktif.beban, 0)}%</b>
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
