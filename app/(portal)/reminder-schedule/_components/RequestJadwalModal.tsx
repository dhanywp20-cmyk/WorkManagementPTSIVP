'use client';
import { useState } from 'react';
import { ModalPortal, BatalButton, SubmitFormButton, KepalaModal, LATAR_MODAL, KARTU_MODAL } from '@/components/shared';
import { type SalesPickerUser } from '@/components/shared/SalesPicker';
import { type Brand } from '@/lib/brand-routing';
import { Ikon } from '@/components/shared/Ikon';
import { RequestJadwalWaktu } from './RequestJadwalWaktu';
import { RequestJadwalProyek } from './RequestJadwalProyek';

export interface JadwalRequest {
  project_name: string;
  description: string;
  address: string;
  category: string;
  product_type: string;
  due_date: string;
  progress_start_date: string;
  progress_target_date: string;
  extra_dates: string[];
  due_time: string;
  pic_name: string;
  pic_phone: string;
  product: string;
  notes: string;
  sales_division?: string;
  brand?: Brand;
  sbu_name?: string;
  sbu_division?: string;
  sbu_user_id?: string | null;
}

interface RequestJadwalModalProps {
  salesName: string;
  salesUsername: string;
  salesDivision?: string;
  isInternalSales?: boolean;
  externalSalesUsers?: SalesPickerUser[];
  onClose: () => void;
  onSubmit: (data: JadwalRequest) => Promise<void>;
  initial?: Partial<JadwalRequest>;
}

export const inputCls =
  'w-full rounded-lg px-3 py-2 text-xs outline-hidden transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/40';
export const inputStyle = {
  background: '#ffffff',
  border: '1px solid rgba(0,0,0,0.12)',
};

export const ALLOWED_CATEGORIES = ['Demo Product', 'Meeting & Survey', 'Konfigurasi', 'Konfigurasi & Training', 'Training', 'Maintenance'];

export function RequestJadwalModal({
  salesName,
  salesDivision = '',
  isInternalSales = false,
  externalSalesUsers = [],
  onClose,
  onSubmit,
  initial,
}: RequestJadwalModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [form, setForm] = useState<JadwalRequest>({
    project_name: '',
    description: '',
    address: '',
    category: 'Demo Product',
    product_type: '',
    due_date: new Date().toISOString().split('T')[0],
    progress_start_date: '',
    progress_target_date: '',
    extra_dates: [],
    due_time: '09:00',
    pic_name: '',
    pic_phone: '',
    product: '',
    notes: '',
    sales_division: salesDivision,
    brand: undefined,
    sbu_name: '',
    sbu_division: '',
    sbu_user_id: null,
    ...initial,
  });

  const f = (patch: Partial<JadwalRequest>) => setForm(prev => ({ ...prev, ...patch }));

  const handleSubmit = async () => {
    if (!form.project_name.trim()) { setFormErr('Nama project wajib diisi!'); return; }
    if (!form.address.trim()) { setFormErr('Lokasi project wajib diisi!'); return; }
    if (!isInternalSales && !form.brand) { setFormErr('Pilih Brand dulu (MVI / IVP / Kedua Brand)!'); return; }
    if (!form.product_type) { setFormErr('Pilih tipe produk dulu (LED / LCD·Middleware / LED & LCD)!'); return; }
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
    <ModalPortal>
    <div role="dialog" aria-modal="true" className="fixed inset-0 flex items-center justify-center z-1100 p-3 sm:p-4" style={LATAR_MODAL}>
      <div className={`${KARTU_MODAL} w-full max-w-[1500px] h-full max-h-full flex flex-col overflow-hidden`}>
        <KepalaModal judul="Request Jadwal" keterangan="Permintaan dikirim ke Admin untuk disetujui & ditugaskan ke Team PTS" onTutup={onClose} />

        <div className="flex-1 min-h-0 overflow-y-auto satulayar:overflow-hidden">
          <div className="p-4 grid grid-cols-1 satulayar:grid-cols-3 gap-4 satulayar:h-full satulayar:overflow-hidden">

          <RequestJadwalProyek
            salesName={salesName} salesDivision={salesDivision} isInternalSales={isInternalSales} form={form} externalSalesUsers={externalSalesUsers} f={f}
            setFormErr={setFormErr} initial={initial}
          />

          <RequestJadwalWaktu form={form} f={f} setFormErr={setFormErr} />

          <div className="space-y-3 satulayar:overflow-y-auto satulayar:pr-2 satulayar:min-h-0">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label htmlFor="f-reminder-schedule-components-requestjadwalmodal-7" className="block text-[11px] font-bold mb-1 tracking-widest uppercase" style={{ color: '#64748b' }}>
                Nama PIC Project
              </label>
              <input id="f-reminder-schedule-components-requestjadwalmodal-7"
                value={form.pic_name}
                onChange={e => f({ pic_name: e.target.value })}
                className={inputCls} style={inputStyle}
                placeholder="Nama PIC di lokasi..."
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold mb-1 tracking-widest uppercase" style={{ color: '#64748b' }}>
                No. Telepon PIC
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2"><Ikon nama="📱" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                <input
                  value={form.pic_phone}
                  onChange={e => f({ pic_phone: e.target.value })}
                  className={`${inputCls} pl-9`} style={inputStyle}
                  placeholder="08xxxxxxxxxx"
                />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="f-reminder-schedule-components-requestjadwalmodal-8" className="block text-[11px] font-bold mb-1 tracking-widest uppercase" style={{ color: '#64748b' }}>
              Catatan Tambahan
            </label>
            <textarea id="f-reminder-schedule-components-requestjadwalmodal-8"
              value={form.notes}
              onChange={e => f({ notes: e.target.value })}
              rows={2}
              className={`${inputCls} resize-none`} style={inputStyle}
              placeholder="Informasi tambahan untuk tim PTS..."
            />
          </div>

          <div
            className="rounded-xl p-3 flex items-start gap-3"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}
          >
            <span className="text-lg shrink-0"><Ikon nama="ℹ" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
            <div>
              <p className="text-xs font-bold text-amber-700">Alur Approval</p>
              <p className="text-[11px] text-amber-700 leading-relaxed mt-0.5">
                Request akan masuk sebagai <strong>Pending</strong> ke Admin.
                Admin akan mereview, menyetujui, dan mengassign ke anggota Team PTS IVP.
                Kamu akan mendapat notifikasi setelah disetujui (WhatsApp/Telegram, sesuai kanal yang aktif).
              </p>
            </div>
          </div>

          </div>
          </div>
        </div>

        <div className="px-6 py-4 shrink-0 border-t border-slate-200 bg-white/70">
          {formErr && (
            <div className="px-3 py-2 rounded-lg text-xs font-medium text-red-700 bg-red-50 border border-red-200 mb-2">{formErr}</div>
          )}
          <div className="flex gap-2 justify-end">
            <BatalButton onClick={onClose} />
            <SubmitFormButton
              onClick={handleSubmit}
              loading={submitting}
              disabled={!form.project_name.trim() || !form.address.trim() || (!isInternalSales && !form.brand) || !form.product_type || !form.due_date}
              suffix={(() => {
                const dateCount = new Set([form.due_date, ...form.extra_dates].filter(Boolean)).size || 1;
                return dateCount > 1 ? `${dateCount} Hari` : undefined;
              })()}
            />
          </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
