'use client';

import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { User, TeamMember } from './shared';
import { SalesPicker } from '@/components/shared';

export interface NewTicketForm {
  project_name: string;
  address: string;
  customer_phone: string;
  sales_name: string;
  sales_division: string;
  sn_unit: string;
  product: string;
  issue_case: string;
  description: string;
  assign_name: string;
  date: string;
  status: string;
  current_team: string;
  photo: File | null;
  reminder_id: string | null;
}

interface ReminderRef {
  id: string;
  project_name: string;
  address: string;
  sales_name: string;
  sales_division: string;
  product?: string;
  pic_name: string;
  pic_phone: string;
  category: string;
  assign_name: string;
}

interface Props {
  onClose: () => void;
  form: NewTicketForm;
  setForm: (f: NewTicketForm) => void;
  uploading: boolean;
  currentUser: User | null;
  users: User[];
  teamPTSMembers: TeamMember[];
  supervisorMembers?: TeamMember[];
  onSubmit: () => void;
}

export function NewTicketModal({ onClose, form, setForm, uploading, currentUser, users, teamPTSMembers, supervisorMembers = [], onSubmit }: Props) {
  const set = (patch: Partial<NewTicketForm>) => setForm({ ...form, ...patch });

  // Admin/superadmin ATAU Manager PTS boleh tentukan penanganan langsung saat create.
  const canAssignDirect = currentUser?.role === 'admin' || currentUser?.role === 'superadmin'
    || (currentUser?.role === 'team' && (currentUser as any)?.jabatan === 'Manager');

  // Creator = Sales Internal (guest) → boleh isi SBU (buat ticket atas nama Sales External).
  const isInternalSalesGuest = currentUser?.role === 'guest' && !!users.find(u => u.id === currentUser.id)?.is_internal_sales;
  const externalSalesUsers = users.filter(u => u.role === 'guest' && !u.is_internal_sales && u.id !== currentUser?.id)
    .map(u => ({ id: u.id, full_name: u.full_name, sales_division: u.sales_division ?? null }));

  const [projectType, setProjectType] = useState<'new' | 'existing'>('new');
  const [reminderQuery, setReminderQuery] = useState('');
  const [reminderResults, setReminderResults] = useState<ReminderRef[]>([]);
  const [reminderSearching, setReminderSearching] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<ReminderRef | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchReminders = useCallback(async (q: string) => {
    if (!q.trim()) { setReminderResults([]); return; }
    setReminderSearching(true);
    const { data } = await supabase
      .from('reminders')
      .select('id, project_name, address, sales_name, sales_division, product, pic_name, pic_phone, category, assign_name')
      .in('category', ['Konfigurasi & Training', 'Training'])
      .ilike('project_name', `%${q}%`)
      .order('created_at', { ascending: false })
      .limit(10);
    setReminderResults(data ?? []);
    setReminderSearching(false);
  }, []);

  const handleQueryChange = (q: string) => {
    setReminderQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchReminders(q), 300);
  };

  const selectReminder = (r: ReminderRef) => {
    setSelectedReminder(r);
    setReminderResults([]);
    setReminderQuery('');
    setForm({
      ...form,
      project_name: r.project_name,
      address: r.address || '',
      sales_name: r.sales_name || '',
      sales_division: r.sales_division || '',
      product: r.product || '',
      customer_phone: r.pic_phone || '',
      assign_name: r.assign_name || form.assign_name,
      reminder_id: r.id,
    });
  };

  const switchProjectType = (type: 'new' | 'existing') => {
    setProjectType(type);
    setSelectedReminder(null);
    setReminderQuery('');
    setReminderResults([]);
    if (type === 'new') {
      setForm({ ...form, project_name: '', address: '', sales_name: '', sales_division: '', product: '', customer_phone: '', assign_name: '', reminder_id: null });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 overflow-y-auto"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-2xl my-4 overflow-hidden"
        style={{ animation: "scale-in 0.25s ease-out", border: "1.5px solid rgba(220,38,38,0.25)" }}>

        {/* Header */}
        <div className="px-8 py-6 rounded-t-2xl"
          style={{ background: "linear-gradient(135deg,#dc2626,#991b1b)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">🎫 Create New Ticket</h2>
              <p className="text-red-200/80 text-xs mt-1">Isi detail ticket & informasi troubleshooting</p>
            </div>
            <button onClick={onClose} className="bg-white/15 hover:bg-white/25 text-white p-2 rounded-lg transition-all">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-8 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Section: Informasi Ticket */}
          <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: "rgba(0,0,0,0.1)" }}>
            <span className="text-lg">🎫</span>
            <span className="text-sm font-bold tracking-wide text-slate-700">Informasi Ticket</span>
          </div>

          {/* Project Type Toggle */}
          <div>
            <label className="block text-xs font-bold mb-2 tracking-widest uppercase" style={{ color: "#94a3b8" }}>Tipe Project</label>
            <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: "rgba(0,0,0,0.12)" }}>
              <button type="button"
                onClick={() => switchProjectType('new')}
                className="flex-1 py-2.5 text-sm font-bold transition-all"
                style={projectType === 'new'
                  ? { background: "linear-gradient(135deg,#dc2626,#991b1b)", color: "white" }
                  : { background: "rgba(255,255,255,0.95)", color: "#64748b" }}>
                ✏️ Project Baru
              </button>
              <button type="button"
                onClick={() => switchProjectType('existing')}
                className="flex-1 py-2.5 text-sm font-bold transition-all border-l"
                style={projectType === 'existing'
                  ? { background: "linear-gradient(135deg,#dc2626,#991b1b)", color: "white", borderColor: "transparent" }
                  : { background: "rgba(255,255,255,0.95)", color: "#64748b", borderColor: "rgba(0,0,0,0.12)" }}>
                🔍 Project Existing
              </button>
            </div>
          </div>

          {/* Project Existing: Search */}
          {projectType === 'existing' && (
            <div>
              <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#94a3b8" }}>
                Cari Project (Konfigurasi & Training / Training)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                <input
                  type="text"
                  value={reminderQuery}
                  onChange={e => handleQueryChange(e.target.value)}
                  placeholder="Ketik nama project untuk mencari..."
                  className="w-full rounded-xl pl-9 pr-4 py-3 text-sm outline-none transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-red-500/40"
                  style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }}
                />
                {reminderSearching && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">mencari...</span>
                )}
              </div>

              {/* Search Results */}
              {reminderResults.length > 0 && (
                <div className="mt-1 rounded-xl border overflow-hidden shadow-lg z-10"
                  style={{ background: "white", borderColor: "rgba(220,38,38,0.2)" }}>
                  {reminderResults.map(r => (
                    <button key={r.id} type="button"
                      onClick={() => selectReminder(r)}
                      className="w-full text-left px-4 py-3 hover:bg-red-50 transition-colors border-b last:border-b-0 flex flex-col gap-0.5"
                      style={{ borderColor: "rgba(0,0,0,0.06)" }}>
                      <span className="text-sm font-bold text-slate-800">{r.project_name}</span>
                      <span className="text-xs text-slate-500 flex gap-3">
                        {r.category && <span className="text-red-600 font-semibold">{r.category}</span>}
                        {r.address && <span>📍 {r.address.slice(0, 50)}{r.address.length > 50 ? '…' : ''}</span>}
                        {r.sales_name && <span>👤 {r.sales_name}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Selected reminder badge */}
              {selectedReminder && (
                <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.2)" }}>
                  <span className="text-red-600 font-bold text-sm">✓</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{selectedReminder.project_name}</p>
                    <p className="text-xs text-slate-500">{selectedReminder.category} · Data berhasil di-fill otomatis</p>
                  </div>
                  <button type="button"
                    onClick={() => { setSelectedReminder(null); set({ project_name: '' }); }}
                    className="text-xs text-red-400 hover:text-red-600 font-bold flex-shrink-0">✕</button>
                </div>
              )}
            </div>
          )}

          {/* Row 1: Project Name | Address */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#94a3b8" }}>
                Project Name *
                {projectType === 'existing' && selectedReminder && (
                  <span className="ml-2 text-red-400 font-semibold normal-case text-[10px]">🔒 dari reminder</span>
                )}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2">📌</span>
                <input type="text" value={form.project_name}
                  onChange={e => projectType === 'new' || !selectedReminder ? set({ project_name: e.target.value }) : undefined}
                  readOnly={projectType === 'existing' && !!selectedReminder}
                  placeholder={projectType === 'existing' ? 'Pilih project dari pencarian di atas' : 'Example: BCA Cibitung Project'}
                  className="w-full rounded-xl pl-9 pr-4 py-3 text-sm outline-none transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-red-500/40"
                  style={{
                    background: projectType === 'existing' && selectedReminder ? "rgba(220,38,38,0.05)" : "rgba(255,255,255,0.95)",
                    border: projectType === 'existing' && selectedReminder ? "1px solid rgba(220,38,38,0.3)" : "1px solid rgba(0,0,0,0.12)",
                    cursor: projectType === 'existing' && selectedReminder ? 'default' : 'text',
                  }} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#94a3b8" }}>📍 Address Detail</label>
              <div className="relative">
                <span className="absolute left-3 top-3">📍</span>
                <textarea value={form.address} onChange={e => set({ address: e.target.value })}
                  rows={2} placeholder="Example: Jl. Jend. Sudirman No. 1..."
                  className="w-full rounded-xl pl-9 pr-4 py-3 text-sm outline-none transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-red-500/40 resize-none"
                  style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} />
              </div>
            </div>
          </div>

          {/* Row 2: Product | SN Unit */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#94a3b8" }}>📦 Product / Brand</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2">📦</span>
                <input type="text" value={form.product} onChange={e => set({ product: e.target.value })}
                  placeholder="Panasonic PT-MZ682, LG 75UL3Q, dll"
                  className="w-full rounded-xl pl-9 pr-4 py-3 text-sm outline-none transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-red-500/40"
                  style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#94a3b8" }}>
                SN Unit <span className="text-gray-400 normal-case font-normal text-[10px]">(opsional)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2">🔢</span>
                <input type="text" value={form.sn_unit} onChange={e => set({ sn_unit: e.target.value })}
                  placeholder="SN12345678 (opsional)"
                  className="w-full rounded-xl pl-9 pr-4 py-3 text-sm outline-none transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-red-500/40"
                  style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} />
              </div>
            </div>
          </div>

          {/* Row 3: Customer Phone | Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#94a3b8" }}>Customer Phone</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2">📱</span>
                <input type="text" value={form.customer_phone} onChange={e => set({ customer_phone: e.target.value })}
                  placeholder="Adi - 08xx-xxxx-xxxx"
                  className="w-full rounded-xl pl-9 pr-4 py-3 text-sm outline-none transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-red-500/40"
                  style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#94a3b8" }}>
                📅 Date <span className="text-gray-400 normal-case font-normal text-[10px]">(hari ini)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">📅</span>
                <input type="text"
                  value={new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                  disabled
                  className="w-full rounded-xl pl-9 pr-4 py-3 text-sm text-slate-400 cursor-not-allowed"
                  style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)" }} />
              </div>
            </div>
          </div>

          {/* Issue Case */}
          <div>
            <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#94a3b8" }}>Issue Case *</label>
            <div className="relative">
              <span className="absolute left-3 top-3">⚠️</span>
              <input type="text" value={form.issue_case}
                onChange={e => {
                  const val = e.target.value;
                  const words = val.trim().split(/\s+/).filter(Boolean);
                  if (words.length < 4 || (words.length === 4 && !val.endsWith(" ")))
                    set({ issue_case: val });
                }}
                placeholder="Maks. 4 kata, contoh: Videowall Not Working"
                className="w-full rounded-xl pl-9 pr-4 py-3 text-sm outline-none transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-red-500/40"
                style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} />
            </div>
            <div className="flex justify-between items-center mt-1.5 px-1">
              <span className="text-xs text-gray-500">Maksimal 4 kata</span>
              <span className={`text-xs font-bold ${form.issue_case.trim().split(/\s+/).filter(Boolean).length >= 4 ? "text-red-500" : "text-gray-400"}`}>
                {form.issue_case.trim().split(/\s+/).filter(Boolean).length}/4 kata
              </span>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#94a3b8" }}>📝 Detailed Description</label>
            <textarea value={form.description} onChange={e => set({ description: e.target.value })}
              rows={3} placeholder="Explain the problem details..."
              className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-red-500/40 resize-none"
              style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} />
          </div>

          {/* SBU — Sales Internal (guest) buat ticket ATAS NAMA Sales External.
             Opsional; kalau kosong, ticket atas nama Sales Internal sendiri. */}
          {isInternalSalesGuest && (
            <div>
              <div className="flex items-center gap-2 pb-2 border-b pt-2 mb-3" style={{ borderColor: "rgba(0,0,0,0.1)" }}>
                <span className="text-lg">🏢</span>
                <span className="text-sm font-bold tracking-wide text-slate-700">SBU (Sales External)</span>
              </div>
              <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#94a3b8" }}>
                SBU <span className="normal-case text-gray-400 font-medium tracking-normal">(opsional — atas nama Sales External)</span>
              </label>
              <SalesPicker
                value={form.sales_name}
                users={externalSalesUsers}
                onChange={(name, div) => set({ sales_name: name, sales_division: div })}
                placeholder="— Pilih Sales External (opsional) —"
                triggerClassName="rounded-xl px-4 py-3 cursor-pointer"
                triggerStyle={{ background: "rgba(255,255,255,0.90)", border: "1px solid rgba(0,0,0,0.12)" }}
              />
              {form.sales_name && (
                <p className="text-[11px] text-red-500 mt-1">Ticket diatasnamakan <strong>{form.sales_name}</strong>{form.sales_division ? ` · ${form.sales_division}` : ''}.</p>
              )}
            </div>
          )}

          {/* Sales — hidden for guest (auto-inserted), shown for admin/team */}
          {currentUser?.role !== "guest" && (
            <div>
              <div className="flex items-center gap-2 pb-2 border-b pt-2 mb-3" style={{ borderColor: "rgba(0,0,0,0.1)" }}>
                <span className="text-lg">🏢</span>
                <span className="text-sm font-bold tracking-wide text-slate-700">Informasi Sales</span>
              </div>
              <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#94a3b8" }}>Sales Name</label>
              <SalesPicker
                value={form.sales_name}
                users={users.filter(u => u.role === "guest")}
                onChange={(name, div) => set({ sales_name: name, sales_division: div })}
                triggerClassName="rounded-xl px-4 py-3 cursor-pointer"
                triggerStyle={{ background: "rgba(255,255,255,0.90)", border: "1px solid rgba(0,0,0,0.12)" }}
              />
            </div>
          )}

          {/* Admin/Superadmin/Manager: tentukan penanganan langsung */}
          {canAssignDirect && (
            <div>
              <div className="flex items-center gap-2 pb-2 border-b pt-2 mb-3" style={{ borderColor: "rgba(0,0,0,0.1)" }}>
                <span className="text-lg">👷</span>
                <span className="text-sm font-bold tracking-wide text-slate-700">Penanganan</span>
              </div>
              <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#94a3b8" }}>Assign ke *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2">👨‍💼</span>
                <select value={form.assign_name} onChange={e => set({ assign_name: e.target.value })}
                  className="w-full rounded-xl pl-9 pr-4 py-3 text-sm outline-none transition-all text-slate-800 focus:ring-2 focus:ring-red-500/40 appearance-none cursor-pointer"
                  style={{ background: "rgba(255,255,255,0.90)", border: "1px solid rgba(0,0,0,0.12)" }}>
                  <option value="">— Pilih penanganan —</option>
                  <option value="SELF">🙋 Saya kerjakan sendiri</option>
                  <optgroup label="👷 Assign langsung ke Team PTS">
                    {teamPTSMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                  </optgroup>
                  {supervisorMembers.length > 0 && (
                    <optgroup label="🎯 Route ke Supervisor">
                      {supervisorMembers.map(m => <option key={`sup-${m.id}`} value={`SUP::${m.id}::${m.name}`}>{m.name} (Supervisor)</option>)}
                    </optgroup>
                  )}
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-xs">▾</span>
              </div>
            </div>
          )}

          {/* Approval notice — hanya utk yg TIDAK bisa assign langsung (guest / team biasa) */}
          {!canAssignDirect && (
            <div className="rounded-xl p-4 flex items-start gap-3"
              style={{ background: "rgba(245,158,11,0.1)", border: "1.5px solid rgba(245,158,11,0.3)" }}>
              <span className="text-2xl">⏳</span>
              <div>
                <p className="text-sm font-bold text-orange-800">Perlu Persetujuan Superadmin</p>
                <p className="text-xs text-orange-700 mt-0.5">
                  Ticket yang Anda buat akan masuk ke antrian approval Superadmin terlebih dahulu.
                  Setelah disetujui, Superadmin akan assign ticket ke Tim PTS yang tersedia.
                </p>
              </div>
            </div>
          )}

          {/* Upload Foto */}
          <div className="flex items-center gap-2 pb-2 border-b pt-2" style={{ borderColor: "rgba(0,0,0,0.1)" }}>
            <span className="text-lg">📸</span>
            <span className="text-sm font-bold tracking-wide text-slate-700">Foto Pendukung</span>
          </div>
          <div>
            <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#94a3b8" }}>
              Upload Foto <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <p className="text-xs text-gray-500 mb-3">Foto pendukung kondisi awal / bukti masalah</p>
            <input type="file" accept="image/*" onChange={e => set({ photo: e.target.files?.[0] || null })}
              className="w-full border rounded-xl px-4 py-2.5 bg-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100 transition-all text-sm"
              style={{ borderColor: "rgba(0,0,0,0.12)" }} />
            {form.photo && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2 p-2 bg-white rounded-lg border" style={{ borderColor: "rgba(220,38,38,0.2)" }}>
                  <span className="text-red-600">✓</span>
                  <span className="text-sm font-semibold text-gray-700 flex-1 truncate">{form.photo.name}</span>
                  <span className="text-xs text-gray-400">({(form.photo.size / 1024).toFixed(1)} KB)</span>
                  <button type="button" onClick={() => set({ photo: null })} className="text-red-400 hover:text-red-600 font-bold text-xs ml-1">✕</button>
                </div>
                <img src={URL.createObjectURL(form.photo)} alt="Preview"
                  className="w-full max-h-48 object-cover rounded-lg border-2 shadow-sm"
                  style={{ borderColor: "rgba(220,38,38,0.3)" }} />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button onClick={onClose}
              className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all"
              style={{ background: "rgba(255,255,255,0.95)", color: "#64748b", border: "1px solid rgba(0,0,0,0.12)" }}>
              Batal
            </button>
            <button onClick={onSubmit} disabled={uploading}
              className="flex-1 text-white py-3 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2 hover:scale-[1.02] disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#dc2626,#b91c1c)", boxShadow: "0 4px 14px rgba(220,38,38,0.35)" }}>
              {uploading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {uploading ? "⏳ Menyimpan..." : "💾 Save Ticket"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
