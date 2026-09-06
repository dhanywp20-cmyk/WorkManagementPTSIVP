'use client';
import { useState } from 'react';
import { Reminder, formatDate } from './shared';
import { ModalPortal } from '@/components/shared';

export function RescheduleModal({
  reminder,
  onClose,
  onSave,
}: {
  reminder: Reminder;
  onClose: () => void;
  onSave: (newDate: string, newTime: string, reason: string) => void | Promise<void>;
}) {
  const [newDate, setNewDate] = useState(reminder.due_date);
  const [newTime, setNewTime] = useState(reminder.due_time);
  const [reason, setReason] = useState('');
  // M5 (docs/UX-WORKFLOW-AUDIT.md): dulu tombol ini tidak punya guard loading
  // sama sekali - klik ganda pada koneksi lambat mengirim dua UPDATE + dua WA
  // "JADWAL DIUBAH" ke handler yang sama. onSave di-await supaya tombol tetap
  // terkunci sepanjang request berjalan, dan otomatis terbuka lagi kalau
  // gagal (modal TIDAK ditutup parent saat error - lihat handleReschedule).
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    if (!newDate || saving) return;
    setSaving(true);
    try {
      await onSave(newDate, newTime, reason);
    } finally {
      setSaving(false);
    }
  };
  const inputStyle = { background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.15)' };
  const inputCls = "w-full rounded-xl px-4 py-3 text-sm outline-none transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-red-500/40";

  return (
  <ModalPortal>
    <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1100] p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        style={{ animation: 'scale-in 0.25s ease-out', border: '2px solid rgba(245,158,11,0.5)' }}>
        {/* Header */}
        <div className="px-6 py-5" style={{ background: 'linear-gradient(135deg,#d97706,#b45309)' }}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">📅 Re-Schedule Jadwal</h3>
              <p className="text-amber-200/80 text-xs mt-0.5 truncate max-w-[260px]">{reminder.project_name || (reminder as any).title || '—'}</p>
            </div>
            <button aria-label="Tutup" onClick={onClose} className="bg-white/15 hover:bg-white/25 text-white p-2 rounded-lg">✕</button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {/* Current date info */}
          <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <span className="text-xl">📌</span>
            <div>
              <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Jadwal Sekarang</p>
              <p className="text-sm font-bold text-gray-800">{formatDate(reminder.due_date)} · {reminder.due_time}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: '#94a3b8' }}>Tanggal Baru *</label>
              <input aria-label="Tanggal Baru" type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: '#94a3b8' }}>Waktu Baru</label>
              <input aria-label="Waktu Baru" type="time" value={newTime} onChange={e => setNewTime(e.target.value)}
                className={inputCls} style={inputStyle} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: '#94a3b8' }}>Alasan Re-Schedule</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
              className={`${inputCls} resize-none`} style={inputStyle}
              placeholder="Contoh: Permintaan klien untuk mengundur jadwal..." />
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} disabled={saving}
              className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
              style={{ background: 'rgba(255,255,255,0.95)', color: '#64748b', border: '1px solid rgba(0,0,0,0.12)' }}>
              Batal
            </button>
            <button onClick={handleSave}
              disabled={!newDate || saving}
              className="flex-1 text-white py-3 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2 hover:scale-[1.02] disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#d97706,#b45309)', boxShadow: '0 4px 14px rgba(217,119,6,0.35)' }}>
              {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              📅 Simpan Re-Schedule
            </button>
          </div>
        </div>
      </div>
    </div>
  </ModalPortal>
  );
}
