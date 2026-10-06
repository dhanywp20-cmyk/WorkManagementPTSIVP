'use client';
/** Panel template kategori ruangan (terkunci - perubahan hanya di salinan). */
import { KATEGORI_RUANG } from '../inti';
import type { AlatDesain } from './alat';

export function PanelKategori({ a }: { a: AlatDesain }) {
  const { sisi } = a.K;
  const { pasangKategori } = a.aksi;
  return (
    <>
    {sisi === 'kategori' && (
      <>
      <p className="mb-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11.5px] text-slate-700 leading-relaxed">
        <b>🔒 Template default terkunci.</b> Isinya selalu sama untuk semua pengguna - perubahan Anda di kanvas hanya mengubah salinan,
        lalu <b>Simpan</b> menjadi file baru milik Anda. Pilih template lagi kapan saja untuk kembali ke versi aslinya.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
        {KATEGORI_RUANG.map(k => (
          <button key={k.id} type="button" onClick={() => pasangKategori(k.id)}
            className="flex items-start gap-3 text-left rounded-xl border border-slate-200 px-3 py-2.5 hover:border-blue-400 hover:bg-blue-50/60">
            <span className="text-2xl leading-none mt-0.5" aria-hidden="true">{k.ikon}</span>
            <span className="min-w-0">
              <span className="block text-[13px] font-bold text-slate-900">{k.judul}</span>
              <span className="block text-[11.5px] text-slate-600 leading-snug">{k.ket}</span>
            </span>
          </button>
        ))}
      </div>
      </>
    )}
    </>
  );
}
