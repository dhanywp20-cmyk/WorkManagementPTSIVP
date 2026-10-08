'use client';
/**
 * Daftar entri satu jenis pustaka: cari, tabel (kolom dari registri) atau kartu artikel; Admin bisa
 * tambah / ubah / hapus. Artikel dibuka di modal baca.
 */
import { useMemo, useState } from 'react';
import { ConfirmDialog, type ConfirmState } from '@/components/shared';
import { Modal } from '@/components/shared/Modal';
import { type EntriPustaka, type JenisPustaka, teksDari } from '@/lib/pustaka';
import { FormEntri } from './FormEntri';
import { hapusEntri, usePustaka } from './usePustaka';

const tampil = (e: EntriPustaka, k: string, jenis: JenisPustaka) => {
  const b = jenis.bidang.find(x => x.k === k)!;
  const v = e.data[k];
  if (v === undefined || v === '') return '—';
  if (b.tipe === 'pilih') return b.opsi?.find(o => o.v === String(v))?.l ?? String(v);
  return `${typeof v === 'number' ? v.toLocaleString('id-ID') : v}${b.satuan ? ` ${b.satuan}` : ''}`;
};

export function DaftarPustaka({ jenis }: { jenis: JenisPustaka }) {
  const { entri, bolehAtur, memuat, gagal } = usePustaka(jenis.v);
  const [cari, setCari] = useState('');
  const [ubah, setUbah] = useState<EntriPustaka | null | 'baru'>(null);
  const [baca, setBaca] = useState<EntriPustaka | null>(null);
  const [konfirmasi, setKonfirmasi] = useState<ConfirmState | null>(null);
  const [pesan, setPesan] = useState('');
  const kolom = jenis.bidang.filter(b => b.kolom);
  const daftar = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return q ? entri.filter(e => `${e.nama} ${Object.values(e.data).join(' ')}`.toLowerCase().includes(q)) : entri;
  }, [entri, cari]);
  const hapus = (e: EntriPustaka) => setKonfirmasi({
    message: `Hapus "${e.nama}" dari Pustaka?`, danger: true, confirmLabel: 'Hapus',
    description: 'Kalkulator tidak bisa memilihnya lagi. Hasil hitung yang sudah dicetak tidak berubah.',
    onConfirm: async () => { setKonfirmasi(null); const h = await hapusEntri(e.id, jenis.v); setPesan(h.ok ? `"${e.nama}" dihapus.` : h.alasan ?? 'Gagal menghapus.'); },
  });
  const artikel = jenis.kelompok === 'artikel';
  return (
    <div className="space-y-3">
      <ConfirmDialog state={konfirmasi} onCancel={() => setKonfirmasi(null)} />
      <div className="flex flex-wrap items-center gap-2">
        <input value={cari} onChange={e => setCari(e.target.value)} placeholder={`Cari ${jenis.l.toLowerCase()}…`} aria-label={`Cari ${jenis.l}`}
          className="flex-1 min-w-[200px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-base sm:text-sm" />
        {bolehAtur && (
          <button type="button" onClick={() => setUbah('baru')} className="px-3.5 py-2 rounded-xl bg-blue-700 text-white text-sm font-bold hover:bg-blue-800">
            + Tambah {artikel ? 'artikel' : jenis.l.toLowerCase()}
          </button>
        )}
      </div>
      <p className="text-[12px] text-slate-600">{jenis.ket}{!bolehAtur && ' Hanya Admin yang bisa mengubah isi.'}</p>
      {pesan && <p role="status" className="rounded-lg bg-slate-50 px-3 py-2 text-[12.5px] font-semibold text-slate-700">{pesan}</p>}
      {memuat ? <p className="text-sm text-slate-500 py-6 text-center">Memuat…</p>
        : gagal ? <p className="text-sm text-rose-700 py-6 text-center">Pustaka tidak bisa dimuat - kalkulator memakai nilai bawaan.</p>
        : !daftar.length ? <p className="text-sm text-slate-500 py-6 text-center">{cari ? 'Tidak ada yang cocok.' : 'Belum ada isi.'}</p>
        : artikel ? (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {daftar.map(e => (
              <div key={e.id} className="rounded-xl border border-slate-200 bg-white p-3.5">
                <button type="button" onClick={() => setBaca(e)} className="text-left w-full">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-blue-700">{tampil(e, 'kategori', jenis)}</span>
                  <span className="block text-[14px] font-bold text-slate-900 mt-0.5">{e.nama}</span>
                  <span className="block text-[12.5px] text-slate-600 mt-1 leading-snug">{teksDari(e, 'ringkas')}</span>
                </button>
                {bolehAtur && (
                  <div className="flex gap-1.5 mt-2">
                    <button type="button" onClick={() => setUbah(e)} className="px-2 py-1 rounded-lg border border-slate-200 text-[11.5px] font-semibold text-slate-700 hover:bg-slate-50">Ubah</button>
                    <button type="button" onClick={() => hapus(e)} className="px-2 py-1 rounded-lg border border-rose-200 text-[11.5px] font-semibold text-rose-700 hover:bg-rose-50">Hapus</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-[12.5px]">
              <thead className="bg-slate-50 text-slate-600"><tr>
                <th className="px-3 py-2 text-left">Nama</th>
                {kolom.map(b => <th key={b.k} className="px-3 py-2 text-left whitespace-nowrap">{b.l}</th>)}
                <th className="px-3 py-2 text-left">Diubah</th>
                {bolehAtur && <th className="px-3 py-2" />}
              </tr></thead>
              <tbody>{daftar.map(e => (
                <tr key={e.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2 font-semibold text-slate-800">{e.nama}{teksDari(e, 'catatan') && <span className="block text-[11.5px] font-normal text-slate-500">{teksDari(e, 'catatan')}</span>}</td>
                  {kolom.map(b => <td key={b.k} className="px-3 py-2 tabular-nums whitespace-nowrap">{tampil(e, b.k, jenis)}</td>)}
                  <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{e.diubah_oleh_nama ?? '—'}</td>
                  {bolehAtur && (
                    <td className="px-3 py-2 whitespace-nowrap text-right">
                      <button type="button" onClick={() => setUbah(e)} className="px-2 py-1 rounded-lg border border-slate-200 text-[11.5px] font-semibold text-slate-700 hover:bg-slate-50">Ubah</button>{' '}
                      <button type="button" onClick={() => hapus(e)} className="px-2 py-1 rounded-lg border border-rose-200 text-[11.5px] font-semibold text-rose-700 hover:bg-rose-50">Hapus</button>
                    </td>
                  )}
                </tr>))}
              </tbody>
            </table>
          </div>
        )}
      {ubah && <FormEntri jenis={jenis} entri={ubah === 'baru' ? null : ubah} onTutup={() => setUbah(null)} />}
      {baca && (
        <Modal buka onTutup={() => setBaca(null)} ukuran="lg" judul={baca.nama} keterangan={teksDari(baca, 'ringkas')}>
          <div className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-slate-800">{teksDari(baca, 'isi')}</div>
          {teksDari(baca, 'sumber') && <p className="mt-4 text-[12px] text-slate-500">Sumber: {teksDari(baca, 'sumber')}</p>}
          <p className="mt-1 text-[11.5px] text-slate-400">Terakhir diubah: {baca.diubah_oleh_nama ?? '—'}</p>
        </Modal>
      )}
    </div>
  );
}
