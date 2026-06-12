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
  onChange: (name: string, division: string) => void;
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
      <button
        type="button"
        onClick={() => { setOpen(o => !o); if (!open) setQ(''); }}
        className={`w-full flex items-center justify-between gap-2 text-sm text-left ${triggerClassName}`}
        style={triggerStyle}
      >
        <span className="flex-1 truncate min-w-0">
          {value
            ? <><span className="font-semibold text-slate-800">{value}</span>{selected?.sales_division && <span className="text-slate-400"> · {selected.sales_division}</span>}</>
            : <span className="text-slate-400">{placeholder}</span>
          }
        </span>
        <svg className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                onClick={e => e.stopPropagation()}
                className="w-full px-3 py-1.5 rounded-lg text-sm outline-none border border-slate-200 bg-slate-50 placeholder-slate-400 focus:border-blue-300 text-slate-800"
              />
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 196 }}>
              {value && (
                <div
                  className="px-3 py-2 text-sm cursor-pointer text-slate-400 italic hover:bg-slate-50 border-b border-slate-100"
                  onClick={() => { onChange('', ''); setOpen(false); setQ(''); }}
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
                  className="px-3 py-2.5 cursor-pointer flex items-center justify-between gap-2 hover:bg-slate-50"
                  style={value === u.full_name
                    ? { background: 'rgba(59,130,246,0.06)', borderLeft: '3px solid #3b82f6' }
                    : { borderLeft: '3px solid transparent' }}
                  onClick={() => { onChange(u.full_name, u.sales_division ?? ''); setOpen(false); setQ(''); }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{u.full_name}</p>
                    {u.sales_division && <p className="text-xs text-slate-400">{u.sales_division}</p>}
                  </div>
                  {value === u.full_name && <span className="text-blue-500 text-xs flex-shrink-0">✓</span>}
                </div>
              ))}
            </div>
          </div>
          <div className="fixed inset-0" style={{ zIndex: dropdownZIndex - 1 }} onClick={() => { setOpen(false); setQ(''); }} />
        </>
      )}
    </div>
  );
}
