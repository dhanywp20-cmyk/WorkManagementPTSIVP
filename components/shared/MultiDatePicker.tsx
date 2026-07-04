'use client';
import { useState } from 'react';

interface MultiDatePickerProps {
  dates: string[];              // semua tanggal terpilih (sudah unik & terurut)
  onChange: (dates: string[]) => void;
  accentColor?: string;         // warna aksen tombol/chip (default rose)
}

/**
 * Picker multi-tanggal — dipakai di form Request Jadwal & buat Reminder agar
 * user bisa sekali submit untuk beberapa hari (mis. tanggal 1, 2, 3) tanpa
 * harus request/isi form berulang kali per hari.
 */
export function MultiDatePicker({ dates, onChange, accentColor = '#e11d48' }: MultiDatePickerProps) {
  const [pending, setPending] = useState(new Date().toISOString().split('T')[0]);

  const addDate = () => {
    if (!pending || dates.includes(pending)) return;
    onChange([...dates, pending].sort());
  };
  const removeDate = (d: string) => onChange(dates.filter(x => x !== d));

  const fmt = (d: string) => {
    try { return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }); }
    catch { return d; }
  };

  return (
    <div>
      <div className="flex gap-2">
        <input type="date" value={pending} onChange={e => setPending(e.target.value)}
          className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none transition-all text-slate-800"
          style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(0,0,0,0.12)' }} />
        <button type="button" onClick={addDate}
          className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all flex-shrink-0"
          style={{ background: accentColor }}>
          + Tambah Hari
        </button>
      </div>
      {dates.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {dates.map(d => (
            <div key={d} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
              style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}40`, color: accentColor }}>
              {fmt(d)}
              <button type="button" onClick={() => removeDate(d)} className="hover:opacity-60 transition-opacity" title="Hapus tanggal ini">✕</button>
            </div>
          ))}
        </div>
      )}
      {dates.length > 1 && (
        <p className="text-[11px] text-slate-400 mt-1.5">📅 {dates.length} hari akan dibuat sekaligus.</p>
      )}
    </div>
  );
}
