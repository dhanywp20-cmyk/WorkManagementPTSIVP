'use client';
/**
 * Panel template kategori ruangan (terkunci - perubahan hanya di salinan).
 * Kategori bisa punya template default dari Admin (simpan/useTemplateKategori.ts): penandanya tampil
 * untuk semua orang, tombol aturnya hanya untuk Admin / Full Access.
 */
import { KATEGORI_RUANG } from '../inti';
import type { AlatDesain } from './alat';

const tanggal = (iso: string) => {
  try { return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return ''; }
};

export function PanelKategori({ a }: { a: AlatDesain }) {
  const { sisi, statusSimpan } = a.K;
  const { bolehAtur, daftar, jadikanDefault, kembalikanBawaan, pilihKategori, sibuk } = a.template;
  return (
    <>
      {sisi === 'kategori' && (
        <>
        {statusSimpan && (
          <p role="status" className={`mb-2 rounded-lg px-3 py-2 text-[12px] font-semibold ${statusSimpan.nada === 'galat' ? 'bg-rose-50 text-rose-700' : statusSimpan.nada === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-600'}`}>
            {statusSimpan.teks}
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
          {KATEGORI_RUANG.map(k => {
            const t = daftar[k.id];
            const memuat = sibuk === k.id;
            return (
              <div key={k.id} className={`rounded-xl border ${t ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200'} overflow-hidden`}>
                <button type="button" onClick={() => void pilihKategori(k.id)} disabled={memuat} aria-busy={memuat} title={`${k.ket}\n🔒 Template terkunci - Simpan membuat file baru milik Anda.`}
                  className="w-full flex items-center gap-3 text-left px-3 py-2.5 hover:bg-blue-50/60 disabled:opacity-60">
                  <span className="text-2xl leading-none mt-0.5" aria-hidden="true">{k.ikon}</span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-bold text-slate-900">
                      {k.judul}
                      {t && <span className="ml-1.5 cursor-help" title={`Default Admin: ${t.nama} · ${t.ditetapkan_oleh_nama ?? 'Admin'}, ${tanggal(t.updated_at)}`} aria-label="Default Admin">⭐</span>}
                      {memuat && <span className="ml-1.5 inline-block w-3 h-3 align-[-2px] rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" aria-label="Memuat" />}
                    </span>
                  </span>
                </button>
                {bolehAtur && (
                  <div className="flex flex-wrap gap-1.5 border-t border-slate-200/80 bg-white/70 px-3 py-1.5">
                    <button type="button" onClick={() => jadikanDefault(k.id)} disabled={!!sibuk} title="Jadikan isi kanvas sekarang template default kategori ini untuk semua pengguna"
                      className="rounded-lg border border-blue-200 bg-white px-2 py-1 text-[11.5px] font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50">
                      ⭐ Jadikan default
                    </button>
                    {t && (
                      <button type="button" onClick={() => kembalikanBawaan(k.id)} disabled={!!sibuk} title="Kembalikan ke template bawaan aplikasi" aria-label="Kembalikan template bawaan"
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11.5px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                        ↺
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        </>
      )}
    </>
  );
}
