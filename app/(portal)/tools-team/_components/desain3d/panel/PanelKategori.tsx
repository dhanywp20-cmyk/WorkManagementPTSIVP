'use client';
/**
 * Panel template kategori ruangan (terkunci - perubahan hanya di salinan).
 * Tiap kartu: ikon, judul, keterangan isi ruangan, penanda kategori yang sedang terpasang, dan
 * penanda default Admin (simpan/useTemplateKategori.ts). Tombol atur hanya untuk Admin / Full Access.
 */
import { KATEGORI_RUANG } from '../inti';
import type { AlatDesain } from './alat';

const tanggal = (iso: string) => {
  try { return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return ''; }
};

export function PanelKategori({ a }: { a: AlatDesain }) {
  const { asal, sisi, statusSimpan } = a.K;
  const { bolehAtur, daftar, jadikanDefault, kembalikanBawaan, pilihKategori, sibuk } = a.template;
  if (sisi !== 'kategori') return null;
  //  Kategori yang isinya sedang di kanvas (asal.nama = "<judul>" atau "<judul> · default Admin").
  const terpasang = asal.jenis === 'template' ? KATEGORI_RUANG.find(k => asal.nama === k.judul || asal.nama?.startsWith(`${k.judul} ·`))?.id : undefined;
  return (
    <>
      <p className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600"
        title="Isi template sama untuk semua pengguna. Perubahan di kanvas hanya mengubah salinan; Simpan membuat file baru milik Anda.">
        <span aria-hidden="true">🔒</span> Template terkunci · Simpan = file baru
      </p>
      {statusSimpan && (
        <p role="status" className={`mb-2 rounded-lg px-3 py-2 text-[12px] font-semibold ${statusSimpan.nada === 'galat' ? 'bg-rose-50 text-rose-700' : statusSimpan.nada === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-600'}`}>
          {statusSimpan.teks}
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
        {KATEGORI_RUANG.map(k => {
          const t = daftar[k.id];
          const memuat = sibuk === k.id;
          const aktif = terpasang === k.id;
          return (
            <div key={k.id}
              className={`group rounded-2xl border bg-white overflow-hidden transition-all duration-150 hover:shadow-md hover:-translate-y-px ${aktif ? 'border-blue-400 ring-2 ring-blue-100' : t ? 'border-amber-200' : 'border-slate-200 hover:border-blue-200'}`}>
              <button type="button" onClick={() => void pilihKategori(k.id)} disabled={memuat} aria-busy={memuat} aria-current={aktif || undefined}
                className={`w-full flex items-start gap-3 text-left px-3 py-2.5 disabled:opacity-60 ${aktif ? 'bg-blue-50/50' : 'group-hover:bg-blue-50/30'}`}>
                <span aria-hidden="true"
                  className={`grid place-items-center w-11 h-11 shrink-0 rounded-xl text-[22px] leading-none ring-1 ${aktif ? 'bg-gradient-to-br from-blue-100 to-indigo-100 ring-blue-200' : 'bg-gradient-to-br from-slate-50 to-blue-50 ring-slate-200/80'}`}>
                  {k.ikon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="text-[13.5px] font-bold text-slate-900 truncate">{k.judul}</span>
                    {aktif && <span className="shrink-0 rounded-full bg-blue-600 px-1.5 py-px text-[10px] font-bold text-white">Dipakai</span>}
                    {memuat && <span className="shrink-0 inline-block w-3 h-3 rounded-full border-2 border-slate-300 border-t-blue-600 animate-spin" aria-label="Memuat" />}
                  </span>
                  <span className="block mt-0.5 text-[12px] leading-snug text-slate-500">{k.ket}</span>
                  {t && (
                    <span className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-full bg-gradient-to-r from-amber-100 to-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200"
                      title={`Default Admin: ${t.nama} · ${t.ditetapkan_oleh_nama ?? 'Admin'}, ${tanggal(t.updated_at)}`}>
                      <span aria-hidden="true">⭐</span>
                      <span className="truncate">Default Admin · {t.ditetapkan_oleh_nama ?? 'Admin'}, {tanggal(t.updated_at)}</span>
                    </span>
                  )}
                </span>
              </button>
              {bolehAtur && (
                <div className="flex flex-wrap gap-1.5 border-t border-slate-100 bg-slate-50/60 px-3 py-1.5">
                  <button type="button" onClick={() => jadikanDefault(k.id)} disabled={!!sibuk} title="Jadikan isi kanvas sekarang template default kategori ini untuk semua pengguna"
                    className="rounded-lg border border-blue-200 bg-white px-2 py-1 text-[11.5px] font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50">
                    ⭐ Jadikan default
                  </button>
                  {t && (
                    <button type="button" onClick={() => kembalikanBawaan(k.id)} disabled={!!sibuk} title="Kembalikan ke template bawaan aplikasi"
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11.5px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                      ↺ Bawaan
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
