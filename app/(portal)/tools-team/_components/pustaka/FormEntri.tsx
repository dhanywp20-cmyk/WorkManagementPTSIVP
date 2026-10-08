'use client';
/**
 * Formulir tambah / ubah entri pustaka - bidangnya dibentuk dari registri (lib/pustaka.ts), jadi jenis
 * baru otomatis punya formulir. Validasi akhir tetap di server (periksaEntri).
 */
import { useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { type Bidang, type EntriPustaka, type JenisPustaka, periksaEntri } from '@/lib/pustaka';
import { simpanEntri } from './usePustaka';

const kelas = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-200';

function Isian({ b, nilai, onUbah }: { b: Bidang; nilai: string; onUbah: (v: string) => void }) {
  const label = <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">{b.l}{b.satuan ? ` (${b.satuan})` : ''}{b.wajib ? ' *' : ''}</span>;
  if (b.tipe === 'pilih') return (
    <label className="block">{label}
      <select value={nilai} onChange={e => onUbah(e.target.value)} className={kelas}>
        <option value="">—</option>{b.opsi!.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </label>
  );
  if (b.tipe === 'panjang') return (
    <label className="block sm:col-span-2">{label}
      <textarea value={nilai} onChange={e => onUbah(e.target.value)} rows={b.k === 'isi' ? 12 : 3} className={`${kelas} leading-relaxed`} />
    </label>
  );
  return (
    <label className="block">{label}
      <input value={nilai} onChange={e => onUbah(e.target.value)} inputMode={b.tipe === 'angka' ? 'decimal' : undefined} className={`${kelas} ${b.tipe === 'angka' ? 'tabular-nums' : ''}`} />
    </label>
  );
}

export function FormEntri({ jenis, entri, onTutup }: { jenis: JenisPustaka; entri: EntriPustaka | null; onTutup: () => void }) {
  const [nama, setNama] = useState(entri?.nama ?? '');
  const [data, setData] = useState<Record<string, string>>(() => Object.fromEntries(jenis.bidang.map(b => [b.k, entri?.data[b.k] === undefined ? '' : String(entri.data[b.k])])));
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const simpan = async () => {
    const cek = periksaEntri(jenis.v, nama, data);
    if (!cek.ok) { setGalat(cek.alasan); return; }
    setSibuk(true); setGalat('');
    const h = await simpanEntri({ id: entri?.id, jenis: cek.jenis, nama: cek.nama, data: cek.data });
    setSibuk(false);
    if (!h.ok) { setGalat(h.alasan ?? 'Gagal menyimpan.'); return; }
    onTutup();
  };
  return (
    <Modal buka onTutup={onTutup} tutupDiLuar={false} ukuran={jenis.kelompok === 'artikel' ? 'lg' : 'md'}
      judul={`${entri ? 'Ubah' : 'Tambah'} ${jenis.l.toLowerCase()}`} keterangan={jenis.ket}
      footer={<>
        <button type="button" onClick={onTutup} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Batal</button>
        <button type="button" onClick={() => void simpan()} disabled={sibuk} className="px-4 py-2 rounded-xl bg-blue-700 text-white text-sm font-bold hover:bg-blue-800 disabled:opacity-60">{sibuk ? 'Menyimpan…' : 'Simpan'}</button>
      </>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">{jenis.kelompok === 'artikel' ? 'Judul' : 'Nama / model'} *</span>
          <input value={nama} onChange={e => setNama(e.target.value)} className={kelas} maxLength={120} />
        </label>
        {jenis.bidang.map(b => <Isian key={b.k} b={b} nilai={data[b.k] ?? ''} onUbah={v => setData(d => ({ ...d, [b.k]: v }))} />)}
      </div>
      {galat && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] font-semibold text-rose-700">{galat}</p>}
    </Modal>
  );
}
