'use client';

/**
 * Widgets.tsx - kumpulan widget reusable + Widget Registry.
 *
 * Setiap widget: komponen mandiri yang fetch datanya sendiri & render 1 kartu.
 * Registry (WIDGETS) = metadata deklaratif (id, permission, priority, size,
 * Component). Permission Resolver ada di permissions.ts. Proses compose
 * (filter  sort  render) ada di PermissionAwareDashboard.tsx.
 *
 * Prinsip: widget = RINGKASAN untuk homepage, bukan list otoritatif - angka &
 * beberapa item terbaru, lalu "Lihat semua" membuka menu aslinya.
 */

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '../shared';
import { hasMenu, canAccessAnalytics, canSeeTeamMonitoring } from './permissions';
import {
  getMonday, getDayDate, toKey, DAYS_OF_WEEK, getRollingNameForDate, type PiketRow,
} from '@/app/picket-showroom/_components/shared';
import { AnalyticsPlatform } from '@/app/analytics-dashboard/_components/AnalyticsPlatform';
import { ASSIGNABLE_PTS_TEAMS } from '@/lib/teams';
import { ambilRingkasanPerforma, type RingkasanPerforma } from '@/lib/ringkasan-performa';

// Kontrak widget

export interface WidgetProps {
  user: User;
  openMenu: (key: string) => void;            // buka menu by key (reuse handleMenuClick di page)
  openUrl: (url: string, title: string) => void; // buka halaman internal full-screen (mis. Analytics)
}

export type WidgetSize = 'sm' | 'md' | 'lg' | 'full';

export interface WidgetDef {
  id: string;
  permission: (u: User) => boolean;
  priority: number;
  size: WidgetSize;
  Component: React.FC<WidgetProps>;
}

const todayStr = () => new Date().toISOString().split('T')[0];

// UI primitives

function WidgetCard({ title, icon, accent, children, onSeeAll, seeAllLabel }: {
  title: string; icon: string; accent: string;
  children: React.ReactNode; onSeeAll?: () => void; seeAllLabel?: string;
}) {
  return (
    <div className="rounded-2xl bg-white/95 backdrop-blur-sm shadow-lg border border-black/5 p-4 flex flex-col h-full"
      style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
          style={{ background: `${accent}1a`, color: accent }}>{icon}</div>
        <h3 className="font-bold text-slate-800 text-sm truncate flex-1">{title}</h3>
        {onSeeAll && (
          <button onClick={onSeeAll}
            className="text-[11px] font-semibold px-2 py-1 rounded-lg transition-all hover:scale-[1.03] flex-shrink-0"
            style={{ background: `${accent}14`, color: accent }}>
            {seeAllLabel ?? 'Lihat semua'} →
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

function StatPills({ items }: { items: { label: string; value: number; color: string }[] }) {
  return (
    <div className="grid grid-cols-3 gap-2 mb-3">
      {items.map((s, i) => (
        <div key={i} className="rounded-xl px-2 py-2 text-center" style={{ background: `${s.color}12` }}>
          <div className="text-lg font-black leading-none" style={{ color: s.color }}>{s.value}</div>
          <div className="text-[10px] font-semibold text-slate-500 mt-1 leading-tight">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

function MiniRow({ title, sub, tone }: { title: string; sub: string; tone?: string }) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-slate-100 last:border-0">
      <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: tone ?? '#94a3b8' }} />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-slate-700 truncate">{title}</div>
        <div className="text-[10px] text-slate-400 truncate">{sub}</div>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="flex items-center justify-center h-full min-h-[60px] text-[11px] text-slate-400 text-center px-2">{text}</div>;
}

function Loading() {
  return (
    <div className="flex items-center justify-center h-full min-h-[80px]">
      <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'rgba(226,168,75,0.25)', borderTopColor: '#e2a84b' }} />
    </div>
  );
}

// WIDGET: Analytics (native) - render AnalyticsPlatform LANGSUNG (BUKAN iframe),
// lengkap dgn tab Analytics / Command Center / Audit Log. Tema analytics penuh utk
// Admin/Team, digabung ke dashboard. Widget ringkasan personal disembunyikan utk
// role ini (`!canAccessAnalytics`)  anti-duplikat.
const AnalyticsNativeWidget: React.FC<WidgetProps> = ({ user }) => (
  <AnalyticsPlatform embedded injectedUser={user} />
);

// WIDGET: Team Monitoring Hari Ini (Team/Admin).
interface Anggota {
  id: string; name: string; reported: boolean; active: number;
  jabatan: string; atasanId: string | null;
}

/**
 * Enam angka Ringkasan Performa, ditempatkan di ruang kosong sebelah kanan
 * Team Monitoring. Angkanya dari lib/ringkasan-performa.ts - satu-satunya
 * tempat rumusnya ditulis, supaya tidak ada dua definisi untuk angka yang sama.
 */
function KartuPerforma({ r }: { r: RingkasanPerforma }) {
  const item = [
    { label: 'Avg. Resolusi', nilai: `${r.avgResolusiHari} hari`,              warna: '#ef4444', ikon: '⏱️' },
    { label: 'Solved Hari Ini', nilai: `${r.solvedHariIni} ticket`,            warna: '#10b981', ikon: '✅' },
    { label: 'Reminder Overdue', nilai: `${r.reminderOverdue} jadwal`,         warna: '#f59e0b', ikon: '🔴' },
    { label: 'Piket Minggu Ini', nilai: `${r.piketTerisi}/${r.piketTotal} hari`, warna: '#6366f1', ikon: '🏪' },
    { label: 'Tamu Hari Ini', nilai: `${r.tamuHariIni} orang`,                 warna: '#0891b2', ikon: '👤' },
    { label: 'LC Avg. Skor', nilai: `${r.lcAvgSkor} poin`,                     warna: '#8b5cf6', ikon: '🎓' },
  ];
  return (
    <div>
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Ringkasan Performa</div>
      {/*
        3 kolom x 2 baris, dan tiap ubin MENUMPUK ke bawah (ikon+angka di
        atas, label di bawahnya) - bukan sebaris ikon|label|angka.
        Dua percobaan sebelumnya salah dengan cara yang berlawanan: grid
        6-kolom membentang panjang ke samping, lalu tumpukan 1-kolom jadi
        tiang tinggi kurus yang memotong labelnya sendiri jadi "REMINDER
        OV...". Bentuk ubin memecah label ke dua baris, jadi 'Reminder
        Overdue' muat utuh di lebar ~92px tanpa dipotong.
        Hasilnya blok ~300x110px - kira-kira setinggi daftar namanya, jadi
        keduanya berdampingan rapi alih-alih satu jangkung sendirian.
      */}
      <div className="grid grid-cols-3 gap-1.5">
        {item.map(m => (
          <div key={m.label} className="rounded-lg px-1 py-1.5 text-center border border-slate-100"
            style={{ background: `${m.warna}0d` }}>
            <div className="text-[11px] leading-none mb-0.5">{m.ikon}</div>
            <div className="text-[12px] font-black leading-none whitespace-nowrap" style={{ color: m.warna }}>{m.nilai}</div>
            <div className="text-[8px] font-bold text-slate-400 uppercase leading-tight mt-1">{m.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// WIDGET: Team Monitoring Hari Ini (Team/Admin).
const TeamMonitoringWidget: React.FC<WidgetProps> = ({ user, openMenu }) => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Anggota[]>([]);
  /** Nama & jabatan tiap atasan, dipakai sebagai judul kelompok. */
  const [atasan, setAtasan] = useState<Record<string, { nama: string; jabatan: string }>>({});
  /**
   * Ringkasan performa HANYA untuk admin. Angkanya lingkup seluruh platform
   * tanpa saringan per-supervisor; untuk admin itu memang benar, sedangkan
   * Supervisor PTS tetap memakai kartu lama di tab Analytics yang sudah
   * menyaring ke anggota timnya. Lihat catatan di lib/ringkasan-performa.ts.
   */
  const adminPenuh = ['admin', 'superadmin'].includes((user?.role ?? '').toLowerCase());
  const [performa, setPerforma] = useState<RingkasanPerforma | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const today = todayStr();
        const [{ data: team }, { data: reports }, { data: rems }] = await Promise.all([
          //  atasan_id & jabatan ikut diambil supaya daftarnya bisa disusun
          //  mengikuti struktur organisasi, bukan sekadar urutan abjad.
          //  Keduanya dari users (sql/user-hierarchy-atasan.sql) - satu sumber
          //  kebenaran yang sama dipakai Incentive PTS.
          supabase.from('users').select('id, username, full_name, team_type, jabatan, atasan_id').eq('role', 'team')
            .in('team_type', [...ASSIGNABLE_PTS_TEAMS]),  // IVP & MVI saja (UMP hanya utk Piket Showroom)
          supabase.from('daily_reports').select('user_id').eq('report_date', today),
          supabase.from('reminders').select('assigned_to').eq('due_date', today).neq('status', 'done').neq('status', 'cancelled'),
        ]);
        const reported = new Set((reports ?? []).map((r: any) => r.user_id));
        const activeBy: Record<string, number> = {};
        (rems ?? []).forEach((r: any) => { if (r.assigned_to) activeBy[r.assigned_to] = (activeBy[r.assigned_to] ?? 0) + 1; });
        const list: Anggota[] = (team ?? []).map((m: any) => ({
          id: m.id as string, name: m.full_name as string, reported: reported.has(m.id),
          active: activeBy[m.username] ?? 0,
          jabatan: (m.jabatan as string) ?? '', atasanId: (m.atasan_id as string) ?? null,
        })).sort((a: Anggota, b: Anggota) => Number(a.reported) - Number(b.reported) || b.active - a.active);

        //  Atasan boleh siapa saja - termasuk Manager di luar daftar team PTS
        //  di atas (mis. role admin). Karena itu namanya diambil terpisah,
        //  bukan dicari di dalam `list`; kalau tidak, kelompoknya muncul
        //  tanpa nama untuk atasan yang bukan anggota team.
        const idAtasan = Array.from(new Set(list.map(m => m.atasanId).filter(Boolean))) as string[];
        let peta: Record<string, { nama: string; jabatan: string }> = {};
        if (idAtasan.length) {
          const { data: bos } = await supabase.from('users').select('id, full_name, jabatan').in('id', idAtasan);
          (bos ?? []).forEach((b: any) => { peta[b.id] = { nama: b.full_name ?? '—', jabatan: b.jabatan ?? '' }; });
        }
        if (alive) { setRows(list); setAtasan(peta); }
        //  Dimuat terpisah dari daftar tim: kalau salah satunya gagal,
        //  yang lain tetap tampil - widget setengah terisi jauh lebih
        //  berguna daripada widget kosong.
        if (adminPenuh) {
          try { const rp = await ambilRingkasanPerforma(); if (alive) setPerforma(rp); }
          catch { /* diam - bagian daftar tim tetap tampil */ }
        }
      } catch { /* silent */ }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [adminPenuh]);

  if (loading) return <WidgetCard title="Team Monitoring Hari Ini" icon="🧭" accent="#0891b2"><Loading /></WidgetCard>;

  const total = rows.length;
  const sudah = rows.filter(r => r.reported).length;
  const belum = total - sudah;
  const pct = total > 0 ? Math.round((sudah / total) * 100) : 0;
  const belumList = rows.filter(r => !r.reported);

  //  Susun per atasan. Tanpa ini daftarnya cuma deretan nama tanpa keterangan
  //  siapa membawahi siapa - dan itu yang membuatnya sulit dibaca saat
  //  anggotanya banyak.
  //
  //  Orang yang TIDAK punya atasan adalah puncak struktur (Manager/Direktur),
  //  bukan data yang belum diisi. Melabelinya "Belum diatur atasannya" salah,
  //  dan tampak makin janggal karena ia biasanya sudah muncul di sebelahnya
  //  sebagai kepala kelompoknya sendiri - jadi namanya seolah tampil dua kali
  //  dengan dua arti berbeda.
  //
  //  Maka: kalau ia memang kepala sebuah kelompok di daftar ini, tandai saja
  //  JUDUL kelompoknya (titik di sebelah namanya) - tidak perlu kelompok
  //  terpisah. Yang benar-benar yatim (tanpa atasan DAN tanpa bawahan yang
  //  belum lapor) tetap ditampilkan di kelompok "Lainnya"; membuangnya akan
  //  menyembunyikan orang yang justru belum lapor - persis kebalikan dari
  //  guna widget ini, dan akan membuat angka di lencana tidak cocok dengan
  //  jumlah nama yang terlihat.
  const kelompok = (() => {
    const punyaBawahan = new Set(belumList.map(m => m.atasanId).filter(Boolean) as string[]);
    const peta = new Map<string, {
      kunci: string; nama: string; jabatan: string; anggota: Anggota[]; ketuaBelumLapor: boolean;
    }>();

    const ambil = (kunci: string, nama: string, jabatan: string) => {
      if (!peta.has(kunci)) peta.set(kunci, { kunci, nama, jabatan, anggota: [], ketuaBelumLapor: false });
      return peta.get(kunci)!;
    };

    for (const m of belumList) {
      if (m.atasanId) {
        const bos = atasan[m.atasanId];
        ambil(m.atasanId, bos?.nama ?? '—', bos?.jabatan ?? '').anggota.push(m);
      } else if (punyaBawahan.has(m.id)) {
        //  Dia sendiri kepala kelompok di daftar ini - cukup tandai judulnya.
        ambil(m.id, m.name, m.jabatan).ketuaBelumLapor = true;
      } else {
        ambil('(lainnya)', 'Lainnya', '').anggota.push(m);
      }
    }

    //  Kelompok terbesar dulu; "Lainnya" selalu paling belakang supaya tidak
    //  menyela struktur yang sudah benar.
    return Array.from(peta.values()).sort((a, b) =>
      Number(a.kunci === '(lainnya)') - Number(b.kunci === '(lainnya)')
      || b.anggota.length - a.anggota.length
      || a.nama.localeCompare(b.nama));
  })();

  return (
    <WidgetCard title="Team Monitoring Hari Ini" icon="🧭" accent="#0891b2"
      onSeeAll={() => openMenu('daily-report')} seeAllLabel="Daily Report">
      {total === 0 ? (
        <EmptyState text="Belum ada anggota Team PTS terdaftar." />
      ) : (
        // TIGA kolom di layar lebar: stat, nama, performa.
        //
        // Kolom nama SENGAJA dibatasi minmax(0,44rem), BUKAN 1fr. Dengan 1fr
        // ia menyerap seluruh sisa lebar kartu, jadi meski isinya cuma tiga
        // kelompok nama, Performa tetap terdorong sampai menempel tepi kanan
        // dan menyisakan jurang kosong di tengah. justify-start menahan
        // ketiganya berkumpul di kiri supaya Performa berdiri tepat di
        // sebelah daftar namanya. Di layar sempit ketiganya turun bertumpuk.
        //
        // Batas 44rem dipilih dengan diukur, bukan dikira: pada 34rem daftar
        // nama membungkus jadi dua baris dan menyisakan lubang di tengah,
        // sedangkan 44rem memuat kelompok-kelompoknya dalam satu baris dan
        // memangkas sisa kosong di kanan kartu dari 462px jadi 302px.
        <div className="grid grid-cols-1 lg:grid-cols-[190px_minmax(0,44rem)_auto] lg:justify-start gap-x-5 gap-y-3">
          {/* Kiri: ringkasan angka + progress */}
          <div>
            <StatPills items={[
              //  'Total', bukan 'Total Team': kolom kiri kini 190px, dan pada
              //  grid 3 pil itu menyisakan ~42px per pil - 'Total Team' pecah jadi
              //  dua baris di sana. Judul widget sudah menyebut Team.
              { label: 'Total', value: total, color: '#0891b2' },
              { label: 'Sudah', value: sudah, color: '#16a34a' },
              { label: 'Belum', value: belum, color: belum > 0 ? '#ea580c' : '#94a3b8' },
            ]} />
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct >= 80 ? '#16a34a' : pct >= 50 ? '#f59e0b' : '#ea580c' }} />
              </div>
              <span className="text-[11px] font-bold text-slate-600">{pct}% update</span>
            </div>
          </div>
          {/* Kanan: yang belum daily report, dikelompokkan per atasan */}
          <div className="min-w-0">
            {belumList.length === 0 ? (
              <div className="text-xs font-semibold text-green-600 flex items-center h-full min-h-[60px]">🎉 Semua tim sudah update Daily Report hari ini!</div>
            ) : (
              <>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Belum Daily Report ({belumList.length})</div>
                {/*
                  flex-wrap, BUKAN grid berkolom tetap. Grid `xl:grid-cols-3`
                  yang lama membagi seluruh lebar kartu jadi tiga kolom sama
                  besar, jadi tiga nama pendek pun terlempar sampai ke tepi
                  kanan dan menyisakan jarak kosong yang lebar di antaranya.
                  Dengan flex-wrap tiap kelompok selebar isinya sendiri lalu
                  membungkus ke bawah - ruang yang dipakai mengikuti panjang
                  nama, bukan lebar layar.
                */}
                <div className="flex flex-wrap gap-x-5 gap-y-2.5">
                  {kelompok.map(g => (
                    <div key={g.kunci} className="min-w-0">
                      <div className="flex items-baseline gap-1.5 mb-0.5 pl-0.5">
                        {/*
                          Titik oranye di judul = ketua kelompoknya sendiri yang
                          belum lapor. Ini menggantikan kelompok "Belum diatur
                          atasannya" yang dulu memuat orang-orang puncak struktur
                          dan karena itu salah label.
                        */}
                        {g.ketuaBelumLapor && (
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 self-center" style={{ background: '#f59e0b' }}
                            title="Belum daily report" />
                        )}
                        {/* Judul kelompok naik dari text-[10px]: keluhannya nama terlalu kecil, dan judul induknya harus tetap lebih tegas dari nama anggotanya. */}
                        <span className={`text-[11px] font-bold truncate max-w-[170px] ${g.ketuaBelumLapor ? 'text-amber-600' : 'text-slate-500'}`}>{g.nama}</span>
                        {g.jabatan && (
                          <span className="text-[10px] font-semibold text-slate-400 flex-shrink-0">{g.jabatan}</span>
                        )}
                        {g.anggota.length > 0 && (
                          <span className="text-[10px] font-bold text-slate-300 flex-shrink-0">{g.anggota.length}</span>
                        )}
                      </div>
                      {/* garis tepi kiri = penanda "ini bawahannya" */}
                      <div className="border-l-2 border-slate-200 pl-1.5 ml-0.5">
                        {g.anggota.map(r => (
                          <button key={r.id} onClick={() => openMenu('daily-report')}
                            className="flex items-center gap-1.5 py-1 px-1 w-full hover:bg-slate-50 rounded-md transition-colors text-left">
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: r.active > 0 ? '#dc2626' : '#f59e0b' }} />
                            {/*
                              Nama anggota - INI yang dikeluhkan terlalu kecil.
                              text-[11px] -> text-[13px], dan max-w ikut
                              diperlebar supaya nama yang lebih besar tidak
                              lebih cepat kepotong "...".
                            */}
                            <span className="text-[13px] font-semibold text-slate-700 truncate max-w-[170px]">{r.name}</span>
                            {r.active > 0 && (
                              <span className="text-[10px] font-bold px-1 py-px rounded-full flex-shrink-0"
                                style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626' }}>{r.active}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          {/*
            Kolom KETIGA, bukan ditumpuk di bawah daftar nama. mt-3
            border-t di layar sempit (satu kolom) supaya masih ada
            pemisah visual saat ketiganya turun jadi bertumpuk.
          */}
          {adminPenuh && performa && (
            <div className="lg:w-[300px] mt-3 lg:mt-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
              <KartuPerforma r={performa} />
            </div>
          )}
        </div>
      )}
    </WidgetCard>
  );
};

// WIDGET: Analytics Saya (Sales/Marketing) - tema analytics, DATA MILIK SENDIRI.
// Menggabung 4 platform: Request Schedule, Request Design Project, Form Review BAST,
// Ticket Troubleshooting. Tiap panel hanya muncul kalau user punya menunya.
interface SalesAnalytics {
  schedule: { total: number; active: number; done: number };
  project: { total: number; pending: number; progress: number; done: number };
  review: { total: number; demo: number; bast: number };
  ticket: { total: number; open: number; solved: number };
}

/**
 * Kartu ini menampilkan satu angka utama PLUS rincian pecahannya, jadi tidak
 * bisa langsung memakai StatCard bersama (yang hanya membawa satu angka).
 * Gayanya disamakan secara manual: permukaan putih, angka gelap, dan warna
 * kategori dipakai sebagai pita tepi - persis seperti StatCard.
 */
function AnalyticStat({ accent, label, value, subs }: {
  accent: string; label: string; value: number;
  subs: { label: string; value: number }[];
}) {
  return (
    <div className="rounded-xl px-3 py-2.5 sm:px-4 sm:py-3.5 relative overflow-hidden"
      style={{ background: '#ffffff', border: '1px solid rgba(15,23,42,0.10)', boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: accent, opacity: 0.55 }} />
      <div className="text-2xl sm:text-3xl font-black tabular-nums leading-none" style={{ color: '#0f172a' }}>{value}</div>
      <div className="text-[11px] sm:text-[13px] font-bold mt-1 leading-tight" style={{ color: '#1e293b' }}>{label}</div>
      <div className="flex gap-2 sm:gap-3 mt-2 sm:mt-2.5">
        {subs.map((s, i) => (
          <div key={i}>
            <div className="text-sm font-black tabular-nums leading-none text-slate-700">{s.value}</div>
            <div className="text-[9px] text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Pintasan membuat data baru dari dashboard.
 *
 * Ikon kirim yang sama dengan tombol Submit Form di tiap platform, supaya
 * jelas sejak dari dashboard bahwa tombol ini bermuara ke sebuah form - bukan
 * ke tabel. Ukurannya sengaja jauh lebih besar daripada tautan teks yang dulu
 * ada di sini: inilah aksi yang paling sering dipakai Sales dari halaman ini.
 */
function PintasanBuat({ label, warna, onClick }: { label: string; warna: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 rounded-xl text-white font-bold text-xs transition-all hover:scale-[1.02] text-left"
      style={{ background: warna, boxShadow: `0 4px 14px ${warna}59` }}>
      <span className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.22)' }}>
        <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      </span>
      <span className="leading-tight whitespace-nowrap">
        <span className="block opacity-80 text-[9px] font-semibold">Buat</span>
        <span className="block">{label}</span>
      </span>
    </button>
  );
}

const SalesAnalyticsWidget: React.FC<WidgetProps> = ({ user, openUrl }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SalesAnalytics | null>(null);
  const showSchedule = hasMenu(user, 'reminder-schedule');
  const showProject  = hasMenu(user, 'request-design-project');
  const showReview   = hasMenu(user, 'form-bast');
  const showTicket   = hasMenu(user, 'ticket-troubleshooting');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Scope "data sendiri": cocokkan lewat created_by (username) ATAU nama sales
        // (full_name) - menangkap request/tiket yg dia buat maupun yg atas namanya.
        const [remRes, prRes, rvRes, tkRes] = await Promise.all([
          showSchedule ? supabase.from('reminders').select('status').or(`sales_name.eq.${user.full_name},created_by.eq.${user.username}`) : Promise.resolve({ data: [] }),
          showProject  ? supabase.from('project_requests').select('status').or(`requester_id.eq.${user.id},ivp_assignee.eq.${user.full_name}`) : Promise.resolve({ data: [] }),
          showReview   ? supabase.from('form_reviews').select('review_category').or(`guest_username.eq.${user.username},sales_name.eq.${user.full_name}`) : Promise.resolve({ data: [] }),
          showTicket   ? supabase.from('tickets').select('status').or(`created_by.eq.${user.username},sales_name.eq.${user.full_name}`) : Promise.resolve({ data: [] }),
        ]);
        const rem = (remRes.data ?? []) as { status: string }[];
        const pr  = (prRes.data ?? []) as { status: string }[];
        const rv  = (rvRes.data ?? []) as { review_category: string }[];
        const tk  = (tkRes.data ?? []) as { status: string }[];
        if (alive) setData({
          schedule: {
            total: rem.length,
            active: rem.filter(r => r.status !== 'done' && r.status !== 'cancelled').length,
            done: rem.filter(r => r.status === 'done').length,
          },
          project: {
            total: pr.length,
            pending: pr.filter(p => p.status === 'pending').length,
            progress: pr.filter(p => p.status === 'in_progress' || p.status === 'approved').length,
            done: pr.filter(p => p.status === 'completed').length,
          },
          review: {
            total: rv.length,
            demo: rv.filter(r => (r.review_category ?? '').toLowerCase().includes('demo')).length,
            bast: rv.filter(r => (r.review_category ?? '').toLowerCase().includes('bast')).length,
          },
          ticket: {
            total: tk.length,
            open: tk.filter(t => t.status !== 'Solved').length,
            solved: tk.filter(t => t.status === 'Solved').length,
          },
        });
      } catch { /* silent */ }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [user, showSchedule, showProject, showReview, showTicket]);

  return (
    <WidgetCard title="Analytics Saya" icon="📊" accent="#c8861d">
      {loading || !data ? <Loading /> : (
        <>
          {/* Dua kolom sejak layar tersempit: satu kolom membuat empat kartu
              memakan hampir seluruh layar ponsel, sehingga pintasan di bawahnya
              baru terlihat setelah menggulir jauh. */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-3">
            {showSchedule && (
              <AnalyticStat accent="#0e7490" label="Request Schedule" value={data.schedule.total}
                subs={[{ label: 'Aktif', value: data.schedule.active }, { label: 'Selesai', value: data.schedule.done }]} />
            )}
            {showProject && (
              <AnalyticStat accent="#6d28d9" label="Design Project" value={data.project.total}
                subs={[{ label: 'Pending', value: data.project.pending }, { label: 'Proses', value: data.project.progress }, { label: 'Selesai', value: data.project.done }]} />
            )}
            {showReview && (
              <AnalyticStat accent="#475569" label="Form Review/BAST" value={data.review.total}
                subs={[{ label: 'Demo', value: data.review.demo }, { label: 'BAST', value: data.review.bast }]} />
            )}
            {showTicket && (
              <AnalyticStat accent="#be123c" label="Ticket" value={data.ticket.total}
                subs={[{ label: 'Aktif', value: data.ticket.open }, { label: 'Solved', value: data.ticket.solved }]} />
            )}
          </div>
          {/* Batang kategori Request Schedule dihapus: angkanya sudah terbaca
              utuh di kartu ringkasan tepat di atasnya, jadi ia hanya mengulang
              hal yang sama dengan bentuk lain dan mendorong pintasan turun.

              ── Pintasan BUAT, bukan pintasan LIHAT ──────────────────────────
              Tiga tombol ini dulu hanya membuka daftarnya, padahal yang paling
              sering dituju Sales dari dashboard adalah membuat yang baru.
              Sekarang tautannya membawa ?buat=1 dan halaman tujuanlah yang
              memutuskan boleh atau tidak — mis. Request Schedule tetap menahan
              Sales yang masih punya form review belum dinilai. Dashboard tidak
              ikut memutuskan, supaya aturannya tidak ada dua salinan. */}
          {/* Seukuran isinya dan rata kiri, bukan melebar memenuhi frame:
              tombol selebar layar membuat aksi terasa seberat seluruh kartu,
              padahal ia cuma pintasan. */}
          <div className="flex flex-wrap gap-2 mt-3">
            {showSchedule && (
              <PintasanBuat label="Request Schedule" warna="#0891b2"
                onClick={() => openUrl('/reminder-schedule?buat=1', 'Request Schedule')} />
            )}
            {showProject && (
              <PintasanBuat label="Design Project" warna="#7c3aed"
                onClick={() => openUrl('/form-require-project?buat=1', 'Request Design Project')} />
            )}
            {showTicket && (
              <PintasanBuat label="Ticket" warna="#e11d48"
                onClick={() => openUrl('/ticketing?buat=1', 'Ticket Troubleshooting')} />
            )}
          </div>
        </>
      )}
    </WidgetCard>
  );
};

// WIDGET: Learning (menu learning-center) - CTA ringkas.
const LearningWidget: React.FC<WidgetProps> = ({ openMenu }) => (
  <WidgetCard title="Learning Center" icon="🎓" accent="#4338ca">
    <div className="flex flex-col items-center justify-center h-full text-center gap-2 py-2">
      <div className="text-3xl">🎓</div>
      <p className="text-[11px] text-slate-500 leading-snug px-2">Training, quiz online & materi pengembangan tim.</p>
      <button onClick={() => openMenu('learning-center')}
        className="mt-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:scale-[1.03]"
        style={{ background: 'linear-gradient(135deg,#4338ca,#6366f1)' }}>Buka Learning →</button>
    </div>
  </WidgetCard>
);

// WIDGET: Piket Showroom - siapa PIC piket hari ini + minggu ini.
// Muncul utk SEMUA role (info penting bersama: Sales/Marketing perlu tahu PIC).
// Nama PIC dihitung dgn getRollingNameForDate - SAMA persis dgn halaman Piket.
interface PicketDay { day: string; dateKey: string; name: string; isToday: boolean; team: string; }

const ShowroomWidget: React.FC<WidgetProps> = ({ openMenu }) => {
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<PicketDay[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [rowsRes, holRes, usersRes] = await Promise.all([
          supabase.from('piket_schedules').select('id,day_date,week_start,day_of_week,pic_ivp_id,pic_ivp_name,pic_ump_id,pic_ump_name,pic_mvi_id,pic_mvi_name'),
          supabase.from('picket_holidays').select('date'),
          supabase.from('users').select('full_name, team_type').in('team_type', ['Team PTS IVP', 'Team PTS UMP', 'Team PTS MVI']),
        ]);
        const allRows = (rowsRes.data ?? []) as unknown as PiketRow[];
        const holidays = (holRes.data ?? []).map((h: any) => h.date as string);
        const teamByName: Record<string, string> = {};
        (usersRes.data ?? []).forEach((u: any) => { if (u.full_name) teamByName[u.full_name] = u.team_type ?? ''; });
        const monday = getMonday(new Date());
        const todayKey = toKey(new Date());
        const list: PicketDay[] = DAYS_OF_WEEK.map((day) => {
          const date = getDayDate(monday, day);
          const name = getRollingNameForDate(date, allRows, holidays);
          return { day, dateKey: toKey(date), name, isToday: toKey(date) === todayKey, team: name ? (teamByName[name] ?? '') : '' };
        });
        if (alive) setDays(list);
      } catch { /* silent */ }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  if (loading) return <WidgetCard title="Piket Showroom" icon="🏪" accent="#0d9488"><Loading /></WidgetCard>;
  const today = days.find(d => d.isToday);

  return (
    <WidgetCard title="Piket Showroom" icon="🏪" accent="#0d9488" onSeeAll={() => openMenu('picket-showroom')}>
      <div className="rounded-xl p-3 mb-3 text-center" style={{ background: 'rgba(13,148,136,0.1)' }}>
        <div className="text-[10px] font-bold text-teal-600 uppercase tracking-wide">PIC Piket Hari Ini</div>
        {today && today.name ? (
          <>
            <div className="text-base font-black text-slate-800 mt-0.5">{today.name}</div>
            {today.team && <div className="text-[10px] text-slate-500">{today.team.replace('Team ', '')}</div>}
          </>
        ) : (
          <div className="text-xs font-semibold text-slate-400 mt-1">Tidak ada piket (libur / akhir pekan)</div>
        )}
      </div>
      <div>
        {days.map(d => (
          <div key={d.day} className="flex items-center gap-2 py-1.5 px-1 border-b border-slate-100 last:border-0"
            style={d.isToday ? { background: 'rgba(13,148,136,0.06)', borderRadius: 8 } : undefined}>
            <span className="text-[11px] font-bold w-12 flex-shrink-0" style={{ color: d.isToday ? '#0d9488' : '#94a3b8' }}>{d.day}</span>
            <span className="text-xs font-semibold text-slate-700 truncate flex-1">{d.name || <span className="text-slate-300">— kosong</span>}</span>
            {d.isToday && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: '#0d9488', color: 'white' }}>Hari ini</span>}
          </div>
        ))}
      </div>
    </WidgetCard>
  );
};

// WIDGET REGISTRY - metadata deklaratif. Compose di PermissionAwareDashboard.
export const WIDGETS: WidgetDef[] = [
  // Team Monitoring paling atas utk Admin/Team (full width) - jawab "mana report tim".
  { id: 'team-monitoring', permission: canSeeTeamMonitoring, priority: 1, size: 'full', Component: TeamMonitoringWidget },
  // Analytics native (DashboardKPI, tanpa iframe) - tema analytics penuh utk Admin/Team.
  // Sudah memuat Ticket/Reminder/Piket/Unit/Pengguna/Learning  widget di bawah
  // DISEMBUNYIKAN utk role ini (`!canAccessAnalytics`) supaya TIDAK duplikat data.
  { id: 'analytics',       permission: canAccessAnalytics,   priority: 2, size: 'full', Component: AnalyticsNativeWidget },
  // Analytics Saya (Sales/Marketing) - tema analytics, DATA SENDIRI, 4 platform.
  // Hanya utk role TANPA analytics global & punya minimal 1 dari 4 menu terkait.
  { id: 'sales-analytics', permission: (u) => !canAccessAnalytics(u) && (hasMenu(u, 'reminder-schedule') || hasMenu(u, 'request-design-project') || hasMenu(u, 'form-bast') || hasMenu(u, 'ticket-troubleshooting')), priority: 3, size: 'full', Component: SalesAnalyticsWidget },
  // Piket Showroom: role tanpa analytics (Admin/Team sudah lihat piket di dalam analytics).
  { id: 'showroom',        permission: (u) => !canAccessAnalytics(u),               priority: 6, size: 'md', Component: ShowroomWidget },
  { id: 'learning',        permission: (u) => hasMenu(u, 'learning-center')        && !canAccessAnalytics(u), priority: 7, size: 'sm', Component: LearningWidget },
];
