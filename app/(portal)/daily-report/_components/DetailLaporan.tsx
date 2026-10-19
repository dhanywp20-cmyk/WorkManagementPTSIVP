'use client';

/** DetailLaporan - dipecah dari app/(portal)/daily-report/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { Ikon } from '@/components/shared/Ikon';
import { avc, ini, type FlatRow } from './bantu-halaman';
import { Username } from '@/components/shared';
import { formatDate } from '@/app/(portal)/reminder-schedule/_components/shared';
import { type DailyReport } from './shared';

export interface DetailLaporanProps {
  badge: { label: string; bg: string; color: string; border: string; };
  c: { icon: string; color: string; bg: string; border: string; accent: string; };
  linkedReport: DailyReport | undefined;
  openEditForm: (report: DailyReport) => Promise<void>;
  openNewForm: () => Promise<void>;
  pimpinan: boolean;
  reports: DailyReport[];
  row: FlatRow;
  setModalRow: import("react").Dispatch<any>;
}

export function DetailLaporan({ badge, c, linkedReport, openEditForm, openNewForm, pimpinan, reports, row, setModalRow }: DetailLaporanProps) {
  return (
    <>
      <div role="dialog" aria-modal="true" className="fixed inset-0 z-1000 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }} onClick={() => setModalRow(null)}>
        <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ background: 'white', maxHeight: '96vh' }} onClick={e => e.stopPropagation()}>
          {/* Colored header */}
          <div className="px-6 py-5 text-white shrink-0 relative" style={{ background: `linear-gradient(135deg, ${c.accent}, ${c.accent}cc)` }}>
            <div className="flex items-start gap-3">
              <span className="text-3xl">{row.kegiatan_icon}</span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/55 mb-0.5">Sumber</p>
                <p className="text-[11px] font-bold uppercase tracking-widest opacity-80">
                  {row.source === 'reminder' ? 'Reminder Schedule' : row.source === 'ticket' ? 'Ticket Troubleshooting' : 'Aktivitas Manual'}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/55 mt-2 mb-0.5">Nama Project</p>
                <h3 className="text-base font-black leading-tight">{row.project_name}</h3>
                {row.address && (
                  <>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/55 mt-1.5 mb-0.5">Lokasi</p>
                    <p className="text-xs opacity-80 flex items-center gap-1"><Ikon nama="📍" ukuran="1em" className="inline-block align-[-0.12em]" /> {row.address}</p>
                  </>
                )}
              </div>
            </div>
            {/* Status + jam */}
            <div className="flex items-center gap-2 mt-4">
              <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-white/20">{badge.label}</span>
              {row.jam !== '-' && <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-white/20"><Ikon nama="🕐" ukuran="1em" className="inline-block align-[-0.12em]" /> {row.jam}</span>}
              <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-white/20"><Ikon nama="📅" ukuran="1em" className="inline-block align-[-0.12em]" /> {row.report_date}</span>
            </div>
            <button aria-label="Tutup" onClick={() => setModalRow(null)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/20 hover:bg-black/35 text-white flex items-center justify-center font-bold text-sm">✕</button>
          </div>
          {/* Body */}
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1 min-h-0">
            <div className="grid grid-cols-2 gap-4">
              {/* Kategori */}
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Kategori</p>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold" style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
                  <Ikon nama={c.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /> {row.category}
                </span>
              </div>
              {/* Product */}
              {row.product && (
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Product</p>
                  <span className="text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 px-2.5 py-1.5 rounded-lg inline-block">{row.product}</span>
                </div>
              )}
              {/* Handler */}
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Handler</p>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0" style={{ background: avc(row.handler_name) }}>{ini(row.handler_name)}</div>
                  <div><p className="text-xs font-bold text-slate-800">{row.handler_name}</p>{row.handler_username && <p className="text-[11px] text-slate-500"><Username value={row.handler_username} /></p>}</div>
                </div>
              </div>
              {/* Sales */}
              {row.sales_name && (
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Sales</p>
                  <p className="text-xs font-bold text-slate-800">{row.sales_name}</p>
                  {row.sales_division && <p className="text-[11px] text-slate-500">{row.sales_division}</p>}
                </div>
              )}
            </div>
            {/* Ringkasan hari dari laporan induknya (bila diisi) */}
            {(() => {
              const ringkas = reports.find(r => r.id === row.report_id)?.reminder_notes?.trim();
              return ringkas ? (
                <div className="px-4 py-3 rounded-xl bg-blue-50 border border-blue-100">
                  <p className="text-[11px] font-bold text-blue-800 uppercase tracking-wider mb-1">Ringkasan hari ini</p>
                  <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">{ringkas}</p>
                </div>
              ) : null;
            })()}
            {/* Ticket detail */}
            {row.source === 'ticket' && row.raw?.action_taken && (
              <div className="px-4 py-3 rounded-xl" style={{ background: 'rgba(251,113,133,0.05)', border: '1px solid rgba(251,113,133,0.2)' }}>
                <p className="text-[11px] font-bold text-rose-500 uppercase tracking-wider mb-1">Tindakan</p>
                <p className="text-xs text-slate-700">{row.raw.action_taken}</p>
              </div>
            )}
            {/* Reminder detail */}
            {row.source === 'reminder' && row.raw?.description && (
              <div className="px-4 py-3 rounded-xl" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: c.color }}>Deskripsi</p>
                <p className="text-xs" style={{ color: c.color }}>{row.raw.description}</p>
              </div>
            )}
            {/* Manual detail */}
            {row.source === 'manual' && row.raw?.description && (
              <div className="px-4 py-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-1">Deskripsi</p>
                <p className="text-xs text-slate-700">{row.raw.description}</p>
              </div>
            )}
            {/* PIC */}
            {row.raw?.pic_name && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.07)' }}>
                <span className="text-base"><Ikon nama="🙋" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                <div><p className="text-xs font-bold text-slate-800">{row.raw.pic_name}</p>{row.raw.pic_phone && <p className="text-[11px] text-slate-500"><Ikon nama="📱" ukuran="1em" className="inline-block align-[-0.12em]" /> {row.raw.pic_phone}</p>}</div>
              </div>
            )}
            {/* Link to submitted report */}
            {linkedReport && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.15)' }}>
                <span className="text-sm"><Ikon nama="📋" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                <p className="text-xs text-red-600 font-semibold">Sudah di-submit dalam Daily Report {formatDate(linkedReport.report_date)}</p>
                {!pimpinan && <button onClick={() => { setModalRow(null); openEditForm(linkedReport); }} className="ml-auto text-[11px] font-bold px-2 py-1 rounded-lg text-white" style={{ background: '#dc2626' }}>Edit</button>}
              </div>
            )}
            {/* Source badge */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] font-bold px-2.5 py-1.5 rounded-full"
                style={row.source === 'reminder' ? { background: 'rgba(16,185,129,0.1)', color: '#047857' } : row.source === 'ticket' ? { background: 'rgba(251,113,133,0.1)', color: '#be185d' } : { background: 'rgba(245,158,11,0.1)', color: '#b45309' }}>
                {row.source === 'reminder' ? '🔔 Reminder Schedule' : row.source === 'ticket' ? '🎫 Ticket Troubleshooting' : '✍️ Aktivitas Manual'}
              </span>
              {!linkedReport && row.source !== 'manual' && (
                <button onClick={() => { setModalRow(null); openNewForm(); }} className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white" style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>+ Buat Report</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
