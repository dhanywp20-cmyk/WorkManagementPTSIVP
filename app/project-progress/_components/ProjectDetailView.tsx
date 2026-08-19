'use client';

import { MiniPieChart, AuditTrailPanel } from '@/components/shared';
import {
  ProjectDetail, STATUS_CONFIG, COMPONENT_STATE_CONFIG, SEVERITY_CONFIG,
  STATUS_PIE_COLOR, THEME, PALETTE, fontMono, averageProgress, componentsOf, ProjectStatus,
  computeProgress, stateBreakdown, picBreakdown, problemComponentBreakdown, overdueLocations,
  timelineInfo, formatDate, timelineBreakdown,
  projectHealth, locationHealth, scheduleProgress,
} from './shared';

/**
 * Tampilan detail progres 1 proyek - MURNI display, tanpa aksi tulis.
 * Dipakai dua tempat:
 *   1. Modal detail di halaman Project Progress (in-app)
 *   2. Halaman share view-only publik
 * Karena dipakai publik, komponen ini tidak boleh melakukan query supabase
 * ATAU membaca session sendiri - semua datanya, TERMASUK riwayat perubahan
 * (detail.auditTrail), harus sudah diambilkan pemanggil dan lewat props.
 * AuditTrailPanel di bawah dipakai dengan prop `data`, bukan `targetId` saja
 * - itulah yang membuatnya tidak pernah fetch sendiri di halaman ini.
 */
export function ProjectDetailView({ detail, maxKolomLokasi = 2 }: {
  detail: ProjectDetail;
  /**
   * Batas atas kolom kartu lokasi - beda konteks, beda ruang yang wajar:
   * modal in-app (2, ruangnya dibagi sidebar platform) vs halaman share
   * publik (3, jendela browser penuh). Kolomnya sendiri tetap MENYUSUT di
   * layar sempit (lihat gridTemplateColumns di bawah) - ini cuma batas ATAS.
   */
  maxKolomLokasi?: number;
}) {
  const { project, locations, components, issues } = detail;
  const sortedLoc = [...locations].sort((a, b) => a.sort_order - b.sort_order);
  const avg = averageProgress(sortedLoc);

  // Distribusi status lokasi untuk pie chart
  const pieData = (['done', 'in_progress', 'blocked'] as ProjectStatus[])
    .map(s => ({
      label: STATUS_CONFIG[s].label,
      value: sortedLoc.filter(l => l.status === s).length,
      color: STATUS_PIE_COLOR[s],
    }))
    .filter(d => d.value > 0);

  // Beban tiap PIC & jenis komponen yang paling sering menahan progres.
  const picSlices = picBreakdown(sortedLoc);
  const tl = timelineInfo(project);
  const timelineSlices = timelineBreakdown(sortedLoc);
  const problemSlices = problemComponentBreakdown(components);
  const telat = overdueLocations(sortedLoc);
  const bermasalah = components.filter(c => c.state === 'stuck' || c.state === 'pending').length;

  // Ring progres keseluruhan - lingkar r=50  keliling 2πr ≈ 314.16
  const RING_C = 314.16;
  const ringOffset = RING_C * (1 - avg / 100);

  const health = projectHealth(project, sortedLoc);
  const schedule = scheduleProgress(sortedLoc);
  const variance = schedule === null ? null : avg - schedule;
  const selesaiCount = sortedLoc.filter(l => l.status === 'done').length;

  return (
    <div className="flex flex-col gap-4">

      {/* ── Project Health + KPI ── */}
      <div className="rounded-md p-4 flex flex-col gap-3" style={{ background: PALETTE.surface, border: `1px solid ${PALETTE.border}` }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: PALETTE.inkFaint }}>
            Project Health
          </p>
          <span className="px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap"
            style={{ background: health.bg, color: health.color, border: `1px solid ${health.border}` }}
            title={health.reason}>
            {health.label} — {health.reason}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {[
            { label: 'Physical', value: `${avg}%` },
            { label: 'Schedule', value: schedule === null ? '—' : `${schedule}%` },
            {
              label: 'Variance', value: variance === null ? '—' : `${variance > 0 ? '+' : ''}${variance}%`,
              color: variance === null ? undefined : variance < 0 ? PALETTE.bad : PALETTE.good,
            },
            { label: 'Isu Terbuka', value: String(issues.length), color: issues.length > 0 ? PALETTE.warn : undefined },
            { label: 'Overtime', value: `${telat.length} site`, color: telat.length > 0 ? PALETTE.bad : undefined },
            { label: 'Lokasi Selesai', value: `${selesaiCount}/${sortedLoc.length}` },
          ].map(k => (
            <div key={k.label} className="rounded-sm px-2.5 py-2" style={{ background: PALETTE.surfaceSunken }}>
              <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: PALETTE.inkFaint }}>{k.label}</p>
              <p className="text-[15px] font-bold" style={{ ...fontMono, color: k.color ?? PALETTE.ink }}>{k.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Timeline proyek ──
          Bar "Progres Keseluruhan" dihapus: angkanya sudah tampil di ring
          progres di bawah, jadi bar itu hanya mengulang informasi yang sama.
          Yang benar-benar menambah informasi adalah perbandingan WAKTU
          terpakai vs PEKERJAAN selesai — itu yang ditampilkan di sini. */}
      {(project.start_date || project.target_date) && (
        <div className="rounded-md p-5 flex flex-col gap-3"
          style={{ background: PALETTE.surface, border: `1px solid ${PALETTE.border}` }}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: PALETTE.inkFaint }}>
              Timeline Proyek
            </p>
            <span className="px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap"
              style={{ background: tl.bg, color: tl.color }}>
              {tl.label}
            </span>
          </div>

          <span className="text-[11px] font-semibold" style={{ color: PALETTE.inkSoft }}>
            🗓️ <span style={fontMono}>{project.start_date ? formatDate(project.start_date) : '—'}</span>
            <span className="mx-1.5" style={{ color: PALETTE.borderStrong }}>→</span>
            <span style={fontMono}>{project.target_date ? formatDate(project.target_date) : '—'}</span>
            {tl.daysElapsed !== null && (
              <span className="ml-2" style={{ color: PALETTE.inkFaint }}>· berjalan <span style={fontMono}>{tl.daysElapsed}</span> hari</span>
            )}
          </span>

          {/* Dua bar sengaja ditumpuk: WAKTU vs PEKERJAAN. Kalau bar waktu
              mendahului bar pekerjaan, artinya tertinggal dari jadwal. */}
          {tl.elapsedPercent !== null && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: PALETTE.inkFaint }}>Waktu Terpakai</span>
                  <span className="text-[10px] font-bold" style={{ ...fontMono, color: tl.color }}>{tl.elapsedPercent}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: PALETTE.surfaceSunken }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${tl.elapsedPercent}%`, background: PALETTE.inkFaint, opacity: 0.4 }} />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: PALETTE.inkFaint }}>Pekerjaan Selesai</span>
                  <span className="text-[10px] font-bold" style={{ ...fontMono, color: THEME.color }}>{avg}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: PALETTE.surfaceSunken }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${avg}%`, background: THEME.color }} />
                </div>
              </div>
              <p className="text-[10px] font-bold" style={{ color: avg >= tl.elapsedPercent ? PALETTE.good : PALETTE.warn }}>
                {avg >= tl.elapsedPercent
                  ? `✓ Sesuai jadwal — pekerjaan ${avg - tl.elapsedPercent}% di depan waktu terpakai`
                  : `⚠ Tertinggal ${tl.elapsedPercent - avg}% dari jadwal`}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Empat pie: status lokasi, jadwal, beban PIC, komponen bermasalah ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2.5">
        <MiniPieChart data={pieData} title="Distribusi Status Lokasi" icon="📍" />
        <MiniPieChart data={picSlices} title="Progres per PIC Team" icon="👷"
          centerValue={`${avg}%`} centerLabel="RATA-RATA" valueSuffix="%" />
        <MiniPieChart data={timelineSlices} title="Status Jadwal Lokasi" icon="🗓️" />
        <MiniPieChart data={problemSlices} title="Komponen Stuck & Pending" icon="⚠️" />
      </div>

      {/* ── Rail metrik (ring + angka kunci) + daftar lokasi ── */}
      <SectionLabel>Status Per Lokasi</SectionLabel>
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-3 items-start">
        <div className="flex flex-col gap-3 lg:sticky lg:top-3">
          <div className="rounded-md p-4" style={{ background: PALETTE.surface, border: `1px solid ${PALETTE.border}` }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: PALETTE.inkFaint }}>
              Progres Keseluruhan
            </p>
            <div className="flex flex-col items-center gap-0.5">
              <svg aria-hidden="true" focusable="false" width="112" height="112" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke={PALETTE.surfaceSunken} strokeWidth="10" />
                <circle cx="60" cy="60" r="50" fill="none" stroke={THEME.color} strokeWidth="10"
                  strokeLinecap="round" strokeDasharray={RING_C} strokeDashoffset={ringOffset}
                  transform="rotate(-90 60 60)" />
                <text x="60" y="56" textAnchor="middle" fontFamily="var(--font-plex-mono)" fontSize="24" fontWeight="600" fill={PALETTE.ink}>{avg}%</text>
                <text x="60" y="72" textAnchor="middle" fontFamily="var(--font-plex-sans)" fontSize="9" fill={PALETTE.inkFaint}>{components.length} KOMPONEN</text>
              </svg>
            </div>
          </div>
          <div className="rounded-md p-4 flex flex-col" style={{ background: PALETTE.surface, border: `1px solid ${PALETTE.border}` }}>
            {[
              { label: 'Total lokasi', value: `${sortedLoc.length} site` },
              { label: 'Isu terbuka', value: String(issues.length), warn: issues.length > 0 },
              { label: 'Komponen bermasalah', value: String(bermasalah), warn: bermasalah > 0 },
              { label: 'Lewat target', value: `${telat.length} site`, bad: telat.length > 0 },
            ].map((s, i, arr) => (
              <div key={s.label} className="flex items-center justify-between gap-2 py-2"
                style={{ borderBottom: i < arr.length - 1 ? `1px solid ${PALETTE.border}` : 'none' }}>
                <span className="text-[11px] font-medium" style={{ color: PALETTE.inkSoft }}>{s.label}</span>
                <span className="text-[13px] font-bold" style={{ ...fontMono, color: s.bad ? PALETTE.bad : s.warn ? PALETTE.warn : PALETTE.ink }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Status per lokasi — kolom menyesuaikan LEBAR WADAHNYA sendiri
            (bukan breakpoint layar tetap), supaya otomatis benar di layar
            sempit/mobile (turun ke 1 kolom) TANPA perlu tahu konteksnya.
            Batas ATAS-nya (maxKolomLokasi) beda per pemanggil — lihat
            komentar prop di atas. */}
        <div
          className={sortedLoc.length > 1 ? 'grid gap-2.5 items-start' : 'flex flex-col gap-2.5'}
          style={sortedLoc.length > 1
            ? { gridTemplateColumns: `repeat(auto-fit, minmax(340px, calc(${Math.round(100 / maxKolomLokasi)}% - 8px)))` }
            : undefined}>
          {sortedLoc.length === 0 ? (
            <div className="rounded-md p-8 text-center text-sm font-medium"
              style={{ background: PALETTE.surface, border: `1px dashed ${PALETTE.borderStrong}`, color: PALETTE.inkFaint }}>
              Belum ada lokasi pada proyek ini.
            </div>
          ) : sortedLoc.map(loc => {
            const locHealth = locationHealth(loc);
            const comps = componentsOf(components, loc.id);
            return (
              <div key={loc.id} className="rounded-md overflow-hidden"
                style={{ background: PALETTE.surface, border: `1px solid ${PALETTE.border}` }}>

                <div className="flex items-start justify-between gap-3 px-4 pt-3.5">
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-bold" style={{ color: PALETTE.ink }}>{loc.name}</p>
                    <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 mt-0.5 text-[11px]" style={{ color: PALETTE.inkFaint }}>
                      {loc.pic && <span>PIC <b style={{ color: PALETTE.inkSoft, fontWeight: 600 }}>{loc.pic}</b></span>}
                      {loc.sales_name && (
                        <span>Sales <b style={{ color: PALETTE.inkSoft, fontWeight: 600 }}>{loc.sales_name}</b>{loc.sales_division ? ` · ${loc.sales_division}` : ''}</span>
                      )}
                      {(loc.start_date || loc.target_date) && (() => {
                        const lt = timelineInfo(loc);
                        return (
                          <span style={{ color: lt.color, fontWeight: 600 }}>
                            <span style={fontMono}>{loc.start_date ? formatDate(loc.start_date) : '—'} → {loc.target_date ? formatDate(loc.target_date) : '—'}</span>
                            {' '}({lt.label})
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold flex-shrink-0" title={locHealth.reason}
                    style={{ background: locHealth.bg, color: locHealth.color, border: `1px solid ${locHealth.border}` }}>
                    {locHealth.label}
                  </span>
                </div>

                <div className="px-4 pb-3.5 flex flex-col gap-2.5">
                  {/* Progres dihitung dari komposisi status komponen, bukan input manual */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold" style={{ color: PALETTE.inkFaint }}>
                        Progres komponen ({comps.length})
                      </span>
                      <span className="text-[11px] font-bold" style={{ ...fontMono, color: THEME.color }}>
                        {computeProgress(comps)}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden flex" style={{ background: PALETTE.surfaceSunken }}>
                      {stateBreakdown(comps).filter(b => b.count > 0).map(b => (
                        <div key={b.state} style={{ width: `${b.percent}%`, background: b.color }}
                          title={`${b.label}: ${b.count} (${b.percent}%)`} />
                      ))}
                    </div>
                  </div>

                  {comps.length > 0 && (
                    <div className="rounded-sm overflow-hidden" style={{ border: `1px solid ${PALETTE.border}` }}>
                      {comps.map((c, i) => {
                        const sc = COMPONENT_STATE_CONFIG[c.state] ?? COMPONENT_STATE_CONFIG.pending;
                        // Stuck/pending disorot kuning penuh sebaris - supaya
                        // komponen bermasalah langsung kelihatan sekilas mata
                        // di tengah daftar panjang, bukan cuma lewat teks kecil.
                        const bermasalah = c.state === 'stuck' || c.state === 'pending';
                        return (
                          <div key={c.id} style={{
                            borderTop: i > 0 ? `1px solid ${PALETTE.border}` : 'none',
                            background: bermasalah ? PALETTE.highlight : PALETTE.surface,
                            borderLeft: bermasalah ? `3px solid ${PALETTE.highlightBorder}` : '3px solid transparent',
                          }}>
                            <div className="flex items-center gap-2.5 px-2.5 py-2">
                              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: sc.dot }} />
                              {/* Nama + notif status BERDAMPINGAN — status langsung
                                  terbaca tanpa mata harus lompat ke ujung baris. Grup
                                  ini (bukan nama sendirian) yang flex-1 + min-w-0,
                                  supaya nama menciut/truncate dan badge tetap
                                  menempel persis di sebelahnya, bukan terdorong jauh. */}
                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <span className="text-[12px] font-medium leading-snug min-w-0 truncate" style={{ color: PALETTE.ink }}>{c.label}</span>
                                <span className="text-[10px] font-bold flex-shrink-0" style={{ color: sc.dot }}>{sc.label}</span>
                              </div>
                              {c.photo_url && (
                                <a href={c.photo_url} target="_blank" rel="noopener noreferrer"
                                  title="Lihat foto evidence" className="flex-shrink-0">
                                  <img src={c.photo_thumb_url ?? c.photo_url} alt={`Evidence ${c.label}`}
                                    loading="lazy" decoding="async" width={24} height={24}
                                    className="w-6 h-6 rounded-sm object-cover hover:opacity-80 transition-opacity"
                                    style={{ border: `1px solid ${PALETTE.border}` }} />
                                </a>
                              )}
                              {/* Alur perubahan KOMPONEN ini — didorong ml-auto ke
                                  ujung kanan baris, terpisah dari notif status. */}
                              <div className="flex-shrink-0 max-w-[200px] overflow-x-auto ml-auto">
                                <AuditTrailPanel
                                  targetId={c.id} modul="project-progress" data={detail.auditTrail ?? []}
                                  kompak selaluTerbuka arah="horizontal"
                                  awal={{ oleh: null, waktu: c.created_at, keterangan: 'Komponen ditambahkan' }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {loc.note && (
                    <div className="rounded-sm px-3 py-2 text-[11px] font-medium leading-snug"
                      style={{
                        background: loc.note_flag ? PALETTE.badTint : PALETTE.surfaceSunken,
                        borderLeft: `3px solid ${loc.note_flag ? PALETTE.bad : PALETTE.borderStrong}`,
                        color: loc.note_flag ? PALETTE.bad : PALETTE.inkSoft,
                      }}>
                      {loc.note}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Rekap isu terbuka ── */}
      <div className="flex flex-col gap-2.5">
        <SectionLabel>Rekap Isu Terbuka</SectionLabel>
        <div className="rounded-md overflow-hidden" style={{ background: PALETTE.surface, border: `1px solid ${PALETTE.border}` }}>
          {issues.length === 0 ? (
            <p className="p-8 text-center text-sm font-medium" style={{ color: PALETTE.inkFaint }}>Tidak ada isu terbuka. 🎉</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[640px]">
                <thead>
                  <tr style={{ background: PALETTE.surfaceSunken }}>
                    {['Lokasi', 'Isu', 'Severity', 'Keterangan'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest"
                        style={{ color: PALETTE.inkFaint, borderBottom: `1px solid ${PALETTE.border}` }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...issues].sort((a, b) => a.sort_order - b.sort_order).map((is, i, arr) => {
                    const sv = SEVERITY_CONFIG[is.severity] ?? SEVERITY_CONFIG.sedang;
                    return (
                      <tr key={is.id} style={{ borderBottom: i < arr.length - 1 ? `1px solid ${PALETTE.border}` : 'none' }}>
                        <td className="px-4 py-3 text-[11px] font-bold align-top" style={{ color: PALETTE.ink }}>{is.location_label ?? '—'}</td>
                        <td className="px-4 py-3 text-[11px] font-semibold align-top" style={{ color: PALETTE.inkSoft }}>{is.issue}</td>
                        <td className="px-4 py-3 align-top">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
                            style={{ background: sv.bg, color: sv.color, border: `1px solid ${sv.border}` }}>
                            {sv.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[11px] font-medium align-top" style={{ color: PALETTE.inkFaint }}>{is.note ?? '—'}</td>
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
        <p className="text-[11px] font-medium leading-relaxed rounded-md px-4 py-3"
          style={{ background: PALETTE.surface, border: `1px solid ${PALETTE.border}`, color: PALETTE.inkSoft }}>
          {project.description}
        </p>
      )}
    </div>
  );
}

/** Label seksi kecil, huruf kapital berjarak - penanda kelompok, bukan hiasan. */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="self-start px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-widest"
      style={{ background: PALETTE.surface, border: `1px solid ${PALETTE.border}`, color: PALETTE.inkSoft }}>
      {children}
    </span>
  );
}
