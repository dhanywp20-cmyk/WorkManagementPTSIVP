'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { bagianBoq, type BarisBoq, CSS_BOQ, GAYA_BOQ, htmlGambarBoq, infoBoq, judulBoq, type KolomEditBoq, KOLOM_BOQ, LEBAR_BOQ, lebarPx, ptPx } from '@/lib/sld/boq';
import type { KeadaanSLD } from './useKeadaanSLD';

const CSS_ISI = `.boq-isi{display:block;width:100%;min-height:${ptPx(GAYA_BOQ.tinggiBaris) - 4}px;border:0;margin:0;padding:0;background:transparent;font:inherit;color:inherit;`
  + 'resize:none;field-sizing:content;outline:none;border-radius:2px}.boq-isi:hover{background:#f1f5f9}.boq-isi:focus{background:#eff6ff;box-shadow:inset 0 0 0 1px #93c5fd}'
  + '.boq-isi::placeholder{color:#94a3b8}';

const MAKS: Record<KolomEditBoq, number> = { kategori: 120, merek: 120, model: 200, spek: 800, fungsi: 600 };

function Isian({ a, r, k, placeholder }: { a: KeadaanSLD; r: BarisBoq; k: KolomEditBoq; placeholder: string }) {
  return (
    <textarea className="boq-isi" value={r[k]} placeholder={placeholder} aria-label={`${placeholder} - ${r.model}`}
      onChange={e => a.ubahBoq(r.ruang, r.kunci, { [k]: e.target.value.slice(0, MAKS[k]) })} />
  );
}

export function LembarBoq({ a }: { a: KeadaanSLD }) {
  const bagian = useMemo(() => bagianBoq(a.proyek), [a.proyek]);
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
        Klik sel <b>Kategori</b>, <b>Merek</b>, <b>Model</b>, <b>Spesifikasi Singkat</b> atau <b>Fungsi di Solusi</b> untuk mengisi / menyesuaikan.
        Kategori, merek &amp; model terisi otomatis dari perangkat di Sheet 1; perubahan di sini hanya untuk BOQ. <b>Harga</b> sengaja kosong untuk diisi sales.
      </p>
      <div ref={wadah} className="overflow-auto rounded-xl border border-slate-200 bg-slate-100 p-4 max-h-[78vh]" style={{ colorScheme: 'light' }}>
        <style>{CSS_BOQ + CSS_ISI}</style>
        <div className="boq" style={{ zoom, padding: 12 }}>
          <div className="boq-judul">{judulBoq(a.proyek)}</div>
          <table className="boq-info">
            <tbody>{infoBoq(a.proyek).map(([l, v], i) => <tr key={l}><td className="l">{l}</td><td className={i === 2 ? 'biru' : undefined}>{v}</td></tr>)}</tbody>
          </table>
          <table className="boq-tabel">
            <colgroup>{KOLOM_BOQ.map(k => <col key={k.judul} style={{ width: lebarPx(k.lebar) }} />)}</colgroup>
            <thead><tr>{KOLOM_BOQ.map(k => <th key={k.judul}>{k.judul}</th>)}</tr></thead>
            {bagian.map(bg => (
              <tbody key={bg.ruang}>
                <tr><td className="seksi" colSpan={KOLOM_BOQ.length}>{bg.judul}</td></tr>
                {bg.baris.map(r => (
                  <tr key={r.kunci}>
                    <td className="c">{r.no}</td>
                    <td className="gbr" dangerouslySetInnerHTML={{ __html: htmlGambarBoq(r.contoh) }} />
                    <td><Isian a={a} r={r} k="kategori" placeholder="Kategori" /></td>
                    <td><Isian a={a} r={r} k="merek" placeholder="Merek" /></td>
                    <td className="b"><Isian a={a} r={r} k="model" placeholder="Model / Part No." /></td>
                    <td><Isian a={a} r={r} k="spek" placeholder="Ketik spesifikasi singkat..." /></td>
                    <td><Isian a={a} r={r} k="fungsi" placeholder="Ketik fungsi di solusi..." /></td>
                    <td className="qty">{r.qty}</td>
                    <td className="c">{r.satuan}</td>
                    <td className="harga" />
                    <td className="total">-</td>
                  </tr>
                ))}
                {!bg.baris.length && <tr><td colSpan={KOLOM_BOQ.length} style={{ height: 'auto', color: '#64748b' }}>Belum ada perangkat di ruangan ini.</td></tr>}
              </tbody>
            ))}
          </table>
        </div>
      </div>
    </div>
  );
}
