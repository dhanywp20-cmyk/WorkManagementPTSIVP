'use client';
/** Editor kecil untuk pratinjau Product Comparison: teks bebas, atau satu nilai spesifikasi (teks, status, ✓, sumber). */
import { useState } from 'react';
import { type Bahasa, LABEL, type NilaiSpek, type StatusNilai } from '@/lib/perbandingan';

export type Sunting =
  | { jenis: 'teks'; judul: string; nilai: string; panjang?: boolean; simpan: (v: string) => void; hapus?: () => void }
  | { jenis: 'nilai'; judul: string; nilai: NilaiSpek; produk: string; bahasa: Bahasa; bolehUnggul: boolean; simpan: (v: NilaiSpek) => void };

const STATUS: { v: StatusNilai; l: string }[] = [
  { v: 'ada', l: 'Disebut di brosur' }, { v: 'tidak-disebut', l: 'Tidak disebut' }, { v: 'tidak-tersedia', l: 'Brosur: tidak tersedia' }, { v: 'cek', l: 'Perlu dicek' },
];

export function EditorIsi({ s, tutup }: { s: Sunting; tutup: () => void }) {
  const [teks, setTeks] = useState(s.jenis === 'teks' ? s.nilai : s.nilai.teks);
  const [status, setStatus] = useState<StatusNilai>(s.jenis === 'nilai' ? s.nilai.status : 'ada');
  const [unggul, setUnggul] = useState(s.jenis === 'nilai' && !!s.nilai.unggul);
  const isian = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-base sm:text-sm';
  const simpan = () => {
    if (s.jenis === 'teks') s.simpan(teks.trim());
    else {
      const { alasanCek, ...lama } = s.nilai; void alasanCek;
      s.simpan({ ...lama, teks: status === 'tidak-disebut' ? '' : teks.trim(), status, ...(status === 'ada' && unggul ? { unggul: true } : { unggul: undefined }),
        ...(status === 'cek' ? { alasanCek: s.nilai.alasanCek ?? 'Ditandai untuk ditinjau.' } : {}) });
    }
    tutup();
  };
  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-slate-900/40 p-3" onClick={tutup}>
      <div role="dialog" aria-label={s.judul} className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-4 space-y-3" onClick={e => e.stopPropagation()}>
        <p className="text-[14px] font-bold text-slate-900">{s.judul}{s.jenis === 'nilai' && <span className="font-semibold text-slate-500"> · {s.produk}</span>}</p>
        {s.jenis === 'nilai' && (
          <select value={status} onChange={e => setStatus(e.target.value as StatusNilai)} className={isian} aria-label="Status">
            {STATUS.map(x => <option key={x.v} value={x.v}>{x.l}</option>)}
          </select>
        )}
        {(s.jenis === 'teks' || status !== 'tidak-disebut') ? (
          <textarea autoFocus value={teks} onChange={e => setTeks(e.target.value)} rows={s.jenis === 'teks' && s.panjang ? 6 : 2} className={isian}
            placeholder={s.jenis === 'nilai' && status === 'tidak-tersedia' ? LABEL[s.bahasa].tidakTersedia : ''} />
        ) : <p className="text-[13px] italic text-slate-400">{LABEL[s.jenis === 'nilai' ? s.bahasa : 'en'].tidakDisebut}</p>}
        {s.jenis === 'nilai' && s.bolehUnggul && status === 'ada' && (
          <label className="flex items-center gap-2 text-[13px] font-semibold text-slate-700">
            <input type="checkbox" className="w-4 h-4" checked={unggul} onChange={e => setUnggul(e.target.checked)} /> Unggul ✓
          </label>
        )}
        {s.jenis === 'nilai' && s.nilai.bukti?.kutipan && (
          <p className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-[12px] text-slate-600">
            <span className="font-bold text-slate-700">Sumber{s.nilai.bukti.halaman ? ` · hal. ${s.nilai.bukti.halaman}` : ''}:</span> “{s.nilai.bukti.kutipan}”
          </p>
        )}
        {s.jenis === 'nilai' && s.nilai.alasanCek && <p className="text-[12px] font-semibold text-amber-700">{s.nilai.alasanCek}</p>}
        <div className="flex items-center gap-2 pt-1">
          {s.jenis === 'teks' && s.hapus && <button type="button" onClick={() => { s.hapus!(); tutup(); }} className="px-3 py-2 rounded-lg text-[13px] font-bold text-rose-700 hover:bg-rose-50">Hapus</button>}
          <button type="button" onClick={tutup} className="ml-auto px-3 py-2 rounded-lg text-[13px] font-bold text-slate-600 hover:bg-slate-100">Batal</button>
          <button type="button" onClick={simpan} className="px-4 py-2 rounded-lg text-[13px] font-bold text-white bg-blue-700 hover:bg-blue-800">Simpan</button>
        </div>
      </div>
    </div>
  );
}
