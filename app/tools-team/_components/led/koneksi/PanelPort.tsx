'use client';
/** Kapasitas per port, batas beban, cadangan (loop / port), controller. */
import { Angka, Pilih, Segmen } from '../../bersama/ui';
import { RECEIVING_CARD } from '@/lib/av-hitung';
import type { AlatRuangKoneksi } from './useRuangKoneksi';

export function PanelPort({ a }: { a: AlatRuangKoneksi }) {
  const { d, s, t, ubah } = a;
  return (
    <>
      <section className="rounded-2xl bg-white border border-slate-200 p-3 space-y-3">
        <Angka label="Kapasitas per port" nilai={t.pxPort} satuan="px" step={1000} onUbah={v => v >= 1000 && ubah({ pxPort: Math.round(v) })}
          bantuan={s.pxPort === null ? `Dari kalkulator: ${d.refresh} Hz, ${d.bit}-bit` : 'Diisi manual'} />
        {s.pxPort !== null && <button type="button" onClick={() => ubah({ pxPort: null })} className="-mt-2 text-[12px] font-semibold text-blue-700 hover:underline">Ikut kalkulator ({d.pxPerPort.toLocaleString('id-ID')} px)</button>}
        <Angka label="Batas beban port" nilai={s.beban} satuan="%" step={1} onUbah={v => v >= 10 && v <= 100 && ubah({ beban: Math.round(v) })}
          bantuan={`Maks ${Math.floor((t.pxPort * s.beban) / 100).toLocaleString('id-ID')} px per port`} />
        <Pilih label="Model receiving card" nilai={s.rcModel ?? ''} onUbah={v => ubah({ rcModel: v || null, rcKol: null, rcBaris: null })}
          opsi={[{ v: '', l: 'Umum (±512 × 512 px)' }, ...RECEIVING_CARD.map(r => ({ v: r.nama, l: `${r.nama} · ${r.w}×${r.h} px · ${r.ket}` }))]} />
        <Segmen label="Kabel cadangan (backup)" nilai={s.cadangan} onUbah={v => ubah({ cadangan: v })}
          opsi={[{ v: 'tidak', l: 'Tidak' }, { v: 'loop', l: 'Loop port' }, { v: 'controller', l: 'Controller' }]} />
        {s.cadangan !== 'tidak' && (
          <p className="-mt-2 text-[11px] text-slate-500">
            {s.cadangan === 'loop'
              ? 'Ujung tiap rantai kembali ke port cadangan di controller yang sama (separuh port controller untuk cadangan). Satu kabel putus, layar tetap tampil.'
              : 'Ujung tiap rantai disambung ke controller cadangan (hot backup). Controller utama mati, layar tetap tampil.'}
          </p>
        )}
        <Angka label="Port per controller" nilai={t.ppkPenuh} step={1} satuan="port" onUbah={v => v >= 0 && ubah({ ppk: Math.round(v) })}
          bantuan={s.ppk === null ? (d.namaHw ? `Dari ${d.namaHw}` : 'Belum ada hardware: isi manual') : 'Diisi manual'} />
        {s.ppk !== null && d.ppkHw > 0 && <button type="button" onClick={() => ubah({ ppk: null })} className="-mt-2 text-[12px] font-semibold text-blue-700 hover:underline">Ikut hardware ({d.ppkHw} port)</button>}
      </section>
    </>
  );
}
