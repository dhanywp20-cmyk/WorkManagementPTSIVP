'use client';

import type { Dispatch, SetStateAction } from 'react';
import { SalesPicker, type SalesPickerUser } from '@/components/shared/SalesPicker';
import { BRAND_OPTIONS } from '@/lib/brand-routing';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { inputStyle, inputCls } from './RequestJadwalModal';
import type { JadwalRequest } from './RequestJadwalModal';

export interface RequestJadwalProyekProps {
  salesName: string;
  salesDivision: string;
  isInternalSales: boolean;
  form: JadwalRequest;
  externalSalesUsers: SalesPickerUser[];
  f: (patch: Partial<JadwalRequest>) => void;
  setFormErr: Dispatch<SetStateAction<string>>;
  initial: Partial<JadwalRequest> | undefined;
}

export function RequestJadwalProyek({
  salesName, salesDivision, isInternalSales, form, externalSalesUsers, f, setFormErr, initial,
}: RequestJadwalProyekProps) {
  return (
    <div className="space-y-3 satulayar:overflow-y-auto satulayar:pr-2 satulayar:min-h-0">
    
    <div
      className="rounded-xl p-3 flex items-center gap-3"
      style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-white shrink-0"
        style={{ background: 'linear-gradient(135deg, var(--merek-utama), var(--merek-utama-2))' }}
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
          <IkonTeks nama="⏳" />Menunggu Approval
        </span>
      </div>
    </div>
    
    {isInternalSales && (
      <div>
        <label className="block text-[11px] font-bold mb-1 tracking-widest uppercase" style={{ color: '#64748b' }}>
          SBU <span className="normal-case text-slate-500 font-medium tracking-normal">(opsional — buat atas nama Sales External)</span>
        </label>
        <SalesPicker
          value={form.sbu_name ?? ''}
          users={externalSalesUsers}
          onChange={(name, division, userId) => f({ sbu_name: name, sbu_division: division, sbu_user_id: userId })}
          placeholder="— Pilih Sales External (opsional) —"
          triggerClassName="rounded-xl px-4 py-3"
          triggerStyle={inputStyle}
          dropdownZIndex={130}
        />
        {form.sbu_name && (
          <p className="text-[11px] text-blue-500 mt-1">
            Schedule ini akan diatasnamakan <strong>{form.sbu_name}</strong>{form.sbu_division ? ` · ${form.sbu_division}` : ''}.
          </p>
        )}
      </div>
    )}
    
    {!isInternalSales && (
      <div>
        <label className="block text-[11px] font-bold mb-1 tracking-widest uppercase" style={{ color: '#64748b' }}>
          Brand * <span className="normal-case text-slate-500 font-medium tracking-normal">(Sales Internal yang handle)</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {BRAND_OPTIONS.map(opt => {
            const sel = form.brand === opt.value;
            return (
              <button key={opt.value} type="button" onClick={() => { f({ brand: opt.value }); setFormErr(''); }}
                className="px-3 py-3 rounded-xl border-2 text-center text-sm font-bold transition-all leading-tight"
                style={sel
                  ? { borderColor: '#2563eb', background: 'rgba(37,99,235,0.1)', color: '#1d4ed8' }
                  : { borderColor: 'rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.5)', color: '#64748b' }}>
                {opt.value === 'MVI' ? '🏠 ' : opt.value === 'IVP' ? '🌐 ' : '🏠🌐 '}{opt.label}
              </button>
            );
          })}
        </div>
      </div>
    )}
    
    {!!initial?.project_name && (
      <div className="rounded-xl px-3.5 py-2.5" style={{ background: 'rgba(8,145,178,0.08)', border: '1px solid rgba(8,145,178,0.25)' }}>
        <p className="text-[12px] font-bold" style={{ color: '#0e7490' }}>
          ✓ Detail diisi dari project Anda sebelumnya
        </p>
        <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: '#155e75' }}>
          Serah-terima (BAST) request ini akan digabung dengan yang lama saat disetujui admin -
          tidak terhitung sebagai project baru. Tinggal tentukan kategori dan tanggal di bawah.
        </p>
      </div>
    )}
    
    <div>
      <label htmlFor="f-reminder-schedule-components-requestjadwalmodal-1" className="block text-[11px] font-bold mb-1 tracking-widest uppercase" style={{ color: '#64748b' }}>
        Nama Project *
      </label>
      <input id="f-reminder-schedule-components-requestjadwalmodal-1"
        value={form.project_name}
        onChange={e => f({ project_name: e.target.value })}
        className={inputCls} style={inputStyle}
        placeholder="Contoh: PT. Maju Bersama — Instalasi LED Wall"
      />
    </div>
    
    <div>
      <label className="block text-[11px] font-bold mb-1 tracking-widest uppercase" style={{ color: '#64748b' }}>
        Lokasi Project *
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2"><Ikon nama="📍" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
        <input
          value={form.address}
          onChange={e => f({ address: e.target.value })}
          className={`${inputCls} pl-9`} style={inputStyle}
          placeholder="Gedung / Alamat lengkap..."
        />
      </div>
    </div>
    
    <div>
      <label htmlFor="f-reminder-schedule-components-requestjadwalmodal-2" className="block text-[11px] font-bold mb-1 tracking-widest uppercase" style={{ color: '#64748b' }}>
        Deskripsi Kebutuhan
      </label>
      <textarea id="f-reminder-schedule-components-requestjadwalmodal-2"
        value={form.description}
        onChange={e => f({ description: e.target.value })}
        rows={2}
        className={`${inputCls} resize-none`} style={inputStyle}
        placeholder="Jelaskan kebutuhan / tujuan kegiatan..."
      />
    </div>
    
    </div>
  );
}
