'use client';

import type { Dispatch, SetStateAction } from 'react';
import { CATEGORY_CONFIG, PRODUCT_TYPES } from './shared';
import { MultiDatePicker } from '@/components/shared';
import { Ikon } from '@/components/shared/Ikon';
import { ALLOWED_CATEGORIES, inputCls, inputStyle } from './RequestJadwalModal';
import type { JadwalRequest } from './RequestJadwalModal';

export interface RequestJadwalWaktuProps {
  form: JadwalRequest;
  f: (patch: Partial<JadwalRequest>) => void;
  setFormErr: Dispatch<SetStateAction<string>>;
}

export function RequestJadwalWaktu({
  form, f, setFormErr,
}: RequestJadwalWaktuProps) {
  return (
    <div className="flex flex-col gap-3 satulayar:overflow-y-auto satulayar:pr-2 satulayar:min-h-0">
    <div>
      <label className="block text-[11px] font-bold mb-1.5 tracking-widest uppercase" style={{ color: '#64748b' }}>
        Kategori *
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {ALLOWED_CATEGORIES.map(cat => {
          const c = CATEGORY_CONFIG[cat] ?? {
            icon: '📁', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)',
            border: 'rgba(148,163,184,0.3)', accent: '#64748b',
          };
          const sel = form.category === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => f({ category: cat })}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all"
              style={
                sel
                  ? { borderColor: c.accent, background: c.bg, color: c.color }
                  : { borderColor: 'rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.5)', color: '#64748b' }
              }
            >
              <span className="text-xl"><Ikon nama={c.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /></span>
              <span className="text-sm font-bold leading-tight flex-1">{cat}</span>
              {sel && (
                <svg aria-hidden="true" focusable="false" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
    
    <div>
      <label className="block text-[11px] font-bold mb-1.5 tracking-widest uppercase" style={{ color: '#64748b' }}>
        Tipe Produk *
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {PRODUCT_TYPES.map(pt => {
          const sel = form.product_type === pt;
          return (
            <button key={pt} type="button" onClick={() => { f({ product_type: pt }); setFormErr(''); }}
              className="px-3 py-3 rounded-xl border-2 text-center text-sm font-bold transition-all"
              style={sel
                ? { borderColor: '#e11d48', background: 'rgba(225,29,72,0.1)', color: '#e11d48' }
                : { borderColor: 'rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.5)', color: '#64748b' }}>
              {pt}
            </button>
          );
        })}
      </div>
    </div>
    
    <div>
      <label className="block text-[11px] font-bold mb-1 tracking-widest uppercase" style={{ color: '#64748b' }}>
        Product / Unit (Opsional)
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2"><Ikon nama="📦" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
        <input
          value={form.product}
          onChange={e => f({ product: e.target.value })}
          className={`${inputCls} pl-9`} style={inputStyle}
          placeholder="Contoh: Sony VPL-FHZ85, Samsung IF Series..."
        />
      </div>
    </div>
    
    <div className="grid grid-cols-1 gap-4">
      <div>
        <label htmlFor="f-reminder-schedule-components-requestjadwalmodal-3" className="block text-[11px] font-bold mb-1 tracking-widest uppercase" style={{ color: '#64748b' }}>
          Tanggal Usulan *
        </label>
        <input id="f-reminder-schedule-components-requestjadwalmodal-3"
          type="date"
          value={form.due_date}
          onChange={e => f({ due_date: e.target.value })}
          className={inputCls} style={inputStyle}
        />
      </div>
      <div>
        <label htmlFor="f-reminder-schedule-components-requestjadwalmodal-4" className="block text-[11px] font-bold mb-1 tracking-widest uppercase" style={{ color: '#64748b' }}>
          Waktu Usulan
        </label>
        <input id="f-reminder-schedule-components-requestjadwalmodal-4"
          type="time"
          value={form.due_time}
          onChange={e => f({ due_time: e.target.value })}
          className={inputCls} style={inputStyle}
        />
      </div>
    </div>
    
    {(form.category === 'Konfigurasi' || form.category === 'Konfigurasi & Training') && (
      <div className="rounded-xl p-4" style={{ background: 'rgba(8,145,178,0.07)', border: '1.5px solid rgba(8,145,178,0.3)' }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg"><Ikon nama="📊" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
          <p className="text-sm font-bold" style={{ color: '#0e7490' }}>Usulan Timeline Pengerjaan</p>
        </div>
        <p className="text-xs mb-3" style={{ color: '#0e7490' }}>
          Perkiraan rentang pengerjaan di lokasi, untuk dipantau di Project Progress.
          Boleh dikosongkan — Admin dapat menetapkannya saat menyetujui request.
        </p>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label htmlFor="f-reminder-schedule-components-requestjadwalmodal-5" className="block text-[11px] font-bold mb-1 tracking-widest uppercase" style={{ color: '#64748b' }}>
              Mulai Pengerjaan
            </label>
            <input id="f-reminder-schedule-components-requestjadwalmodal-5" type="date" value={form.progress_start_date}
              onChange={e => f({ progress_start_date: e.target.value })}
              className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label htmlFor="f-reminder-schedule-components-requestjadwalmodal-6" className="block text-[11px] font-bold mb-1 tracking-widest uppercase" style={{ color: '#64748b' }}>
              Target Selesai
            </label>
            <input id="f-reminder-schedule-components-requestjadwalmodal-6" type="date" value={form.progress_target_date}
              min={form.progress_start_date || undefined}
              onChange={e => f({ progress_target_date: e.target.value })}
              className={inputCls} style={inputStyle} />
          </div>
        </div>
      </div>
    )}
    
    <div className="hidden satulayar:block">
      <label className="block text-[11px] font-bold mb-1 tracking-widest uppercase" style={{ color: '#64748b' }}>
        Tambah Hari Lain (Opsional)
      </label>
      <MultiDatePicker dates={form.extra_dates} onChange={dates => f({ extra_dates: dates })} accentColor="#2563eb" />
    </div>
    
    </div>
  );
}
