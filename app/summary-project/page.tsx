'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSession, startSessionWatcher } from '@/lib/auth';
import { User } from '@/app/dashboard/_components/shared';
import { Toast, PageHeader, ConfirmDialog, type ConfirmState, type Notif } from '@/components/shared';
import {
  hitungLingkupProject, cariProject, ambilDetailProject, ambilStatistikMapping, lepasLink, ubahProject,
  type LingkupProject, type RingkasanProject, type DetailProject, type SourceModule,
} from '@/lib/summary-project';
import { ModalMappingCenter } from './_components/ModalMappingCenter';

/*
  Tema visual disamakan dengan modul lain yang sudah settle: PageHeader
  bersama (komponen yang sama dipakai Reminder Schedule/Ticketing/Request
  Design Project/Project Progress dkk - lihat components/shared/PageHeader.tsx),
  background IVP_Background.png, dan kartu kaca buram rgba(255,255,255,0.97) +
  backdrop-blur. Warna aksen tiap kategori aktivitas mengikuti warna
  PageHeader modul ASLINYA persis, supaya "Buka Detail" terasa menyambung
  ke modul yang dituju, bukan warna baru yang diputuskan sendiri di sini.
*/
const KARTU: React.CSSProperties = {
  background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(200,200,200,0.6)',
};

type AktivitasTipe = 'schedule' | 'ticket' | 'design' | 'review';

const TIPE_CFG: Record<AktivitasTipe, { label: string; color: string; bg: string; icon: string }> = {
  schedule: { label: 'REQUEST SCHEDULE', color: '#0891b2', bg: '#ecfeff', icon: '🗓️' },
  ticket:   { label: 'TROUBLESHOOTING',  color: '#dc2626', bg: '#fef2f2', icon: '🎫' },
  design:   { label: 'DESIGN PROJECT',   color: '#7c3aed', bg: '#f5f3ff', icon: '🏗️' },
  review:   { label: 'FORM REVIEW',      color: '#b45309', bg: '#fffbeb', icon: '⭐' },
};

const STATUS_PROJECT: Record<RingkasanProject['status'], string> = {
  active: 'Aktif', done: 'Selesai', archived: 'Diarsipkan',
};

interface Aktivitas {
  id: string; tipe: AktivitasTipe; tanggal: string | null;
  judul: string; meta: string; status?: string; href: string;
  /** Id baris project_source_links bila record ini dipetakan langsung (bukan ikut reminder). */
  linkId?: string;
}

const STATUS_WARNA: Record<string, string> = {
  done: '#10b981', paid: '#10b981', approved: '#10b981', Solved: '#10b981', Done: '#10b981',
  pending: '#f59e0b', Pending: '#f59e0b', processed: '#3b82f6',
  cancelled: '#6b7280', rejected: '#ef4444', Rejected: '#ef4444',
};
const warnaStatus = (s: string): string => STATUS_WARNA[s] ?? '#3b82f6';

function fmtTgl(s: string | null): string {
  if (!s) return '-';
  return new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Gabungkan 4 sumber jadi SATU linimasa kronologis - lebih enak dibaca daripada 4 kotak terpisah. */
function bangunLinimasa(detail: DetailProject): Aktivitas[] {
  const list: Aktivitas[] = [];
  const link = (m: SourceModule, id: string) => detail.linkId[`${m}:${id}`];
  detail.reminders.forEach(r => list.push({
    id: `r-${r.id}`, tipe: 'schedule', tanggal: r.due_date,
    judul: `${r.category} · ${r.mode_penyelesaian === 'remote' ? 'Remote' : 'Onsite'}`,
    meta: `${r.assign_name}${r.address ? ' · ' + r.address : ''}`,
    status: r.status, href: `/reminder-schedule?open=${r.id}`, linkId: link('reminders', r.id),
  }));
  detail.tickets.forEach(t => list.push({
    id: `t-${t.id}`, tipe: 'ticket', tanggal: t.date,
    judul: t.issue_case, meta: t.assign_name,
    status: t.status, href: `/ticketing?open=${t.id}`, linkId: link('tickets', t.id),
  }));
  detail.requests.forEach(r => list.push({
    id: `p-${r.id}`, tipe: 'design', tanggal: r.due_date,
    judul: r.requester_name, meta: r.assigned_handler || 'Belum ada handler',
    status: r.status, href: `/form-require-project?open=${r.id}`, linkId: link('project_requests', r.id),
  }));
  detail.reviews.forEach(r => list.push({
    id: `f-${r.id}`, tipe: 'review', tanggal: null,
    judul: r.review_category || 'Review', meta: r.guest_fullname,
    href: `/form-review?open=${r.id}`, linkId: link('form_reviews', r.id),
  }));
  // Terbaru dulu. Yang tanpa tanggal (Form Review) diletakkan paling akhir,
  // bukan ikut "menang" di puncak lewat perbandingan string kosong.
  return list.sort((a, b) => {
    if (!a.tanggal && !b.tanggal) return 0;
    if (!a.tanggal) return 1;
    if (!b.tanggal) return -1;
    return b.tanggal.localeCompare(a.tanggal);
  });
}

function JumlahChip({ p, kecil }: { p: RingkasanProject; kecil?: boolean }) {
  const isi: [AktivitasTipe, number, string][] = [
    ['schedule', p.schedule_count, 'Schedule'], ['ticket', p.ticket_count, 'Ticket'],
    ['design', p.design_count, 'Design'], ['review', p.review_count, 'Review'],
  ];
  return (
    <span className="flex items-center gap-1 flex-shrink-0 flex-wrap">
      {isi.filter(([, n]) => n > 0).map(([t, n, label]) => (
        <span key={t} className={kecil ? 'text-[10px] font-bold px-1.5 py-0.5 rounded' : 'text-[11px] font-bold px-2.5 py-1 rounded-full'}
          style={{ background: TIPE_CFG[t].bg, color: TIPE_CFG[t].color }}>
          {TIPE_CFG[t].icon} {n}{kecil ? '' : ` ${label}`}
        </span>
      ))}
    </span>
  );
}

function Linimasa({ data, onLepas }: { data: Aktivitas[]; onLepas?: (a: Aktivitas) => void }) {
  if (data.length === 0) {
    return (
      <div className="rounded-2xl shadow-sm p-8 text-center text-sm text-gray-400" style={KARTU}>
        Belum ada aktivitas tercatat untuk project ini.
      </div>
    );
  }
  return (
    <div className="rounded-2xl shadow-sm p-5" style={KARTU}>
      <h3 className="text-sm font-black text-gray-700 mb-4">📌 Linimasa Aktivitas</h3>
      <div className="relative pl-5">
        <div className="absolute left-[5px] top-1.5 bottom-1.5 w-px bg-gray-200" aria-hidden="true" />
        <div className="space-y-5">
          {data.map(a => {
            const cfg = TIPE_CFG[a.tipe];
            return (
              <div key={a.id} className="relative">
                <span className="absolute -left-5 top-1 w-3 h-3 rounded-full border-2 border-white shadow-sm"
                  style={{ background: cfg.color }} aria-hidden="true" />
                <p className="text-[10px] font-black tracking-wider" style={{ color: cfg.color }}>{cfg.icon} {cfg.label}</p>
                <p className="text-sm font-bold text-gray-800 mt-0.5">{a.judul}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{fmtTgl(a.tanggal)} · {a.meta}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {a.status && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: `${warnaStatus(a.status)}18`, color: warnaStatus(a.status) }}>
                      {a.status}
                    </span>
                  )}
                  <a href={a.href} className="text-[11px] font-bold hover:underline" style={{ color: cfg.color }}>Buka Detail →</a>
                  {onLepas && a.linkId && (
                    <button type="button" onClick={() => onLepas(a)}
                      className="text-[11px] font-bold text-gray-400 hover:text-red-500 hover:underline">Lepas dari project</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Halaman utama

export default function SummaryProjectPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [lingkup, setLingkup] = useState<LingkupProject | null>(null);
  const [query, setQuery] = useState('');
  const [hasilCari, setHasilCari] = useState<RingkasanProject[]>([]);
  const [memuatHasil, setMemuatHasil] = useState(false);
  const [dipilih, setDipilih] = useState<RingkasanProject | null>(null);
  const [detail, setDetail] = useState<DetailProject | null>(null);
  const [memuatDetail, setMemuatDetail] = useState(false);
  const [showMapping, setShowMapping] = useState(false);
  const [belumTerpeta, setBelumTerpeta] = useState<number | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [toast, setToast] = useState<Notif | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const beritahu = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  // Hanya tampilan: penulisan ke projects/project_source_links dijaga RLS
  // (psl_write/projects_write - admin/superadmin), bukan oleh tombol ini.
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

  const jalankanCari = useCallback(async (q: string) => {
    if (!lingkup) return;
    setMemuatHasil(true);
    try { setHasilCari(await cariProject(q, lingkup)); }
    finally { setMemuatHasil(false); }
  }, [lingkup]);

  // Aktivitas terbaru begitu lingkup siap, lalu debounced tiap query berubah.
  useEffect(() => {
    if (!lingkup) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => jalankanCari(query), query ? 320 : 0);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, lingkup]);

  const bukaProject = useCallback(async (p: RingkasanProject) => {
    if (!lingkup) return;
    setDipilih(p); setDetail(null); setMemuatDetail(true);
    try { setDetail(await ambilDetailProject(p.project_id, lingkup)); }
    finally { setMemuatDetail(false); }
  }, [lingkup]);

  const muatStatistik = useCallback(async () => {
    const s = await ambilStatistikMapping();
    setBelumTerpeta(s ? s.belum_terpeta : null);
  }, []);

  useEffect(() => { if (isAdmin) muatStatistik(); }, [isAdmin, muatStatistik]);

  // Setelah pemetaan berubah, angka di kartu ikut berubah - jadi project yang
  // sedang dibuka diambil ulang dari hasil pencarian terbaru.
  const segarkan = useCallback(async () => {
    if (!lingkup) return;
    const hasil = await cariProject(query, lingkup);
    setHasilCari(hasil);
    if (isAdmin) muatStatistik();
    if (dipilih) {
      const baru = hasil.find(h => h.project_id === dipilih.project_id);
      if (baru) bukaProject(baru); else { setDipilih(null); setDetail(null); }
    }
  }, [lingkup, query, isAdmin, muatStatistik, dipilih, bukaProject]);

  const lepas = (a: Aktivitas) => setConfirmState({
    message: 'Lepas record ini dari project?',
    description: 'Record kembali ke antrean Mapping Center. Datanya sendiri tidak dihapus.',
    danger: true, confirmLabel: 'Lepas',
    onConfirm: async () => {
      try { await lepasLink(a.linkId!); beritahu('success', 'Record dilepas dari project.'); await segarkan(); }
      catch (e) { beritahu('error', `Gagal melepas: ${e instanceof Error ? e.message : String(e)}`); }
    },
  });

  const gantiStatus = async (status: RingkasanProject['status']) => {
    if (!dipilih) return;
    try { await ubahProject(dipilih.project_id, { status }); beritahu('success', 'Status project diperbarui.'); await segarkan(); }
    catch (e) { beritahu('error', `Gagal: ${e instanceof Error ? e.message : String(e)}`); }
  };

  if (!currentUser || !lingkup) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100vh', backgroundImage: "url('/IVP_Background.png')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
          style={{ borderColor: 'rgba(99,102,241,0.2)', borderTopColor: '#6366f1' }} />
      </div>
    );
  }

  const linimasa = detail ? bangunLinimasa(detail) : [];

  return (
    <div className="h-screen overflow-hidden flex flex-col" style={{ fontFamily: "'Inter', sans-serif", backgroundImage: "url('/IVP_Background.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>
      <Toast notif={toast} />

      <PageHeader icon="🗂️" title="Summary Project" color="#6366f1" colorLight="#4f46e5"
        subtitle="Request Schedule · Troubleshooting · Design Project · Form Review">
        {isAdmin && (
          <button onClick={() => setShowMapping(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 flex items-center gap-1.5">
            🧭 Mapping Center
            {!!belumTerpeta && <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px]">{belumTerpeta}</span>}
          </button>
        )}
      </PageHeader>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="rounded-2xl shadow-sm p-4" style={KARTU}>
            <input aria-label="Cari project" value={query} onChange={e => setQuery(e.target.value)}
              placeholder="🔍 Cari nama project, kode PRJ, customer, atau lokasi..."
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-indigo-400" />
            <p className="text-[11px] text-gray-400 mt-2 font-semibold uppercase tracking-wide">{query.trim() ? 'Hasil Pencarian' : 'Aktivitas Terbaru'}</p>

            <div className="mt-2 divide-y divide-gray-100 max-h-72 overflow-y-auto">
              {memuatHasil ? (
                <div className="py-6 text-center text-xs text-gray-400">Memuat...</div>
              ) : hasilCari.length === 0 ? (
                <div className="py-6 text-center text-xs text-gray-400">
                  {query.trim() ? `Tidak ada project cocok "${query}"`
                    : isAdmin ? <>Belum ada project. <button type="button" onClick={() => setShowMapping(true)} className="font-bold text-indigo-600 hover:underline">Buka Mapping Center</button> untuk mulai memetakan record ke project.</>
                    : 'Belum ada project yang dipetakan admin.'}
                </div>
              ) : hasilCari.map(p => (
                <button key={p.project_id} onClick={() => bukaProject(p)}
                  className={`w-full text-left px-2.5 py-3 rounded-lg hover:bg-indigo-50/60 transition-colors flex items-center justify-between gap-3 ${dipilih?.project_id === p.project_id ? 'bg-indigo-50' : ''}`}>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-gray-800 truncate">{p.name}</span>
                    <span className="block text-[11px] text-gray-400 truncate">{p.code}{p.location ? ` · ${p.location}` : ''}{p.status === 'done' ? ' · Selesai' : ''}</span>
                  </span>
                  <JumlahChip p={p} kecil />
                </button>
              ))}
            </div>
          </div>

          {dipilih && (
            <div className="space-y-4">
              {/* Kartu ringkasan project */}
              <div className="rounded-2xl shadow-sm p-5 flex items-center justify-between flex-wrap gap-3" style={KARTU}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-1.5 h-9 rounded-full bg-gradient-to-b from-violet-500 to-indigo-500 flex-shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-black tracking-wider text-indigo-500">{dipilih.code}</p>
                    <h2 className="text-lg font-black text-gray-800 truncate">{dipilih.name}</h2>
                    <p className="text-[11px] text-gray-400 truncate">
                      {[dipilih.customer, dipilih.location, dipilih.sales_name && `Sales: ${dipilih.sales_name}`].filter(Boolean).join(' · ') || '-'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <JumlahChip p={dipilih} />
                  {isAdmin ? (
                    <select aria-label="Status project" value={dipilih.status} onChange={e => gantiStatus(e.target.value as RingkasanProject['status'])}
                      className="text-[11px] font-bold px-2 py-1 rounded-full border border-gray-200 bg-white text-gray-600">
                      {Object.entries(STATUS_PROJECT).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  ) : (
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">{STATUS_PROJECT[dipilih.status]}</span>
                  )}
                </div>
              </div>

              {memuatDetail || !detail ? (
                <div className="rounded-2xl shadow-sm p-8 text-center text-sm text-gray-400" style={KARTU}>
                  Memuat riwayat...
                </div>
              ) : (
                <Linimasa data={linimasa} onLepas={isAdmin ? lepas : undefined} />
              )}
            </div>
          )}
        </div>
      </div>

      {showMapping && (
        <ModalMappingCenter
          currentUserName={currentUser.full_name}
          onTutup={() => setShowMapping(false)}
          onBerubah={segarkan}
        />
      )}
      <ConfirmDialog state={confirmState} onCancel={() => setConfirmState(null)} />
    </div>
  );
}
