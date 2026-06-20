'use client';

import { useRef, useState } from 'react';
import {
  Reminder, TeamUser, GuestUser, Priority, Status, RepeatType,
  CATEGORIES, CATEGORY_CONFIG, PRIORITY_CONFIG, STATUS_CONFIG,
  REPEAT_OPTIONS, REVIEW_TRIGGER_CATEGORIES, INCENTIVE_TRIGGER_CATEGORIES,
  CONTROLLER_BRANDS, CONTROLLER_CATEGORIES, CONTROLLER_AUTOMATION_ELIGIBLE,
  MANAGER_PIC_USERNAME, PicType, ControllerBrand,
} from './shared';
import { FormField, SectionHeader } from '@/components/shared';

export type ReminderForm = Omit<Reminder, 'id' | 'created_at' | 'created_by' | 'wa_sent_h1'>;
export type BulkTarget = 'none' | 'ivp' | 'mlds' | 'ump';

const BULK_TEAM_TYPE: Record<string, string> = { ivp: 'Team PTS IVP', mlds: 'Team PTS MLDS', ump: 'Team PTS UMP' };
const BULK_LABEL: Record<string, string> = { ivp: 'PTS IVP', mlds: 'PTS MLDS', ump: 'PTS UMP' };

interface Props {
  editingReminder: Reminder | null;
  formData: ReminderForm;
  setFormData: (data: ReminderForm) => void;
  saving: boolean;
  teamUsers: TeamUser[];
  guestUsers: GuestUser[];
  bulkTarget: BulkTarget;
  onBulkTargetChange: (t: BulkTarget) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function ReminderFormModal({ editingReminder, formData, setFormData, saving, teamUsers, guestUsers, bulkTarget, onBulkTargetChange, onClose, onSubmit }: Props) {
  const fd = (patch: Partial<ReminderForm>) => setFormData({ ...formData, ...patch });

  const [guestSearch, setGuestSearch] = useState('');
  const [guestDropdownOpen, setGuestDropdownOpen] = useState(false);
  const guestDropdownRef = useRef<HTMLDivElement>(null);

  const inputCls = "w-full rounded-xl px-4 py-3 text-sm outline-none transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-red-500/40";
  const inputStyle = { background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(0,0,0,0.12)' };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[110] p-4 overflow-y-auto"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-2xl my-4"
        style={{ animation: 'scale-in 0.25s ease-out', border: '1.5px solid rgba(220,38,38,0.25)' }}>

        {/* Header */}
        <div className="px-8 py-6 rounded-t-2xl"
          style={{ background: 'linear-gradient(135deg,#0891b2,#0e7490)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">{editingReminder ? '✏️ Edit Reminder' : '➕ Tambah Reminder'}</h2>
              <p className="text-cyan-200/80 text-xs mt-1">Isi detail jadwal & informasi project</p>
            </div>
            <button onClick={onClose} className="bg-white/15 hover:bg-white/25 text-white p-2 rounded-lg transition-all">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-8 space-y-5 max-h-[75vh] overflow-y-auto">
          <SectionHeader icon="📋" title="Informasi Jadwal" />

          <FormField label="Nama Project*">
            <input value={formData.project_name} onChange={e => fd({ project_name: e.target.value })}
              className={inputCls} style={inputStyle} placeholder="Contoh: PT. Maju Bersama" />
          </FormField>

          <FormField label="Lokasi Project *">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2">📍</span>
              <input value={formData.address} onChange={e => fd({ address: e.target.value })}
                className={`${inputCls} pl-9`} style={inputStyle} placeholder="Contoh: Gedung Wisma 46 Lt. 12" />
            </div>
          </FormField>

          <FormField label="Deskripsi">
            <textarea value={formData.description} onChange={e => fd({ description: e.target.value })}
              rows={2} className={`${inputCls} resize-none`} style={inputStyle} placeholder="Detail pekerjaan..." />
          </FormField>

          {/* Category picker */}
          <div>
            <label className="block text-xs font-bold mb-2 tracking-widest uppercase" style={{ color: '#94a3b8' }}>Kategori *</label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(cat => {
                const c = CATEGORY_CONFIG[cat];
                const sel = formData.category === cat;
                return (
                  <button key={cat} type="button" onClick={() => fd({ category: cat })}
                    className="flex items-center gap-3 px-4 py-4 rounded-xl border-2 text-left transition-all"
                    style={sel
                      ? { borderColor: c.color, background: c.bg, color: c.color }
                      : { borderColor: 'rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.5)', color: '#64748b' }}>
                    <span className="text-2xl">{c.icon}</span>
                    <span className="text-base font-bold leading-tight flex-1">{cat}</span>
                    {sel && <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Assign To — single or bulk */}
          <div>
            <label className="block text-xs font-bold mb-2 tracking-widest uppercase" style={{ color: '#94a3b8' }}>Assign To *</label>
            {!editingReminder && (
              <div className="flex flex-wrap gap-2 mb-3">
                {([
                  { key: 'none', label: '👤 Per Orang' },
                  { key: 'ivp',  label: '👥 Semua PTS IVP' },
                  { key: 'mlds', label: '👥 Semua PTS MLDS' },
                  { key: 'ump',  label: '👥 Semua PTS UMP' },
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
              <select value={formData.assigned_to} onChange={e => fd({ assigned_to: e.target.value })}
                className={inputCls} style={inputStyle}>
                <option value="">-- Pilih Anggota Team --</option>
                {teamUsers.filter(u => u.team_type === 'Team PTS IVP').length > 0 && (
                  <optgroup label="PTS IVP">
                    {teamUsers.filter(u => u.team_type === 'Team PTS IVP').map(u => <option key={u.id} value={u.username}>{u.full_name}</option>)}
                  </optgroup>
                )}
                {teamUsers.filter(u => u.team_type === 'Team PTS MLDS').length > 0 && (
                  <optgroup label="PTS MLDS">
                    {teamUsers.filter(u => u.team_type === 'Team PTS MLDS').map(u => <option key={u.id} value={u.username}>{u.full_name}</option>)}
                  </optgroup>
                )}
                {teamUsers.filter(u => u.team_type === 'Team PTS UMP').length > 0 && (
                  <optgroup label="PTS UMP">
                    {teamUsers.filter(u => u.team_type === 'Team PTS UMP').map(u => <option key={u.id} value={u.username}>{u.full_name}</option>)}
                  </optgroup>
                )}
              </select>
            ) : (
              <div className="rounded-xl px-4 py-3 flex items-center gap-3"
                style={{ background: 'rgba(8,145,178,0.07)', border: '1.5px solid rgba(8,145,178,0.3)' }}>
                <span className="text-2xl">👥</span>
                <div>
                  <p className="text-sm font-bold text-cyan-700">
                    {teamUsers.filter(u => u.team_type === BULK_TEAM_TYPE[bulkTarget]).length} anggota
                  </p>
                  <p className="text-xs text-cyan-600">
                    Akan membuat reminder untuk seluruh Tim {BULK_LABEL[bulkTarget]}
                  </p>
                </div>
              </div>
            )}
          </div>

          <FormField label="Pengulangan">
            <select value={formData.repeat} onChange={e => fd({ repeat: e.target.value as RepeatType })}
              className={inputCls} style={inputStyle}>
              {REPEAT_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </FormField>

          {/* Warranty Years — for Konfigurasi categories */}
          {(formData.category === 'Konfigurasi' || formData.category === 'Konfigurasi & Training') && (
            <div className="rounded-xl p-4" style={{ background: 'rgba(14,165,233,0.07)', border: '1.5px solid rgba(14,165,233,0.3)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🛡️</span>
                <p className="text-sm font-bold text-sky-700">Masa Garansi (Warranty)</p>
              </div>
              <p className="text-xs text-sky-600 mb-3">Tanggal BAST (field Tanggal di atas) akan digunakan sebagai titik mulai garansi. Pilih durasi warranty project ini.</p>
              <div className="grid grid-cols-4 gap-2">
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
                      <div className="text-[10px] font-normal mt-0.5 opacity-80">{labels[String(val)]}</div>
                    </button>
                  );
                })}
              </div>
              {formData.warranty_years && formData.due_date && (
                <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)' }}>
                  <span className="text-sm">📅</span>
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

          {/* Controller Automation — shown for CONTROLLER_CATEGORIES */}
          {(CONTROLLER_CATEGORIES as readonly string[]).includes(formData.category) && (
            <div className="rounded-xl p-4 space-y-4" style={{ background: 'rgba(8,145,178,0.07)', border: '1.5px solid rgba(8,145,178,0.35)' }}>
              <div className="flex items-center gap-2">
                <span className="text-lg">🎛️</span>
                <p className="text-sm font-bold text-cyan-700">Incentive & Controller Automation</p>
              </div>

              {/* Controller Automation checkbox */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox"
                  checked={!!formData.requires_controller_automation}
                  onChange={e => fd({ requires_controller_automation: e.target.checked, controller_automation_brand: e.target.checked ? formData.controller_automation_brand : null })}
                  className="w-4 h-4 accent-cyan-600" />
                <span className="text-sm font-semibold text-slate-700">Controller Automation</span>
                <span className="text-xs text-slate-400">(Cue / Extron / Wyrestorm)</span>
              </label>

              {formData.requires_controller_automation && (
                <FormField label="Brand Controller *">
                  <div className="flex flex-wrap gap-2">
                    {CONTROLLER_BRANDS.map(b => (
                      <button key={b.value} type="button"
                        onClick={() => fd({ controller_automation_brand: b.value as ControllerBrand })}
                        className="px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all"
                        style={formData.controller_automation_brand === b.value
                          ? { borderColor: '#0891b2', background: 'rgba(8,145,178,0.18)', color: '#0369a1' }
                          : { borderColor: 'rgba(0,0,0,0.12)', background: 'rgba(255,255,255,0.7)', color: '#64748b' }}>
                        {b.label}
                      </button>
                    ))}
                  </div>
                </FormField>
              )}

              {/* PIC Type */}
              <FormField label="Tipe PIC">
                <div className="flex gap-3">
                  {([
                    { value: 'standard', label: '👤 Standard (Yoga / Farhan)', desc: 'PIC 60%, Support 30%, Manager 10%' },
                    { value: 'manager_pic', label: '🏅 Manager sebagai PIC', desc: 'Dhany sebagai PIC langsung' },
                  ] as { value: PicType; label: string; desc: string }[]).map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => fd({ pic_type: opt.value })}
                      className="flex-1 flex flex-col gap-1 px-3 py-3 rounded-xl border-2 text-left transition-all"
                      style={(formData.pic_type ?? 'standard') === opt.value
                        ? { borderColor: '#0891b2', background: 'rgba(8,145,178,0.12)', color: '#0369a1' }
                        : { borderColor: 'rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.6)', color: '#64748b' }}>
                      <span className="text-xs font-bold">{opt.label}</span>
                      <span className="text-[11px] opacity-70">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </FormField>

              {/* Execution Mode */}
              <FormField label="Mode Pelaksanaan">
                <div className="flex gap-3">
                  {(['onsite', 'remote'] as const).map(mode => (
                    <button key={mode} type="button"
                      onClick={() => fd({ mode_penyelesaian: mode })}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all"
                      style={formData.mode_penyelesaian === mode
                        ? { borderColor: mode === 'onsite' ? '#10b981' : '#7c3aed', background: mode === 'onsite' ? 'rgba(16,185,129,0.14)' : 'rgba(124,58,237,0.12)', color: mode === 'onsite' ? '#065f46' : '#6d28d9' }
                        : { borderColor: 'rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.6)', color: '#64748b' }}>
                      {mode === 'onsite' ? '🏢 Onsite' : '🌐 Remote'}
                    </button>
                  ))}
                </div>
              </FormField>

              {/* Incentive Value */}
              <FormField label="Nilai Incentive (Rp)">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">Rp</span>
                  <input type="number" min={0} value={formData.incentive_value ?? 0}
                    onChange={e => fd({ incentive_value: Number(e.target.value) })}
                    className={`${inputCls} pl-10`} style={inputStyle} placeholder="0" />
                </div>
              </FormField>

              {/* BAST Date */}
              <FormField label="Tanggal BAST">
                <input type="date" value={formData.bast_date ?? ''}
                  onChange={e => fd({ bast_date: e.target.value || null })}
                  className={inputCls} style={inputStyle} />
              </FormField>

              {/* Validation hint */}
              {formData.requires_controller_automation && (formData.pic_type ?? 'standard') === 'standard' && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
                  <span className="text-sm">⚠️</span>
                  <p className="text-xs text-amber-700">Controller Automation standard PIC harus Yoga atau Farhan. Pastikan "Assign To" di atas sudah sesuai.</p>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
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

          {editingReminder && (
            <FormField label="Status">
              <select value={formData.status} onChange={e => fd({ status: e.target.value as Status })}
                className={inputCls} style={inputStyle}>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </FormField>
          )}

          <SectionHeader icon="🏢" title="Informasi Project" />

          <FormField label="Product / Unit (Opsional)">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2">📦</span>
              <input value={formData.product ?? ''} onChange={e => fd({ product: e.target.value })}
                className={`${inputCls} pl-9`} style={inputStyle} placeholder="Contoh: Sony VPL-FHZ85, Crestron DMPS3..." />
            </div>
          </FormField>

          {/* Pilih Sales — selalu tampil untuk semua kategori */}
          {(() => {
            const isTrigger = (REVIEW_TRIGGER_CATEGORIES as readonly string[]).includes(formData.category);
            return (
              <div className="rounded-xl p-4 space-y-3"
                style={isTrigger
                  ? { background: 'rgba(124,58,237,0.06)', border: '1.5px solid rgba(124,58,237,0.25)' }
                  : { background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.1)' }}>

                {isTrigger && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-base">⭐</span>
                      <p className="text-sm font-bold text-violet-700">Assign Guest untuk Form Review</p>
                    </div>
                    <p className="text-xs text-violet-600 -mt-1">
                      Kategori <strong>{formData.category}</strong> memerlukan review dari Guest / Sales.
                      Pengingat Guest / Sales mengisi kepuasan pelanggan.
                    </p>
                  </>
                )}

                <FormField label="Pilih Sales *">
                  <div className="relative" ref={guestDropdownRef}>
                    <div
                      className="w-full rounded-xl px-4 py-3 text-sm flex items-center justify-between cursor-pointer transition-all"
                      style={{
                        ...inputStyle,
                        borderColor: guestDropdownOpen
                          ? (isTrigger ? 'rgba(124,58,237,0.6)' : 'rgba(99,102,241,0.5)')
                          : (isTrigger ? 'rgba(124,58,237,0.35)' : 'rgba(0,0,0,0.15)'),
                        boxShadow: guestDropdownOpen ? '0 0 0 3px rgba(124,58,237,0.1)' : undefined,
                      }}
                      onClick={() => { setGuestDropdownOpen(o => !o); if (!guestDropdownOpen) setGuestSearch(''); }}
                    >
                      {formData.sales_name
                        ? <span className="font-semibold text-slate-800">{formData.sales_name} <span className={`font-normal ${isTrigger ? 'text-violet-500' : 'text-slate-500'}`}>{formData.sales_division ? `· ${formData.sales_division}` : ''}</span></span>
                        : <span className="text-slate-400">-- Pilih Sales --</span>
                      }
                      <svg className={`w-4 h-4 flex-shrink-0 transition-transform ${guestDropdownOpen ? 'rotate-180' : ''} ${isTrigger ? 'text-violet-400' : 'text-slate-400'}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>

                    {guestDropdownOpen && (
                      <div className="absolute z-50 mt-1 w-full rounded-xl shadow-xl overflow-hidden"
                        style={{ background: 'white', border: '1.5px solid rgba(124,58,237,0.3)', maxHeight: '240px' }}>
                        <div className="p-2 border-b" style={{ borderColor: 'rgba(124,58,237,0.15)' }}>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-400 text-sm">🔍</span>
                            <input autoFocus type="text" value={guestSearch}
                              onChange={e => setGuestSearch(e.target.value)}
                              placeholder="Cari nama sales / guest..."
                              className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
                              style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)', color: '#1e293b' }}
                              onClick={e => e.stopPropagation()}
                            />
                          </div>
                        </div>
                        <div className="overflow-y-auto" style={{ maxHeight: '180px' }}>
                          <div className="px-4 py-2.5 text-sm cursor-pointer hover:bg-violet-50 text-slate-400 italic"
                            onClick={() => { fd({ sales_name: '', sales_division: '' }); setGuestDropdownOpen(false); setGuestSearch(''); }}>
                            -- Pilih Sales --
                          </div>
                          {guestUsers
                            .filter(u =>
                              !guestSearch.trim() ||
                              u.full_name.toLowerCase().includes(guestSearch.toLowerCase()) ||
                              u.username.toLowerCase().includes(guestSearch.toLowerCase()) ||
                              (u.sales_division ?? '').toLowerCase().includes(guestSearch.toLowerCase())
                            )
                            .map(u => (
                              <div key={u.id}
                                className="px-4 py-2.5 cursor-pointer transition-colors flex items-center justify-between gap-2"
                                style={{
                                  background: formData.sales_name === u.full_name ? 'rgba(124,58,237,0.1)' : undefined,
                                  borderLeft: formData.sales_name === u.full_name ? '3px solid #7c3aed' : '3px solid transparent',
                                }}
                                onMouseEnter={e => { if (formData.sales_name !== u.full_name) (e.currentTarget as HTMLDivElement).style.background = 'rgba(124,58,237,0.05)'; }}
                                onMouseLeave={e => { if (formData.sales_name !== u.full_name) (e.currentTarget as HTMLDivElement).style.background = ''; }}
                                onClick={() => { fd({ sales_name: u.full_name, sales_division: u.sales_division ?? '' }); setGuestDropdownOpen(false); setGuestSearch(''); }}
                              >
                                <div>
                                  <p className="text-sm font-semibold text-slate-800">{u.full_name}</p>
                                  <p className="text-xs text-violet-500">{u.username}{u.sales_division ? ` · ${u.sales_division}` : ''}</p>
                                </div>
                                {formData.sales_name === u.full_name && <span className="text-violet-600 text-sm">✓</span>}
                              </div>
                            ))
                          }
                          {guestSearch.trim() && guestUsers.filter(u =>
                            u.full_name.toLowerCase().includes(guestSearch.toLowerCase()) ||
                            u.username.toLowerCase().includes(guestSearch.toLowerCase()) ||
                            (u.sales_division ?? '').toLowerCase().includes(guestSearch.toLowerCase())
                          ).length === 0 && (
                            <div className="px-4 py-4 text-center text-xs text-gray-400">Tidak ada sales ditemukan</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {guestDropdownOpen && (
                    <div className="fixed inset-0 z-40" onClick={() => { setGuestDropdownOpen(false); setGuestSearch(''); }} />
                  )}
                </FormField>

                {isTrigger && formData.sales_name && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                    style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
                    <span className="text-sm">✅</span>
                    <p className="text-xs font-semibold text-violet-700">
                      Form review akan otomatis muncul di akun <strong>{formData.sales_name}</strong> setelah status jadwal ini diubah ke <strong>Completed</strong>.
                      {formData.sales_division && <span className="ml-1 text-violet-500">· Divisi: <strong>{formData.sales_division}</strong></span>}
                    </p>
                  </div>
                )}
              </div>
            );
          })()}

          <SectionHeader icon="🎯" title="PIC Project (Opsional)" />

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Nama PIC">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2">🙋</span>
                <input value={formData.pic_name} onChange={e => fd({ pic_name: e.target.value })}
                  className={`${inputCls} pl-9`} style={inputStyle} placeholder="Nama PIC di lokasi" />
              </div>
            </FormField>
            <FormField label="No. PIC">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2">📱</span>
                <input type="tel" value={formData.pic_phone} onChange={e => fd({ pic_phone: e.target.value })}
                  className={`${inputCls} pl-9`} style={inputStyle} placeholder="08xxx" />
              </div>
            </FormField>
          </div>

          {(formData.assigned_to || bulkTarget !== 'none') && (
            <div className="rounded-xl p-3 flex items-start gap-3"
              style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.25)' }}>
              <span className="text-green-500 text-lg">💬</span>
              <div>
                <p className="text-sm font-bold text-green-700">WA Otomatis H-1</p>
                <p className="text-xs text-green-600 mt-0.5">
                  {bulkTarget !== 'none'
                    ? <span>Pesan pengingat otomatis dikirim ke seluruh anggota Tim <strong>{BULK_LABEL[bulkTarget]}</strong> sehari sebelum jadwal.</span>
                    : <span>Pesan pengingat akan otomatis dikirim via WA ke <strong>{formData.assigned_to}</strong> sehari sebelum jadwal.</span>
                  }
                </p>
              </div>
            </div>
          )}

          <SectionHeader icon="📝" title="Catatan Tambahan" />

          <FormField label="Catatan">
            <textarea value={formData.notes} onChange={e => fd({ notes: e.target.value })}
              rows={2} className={`${inputCls} resize-none`} style={inputStyle} placeholder="Informasi tambahan untuk team..." />
          </FormField>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose}
              className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all"
              style={{ background: 'rgba(255,255,255,0.95)', color: '#64748b', border: '1px solid rgba(0,0,0,0.12)' }}>
              Batal
            </button>
            <button onClick={onSubmit} disabled={saving}
              className="flex-1 text-white py-3 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2 hover:scale-[1.02]"
              style={{ background: 'linear-gradient(135deg,#0891b2,#0e7490)', boxShadow: '0 4px 14px rgba(8,145,178,0.35)' }}>
              {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {editingReminder
                ? 'Simpan Perubahan'
                : bulkTarget !== 'none'
                  ? `➕ Buat ${teamUsers.filter(u => u.team_type === BULK_TEAM_TYPE[bulkTarget]).length} Reminder`
                  : '➕ Tambah Reminder'
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
