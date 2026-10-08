'use client';

/** KolomInfoProyekBaru - dipecah dari app/(portal)/form-require-project/_components/Modals.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { Ikon } from '@/components/shared/Ikon';
import { SalesPicker } from '@/components/shared';
import { BRAND_OPTIONS } from '@/lib/brand-routing';
import { User } from '../shared';
import { type InitialFormType } from '../Modals';

export interface KolomInfoProyekBaruProps {
  currentUser: User;
  dueDateForm: string;
  form: InitialFormType;
  isInternalSalesGuest: boolean;
  salesGuestUsers: { id: string; full_name: string; username: string; sales_division?: string; is_internal_sales?: boolean; }[];
  setDueDateForm: import("react").Dispatch<import("react").SetStateAction<string>>;
  setForm: import("react").Dispatch<import("react").SetStateAction<InitialFormType>>;
}

export function KolomInfoProyekBaru({ currentUser, dueDateForm, form, isInternalSalesGuest, salesGuestUsers, setDueDateForm, setForm }: KolomInfoProyekBaruProps) {
  return (
    <>
      <div className="satulayar:col-span-1 space-y-4 satulayar:overflow-y-auto satulayar:pr-1 satulayar:min-h-0">

      {/* ── Project Info ── */}
      <div className="bg-white/95 rounded-2xl p-5 border-2 border-gray-200 shadow-sm">
        <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
          <span className="w-7 h-7 bg-teal-600 text-white rounded-lg flex items-center justify-center text-xs shadow"><Ikon nama="📁" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
          Informasi Project
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <label htmlFor="f-form-require-project-components-modals-16" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Nama Project *</label>
            <input id="f-form-require-project-components-modals-16" value={form.project_name} onChange={e => setForm(prev => ({ ...prev, project_name: e.target.value }))}
              placeholder="Contoh: Meeting Room Lantai 5 - PT ABC"
              className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition-all text-sm font-medium bg-white outline-none" />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="f-form-require-project-components-modals-17" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Lokasi Project *</label>
            <textarea id="f-form-require-project-components-modals-17" value={form.project_location} onChange={e => setForm(prev => ({ ...prev, project_location: e.target.value }))}
              placeholder="Contoh: Gedung Wisma 46 Lt.12, Jl. MH Thamrin No.1, Jakarta Pusat"
              rows={3} className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition-all text-sm font-medium bg-white outline-none resize-none" />
          </div>
          {['admin','superadmin','team_pts','team'].includes((currentUser?.role || '').toLowerCase().trim()) && (
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Sales / Account</label>
              <SalesPicker
                value={form.sales_name}
                users={salesGuestUsers}
                onChange={(name, div) => setForm(prev => ({ ...prev, sales_name: name, sales_division: div }))}
                triggerClassName="border-2 border-gray-200 rounded-xl px-3 py-2.5 bg-white cursor-pointer hover:border-teal-400 transition-all"
              />
            </div>
          )}
          {/* SBU — Sales Internal buat request ATAS NAMA Sales External tertentu.
             Opsional; kalau kosong, request atas nama Sales Internal sendiri. */}
          {isInternalSalesGuest && (
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                SBU <span className="normal-case text-gray-500 font-medium tracking-normal">(opsional — atas nama Sales External)</span>
              </label>
              <SalesPicker
                value={form.sales_name}
                users={salesGuestUsers.filter(u => !u.is_internal_sales && u.id !== currentUser.id)}
                onChange={(name, div) => setForm(prev => ({ ...prev, sales_name: name, sales_division: div }))}
                placeholder="— Pilih Sales External (opsional) —"
                triggerClassName="border-2 border-gray-200 rounded-xl px-3 py-2.5 bg-white cursor-pointer hover:border-teal-400 transition-all"
              />
              {form.sales_name && (
                <p className="text-[11px] text-teal-700 mt-1">Request diatasnamakan <strong>{form.sales_name}</strong>{form.sales_division ? ` · ${form.sales_division}` : ''}.</p>
              )}
            </div>
          )}
          {/* Marketing Brand — WAJIB utk Sales External. Menentukan Sales Internal (House/Global) yg review/approve. */}
          {currentUser?.role === 'guest' && !isInternalSalesGuest && (
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Marketing Brand * <span className="normal-case text-gray-500 font-medium tracking-normal">(Sales Internal yang handle)</span></label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {BRAND_OPTIONS.map(opt => {
                  const sel = form.brand === opt.value;
                  return (
                    <button key={opt.value} type="button" onClick={() => setForm(prev => ({ ...prev, brand: opt.value }))}
                      className="px-3 py-2.5 rounded-xl border-2 text-center text-sm font-bold transition-all leading-tight"
                      style={sel
                        ? { borderColor: '#0d9488', background: 'rgba(13,148,136,0.08)', color: '#0f766e' }
                        : { borderColor: 'rgba(0,0,0,0.1)', background: 'white', color: '#64748b' }}>
                      {opt.value === 'MVI' ? '🏠 ' : opt.value === 'IVP' ? '🌐 ' : '🏠🌐 '}{opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div>
            <label htmlFor="f-form-require-project-components-modals-18" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Target Selesai *</label>
            <input id="f-form-require-project-components-modals-18" type="date" value={dueDateForm} onChange={e => setDueDateForm(e.target.value)} required aria-label="Target selesai"
              className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition-all text-sm font-medium bg-white outline-none" />
          </div>

        </div>
      </div>

      </div>
    </>
  );
}
