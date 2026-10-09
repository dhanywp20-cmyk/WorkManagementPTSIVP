'use client';

/** Deklarasi tingkat modul daily-report/page.tsx (scripts/pindah-tingkat-modul.mjs). */
import { useState } from 'react';
import { bisaDiklik } from '@/components/shared/bisaDiklik';
import { DAILY_REPORT_CATEGORIES, CATEGORY_CONFIG, type TeamUser, type GuestUser } from '@/app/(portal)/reminder-schedule/_components/shared';
import { type ManualActivity, type TeamEntry } from './shared';
import { Ikon } from '@/components/shared/Ikon';
import { Toast as ToastBersama } from '@/components/shared/Toast';

// Styles
export const inp: React.CSSProperties = {
  background: 'rgba(255,255,255,0.95)', border: '1.5px solid rgba(0,0,0,0.12)',
  borderRadius: '12px', color: '#1e293b', fontSize: '14px',
  padding: '10px 14px', width: '100%', outline: 'none',
};
export const inpCls = 'transition-all focus:ring-2 focus:ring-red-300';

export const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.97)', borderRadius: '16px',
  boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid rgba(255,255,255,0.8)',
  overflow: 'hidden',
};
export const cardHdr: React.CSSProperties = {
  padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.06)',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};
export const TH: React.CSSProperties = {
  padding: '10px 14px', textAlign: 'left' as const, fontSize: '11px',
  fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const,
  letterSpacing: '0.06em', whiteSpace: 'nowrap' as const,
  background: 'rgba(248,250,252,0.97)', borderBottom: '2px solid rgba(0,0,0,0.07)',
  borderRight: '1px solid rgba(0,0,0,0.06)',
};
export const TD: React.CSSProperties = {
  padding: '11px 14px', fontSize: '13px', color: '#1e293b',
  verticalAlign: 'middle' as const, borderBottom: '1px solid rgba(0,0,0,0.04)',
  borderRight: '1px solid rgba(0,0,0,0.04)',
};

// Helpers
export const SB: Record<string, { label: string; bg: string; color: string; border: string }> = {
  done:          { label: 'Selesai',  bg: '#d1fae5', color: '#065f46', border: '#10b981' },
  completed:     { label: 'Selesai',  bg: '#d1fae5', color: '#065f46', border: '#10b981' },
  pending:       { label: 'Pending',  bg: '#fef3c7', color: '#92400e', border: '#f59e0b' },
  cancelled:     { label: 'Batal',    bg: '#fee2e2', color: '#991b1b', border: '#ef4444' },
  'in progress': { label: 'Proses',   bg: '#dbeafe', color: '#1e40af', border: '#3b82f6' },
  manual:        { label: 'Manual',   bg: '#fef3c7', color: '#b45309', border: '#f59e0b' },
};
export const sb = (s: string) => SB[s?.toLowerCase()] ?? { label: s || '-', bg: '#f3f4f6', color: '#374151', border: '#6b7280' };

export const AVC = ['#7c3aed','#0ea5e9','#10b981','#f59e0b','#e11d48','#6366f1','#0d9488','#db2777'];
export const avc = (n: string) => AVC[(n?.charCodeAt(0) ?? 0) % AVC.length];
export const ini = (n: string) => (n || 'U').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

export function newManualKey() { return `m_${Date.now()}_${Math.random().toString(36).slice(2)}`; }
export function newTeamKey()   { return `t_${Date.now()}_${Math.random().toString(36).slice(2)}`; }
export function emptyManual(u = ''): ManualActivity {
  return { _key: newManualKey(), category: 'Internal', project_name: '', address: '', description: '', sales_name: '', sales_division: '', pic_name: '', pic_phone: '', submitted_by: u };
}
export function emptyTeamEntry(m: TeamUser): TeamEntry {
  return { _key: newTeamKey(), member_user_id: m.id, member_name: m.full_name, category: 'Internal', project_name: '', address: '', sales_name: '', sales_division: m.sales_division ?? '', supervisor_notes: '' };
}

// PageWrapper
export function PW({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen overflow-hidden flex flex-col relative" style={{
      background: 'var(--latar-halaman)',
      backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed',
    }}>

      {/* TANPA z-index — disengaja. `relative z-10` di sini dulu membentuk
          stacking context, sehingga z-index SEMUA modal di dalamnya cuma
          dibandingkan sesama isi pembungkus ini, bukan dengan overlay yang
          di-portal ke <body>. Akibatnya modal z-[1100] bisa tampil DI BELAKANG
          modal z-[1000] yang di-portal. Urutan cat terhadap tint di atas tetap
          aman karena elemen ini datang belakangan di DOM. */}
      <div className="relative flex flex-col flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

// Category picker
export function CatPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {DAILY_REPORT_CATEGORIES.map(cat => {
        const c = CATEGORY_CONFIG[cat]; const sel = value === cat;
        return (
          <button key={cat} type="button" onClick={() => onChange(cat)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-left transition-all"
            style={sel ? { borderColor: c.accent, background: c.bg, color: c.color } : { borderColor: 'rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.5)', color: '#64748b' }}>
            <span className="text-lg"><Ikon nama={c.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /></span>
            <span className="text-xs font-bold leading-tight flex-1">{cat}</span>
            {sel && <svg aria-hidden="true" focusable="false" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
          </button>
        );
      })}
    </div>
  );
}

// Sales Dropdown
export function SalesDrop({ value, division, guests, onChange }: { value: string; division: string; guests: GuestUser[]; onChange: (n: string, d: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const fil = guests.filter(u => !q.trim() || u.full_name.toLowerCase().includes(q.toLowerCase()) || (u.sales_division ?? '').toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="relative">
      <div className="w-full rounded-xl px-4 py-3 text-sm flex items-center justify-between cursor-pointer"
        style={{ ...inp, borderColor: open ? 'rgba(220,38,38,0.5)' : 'rgba(0,0,0,0.12)' }}
        onClick={() => { setOpen(o => !o); if (!open) setQ(''); }}>
        {value ? <span className="font-semibold text-slate-800">{value}{division && <span className="font-normal text-red-600"> · {division}</span>}</span> : <span className="text-slate-500">-- Pilih Sales --</span>}
        <svg aria-hidden="true" focusable="false" className={`w-4 h-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </div>
      {open && (
        <>
          <div className="absolute z-50 mt-1 w-full rounded-xl shadow-xl overflow-hidden" style={{ background: 'white', border: '1.5px solid rgba(220,38,38,0.25)', maxHeight: '240px' }}>
            <div className="p-2 border-b" style={{ borderColor: 'rgba(220,38,38,0.1)' }}>
              <input aria-label="Cari sales..." autoFocus type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Cari sales..." onClick={e => e.stopPropagation()}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.15)', color: '#1e293b' }} />
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: '180px' }}>
              <div className="px-4 py-2.5 text-sm cursor-pointer hover:bg-red-50 text-slate-500 italic" {...bisaDiklik(() => { onChange('', ''); setOpen(false); })}>-- Kosongkan --</div>
              {fil.map(u => (
                <div key={u.id} className="px-4 py-2.5 cursor-pointer flex items-center justify-between"
                  style={{ background: value === u.full_name ? 'rgba(220,38,38,0.07)' : undefined, borderLeft: value === u.full_name ? '3px solid #dc2626' : '3px solid transparent' }}
                  onClick={() => { onChange(u.full_name, u.sales_division ?? ''); setOpen(false); setQ(''); }}>
                  <div><p className="text-sm font-semibold text-slate-800">{u.full_name}</p><p className="text-xs text-red-600">{u.sales_division}</p></div>
                  {value === u.full_name && <span className="text-red-500 text-xs">✓</span>}
                </div>
              ))}
            </div>
          </div>
          <div aria-hidden="true" className="fixed inset-0 z-40" onClick={() => { setOpen(false); setQ(''); }} />
        </>
      )}
    </div>
  );
}

// Toast bersama (components/shared/Toast) - satu gaya untuk seluruh platform.
export function Toast({ t }: { t: { type: 'success' | 'error'; msg: string } | null }) {
  return <ToastBersama notif={t} />;
}

/** Satu baris daftar gabungan (aktivitas otomatis, manual & entri tim). */
export interface FlatRow {
  id: string;
  source: 'reminder' | 'ticket' | 'manual';
  report_date: string;
  project_name: string;
  address: string;
  product: string;
  category: string;
  kegiatan_icon: string;
  kegiatan_label: string;
  sales_name: string;
  sales_division: string;
  handler_name: string;
  handler_username: string;
  status: string;
  jam: string;
  report_id?: string;
  manual_index?: number;
  raw?: any;
}
