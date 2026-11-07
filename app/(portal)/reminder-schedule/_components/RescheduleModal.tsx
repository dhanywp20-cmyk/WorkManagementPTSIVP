'use client';
import { useState } from 'react';
import { Reminder, formatDate } from './shared';
import { KotakInfo, LabelIsian, Modal, TombolModal, kelasIsianPersetujuan as kelasIsian } from '@/components/shared';

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
  return (
  <Modal buka onTutup={() => { if (!saving) onClose(); }} judul="Re-Schedule Jadwal" lapisan="atas" tutupDiLuar={false}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    keterangan={reminder.project_name || (reminder as any).title || '—'}
    footer={<>
      <TombolModal onClick={onClose} disabled={saving}>Batal</TombolModal>
      <TombolModal jenis="utama" onClick={handleSave} disabled={!newDate || saving}>{saving ? 'Menyimpan...' : 'Simpan Re-Schedule'}</TombolModal>
    </>}>
        <div className="space-y-4">
          <KotakInfo judul="Jadwal sekarang">
            <p className="text-sm font-bold text-slate-800">{formatDate(reminder.due_date)} · {reminder.due_time}</p>
          </KotakInfo>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <LabelIsian htmlFor="f-reminder-schedule-components-reschedulemodal-1" wajib>Tanggal baru</LabelIsian>
              <input id="f-reminder-schedule-components-reschedulemodal-1" type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className={kelasIsian} />
            </div>
            <div>
              <LabelIsian htmlFor="f-reminder-schedule-components-reschedulemodal-2">Waktu baru</LabelIsian>
              <input id="f-reminder-schedule-components-reschedulemodal-2" type="time" value={newTime} onChange={e => setNewTime(e.target.value)} className={kelasIsian} />
            </div>
          </div>

          <div>
            <LabelIsian htmlFor="f-reminder-schedule-components-reschedulemodal-3">Alasan re-schedule</LabelIsian>
            <textarea id="f-reminder-schedule-components-reschedulemodal-3" value={reason} onChange={e => setReason(e.target.value)} rows={3}
              className={`${kelasIsian} resize-none`}
              placeholder="Contoh: Permintaan klien untuk mengundur jadwal..." />
          </div>

        </div>
  </Modal>
  );
}
