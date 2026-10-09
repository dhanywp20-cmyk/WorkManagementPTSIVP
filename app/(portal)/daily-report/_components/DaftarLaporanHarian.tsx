'use client';

/** DaftarLaporanHarian - dipecah dari app/(portal)/daily-report/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { ListEmptyState } from '@/components/shared';
import { CATEGORY_CONFIG } from '@/app/(portal)/reminder-schedule/_components/shared';
import { TH, TD, SB, sb, avc, ini } from './bantu-halaman';
import { Ikon } from '@/components/shared/Ikon';
import { type CSSProperties } from 'react';
import { Paginasi } from '@/components/shared';
import { type DailyReport } from './shared';
import type { FlatRow } from './bantu-halaman';

export interface DaftarLaporanHarianProps {
  bolehHapus: (row: any) => boolean;
  filterCategory: string | null;
  filterDate: string;
  filterSource: string;
  filterStatus: string;
  filterUser: string;
  filteredRows: FlatRow[];
  hal: import("@/components/shared/Paginasi").HasilPaginasi<FlatRow>;
  liveLoading: boolean;
  mintaHapus: (row: any) => void;
  openEditForm: (report: DailyReport) => Promise<void>;
  pimpinan: boolean;
  reports: DailyReport[];
  searchProject: string;
  setFilterCategory: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setFilterDate: import("react").Dispatch<import("react").SetStateAction<string>>;
  setFilterSource: import("react").Dispatch<import("react").SetStateAction<string>>;
  setFilterStatus: import("react").Dispatch<import("react").SetStateAction<string>>;
  setFilterUser: import("react").Dispatch<import("react").SetStateAction<string>>;
  setModalRow: import("react").Dispatch<any>;
  setSearchProject: import("react").Dispatch<import("react").SetStateAction<string>>;
}

export function DaftarLaporanHarian({ bolehHapus, filterCategory, filterDate, filterSource, filterStatus, filterUser, filteredRows, hal, liveLoading, mintaHapus, openEditForm, pimpinan, reports, searchProject, setFilterCategory, setFilterDate, setFilterSource, setFilterStatus, setFilterUser, setModalRow, setSearchProject }: DaftarLaporanHarianProps) {
  return (
    <>
      {liveLoading && filteredRows.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-slate-500 gap-3">
          <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
          <span className="text-sm">Memuat aktivitas dari semua platform...</span>
        </div>
      ) : filteredRows.length === 0 ? (
        <ListEmptyState
          adaFilterAktif={
            filterDate !== '' || filterUser !== '' || filterStatus !== '' ||
            filterSource !== '' || searchProject.trim() !== '' || filterCategory !== null
          }
          onReset={() => {
            setFilterDate(''); setFilterUser(''); setFilterStatus('');
            setFilterSource(''); setSearchProject(''); setFilterCategory(null);
          }}
          icon="📋"
          judulKosong="Belum ada aktivitas"
          deskripsiKosong="Data reminder & ticket akan muncul otomatis di sini."
        />
      ) : (
        <>
        {/* M8 (docs/UX-WORKFLOW-AUDIT.md): dulu tabel ini (9 kolom, minWidth
            1200px) tidak punya varian mobile sama sekali - beda dari Picket
            Showroom & Project Progress yang sudah punya kartu md:hidden.
            Anggota tim yang isi Daily Report dari HP harus scroll horizontal
            pada tabel lebar untuk cek riwayat. Tap kartu membuka modal
            detail yang sama dengan klik baris tabel (termasuk tombol Edit). */}
        <div className="md:hidden space-y-2">
          {hal.potongan.map(row => {
            const c = CATEGORY_CONFIG[row.category] ?? CATEGORY_CONFIG['Internal'];
            const badge = row.source === 'manual' ? SB.manual : sb(row.status);
            return (
              <div key={row.id}
                className="rounded-2xl p-3.5 flex flex-col gap-2"
                style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.07)' }}>
                <button type="button" onClick={() => setModalRow(row)}
                  className="w-full text-left flex flex-col gap-2 transition-all active:scale-[0.99]">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-800 text-sm leading-tight truncate">{row.project_name}</p>
                    {row.address && <p className="text-[11px] text-slate-500 mt-0.5 truncate"><Ikon nama="📍" ukuran="1em" className="inline-block align-[-0.12em]" /> {row.address}</p>}
                  </div>
                  <span className="flex-shrink-0 inline-flex items-center px-2 py-1 rounded-lg text-[11px] font-bold"
                    style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                    {badge.label}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold"
                    style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
                    {row.kegiatan_icon} {row.source === 'ticket' ? 'Troubleshooting' : row.category}
                  </span>
                  {row.product && <span className="text-[11px] font-semibold text-violet-700 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-lg">{row.product}</span>}
                </div>
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{ background: avc(row.handler_name) }}>{ini(row.handler_name)}</div>
                    <span className="text-xs font-semibold text-slate-700 truncate">{row.handler_name || '—'}</span>
                  </div>
                  <span className="text-[11px] text-slate-500 flex-shrink-0">
                    {row.report_date ? new Date(row.report_date + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : '—'}
                    {row.jam !== '-' ? ` · ${row.jam}` : ''}
                  </span>
                </div>
                </button>

                {/*  Tombol aksi yang sama dengan kolom ACTION tabel desktop.
                    Sebelumnya kartu HP HANYA bisa di-tap untuk membuka
                    detail: Edit cuma ada setelah masuk modal, jadi dari HP
                    terlihat seperti tidak ada sama sekali. Dibungkus <span>
                    (bukan <button>) karena kartunya sendiri sudah sebuah
                    tombol - tombol di dalam tombol bukan HTML yang sah. */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button type="button" aria-label="Lihat detail" onClick={() => setModalRow(row)}
                    className="inline-flex items-center justify-center w-[40px] h-[40px] rounded-xl border border-gray-200 bg-white text-gray-500 active:bg-gray-100">
                    <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  </button>
                  {row.report_id && !pimpinan && (
                    <button type="button" aria-label="Edit report"
                      onClick={() => { const r = reports.find(x => x.id === row.report_id); if (r) openEditForm(r); }}
                      className="inline-flex items-center justify-center w-[40px] h-[40px] rounded-xl text-white active:opacity-90"
                      style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
                      <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                  )}
                  {bolehHapus(row) && (
                    <button type="button" aria-label="Hapus aktivitas" onClick={() => mintaHapus(row)}
                      className="inline-flex items-center justify-center w-[40px] h-[40px] rounded-xl border border-red-200 bg-white text-red-500 active:bg-red-50">
                      <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="hidden md:block overflow-x-auto bg-slate-100/60 px-3 pb-2">
          <table className="tabel-kartu" style={{ width: '100%', minWidth: '1200px', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '44px' }} />
                <col style={{ width: '230px' }} />
                <col style={{ width: '170px' }} />
                <col style={{ width: '190px' }} />
                <col style={{ width: '130px' }} />
                <col style={{ width: '150px' }} />
                <col style={{ width: '100px' }} />
                <col style={{ width: '95px' }} />
                <col style={{ width: '80px' }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ ...TH, width: '40px', textAlign: 'center' as const }}>NO</th>
                  <th style={TH}>PROJECT</th>
                  <th style={TH}>PRODUCT</th>
                  <th style={TH}>KEGIATAN</th>
                  <th style={TH}>SALES</th>
                  <th style={TH}>HANDLER</th>
                  <th style={TH}>STATUS</th>
                  <th style={TH}>TANGGAL</th>
                  <th style={{ ...TH, textAlign: 'center' as const }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
              {hal.potongan.map((row, i) => {
                const c = CATEGORY_CONFIG[row.category] ?? CATEGORY_CONFIG['Internal'];
                const badge = row.source === 'manual' ? SB.manual : sb(row.status);
                return (
                  <tr key={row.id} className="cursor-pointer"
                    style={{ '--aksen-baris': '#f87171', '--bg-baris-sorot': '#fff5f5' } as CSSProperties}
                    onClick={() => setModalRow(row)}>
                    <td style={{ ...TD, textAlign: 'center' as const, color: '#94a3b8', fontSize: '12px' }}>{hal.mulai + i + 1}</td>
                    <td style={TD}>
                      <p className="font-semibold text-slate-800 text-sm leading-tight truncate" title={row.project_name}>{row.project_name}</p>
                      {row.address && <p className="text-[11px] text-slate-500 mt-0.5 truncate" title={row.address}><Ikon nama="📍" ukuran="1em" className="inline-block align-[-0.12em]" /> {row.address}</p>}
                    </td>
                    <td style={TD}>
                      {row.product
                        ? <span className="text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 px-2 py-1 rounded-lg">{row.product}</span>
                        : <span className="text-slate-400 text-xs">—</span>}
                    </td>
                    <td style={TD}>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold"
                        style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
                        {row.kegiatan_icon} {row.source === 'ticket' ? 'Troubleshooting' : row.category}
                      </span>
                      {row.source === 'ticket' && <p className="text-[11px] text-slate-500 mt-0.5">{row.kegiatan_label}</p>}
                      <p className="mt-1">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                          style={
                            row.source === 'ticket'
                              ? { background: 'rgba(251,113,133,0.12)', color: '#be185d' }
                              : row.source === 'reminder'
                              ? { background: 'rgba(16,185,129,0.1)', color: '#047857' }
                              : { background: 'rgba(245,158,11,0.1)', color: '#b45309' }
                          }>
                          {row.source === 'ticket' ? '🎫 Ticketing' : row.source === 'reminder' ? '🔔 Schedule' : '✍️ Manual'}
                        </span>
                      </p>
                    </td>
                    <td style={TD}>
                      {row.sales_name
                        ? <div><p className="text-xs font-semibold text-slate-700">{row.sales_name}</p>{row.sales_division && <p className="text-[11px] text-slate-500">{row.sales_division}</p>}</div>
                        : <span className="text-slate-400">—</span>}
                    </td>
                    <td style={TD}>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0" style={{ background: avc(row.handler_name) }}>{ini(row.handler_name)}</div>
                        <span className="text-xs font-semibold text-slate-700">{row.handler_name || '—'}</span>
                      </div>
                    </td>
                    <td style={TD}>
                      {/* Gaya highlight, bukan pil - sudut tegas & tanpa garis tepi. */}
                      <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-bold"
                        style={{ background: badge.bg, color: badge.color }}>
                        {badge.label}
                      </span>
                    </td>
                    <td style={TD}>
                      <div className="rounded-xl text-center px-2.5 py-2 inline-flex flex-col items-center" style={{ background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.15)', minWidth: '64px' }}>
                        <span className="text-base font-black text-red-600 leading-none">{row.report_date?.split('-')[2] ?? '—'}</span>
                        <span className="text-[10px] font-bold text-red-600 uppercase">
                          {row.report_date ? new Date(row.report_date + 'T00:00:00').toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }).toUpperCase() : '—'}
                        </span>
                        {row.jam !== '-' && <span className="text-[10px] text-slate-500 mt-0.5">{row.jam}</span>}
                      </div>
                    </td>
                    <td style={{ ...TD, textAlign: 'center' as const }} onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5">
                        <button aria-label="Lihat" onClick={() => setModalRow(row)}
                          className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-500 transition-all" title="Lihat">
                          <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </button>
                        {row.report_id && !pimpinan && (
                          <button aria-label="Edit Report" onClick={() => { const r = reports.find(x => x.id === row.report_id); if (r) openEditForm(r); }}
                            className="p-1.5 rounded-lg text-white transition-all" style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }} title="Edit Report">
                            <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                        )}
                        {bolehHapus(row) && (
                          <button aria-label="Hapus Aktivitas" onClick={() => mintaHapus(row)}
                            className="p-1.5 rounded-lg border border-red-200 bg-white text-red-500 hover:bg-red-50 transition-all" title="Hapus Aktivitas">
                            <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Paginasi {...hal} satuan="aktivitas" />
        </>
      )}
    </>
  );
}
