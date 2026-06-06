'use client';
import { useState } from 'react';
import { CATEGORY_CONFIG } from './shared';

export interface JadwalRequest {
  project_name: string;
  description: string;
  address: string;
  category: string;
  due_date: string;
  due_time: string;
  pic_name: string;
  pic_phone: string;
  product: string;
  notes: string;
  sales_division?: string; // dikirim dari modal agar tidak bergantung hanya pada localStorage
}

interface RequestJadwalModalProps {
  salesName: string;       // full_name dari currentUser (guest)
  salesUsername: string;   // username dari currentUser
  salesDivision?: string;  // sales_division dari currentUser (opsional, pre-fill)
  onClose: () => void;
  onSubmit: (data: JadwalRequest) => Promise<void>;
}

const inputCls =
  'w-full rounded-xl px-4 py-3 text-sm outline-none transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/40';
const inputStyle = {
  background: '#ffffff',
  border: '1px solid rgba(0,0,0,0.12)',
};

// Kategori yang diizinkan untuk Guest request
const ALLOWED_CATEGORIES = ['Demo Product', 'Meeting & Survey', 'Konfigurasi', 'Konfigurasi & Training', 'Training'];

export function RequestJadwalModal({
  salesName,
  salesDivision = '',
  onClose,
  onSubmit,
}: RequestJadwalModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [form, setForm] = useState<JadwalRequest>({
    project_name: '',
    description: '',
    address: '',
    category: 'Demo Product',
    due_date: new Date().toISOString().split('T')[0],
    due_time: '09:00',
    pic_name: '',
    pic_phone: '',
    product: '',
    notes: '',
    sales_division: salesDivision,
  });

  const f = (patch: Partial<JadwalRequest>) => setForm(prev => ({ ...prev, ...patch }));

  const handleSubmit = async () => {
    if (!form.project_name.trim()) { setFormErr('Nama project wajib diisi!'); return; }
    if (!form.address.trim()) { setFormErr('Lokasi project wajib diisi!'); return; }
    if (!form.due_date) { setFormErr('Tanggal wajib diisi!'); return; }
    setFormErr('');
    setSubmitting(true);
    try {
      await onSubmit(form);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[110] p-4 overflow-y-auto"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4 overflow-hidden"
        style={{ animation: 'scale-in 0.25s ease-out', border: '2px solid rgba(59,130,246,0.35)' }}
      >
        {/* Header */}
        <div
          className="px-8 py-6 rounded-t-2xl flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
        >
          <div>
            <h2 className="text-xl font-bold text-white">📩 Request Jadwal</h2>
            <p className="text-blue-200/80 text-xs mt-1">
              Permintaan akan dikirim ke Admin untuk disetujui &amp; di-assign ke Team PTS
            </p>
          </div>
          <button
            onClick={onClose}
            className="bg-white/15 hover:bg-white/25 text-white p-2 rounded-lg transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-8 space-y-5 max-h-[75vh] overflow-y-auto">

          {/* Info requester */}
          <div
            className="rounded-xl p-3 flex items-center gap-3"
            style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)' }}
            >
              {salesName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-bold text-blue-700 uppercase tracking-widest">Requested by</p>
              <p className="text-sm font-bold text-slate-800">{salesName}</p>
              {salesDivision && <p className="text-xs text-blue-500">{salesDivision}</p>}
            </div>
            <div className="ml-auto text-right">
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white"
                style={{ background: 'rgba(59,130,246,0.6)' }}
              >
                ⏳ Menunggu Approval
              </span>
            </div>
          </div>

          {/* Nama Project */}
          <div>
            <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: '#94a3b8' }}>
              Nama Project *
            </label>
            <input
              value={form.project_name}
              onChange={e => f({ project_name: e.target.value })}
              className={inputCls} style={inputStyle}
              placeholder="Contoh: PT. Maju Bersama — Instalasi LED Wall"
            />
          </div>

          {/* Lokasi */}
          <div>
            <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: '#94a3b8' }}>
              Lokasi Project *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2">📍</span>
              <input
                value={form.address}
                onChange={e => f({ address: e.target.value })}
                className={`${inputCls} pl-9`} style={inputStyle}
                placeholder="Gedung / Alamat lengkap..."
              />
            </div>
          </div>

          {/* Deskripsi */}
          <div>
            <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: '#94a3b8' }}>
              Deskripsi Kebutuhan
            </label>
            <textarea
              value={form.description}
              onChange={e => f({ description: e.target.value })}
              rows={2}
              className={`${inputCls} resize-none`} style={inputStyle}
              placeholder="Jelaskan kebutuhan / tujuan kegiatan..."
            />
          </div>

          {/* Kategori */}
          <div>
            <label className="block text-xs font-bold mb-2 tracking-widest uppercase" style={{ color: '#94a3b8' }}>
              Kategori *
            </label>
            <div className="grid grid-cols-2 gap-2">
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
                    <span className="text-xl">{c.icon}</span>
                    <span className="text-sm font-bold leading-tight flex-1">{cat}</span>
                    {sel && (
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product */}
          <div>
            <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: '#94a3b8' }}>
              Product / Unit (Opsional)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2">📦</span>
              <input
                value={form.product}
                onChange={e => f({ product: e.target.value })}
                className={`${inputCls} pl-9`} style={inputStyle}
                placeholder="Contoh: Sony VPL-FHZ85, Samsung IF Series..."
              />
            </div>
          </div>

          {/* Tanggal & Waktu */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: '#94a3b8' }}>
                Tanggal Usulan *
              </label>
              <input
                type="date"
                value={form.due_date}
                onChange={e => f({ due_date: e.target.value })}
                className={inputCls} style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: '#94a3b8' }}>
                Waktu Usulan
              </label>
              <input
                type="time"
                value={form.due_time}
                onChange={e => f({ due_time: e.target.value })}
                className={inputCls} style={inputStyle}
              />
            </div>
          </div>

          {/* PIC */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: '#94a3b8' }}>
                Nama PIC Project
              </label>
              <input
                value={form.pic_name}
                onChange={e => f({ pic_name: e.target.value })}
                className={inputCls} style={inputStyle}
                placeholder="Nama PIC di lokasi..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: '#94a3b8' }}>
                No. Telepon PIC
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2">📱</span>
                <input
                  value={form.pic_phone}
                  onChange={e => f({ pic_phone: e.target.value })}
                  className={`${inputCls} pl-9`} style={inputStyle}
                  placeholder="08xxxxxxxxxx"
                />
              </div>
            </div>
          </div>

          {/* Catatan */}
          <div>
            <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: '#94a3b8' }}>
              Catatan Tambahan
            </label>
            <textarea
              value={form.notes}
              onChange={e => f({ notes: e.target.value })}
              rows={2}
              className={`${inputCls} resize-none`} style={inputStyle}
              placeholder="Informasi tambahan untuk tim PTS..."
            />
          </div>

          {/* Info approval flow */}
          <div
            className="rounded-xl p-3 flex items-start gap-3"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}
          >
            <span className="text-lg flex-shrink-0">ℹ️</span>
            <div>
              <p className="text-xs font-bold text-amber-700">Alur Approval</p>
              <p className="text-[11px] text-amber-600 leading-relaxed mt-0.5">
                Request akan masuk sebagai <strong>Pending</strong> ke Admin.
                Admin akan mereview, menyetujui, dan mengassign ke anggota Team PTS.
                Kamu akan mendapat notifikasi WhatsApp setelah disetujui.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all"
              style={{ background: '#ffffff', color: '#64748b', border: '1px solid rgba(0,0,0,0.12)' }}
            >
              Batal
            </button>
          </div>
          {formErr && (
            <div className="px-4 py-2.5 rounded-xl text-sm font-medium text-red-700 bg-red-50 border border-red-200 mb-2">{formErr}</div>
          )}
          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={submitting || !form.project_name.trim() || !form.address.trim() || !form.due_date}
              className="flex-[2] text-white py-3 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', boxShadow: '0 4px 14px rgba(37,99,235,0.35)' }}
            >
              {submitting
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Mengirim...</>
                : <>📩 Kirim Request Jadwal</>
              }
            </button>
          </div>
          </div>
        </div>
      </div>
  );
}
