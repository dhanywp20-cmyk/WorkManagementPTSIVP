'use client';

import { Reminder, Priority, Status, RepeatType, PRIORITY_CONFIG, STATUS_CONFIG, REPEAT_OPTIONS } from './shared';
import { FormField, SectionHeader, MultiDatePicker } from '@/components/shared';
import { Ikon } from '@/components/shared/Ikon';
import type { ReminderForm } from './ReminderFormModal';

export interface BagianProjectFormProps {
  formData: ReminderForm;
  fd: (patch: Partial<ReminderForm>) => void;
  inputCls: "w-full rounded-lg px-3 py-2 text-xs outline-hidden transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-red-500/40";
  inputStyle: { background: string; border: string; };
  editingReminder: Reminder | null;
  extraDates: string[];
  onExtraDatesChange: (dates: string[]) => void;
}

export function BagianProjectForm({
  formData, fd, inputCls, inputStyle, editingReminder, extraDates, onExtraDatesChange,
}: BagianProjectFormProps) {
  return (
    <div className="flex flex-col gap-3 satulayar:overflow-y-auto satulayar:pr-2 satulayar:min-h-0">
    <SectionHeader icon="🗓️" title="Waktu & Jadwal" />
    
    <FormField label="Pengulangan">
      <select value={formData.repeat} onChange={e => fd({ repeat: e.target.value as RepeatType })}
        className={inputCls} style={inputStyle}>
        {REPEAT_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>
    </FormField>
    
    {(formData.category === 'Konfigurasi' || formData.category === 'Konfigurasi & Training') && (
      <div className="rounded-xl p-4" style={{ background: 'rgba(14,165,233,0.07)', border: '1.5px solid rgba(14,165,233,0.3)' }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg"><Ikon nama="🛡" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
          <p className="text-sm font-bold text-sky-700">Masa Garansi (Warranty)</p>
        </div>
        <p className="text-xs text-sky-700 mb-3">Garansi dihitung dari tanggal BAST.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {([null, 1, 2, 3] as const).map(val => {
            const isSelected = formData.warranty_years === val;
            const labels: Record<string, string> = { null: 'Tidak Ada', '1': '1 Tahun', '2': '2 Tahun', '3': '3 Tahun' };
            return (
              <button key={String(val)} type="button" onClick={() => fd({ warranty_years: val })}
                className="py-2.5 px-2 rounded-xl text-xs font-bold border-2 transition-all text-center"
                style={isSelected
                  ? { borderColor: '#0ea5e9', background: 'rgba(14,165,233,0.18)', color: '#0369a1' }
                  : { borderColor: 'rgba(14,165,233,0.25)', background: 'rgba(255,255,255,0.7)', color: '#64748b' }}>
                {val === null ? '—' : `${val}Y`}
                <div className="text-[11px] font-normal mt-0.5 opacity-80">{labels[String(val)]}</div>
              </button>
            );
          })}
        </div>
        {formData.warranty_years && formData.due_date && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)' }}>
            <span className="text-sm"><Ikon nama="📅" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
            <p className="text-xs text-sky-700 font-semibold">
              Garansi berlaku s/d:{' '}
              <strong>
                {(() => {
                  const d = new Date(formData.due_date + 'T00:00:00');
                  d.setFullYear(d.getFullYear() + (formData.warranty_years as number));
                  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                })()}
              </strong>
            </p>
          </div>
        )}
      </div>
    )}
    
    {(formData.category === 'Konfigurasi' || formData.category === 'Konfigurasi & Training') && (
      <div className="rounded-xl p-4" style={{ background: 'rgba(8,145,178,0.07)', border: '1.5px solid rgba(8,145,178,0.3)' }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg"><Ikon nama="📊" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
          <p className="text-sm font-bold text-cyan-700">Timeline Project Progress</p>
        </div>
        <p className="text-xs text-cyan-700 mb-3">
          Kategori ini otomatis membuat draft lokasi di <strong>Project Progress</strong>.
          Tentukan rentang pengerjaannya di sini. Boleh dikosongkan — jadwalnya bisa diisi menyusul di Project Progress.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Mulai Pengerjaan">
            <input type="date" value={formData.progress_start_date ?? ''}
              onChange={e => fd({ progress_start_date: e.target.value })}
              className={inputCls} style={inputStyle} />
          </FormField>
          <FormField label="Target Selesai">
            <input type="date" value={formData.progress_target_date ?? ''}
              min={formData.progress_start_date || undefined}
              onChange={e => fd({ progress_target_date: e.target.value })}
              className={inputCls} style={inputStyle} />
          </FormField>
        </div>
        {formData.progress_start_date && formData.progress_target_date && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(8,145,178,0.1)', border: '1px solid rgba(8,145,178,0.2)' }}>
            <span className="text-sm"><Ikon nama="⏱" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
            <p className="text-xs text-cyan-700 font-semibold">
              Durasi pengerjaan:{' '}
              <strong>
                {(() => {
                  const a = new Date(formData.progress_start_date + 'T00:00:00');
                  const z = new Date(formData.progress_target_date + 'T00:00:00');
                  const hari = Math.round((z.getTime() - a.getTime()) / 86400000);
                  return hari < 0 ? 'target mendahului tanggal mulai' : `${hari + 1} hari`;
                })()}
              </strong>
            </p>
          </div>
        )}
      </div>
    )}
    
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <FormField label="Tanggal *">
        <input type="date" value={formData.due_date} onChange={e => fd({ due_date: e.target.value })}
          className={inputCls} style={inputStyle} />
      </FormField>
      <FormField label="Waktu">
        <input type="time" value={formData.due_time} onChange={e => fd({ due_time: e.target.value })}
          className={inputCls} style={inputStyle} />
      </FormField>
      <FormField label="Prioritas">
        <select value={formData.priority} onChange={e => fd({ priority: e.target.value as Priority })}
          className={inputCls} style={inputStyle}>
          {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </FormField>
    </div>
    
    <div className="hidden sm:block">
      <FormField label={editingReminder ? 'Hari Lain dalam Jadwal Ini' : 'Tambah Hari Lain (Opsional)'}>
        <MultiDatePicker dates={extraDates} onChange={onExtraDatesChange} accentColor="#0891b2" />
        {editingReminder && (
          <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: '#64748b' }}>
            {extraDates.length > 0
              ? `Jadwal ini berjalan ${extraDates.length + 1} hari. Menghapus tanggal akan membuang jadwal hari itu; menambah tanggal menambah hari baru ke jadwal yang sama.`
              : 'Jadwal ini sehari. Menambah tanggal di sini menjadikannya jadwal berhari-hari, bukan jadwal baru yang terpisah.'}
          </p>
        )}
      </FormField>
    </div>
    
    {editingReminder && (
      <FormField label="Status">
        <select value={formData.status} onChange={e => fd({ status: e.target.value as Status })}
          className={inputCls} style={inputStyle}>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </FormField>
    )}
    
    </div>
  );
}
