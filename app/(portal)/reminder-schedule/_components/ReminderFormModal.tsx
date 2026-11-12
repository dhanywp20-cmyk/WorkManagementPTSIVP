'use client';

import { useRef, useState } from 'react';
import { Reminder, TeamUser, GuestUser } from './shared';
import { ModalPortal, BatalButton, SubmitFormButton, KepalaModal, LATAR_MODAL, KARTU_MODAL } from '@/components/shared';
import { useKelompokPTSDitugaskan } from '@/lib/kelompok/inti';
import { Ikon } from '@/components/shared/Ikon';
import { BagianPenugasanForm } from './BagianPenugasanForm';
import { BagianProjectForm } from './BagianProjectForm';
import { BagianJadwalForm } from './BagianJadwalForm';

export type ReminderForm = Omit<Reminder, 'id' | 'created_at' | 'created_by' | 'wa_sent_h1'>;
export type BulkTarget = 'none' | 'ivp' | 'mvi' | 'ump';

export const BULK_TEAM_TYPE: Record<string, string> = { ivp: 'Team PTS IVP', mvi: 'Team PTS MVI', ump: 'Team PTS UMP' };
export const BULK_LABEL: Record<string, string> = { ivp: 'PTS IVP', mvi: 'PTS MVI', ump: 'PTS UMP' };

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

  const inputCls = "w-full rounded-lg px-3 py-2 text-xs outline-hidden transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-red-500/40";
  const inputStyle = { background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(0,0,0,0.12)' };

  return (
  <ModalPortal>
    <div role="dialog" aria-modal="true" className="fixed inset-0 flex items-center justify-center z-1100 p-3 sm:p-4" style={LATAR_MODAL}>
      <div className={`${KARTU_MODAL} w-full max-w-[1500px] h-full max-h-full flex flex-col overflow-hidden`}>
        <KepalaModal judul={editingReminder ? 'Edit Reminder' : 'Tambah Reminder'} keterangan="Isi detail jadwal & informasi project" onTutup={onClose} />

        <div className="flex-1 min-h-0 overflow-y-auto satulayar:overflow-hidden">
          <div className="p-4 grid grid-cols-1 satulayar:grid-cols-3 gap-4 satulayar:h-full satulayar:overflow-hidden">

          <BagianJadwalForm
            jumlahJadwalLama={jumlahJadwalLama} formData={formData} fd={fd} inputCls={inputCls} inputStyle={inputStyle} setErr={setErr}
            editingReminder={editingReminder} onBulkTargetChange={onBulkTargetChange} bulkTarget={bulkTarget} canAssignSelf={canAssignSelf} selfUser={selfUser} supervisorUsers={supervisorUsers}
            kelompokDitugaskan={kelompokDitugaskan} teamUsers={teamUsers}
          />

          <BagianProjectForm
            formData={formData} fd={fd} inputCls={inputCls} inputStyle={inputStyle} editingReminder={editingReminder} extraDates={extraDates}
            onExtraDatesChange={onExtraDatesChange}
          />

          <BagianPenugasanForm
            formData={formData} fd={fd} inputCls={inputCls} inputStyle={inputStyle} guestDropdownRef={guestDropdownRef} guestDropdownOpen={guestDropdownOpen}
            setGuestDropdownOpen={setGuestDropdownOpen} setGuestSearch={setGuestSearch} guestSearch={guestSearch} guestUsers={guestUsers} bulkTarget={bulkTarget}
          />
          </div>
        </div>

        <div className="px-6 py-4 shrink-0 border-t border-slate-200 bg-white/70 space-y-3">
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
