'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Plus, Search } from 'lucide-react';
import { NETRAL } from '@/lib/desain';
import type { IsuGrup } from '@/lib/isu/inti';
import { TEMA } from '../tampilan';

export function PilihGrup({ daftar, terpilih, onPilih, onBaru }: {
  daftar: IsuGrup[];
  terpilih: IsuGrup | null;
  onPilih: (id: string) => void;
  onBaru?: () => void;
}) {
  const [buka, setBuka] = useState(false);
  const [cari, setCari] = useState('');
  const [sorot, setSorot] = useState(0);
  const akar = useRef<HTMLDivElement>(null);
  const kotakCari = useRef<HTMLInputElement>(null);

  const hasil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return daftar
      .filter(g => !q || [g.nama, g.client, g.keterangan].some(v => (v ?? '').toLowerCase().includes(q)))
      .sort((a, b) => a.nama.localeCompare(b.nama));
  }, [daftar, cari]);

  useEffect(() => {
    if (!buka) return;
    const luar = (e: MouseEvent) => { if (akar.current && !akar.current.contains(e.target as Node)) setBuka(false); };
    document.addEventListener('mousedown', luar);
    kotakCari.current?.focus();
    return () => document.removeEventListener('mousedown', luar);
  }, [buka]);

  const bukaTutup = () => {
    if (!buka) { setCari(''); setSorot(Math.max(0, hasil.findIndex(g => g.id === terpilih?.id))); }
    setBuka(b => !b);
  };
  const pilih = (id: string) => { onPilih(id); setBuka(false); };

  const tombolKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setBuka(false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSorot(i => Math.min(hasil.length - 1, i + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSorot(i => Math.max(0, i - 1)); }
    if (e.key === 'Enter' && hasil[sorot]) { e.preventDefault(); pilih(hasil[sorot].id); }
  };

  return (
    <div ref={akar} className="relative min-w-0 max-w-full">
      <span className="block text-[11px] font-bold uppercase tracking-wider mb-0.5" style={{ color: NETRAL.tinta2 }}>Grup Issue Log</span>
      <button type="button" onClick={bukaTutup} aria-haspopup="listbox" aria-expanded={buka}
        aria-label={`Grup terpilih: ${terpilih?.nama ?? 'belum ada'}. Ganti grup.`}
        className="flex items-center gap-2 max-w-full rounded-lg pl-0 pr-2 py-0.5 text-left hover:bg-slate-50">
        <span className="text-[16px] font-bold truncate" style={{ color: NETRAL.tinta }}>{terpilih?.nama ?? 'Pilih grup'}</span>
        <span className="shrink-0 px-1.5 py-0.5 rounded-md text-[11px] font-bold" style={{ background: NETRAL.permukaanRedam, color: NETRAL.tinta2, border: `1px solid ${NETRAL.garis}` }}>
          {daftar.length} grup
        </span>
        <ChevronDown size={16} className={`shrink-0 transition-transform ${buka ? 'rotate-180' : ''}`} style={{ color: NETRAL.tinta2 }} />
      </button>

      {buka && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-[min(380px,calc(100vw-32px))] rounded-xl overflow-hidden shadow-lg"
          style={{ background: NETRAL.permukaan, border: `1px solid ${NETRAL.garis}` }} onKeyDown={tombolKey}>
          <div className="p-2" style={{ borderBottom: `1px solid ${NETRAL.garis}` }}>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: NETRAL.tinta2 }} />
              <input ref={kotakCari} value={cari} onChange={e => { setCari(e.target.value); setSorot(0); }} placeholder="Cari grup atau client…"
                aria-label="Cari grup" className="w-full rounded-lg pl-8 pr-3 py-2 text-[13px] outline-hidden focus:ring-2"
                style={{ border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta }} />
            </div>
          </div>
          <ul role="listbox" aria-label="Daftar grup" className="max-h-72 overflow-y-auto py-1">
            {hasil.length === 0 && <li className="px-3 py-4 text-center text-[12.5px]" style={{ color: NETRAL.tinta2 }}>Tidak ada grup yang cocok.</li>}
            {hasil.map((g, i) => {
              const aktif = g.id === terpilih?.id;
              return (
                <li key={g.id} role="option" aria-selected={aktif}>
                  <button type="button" onClick={() => pilih(g.id)} onMouseEnter={() => setSorot(i)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left"
                    style={{ background: i === sorot ? TEMA.tint : undefined }}>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] font-bold truncate" style={{ color: NETRAL.tinta }}>{g.nama}</span>
                      <span className="block text-[11.5px] truncate" style={{ color: NETRAL.tinta2 }}>
                        {[g.client, `${g.proyek_ids.length} proyek`].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    {aktif && <Check size={16} className="shrink-0" style={{ color: TEMA.warna }} />}
                  </button>
                </li>
              );
            })}
          </ul>
          {onBaru && (
            <button type="button" onClick={() => { setBuka(false); onBaru(); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-[12.5px] font-bold hover:bg-slate-50"
              style={{ borderTop: `1px solid ${NETRAL.garis}`, color: TEMA.warnaTua }}>
              <Plus size={14} /> Grup baru
            </button>
          )}
        </div>
      )}
    </div>
  );
}
