'use client';
/** Berkas yang sedang dibuka: nama (bisa diganti langsung), asalnya, dan status tersimpan. */
import { Ikon } from '@/components/shared/Ikon';
import { Pencil } from 'lucide-react';
import type { AlatDesain } from './alat';

export function BilahBerkas({ a }: { a: AlatDesain }) {
  const { adaPerubahan, asal, desainAktif, lihatVersi, namaDesain, setNamaDesain } = a.K;
  return (
    <>
      {(() => {
        const rinci: { teks: string; nada: 'ok' | 'info' | 'awas' } = desainAktif
          ? (!desainAktif.bolehUbah
            ? { teks: 'Desain tim · hanya lihat (Simpan = salinan Anda)', nada: 'info' }
            : lihatVersi
              ? { teks: `Melihat v${lihatVersi.versi} · terbaru v${lihatVersi.terbaru}`, nada: 'info' }
              : { teks: `Tersimpan di server · v${desainAktif.versi}`, nada: 'ok' })
          : asal.jenis === 'laptop' ? { teks: `Berkas laptop · ${asal.nama ?? '.glb'}`, nada: 'ok' }
          : asal.jenis === 'lokal' ? { teks: 'Salinan di perangkat ini · belum di server', nada: 'info' }
          : asal.jenis === 'template' ? { teks: `🔒 Dari template default "${asal.nama}" (terkunci) · Simpan = file baru milik Anda`, nada: 'info' }
          : { teks: 'Desain baru · belum disimpan', nada: 'awas' };
        const kelas = { ok: 'bg-emerald-50 text-emerald-800 border-emerald-200', info: 'bg-blue-50 text-blue-800 border-blue-200', awas: 'bg-amber-50 text-amber-900 border-amber-200' }[rinci.nada];
        return (
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50/70 flex-wrap" role="group" aria-label="Berkas yang sedang dibuka">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500"><Ikon nama="🧊" ukuran={14} /> Berkas</span>
            <label className="relative min-w-[160px] flex-1 max-w-[360px]" title="Klik untuk mengganti nama desain">
              <input value={namaDesain} onChange={e => setNamaDesain(e.target.value)} maxLength={80} placeholder="Ketik nama desain..." aria-label="Nama desain"
                className="w-full rounded-lg border border-slate-300 bg-white pl-2.5 pr-8 py-1.5 text-[14px] font-bold text-slate-900 shadow-sm hover:border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none" />
              <Pencil size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden />
            </label>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11.5px] font-semibold ${kelas}`}>{rinci.teks}</span>
            {adaPerubahan && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-300 bg-amber-50 text-amber-900 text-[11.5px] font-semibold" title="Isi kanvas berbeda dari yang terakhir dibuka/disimpan">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Ada perubahan belum disimpan
              </span>
            )}
          </div>
        );
      })()}
    </>
  );
}
