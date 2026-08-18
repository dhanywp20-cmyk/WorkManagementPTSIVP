'use client';
import { useState } from 'react';

interface MultiDatePickerProps {
  dates: string[];              // semua tanggal terpilih (ISO yyyy-mm-dd), sudah unik & terurut
  onChange: (dates: string[]) => void;
  accentColor?: string;         // warna aksen sel/chip terpilih (default rose)
}

const WEEKDAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const pad = (n: number) => String(n).padStart(2, '0');
const toISO = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/**
 * Kalender mini multi-select — klik beberapa tanggal langsung (mis. tanggal
 * 1, 2, 3) tanpa buka date-picker berulang kali. Dipakai di form Request
 * Jadwal & buat Reminder agar bisa sekali submit untuk beberapa hari.
 */
export function MultiDatePicker({ dates, onChange, accentColor = '#e11d48' }: MultiDatePickerProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed

  const toggle = (iso: string) => {
    if (dates.includes(iso)) onChange(dates.filter(d => d !== iso));
    else onChange([...dates, iso].sort());
  };

  const changeMonth = (delta: number) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m); setViewYear(y);
  };

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayISO = toISO(today.getFullYear(), today.getMonth(), today.getDate());
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const fmtChip = (d: string) => {
    try { return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }); }
    catch { return d; }
  };

  return (
    <div role="group" aria-label="Pilih beberapa tanggal"
      className="rounded-xl p-2 mx-auto" style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.1)', maxWidth: 240 }}>
      <div className="flex items-center justify-between mb-1.5">
        {/* '‹' dan '›' tidak punya arti apa pun saat dibacakan; namanya harus
            ditulis terpisah dari lambangnya. */}
        <button type="button" onClick={() => changeMonth(-1)} aria-label="Bulan sebelumnya"
          className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-all text-xs"><span aria-hidden="true">‹</span></button>
        <span className="text-xs font-bold text-slate-700" aria-live="polite">{MONTH_NAMES[viewMonth]} {viewYear}</span>
        <button type="button" onClick={() => changeMonth(1)} aria-label="Bulan berikutnya"
          className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-all text-xs"><span aria-hidden="true">›</span></button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 mb-0.5">
        {WEEKDAYS.map(w => <div key={w} className="text-center text-[8px] font-bold text-slate-400 uppercase">{w[0]}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, idx) => {
          if (day === null) return <div key={`b${idx}`} />;
          const iso = toISO(viewYear, viewMonth, day);
          const selected = dates.includes(iso);
          const isToday = iso === todayISO;
          return (
            <button key={iso} type="button" onClick={() => toggle(iso)}
              aria-pressed={selected}
              aria-label={`${day} ${MONTH_NAMES[viewMonth]} ${viewYear}${isToday ? ' (hari ini)' : ''}`}
              className="aspect-square rounded text-[10px] font-semibold transition-all flex items-center justify-center"
              style={selected
                ? { background: accentColor, color: 'white' }
                : isToday
                  ? { background: `${accentColor}18`, color: accentColor, border: `1px solid ${accentColor}50` }
                  : { background: 'transparent', color: '#475569' }}>
              {day}
            </button>
          );
        })}
      </div>

      {dates.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 mt-2 pt-2" style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}>
          {dates.map(d => (
            <div key={d} className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
              style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}40`, color: accentColor }}>
              {fmtChip(d)}
              <button type="button" onClick={() => toggle(d)} className="hover:opacity-60 transition-opacity"
                title={`Hapus tanggal ${fmtChip(d)}`} aria-label={`Hapus tanggal ${fmtChip(d)}`}><span aria-hidden="true">✕</span></button>
            </div>
          ))}
          <span className="text-[10px] text-slate-400 ml-1">{dates.length} hari dipilih</span>
        </div>
      )}
    </div>
  );
}
