'use client';
import { useEffect, useRef, useState } from 'react';
import { FilePlus2, FolderOpen, Save, SaveAll } from 'lucide-react';
import { ConfirmDialog, type ConfirmState } from '@/components/shared/ConfirmDialog';
import type { Berkas } from './useBerkas';

const kelasTombol = 'inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50';

export function useTombolSimpan(b: Berkas, akar: React.RefObject<HTMLElement | null>) {
  const bRef = useRef(b);
  useEffect(() => { bRef.current = b; });
  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 's' || e.defaultPrevented) return;
      if (!akar.current || akar.current.offsetParent === null || document.querySelector('[role="dialog"]')) return;
      const x = bRef.current;
      if (x.hanyaLihat) return;
      e.preventDefault();
      if (e.shiftKey) x.setDialog('sebagai'); else void x.simpan();
    };
    window.addEventListener('keydown', tekan);
    return () => window.removeEventListener('keydown', tekan);
  }, [akar]);
}

export function StatusBerkas({ b }: { b: Berkas }) {
  const { aktif, berubah } = b;
  const [teks, kelas, judul] = aktif
    ? !aktif.bolehUbah
      ? [aktif.nama, 'bg-blue-50 text-blue-800 border-blue-200', `${aktif.nama} - milik anggota lain. Simpan membuat salinan Anda.`]
      : berubah
        ? [aktif.nama, 'bg-amber-50 text-amber-900 border-amber-200', `${aktif.nama} - ada perubahan belum disimpan (Ctrl+S)`]
        : [aktif.nama, 'bg-emerald-50 text-emerald-800 border-emerald-200', `${aktif.nama} - tersimpan di server tim`]
    : [berubah ? 'Belum disimpan' : 'Berkas baru', berubah ? 'bg-amber-50 text-amber-900 border-amber-200' : 'bg-slate-50 text-slate-600 border-slate-200', 'Belum disimpan ke server tim - klik Simpan (Ctrl+S)'];
  return (
    <span title={judul} className={`inline-flex min-w-0 max-w-[16rem] items-center gap-1.5 h-7 px-2.5 rounded-full border text-[12px] font-semibold ${kelas}`}>
      {berubah && <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-amber-500" aria-label="ada perubahan belum disimpan" />}
      <span className="truncate">{teks}</span>
    </span>
  );
}

export function BilahFile({ b, tanpaStatus = false }: { b: Berkas; tanpaStatus?: boolean }) {
  const akar = useRef<HTMLDivElement>(null);
  const [konfirmasi, setKonfirmasi] = useState<ConfirmState | null>(null);
  useTombolSimpan(b, akar);
  const baru = () => {
    if (!b.baru) return;
    if (!b.berubah) { b.baru(); return; }
    setKonfirmasi({ message: 'Mulai berkas baru?', description: 'Perubahan yang belum disimpan akan hilang.', confirmLabel: 'Mulai baru', danger: true, onConfirm: () => { setKonfirmasi(null); b.baru?.(); } });
  };
  return (
    <div ref={akar} className="flex flex-wrap items-center gap-1 min-w-0 print:hidden" role="group" aria-label={`Berkas ${b.adapter.jenis}`}>
      {!tanpaStatus && <StatusBerkas b={b} />}
      {b.baru && <button type="button" onClick={baru} title="Mulai berkas baru (kosong)" className={kelasTombol}><FilePlus2 size={14} /> Baru</button>}
      <button type="button" onClick={() => b.setDialog('buka')} title={`Buka ${b.adapter.jenis} tersimpan`} className={kelasTombol}><FolderOpen size={14} /> Buka</button>
      {!b.hanyaLihat && (
        <>
          <button type="button" disabled={b.sibuk} onClick={() => void b.simpan()}
            title={b.aktif?.bolehUbah ? `Simpan perubahan ke "${b.aktif.nama}" (Ctrl+S)` : 'Simpan ke server tim (Ctrl+S)'}
            className={`${kelasTombol} ${b.berubah ? '!border-amber-300 !bg-amber-50 !text-amber-900' : ''}`}><Save size={14} /> {b.sibuk ? 'Menyimpan…' : 'Simpan'}</button>
          <button type="button" disabled={b.sibuk} onClick={() => b.setDialog('sebagai')} title="Simpan sebagai berkas baru, atau ganti (replace) berkas lain (Ctrl+Shift+S)"
            className={kelasTombol}><SaveAll size={14} /> Simpan sebagai</button>
        </>
      )}
      {b.pesan && <span role="status" className={`text-[11.5px] font-semibold ${b.pesan.galat ? 'text-rose-700' : 'text-emerald-700'}`}>{b.pesan.teks}</span>}
      <ConfirmDialog state={konfirmasi} onCancel={() => setKonfirmasi(null)} />
    </div>
  );
}
