'use client';

import { useRef, useState } from 'react';
import { Reminder, TeamUser, GuestUser, Priority, Status, RepeatType, CATEGORIES, CATEGORY_CONFIG, PRIORITY_CONFIG, STATUS_CONFIG, REPEAT_OPTIONS, REVIEW_TRIGGER_CATEGORIES, PRODUCT_TYPES } from './shared';
import { FormField, SectionHeader, MultiDatePicker, ModalPortal, BatalButton, SubmitFormButton, KepalaModal, LATAR_MODAL, KARTU_MODAL } from '@/components/shared';
import { BRAND_OPTIONS } from '@/lib/brand-routing';
import { useKelompokPTSDitugaskan } from '@/lib/kelompok/inti';
import { Ikon } from '@/components/shared/Ikon';

export type ReminderForm = Omit<Reminder, 'id' | 'created_at' | 'created_by' | 'wa_sent_h1'>;
export type BulkTarget = 'none' | 'ivp' | 'mvi' | 'ump';

const BULK_TEAM_TYPE: Record<string, string> = { ivp: 'Team PTS IVP', mvi: 'Team PTS MVI', ump: 'Team PTS UMP' };
const BULK_LABEL: Record<string, string> = { ivp: 'PTS IVP', mvi: 'PTS MVI', ump: 'PTS UMP' };

interface Props {
  editingReminder: Reminder | null;
  formData: ReminderForm;
  setFormData: (data: ReminderForm) => void;
  saving: boolean;
  teamUsers: TeamUser[];
  guestUsers: GuestUser[];
  bulkTarget: BulkTarget;
  onBulkTargetChange: (t: BulkTarget) => void;
  extraDates: string[];
  onExtraDatesChange: (dates: string[]) => void;
  onClose: () => void;
  onSubmit: () => void;
  supervisorUsers?: TeamUser[];
  canAssignSelf?: boolean;
  selfUser?: { username: string; full_name: string } | null;
  jumlahJadwalLama?: number;
}

export function ReminderFormModal({ editingReminder, formData, setFormData, saving, teamUsers, guestUsers, bulkTarget, onBulkTargetChange, extraDates, onExtraDatesChange, onClose, onSubmit, canAssignSelf, selfUser, supervisorUsers = [], jumlahJadwalLama = 0 }: Props) {
  const kelompokDitugaskan = useKelompokPTSDitugaskan();
  const [guestSearch, setGuestSearch] = useState('');
  const [guestDropdownOpen, setGuestDropdownOpen] = useState(false);
  const [err, setErr] = useState('');
  const guestDropdownRef = useRef<HTMLDivElement>(null);

  const fd = (patch: Partial<ReminderForm>) => { setFormData({ ...formData, ...patch }); };

  function handleSubmit() {
    if (!formData.product_type) { setErr('Pilih tipe produk dulu (LED / LCD·Middleware / LED & LCD).'); return; }
    if (!formData.brand) { setErr('Pilih Brand dulu (MVI / IVP / Kedua Brand) — menentukan Finance mana yang boleh melihat nominalnya.'); return; }
    setErr('');
    onSubmit();
  }

  const inputCls = "w-full rounded-lg px-3 py-2 text-xs outline-none transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-red-500/40";
  const inputStyle = { background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(0,0,0,0.12)' };

  return (
  <ModalPortal>
    <div role="dialog" aria-modal="true" className="fixed inset-0 flex items-center justify-center z-[1100] p-3 sm:p-4" style={LATAR_MODAL}>
      <div className={`${KARTU_MODAL} w-full max-w-[1500px] h-full max-h-full flex flex-col overflow-hidden`}>
        <KepalaModal judul={editingReminder ? 'Edit Reminder' : 'Tambah Reminder'} keterangan="Isi detail jadwal & informasi project" onTutup={onClose} />

        <div className="flex-1 min-h-0 overflow-y-auto satulayar:overflow-hidden">
          <div className="p-4 grid grid-cols-1 satulayar:grid-cols-3 gap-4 satulayar:h-full satulayar:overflow-hidden">

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
                    <span className="text-base leading-none flex-shrink-0"><Ikon nama={c.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /></span>
                    <span className="text-[11px] font-bold leading-tight flex-1 min-w-0">{cat}</span>
                    {sel && <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" /></svg>}
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

          <div className="space-y-3 satulayar:overflow-y-auto satulayar:pr-2 satulayar:min-h-0">
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

          <div className="space-y-3 satulayar:overflow-y-auto satulayar:pr-2 satulayar:min-h-0">
          <SectionHeader icon="🏢" title="Informasi Project" />

          <FormField label="Product / Unit (Opsional)">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2"><Ikon nama="📦" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
              <input value={formData.product ?? ''} onChange={e => fd({ product: e.target.value })}
                className={`${inputCls} pl-9`} style={inputStyle} placeholder="Contoh: Sony VPL-FHZ85, Crestron DMPS3..." />
            </div>
          </FormField>

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
                      <span className="text-base"><Ikon nama="⭐" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                      <p className="text-sm font-bold text-violet-700">Tugaskan Guest untuk Form Review</p>
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
                        : <span className="text-slate-500">-- Pilih Sales --</span>
                      }
                      <svg aria-hidden="true" focusable="false" className={`w-4 h-4 flex-shrink-0 transition-transform ${guestDropdownOpen ? 'rotate-180' : ''} ${isTrigger ? 'text-violet-400' : 'text-slate-500'}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>

                    {guestDropdownOpen && (
                      <div className="absolute z-50 mt-1 w-full rounded-xl shadow-xl overflow-hidden"
                        style={{ background: 'white', border: '1.5px solid rgba(124,58,237,0.3)', maxHeight: '240px' }}>
                        <div className="p-2 border-b" style={{ borderColor: 'rgba(124,58,237,0.15)' }}>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-400 text-sm"><Ikon nama="🔍" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                            <input aria-label="Cari nama sales / guest..." autoFocus type="text" value={guestSearch}
                              onChange={e => setGuestSearch(e.target.value)}
                              placeholder="Cari nama sales / guest..."
                              className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
                              style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)', color: '#1e293b' }}
                              onClick={e => e.stopPropagation()}
                            />
                          </div>
                        </div>
                        <div className="overflow-y-auto" style={{ maxHeight: '180px' }}>
                          <div className="px-4 py-2.5 text-sm cursor-pointer hover:bg-violet-50 text-slate-500 italic"
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
                                  {u.sales_division && <p className="text-xs text-violet-500">{u.sales_division}</p>}
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
                            <div className="px-4 py-4 text-center text-xs text-gray-500">Tidak ada sales ditemukan</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {guestDropdownOpen && (
                    <div aria-hidden="true" className="fixed inset-0 z-40" onClick={() => { setGuestDropdownOpen(false); setGuestSearch(''); }} />
                  )}
                </FormField>

                {isTrigger && formData.sales_name && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                    style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
                    <span className="text-sm"><Ikon nama="✅" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Nama PIC">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2"><Ikon nama="🙋" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                <input value={formData.pic_name} onChange={e => fd({ pic_name: e.target.value })}
                  className={`${inputCls} pl-9`} style={inputStyle} placeholder="Nama PIC di lokasi" />
              </div>
            </FormField>
            <FormField label="No. PIC">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2"><Ikon nama="📱" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                <input type="tel" value={formData.pic_phone} onChange={e => fd({ pic_phone: e.target.value })}
                  className={`${inputCls} pl-9`} style={inputStyle} placeholder="08xxx" />
              </div>
            </FormField>
          </div>

          {(formData.assigned_to || bulkTarget !== 'none') && (
            <div className="rounded-xl p-3 flex items-start gap-3"
              style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.25)' }}>
              <span className="text-green-500 text-lg"><Ikon nama="💬" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
              <div>
                <p className="text-sm font-bold text-green-700">WA Otomatis H-1</p>
                <p className="text-xs text-green-700 mt-0.5">
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

          </div>
          </div>
        </div>

        <div className="px-6 py-4 flex-shrink-0 border-t border-slate-200 bg-white/70 space-y-3">
          {err && (
            <div className="rounded-xl px-4 py-3 text-sm font-semibold flex items-center gap-2"
              style={{ background: 'rgba(225,29,72,0.08)', border: '1px solid rgba(225,29,72,0.3)', color: '#e11d48' }}>
              <span><Ikon nama="⚠" ukuran="1em" className="inline-block align-[-0.12em]" /></span>{err}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <BatalButton onClick={onClose} />
            <SubmitFormButton
              onClick={handleSubmit}
              loading={saving}
              editing={!!editingReminder}
              suffix={(() => {
                if (editingReminder) return undefined;
                const dateCount = new Set([formData.due_date, ...extraDates].filter(Boolean)).size || 1;
                const targetCount = bulkTarget !== 'none' ? teamUsers.filter(u => u.team_type === BULK_TEAM_TYPE[bulkTarget] && u.jabatan !== 'Manager').length : 1;
                const total = dateCount * targetCount;
                return total > 1
                  ? `${total} Reminder (${dateCount} hari${targetCount > 1 ? ` × ${targetCount} orang` : ''})`
                  : undefined;
              })()}
            />
          </div>
        </div>
      </div>
    </div>
  </ModalPortal>
  );
}
