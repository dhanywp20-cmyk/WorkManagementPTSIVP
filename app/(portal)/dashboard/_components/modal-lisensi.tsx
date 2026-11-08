'use client';
import React, { useEffect, useState } from 'react';
import { LABEL_ALASAN, MENU_PRO } from '@/lib/lisensi/inti';
import { muatLisensi, type StatusLisensiKlien } from '@/components/shared/Lisensi';

const NAMA_MENU_PRO: Record<string, string> = { 'tools-team': 'AV Solution Tools', 'learning-center': 'Learning Center', 'incentive-pts': 'Incentive PTS' };
const tanggal = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

function Baris({ label, isi }: { label: string; isi: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0 text-sm">
      <span className="text-slate-500">{label}</span><span className="font-semibold text-slate-800 text-right">{isi}</span>
    </div>
  );
}

export function LisensiInline() {
  const [s, setS] = useState<StatusLisensiKlien | null | undefined>(undefined);
  useEffect(() => { muatLisensi(true).then(setS); }, []);
  if (s === undefined) return <p className="text-sm text-slate-500">Memuat status lisensi...</p>;
  if (!s) return <p className="text-sm text-rose-700">Status lisensi tidak terbaca.</p>;
  if (s.pemilik) {
    return (
      <div className="max-w-4xl rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
        <p className="text-base font-extrabold text-emerald-800">Server pemilik</p>
        <p className="text-sm text-emerald-900 mt-0.5">Tanpa batasan lisensi. Semua menu aktif.</p>
      </div>
    );
  }
  return (
    <div className="space-y-5 max-w-4xl">
      <div className={`rounded-xl border p-4 ${s.sah ? 'border-emerald-200 bg-emerald-50/50' : 'border-rose-200 bg-rose-50/60'}`}>
        <p className={`text-base font-extrabold ${s.sah ? 'text-emerald-800' : 'text-rose-800'}`}>
          {s.pengembangan ? 'Mode pengembangan (tanpa kunci)' : s.sah ? `${s.demo ? 'Lisensi DEMO aktif' : 'Lisensi aktif'} · Edisi ${s.edisi === 'pro' ? 'Pro' : 'Lite'}` : 'Lisensi tidak aktif'}
        </p>
        {!s.sah && s.alasan && <p className="text-sm text-rose-700 mt-0.5">{LABEL_ALASAN[s.alasan]}.</p>}
        <div className="mt-3">
          <Baris label="Pelanggan" isi={s.pelanggan ?? '-'} />
          <Baris label="Berlaku sampai" isi={s.kedaluwarsa ? `${tanggal(s.kedaluwarsa)}${s.sisaHari !== null && s.sisaHari >= 0 ? ` (${s.sisaHari} hari lagi)` : ''}` : s.sah ? 'Seumur hidup' : '-'} />
          <Baris label="Menu Pro" isi={MENU_PRO.map(k => NAMA_MENU_PRO[k]).join(', ') + (s.edisi === 'pro' ? ' · aktif' : ' · tidak termasuk')} />
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 space-y-1.5">
        <p className="font-bold text-slate-800">Memasang atau memperbarui kunci</p>
        <p>Isi environment variable <code className="px-1 rounded bg-slate-100">LISENSI_KUNCI</code> dengan kunci dari penyedia platform, lalu deploy ulang (Vercel) atau jalankan ulang server (lokal).
          Panduan lengkap ada di file master: <code className="px-1 rounded bg-slate-100">PANDUAN/03-LISENSI.md</code>.</p>
      </div>
    </div>
  );
}
