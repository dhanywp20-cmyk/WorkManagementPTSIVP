'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSession, startSessionWatcher } from '@/lib/auth';
import { User } from '@/app/dashboard/_components/shared';
import { Toast, PageHeader, type Notif } from '@/components/shared';
import {
  hitungLingkupProject, cariProject, ambilDetailProject,
  type LingkupProject, type RingkasanProject, type DetailProject,
} from '@/lib/summary-project';
import { ModalLinkManual } from './_components/ModalLinkManual';

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

interface Aktivitas {
  id: string; tipe: AktivitasTipe; tanggal: string | null;
  judul: string; meta: string; status?: string; href: string;
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
  detail.reminders.forEach(r => list.push({
    id: `r-${r.id}`, tipe: 'schedule', tanggal: r.due_date,
    judul: `${r.category} · ${r.mode_penyelesaian === 'remote' ? 'Remote' : 'Onsite'}`,
    meta: `${r.assign_name}${r.address ? ' · ' + r.address : ''}`,
    status: r.status, href: `/reminder-schedule?open=${r.id}`,
  }));
  detail.tickets.forEach(t => list.push({
    id: `t-${t.id}`, tipe: 'ticket', tanggal: t.date,
    judul: t.issue_case, meta: t.assign_name,
    status: t.status, href: `/ticketing?open=${t.id}`,
  }));
  detail.requests.forEach(r => list.push({
    id: `p-${r.id}`, tipe: 'design', tanggal: r.due_date,
    judul: r.requester_name, meta: r.assigned_handler || 'Belum ada handler',
    status: r.status, href: `/form-require-project?open=${r.id}`,
  }));
  detail.reviews.forEach(r => list.push({
    id: `f-${r.id}`, tipe: 'review', tanggal: null,
    judul: r.review_category || 'Review', meta: r.guest_fullname,
    href: `/form-review?open=${r.id}`,
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

function Linimasa({ data }: { data: Aktivitas[] }) {
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
                <div className="flex items-center gap-2 mt-1.5">
                  {a.status && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: `${warnaStatus(a.status)}18`, color: warnaStatus(a.status) }}>
                      {a.status}
                    </span>
                  )}
                  <a href={a.href} className="text-[11px] font-bold hover:underline" style={{ color: cfg.color }}>Buka Detail →</a>
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
  const [showLinkManual, setShowLinkManual] = useState(false);
  const [toast, setToast] = useState<Notif | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const beritahu = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

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

  // "Project Terbaru" begitu lingkup siap, lalu debounced tiap query berubah.
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
    try { setDetail(await ambilDetailProject(p.canonical, p.display, lingkup)); }
    finally { setMemuatDetail(false); }
  }, [lingkup]);

  const muatUlangDetail = useCallback(() => { if (dipilih) bukaProject(dipilih); }, [dipilih, bukaProject]);

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
          <button onClick={() => setShowLinkManual(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100">
            🔗 Kelola Link Manual
          </button>
        )}
      </PageHeader>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="rounded-2xl shadow-sm p-4" style={KARTU}>
            <input aria-label="Cari nama project" value={query} onChange={e => setQuery(e.target.value)}
              placeholder="🔍 Cari nama project..."
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-indigo-400" />
            <p className="text-[11px] text-gray-400 mt-2 font-semibold uppercase tracking-wide">{query.trim() ? 'Hasil Pencarian' : 'Project Terbaru'}</p>

            <div className="mt-2 divide-y divide-gray-100 max-h-72 overflow-y-auto">
              {memuatHasil ? (
                <div className="py-6 text-center text-xs text-gray-400">Memuat...</div>
              ) : hasilCari.length === 0 ? (
                <div className="py-6 text-center text-xs text-gray-400">
                  {query.trim() ? `Tidak ada project cocok "${query}"` : 'Belum ada project tercatat.'}
                </div>
              ) : hasilCari.map(p => (
                <button key={p.canonical} onClick={() => bukaProject(p)}
                  className={`w-full text-left px-2.5 py-3 rounded-lg hover:bg-indigo-50/60 transition-colors flex items-center justify-between gap-3 ${dipilih?.canonical === p.canonical ? 'bg-indigo-50' : ''}`}>
                  <span className="text-sm font-bold text-gray-800 truncate">{p.display}</span>
                  <span className="flex items-center gap-1 flex-shrink-0">
                    {p.jumlah.reminders > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: TIPE_CFG.schedule.bg, color: TIPE_CFG.schedule.color }}>🗓️ {p.jumlah.reminders}</span>
                    )}
                    {p.jumlah.tickets > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: TIPE_CFG.ticket.bg, color: TIPE_CFG.ticket.color }}>🎫 {p.jumlah.tickets}</span>
                    )}
                    {p.jumlah.requests > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: TIPE_CFG.design.bg, color: TIPE_CFG.design.color }}>🏗️ {p.jumlah.requests}</span>
                    )}
                    {p.jumlah.reviews > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: TIPE_CFG.review.bg, color: TIPE_CFG.review.color }}>⭐ {p.jumlah.reviews}</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {dipilih && (
            <div className="space-y-4">
              {/* Kartu ringkasan project */}
              <div className="rounded-2xl shadow-sm p-5 flex items-center justify-between flex-wrap gap-3" style={KARTU}>
                <div className="flex items-center gap-3">
                  <span className="w-1.5 h-9 rounded-full bg-gradient-to-b from-violet-500 to-indigo-500" aria-hidden="true" />
                  <h2 className="text-lg font-black text-gray-800">{dipilih.display}</h2>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {dipilih.jumlah.reminders > 0 && (
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: TIPE_CFG.schedule.bg, color: TIPE_CFG.schedule.color }}>🗓️ {dipilih.jumlah.reminders} Schedule</span>
                  )}
                  {dipilih.jumlah.tickets > 0 && (
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: TIPE_CFG.ticket.bg, color: TIPE_CFG.ticket.color }}>🎫 {dipilih.jumlah.tickets} Ticket</span>
                  )}
                  {dipilih.jumlah.requests > 0 && (
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: TIPE_CFG.design.bg, color: TIPE_CFG.design.color }}>🏗️ {dipilih.jumlah.requests} Design</span>
                  )}
                  {dipilih.jumlah.reviews > 0 && (
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: TIPE_CFG.review.bg, color: TIPE_CFG.review.color }}>⭐ {dipilih.jumlah.reviews} Review</span>
                  )}
                </div>
              </div>

              {memuatDetail || !detail ? (
                <div className="rounded-2xl shadow-sm p-8 text-center text-sm text-gray-400" style={KARTU}>
                  Memuat riwayat...
                </div>
              ) : (
                <Linimasa data={linimasa} />
              )}
            </div>
          )}
        </div>
      </div>

      {showLinkManual && (
        <ModalLinkManual
          currentUserName={currentUser.full_name}
          onTutup={() => setShowLinkManual(false)}
          onTersimpan={() => { beritahu('success', 'Link manual disimpan.'); muatUlangDetail(); jalankanCari(query); }}
        />
      )}
    </div>
  );
}
