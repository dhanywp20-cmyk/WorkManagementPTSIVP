'use client';

import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { NETRAL } from '@/lib/desain';
import { TEMA } from './tampilan';

export interface CalonAnggota {
  id: string;
  full_name: string;
  /** Keterangan kecil di bawah nama, mis. tim / jabatan. */
  sub?: string | null;
}

/**
 * Pilih banyak akun dengan pencarian - yang terpilih tampil sebagai keping di
 * atas daftar. Dipakai untuk anggota checklist (yang di-assign boleh edit).
 */
export function PilihAnggota({ calon, terpilih, onUbah }: {
  calon: CalonAnggota[];
  terpilih: string[];
  onUbah: (ids: string[]) => void;
}) {
  const [cari, setCari] = useState('');
  const peta = useMemo(() => new Map(calon.map(c => [c.id, c])), [calon]);
  const q = cari.trim().toLowerCase();
  const tampil = calon.filter(c => !q || c.full_name.toLowerCase().includes(q) || (c.sub ?? '').toLowerCase().includes(q));
  const toggle = (id: string) => onUbah(terpilih.includes(id) ? terpilih.filter(x => x !== id) : [...terpilih, id]);

  return (
    <div className="space-y-2">
      {terpilih.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {terpilih.map(id => (
            <span key={id} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full text-[12px] font-semibold"
              style={{ background: TEMA.tint, color: TEMA.warnaTua, border: `1px solid ${TEMA.garisTint}` }}>
              {peta.get(id)?.full_name ?? 'Akun tidak aktif'}
              <button type="button" onClick={() => toggle(id)} aria-label={`Lepas ${peta.get(id)?.full_name ?? ''}`}
                className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-blue-100">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[12px]" style={{ color: TEMA.samar }}>Belum ada yang di-assign. Hanya admin yang bisa mengedit.</p>
      )}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: TEMA.samar }} />
        <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari nama atau tim…" aria-label="Cari anggota"
          className="w-full rounded-lg pl-9 pr-3 py-2 text-[13px] outline-none focus:ring-2"
          style={{ border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta }} />
      </div>
      <div className="max-h-56 overflow-y-auto rounded-lg divide-y" style={{ border: `1px solid ${NETRAL.garis}`, borderColor: NETRAL.garis }}>
        {tampil.length === 0 && <p className="px-3 py-3 text-[12px]" style={{ color: TEMA.samar }}>Tidak ada yang cocok.</p>}
        {tampil.map(c => {
          const dipilih = terpilih.includes(c.id);
          return (
            <label key={c.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50">
              <input type="checkbox" checked={dipilih} onChange={() => toggle(c.id)} className="w-4 h-4 accent-blue-600" />
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold truncate" style={{ color: NETRAL.tinta }}>{c.full_name}</span>
                {c.sub && <span className="block text-[11px] truncate" style={{ color: TEMA.samar }}>{c.sub}</span>}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
