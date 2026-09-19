'use client';

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { getSession, startSessionWatcher } from '@/lib/auth';
import { User } from '@/app/dashboard/_components/shared';
import { Toast, type Notif } from '@/components/shared';
import {
  hitungLingkupProject, cariProject, ambilDetailProject,
  type LingkupProject, type RingkasanProject, type DetailProject,
  type ReminderRingkas, type TicketRingkas, type RequestRingkas, type ReviewRingkas,
} from '@/lib/summary-project';
import { ModalLinkManual } from './_components/ModalLinkManual';

/*
  Tema visual di sini SENGAJA disamakan persis dengan Incentive PTS/Ticketing/
  Reminder Schedule (background IVP_Background.png + kartu kaca buram
  rgba(255,255,255,0.97) + backdrop-blur), bukan kartu putih polos Tailwind
  bawaan - supaya menu baru ini terasa satu keluarga dengan modul lain yang
  temanya sudah settle, bukan seperti ditempel dari platform lain.
*/
const KARTU: React.CSSProperties = {
  background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(200,200,200,0.6)',
};

function fmtTgl(s: string | null): string {
  if (!s) return '-';
  return new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_WARNA: Record<string, string> = {
  done: '#10b981', paid: '#10b981', approved: '#10b981', Solved: '#10b981', Done: '#10b981',
  pending: '#f59e0b', Pending: '#f59e0b', processed: '#3b82f6',
  cancelled: '#6b7280', rejected: '#ef4444', Rejected: '#ef4444',
};
const warnaStatus = (s: string): string => STATUS_WARNA[s] ?? '#3b82f6';

// Kartu seksi + baris detail

function SeksiCard({ icon, judul, jumlah, kosongTeks, children }: {
  icon: string; judul: string; jumlah: number; kosongTeks: string; children: ReactNode;
}) {
  return (
    <div className="rounded-2xl shadow-sm overflow-hidden" style={KARTU}>
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-black text-gray-700">{icon} {judul}</h3>
        <span className="text-[11px] font-bold text-gray-400">{jumlah} baris</span>
      </div>
      <div className="divide-y divide-gray-100">
        {jumlah === 0 ? <p className="px-4 py-4 text-xs text-gray-400">{kosongTeks}</p> : children}
      </div>
    </div>
  );
}

function BarisDetail({ judul, sub, status, href }: {
  judul: string; sub: string; status?: string; href: string;
}) {
  return (
    <div className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-indigo-50/40 transition-colors">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-700 truncate">{judul}</p>
        <p className="text-[11px] text-gray-400 truncate">{sub}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {status && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: `${warnaStatus(status)}18`, color: warnaStatus(status) }}>
            {status}
          </span>
        )}
        <a href={href} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 whitespace-nowrap">Buka Detail →</a>
      </div>
    </div>
  );
}

function SeksiRequestSchedule({ data }: { data: ReminderRingkas[] }) {
  return (
    <SeksiCard icon="🗓️" judul="Request Schedule" jumlah={data.length} kosongTeks="Belum ada jadwal tercatat untuk project ini.">
      {data.map(r => (
        <BarisDetail key={r.id}
          judul={`${r.category} · ${r.mode_penyelesaian === 'remote' ? 'Remote' : 'Onsite'}`}
          sub={`${fmtTgl(r.due_date)} · ${r.assign_name}${r.address ? ' · ' + r.address : ''}`}
          status={r.status} href={`/reminder-schedule?open=${r.id}`} />
      ))}
    </SeksiCard>
  );
}

function SeksiTroubleshooting({ data }: { data: TicketRingkas[] }) {
  return (
    <SeksiCard icon="🎫" judul="Riwayat Troubleshooting" jumlah={data.length} kosongTeks="Belum ada ticket troubleshooting untuk project ini.">
      {data.map(t => (
        <BarisDetail key={t.id} judul={t.issue_case}
          sub={`${fmtTgl(t.date)} · ${t.assign_name}`}
          status={t.status} href={`/ticketing?open=${t.id}`} />
      ))}
    </SeksiCard>
  );
}

function SeksiDesignProject({ data }: { data: RequestRingkas[] }) {
  return (
    <SeksiCard icon="🏗️" judul="Design Project" jumlah={data.length} kosongTeks="Belum ada Request Design Project untuk project ini.">
      {data.map(r => (
        <BarisDetail key={r.id} judul={r.requester_name}
          sub={`${fmtTgl(r.due_date)}${r.assigned_handler ? ' · ' + r.assigned_handler : ''}`}
          status={r.status} href={`/form-require-project?open=${r.id}`} />
      ))}
    </SeksiCard>
  );
}

function SeksiFormReview({ data }: { data: ReviewRingkas[] }) {
  return (
    <SeksiCard icon="⭐" judul="Form Review (BAST)" jumlah={data.length} kosongTeks="Belum ada Form Review untuk project ini.">
      {data.map(r => (
        <BarisDetail key={r.id} judul={r.review_category || 'Review'} sub={r.guest_fullname}
          href={`/form-review?open=${r.id}`} />
      ))}
    </SeksiCard>
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

  return (
    <div className="h-screen overflow-hidden flex flex-col" style={{ fontFamily: "'Inter', sans-serif", backgroundImage: "url('/IVP_Background.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>
      <Toast notif={toast} />

      {/* Header */}
      <header className="flex-shrink-0 z-50"
        style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '3px solid #6366f1', boxShadow: '0 2px 12px rgba(99,102,241,0.10)' }}>
        <div className="w-full px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-500 flex items-center justify-center text-white text-lg flex-shrink-0">🗂️</div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-gray-800">Summary Project</h1>
            <p className="text-[11px] text-gray-400">Request Schedule · Troubleshooting · Design Project · Form Review</p>
          </div>
          {isAdmin && (
            <button onClick={() => setShowLinkManual(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 flex-shrink-0">
              🔗 Kelola Link Manual
            </button>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="rounded-2xl shadow-sm p-4" style={KARTU}>
            <input aria-label="Cari nama project" value={query} onChange={e => setQuery(e.target.value)}
              placeholder="🔍 Cari nama project..."
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-indigo-400" />
            <p className="text-[11px] text-gray-400 mt-2">{query.trim() ? 'Hasil pencarian' : 'Project Terbaru'}</p>

            <div className="mt-2 divide-y divide-gray-100 max-h-72 overflow-y-auto">
              {memuatHasil ? (
                <div className="py-6 text-center text-xs text-gray-400">Memuat...</div>
              ) : hasilCari.length === 0 ? (
                <div className="py-6 text-center text-xs text-gray-400">
                  {query.trim() ? `Tidak ada project cocok "${query}"` : 'Belum ada project tercatat.'}
                </div>
              ) : hasilCari.map(p => (
                <button key={p.canonical} onClick={() => bukaProject(p)}
                  className={`w-full text-left px-2 py-2.5 rounded-lg hover:bg-indigo-50/60 transition-colors flex items-center justify-between gap-2 ${dipilih?.canonical === p.canonical ? 'bg-indigo-50' : ''}`}>
                  <span className="text-sm font-semibold text-gray-700 truncate">{p.display}</span>
                  <span className="flex items-center gap-1.5 text-[10px] text-gray-400 flex-shrink-0">
                    {p.jumlah.reminders > 0 && <span>🗓️{p.jumlah.reminders}</span>}
                    {p.jumlah.tickets > 0 && <span>🎫{p.jumlah.tickets}</span>}
                    {p.jumlah.requests > 0 && <span>🏗️{p.jumlah.requests}</span>}
                    {p.jumlah.reviews > 0 && <span>⭐{p.jumlah.reviews}</span>}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {dipilih && (
            <div className="space-y-4">
              <h2 className="text-lg font-black text-gray-800 flex items-center gap-2">
                <span className="w-1.5 h-6 rounded-full bg-gradient-to-b from-violet-500 to-indigo-500" />
                {dipilih.display}
              </h2>
              {memuatDetail || !detail ? (
                <div className="rounded-2xl shadow-sm p-8 text-center text-sm text-gray-400" style={KARTU}>
                  Memuat riwayat...
                </div>
              ) : (
                <>
                  <SeksiRequestSchedule data={detail.reminders} />
                  <SeksiTroubleshooting data={detail.tickets} />
                  <SeksiDesignProject data={detail.requests} />
                  <SeksiFormReview data={detail.reviews} />
                </>
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
