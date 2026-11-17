'use client';
import { Catatan, f, Nilai } from '../../bersama/ui';
import { PX_RC_UMUM } from './data';
import { PanelCara } from './PanelCara';
import { PanelUkuranRC } from './PanelUkuranRC';
import { PanelPort } from './PanelPort';
import { KanvasKoneksi } from './KanvasKoneksi';
import { TabelPort } from './TabelPort';
import { PanelController } from './PanelController';
import { useRuangKoneksi, type PropsRuangKoneksi } from './useRuangKoneksi';
import { teksRentangPort } from './multi';
import { Monitor } from 'lucide-react';

export function RuangKoneksi(p: PropsRuangKoneksi) {
  const a = useRuangKoneksi(p);
  const { aktif, d, g, m, nUnit, onPisahKartu, pilihLayar, pisahKartu, rataBeban, resKalk, s, t, zona } = a;
  const k = g.hasil;
  const portIdeal = m.per.reduce((x, b) => x + b.d.portIdeal, 0);
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] items-start">
      <div className="space-y-3 min-w-0">
        {m.multi && (
          <section className="rounded-2xl bg-white border border-slate-200 p-3 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Screen diatur · 1 video processor</p>
            <div className="grid gap-1.5" role="tablist" aria-label="Pilih screen">
              {m.per.map(b => {
                const on = b.i === aktif;
                return (
                  <button key={b.i} type="button" role="tab" aria-selected={on} onClick={() => pilihLayar(b.i)}
                    className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left ${on ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-300' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                    <Monitor size={15} className={on ? 'text-blue-700' : 'text-slate-500'} />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[12.5px] font-bold truncate ${on ? 'text-blue-800' : 'text-slate-800'}`}>{b.nama}</span>
                      <span className="block text-[11px] text-slate-600 tabular-nums">{b.d.kolom}×{b.d.baris} {nUnit} · {b.t.resX}×{b.t.resY} px · {teksRentangPort(b)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {t.lanKartu > 0 && (
              <label className="flex items-start gap-2 text-[12px] text-slate-700 pt-1">
                <input type="checkbox" className="mt-0.5" checked={pisahKartu} onChange={e => onPisahKartu(e.target.checked)} />
                <span>Tiap screen mulai di kartu output baru <span className="text-slate-500">(port kartu sebelumnya yang sisa tidak dipakai)</span></span>
              </label>
            )}
            <p className="text-[11px] text-slate-500">Nomor port bersambung antar screen. Pola kabel & ukuran receiving card diatur per screen; kapasitas port, cadangan & port per controller berlaku untuk semua screen.</p>
          </section>
        )}
        <PanelCara a={a} />

        <PanelUkuranRC a={a} />

        <PanelPort a={a} />
      </div>

      <div className="space-y-3 min-w-0">
        <div className="kisi-nilai">
          <Nilai label="Receiving card" nilai={k.sel.length + k.tanpaPort.length} ket={m.multi ? `${m.per.length} screen` : `${t.K} × ${t.B}${t.kosong.size ? ` · ${t.kosong.size} kosong` : ''}`} />
          <Nilai label="Port LAN dipakai" nilai={g.portTerpakai} ket={`perkiraan pixel: ${portIdeal}`} nada={g.portTerpakai > portIdeal ? 'awas' : undefined} />
          <Nilai label="Controller" nilai={g.ppk > 0 ? g.controller + g.controllerCadangan : '-'}
            ket={g.ppk > 0 ? `${g.ppkPenuh} port/unit${d.namaHw && s.ppk === null ? ` · ${d.namaHw}` : ''}${g.controllerCadangan ? ` · ${g.controllerCadangan} cadangan` : g.cadangan === 'loop' ? ` · ${g.ppk} utama + ${g.ppk} cadangan` : ''}` : 'isi port per controller'} />
          <Nilai label="Beban rata-rata" nilai={f(rataBeban, 0)} satuan="%" ket={m.multi ? `semua screen` : `resolusi ${t.resX}×${t.resY}`} />
        </div>
        {k.galat && <p className="text-[12.5px] text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{k.galat}</p>}
        {s.mode === 'manual' && k.tanpaPort.length > 0 && (
          <p className="text-[12.5px] text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{k.tanpaPort.length} receiving card belum tersambung (bingkai jingga putus-putus).</p>
        )}
        {k.lewat.length > 0 && (
          <p className="text-[12.5px] text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">Port {k.lewat.join(', ')} melebihi batas beban {s.beban}% - pindahkan sebagian receiving card ke port lain.</p>
        )}
        {t.rc && t.rcLewat && (
          <p className="text-[12.5px] text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
            Ada receiving card melebihi kapasitas {t.rc.nama} ({t.rc.w}×{t.rc.h} px). Kurangi {nUnit} per receiving card atau pilih model yang lebih besar.
          </p>
        )}
        {s.cadangan === 'loop' && t.ppkPenuh === 1 && (
          <p className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">Controller hanya 1 port: loop cadangan butuh port kedua. Pilih &quot;Controller&quot; atau hardware dengan port lebih banyak.</p>
        )}
        {!t.rc && Math.max(...t.lebar) * Math.max(...t.tinggi) > PX_RC_UMUM && !k.galat && (
          <p className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            Ada receiving card lebih dari ±512×512 px (kapasitas receiving card umum). Kecilkan area per receiving card atau cek tipe receiving card.
          </p>
        )}
        {t.custom && (t.resX !== resKalk.x || t.resY !== resKalk.y) && (
          <p className="text-[12.5px] text-amber-800">Resolusi receiving card ({t.resX}×{t.resY}) berbeda dari layar di kalkulator ({resKalk.x}×{resKalk.y}).</p>
        )}
        {s.mode === 'template' && s.bagi === 'baris' && zona > 1 && (
          <p className="text-[12.5px] text-slate-700">Satu {s.arah === 'horizontal' ? 'baris' : 'kolom'} melebihi kapasitas port, jadi layar dibagi <b>{zona} zona</b> yang dikabel terpisah. Pilih &quot;Isi penuh&quot; untuk menghemat port.</p>
        )}
        <KanvasKoneksi a={a} />
        <PanelController a={a} />
        <TabelPort a={a} />
        <Catatan>Label sel = port-urutan receiving card, angka kecil = ukuran receiving card (px); P1, P2, … = titik masuk kabel LAN{s.cadangan !== 'tidak' ? '; B1, B2, … = kabel cadangan dari ujung rantai' : ''}. Samakan dengan NovaLCT (Screen Configuration → Screen Connection) saat instalasi.</Catatan>
      </div>
    </div>
  );
}
