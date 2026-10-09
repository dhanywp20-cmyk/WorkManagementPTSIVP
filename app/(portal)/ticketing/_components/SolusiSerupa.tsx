'use client';
import { useEffect, useState } from 'react';
import { Ikon } from '@/components/shared/Ikon';

/**
 * "Solusi serupa" di detail tiket: tiket lama yang sudah Solved dengan kasus
 * mirip + catatan penyelesaiannya, dan Tech Note R&D terkait. Pengetahuan tim
 * dipakai ulang, bukan hilang di riwayat. Dimuat hanya untuk tiket yang belum
 * Solved, sekali per tiket (respons di-cache 5 menit di sisi peramban).
 */
type Tiket = { id: string; project_name: string | null; issue_case: string | null; product: string | null; assign_name: string | null; tanggal: string; cocok: string[]; solusi: string | null };
type Note = { id: string; title: string; product: string | null; cocok: string[] };

export function SolusiSerupa({ ticketId, teks }: { ticketId: string; teks: string }) {
  const [data, setData] = useState<{ tiket: Tiket[]; techNote: Note[] } | null>(null);
  const [buka, setBuka] = useState(true);

  useEffect(() => {
    let hidup = true;
    setData(null);
    fetch('/api/tiket/serupa', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teks, kecualiId: ticketId }),
    }).then(r => r.json()).then(j => { if (hidup && j?.ok) setData({ tiket: j.tiket ?? [], techNote: j.techNote ?? [] }); })
      .catch(() => {});
    return () => { hidup = false; };
  }, [ticketId, teks]);

  if (!data || (data.tiket.length === 0 && data.techNote.length === 0)) return null;

  return (
    <div className="px-4 py-3 border-b border-gray-100">
      <button type="button" onClick={() => setBuka(b => !b)} aria-expanded={buka}
        className="w-full flex items-center justify-between gap-2 text-left">
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-emerald-800">
          <Ikon nama="💡" ukuran={14} /> Solusi serupa ({data.tiket.length + data.techNote.length})
        </span>
        <span className="text-[11px] font-semibold text-slate-500">{buka ? 'Sembunyikan' : 'Tampilkan'}</span>
      </button>
      {buka && (
        <div className="mt-2 space-y-2">
          {data.tiket.map(t => (
            <div key={t.id} className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-2.5">
              <p className="text-[12.5px] font-semibold text-slate-800 leading-snug">{t.issue_case ?? '-'}</p>
              <p className="text-[11px] text-slate-600 mt-0.5">
                {t.project_name ?? '-'}{t.product ? ` · ${t.product}` : ''} · {t.assign_name ?? '-'} · {t.tanggal}
              </p>
              {t.solusi && <p className="text-[12px] text-slate-700 mt-1.5 leading-relaxed"><b>Penyelesaian:</b> {t.solusi}</p>}
              <p className="text-[11px] text-slate-500 mt-1">cocok: {t.cocok.join(', ')}</p>
            </div>
          ))}
          {data.techNote.map(n => (
            <a key={n.id} href={`/tech-note?open=${n.id}`}
              className="flex items-center gap-2 rounded-lg border border-sky-100 bg-sky-50/60 p-2.5 hover:bg-sky-50">
              <Ikon nama="📄" ukuran={14} className="text-sky-700 flex-shrink-0" />
              <span className="min-w-0">
                <span className="block text-[12.5px] font-semibold text-slate-800 truncate">Tech Note: {n.title}</span>
                <span className="block text-[11px] text-slate-500">cocok: {n.cocok.join(', ')}</span>
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
