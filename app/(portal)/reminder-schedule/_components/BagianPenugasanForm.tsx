'use client';

import type { Dispatch, RefObject, SetStateAction } from 'react';
import { GuestUser, REVIEW_TRIGGER_CATEGORIES } from './shared';
import { FormField, SectionHeader } from '@/components/shared';
import { Ikon } from '@/components/shared/Ikon';
import { BULK_LABEL } from './ReminderFormModal';
import type { ReminderForm, BulkTarget } from './ReminderFormModal';

export interface BagianPenugasanFormProps {
  formData: ReminderForm;
  fd: (patch: Partial<ReminderForm>) => void;
  inputCls: "w-full rounded-lg px-3 py-2 text-xs outline-hidden transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-red-500/40";
  inputStyle: { background: string; border: string; };
  guestDropdownRef: RefObject<HTMLDivElement | null>;
  guestDropdownOpen: boolean;
  setGuestDropdownOpen: Dispatch<SetStateAction<boolean>>;
  setGuestSearch: Dispatch<SetStateAction<string>>;
  guestSearch: string;
  guestUsers: GuestUser[];
  bulkTarget: BulkTarget;
}

export function BagianPenugasanForm({
  formData, fd, inputCls, inputStyle, guestDropdownRef, guestDropdownOpen, setGuestDropdownOpen, setGuestSearch,
  guestSearch, guestUsers, bulkTarget,
}: BagianPenugasanFormProps) {
  return (
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
                <svg aria-hidden="true" focusable="false" className={`w-4 h-4 shrink-0 transition-transform ${guestDropdownOpen ? 'rotate-180' : ''} ${isTrigger ? 'text-violet-400' : 'text-slate-500'}`}
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
                        className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-hidden"
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
  );
}
