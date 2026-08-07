'use client';

import { MiniPieChart } from '@/components/shared';
import {
  ProjectDetail, STATUS_CONFIG, COMPONENT_STATE_CONFIG, SEVERITY_CONFIG,
  STATUS_PIE_COLOR, THEME, averageProgress, componentsOf, ProjectStatus,
  computeProgress, stateBreakdown,
} from './shared';

/**
 * Tampilan detail progres 1 proyek — MURNI display, tanpa aksi tulis.
 * Dipakai dua tempat:
 *   1. Modal detail di halaman Project Progress (in-app)
 *   2. Halaman share view-only publik
 * Karena dipakai publik, komponen ini tidak boleh menyentuh session/supabase.
 */
export function ProjectDetailView({ detail }: { detail: ProjectDetail }) {
  const { project, locations, components, issues } = detail;
  const sortedLoc = [...locations].sort((a, b) => a.sort_order - b.sort_order);
  const avg = averageProgress(sortedLoc);
  const blocked = sortedLoc.filter(l => l.status === 'blocked');

  // Distribusi status lokasi untuk pie chart
  const pieData = (['done', 'in_progress', 'blocked'] as ProjectStatus[])
    .map(s => ({
      label: STATUS_CONFIG[s].label,
      value: sortedLoc.filter(l => l.status === s).length,
      color: STATUS_PIE_COLOR[s],
    }))
    .filter(d => d.value > 0);

  return (
    <div className="flex flex-col gap-5">

      {/* ── Kartu statistik ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total Lokasi" value={String(sortedLoc.length)} unit="site" accent={THEME.color}
          sub={sortedLoc.map(l => l.name).join(', ') || '—'}
        />
        <StatCard
          label="Rata-rata Progres" value={`${avg}%`} unit="selesai" accent="#10b981"
          sub="Berdasarkan progres seluruh lokasi"
        />
        <StatCard
          label="Isu Terbuka" value={String(issues.length)} unit="issue" accent="#f59e0b"
          sub="Lihat rekap isu di bawah"
        />
        <StatCard
          label="Butuh Perhatian" value={String(blocked.length)} unit="site" accent="#f43f5e"
          sub={blocked.map(l => l.name).join(', ') || 'Tidak ada'}
        />
      </div>

      {/* ── Progres keseluruhan + pie ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 rounded-2xl p-5 flex flex-col justify-center gap-3"
          style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(255,255,255,0.8)' }}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-widest">
              Progres Keseluruhan — Semua Lokasi
            </p>
            <span className="text-2xl font-black" style={{ color: THEME.color }}>{avg}%</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden bg-gray-200">
            <div className="h-full rounded-full transition-all"
              style={{ width: `${avg}%`, background: THEME.gradient }} />
          </div>
        </div>
        <MiniPieChart data={pieData} title="Distribusi Status Lokasi" icon="📍" />
      </div>

      {/* ── Status per lokasi ── */}
      <div className="flex flex-col gap-3">
        <SectionLabel>Status Per Lokasi</SectionLabel>
        {sortedLoc.length === 0 ? (
          <div className="rounded-2xl p-8 text-center text-sm text-gray-400 font-medium"
            style={{ background: 'rgba(255,255,255,0.9)', border: '1px dashed #cbd5e1' }}>
            Belum ada lokasi pada proyek ini.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {sortedLoc.map(loc => {
              const cfg = STATUS_CONFIG[loc.status] ?? STATUS_CONFIG.in_progress;
              const comps = componentsOf(components, loc.id);
              return (
                <div key={loc.id} className="rounded-2xl p-4 flex flex-col gap-3"
                  style={{ background: 'rgba(255,255,255,0.96)', border: '1px solid rgba(255,255,255,0.8)', boxShadow: '0 2px 10px rgba(15,23,42,0.05)' }}>

                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-gray-800 truncate">{loc.name}</p>
                      {loc.pic && <p className="text-[11px] text-gray-500 font-medium">PIC: {loc.pic}</p>}
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold flex-shrink-0"
                      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                      {cfg.label}
                    </span>
                  </div>

                  {/* Progres dihitung dari komposisi status komponen, bukan input manual */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-gray-500">
                        Progres komponen <span className="text-gray-400">({comps.length})</span>
                      </span>
                      <span className="text-[11px] font-black" style={{ color: THEME.color }}>
                        {computeProgress(comps)}%
                      </span>
                    </div>
                    {/* Bar tersegmen: proporsi tiap status terlihat langsung */}
                    <div className="h-2 rounded-full overflow-hidden bg-gray-200 flex">
                      {stateBreakdown(comps).filter(b => b.count > 0).map(b => (
                        <div key={b.state} style={{ width: `${b.percent}%`, background: b.color }}
                          title={`${b.label}: ${b.count} (${b.percent}%)`} />
                      ))}
                    </div>
                    {comps.length > 0 && (
                      <div className="flex flex-wrap gap-x-2.5 gap-y-1 pt-0.5">
                        {stateBreakdown(comps).map(b => (
                          <span key={b.state} className="flex items-center gap-1 text-[10px] font-bold"
                            style={{ color: b.count > 0 ? b.color : '#cbd5e1' }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: b.count > 0 ? b.color : '#e2e8f0' }} />
                            {b.label} {b.percent}%
                            <span className="font-semibold text-gray-400">({b.count})</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {comps.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      {comps.map(c => {
                        const sc = COMPONENT_STATE_CONFIG[c.state] ?? COMPONENT_STATE_CONFIG.pending;
                        return (
                          <div key={c.id} className="flex items-start gap-2">
                            <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: sc.dot }} />
                            <span className="text-[11px] font-semibold leading-snug flex-1" style={{ color: sc.text }}>{c.label}</span>
                            <span className="text-[9px] font-bold flex-shrink-0 mt-0.5" style={{ color: sc.dot }}>{sc.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {loc.note && (
                    <div className="rounded-xl px-3 py-2 text-[11px] font-medium leading-snug"
                      style={{
                        background: loc.note_flag ? '#fff1f2' : '#f8fafc',
                        borderLeft: `3px solid ${loc.note_flag ? '#f43f5e' : '#cbd5e1'}`,
                        color: loc.note_flag ? '#9f1239' : '#475569',
                      }}>
                      {loc.note}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Rekap isu terbuka ── */}
      <div className="flex flex-col gap-3">
        <SectionLabel>Rekap Isu Terbuka</SectionLabel>
        <div className="rounded-2xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.96)', border: '1px solid rgba(255,255,255,0.8)' }}>
          {issues.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-400 font-medium">Tidak ada isu terbuka. 🎉</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[640px]">
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Lokasi', 'Isu', 'Severity', 'Keterangan'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-200">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...issues].sort((a, b) => a.sort_order - b.sort_order).map(is => {
                    const sv = SEVERITY_CONFIG[is.severity] ?? SEVERITY_CONFIG.sedang;
                    return (
                      <tr key={is.id} className="border-b border-gray-100 last:border-0">
                        <td className="px-4 py-3 text-[11px] font-bold text-gray-700 align-top">{is.location_label ?? '—'}</td>
                        <td className="px-4 py-3 text-[11px] font-semibold text-gray-600 align-top">{is.issue}</td>
                        <td className="px-4 py-3 align-top">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
                            style={{ background: sv.bg, color: sv.color, border: `1px solid ${sv.border}` }}>
                            {sv.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[11px] font-medium text-gray-500 align-top">{is.note ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {project.description && (
        <p className="text-[11px] text-gray-600 font-medium leading-relaxed rounded-xl px-4 py-3"
          style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(255,255,255,0.8)' }}>
          {project.description}
        </p>
      )}
    </div>
  );
}

/**
 * Label seksi selalu diberi latar sendiri. Tanpa ini, teks abu-abu jatuh
 * langsung di atas foto latar dan praktis tidak terbaca.
 */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="self-start px-3 py-1.5 rounded-lg text-xs font-bold text-gray-600 uppercase tracking-widest"
      style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)' }}>
      {children}
    </span>
  );
}

function StatCard({ label, value, unit, sub, accent }: {
  label: string; value: string; unit: string; sub: string; accent: string;
}) {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-1"
      style={{ background: 'rgba(255,255,255,0.95)', borderLeft: `4px solid ${accent}`, border: '1px solid rgba(255,255,255,0.8)', borderLeftWidth: 4, borderLeftColor: accent }}>
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{label}</p>
      <p className="text-2xl font-black text-gray-800 leading-none">
        {value} <span className="text-[11px] font-bold text-gray-400">{unit}</span>
      </p>
      <p className="text-[10px] text-gray-500 font-medium line-clamp-2 leading-snug">{sub}</p>
    </div>
  );
}
