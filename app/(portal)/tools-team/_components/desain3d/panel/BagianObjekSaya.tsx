'use client';
/** Panel Tambah > "Objek saya": objek pribadi akun ini - pasang, hapus, ekspor (.json) & impor dari akun lain. */
import { useRef, useState } from 'react';
import { Download, Trash2, Upload } from 'lucide-react';
import { LABEL } from '../inti';
import type { AlatDesain } from './alat';

export function BagianObjekSaya({ a }: { a: AlatDesain }) {
  const { bolehUbah, daftar, ekspor, galat, hapus, impor, kuota, sibuk, tambah } = a.objekSaya;
  const [cari, setCari] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const q = cari.trim().toLowerCase();
  const tampil = (daftar ?? []).filter(o => !q || `${o.nama} ${o.ket} ${LABEL[o.jenis] ?? ''}`.toLowerCase().includes(q));
  const tombol = 'w-7 h-7 grid place-items-center rounded-lg text-slate-600 hover:bg-sky-100 disabled:opacity-40';
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-sky-700"
          title={kuota ? `${kuota.objek}/${kuota.maksObjek} objek · ${kuota.model}/${kuota.maksModel} model 3D` : undefined}>
          👤 Objek saya
        </p>
        <div className="flex items-center gap-0.5">
          {(daftar?.length ?? 0) > 6 && (
            <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari..." aria-label="Cari objek saya"
              className="w-24 mr-1 rounded-lg border border-slate-200 px-2 py-1 text-[12px]" />
          )}
          {bolehUbah && (
            <button type="button" onClick={() => input.current?.click()} disabled={!!sibuk} aria-label="Impor objek dari berkas" title="Impor berkas .json dari akun lain" className={tombol}>
              <Upload size={14} />
            </button>
          )}
          {!!daftar?.length && (
            <button type="button" onClick={() => void ekspor()} disabled={!!sibuk} aria-label="Ekspor semua objek" title="Ekspor semua ke berkas .json (untuk akun lain)" className={tombol}>
              <Download size={14} />
            </button>
          )}
        </div>
      </div>
      {galat && <p className="text-[12px] font-semibold text-rose-700 mb-1">{galat}</p>}
      {(sibuk === 'impor' || sibuk === 'ekspor') && <p className="text-[12px] text-slate-500 mb-1">{sibuk === 'impor' ? 'Mengimpor…' : 'Menyiapkan berkas…'}</p>}
      {!daftar ? <p className="text-[12px] text-slate-500">Memuat...</p>
        : !daftar.length ? (
          <p className="text-[12px] text-slate-600" title="Pilih sebuah benda, lalu di panel Atur pilih Simpan ke Objek saya">Belum ada</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2">
            {tampil.map(o => (
              <div key={o.id} className="group relative">
                <button type="button" onClick={() => void tambah(o)} disabled={sibuk === o.id}
                  className="w-full h-full text-left rounded-xl border border-sky-200 bg-sky-50/50 px-3 py-2.5 pr-7 hover:border-sky-400 hover:bg-sky-100/60 disabled:opacity-60">
                  <span className="block text-[13px] font-bold text-slate-900 break-words">{o.nama}</span>
                  <span className="block text-[11.5px] text-slate-600">{o.ket || LABEL[o.jenis] || o.jenis}</span>
                  <span className="block text-[11px] text-slate-500 mt-0.5">
                    {typeof o.atur.w === 'number' && typeof o.atur.h === 'number' ? `${Math.round((o.atur.w as number) * 1000)} × ${Math.round((o.atur.h as number) * 1000)} mm` : ''}
                    {o.adaModel ? ` · 🧊 ${(o.ukuranModel / 1.37 / 1048576).toFixed(1)} MB` : ''}
                    {sibuk === o.id ? ' · memuat…' : ''}
                  </span>
                </button>
                <div className="absolute top-1 right-1 flex flex-col gap-0.5">
                  {bolehUbah && (
                    <button type="button" onClick={() => hapus(o)} aria-label={`Hapus ${o.nama} dari Objek saya`} title="Hapus"
                      className="w-6 h-6 grid place-items-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-700"><Trash2 size={13} /></button>
                  )}
                  <button type="button" onClick={() => void ekspor([o])} aria-label={`Ekspor ${o.nama}`} title="Ekspor objek ini"
                    className="w-6 h-6 grid place-items-center rounded-md text-slate-500 hover:bg-sky-100 opacity-0 group-hover:opacity-100 focus:opacity-100"><Download size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      <input ref={input} type="file" accept="application/json,.json" hidden
        onChange={e => { void impor(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  );
}
