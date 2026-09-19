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
import { namaKelompokPTS } from '@/lib/kelompok';
import type { User } from '../shared';
import { hasMenu, canAccessAnalytics, canSeeTeamMonitoring } from './permissions';
import {
  getMonday, getDayDate, toKey, DAYS_OF_WEEK, getRollingNameForDate, type PiketRow,
} from '@/app/picket-showroom/_components/shared';
import { AnalyticsPlatform } from '@/app/analytics-dashboard/_components/AnalyticsPlatform';
import { ASSIGNABLE_PTS_TEAMS } from '@/lib/teams';
import { isSalesGuest } from '@/lib/constants';
import { ambilPeringkatSaya, type HasilPeringkat } from '@/lib/learning-rank';
import { PopupJawabanQuiz } from './PopupJawabanQuiz';
import { SalesAnalyticsWidget, hasSalesAnalyticsData } from './SalesAnalyticsWidget';

// Kontrak widget + primitif UI - dipindah ke primitives.tsx supaya widget
// Work Center (../workcenter/) bisa memakainya tanpa circular import (lihat
// komentar di primitives.tsx). Diimpor ulang di sini + di-export lagi supaya
// pemakai lama (PermissionAwareDashboard.tsx) tidak perlu ganti sumber impor.
import {
  type WidgetProps, type WidgetSize, type WidgetDef,
  WidgetCard, EmptyState, Loading,
} from './primitives';
export type { WidgetProps, WidgetSize, WidgetDef };
export { WidgetCard, EmptyState, Loading };
import WorkQueueSection from '../workcenter/WorkQueueSection';

const todayStr = () => new Date().toISOString().split('T')[0];

/**
 * Tiga angka ringkas Team Monitoring.
 *
 * Dulu tiap angka duduk di kotak pastel sendiri - bahasa visual yang tidak
 * dipakai di mana pun lagi sesudah ubin Analytics disatukan, jadi bagian atas
 * dashboard terbaca seperti tempelan dari aplikasi lain. Sekarang angkanya
 * telanjang seperti di kartu Learning Center: titik kecil berwarna membawa
 * identitasnya, angkanya sendiri tetap tinta gelap supaya terbaca sebagai
 * bilangan, bukan sebagai status.
 */
function StatPills({ items }: { items: { label: string; value: number; color: string }[] }) {
  return (
    <div className="grid grid-cols-3 gap-3 mb-3">
      {items.map((s, i) => (
        <div key={i} className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span aria-hidden="true" className="w-2 h-2 rounded-[3px] flex-shrink-0" style={{ background: s.color }} />
            <span className="text-[9.5px] font-black uppercase tracking-[0.07em] text-slate-400 truncate">{s.label}</span>
          </div>
          <div className="text-[26px] font-black leading-none mt-1 tabular-nums text-slate-900" style={{ letterSpacing: '-0.03em' }}>{s.value}</div>
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

// WIDGET: Team Monitoring Hari Ini (Team/Admin).
const TeamMonitoringWidget: React.FC<WidgetProps> = ({ user, openMenu }) => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Anggota[]>([]);
  /** Nama & jabatan tiap atasan, dipakai sebagai judul kelompok. */
  const [atasan, setAtasan] = useState<Record<string, { nama: string; jabatan: string }>>({});
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
      } catch { /* silent */ }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

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
  type KelompokBelum = {
    kunci: string; nama: string; jabatan: string; anggota: Anggota[]; ketuaBelumLapor: boolean;
  };
  const kelompok = (() => {
    const punyaBawahan = new Set(belumList.map(m => m.atasanId).filter(Boolean) as string[]);
    const peta = new Map<string, KelompokBelum>();

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

    /*
      Susun jadi pohon (org chart), bukan daftar rata. Sebelumnya SEMUA
      kelompok (termasuk kelompok milik seorang Supervisor yang notabene
      bawahan si Manager) ditumpuk sejajar lewat flex-wrap - jadi Manager bisa
      terlihat "kesasar" berdampingan dengan salah satu Supervisor-nya
      sendiri, padahal satu adalah atasan dari yang lain. Aturannya:
      kelompok X adalah ANAK dari kelompok lain kalau kepala kelompok X
      (person berid `X.kunci`) sendiri muncul sebagai salah satu anggota di
      kelompok manapun - posisi itu digantikan sub-pohonnya saat dirender
      (lihat renderKelompok), bukan ditumpuk lagi sebagai kelompok terpisah
      di level teratas.
    */
    const idJadiAnggota = new Set(
      Array.from(peta.values()).flatMap(g => g.anggota.map(m => m.id))
    );
    const urut = (list: KelompokBelum[]) => list.slice().sort((a, b) =>
      Number(a.kunci === '(lainnya)') - Number(b.kunci === '(lainnya)')
      || b.anggota.length - a.anggota.length
      || a.nama.localeCompare(b.nama));
    const akar = urut(Array.from(peta.values()).filter(g => !idJadiAnggota.has(g.kunci)));
    return { peta, akar };
  })();

  //  Render satu kelompok + sub-pohonnya secara rekursif. Anggota yang
  //  ternyata kepala kelompok lain (Supervisor yang bawahannya sendiri juga
  //  belum lapor) dirender sebagai sub-kelompok berindentasi, bukan baris
  //  nama biasa - garis tepi kiri jadi menumpuk mengikuti kedalaman, persis
  //  seperti struktur organisasi yang bertingkat.
  const renderKelompok = (g: KelompokBelum, depth: number): React.ReactNode => (
    <div key={g.kunci} className={depth > 0 ? 'mt-2' : ''}>
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
      {/*
        garis tepi kiri = penanda "ini bawahannya" - menumpuk per kedalaman.
        Sub-kelompok (Supervisor yang bawahannya sendiri juga belum lapor)
        SELALU baris sendiri - butuh ruang penuh untuk sub-pohonnya. Anggota
        biasa (daun, tidak punya bawahan) dibiarkan flex-wrap berdampingan -
        dulu semua baris dipaksa selebar kartu walau isinya cuma satu nama
        pendek, jadi sisi kanannya kosong sia-sia. Dipisah di sini supaya
        nama-nama pendek mengisi ruang itu, sementara sub-kelompok tetap
        dapat baris sendiri untuk indentasinya.
      */}
      <div className="border-l-2 border-slate-200 pl-1.5 ml-0.5">
        {g.anggota.filter(m => kelompok.peta.has(m.id)).map(m => renderKelompok(kelompok.peta.get(m.id)!, depth + 1))}
        <div className="flex flex-wrap">
          {g.anggota.filter(m => !kelompok.peta.has(m.id)).map(m => (
            <button key={m.id} onClick={() => openMenu('daily-report')}
              className="flex items-center gap-1.5 py-1 px-1.5 hover:bg-slate-50 rounded-md transition-colors text-left">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: m.active > 0 ? '#dc2626' : '#f59e0b' }} />
              {/*
                Nama anggota - INI yang dikeluhkan terlalu kecil.
                text-[11px] -> text-[13px], dan max-w ikut
                diperlebar supaya nama yang lebih besar tidak
                lebih cepat kepotong "...".
              */}
              <span className="text-[13px] font-semibold text-slate-700 truncate max-w-[170px]">{m.name}</span>
              {m.active > 0 && (
                <span className="text-[10px] font-bold px-1 py-px rounded-full flex-shrink-0"
                  style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626' }}>{m.active}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <WidgetCard title="Team Monitoring Hari Ini" icon="🧭" accent="#0891b2"
      onSeeAll={() => openMenu('daily-report')} seeAllLabel="Daily Report">
      {total === 0 ? (
        <EmptyState text="Belum ada anggota Team PTS terdaftar." />
      ) : (
        // DUA kolom di layar lebar: angka ringkas lalu daftar nama.
        //
        // Kolom ketiga dulu berisi "Ringkasan Performa" - enam angka yang kini
        // sudah jadi isi pita ringkas di puncak halaman. Membiarkan keduanya
        // berarti lima angka yang sama persis dicetak dua kali dalam satu layar,
        // dan pembaca yang melihat angka sama di dua tempat berbeda justru jadi
        // ragu mana yang benar. Kolom angkanya diperlebar 190px -> 220px karena
        // labelnya sekarang di atas angka, bukan di bawahnya.
        <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-x-6 gap-y-3">
          {/* Kiri: ringkasan angka + progress */}
          <div>
            <StatPills items={[
              //  'Total', bukan 'Total Team' - judul widget sudah menyebut Team.
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
                  Ditumpuk vertikal (bukan flex-wrap berdampingan) supaya
                  hierarkinya jelas: Manager selalu di atas, Supervisor
                  bawahannya berindentasi PERSIS di bawahnya (lihat
                  renderKelompok) - bukan tersusun sejajar seolah setara
                  cuma karena kebetulan sama-sama muat di baris yang sama.
                */}
                <div className="flex flex-col gap-2.5">
                  {kelompok.akar.map(g => renderKelompok(g, 0))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </WidgetCard>
  );
};


/**
 * Satu baris angka - dipakai untuk rekap nilai & peringkat di LearningWidget.
 * `sub` opsional untuk keterangan singkat ("dari 12 peserta").
 */
interface RiwayatQuizRingkas {
  id: string; score: number | null; passed: boolean | null;
  grading_status: string | null; submitted_at: string | null; sesi: string;
}

/** "19 Sep" - cukup untuk baris ringkas, tanggal lengkap ada di halaman Learning Center sendiri. */
function fmtTglSingkat(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
}

/**
 * Satu baris riwayat quiz: lencana skor + nama sesi + tanggal.
 * Lencana MENJAWAB pertanyaan yang sama seperti HistoryPage (lulus/tidak/
 * menunggu koreksi) memakai warna yang sama, cuma diperkecil supaya muat di
 * kartu widget yang sempit.
 */
function BarisRiwayatQuiz({ r, onClick }: { r: RiwayatQuizRingkas; onClick: () => void }) {
  const menunggu = r.grading_status === 'pending_review';
  const warna = menunggu ? 'bg-amber-100 text-amber-700' : r.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700';
  return (
    // Baris ini KLIK -> popup jawaban (lihat PopupJawabanQuiz), bukan cuma
    // ringkasan pasif. <button>, bukan <div onClick>, supaya bisa dijangkau
    // keyboard/pembaca layar seperti kontrol lain di platform ini.
    <button type="button" onClick={onClick}
      className="flex items-center gap-2 py-1.5 w-full text-left border-b border-indigo-100/70 last:border-0 hover:bg-indigo-100/40 rounded-lg px-1 -mx-1 transition-colors">
      <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black flex-shrink-0 ${warna}`}>
        {menunggu ? '⏳' : (r.score?.toFixed(0) ?? '—')}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-indigo-900 truncate leading-tight">{r.sesi}</p>
        {r.submitted_at && <p className="text-[9px] text-indigo-400 leading-tight mt-0.5">{fmtTglSingkat(r.submitted_at)}</p>}
      </div>
      {/*  Lencana panah, bukan sekadar chevron tipis - diminta eksplisit
          sebagai penanda "klik untuk buka popup", bukan hiasan yang gampang
          terlewat matanya di kartu sepadat ini. */}
      <span aria-hidden="true" className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 bg-indigo-100 text-indigo-500">→</span>
    </button>
  );
}

function BarisAngka({ icon, label, value, sub }: { icon: string; label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-indigo-50/70 border border-indigo-100">
      <span className="text-lg flex-shrink-0" aria-hidden="true">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] text-indigo-400 font-semibold leading-none">{label}</div>
        <div className="text-sm font-black text-indigo-800 leading-tight mt-0.5">
          {value}{sub && <span className="text-[10px] font-medium text-indigo-400 ml-1">{sub}</span>}
        </div>
      </div>
    </div>
  );
}

// WIDGET: Learning (menu learning-center).
//
// Untuk Guest/Sales, kartu ini bukan cuma CTA - ditambahkan rekap nilai &
// peringkat sendiri (Global + Divisi), supaya mereka tidak perlu membuka
// Learning Center hanya untuk tahu "skor saya berapa, peringkat saya berapa".
// Peringkatnya diambil lewat /api/learning-center/rank (lib/learning-rank.ts) -
// server yang menghitung, bukan klien menarik data seluruh peserta lalu
// menyamarkannya sendiri. Lihat catatan keamanan di route itu.
//
// Team (non-analytics) TETAP kartu CTA sederhana seperti semula - permintaan
// ini eksplisit soal pengalaman Guest, bukan Team.
const LearningWidget: React.FC<WidgetProps> = ({ user, openMenu }) => {
  const guest = isSalesGuest({ role: user.role });
  const [milikSaya, setMilikSaya] = useState<{ total: number; avg: number } | null>(null);
  const [peringkat, setPeringkat] = useState<HasilPeringkat | null>(null);
  const [loading, setLoading] = useState(guest);

  useEffect(() => {
    if (!guest) return;
    let alive = true;
    (async () => {
      const [attRes, rank] = await Promise.all([
        supabase.from('lc_quiz_attempts').select('score, grading_status')
          .eq('user_id', user.id).eq('is_submitted', true),
        ambilPeringkatSaya(),
      ]);
      if (!alive) return;
      const dinilai = ((attRes.data ?? []) as { score: number | null; grading_status: string | null }[])
        .filter(a => a.grading_status !== 'pending_review');
      setMilikSaya({
        total: dinilai.length,
        avg: dinilai.length ? dinilai.reduce((s, a) => s + (a.score ?? 0), 0) / dinilai.length : 0,
      });
      setPeringkat(rank);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [guest, user.id]);

  return (
    <WidgetCard title="Learning Center" icon="🎓" accent="#4338ca">
      {!guest ? (
        <div className="flex flex-col items-center justify-center h-full text-center gap-2 py-2">
          <div className="text-3xl">🎓</div>
          <p className="text-[11px] text-slate-500 leading-snug px-2">Training, quiz online &amp; materi pengembangan tim.</p>
          <button onClick={() => openMenu('learning-center')}
            className="mt-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:scale-[1.03]"
            style={{ background: 'linear-gradient(135deg,#4338ca,#6366f1)' }}>Buka Learning →</button>
        </div>
      ) : loading ? <Loading /> : (
        <div className="flex flex-col gap-2.5 h-full">
          <div className="grid grid-cols-2 gap-2">
            <BarisAngka icon="📝" label="Quiz Diikuti" value={String(milikSaya?.total ?? 0)} />
            <BarisAngka icon="📊" label="Rata-rata Skor" value={(milikSaya?.avg ?? 0).toFixed(0)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <BarisAngka icon="🏆" label="Peringkat Global"
              value={peringkat?.globalRank ? `#${peringkat.globalRank}` : '—'}
              sub={peringkat?.globalTotal ? `dari ${peringkat.globalTotal}` : undefined} />
            <BarisAngka icon="🏢" label={peringkat?.divisi ? `Divisi ${peringkat.divisi}` : 'Peringkat Divisi'}
              value={peringkat?.divisiRank ? `#${peringkat.divisiRank}` : '—'}
              sub={peringkat?.divisiTotal ? `dari ${peringkat.divisiTotal}` : (peringkat?.divisi ? undefined : 'Divisi belum diset')} />
          </div>
          <button onClick={() => openMenu('learning-center')}
            className="mt-auto px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:scale-[1.02] self-start"
            style={{ background: 'linear-gradient(135deg,#4338ca,#6366f1)' }}>Buka Learning →</button>
        </div>
      )}
    </WidgetCard>
  );
};

// WIDGET: Riwayat Quiz - kartu TERPISAH di sebelah Learning Center, BUKAN
// digabung ke dalamnya. Klik satu baris membuka popup soal & jawaban lewat
// PopupJawabanQuiz (dynamic import - lihat catatan di berkas itu kenapa),
// tanpa membuka menu Learning Center. Guest saja - sama seperti bagian
// statistik personal di LearningWidget, angka pribadi begini tidak relevan
// untuk Team yang cuma dapat kartu CTA polos.
const RiwayatQuizWidget: React.FC<WidgetProps> = ({ user }) => {
  const [riwayat, setRiwayat] = useState<RiwayatQuizRingkas[] | null>(null);
  const [attemptDibuka, setAttemptDibuka] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    supabase.from('lc_quiz_attempts')
      .select('id, score, passed, grading_status, submitted_at, lc_quiz_sessions(session_name)')
      .eq('user_id', user.id).eq('is_submitted', true)
      .order('submitted_at', { ascending: false }).limit(10)
      .then(({ data }: { data: any[] | null }) => {
        if (!alive) return;
        setRiwayat((data ?? []).map(a => ({
          id: a.id, score: a.score, passed: a.passed, grading_status: a.grading_status,
          submitted_at: a.submitted_at, sesi: a.lc_quiz_sessions?.session_name ?? 'Quiz',
        })));
      });
    return () => { alive = false; };
  }, [user.id]);

  return (
    <WidgetCard title="Riwayat Quiz" icon="🕐" accent="#4338ca">
      {riwayat === null ? <Loading /> : riwayat.length === 0 ? (
        <EmptyState text="Belum ada quiz yang diselesaikan." />
      ) : (
        /*
          flex-col h-full + daftar sebagai flex-1 min-h-0 overflow-y-auto:
          bukan max-h berangka tebak-tebakan. WidgetCard sudah h-full, dan
          baris grid tempat kartu ini duduk (lihat PermissionAwareDashboard,
          grid Piket Showroom/Learning Center/Riwayat Quiz TANPA items-start)
          meregangkan ketiganya ke tinggi yang sama - jadi "flex-1" di sini
          otomatis berarti "sisa tinggi sesudah judul", yang nilainya SAMA
          dengan tinggi kartu Learning Center di sebelahnya tanpa perlu
          disamakan manual. Kalau isinya melebihi itu, yang muncul gulir
          DI DALAM kartu, bukan kartu yang memanjang sendiri.
        */
        <div className="flex flex-col h-full">
          <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 -mr-0.5">
            {riwayat.map(r => <BarisRiwayatQuiz key={r.id} r={r} onClick={() => setAttemptDibuka(r.id)} />)}
          </div>
        </div>
      )}
      {attemptDibuka && (
        <PopupJawabanQuiz user={user} attemptId={attemptDibuka} onClose={() => setAttemptDibuka(null)} />
      )}
    </WidgetCard>
  );
};

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
          supabase.from('piket_schedules').select('id,day_date,week_start,day_of_week,pic,pic_ivp_id,pic_ivp_name,pic_ump_id,pic_ump_name,pic_mvi_id,pic_mvi_name'),
          supabase.from('picket_holidays').select('date'),
          supabase.from('users').select('full_name, team_type').in('team_type', namaKelompokPTS()),
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
  /*
    WORK CENTER - My Action/Today/Upcoming, PLUS Quick Action Team yang
    dirender DI DALAM kartu My Action-nya sendiri (lihat WorkQueueSection.tsx).
    Priority PALING RENDAH (tampil PALING ATAS), untuk SEMUA role yang login -
    inilah yang menjawab "apa yang harus saya kerjakan sekarang" sebelum
    statistik apa pun di bawahnya. permission selalu true: widget-nya sendiri
    yang berempty-state rapi kalau memang tidak ada tugas aktif untuk role
    itu - lebih jujur daripada widget yang hilang tanpa penjelasan.
  */
  { id: 'work-queue',     permission: () => true, priority: 0,   size: 'full', Component: WorkQueueSection },
  /*
    Analytics Saya (Sales/Marketing) - tema analytics, DATA SENDIRI, 4 kartu
    statistik + Quick Action (Request Schedule/Design Project/Ticket/Form
    Review/Project Progress) dirender DI DALAM kartu ini sendiri, lihat
    SalesAnalyticsWidget.tsx. Priority 0.5 - tepat di bawah My Action, karena
    bagi Sales/Guest kartu inilah "frame" Quick Action mereka, jadi harus
    tampil sedini My Action tampil bagi Team.
  */
  { id: 'sales-analytics', permission: (u) => !canAccessAnalytics(u) && hasSalesAnalyticsData(u), priority: 0.5, size: 'full', Component: SalesAnalyticsWidget },
  // Team Monitoring paling atas utk Admin/Team (full width) - jawab "mana report tim".
  { id: 'team-monitoring', permission: canSeeTeamMonitoring, priority: 1, size: 'full', Component: TeamMonitoringWidget },
  // Analytics native (DashboardKPI, tanpa iframe) - tema analytics penuh utk Admin/Team.
  // Sudah memuat Ticket/Reminder/Piket/Unit/Pengguna/Learning  widget di bawah
  // DISEMBUNYIKAN utk role ini (`!canAccessAnalytics`) supaya TIDAK duplikat data.
  { id: 'analytics',       permission: canAccessAnalytics,   priority: 2, size: 'full', Component: AnalyticsNativeWidget },
  // Piket Showroom: role tanpa analytics (Admin/Team sudah lihat piket di dalam analytics).
  { id: 'showroom',        permission: (u) => !canAccessAnalytics(u),               priority: 6, size: 'md', Component: ShowroomWidget },
  { id: 'learning',        permission: (u) => hasMenu(u, 'learning-center')        && !canAccessAnalytics(u), priority: 7, size: 'sm', Component: LearningWidget },
  //  Guest SAJA (bukan `hasMenu` saja seperti Learning di atas) - kartu ini
  //  cuma berarti kalau LearningWidget di sebelahnya sedang menampilkan
  //  statistik personal (cabang guest-nya), bukan kartu CTA polos milik Team.
  { id: 'riwayat-quiz',    permission: (u) => isSalesGuest({ role: u.role }) && hasMenu(u, 'learning-center') && !canAccessAnalytics(u), priority: 7.1, size: 'sm', Component: RiwayatQuizWidget },
];
