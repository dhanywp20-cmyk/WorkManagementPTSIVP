'use client';
import { useEffect, useState } from 'react';
import { FolderOpen, Replace, SaveAll, Search, Trash2 } from 'lucide-react';
import { Modal, TombolModal } from '@/components/shared/Modal';
import { ConfirmDialog, type ConfirmState } from '@/components/shared/ConfirmDialog';
import type { BarisFile } from './tipe';
import type { Berkas } from './useBerkas';

const tgl = (x: string) => new Date(x).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const sama = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function DialogBerkas({ b }: { b: Berkas }) {
  if (!b.dialog) return null;
  return <IsiDialog key={b.dialog} b={b} mode={b.dialog} />;
}

function IsiDialog({ b, mode }: { b: Berkas; mode: 'buka' | 'sebagai' }) {
  const { aktif, adapter } = b;
  const [q, setQ] = useState('');
  const [daftar, setDaftar] = useState<BarisFile[] | null>(null);
  const [galat, setGalat] = useState('');
  const [segar, setSegar] = useState(0);
  const [nama, setNama] = useState(() => (aktif ? (aktif.bolehUbah ? aktif.nama : `${aktif.nama} (salinan)`) : b.namaAwal()));
  const [target, setTarget] = useState<BarisFile | null>(null);
  const [konfirmasi, setKonfirmasi] = useState<ConfirmState | null>(null);

  useEffect(() => {
    let hidup = true;
    const t = setTimeout(() => {
      adapter.daftar(q.trim()).then(d => { if (hidup) { setDaftar(d); setGalat(''); } })
        .catch((e: Error) => { if (hidup) { setDaftar([]); setGalat(e.message); } });
    }, q ? 300 : 0);
    return () => { hidup = false; clearTimeout(t); };
  }, [adapter, q, segar]);

  const tutup = () => b.setDialog(null);
  const hapus = (d: BarisFile) => setKonfirmasi({
    message: `Hapus "${d.nama}"?`, description: 'Seluruh tim tidak bisa membukanya lagi. Tidak bisa dibatalkan.', danger: true, confirmLabel: 'Hapus',
    onConfirm: async () => {
      setKonfirmasi(null);
      try { await b.hapus(d.id); setSegar(x => x + 1); } catch (e) { setGalat((e as Error).message); }
    },
  });
  const kirim = () => {
    const n = nama.trim();
    if (!n) return;
    const ganti = target ?? daftar?.find(d => d.bolehUbah && sama(d.nama, n)) ?? null;
    if (!ganti) { void b.simpanSebagai(n); return; }
    setKonfirmasi({
      message: `Ganti "${ganti.nama}"?`, confirmLabel: 'Ganti', danger: true,
      description: `Isi lama berkas itu ditimpa dengan ${adapter.jenis} yang sedang terbuka.${ganti.id === aktif?.id ? '' : ' Berkas yang sedang terbuka ikut pindah ke berkas itu.'}`,
      onConfirm: () => { setKonfirmasi(null); void b.simpanSebagai(n, ganti.id); },
    });
  };
  const ubahNama = (v: string) => { setNama(v.slice(0, 120)); if (target && !sama(target.nama, v)) setTarget(null); };
  const tombolSimpan = target ? `Ganti "${target.nama}"` : 'Simpan sebagai baru';

  return (
    <>
      <Modal buka onTutup={tutup} ukuran="penuh" tutupDiLuar={mode === 'buka'}
        judul={mode === 'buka' ? `Buka ${adapter.jenis}` : `Simpan ${adapter.jenis} sebagai`}
        ikon={mode === 'buka' ? <FolderOpen size={18} /> : <SaveAll size={18} />}
        keterangan={mode === 'buka' ? 'Berkas tersimpan di server tim. Berkas milik orang lain bisa dibuka; menyimpannya membuat salinan Anda.'
          : 'Ketik nama baru untuk membuat berkas baru, atau pilih berkas Anda di daftar untuk menggantinya (replace).'}
        footer={mode === 'sebagai' ? (
          <>
            <TombolModal onClick={tutup} disabled={b.sibuk}>Batal</TombolModal>
            <TombolModal jenis={target ? 'bahaya' : 'utama'} onClick={kirim} disabled={b.sibuk || !nama.trim()}>{b.sibuk ? 'Menyimpan…' : tombolSimpan}</TombolModal>
          </>
        ) : undefined}>
        {mode === 'sebagai' && (
          <label className="block mb-3 max-w-xl">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">Nama berkas</span>
            <input value={nama} onChange={e => ubahNama(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter') kirim(); }}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-base sm:text-sm" />
          </label>
        )}
        {b.pesan?.galat && <p className="mb-2 text-[12.5px] font-semibold text-rose-700">{b.pesan.teks}</p>}
        {galat && <p className="mb-2 text-[12.5px] font-semibold text-rose-700">{galat}</p>}
        <label className="relative block mb-2">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari nama berkas atau pembuat" aria-label="Cari berkas"
            className="w-full rounded-xl border border-slate-200 pl-8 pr-3 py-2 text-base sm:text-sm" />
        </label>
        {mode === 'sebagai' && <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">Atau ganti berkas yang ada</p>}
        {daftar === null ? <p className="text-sm text-slate-500">Memuat…</p> : daftar.length === 0 ? (
          <p className="text-sm text-slate-500">{q ? 'Tidak ada yang cocok.' : 'Belum ada berkas tersimpan.'}</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 max-h-[60vh] overflow-y-auto p-0.5">
            {daftar.map(d => {
              const dipilih = target?.id === d.id, bisa = mode === 'buka' || d.bolehUbah;
              const kelas = dipilih ? 'border-rose-300 bg-rose-50' : aktif?.id === d.id ? 'border-blue-400 bg-blue-50/60' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50';
              return (
                <li key={d.id} className={`flex items-start gap-1 rounded-xl border p-2.5 ${kelas}`}>
                  <button type="button" disabled={b.sibuk || !bisa} title={bisa ? '' : `Milik ${d.oleh || 'anggota lain'} - tidak bisa diganti`}
                    onClick={() => (mode === 'buka' ? void b.buka(d.id) : (setTarget(dipilih ? null : d), setNama(dipilih ? nama : d.nama)))}
                    className="min-w-0 flex-1 text-left disabled:opacity-50">
                    <span className="flex items-start gap-1 text-[13px] font-bold text-blue-700">
                      {mode === 'sebagai' && d.bolehUbah && <Replace size={13} className={`mt-0.5 shrink-0 ${dipilih ? 'text-rose-600' : 'text-slate-400'}`} aria-hidden="true" />}
                      <span className="line-clamp-2 break-words hover:underline">{d.nama}</span>
                    </span>
                    {(aktif?.id === d.id || dipilih) && (
                      <span className={`block text-[11px] font-bold ${dipilih ? 'text-rose-700' : 'text-emerald-700'}`}>{dipilih ? 'akan diganti' : 'sedang terbuka'}</span>
                    )}
                    {d.ket && <span className="block text-[11.5px] text-slate-600 truncate">{d.ket}</span>}
                    <span className="mt-1 block text-[11px] text-slate-500 truncate">{d.oleh || '—'}</span>
                    <span className="block text-[11px] text-slate-500">{tgl(d.pada)}</span>
                  </button>
                  {mode === 'buka' && d.bolehUbah && !b.hanyaLihat && (
                    <button type="button" aria-label={`Hapus ${d.nama}`} title="Hapus berkas" onClick={() => hapus(d)}
                      className="w-7 h-7 shrink-0 grid place-items-center rounded-md text-slate-500 hover:text-rose-700 hover:bg-rose-50"><Trash2 size={14} /></button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Modal>
      <ConfirmDialog state={konfirmasi} onCancel={() => setKonfirmasi(null)} />
    </>
  );
}
