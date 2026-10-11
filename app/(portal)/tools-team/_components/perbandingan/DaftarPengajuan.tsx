'use client';
/** Daftar pengajuan verifikasi: verifikator melihat semua (menunggu dulu), pengaju melihat miliknya. */
import { CheckCircle2, Clock, Download, Eye, XCircle } from 'lucide-react';
import type { Peran, RingkasPengajuan } from './usePengajuan';

const STATUS = {
  menunggu: { l: 'Menunggu verifikasi', c: 'bg-amber-50 text-amber-800 border-amber-200', I: Clock },
  disetujui: { l: 'Disetujui', c: 'bg-emerald-50 text-emerald-800 border-emerald-200', I: CheckCircle2 },
  ditolak: { l: 'Ditolak', c: 'bg-rose-50 text-rose-800 border-rose-200', I: XCircle },
} as const;
const tgl = (s: string | null) => (s ? new Date(s).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

export function DaftarPengajuan({ daftar, peran, buka, unduh, sibuk }: {
  daftar: RingkasPengajuan[]; peran: Peran; sibuk: string | null; buka: (r: RingkasPengajuan) => void; unduh: (r: RingkasPengajuan) => void;
}) {
  if (!daftar.length) return <p className="text-[13px] text-slate-500 py-6 text-center">Belum ada pengajuan.</p>;
  return (
    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
      {daftar.map(r => {
        const s = STATUS[r.status], I = s.I;
        return (
          <li key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-bold text-slate-900">{r.judul}</p>
              <p className="text-[11.5px] text-slate-500">
                {peran.verifikator ? `${r.dibuat_nama ?? '—'} · ` : ''}{tgl(r.created_at)}
                {r.diverifikasi_nama ? ` · ${r.status === 'disetujui' ? 'disetujui' : 'diputuskan'} ${r.diverifikasi_nama}` : ''}
              </p>
              {r.status === 'ditolak' && r.catatan_verifikator && <p className="text-[12px] text-rose-700 mt-0.5">“{r.catatan_verifikator}”</p>}
            </div>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11.5px] font-bold ${s.c}`}><I size={12} /> {s.l}</span>
            <button type="button" onClick={() => buka(r)} disabled={sibuk === r.id}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 text-slate-700 hover:bg-slate-50">
              <Eye size={13} /> {peran.verifikator && r.status === 'menunggu' ? 'Periksa' : 'Buka'}
            </button>
            {r.status === 'disetujui' && (
              <button type="button" onClick={() => unduh(r)} disabled={sibuk === r.id}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-bold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60">
                <Download size={13} /> PDF
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
