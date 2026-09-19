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
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
    <div className="px-4 py-3 flex items-center justify-between gap-3">
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
          style={{ borderColor: 'rgba(99,102,241,0.2)', borderTopColor: '#4f46e5' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <Toast notif={toast} />
      <div className="max-w-5xl mx-auto space-y-5">
        <header className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-black text-gray-800 flex items-center gap-2">🗂️ Summary Project</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Riwayat Request Schedule, Troubleshooting, Design Project & Form Review dalam satu tempat, per nama project.
            </p>
          </div>
          {isAdmin && (
            <button onClick={() => setShowLinkManual(true)}
              className="px-3 py-2 rounded-lg text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100">
              🔗 Kelola Link Manual
            </button>
          )}
        </header>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
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
                className={`w-full text-left px-2 py-2.5 rounded-lg hover:bg-gray-50 flex items-center justify-between gap-2 ${dipilih?.canonical === p.canonical ? 'bg-indigo-50' : ''}`}>
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
            <h2 className="text-lg font-black text-gray-800">{dipilih.display}</h2>
            {memuatDetail || !detail ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-sm text-gray-400">
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
