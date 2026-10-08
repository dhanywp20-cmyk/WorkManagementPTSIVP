'use client';
/** Kartu jalur & panjang kabel: rekap per jenis, jadwal kabel. */
import { Catatan, f, Kartu, TombolSalin } from '../../bersama/ui';
import { AOC_MAKS, HDMI_MAKS, rekapKabel } from '../inti';
import type { AlatDesain } from './alat';

export function KartuKabel({ a }: { a: AlatDesain }) {
  const { benda, kabel, namaDesain } = a.K;
  return (
    <>
      {(benda.some(b => b.jenis === 'rak') || kabel.length > 0) && (
        <Kartu judul="Jalur & panjang kabel" aksi={kabel.length ? <TombolSalin teks={() => [
          `*Jadwal kabel ${namaDesain || 'desain'}*`,
          ...rekapKabel(kabel).map(r => `- ${r.kabel.nama}: ${r.tarikan} tarikan, ±${f(r.meter, 1)} m (${r.gulungan})`),
          '', ...kabel.map(k => `${k.dari} → ${k.ke}: ${k.kabel.nama} ±${f(k.panjang, 1)} m lewat ${k.lewat}`),
        ].join('\n')} /> : undefined}>
          {!kabel.length ? <p className="text-sm text-slate-600">Belum ada perangkat ber-kabel (display, proyektor, kamera, speaker, mic, touch panel).</p> : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
                {rekapKabel(kabel).map(r => (
                  <div key={r.kabel.kunci} className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                    <p className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: `#${r.kabel.warna.toString(16).padStart(6, '0')}` }} />{r.kabel.nama}</p>
                    <p className="text-lg font-extrabold text-slate-900 tabular-nums">±{f(r.meter, 0)} m</p>
                    <p className="text-[11px] text-slate-500">{r.tarikan} tarikan · {r.gulungan}</p>
                  </div>
                ))}
              </div>
              <div className="overflow-x-auto max-h-72 overflow-y-auto rounded-xl border border-slate-200">
                <table className="w-full text-[12.5px]">
                  <thead className="bg-slate-50 text-slate-600 sticky top-0"><tr>
                    <th className="text-left font-bold px-3 py-2">Dari</th><th className="text-left font-bold px-3 py-2">Ke</th>
                    <th className="text-left font-bold px-3 py-2">Kabel</th><th className="text-right font-bold px-3 py-2">Panjang</th><th className="text-left font-bold px-3 py-2">Lewat</th>
                  </tr></thead>
                  <tbody>{kabel.map(k => (
                    <tr key={k.id} className="border-t border-slate-100">
                      <td className="px-3 py-1.5 font-semibold text-slate-800">{k.dari}</td><td className="px-3 py-1.5 text-slate-600">{k.ke}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap"><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5 align-middle" style={{ background: `#${k.kabel.warna.toString(16).padStart(6, '0')}` }} />{k.kabel.nama}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">±{f(k.panjang, 1)} m</td><td className="px-3 py-1.5 text-slate-600">{k.lewat}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <Catatan>Rute siku-siku ke rack terdekat di ruang yang sama: perangkat dinding/plafon lewat tray plafon, perangkat meja/lantai lewat lantai (floor box). Panjang = rute + 10% lekukan + 1,5 m service loop. Video otomatis HDMI; &gt; {HDMI_MAKS} m HDMI AOC (fiber aktif), &gt; {AOC_MAKS} m fiber extender. Jenis &amp; jumlah kabel tiap perangkat bisa diatur sendiri: klik perangkatnya → Atur → Kabel ke rack. Meja operator = PC operator, meja rapat / dosen / podium = laptop lewat table box. Nyalakan &quot;Jalur kabel&quot; untuk melihat rutenya di 3D.</Catatan>
            </>
          )}
        </Kartu>
      )}
    </>
  );
}
