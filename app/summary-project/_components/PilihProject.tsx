'use client';

import { useState, useEffect } from 'react';
import { cariProjectUntukPilih, type SaranProject } from '@/lib/summary-project';

/** Kotak cari + daftar hasil untuk memilih satu project tujuan. */
export function PilihProject({ kecuali, onPilih, sibuk, placeholder = 'Cari project tujuan (nama / PRJ-xxxx)...' }: {
  kecuali?: string;
  onPilih: (p: SaranProject) => void;
  sibuk?: boolean;
  placeholder?: string;
}) {
  const [kata, setKata] = useState('');
  const [hasil, setHasil] = useState<SaranProject[]>([]);
  const [mencari, setMencari] = useState(false);

  useEffect(() => {
    if (!kata.trim()) { setHasil([]); return; }
    setMencari(true);
    // `batal` membuang jawaban ketikan lama yang datang belakangan.
    let batal = false;
    const t = setTimeout(async () => {
      try { const h = await cariProjectUntukPilih(kata, kecuali); if (!batal) setHasil(h); }
      finally { if (!batal) setMencari(false); }
    }, 300);
    return () => { batal = true; clearTimeout(t); };
  }, [kata, kecuali]);

  return (
    <div className="space-y-1.5">
      <input autoFocus aria-label={placeholder} value={kata} onChange={e => setKata(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg text-sm outline-none bg-white border border-gray-200 focus:ring-2 focus:ring-indigo-400" />
      {mencari && <p className="text-[11px] text-gray-400 px-1">Mencari...</p>}
      {!mencari && kata.trim() && hasil.length === 0 && <p className="text-[11px] text-gray-400 px-1">Tidak ada project cocok.</p>}
      {hasil.map(p => (
        <button key={p.project_id} type="button" disabled={sibuk} onClick={() => onPilih(p)}
          className="w-full text-left px-3 py-2 rounded-lg border border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/60 disabled:opacity-50">
          <span className="block text-sm font-bold text-gray-800 truncate">{p.name}</span>
          <span className="block text-[11px] text-gray-400 truncate">{p.code}{p.location ? ` · ${p.location}` : ''}{p.sales_name ? ` · ${p.sales_name}` : ''}</span>
        </button>
      ))}
    </div>
  );
}
