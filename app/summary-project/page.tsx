'use client';

import { useState, useEffect, useCallback, useMemo, type CSSProperties } from 'react';
import { getSession, startSessionWatcher } from '@/lib/auth';
import { User } from '@/app/dashboard/_components/shared';
import {
  Toast, PageHeader, StatCardGrid, EmptyState, ViewIconBtn, LoadingScreen,
  MobileListCard, MobileCardBadge, Paginasi, usePaginasi, type Notif,
} from '@/components/shared';
import {
  hitungLingkupProject, daftarProject, ambilStatistikMapping, normalisasiNamaProject,
  type LingkupProject, type RingkasanProject,
} from '@/lib/summary-project';
import { ModalMappingCenter } from './_components/ModalMappingCenter';
import { ModalDetailProject } from './_components/ModalDetailProject';
import { TIPE_CFG, STATUS_PROJECT, STATUS_PROJECT_WARNA, fmtTgl, type AktivitasTipe } from './_components/tampilan';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';

const THEME = { color: '#6366f1', colorLight: '#4f46e5' };
const fontMono: CSSProperties = { fontFamily: "'JetBrains Mono', ui-monospace, monospace" };

type FilterStatus = 'semua' | RingkasanProject['status'];
type FilterTipe = 'semua' | AktivitasTipe;

const KOLOM_JUMLAH: Record<AktivitasTipe, keyof RingkasanProject> = {
  schedule: 'schedule_count', ticket: 'ticket_count', design: 'design_count', review: 'review_count',
};

function Jumlah({ n, tipe }: { n: number; tipe: AktivitasTipe }) {
  if (!n) return <span className="text-[11px] text-gray-300">—</span>;
  return (
    <span className="inline-flex min-w-[28px] justify-center px-1.5 py-0.5 rounded text-[11px] font-bold tabular-nums"
      style={{ background: TIPE_CFG[tipe].bg, color: TIPE_CFG[tipe].color }}>{n}</span>
  );
}

export default function SummaryProjectPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [lingkup, setLingkup] = useState<LingkupProject | null>(null);
  const [daftar, setDaftar] = useState<RingkasanProject[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [cari, setCari] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('active');
  const [filterTipe, setFilterTipe] = useState<FilterTipe>('semua');
  const [dipilihId, setDipilihId] = useState<string | null>(null);
  const [showMapping, setShowMapping] = useState(false);
  const [belumTerpeta, setBelumTerpeta] = useState<number | null>(null);
  const [toast, setToast] = useState<Notif | null>(null);

  const beritahu = useCallback((type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Hanya tampilan: penulisan ke projects/project_source_links dijaga RLS
  // (projects_write/psl_write - admin/superadmin), bukan oleh tombol ini.
  const isAdmin = ['admin', 'superadmin'].includes((currentUser?.role ?? '').toLowerCase());

  useEffect(() => {
    const user = getSession<User>();
    if (!user) {
      const target = window.top !== window ? window.top : window;
      if (target) target.location.href = '/dashboard';
      return;
    }
    setCurrentUser(user);
    return startSessionWatcher();
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    hitungLingkupProject(currentUser).then(setLingkup);
  }, [currentUser]);

  const muat = useCallback(async () => {
    if (!lingkup) return;
    setGalat(null);
    try { setDaftar(await daftarProject(lingkup)); }
    catch (e) { setGalat(e instanceof Error ? e.message : String(e)); }
    finally { setMemuat(false); }
    if (isAdmin) {
      const s = await ambilStatistikMapping();
      setBelumTerpeta(s ? s.belum_terpeta : null);
    }
  }, [lingkup, isAdmin]);

  useEffect(() => { muat(); }, [muat]);

  const statistik = useMemo(() => {
    // Mengikuti filter status yang sedang dipilih - kartu dan tabel harus
    // menunjukkan angka yang sama.
    const aktif = daftar.filter(p => filterStatus === 'semua' || p.status === filterStatus);
    const total = (k: keyof RingkasanProject) => aktif.reduce((n, p) => n + (p[k] as number), 0);
    return {
      project: aktif.length,
      schedule: total('schedule_count'), ticket: total('ticket_count'),
      design: total('design_count'), review: total('review_count'),
    };
  }, [daftar, filterStatus]);

  const tersaring = useMemo(() => {
    const k = normalisasiNamaProject(cari);
    return daftar.filter(p => {
      if (filterStatus !== 'semua' && p.status !== filterStatus) return false;
      if (filterTipe !== 'semua' && !(p[KOLOM_JUMLAH[filterTipe]] as number)) return false;
      if (!k) return true;
      return [p.name, p.code, p.customer, p.location, p.sales_name]
        .some(v => normalisasiNamaProject(v ?? '').includes(k));
    });
  }, [daftar, cari, filterStatus, filterTipe]);

  const hal = usePaginasi(tersaring);
  const { setHalaman } = hal;
  useEffect(() => { setHalaman(1); }, [cari, filterStatus, filterTipe, setHalaman]);

  const dipilih = dipilihId ? daftar.find(p => p.project_id === dipilihId) ?? null : null;

  if (!currentUser || !lingkup || memuat) return <LoadingScreen />;

  const pilihTipe = (t: FilterTipe) => setFilterTipe(prev => (prev === t ? 'semua' : t));

  return (
    <div className="h-screen overflow-hidden flex flex-col relative" style={{
      background: 'var(--halaman)',
      backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed',
    }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(255,255,255,0.08)' }} />
      <div className="relative flex flex-col flex-1 overflow-hidden">
        <Toast notif={toast} />

        <PageHeader icon="🗂️" title="Summary Project" color={THEME.color} colorLight={THEME.colorLight}
          subtitle="Riwayat Request Schedule · Troubleshooting · Design Project · Form Review per project">
          {isAdmin && (
            <button onClick={() => setShowMapping(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:scale-105 hover:opacity-90"
              style={{ background: `linear-gradient(135deg, ${THEME.color}, ${THEME.colorLight})`, boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }}>
              <IkonTeks nama="🧭" />Mapping Center
              {!!belumTerpeta && <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[10px]">{belumTerpeta}</span>}
            </button>
          )}
        </PageHeader>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5 flex flex-col gap-4">

            {/* Ringkasan - kartu kategori sekaligus filter */}
            <StatCardGrid cols={5} items={[
              { label: 'Project', value: statistik.project, sub: filterStatus === 'semua' ? 'semua status' : STATUS_PROJECT[filterStatus], accent: THEME.color,
                onClick: () => setFilterTipe('semua'), active: filterTipe === 'semua' },
              ...(['schedule', 'ticket', 'design', 'review'] as AktivitasTipe[]).map(t => ({
                label: TIPE_CFG[t].pendek, value: statistik[t], sub: 'klik untuk saring',
                accent: TIPE_CFG[t].color, onClick: () => pilihTipe(t), active: filterTipe === t,
              })),
            ]} />

            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-2">
              <input aria-label="Cari project" value={cari} onChange={e => setCari(e.target.value)}
                placeholder="Cari nama project, kode PRJ, customer, lokasi, atau sales…"
                className="flex-1 min-w-[220px] px-3.5 py-2.5 rounded-md text-sm font-medium outline-none bg-white border border-slate-300 text-slate-800 focus:ring-2 focus:ring-indigo-400" />
              {(['semua', 'active', 'done', 'archived'] as FilterStatus[]).map(s => {
                const aktif = filterStatus === s;
                return (
                  <button key={s} onClick={() => setFilterStatus(s)}
                    className="px-3.5 py-2 rounded-md text-xs font-bold transition-all"
                    style={aktif
                      ? { background: '#0f172a', color: '#fff', border: '1px solid transparent' }
                      : { background: '#fff', color: '#475569', border: '1px solid #cbd5e1' }}>
                    {s === 'semua' ? 'Semua' : STATUS_PROJECT[s]}
                  </button>
                );
              })}
            </div>

            {galat ? (
              <div className="rounded-md bg-white border border-red-200 p-6 text-center text-sm text-red-600">Gagal memuat project: {galat}</div>
            ) : tersaring.length === 0 ? (
              <div className="rounded-md bg-white/95 border border-slate-200">
                <EmptyState icon="🗂️" title={daftar.length ? 'Tidak ada project yang cocok' : 'Belum ada project'}
                  description={daftar.length ? 'Ubah kata kunci atau filter.' : 'Project terbentuk otomatis dari Request Schedule, Ticket, dan Design Project.'} />
              </div>
            ) : (
              <div className="rounded-md overflow-hidden bg-white border border-slate-200">

                {/* MOBILE: kartu */}
                <div className="md:hidden bg-gray-50/70 p-1.5 space-y-1.5">
                  {hal.potongan.map(p => {
                    const st = STATUS_PROJECT_WARNA[p.status];
                    return (
                      <MobileListCard key={p.project_id}
                        title={p.name}
                        meta={<span style={fontMono}>{p.code} · {fmtTgl(p.last_activity)}</span>}
                        accent={THEME.color}
                        onClick={() => setDipilihId(p.project_id)}
                        badges={<MobileCardBadge style={{ background: st.bg, color: st.color }}>{STATUS_PROJECT[p.status]}</MobileCardBadge>}
                        fields={[
                          { label: 'Sales', value: p.sales_name || '—' },
                          { label: 'Customer', value: p.customer || '—', hide: !p.customer },
                          { label: 'Aktivitas', value: `${p.schedule_count} schedule · ${p.ticket_count} ticket · ${p.design_count} design · ${p.review_count} review`, span2: true },
                          { label: 'Lokasi', value: p.location || '—', span2: true, hide: !p.location },
                        ]}
                      />
                    );
                  })}
                </div>

                {/* DESKTOP: tabel */}
                <div className="hidden md:block overflow-x-auto bg-slate-100/60 px-3 pb-2">
                  <table className="w-full tabel-kartu" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: '44px' }} />
                      <col style={{ width: '92px' }} />
                      <col style={{ width: '24%' }} />
                      <col style={{ width: '22%' }} />
                      <col style={{ width: '13%' }} />
                      <col style={{ width: '64px' }} />
                      <col style={{ width: '64px' }} />
                      <col style={{ width: '64px' }} />
                      <col style={{ width: '64px' }} />
                      <col style={{ width: '104px' }} />
                      <col style={{ width: '88px' }} />
                      <col style={{ width: '52px' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        {['No', 'Kode', 'Nama Project', 'Lokasi', 'Sales'].map((h, i) => (
                          <th key={h} className={`px-3 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide ${i === 0 ? 'text-center' : 'text-left'}`}>{h}</th>
                        ))}
                        {(['schedule', 'ticket', 'design', 'review'] as AktivitasTipe[]).map(t => (
                          <th key={t} className="px-1 py-2.5 text-[10px] font-bold uppercase tracking-wide text-center" style={{ color: TIPE_CFG[t].color }}
                            title={TIPE_CFG[t].label}><Ikon nama={TIPE_CFG[t].icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /> {TIPE_CFG[t].pendek}</th>
                        ))}
                        <th className="px-3 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide text-left">Terakhir</th>
                        <th className="px-3 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide text-left">Status</th>
                        <th className="px-1 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide text-center"><span className="sr-only">Aksi</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {hal.potongan.map((p, idx) => {
                        const st = STATUS_PROJECT_WARNA[p.status];
                        return (
                          <tr key={p.project_id} className="cursor-pointer" onClick={() => setDipilihId(p.project_id)}
                            style={{ '--aksen-baris': THEME.color, '--bg-baris-sorot': '#eef2ff' } as CSSProperties}>
                            <td className="px-3 py-3 text-center align-middle">
                              <span className="text-[11px] font-bold text-gray-500">{hal.mulai + idx + 1}</span>
                            </td>
                            <td className="px-3 py-3 align-middle">
                              <span className="text-[11px] font-bold text-indigo-600" style={fontMono}>{p.code}</span>
                            </td>
                            <td className="px-3 py-3 align-middle">
                              <p className="text-xs font-bold text-gray-800 leading-snug break-words">{p.name}</p>
                              {p.customer && <p className="text-[10px] text-gray-400 font-semibold mt-0.5 truncate">{p.customer}</p>}
                            </td>
                            <td className="px-3 py-3 align-middle">
                              <p className="text-[11px] text-gray-600 line-clamp-2" title={p.location ?? undefined}>{p.location || <span className="text-gray-300">—</span>}</p>
                            </td>
                            <td className="px-3 py-3 align-middle">
                              {p.sales_name ? (
                                <>
                                  <p className="text-[11px] font-semibold text-gray-700 truncate">{p.sales_name}</p>
                                  {p.sales_division && <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wide">{p.sales_division}</p>}
                                </>
                              ) : <span className="text-[11px] text-gray-300">—</span>}
                            </td>
                            <td className="px-1 py-3 align-middle text-center"><Jumlah n={p.schedule_count} tipe="schedule" /></td>
                            <td className="px-1 py-3 align-middle text-center"><Jumlah n={p.ticket_count} tipe="ticket" /></td>
                            <td className="px-1 py-3 align-middle text-center"><Jumlah n={p.design_count} tipe="design" /></td>
                            <td className="px-1 py-3 align-middle text-center"><Jumlah n={p.review_count} tipe="review" /></td>
                            <td className="px-3 py-3 align-middle">
                              <span className="text-[11px] font-semibold text-gray-600 whitespace-nowrap" style={fontMono}>{fmtTgl(p.last_activity)}</span>
                            </td>
                            <td className="px-3 py-3 align-middle">
                              <span className="px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap" style={{ background: st.bg, color: st.color }}>
                                {STATUS_PROJECT[p.status]}
                              </span>
                            </td>
                            <td className="px-1 py-3 align-middle text-center" onClick={e => e.stopPropagation()}>
                              <ViewIconBtn onClick={() => setDipilihId(p.project_id)} label={`Lihat ${p.name}`} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <Paginasi {...hal} satuan="project" warna={THEME.color} />
              </div>
            )}
          </div>
        </main>
      </div>

      {dipilih && (
        <ModalDetailProject key={dipilih.project_id}
          project={dipilih} lingkup={lingkup} isAdmin={isAdmin}
          currentUserName={currentUser.full_name}
          onTutup={() => setDipilihId(null)} onBerubah={muat} beritahu={beritahu} />
      )}
      {showMapping && (
        <ModalMappingCenter
          currentUserName={currentUser.full_name}
          onTutup={() => setShowMapping(false)}
          onBerubah={muat}
        />
      )}
    </div>
  );
}
