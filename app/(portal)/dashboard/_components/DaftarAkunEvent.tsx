'use client';

import { Ikon } from '@/components/shared/Ikon';
import { tglSingkat } from './modal-kode-acara';
import type { AkunEvent } from './modal-kode-acara';

export interface DaftarAkunEventProps {
  daftar: AkunEvent[];
  ambil: () => Promise<void>;
  muat: false;
  handleDeleteAkun: (id: string, nama: string) => void;
  menghapus: string | null;
}

export function DaftarAkunEvent({
  daftar, ambil, muat, handleDeleteAkun, menghapus,
}: DaftarAkunEventProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col lg:max-h-[calc(90vh-160px)]">
      <div className="flex items-center gap-3 p-4 border-b border-slate-100 bg-slate-50 shrink-0">
        <span className="text-2xl"><Ikon nama="🎓" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800">
            {daftar.length} akun terdaftar lewat kode acara
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Ditandai <code className="font-mono text-[11px]">daftar_via_event</code> di kolomnya sendiri — bukan
            di dalam divisi atau tim — jadi akunnya tetap terdata persis seperti akun yang dibuat admin.
          </p>
        </div>
        <button type="button" onClick={() => ambil()} disabled={muat} title="Muat ulang daftar pendaftar"
          aria-label="Muat ulang daftar pendaftar"
          className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-white border border-transparent hover:border-slate-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
          <svg aria-hidden="true" focusable="false" className={`w-4 h-4 ${muat ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
    
      {daftar.length === 0 ? (
        <p className="p-4 text-sm text-slate-500">Belum ada yang mendaftar lewat kode acara.</p>
      ) : (
        <>
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white border-b border-slate-200">
                <tr>
                  <th className="text-left font-bold text-slate-500 uppercase tracking-widest px-3 py-2">Nama</th>
                  <th className="text-left font-bold text-slate-500 uppercase tracking-widest px-3 py-2">Divisi</th>
                  <th className="text-left font-bold text-slate-500 uppercase tracking-widest px-3 py-2">Daftar</th>
                  <th className="px-3 py-2" aria-label="Aksi" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {daftar.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-semibold text-slate-800">
                      {a.full_name || '—'}
                      {a.username && <span className="block font-normal text-slate-500 truncate">{a.username}</span>}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {a.sales_division || a.team_type || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap tabular-nums">{tglSingkat(a.created_at)}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteAkun(a.id, a.full_name || a.username || '')}
                        disabled={menghapus === a.id}
                        title="Hapus akun ini"
                        className="text-red-500 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        <Ikon nama="🗑" ukuran="1em" className="inline-block align-[-0.12em]" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
