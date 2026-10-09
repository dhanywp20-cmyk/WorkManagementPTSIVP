'use client';
/** Berkas yang sedang dibuka: nama (bisa diganti langsung), asalnya, dan status tersimpan. */
import { Ikon } from '@/components/shared/Ikon';
import { Pencil } from 'lucide-react';
import type { AlatDesain } from './alat';

const BANTUAN = [
  'Klik benda = pilih · Shift / Ctrl + klik = pilih banyak',
  'Panah gizmo = geser (hijau = naik/turun) · cincin = putar',
  'Seret = putar kamera · klik kanan / Shift + seret = geser',
  'Roda / pinch = zoom · klik dua kali = pusatkan',
  'Ctrl+Z / Ctrl+Y = undo / redo',
].join('\n');

export function BilahBerkas({ a }: { a: AlatDesain }) {
  const { adaPerubahan, asal, desainAktif, lihatVersi, namaDesain, setNamaDesain } = a.K;
  return (
    <>
      {(() => {
        //  Status ringkas: ikon / angka versi saja - penjelasan lengkap di tooltip (bukan kalimat di layar).
        const rinci: { isi: string; judul: string; nada: 'ok' | 'info' | 'awas' } = desainAktif
          ? (!desainAktif.bolehUbah
            ? { isi: '👁', judul: 'Desain tim - hanya lihat. Simpan membuat salinan milik Anda.', nada: 'info' }
            : lihatVersi
              ? { isi: `v${lihatVersi.versi}`, judul: `Melihat versi ${lihatVersi.versi} (terbaru v${lihatVersi.terbaru})`, nada: 'info' }
              : { isi: `☁ v${desainAktif.versi}`, judul: `Tersimpan di server, versi ${desainAktif.versi}`, nada: 'ok' })
          : asal.jenis === 'laptop' ? { isi: '💻', judul: `Dibuka dari laptop: ${asal.nama ?? '.glb'}`, nada: 'ok' }
          : asal.jenis === 'lokal' ? { isi: '📱', judul: 'Salinan di perangkat ini, belum tersimpan di server', nada: 'info' }
          : asal.jenis === 'template' ? { isi: /default Admin/.test(asal.nama ?? '') ? '🔒⭐' : '🔒', judul: `Template "${asal.nama}" (terkunci). Simpan membuat file baru milik Anda.`, nada: 'info' }
          : { isi: '●', judul: 'Desain baru, belum disimpan', nada: 'awas' };
        const kelas = { ok: 'bg-emerald-50 text-emerald-800 border-emerald-200', info: 'bg-blue-50 text-blue-800 border-blue-200', awas: 'bg-amber-50 text-amber-600 border-amber-200' }[rinci.nada];
        return (
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50/70 flex-wrap" role="group" aria-label="Berkas yang sedang dibuka">
            <span title="Nama desain" className="inline-flex items-center text-slate-500"><Ikon nama="🧊" ukuran={15} /></span>
            <label className="relative min-w-[160px] flex-1 max-w-[360px]" title="Klik untuk mengganti nama desain">
              <input value={namaDesain} onChange={e => setNamaDesain(e.target.value)} maxLength={80} placeholder="Ketik nama desain..." aria-label="Nama desain"
                className="w-full rounded-lg border border-slate-300 bg-white pl-2.5 pr-8 py-1.5 text-[14px] font-bold text-slate-900 shadow-sm hover:border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none" />
              <Pencil size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden />
            </label>
            <span title={rinci.judul} aria-label={rinci.judul} className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[12px] font-semibold cursor-help ${kelas}`}>{rinci.isi}</span>
            {adaPerubahan && (
              <span title="Ada perubahan belum disimpan" aria-label="Ada perubahan belum disimpan" className="w-2.5 h-2.5 rounded-full bg-amber-500 cursor-help" />
            )}
            {/*  Bantuan kontrol kanvas: hanya tooltip, bukan paragraf di bawah kanvas. */}
            <span className="ml-auto inline-flex items-center text-slate-400 cursor-help" aria-label="Bantuan kontrol" title={BANTUAN}>
              <Ikon nama="⌨" ukuran={15} />
            </span>
          </div>
        );
      })()}
    </>
  );
}
