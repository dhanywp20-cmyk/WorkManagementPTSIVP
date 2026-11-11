'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { barisBoq, CSS_BOQ, GAYA_BOQ, htmlGambarBoq, infoBoq, judulBoq, KOLOM_BOQ, LEBAR_BOQ, lebarPx, ptPx, SEKSI_BOQ } from '@/lib/sld/boq';
import type { KeadaanSLD } from './useKeadaanSLD';

const CSS_ISI = `.boq-isi{display:block;width:100%;min-height:${ptPx(GAYA_BOQ.tinggiBaris) - 4}px;border:0;margin:0;padding:0;background:transparent;font:inherit;color:inherit;`
  + 'resize:none;field-sizing:content;outline:none;border-radius:2px}.boq-isi:hover{background:#f1f5f9}.boq-isi:focus{background:#eff6ff;box-shadow:inset 0 0 0 1px #93c5fd}'
  + '.boq-isi::placeholder{color:#94a3b8}';

export function LembarBoq({ a }: { a: KeadaanSLD }) {
  const baris = useMemo(() => barisBoq(a.dok), [a.dok]);
  const wadah = useRef<HTMLDivElement>(null);
  const [lebar, setLebar] = useState(1200);
  useEffect(() => {
    const el = wadah.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setLebar(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const zoom = Math.min(1, Math.max(0.6, (lebar - 32) / LEBAR_BOQ));
  return (
    <div className="space-y-2">
      <p className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-[12.5px] text-blue-900">
        Klik kolom <b>Spesifikasi Singkat</b> dan <b>Fungsi di Solusi</b> untuk mengisi. <b>Harga</b> sengaja kosong untuk diisi sales di hasil cetak.
        No, gambar, kategori, merek / model dan qty mengikuti perangkat di Sheet 1.
      </p>
      <div ref={wadah} className="overflow-auto rounded-xl border border-slate-200 bg-slate-100 p-4 max-h-[78vh]" style={{ colorScheme: 'light' }}>
        <style>{CSS_BOQ + CSS_ISI}</style>
        <div className="boq" style={{ zoom, padding: 12 }}>
          <div className="boq-judul">{judulBoq(a.dok)}</div>
          <table className="boq-info">
            <tbody>{infoBoq(a.dok).map(([l, v], i) => <tr key={l}><td className="l">{l}</td><td className={i === 2 ? 'biru' : undefined}>{v}</td></tr>)}</tbody>
          </table>
          <table className="boq-tabel">
            <colgroup>{KOLOM_BOQ.map(k => <col key={k.judul} style={{ width: lebarPx(k.lebar) }} />)}</colgroup>
            <thead><tr>{KOLOM_BOQ.map(k => <th key={k.judul}>{k.judul}</th>)}</tr></thead>
            <tbody>
              <tr><td className="seksi" colSpan={KOLOM_BOQ.length}>{SEKSI_BOQ}</td></tr>
              {baris.map(r => (
                <tr key={r.kunci}>
                  <td className="c">{r.no}</td>
                  <td className="gbr" dangerouslySetInnerHTML={{ __html: htmlGambarBoq(r.contoh) }} />
                  <td>{r.kategori}</td>
                  <td>{r.merek}</td>
                  <td className="b">{r.model}</td>
                  <td><textarea className="boq-isi" value={r.spek} onChange={e => a.ubahBoq(r.kunci, { spek: e.target.value.slice(0, 800) })}
                    placeholder="Ketik spesifikasi singkat..." aria-label={`Spesifikasi singkat ${r.model}`} /></td>
                  <td><textarea className="boq-isi" value={r.fungsi} onChange={e => a.ubahBoq(r.kunci, { fungsi: e.target.value.slice(0, 600) })}
                    placeholder="Ketik fungsi di solusi..." aria-label={`Fungsi di solusi ${r.model}`} /></td>
                  <td className="qty">{r.qty}</td>
                  <td className="c">{r.satuan}</td>
                  <td className="harga" />
                  <td className="total">-</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!baris.length && <p style={{ padding: '16px 4px', color: '#64748b' }}>Belum ada perangkat di Sheet 1. Tambahkan perangkat dari katalog atau impor BOM.</p>}
        </div>
      </div>
    </div>
  );
}
