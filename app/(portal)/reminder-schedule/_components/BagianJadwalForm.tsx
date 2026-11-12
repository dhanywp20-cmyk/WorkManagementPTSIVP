'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { Kelompok } from '@/lib/kelompok/dasar';
import { Reminder, TeamUser, CATEGORIES, CATEGORY_CONFIG, PRODUCT_TYPES } from './shared';
import { FormField, SectionHeader } from '@/components/shared';
import { BRAND_OPTIONS } from '@/lib/brand-routing';
import { Ikon } from '@/components/shared/Ikon';
import { BulkTarget, BULK_TEAM_TYPE, BULK_LABEL } from './ReminderFormModal';
import type { ReminderForm } from './ReminderFormModal';

export interface BagianJadwalFormProps {
  jumlahJadwalLama: number;
  formData: ReminderForm;
  fd: (patch: Partial<ReminderForm>) => void;
  inputCls: "w-full rounded-lg px-3 py-2 text-xs outline-hidden transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-red-500/40";
  inputStyle: { background: string; border: string; };
  setErr: Dispatch<SetStateAction<string>>;
  editingReminder: Reminder | null;
  onBulkTargetChange: (t: BulkTarget) => void;
  bulkTarget: BulkTarget;
  canAssignSelf: boolean | undefined;
  selfUser: { username: string; full_name: string; } | null | undefined;
  supervisorUsers: TeamUser[];
  kelompokDitugaskan: Kelompok[];
  teamUsers: TeamUser[];
}

export function BagianJadwalForm({
  jumlahJadwalLama, formData, fd, inputCls, inputStyle, setErr, editingReminder, onBulkTargetChange,
  bulkTarget, canAssignSelf, selfUser, supervisorUsers, kelompokDitugaskan, teamUsers,
}: BagianJadwalFormProps) {
  return (
    <div className="space-y-3 satulayar:overflow-y-auto satulayar:pr-2 satulayar:min-h-0">
    <SectionHeader icon="📋" title="Informasi Jadwal" />
    
    {jumlahJadwalLama > 0 && (
      <div className="rounded-xl px-3.5 py-2.5" style={{ background: 'rgba(8,145,178,0.08)', border: '1px solid rgba(8,145,178,0.25)' }}>
        <p className="text-[12px] font-bold" style={{ color: '#0e7490' }}>
          ✓ Detail diisi dari project yang sudah ada
        </p>
        <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: '#155e75' }}>
          {jumlahJadwalLama} jadwal sebelumnya tercatat untuk project ini. Insentif jadwal ini
          akan tergabung dengan yang lama, tidak terhitung sebagai proyek baru.
          Tinggal tentukan kategori dan tanggal pekerjaan ini di bawah.
        </p>
      </div>
    )}
    
    <FormField label="Nama Project*">
      <input value={formData.project_name} onChange={e => fd({ project_name: e.target.value })}
        className={inputCls} style={inputStyle} placeholder="Contoh: PT. Maju Bersama" />
    </FormField>
    
    <FormField label="Lokasi Project *">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2"><Ikon nama="📍" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
        <input value={formData.address} onChange={e => fd({ address: e.target.value })}
          className={`${inputCls} pl-9`} style={inputStyle} placeholder="Contoh: Gedung Wisma 46 Lt. 12" />
      </div>
    </FormField>
    
    <FormField label="Deskripsi">
      <textarea value={formData.description} onChange={e => fd({ description: e.target.value })}
        rows={2} className={`${inputCls} resize-none`} style={inputStyle} placeholder="Detail pekerjaan..." />
    </FormField>
    
    <div>
      <label className="block text-[11px] font-bold mb-1.5 tracking-widest uppercase" style={{ color: '#64748b' }}>Kategori *</label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {CATEGORIES.map(cat => {
          const c = CATEGORY_CONFIG[cat];
          const sel = formData.category === cat;
          return (
            <button key={cat} type="button" onClick={() => fd({ category: cat })}
              title={cat}
              className="flex items-center gap-1.5 px-2 py-2 rounded-lg border-2 text-left transition-all"
              style={sel
                ? { borderColor: c.color, background: c.bg, color: c.color }
                : { borderColor: 'rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.5)', color: '#64748b' }}>
              <span className="text-base leading-none shrink-0"><Ikon nama={c.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /></span>
              <span className="text-[11px] font-bold leading-tight flex-1 min-w-0">{cat}</span>
              {sel && <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" /></svg>}
            </button>
          );
        })}
      </div>
    </div>
    
    <div>
      <label className="block text-[11px] font-bold mb-1.5 tracking-widest uppercase" style={{ color: '#64748b' }}>Tipe Produk *</label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {PRODUCT_TYPES.map(pt => {
          const sel = formData.product_type === pt;
          return (
            <button key={pt} type="button" onClick={() => { fd({ product_type: pt }); setErr(''); }}
              className="px-2 py-2 rounded-lg border-2 text-center text-[11px] font-bold transition-all"
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
      <label className="block text-[11px] font-bold mb-1.5 tracking-widest uppercase" style={{ color: '#64748b' }}>
        Brand * <span className="normal-case text-slate-500 font-medium tracking-normal">(menentukan Finance mana yang boleh melihat nominalnya)</span>
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {BRAND_OPTIONS.map(opt => {
          const sel = formData.brand === opt.value;
          return (
            <button key={opt.value} type="button" onClick={() => { fd({ brand: opt.value }); setErr(''); }}
              className="px-2 py-2 rounded-lg border-2 text-center text-[11px] font-bold transition-all leading-tight"
              style={sel
                ? { borderColor: '#2563eb', background: 'rgba(37,99,235,0.1)', color: '#1d4ed8' }
                : { borderColor: 'rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.5)', color: '#64748b' }}>
              {opt.value === 'MVI' ? '🏠 ' : opt.value === 'IVP' ? '🌐 ' : '🏠🌐 '}{opt.label}
            </button>
          );
        })}
      </div>
    </div>
    
    <div>
      <label className="block text-[11px] font-bold mb-1.5 tracking-widest uppercase" style={{ color: '#64748b' }}>Tugaskan ke *</label>
      {!editingReminder && (
        <div className="flex flex-wrap gap-2 mb-3">
          {([
            { key: 'none', label: '👤 Per Orang' },
            { key: 'ivp',  label: '👥 Semua PTS IVP' },
            { key: 'mvi', label: '👥 Semua PTS MVI' },
          ] as { key: BulkTarget; label: string }[]).map(opt => (
            <button key={opt.key} type="button"
              onClick={() => { onBulkTargetChange(opt.key); if (opt.key !== 'none') fd({ assigned_to: '' }); }}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border-2 transition-all"
              style={bulkTarget === opt.key
                ? { borderColor: '#0891b2', background: 'rgba(8,145,178,0.12)', color: '#0369a1' }
                : { borderColor: 'rgba(0,0,0,0.12)', background: 'rgba(255,255,255,0.7)', color: '#64748b' }}>
              {opt.label}
            </button>
          ))}
        </div>
      )}
      {bulkTarget === 'none' ? (
        <select aria-label="-- Pilih Anggota Team --" value={formData.assigned_to} onChange={e => fd({ assigned_to: e.target.value })}
          className={inputCls} style={inputStyle}>
          <option value="">-- Pilih Anggota Team --</option>
          {canAssignSelf && selfUser && (
            <option value={selfUser.username}>Saya kerjakan sendiri ({selfUser.full_name})</option>
          )}
          {supervisorUsers.length > 0 && (
            <optgroup label="🎯 Route ke Supervisor">
              {supervisorUsers.map(u => (
                <option key={`sup-${u.id}`} value={`SUP::${u.id}::${u.full_name}`}>{u.full_name} (Supervisor)</option>
              ))}
            </optgroup>
          )}
          {kelompokDitugaskan.map(k => {
            const anggota = teamUsers.filter(u => u.team_type === k.nama);
            if (anggota.length === 0) return null;
            return (
              <optgroup key={k.nama} label={k.label}>
                {anggota.map(u => <option key={u.id} value={u.username}>{u.full_name}</option>)}
              </optgroup>
            );
          })}
        </select>
      ) : (
        <div className="rounded-xl px-4 py-3 flex items-center gap-3"
          style={{ background: 'rgba(8,145,178,0.07)', border: '1.5px solid rgba(8,145,178,0.3)' }}>
          <span className="text-2xl"><Ikon nama="👥" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
          <div>
            <p className="text-sm font-bold text-cyan-700">
              {teamUsers.filter(u => u.team_type === BULK_TEAM_TYPE[bulkTarget] && u.jabatan !== 'Manager').length} anggota
            </p>
            <p className="text-xs text-cyan-700">
              Akan membuat reminder untuk seluruh Tim {BULK_LABEL[bulkTarget]}
            </p>
          </div>
        </div>
      )}
    </div>
    
    </div>
  );
}
