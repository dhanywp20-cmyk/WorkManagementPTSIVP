'use client';

import React, { useState } from 'react';

export interface SalesPickerUser {
  id: string;
  full_name: string;
  sales_division?: string | null;
}

interface Props {
  value: string;
  users: SalesPickerUser[];
  /**
   * Argumen ketiga adalah id orang yang dipilih - itulah yang disimpan ke
   * kolom *_user_id. Tanpa ini id-nya terbuang di sini, dan baris baru lahir
   * hanya berbekal nama, persis seperti data lama yang sedang dibereskan.
   * Kosong bila pilihannya dihapus.
   */
  onChange: (name: string, division: string, userId: string | null) => void;
  placeholder?: string;
  triggerClassName?: string;
  triggerStyle?: React.CSSProperties;
  dropdownZIndex?: number;
}

export function SalesPicker({
  value, users, onChange,
  placeholder = '— Pilih Sales —',
  triggerClassName = '',
  triggerStyle,
  dropdownZIndex = 55,
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const filtered = users.filter(u =>
    !q.trim() ||
    u.full_name.toLowerCase().includes(q.toLowerCase()) ||
    (u.sales_division ?? '').toLowerCase().includes(q.toLowerCase())
  );

  const selected = users.find(u => u.full_name === value);

  return (
    <div className="relative">
      {/* Pemicu daftar pilihan: tanpa aria-expanded pembaca layar tidak pernah
          tahu daftarnya sedang terbuka atau tertutup. */}
      <button
        type="button"
        onClick={() => { setOpen(o => !o); if (!open) setQ(''); }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={value ? `Sales terpilih: ${value}. Ubah pilihan.` : placeholder}
        className={`w-full flex items-center justify-between gap-2 text-sm text-left ${triggerClassName}`}
        style={triggerStyle}
      >
        <span className="flex-1 truncate min-w-0">
          {value
            ? <><span className="font-semibold text-slate-800">{value}</span>{selected?.sales_division && <span className="text-slate-400"> · {selected.sales_division}</span>}</>
            : <span className="text-slate-400">{placeholder}</span>
          }
        </span>
        <svg aria-hidden="true" focusable="false" className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div
            className="absolute mt-1 w-full rounded-xl shadow-xl overflow-hidden bg-white border border-slate-200"
            style={{ zIndex: dropdownZIndex, maxHeight: 260 }}
          >
            <div className="p-2 border-b border-slate-100">
              <input
                autoFocus
                type="text"
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Cari nama sales..."
                aria-label="Cari nama sales"
                onClick={e => e.stopPropagation()}
                className="w-full px-3 py-1.5 rounded-lg text-sm outline-none border border-slate-200 bg-slate-50 placeholder-slate-400 focus:border-blue-300 text-slate-800"
              />
            </div>
            <div role="listbox" aria-label="Daftar sales" className="overflow-y-auto" style={{ maxHeight: 196 }}>
              {value && (
                <div
                  role="option"
                  aria-selected={false}
                  tabIndex={0}
                  className="px-3 py-2 text-sm cursor-pointer text-slate-400 italic hover:bg-slate-50 border-b border-slate-100"
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange('', '', null); setOpen(false); setQ(''); } }}
                  onClick={() => { onChange('', '', null); setOpen(false); setQ(''); }}
                >
                  — Kosongkan —
                </div>
              )}
              {!filtered.length && (
                <div className="px-3 py-4 text-center text-sm text-slate-400">Tidak ditemukan</div>
              )}
              {filtered.map(u => (
                <div
                  key={u.id}
                  role="option"
                  aria-selected={value === u.full_name}
                  tabIndex={0}
                  className="px-3 py-2.5 cursor-pointer flex items-center justify-between gap-2 hover:bg-slate-50"
                  style={value === u.full_name
                    ? { background: 'rgba(59,130,246,0.06)', borderLeft: '3px solid #3b82f6' }
                    : { borderLeft: '3px solid transparent' }}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(u.full_name, u.sales_division ?? '', u.id); setOpen(false); setQ(''); } }}
                  onClick={() => { onChange(u.full_name, u.sales_division ?? '', u.id); setOpen(false); setQ(''); }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{u.full_name}</p>
                    {u.sales_division && <p className="text-xs text-slate-400">{u.sales_division}</p>}
                  </div>
                  {value === u.full_name && <span aria-hidden="true" className="text-blue-500 text-xs flex-shrink-0">✓</span>}
                </div>
              ))}
            </div>
          </div>
          {/* Lapis penutup: murni penangkap klik di luar, tidak boleh ikut
              terbaca maupun masuk urutan Tab. */}
          <div aria-hidden="true" className="fixed inset-0" style={{ zIndex: dropdownZIndex - 1 }} onClick={() => { setOpen(false); setQ(''); }} />
        </>
      )}
    </div>
  );
}
