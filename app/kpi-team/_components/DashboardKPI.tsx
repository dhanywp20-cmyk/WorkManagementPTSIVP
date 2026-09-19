'use client';
import { MiniSpark, DonutChart } from '@/components/shared';
//  Permukaan ubin dipakai BERSAMA dengan widget dashboard (My Action, Team
//  Monitoring) - satu-satunya cara memastikan keduanya benar-benar senada,
//  bukan "mirip" karena angkanya kebetulan disalin.
import { UBIN, BAYANG_UBIN, RelAksen } from '@/app/dashboard/_components/widgets/primitives';
import React, { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { hasFullAccess } from '@/lib/constants';
import { lingkupSaya, muatKelompok, namaKelompokPTS } from '@/lib/kelompok';
import { User } from '@/app/dashboard/_components/shared';
import { KPISettings, DEFAULT_KPI_SETTINGS } from '@/app/kpi-team/_components/shared';

// Types

interface KPIData {
  tickets: {
    total: number; open: number; solved: number; waitingApproval: number;
    byHandler: { name: string; count: number }[];
    byStatus: { status: string; count: number; color: string }[];
    byDivision: { div: string; count: number }[];
    byProduct: { product: string; count: number }[];
    resolvedToday: number; avgResolutionDays: number;
    monthlyTickets: number[];
  };
  reminders: {
    total: number; pending: number; done: number; dueSoon: number;
    byCategory: { cat: string; count: number; color: string }[];
    byProduct: { product: string; byCategory: { cat: string; count: number }[] }[];
    overdueCount: number;
  };
  piket: {
    todayIVP: string | null; todayUMP: string | null; todayMvi: string | null;
    weekFilled: number; weekTotal: number; kegiatanToday: number;
  };
  units: { totalLogs: number; keluarThisMonth: number; masukThisMonth: number };
  users: { total: number; byRole: { role: string; count: number }[] };
  learning: { totalSessions: number; completedSessions: number; totalParticipants: number; avgScore: number };
}

interface KPITeamMember {
  id: string;
  name: string;
  team_type: string;
  jabatan: string;
  // Auto dari platform
  ticketsHandled: number;
  ticketsSolved: number;
  ticketsOverdue: number;
  avgResolutionDays: number;
  remindersAssigned: number;
  remindersDone: number;
  remindersOverdue: number;
  lcAttempts: number;
  lcAvgScore: number;
  lcPassed: number;
  lcFailedBelow75: number;   // LC: jumlah attempt score < 75 (hardcode, untuk backward compat)
  lcScores: number[];        // semua score mentah - untuk recompute dengan lcMinScore dinamis
  piketFilled: number;
  ticketAvgResponseHours: number;
  formReviewLowRating: number;
  formReviewTotal: number;     // total form review submitted by sales
  // Monthly sparkline data (12 bulan)
  monthlyTickets: number[];
  monthlyLC: number[];
  // Auto dari Tech Note platform
  techNotesApproved: number;     // RnD - jumlah tech note approved (target 2/thn, otomatis)
  // Manual input (KPI yg tidak bisa diambil otomatis)
  manual: {
    komplainCount: number;        // Technical knowledge - jumlah komplain (max 12)
    responTime: number;           // Kecepatan respon komplain (1=OK, 0=Tidak OK)
    bastDemo: number;             // BAST & Demo - jumlah form selesai dalam 7 hari
    bastDemoTotal: number;        // Total BAST & Demo yang ada
    reportBulanan: number;        // Pelaporan bulanan tepat waktu (0-12)
    learningMastery: number;      // Penguasaan teknikal (0-12 kategori)
  };
}

interface KPITeamState {
  members: KPITeamMember[];
  loading: boolean;
  editingMember: string | null;  // member id yang sedang diedit
  editValues: Partial<KPITeamMember['manual']>;
  filterYear: number;
  filterPeriod: '6m' | '1y';   // 6 bulan atau 1 tahun
  filterStartMonth: number;     // 1–12: bulan mulai periode (sumber kebenaran utama)
  filterTeam: string;
}

interface KPIPeriodSnapshot {
  id: string;
  period_label: string;       // e.g. "Jan–Jun 2025" atau "Jan–Des 2025"
  year: number;
  period: '6m' | '1y';
  start_month: number;        // 1-12 (bulan mulai)
  end_month: number;          // 1-12 (bulan akhir, otomatis)
  team_type: string;          // scope: "all" | "Team PTS IVP" | "Team PTS MVI"
  created_at: string;
  created_by: string;
  members_json: {
    id: string; name: string; jabatan: string; team_type: string;
    ticketsHandled: number; ticketsSolved: number; ticketsOverdue: number;
    lcAttempts: number; lcAvgScore: number; lcPassed: number;
    formReviewTotal: number; formReviewLowRating: number;
    techNotesApproved: number;
    tickScore: number; bastScore: number; lcScore: number; rndScore: number;
    finalKPI: number;
  }[];
  settings_json?: {
    lcMinScore: number; rndTarget: number;
    ticketOverdueWeight: number; bastWeight: number; lcWeight: number; rndWeight: number;
  } | null;
}

interface AuditEntry {
  id: string; module: string; actor: string; action: string;
  target: string; detail: string; ts: string;
  severity: 'info' | 'warn' | 'critical'; icon: string;
}

interface Scope {
  kind: 'admin' | 'pts_sup' | 'team' | 'none';
  // pts_sup
  ptsTeamType?: string;
  ptsMemberNames?: string[];
}

// Constants

const STATUS_COLORS: Record<string, string> = {
  'Waiting Approval': '#f59e0b', 'Pending': '#3b82f6', 'Solved': '#10b981',
  'Cancelled': '#6b7280', 'Overdue': '#ef4444', 'Warranty': '#8b5cf6',
  'Out Of Warranty': '#ec4899', 'Process Repair': '#f97316', 'Submit RMA': '#06b6d4',
};

const CATEGORY_COLORS: Record<string, string> = {
  'Demo Product': '#3b82f6', 'Meeting & Survey': '#8b5cf6', 'Konfigurasi': '#10b981',
  'Konfigurasi & Training': '#06b6d4', 'Troubleshooting': '#ef4444',
  'Training': '#f59e0b', 'Internal': '#6b7280',
};

/**
 * Potong daftar ke N teratas + satu baris "Lainnya" yang menjumlahkan
 * sisanya - dipakai SEKALI untuk donat DAN legenda di sampingnya, supaya
 * keduanya selalu menjelaskan data yang sama persis.
 *
 * Ditemukan lewat pengukuran, bukan tebakan: byStatus bisa berisi sampai
 * 9 status tiket berbeda (lihat STATUS_COLORS), byCategory sampai 7+
 * kategori reminder. Sebelum ada ini, donatnya memplot SEMUA irisan
 * sementara legenda di sampingnya dipotong ke 6 teratas - sisanya jadi
 * warna di lingkaran tanpa keterangan apa pun di sebelahnya.
 */
function batasDenganLainnya<T extends { count: number }>(
  daftar: T[], n: number, buatLainnya: (sisaCount: number) => T,
): T[] {
  if (daftar.length <= n) return daftar;
  const sisa = daftar.slice(n).reduce((s, d) => s + d.count, 0);
  return [...daftar.slice(0, n), buatLainnya(sisa)];
}

const SEVERITY_STYLE = {
  info:     { bg: 'rgba(59,130,246,0.06)',  border: 'rgba(59,130,246,0.18)',  dot: '#3b82f6', text: '#1e40af' },
  warn:     { bg: 'rgba(245,158,11,0.07)',  border: 'rgba(245,158,11,0.22)',  dot: '#d97706', text: '#92400e' },
  critical: { bg: 'rgba(239,68,68,0.06)',   border: 'rgba(239,68,68,0.18)',   dot: '#ef4444', text: '#991b1b' },
};

// Helpers

const todayStr   = () => new Date().toISOString().split('T')[0];
const dayOfWeek  = () => ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][new Date().getDay()];
const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]; };
function getMonday() {
  const d = new Date(); const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().split('T')[0];
}

// Same holiday-cascade logic used by piket-showroom page:
// When a holiday occurs, subsequent days shift their PIC one slot earlier from the pool.
type PiketPic = { pic_ivp_name: string|null; pic_ump_name: string|null; pic_mvi_name: string|null };
function computeCascadedPiketToday(
  weekRows: (PiketPic & { day_date: string })[],
  holidays: string[],
  todayDate: string
): PiketPic | null {
  if (weekRows.length === 0) return null;
  const holidaySet = new Set(holidays);
  const sorted = [...weekRows].sort((a, b) => a.day_date.localeCompare(b.day_date));
  const picPool: PiketPic[] = sorted.map(r => ({
    pic_ivp_name: r.pic_ivp_name ?? null,
    pic_ump_name: r.pic_ump_name ?? null,
    pic_mvi_name: r.pic_mvi_name ?? null,
  }));
  let poolIdx = 0;
  for (const row of sorted) {
    if (holidaySet.has(row.day_date)) {
      if (row.day_date === todayDate) return { pic_ivp_name: null, pic_ump_name: null, pic_mvi_name: null };
    } else {
      const pic = picPool[Math.min(poolIdx, picPool.length - 1)];
      poolIdx++;
      if (row.day_date === todayDate) return pic;
    }
  }
  return null;
}

// Sub-components

function MiniDonut({ segments, size = 72 }: { segments: { value: number; color: string }[]; size?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (!total) return <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox={`0 0 ${size} ${size}`}><circle cx={size/2} cy={size/2} r={size/2-5} fill="none" stroke="#e2e8f0" strokeWidth={9}/></svg>;
  const r = size/2-6, circ = 2*Math.PI*r; let off = 0;
  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform:'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e8ecf0" strokeWidth={9}/>
      {segments.map((seg,i) => { const pct=seg.value/total, dash=pct*circ, gap=circ-dash;
        const el=<circle key={i} cx={size/2} cy={size/2} r={r} fill="none" stroke={seg.color} strokeWidth={9} strokeDasharray={`${dash} ${gap}`} strokeDashoffset={-off*circ} strokeLinecap="butt"/>;
        off+=pct; return el; })}
    </svg>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1), w=80, h=28;
  const pts = values.map((v,i) => `${(i/(values.length-1))*w},${h-(v/max)*h}`).join(' ');
  return (
    <svg aria-hidden="true" focusable="false" width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow:'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"/>
      <circle cx={(values.length-1)/(values.length-1)*w} cy={h-(values[values.length-1]/max)*h} r={3} fill={color}/>
    </svg>
  );
}

function StatCard({ icon, label, value, sub, color, sparkline, donut, loading }: {
  icon: string; label: string; value: string|number; sub?: string; color: string;
  sparkline?: number[]; donut?: { segments: { value:number; color:string }[] }; loading?: boolean;
}) {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-1 relative overflow-hidden"
      style={{ background:'rgba(255,255,255,0.93)', backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)', border:'1px solid rgba(0,0,0,0.07)', boxShadow:'0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)' }}>
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-[0.06]"
        style={{ background:color, transform:'translate(30%,-30%)' }}/>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-sm">{icon}</span>
            <span className="text-[11px] font-semibold tracking-wide uppercase truncate" style={{ color:'rgba(0,0,0,0.4)' }}>{label}</span>
          </div>
          {loading ? <div className="h-7 w-16 rounded animate-pulse" style={{ background:'rgba(0,0,0,0.08)' }}/> :
            <div className="text-lg sm:text-2xl font-black tracking-tight" style={{ color }}>{value}</div>}
          {sub && <div className="text-[11px] mt-0.5 truncate" style={{ color:'rgba(0,0,0,0.35)' }}>{sub}</div>}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {donut && <MiniDonut segments={donut.segments}/>}
          {sparkline && sparkline.length > 1 && <Sparkline values={sparkline} color={color}/>}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, sub, right }: { icon:string; title:string; sub?:string; right?:ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0"
          style={{ background:'rgba(190,18,60,0.1)', border:'1px solid rgba(190,18,60,0.15)' }}>{icon}</div>
        <div>
          <h2 className="text-base font-bold tracking-wide" style={{ color:'rgba(0,0,0,0.75)' }}>{title}</h2>
          {sub && <p className="text-sm" style={{ color:'rgba(0,0,0,0.4)' }}>{sub}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

/**
 * Bar mendatar ringkas.
 *
 * Bilahnya SENGAJA tipis (h-2.5, bukan h-4). Isi kartu ini sering cuma dua
 * atau tiga baris - mis. "Ticket Open per Handler" yang berisi dua orang
 * dengan satu tiket masing-masing. Bilah setebal 16px untuk data seperti itu
 * memakan sepertiga baris dashboard hanya untuk memberi tahu dua angka yang
 * sama besar, dan dua bilah sama panjang memang tidak menyampaikan apa pun -
 * yang dibaca orang di sana adalah angkanya, bukan panjangnya.
 */
/*
  Satu warna aksen untuk SETIAP deret tunggal di dashboard ini.

  Sebelumnya tiap kartu memilih warnanya sendiri (teal, ungu, oranye, cyan,
  indigo) tanpa arti apa pun - warna jadi hiasan, bukan informasi. Dengan satu
  aksen, warna yang BERBEDA otomatis berarti sesuatu, dan itulah yang dipakai
  tiga token status di bawahnya.
*/
const AKSEN  = '#4f46e5';
const BAIK   = '#059669';
const HATI   = '#d97706';
const KRITIS = '#e11d48';

function HBarChart({ data, color, maxItems=6, lebarLabel='7rem' }: { data:{label:string;value:number}[]; color?:string; maxItems?:number; lebarLabel?:string }) {
  const top = data.slice(0, maxItems), max = Math.max(...top.map(d=>d.value), 1);
  return (
    <div className="flex flex-col gap-[7px]">
      {top.map((d,i) => (
        <div key={i} className="flex items-center gap-2">
          <span title={d.label} className="text-[11px] font-semibold flex-shrink-0 text-right" style={{ color:'rgba(0,0,0,0.55)', width:lebarLabel, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.label}</span>
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background:'rgba(15,23,42,0.07)' }}>
            {/*  Opacity TETAP. Versi lama memudarkan tiap batang menurut
                peringkatnya (0.85 - i*0.07), jadi warna ikut menyandikan
                urutan - padahal panjang batang sudah melakukannya, dan
                batang terbawah terbaca pudar seolah datanya kurang sahih. */}
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width:`${(d.value/max)*100}%`, background: color ?? AKSEN }}/>
          </div>
          <span className="text-[11px] font-bold w-5 text-right flex-shrink-0 tabular-nums" style={{ color:'rgba(0,0,0,0.6)' }}>{d.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Satu baris rincian di kartu modul: label · bilah tipis · angka. */
function BarisRincian({ label, value, total, warna, teks }: {
  label:string; value?:number; total?:number; warna?:string; teks?:React.ReactNode;
}) {
  const pct = (total ?? 0) > 0 ? Math.min(100, ((value ?? 0) / (total as number)) * 100) : 0;
  return (
    <div className="grid items-center gap-2" style={{ gridTemplateColumns:'4.5rem 1fr auto' }}>
      <span className="text-[11px] font-semibold text-slate-600 truncate">{label}</span>
      {teks !== undefined
        ? <span className="text-[11px] text-slate-700 truncate">{teks}</span>
        : <div className="h-1.5 rounded-full overflow-hidden" style={{ background:'rgba(15,23,42,0.07)' }}>
            <div className="h-full rounded-full" style={{ width:`${pct}%`, background: warna ?? AKSEN }}/>
          </div>}
      {teks === undefined &&
        <span className="text-[11px] font-bold text-slate-600 text-right tabular-nums w-6">{value}</span>}
    </div>
  );
}

/**
 * Kartu modul: anatomi seragam (kepala berwarna modul, satu angka utama,
 * rincian di tepi bawah) TAPI tidak seragam sampai membosankan - rel aksen
 * di tepi atas, chip ikon, dan percikan opsional membuat sederet ubin putih
 * punya identitas masing-masing tanpa mengubah permukaannya.
 */
function KartuModul({ ikon, judul, warna, catatan, angka, satuan, percik, kaki, kelas, children }: {
  ikon: string; judul: string; warna: string; catatan?: React.ReactNode;
  angka: React.ReactNode; satuan: string; percik?: number[];
  kaki?: React.ReactNode; kelas?: string; children: React.ReactNode;
}) {
  return (
    <div className={`${UBIN} h-full ${kelas ?? ''}`} style={{ boxShadow: BAYANG_UBIN }}>
      <RelAksen warna={warna}/>
      <KepalaUbin ikon={ikon} judul={judul} warna={warna} catatan={catatan}/>
      <div className="flex items-end justify-between gap-2">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="text-[38px] font-black leading-[0.92] text-slate-900 tabular-nums" style={{ letterSpacing: '-0.035em' }}>{angka}</span>
          <span className="text-[11px] font-bold text-slate-400 truncate">{satuan}</span>
        </div>
        {percik && percik.length > 1 && <Percik nilai={percik} warna={warna} lebar={88} tinggi={32}/>}
      </div>
      <div className="flex flex-col gap-[7px] mt-auto pt-3.5">{children}</div>
      {kaki}
    </div>
  );
}

/**
 * Garis percikan + bidang isi. SENGAJA hanya dipakai di tempat yang deret
 * aslinya memang ada (monthlyTickets). Sparkline hiasan di kartu yang tidak
 * punya riwayat adalah kebohongan grafis: bentuknya terbaca seperti tren
 * padahal tidak ada datanya.
 */
function Percik({ nilai, warna, lebar = 88, tinggi = 30 }: {
  nilai: number[]; warna: string; lebar?: number; tinggi?: number;
}) {
  if (nilai.length < 2) return null;
  const mx = Math.max(...nilai), mn = Math.min(...nilai), rg = (mx - mn) || 1, pad = 3;
  const tt = nilai.map((v, i) => [
    (i / (nilai.length - 1)) * lebar,
    tinggi - pad - ((v - mn) / rg) * (tinggi - pad * 2),
  ] as const);
  const d  = tt.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const ak = tt[tt.length - 1];
  const gid = `pk${warna.replace('#', '')}${lebar}x${tinggi}`;
  return (
    <svg aria-hidden="true" focusable="false" width={lebar} height={tinggi}
      viewBox={`0 0 ${lebar} ${tinggi}`} className="flex-shrink-0">
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={warna} stopOpacity="0.30"/>
        <stop offset="1" stopColor={warna} stopOpacity="0"/>
      </linearGradient></defs>
      <path d={`${d} L ${lebar} ${tinggi} L 0 ${tinggi} Z`} fill={`url(#${gid})`}/>
      <path d={d} fill="none" stroke={warna} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={ak[0].toFixed(1)} cy={ak[1].toFixed(1)} r={2.8} fill={warna}/>
    </svg>
  );
}

/**
 * Cincin kemajuan. Bentuk lingkaran SAH di sini - tidak seperti donat yang
 * kemarin dilepas - karena yang diplot benar-benar bagian-dari-keseluruhan
 * (hari piket terisi dari total hari, attempt lulus dari total attempt),
 * bukan sekadar beberapa angka yang kebetulan berdampingan.
 */
function Cincin({ nilai, dari, warna, ukuran = 84, teks }: {
  nilai: number; dari: number; warna: string; ukuran?: number; teks: React.ReactNode;
}) {
  const pct = dari > 0 ? Math.min(1, nilai / dari) : 0;
  const r = ukuran / 2 - 7, kel = 2 * Math.PI * r;
  return (
    <div className="relative flex-shrink-0" style={{ width: ukuran, height: ukuran }}>
      <svg aria-hidden="true" focusable="false" width={ukuran} height={ukuran} viewBox={`0 0 ${ukuran} ${ukuran}`}>
        <circle cx={ukuran/2} cy={ukuran/2} r={r} fill="none" stroke="rgba(15,23,42,0.07)" strokeWidth={9}/>
        <circle cx={ukuran/2} cy={ukuran/2} r={r} fill="none" stroke={warna} strokeWidth={9} strokeLinecap="round"
          strokeDasharray={kel} strokeDashoffset={kel * (1 - pct)}
          transform={`rotate(-90 ${ukuran/2} ${ukuran/2})`}
          style={{ transition: 'stroke-dashoffset .8s ease' }}/>
      </svg>
      <span className="absolute inset-0 grid place-items-center font-black"
        style={{ color: warna, fontSize: Math.round(ukuran * 0.215), letterSpacing: '-0.03em' }}>{teks}</span>
    </div>
  );
}

/**
 * Rel judul seksi. Tanpa ini kisinya adalah 11 ubin seragam tanpa jeda sama
 * sekali - itulah yang terbaca "monoton": bukan karena tiap ubin jelek, tapi
 * karena mata tidak pernah diberi tempat berhenti.
 */
function RelSeksi({ judul }: { judul: string }) {
  return (
    <div className="lg:col-span-12 flex items-center gap-2.5 mt-1 -mb-0.5">
      {/*
        Keping putih, bukan teks telanjang.

        Judul seksi ini adalah SATU-SATUNYA teks di halaman yang duduk langsung
        di atas latar dashboard - semua yang lain ada di dalam ubin putih.
        Latar itu foto (gambarLatarDasbor), jadi terangnya berubah-ubah sepanjang
        gambar: abu-abu slate-500 yang terbaca di satu tempat hilang sama sekali
        di tempat lain. Warna teks apa pun akan salah di sebagian gambar; yang
        benar adalah membawa latarnya sendiri.
      */}
      <span className="text-[10.5px] font-black uppercase tracking-[0.16em] text-slate-700 flex-shrink-0
                       px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-sm border border-black/[0.06]"
        style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>{judul}</span>
      <span aria-hidden="true" className="flex-1 h-px"
        style={{ background: 'linear-gradient(90deg,rgba(255,255,255,0.7),rgba(255,255,255,0))' }}/>
    </div>
  );
}

/** Kepala ubin seragam: chip ikon berwarna modul + judul + catatan kecil. */
function KepalaUbin({ ikon, judul, warna, catatan }: {
  ikon: string; judul: string; warna: string; catatan?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span aria-hidden="true" className="w-[26px] h-[26px] rounded-[9px] grid place-items-center text-[13px] flex-shrink-0"
        style={{ background: `${warna}1a`, color: warna }}>{ikon}</span>
      <h3 className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-slate-500 flex-1 truncate">{judul}</h3>
      {catatan && <span className="text-[10px] font-semibold text-slate-400 flex-shrink-0">{catatan}</span>}
    </div>
  );
}

/** Kaki ubin: satu keterangan kiri, satu angka kanan, dipisah garis putus. */
function KakiUbin({ kiri, kanan, warna }: { kiri: React.ReactNode; kanan: React.ReactNode; warna?: string }) {
  return (
    <div className="flex justify-between items-center mt-2.5 pt-2.5" style={{ borderTop: '1px dashed rgba(15,23,42,0.10)' }}>
      <span className="text-[10px] font-bold text-slate-400">{kiri}</span>
      <span className="text-[11.5px] font-black" style={{ color: warna ?? '#475569' }}>{kanan}</span>
    </div>
  );
}

/**
 * Pita ringkas gelap di puncak halaman.
 *
 * Akar keluhan "monoton" bukan warna tiap ubin, tapi TIDAK ADANYA jangkar:
 * 11 kotak putih berukuran mirip di atas kanvas terang, tanpa satu pun titik
 * yang lebih berat dari yang lain, jadi mata tidak tahu harus mulai dari
 * mana. Satu bidang gelap melebar di atas menyelesaikan itu sekaligus
 * memberi tempat angka-angka yang memang paling sering ditanyakan.
 *
 * Semua angka di sini NYATA. Hanya tiket yang punya deret bulanan, jadi
 * hanya tiket yang memakai percikan dan selisih "vs bulan lalu"; empat
 * lainnya memakai meter rasio yang benar-benar bisa dihitung dari datanya.
 */
function PitaItem({ label, angka, satuan, garis, children }: {
  label: string; angka: React.ReactNode; satuan?: string; garis?: boolean; children?: React.ReactNode;
}) {
  return (
    <div className={`min-w-0 ${garis ? 'lg:pl-5 lg:border-l lg:border-white/[0.12]' : ''}`}>
      <p className="text-[9.5px] font-black uppercase tracking-[0.11em] truncate" style={{ color: 'rgba(199,210,254,0.85)' }}>{label}</p>
      <p className="text-[26px] sm:text-[28px] font-black leading-none mt-1 tabular-nums" style={{ letterSpacing: '-0.035em' }}>
        {angka}{satuan && <span className="text-[13px] font-bold ml-1" style={{ color: 'rgba(199,210,254,0.75)' }}>{satuan}</span>}
      </p>
      <div className="flex items-center gap-2 mt-2 h-[20px]">{children}</div>
    </div>
  );
}

function MeterGelap({ pct, warna }: { pct: number; warna: string }) {
  return (
    <div className="h-1.5 rounded-full overflow-hidden w-full max-w-[92px]" style={{ background: 'rgba(255,255,255,0.16)' }}>
      <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: warna }}/>
    </div>
  );
}

function LabelPita({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] font-bold whitespace-nowrap" style={{ color: 'rgba(199,210,254,0.72)' }}>{children}</span>;
}

function PitaRingkas({ kpi, loading, catatan }: { kpi: KPIData | null; loading: boolean; catatan: string }) {
  const bln = new Date().getMonth();
  const deret = (kpi?.tickets.monthlyTickets ?? []).slice(0, bln + 1);
  const tIni  = deret[bln] ?? 0;
  const tLalu = bln > 0 ? (deret[bln - 1] ?? 0) : null;
  const beda  = tLalu === null ? null : tIni - tLalu;
  const rTot  = kpi?.reminders.total ?? 0;
  const pTot  = kpi?.piket.weekTotal ?? 0;
  const kosong = <span className="inline-block h-6 w-12 rounded bg-white/10 animate-pulse"/>;
  return (
    <div className="lg:col-span-12 relative overflow-hidden rounded-[20px] px-5 py-4 md:px-6 md:py-5 text-white"
      style={{ background: 'linear-gradient(118deg,#141a3a 0%,#231a56 46%,#3b1d52 100%)',
               boxShadow: '0 18px 40px -24px rgba(20,26,58,0.85)' }}>
      <span aria-hidden="true" className="absolute pointer-events-none rounded-full"
        style={{ right: -60, top: -90, width: 340, height: 340,
                 background: 'radial-gradient(circle,rgba(129,140,248,0.30),transparent 62%)' }}/>
      <div className="relative flex items-center justify-between gap-3 flex-wrap mb-4">
        <h2 className="text-[15px] font-black tracking-tight flex items-center gap-2"><span aria-hidden="true">📊</span> Ringkasan Platform</h2>
        <div className="flex items-center gap-2">
          <span className="text-[10.5px] font-bold px-2.5 py-1 rounded-full"
            style={{ color: '#c7d2fe', background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.14)' }}>
            {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
          <span className="text-[10.5px] font-bold px-2.5 py-1 rounded-full"
            style={{ color: '#c7d2fe', background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.14)' }}>
            {catatan}
          </span>
        </div>
      </div>
      <div className="relative grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-4">
        <PitaItem label="Tiket bulan ini" angka={loading ? kosong : tIni}>
          {!loading && beda !== null && (
            <span title={`Bulan lalu ${tLalu} tiket`} className="text-[10px] font-black px-1.5 py-0.5 rounded-full whitespace-nowrap"
              style={{ background: 'rgba(255,255,255,0.12)', color: '#c7d2fe' }}>
              {beda > 0 ? '▲' : beda < 0 ? '▼' : '='} {Math.abs(beda)}
            </span>
          )}
          {!loading && <Percik nilai={deret} warna="#a5b4fc" lebar={76} tinggi={20}/>}
        </PitaItem>

        {/*  Pindah ke sini dari kartu "Ringkasan Performa" milik Team
             Monitoring, yang dulu mencetak lima angka yang sama persis
             dengan pita ini di layar yang sama. */}
        <PitaItem label="Solved hari ini" garis angka={loading ? kosong : (kpi?.tickets.resolvedToday ?? 0)}>
          {!loading && <LabelPita>dari {kpi?.tickets.open ?? 0} tiket terbuka</LabelPita>}
        </PitaItem>

        <PitaItem label="Avg resolusi" satuan="hari" garis angka={loading ? kosong : (kpi?.tickets.avgResolutionDays ?? 0)}>
          {!loading && <LabelPita>{kpi?.tickets.solved ?? 0} total selesai</LabelPita>}
        </PitaItem>

        <PitaItem label="Reminder overdue" garis angka={loading ? kosong : (kpi?.reminders.overdueCount ?? 0)}>
          {!loading && <>
            <MeterGelap pct={rTot ? ((kpi?.reminders.overdueCount ?? 0) / rTot) * 100 : 0} warna="#fda4af"/>
            <LabelPita>dari {rTot}</LabelPita>
          </>}
        </PitaItem>

        <PitaItem label="Piket minggu ini" garis satuan={pTot ? `/${pTot}` : undefined}
          angka={loading ? kosong : (kpi?.piket.weekFilled ?? 0)}>
          {!loading && <>
            <MeterGelap pct={pTot ? ((kpi?.piket.weekFilled ?? 0) / pTot) * 100 : 0} warna="#6ee7b7"/>
            <LabelPita>{pTot ? Math.round(((kpi?.piket.weekFilled ?? 0) / pTot) * 100) : 0}%</LabelPita>
          </>}
        </PitaItem>

        <PitaItem label="LC avg skor" garis angka={loading ? kosong : (kpi?.learning.avgScore ?? 0)}>
          {!loading && <>
            <MeterGelap pct={kpi?.learning.avgScore ?? 0} warna="#6ee7b7"/>
            <LabelPita>{kpi?.learning.totalParticipants ?? 0} peserta</LabelPita>
          </>}
        </PitaItem>
      </div>
    </div>
  );
}

/**
 * Trend bulanan sebagai AREA, bukan 12 batang pucat.
 *
 * Batang membandingkan besaran antar kategori yang berdiri sendiri; yang
 * ditanyakan di sini adalah bentuk perjalanan sepanjang tahun, dan itu
 * dibaca dari kemiringan garis. Bulan yang belum terjadi tidak digambar
 * sebagai nol - digambar sebagai garis putus, karena "belum ada datanya"
 * bukan "nilainya nol".
 */
function TrenBulanan({ data }: { data: number[] }) {
  const MN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
  const cur = Math.min(new Date().getMonth(), 11);
  const W = 640, H = 168, pb = 26, pt = 18, sisi = 10;
  const mx = Math.max(...data, 1);
  const X = (i: number) => sisi + (i / 11) * (W - sisi * 2);
  const Y = (v: number) => pt + (1 - v / mx) * (H - pt - pb);
  const tt = data.slice(0, cur + 1).map((v, i) => [X(i), Y(v)] as const);
  const d  = tt.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const total = data.reduce((s, v) => s + v, 0);
  return (
    <svg role="img" aria-label={`Trend ticket bulanan, total ${total} tiket`}
      viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ display: 'block' }}>
      <defs><linearGradient id="trenIsi" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={AKSEN} stopOpacity="0.26"/>
        <stop offset="1" stopColor={AKSEN} stopOpacity="0"/>
      </linearGradient></defs>
      {[0, 0.5, 1].map(f => {
        const y = pt + f * (H - pt - pb);
        return <line key={f} x1={0} y1={y} x2={W} y2={y} stroke="rgba(15,23,42,0.07)" strokeWidth={1}/>;
      })}
      {tt.length > 1 && <path d={`${d} L ${X(cur)} ${H - pb} L ${X(0)} ${H - pb} Z`} fill="url(#trenIsi)"/>}
      <path d={d} fill="none" stroke={AKSEN} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"/>
      {cur < 11 && <line x1={X(cur)} y1={H - pb} x2={X(11)} y2={H - pb}
        stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="3 4"/>}
      {tt.map((p, i) => {
        const kini = i === cur;
        return <circle key={i} cx={p[0].toFixed(1)} cy={p[1].toFixed(1)} r={kini ? 5 : 3}
          fill="#fff" stroke={AKSEN} strokeWidth={kini ? 3 : 2}><title>{`${MN[i]}: ${data[i]} ticket`}</title></circle>;
      })}
      {tt.length > 0 && (
        <text x={X(cur)} y={Y(data[cur] ?? 0) - 13} textAnchor="middle"
          fontSize="12.5" fontWeight="900" fill={AKSEN}>{data[cur] ?? 0}</text>
      )}
      {MN.map((m, i) => (
        <text key={m} x={X(i)} y={H - 7} textAnchor="middle" fontSize="10"
          fontWeight={i === cur ? 800 : 500} fill={i === cur ? AKSEN : '#94a3b8'}>{m}</text>
      ))}
    </svg>
  );
}

/** Inisial nama untuk avatar papan peringkat. */
function inisial(nama: string) {
  return nama.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const s = SEVERITY_STYLE[entry.severity];
  const fmt = new Date(entry.ts).toLocaleString('id-ID', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
  return (
    <div className="flex items-start gap-3 px-3 py-2.5 rounded-xl transition-all"
      style={{ background: s.bg, border:`1px solid ${s.border}` }}>
      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-sm"
        style={{ background:`${s.dot}18` }}>{entry.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-bold truncate" style={{ color:'rgba(0,0,0,0.75)' }}>{entry.action}</span>
          <span className="text-sm flex-shrink-0" style={{ color:'rgba(0,0,0,0.35)' }}>{fmt}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-sm font-semibold px-1.5 py-0.5 rounded-full" style={{ background:`${s.dot}18`, color:s.text }}>{entry.module}</span>
          <span className="text-sm" style={{ color:'rgba(0,0,0,0.4)' }}>by <b style={{ color:'rgba(0,0,0,0.6)' }}>{entry.actor}</b></span>
          {entry.target && <span className="text-sm truncate max-w-[180px]" style={{ color:'rgba(0,0,0,0.35)' }}>→ {entry.target}</span>}
        </div>
        {entry.detail && <p className="text-[11px] mt-0.5 truncate" style={{ color:'rgba(0,0,0,0.3)' }}>{entry.detail}</p>}
      </div>
    </div>
  );
}

function ScopeBadge({ scope }: { scope: Scope }) {
  const cfg = {
    admin:     { label: 'Semua Data',         color: '#be123c', icon: '👑' },
    pts_sup:   { label: scope.ptsTeamType ?? 'PTS Supervisor', color: '#0891b2', icon: '🏪' },
    team:      { label: 'Team Member',        color: '#7c3aed', icon: '👤' },
    none:      { label: '-',                  color: '#6b7280', icon: '—'  },
  }[scope.kind];
  return (
    <span className="flex items-center gap-1 text-sm font-bold px-2 py-1 rounded-full"
      style={{ background:`${cfg.color}18`, color:cfg.color, border:`1px solid ${cfg.color}30` }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// Main Component

interface DashboardKPIProps { currentUser: User; }

export default function DashboardKPI({ currentUser }: DashboardKPIProps) {
  const [scope, setScope]           = useState<Scope>({ kind: 'none' });
  const [scopeReady, setScopeReady] = useState(false);
  const [kpi, setKpi]               = useState<KPIData | null>(null);
  const [audit, setAudit]           = useState<AuditEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [auditLoading, setAuditLoading] = useState(true);
  const [tab, setTab]               = useState<'analytics'>('analytics');
  const [auditFilter, setAuditFilter] = useState<'all'|'ticket'|'reminder'|'piket'|'user'>('all');
  const [auditSearch, setAuditSearch] = useState('');
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [kpiTeam, setKpiTeam] = useState<KPITeamState>({
    members: [],
    loading: false,
    editingMember: null,
    editValues: {},
    filterYear: new Date().getFullYear(),
    filterPeriod: '6m',
    filterStartMonth: new Date().getMonth() < 6 ? 1 : 7, // otomatis semester saat ini
    filterTeam: 'all',
  });
  const [showSettings, setShowSettings] = useState(false);
  const [kpiSettings, setKpiSettings] = useState<KPISettings>(DEFAULT_KPI_SETTINGS);
  const intervalRef = useRef<ReturnType<typeof setInterval>|null>(null);

  // Load KPI settings from Supabase (fallback: localStorage)
  // Table needed in Supabase:
  //   CREATE TABLE kpi_global_settings (
  //     id INT PRIMARY KEY DEFAULT 1,
  //     settings JSONB NOT NULL,
  //     updated_at TIMESTAMPTZ DEFAULT NOW()
  //   );
  useEffect(() => {
    const loadSettings = async () => {
      // 1. Try Supabase first
      try {
        const { data } = await supabase.from('kpi_global_settings').select('settings').eq('id', 1).single();
        if (data?.settings) {
          setKpiSettings({ ...DEFAULT_KPI_SETTINGS, ...data.settings });
          return;
        }
      } catch { /* table may not exist yet */ }
      // 2. Fallback to localStorage
      try {
        const stored = typeof window !== 'undefined' ? localStorage.getItem('kpi_global_settings') : null;
        if (stored) setKpiSettings({ ...DEFAULT_KPI_SETTINGS, ...JSON.parse(stored) });
      } catch { /* ignore */ }
    };
    loadSettings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveKpiSettings = async (s: KPISettings) => {
    // Always save to localStorage immediately (works without any DB setup)
    try { localStorage.setItem('kpi_global_settings', JSON.stringify(s)); } catch { /* ignore */ }
    // Try to also save to Supabase (requires kpi_global_settings table)
    try {
      await supabase.from('kpi_global_settings').upsert({ id: 1, settings: s, updated_at: new Date().toISOString() });
    } catch { /* table may not exist — localStorage is the fallback */ }
  };

  // 1. Resolve scope

  useEffect(() => {
    (async () => {
      // Pemetaan kelompok dimuat lebih dulu - lihat catatan yang sama di
      // app/kpi-team/page.tsx. Sebelum muatKelompok() selesai, namaKelompokPTS()
      // masih nilai bawaan (SELURUH kelompok PTS).
      await muatKelompok();
      const role   = currentUser.role?.toLowerCase() ?? '';
      const jabatan = currentUser.jabatan ?? '';
      const PTS_TYPES = namaKelompokPTS();

      // Admin/superadmin ATAU akun Team PTS dengan toggle "Full Access" aktif
      // (lihat lib/constants.ts hasFullAccess).
      if (['admin','superadmin'].includes(role) || hasFullAccess(currentUser)) {
        setScope({ kind: 'admin' }); setScopeReady(true); return;
      }

      // PTS supervisor
      if (role === 'team' && PTS_TYPES.includes(currentUser.team_type ?? '') && jabatan === 'Supervisor') {
        const { data } = await supabase.from('users').select('full_name')
          .eq('role','team').eq('team_type', currentUser.team_type ?? '');
        setScope({
          kind: 'pts_sup',
          ptsTeamType: currentUser.team_type ?? '',
          ptsMemberNames: (data ?? []).map((u:any) => u.full_name as string),
        });
        setScopeReady(true); return;
      }

      // Regular team member - check if they have dashboard access
      if (role === 'team' || role === 'team_pts') {
        const hasDashboard = (currentUser.allowed_menus ?? []).includes('dashboard');
        setScope({ kind: hasDashboard ? 'team' : 'none' }); setScopeReady(true); return;
      }

      setScope({ kind:'none' }); setScopeReady(true);
    })();
  }, [currentUser]);

  // 2. Fetch KPI (scope-aware)

  const fetchKPI = useCallback(async () => {
    if (!scopeReady || scope.kind === 'none') { setLoading(false); return; }
    setLoading(true);
    try {
      const today     = todayStr();
      const inOneWeek = new Date(); inOneWeek.setDate(inOneWeek.getDate()+7);
      const oneWeekStr = inOneWeek.toISOString().split('T')[0];

      // Nama anggota kelompok PTS yang SENGAJA dikeluarkan dari lingkup akun
      // ini (mis. Manager PTS IVP yang tidak membawahi PTS UMP) - dipakai
      // untuk MENGECUALIKAN, bukan membatasi ke satu kelompok saja. Admin
      // sungguhan (tanpa pemetaan Lingkup Manager) tetap melihat semuanya,
      // karena lingkupSaya() bawaannya mengembalikan seluruh kelompok PTS.
      // Beda dari 'pts_sup' yang MEMBATASI ke tim sendiri: di sini tiket
      // Sales/Marketing/Services tanpa kelompok PTS tetap harus ikut tampil.
      let namaDikecualikan: string[] = [];
      if (scope.kind === 'admin') {
        const kelompokDikecualikan = namaKelompokPTS().filter(t => !lingkupSaya(currentUser?.id).includes(t));
        if (kelompokDikecualikan.length > 0) {
          const { data: anggotaDikecualikan } = await supabase.from('users')
            .select('full_name').in('team_type', kelompokDikecualikan);
          namaDikecualikan = (anggotaDikecualikan ?? []).map((u: any) => u.full_name as string).filter(Boolean);
        }
      }

      // Helpers to build scoped queries
      const scopeTickets = (q: any) => {
        if (scope.kind === 'pts_sup' && scope.ptsMemberNames?.length) {
          return q.in('assign_name', scope.ptsMemberNames);
        }
        if (namaDikecualikan.length > 0) return q.not('assign_name', 'in', `(${namaDikecualikan.map(n => `"${n}"`).join(',')})`);
        return q;
      };
      const scopeReminders = (q: any) => {
        if (scope.kind === 'pts_sup' && scope.ptsMemberNames?.length) {
          return q.in('assign_name', scope.ptsMemberNames);
        }
        if (namaDikecualikan.length > 0) return q.not('assign_name', 'in', `(${namaDikecualikan.map(n => `"${n}"`).join(',')})`);
        return q;
      };

      // Parallel fetches
      const [ticketsRes, actLogsRes, remindersRes, piketHolidaysRes, piketWeekRes, kegiatanRes, movRes, usersRes, lcSessionsRes] =
        await Promise.all([
          scopeTickets(supabase.from('tickets').select('id,status,assign_name,sales_division,date,created_at,product')),
          supabase.from('activity_logs').select('id,ticket_id,new_status,created_at,handler_name').order('created_at',{ascending:false}).limit(500),
          scopeReminders(supabase.from('reminders').select('id,status,category,due_date,product')),
          supabase.from('picket_holidays').select('date'),
          supabase.from('piket_schedules').select('id,day_date,pic_ivp_name,pic_ump_name,pic_mvi_name').gte('day_date', getMonday()).lte('day_date', todayStr()).order('day_date'),
          supabase.from('piket_tamu_detail').select('id,created_at').gte('created_at', today),
          supabase.from('movement_logs').select('id,status_barang,tanggal,nama_pts').gte('tanggal', monthStart()),
          scope.kind === 'admin'
            ? supabase.from('users').select('id,role,team_type')
            : Promise.resolve({ data: [] }),
          scope.kind === 'admin'
            ? supabase.from('lc_quiz_attempts').select('id,user_id,score,passed,is_submitted,grading_status').eq('is_submitted', true).neq('grading_status', 'pending_review')
            : Promise.resolve({ data: [] }),
        ]);

      let tickets   = (ticketsRes.data   ?? []) as any[];
      let reminders = (remindersRes.data ?? []) as any[];
      let movements = (movRes.data       ?? []) as any[];
      const actLogs       = (actLogsRes.data     ?? []) as any[];
      const piketHolidays = (piketHolidaysRes.data ?? []).map((h: any) => h.date as string);
      const piketWeek     = (piketWeekRes.data   ?? []) as (PiketPic & { day_date: string; id: string })[];
      const piketToday    = computeCascadedPiketToday(piketWeek, piketHolidays, today);
      const kegiatan   = (kegiatanRes.data   ?? []) as any[];
      const users      = (usersRes.data      ?? []) as any[];
      const lcAttempts = (lcSessionsRes.data ?? []) as any[];

      // PTS scope: filter piket & movements to own team
      if (scope.kind === 'pts_sup') {
        const tt = scope.ptsTeamType ?? '';
        movements = movements.filter((m:any) => scope.ptsMemberNames?.includes(m.nama_pts));
        // piket: show all, but today card highlights their team column
      }

      // KPI calculations (identical to before, just on scoped data)
      const open           = tickets.filter((t:any)=>!['Solved','Cancelled'].includes(t.status)).length;
      const solved         = tickets.filter((t:any)=>t.status==='Solved').length;
      const waitingApproval= tickets.filter((t:any)=>t.status==='Waiting Approval').length;

      // Resolved today: cross-reference actLogs that belong to scoped tickets
      const scopedTicketIds = new Set(tickets.map((t:any)=>t.id as string));
      const resolvedToday = actLogs.filter((a:any)=>
        a.new_status==='Solved' && a.created_at?.startsWith(today) && scopedTicketIds.has(a.ticket_id)
      ).length;

      const handlerMap: Record<string,number> = {};
      tickets.filter((t:any)=>t.assign_name && !['Solved','Cancelled'].includes(t.status))
        .forEach((t:any)=>{ handlerMap[t.assign_name]=(handlerMap[t.assign_name]||0)+1; });
      const byHandler = Object.entries(handlerMap).map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count);

      const statusMap: Record<string,number> = {};
      tickets.forEach((t:any)=>{ statusMap[t.status]=(statusMap[t.status]||0)+1; });
      const byStatus = Object.entries(statusMap).map(([status,count])=>({ status,count,color:STATUS_COLORS[status]??'#94a3b8' })).sort((a,b)=>b.count-a.count);

      const divMap: Record<string,number> = {};
      tickets.forEach((t:any)=>{ if(t.sales_division) divMap[t.sales_division]=(divMap[t.sales_division]||0)+1; });
      const byDivision = Object.entries(divMap).map(([div,count])=>({div,count})).sort((a,b)=>b.count-a.count);
      const productTicketMap: Record<string,number> = {};
      tickets.forEach((t:any)=>{ if(t.product) productTicketMap[t.product]=(productTicketMap[t.product]||0)+1; });
      const byProduct = Object.entries(productTicketMap).map(([product,count])=>({product,count})).sort((a,b)=>b.count-a.count);

      const solvedT = tickets.filter((t:any)=>t.status==='Solved'&&t.date&&t.created_at);
      const totalDays = solvedT.reduce((acc:number,t:any)=>{
        const d=(new Date(t.date).getTime()-new Date(t.created_at).getTime())/86400000;
        return acc+Math.max(0,d);
      },0);
      const avgResolutionDays = solvedT.length?Math.round(totalDays/solvedT.length):0;

      const currentYear = new Date().getFullYear();
      const monthlyTickets = Array.from({length: 12}, (_, mi) =>
        tickets.filter((t: any) => {
          const d = new Date(t.created_at);
          return d.getFullYear() === currentYear && d.getMonth() === mi;
        }).length
      );

      const catMap: Record<string,number> = {};
      reminders.forEach((r:any)=>{ catMap[r.category]=(catMap[r.category]||0)+1; });
      const byCategory = Object.entries(catMap).map(([cat,count])=>({ cat,count,color:CATEGORY_COLORS[cat]??'#94a3b8' })).sort((a,b)=>b.count-a.count);
      const dueSoon     = reminders.filter((r:any)=>r.status==='pending'&&r.due_date>=today&&r.due_date<=oneWeekStr).length;
      const overdueCount= reminders.filter((r:any)=>r.status==='pending'&&r.due_date<today).length;
      // Reminder byProduct: per produk, group by category
      const reminderProdMap: Record<string, Record<string,number>> = {};
      reminders.forEach((r:any)=>{ 
        if(r.product) {
          if(!reminderProdMap[r.product]) reminderProdMap[r.product]={};
          reminderProdMap[r.product][r.category||'Lainnya']=(reminderProdMap[r.product][r.category||'Lainnya']||0)+1;
        }
      });
      const remindersByProduct = Object.entries(reminderProdMap).map(([product,catMap])=>({
        product,
        byCategory: Object.entries(catMap).map(([cat,count])=>({cat,count})).sort((a,b)=>b.count-a.count),
      })).sort((a,b)=>b.byCategory.reduce((s,c)=>s+c.count,0)-a.byCategory.reduce((s,c)=>s+c.count,0));

      const weekFilled = piketWeek.filter((p:any)=>p.pic_ivp_name||p.pic_ump_name||p.pic_mvi_name).length;
      // weekTotal = jumlah hari kerja (Senin-Jumat) dari awal minggu ini s.d. hari ini
      // weekTotal selalu 5 (Senin-Jumat), bukan hanya sampai hari ini
      const weekWorkDays = 5;

      const roleMap: Record<string,number> = {};
      users.forEach((u:any)=>{ roleMap[u.role]=(roleMap[u.role]||0)+1; });

      // Learning: dari lc_quiz_attempts (submitted)
      const lcSubmitted = lcAttempts.length;
      const lcPassed = lcAttempts.filter((a:any) => a.passed === true).length;
      const lcParticipants = new Set(lcAttempts.map((a:any) => a.user_id as string).filter(Boolean)).size;
      const lcScores = lcAttempts.filter((a:any) => a.score != null).map((a:any) => a.score as number);
      const lcAvgScore = lcScores.length ? Math.round(lcScores.reduce((a:number,b:number)=>a+b,0)/lcScores.length) : 0;

      setKpi({
        tickets:{ total:tickets.length,open,solved,waitingApproval,byHandler,byStatus,byDivision,byProduct,resolvedToday,avgResolutionDays,monthlyTickets },
        reminders:{ total:reminders.length,pending:reminders.filter((r:any)=>r.status==='pending').length,done:reminders.filter((r:any)=>r.status==='done').length,dueSoon,byCategory,byProduct:remindersByProduct,overdueCount },
        piket:{ todayIVP:piketToday?.pic_ivp_name??null,todayUMP:piketToday?.pic_ump_name??null,todayMvi:piketToday?.pic_mvi_name??null,weekFilled,weekTotal:weekWorkDays,kegiatanToday:kegiatan.length },
        units:{ totalLogs:movements.length,keluarThisMonth:movements.filter((m:any)=>m.status_barang==='Keluar').length,masukThisMonth:movements.filter((m:any)=>m.status_barang==='Masuk').length },
        users:{ total:users.length,byRole:Object.entries(roleMap).map(([role,count])=>({role,count})) },
        learning:{ totalSessions:lcSubmitted, completedSessions:lcPassed, totalParticipants:lcParticipants, avgScore:lcAvgScore },
      });
    } catch(e){ console.error('KPI fetch error:',e); }
    finally { setLoading(false); }
  }, [scope, scopeReady, currentUser]);

  // 3. Fetch Audit (scope-aware)

  const fetchAudit = useCallback(async () => {
    if (!scopeReady || scope.kind === 'none') { setAuditLoading(false); return; }
    setAuditLoading(true);
    try {
      // Build ticket filter
      const ticketQ = (() => {
        let q = supabase.from('tickets').select('id,project_name,status,assign_name,created_by,created_at,date').order('created_at',{ascending:false}).limit(40);
        if (scope.kind==='pts_sup'&&scope.ptsMemberNames?.length) q=q.in('assign_name',scope.ptsMemberNames);
        return q;
      })();
      const actQ = (() => {
        let q = supabase.from('activity_logs').select('id,ticket_id,handler_name,action_taken,new_status,notes,created_at').order('created_at',{ascending:false}).limit(80);
        if (scope.kind==='pts_sup'&&scope.ptsMemberNames?.length) q=q.in('handler_name',scope.ptsMemberNames);
        return q;
      })();
      const reminderQ = (() => {
        let q = supabase.from('reminders').select('id,project_name,category,status,assign_name,created_by,created_at,updated_at').order('updated_at',{ascending:false}).limit(50);
        if (scope.kind==='pts_sup'&&scope.ptsMemberNames?.length) q=q.in('assign_name',scope.ptsMemberNames);
        return q;
      })();

      const [ticketsRes, actLogsRes, remindersRes, usersRes, movRes] = await Promise.all([
        ticketQ, actQ, reminderQ,
        scope.kind==='admin' ? supabase.from('users').select('id,full_name,role,created_at').order('created_at',{ascending:false}).limit(20) : Promise.resolve({data:[]}),
        (scope.kind==='admin'||scope.kind==='pts_sup') ? supabase.from('movement_logs').select('id,nama_pts,event,status_barang,project_name,created_at,created_by').order('created_at',{ascending:false}).limit(20) : Promise.resolve({data:[]}),
      ]);

      const entries: AuditEntry[] = [];

      (ticketsRes.data??[]).forEach((t:any)=>{
        entries.push({ id:`ticket-${t.id}`,module:'Ticketing',icon:'🎫', actor:t.created_by??'Unknown', action:'Ticket dibuat', target:t.project_name??'-', detail:`Status: ${t.status}${t.assign_name?` · Handler: ${t.assign_name}`:''}`, ts:t.created_at, severity:t.status==='Waiting Approval'?'warn':'info' });
      });
      (actLogsRes.data??[]).forEach((a:any)=>{
        const isCrit=['Solved','Overdue'].includes(a.new_status), isWarn=['Waiting Approval','Warranty','Out Of Warranty'].includes(a.new_status);
        entries.push({ id:`act-${a.id}`,module:'Ticketing',icon:isCrit?'✅':'🔄', actor:a.handler_name??'System', action:`Status → ${a.new_status}`, target:a.action_taken??'', detail:a.notes??'', ts:a.created_at, severity:isCrit?'critical':isWarn?'warn':'info' });
      });
      (remindersRes.data??[]).forEach((r:any)=>{
        const isUpdated = r.updated_at && r.updated_at !== r.created_at;
        const ts = r.updated_at ?? r.created_at;
        const action = r.status==='done' ? 'Reminder diselesaikan' : isUpdated ? 'Reminder diupdate' : 'Reminder dibuat';
        const icon = r.status==='done' ? '✅' : isUpdated ? '🔄' : '🗓️';
        const sev: 'info'|'warn' = r.status==='done' ? 'info' : 'warn';
        entries.push({ id:`rem-${r.id}`,module:'Reminder',icon, actor:r.created_by??'Unknown', action, target:r.project_name??'-', detail:`${r.category??''}${r.assign_name?` · ${r.assign_name}`:''}`, ts, severity:sev });
      });
      (usersRes.data??[]).forEach((u:any)=>{
        entries.push({ id:`usr-${u.id}`,module:'User',icon:'👤', actor:'Admin', action:'User ditambahkan', target:u.full_name, detail:`Role: ${u.role}`, ts:u.created_at, severity:'info' });
      });
      (movRes.data??[]).forEach((m:any)=>{
        entries.push({ id:`mov-${m.id}`,module:'Unit Movement',icon:'🚚', actor:m.created_by??m.nama_pts??'Unknown', action:`Unit ${m.status_barang}`, target:m.project_name??m.event??'-', detail:m.event??'', ts:m.created_at, severity:'info' });
      });

      entries.sort((a,b)=>new Date(b.ts).getTime()-new Date(a.ts).getTime());
      setAudit(entries);
    } catch(e){ console.error('Audit error:',e); }
    finally { setAuditLoading(false); }
  }, [scope, scopeReady]);

  // Effects: trigger fetch when scope is resolved

  /*
    Egress: fetchKPI() mengambil SELURUH tabel tickets & reminders tanpa
    limit (dibutuhkan untuk hitungan byHandler/byStatus/byDivision/dst) -
    jangan sampai itu juga jalan tiap 3 menit di tab yang ditinggal di
    background. Pola berhenti-saat-tersembunyi yang sama dengan Ticketing/
    NotificationBar diterapkan di sini.
  */
  useEffect(() => {
    if (!scopeReady) return;
    const segarkan = () => { fetchKPI(); fetchAudit(); setLastRefresh(new Date()); };
    const mulaiPolling = () => {
      if (intervalRef.current) return;
      intervalRef.current = setInterval(segarkan, 3 * 60 * 1000);
    };
    const hentikanPolling = () => {
      if (!intervalRef.current) return;
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
    const saatVisibilitasBerubah = () => {
      if (document.visibilityState === 'hidden') { hentikanPolling(); return; }
      segarkan();
      mulaiPolling();
    };
    segarkan();
    if (document.visibilityState !== 'hidden') mulaiPolling();
    document.addEventListener('visibilitychange', saatVisibilitasBerubah);
    return () => {
      hentikanPolling();
      document.removeEventListener('visibilitychange', saatVisibilitasBerubah);
    };
  }, [scopeReady, fetchKPI, fetchAudit]);

  // Filtered Audit

  const filteredAudit = audit.filter(a => {
    const matchFilter = auditFilter==='all'
      ||(auditFilter==='ticket'&&a.module==='Ticketing')
      ||(auditFilter==='reminder'&&a.module==='Reminder')
      ||(auditFilter==='piket'&&a.module==='Piket')
      ||(auditFilter==='user'&&a.module==='User');
    const q=auditSearch.toLowerCase();
    return matchFilter && (!q||[a.actor,a.target,a.action,a.detail].some(x=>x.toLowerCase().includes(q)));
  });

  // Early return if no access
  if (!scopeReady) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin"/>
    </div>
  );
  /*
    DIHAPUS: isPTSIVP / isPTSUMP / isPTSMVI ("Piket card highlight per team").
    Ketiganya dideklarasikan tapi TIDAK PERNAH dipakai di mana pun - sisa
    penyorotan per-tim yang sudah tidak ada lagi. Dibiarkan berdiri justru
    menyesatkan: ia tampak seperti daftar tim yang harus ikut diperbarui
    setiap kali ada kelompok baru, padahal menghapusnya tidak mengubah apa
    pun di layar.
  */

  const scopeTitle = scope.kind==='admin' ? 'Dashboard'
    : scope.kind==='pts_sup' ? `Summary ${scope.ptsTeamType}`
    : scope.kind==='team' ? 'Dashboard'
    : 'KPI Dashboard';

  const TAB_CONFIG = [
    {key:'analytics' as const, icon:'📊', label:'Analytics'},
  ];

  // LC-style design helpers
  function SectionPill({ icon, children }: { icon: string; children: React.ReactNode }) {
    return (
      <h3 className="text-sm font-bold uppercase tracking-widest mb-4 inline-flex items-center gap-1.5 bg-white text-slate-700 px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm border border-slate-200">
        <span>{icon}</span>{children}
      </h3>
    );
  }

  // Full DonutChart (same as LC)
  // MiniBar: horizontal progress bar
  function MiniBar({ value, max, color='#3b82f6', h=4 }: { value:number; max:number; color?:string; h?:number }) {
    const pct = max>0 ? Math.min(100,(value/max)*100) : 0;
    return (
      <div className="w-full rounded-full overflow-hidden flex-1" style={{height:h,background:'#f1f5f9'}}>
        <div className="h-full rounded-full transition-all duration-500" style={{width:`${pct}%`,background:color}}/>
      </div>
    );
  }


  return (
    <div className="w-full">
        {/* ── Content area ── */}
        {/*  Kisi bento 12 kolom, sama persis dengan milik dashboard - termasuk
             jumlah kolom dan jaraknya, supaya ubin di sini berbaris dengan
             ubin My Action / Hari Ini / Mendatang di atasnya. */}
        <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-4 items-start">

          {/* ══════════ TAB ANALYTICS ══════════ */}
          {tab==='analytics' && (
            <div className="grid grid-cols-1 gap-3 lg:contents">

              {/*  Jangkar halaman. Lihat PitaRingkas untuk alasannya. */}
              <PitaRingkas kpi={kpi} loading={loading}
                catatan={scope.kind==='pts_sup' ? (scope.ptsTeamType ?? 'Tim') : scope.kind==='admin' ? 'Semua Tim' : 'Tim Saya'}/>

              <RelSeksi judul="Operasional"/>

              {/*
                Empat ubin operasional. Anatominya SENADA (permukaan, kepala,
                angka utama) tapi tidak identik: Ticket/Reminder/Unit memakai
                bilah rasio, Piket memakai cincin + papan nama karena isinya
                memang NAMA, bukan besaran yang bisa dibandingkan panjangnya.
              */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:contents">

                {/* TICKET */}
                <KartuModul
                  kelas="lg:col-span-3" ikon="🎫" judul="Ticket" warna="#e11d48"
                  catatan={scope.kind==='pts_sup'?scope.ptsTeamType:'Semua'}
                  angka={loading?'—':(kpi?.tickets.total??0)}
                  satuan="tiket"
                  percik={loading?undefined:(kpi?.tickets.monthlyTickets??[]).slice(0, new Date().getMonth()+1)}
                  kaki={!loading&&kpi
                    ? <KakiUbin kiri="Avg resolusi" warna={BAIK} kanan={`${kpi.tickets.avgResolutionDays} hari`}/>
                    : undefined}>
                  {loading
                    ? [0,1,2].map(i=><div key={i} className="h-1.5 rounded bg-slate-100 animate-pulse"/>)
                    : batasDenganLainnya(kpi?.tickets.byStatus??[], 4, count=>({status:'Lainnya',count,color:'#94a3b8'}))
                        .map(s=>(
                          <BarisRincian key={s.status} label={s.status} value={s.count}
                            total={kpi?.tickets.total??0}
                            warna={/overdue/i.test(s.status)?KRITIS:/solved|selesai/i.test(s.status)?BAIK:AKSEN}/>
                        ))}
                </KartuModul>

                {/* REMINDER SCHEDULE */}
                <KartuModul
                  kelas="lg:col-span-3" ikon="📅" judul="Reminder Schedule" warna="#7c3aed"
                  angka={loading?'—':(kpi?.reminders.total??0)}
                  satuan="jadwal"
                  kaki={!loading&&kpi
                    ? <KakiUbin kiri="Done rate" warna={BAIK}
                        kanan={`${kpi.reminders.total>0?Math.round((kpi.reminders.done/kpi.reminders.total)*100):0}%`}/>
                    : undefined}>
                  {loading
                    ? [0,1,2].map(i=><div key={i} className="h-1.5 rounded bg-slate-100 animate-pulse"/>)
                    : <>
                        <BarisRincian label="Done"    value={kpi?.reminders.done??0}         total={kpi?.reminders.total??0} warna={BAIK}/>
                        <BarisRincian label="Pending" value={kpi?.reminders.pending??0}      total={kpi?.reminders.total??0} warna={HATI}/>
                        <BarisRincian label="Overdue" value={kpi?.reminders.overdueCount??0} total={kpi?.reminders.total??0} warna={KRITIS}/>
                      </>}
                </KartuModul>

                {/* PIKET SHOWROOM — cincin + papan nama, bukan bilah */}
                <div className={`${UBIN} lg:col-span-3 h-full`} style={{ boxShadow: BAYANG_UBIN }}>
                  <RelAksen warna="#0891b2"/>
                  <KepalaUbin ikon="🏪" judul="Piket Showroom" warna="#0891b2"
                    catatan={new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'short'})}/>
                  <div className="flex items-center gap-3.5">
                    <Cincin ukuran={82} warna="#0891b2"
                      nilai={kpi?.piket.weekFilled??0} dari={kpi?.piket.weekTotal??0}
                      teks={loading?'—':`${kpi?.piket.weekFilled??0}/${kpi?.piket.weekTotal??0}`}/>
                    {/*  PIC piket adalah NAMA, bukan angka - bilah sepanjang nol
                        untuk "belum diisi" cuma menipu mata: terbaca seperti
                        nilai nol padahal artinya "belum ada datanya". */}
                    <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                      {[
                        {team:'IVP', person:kpi?.piket.todayIVP},
                        {team:'UMP', person:kpi?.piket.todayUMP},
                        {team:'MVI', person:kpi?.piket.todayMvi},
                      ].map(p=>(
                        <div key={p.team} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-[10px] bg-slate-50 border border-black/[0.05]">
                          <span className="text-[10px] font-black tracking-[0.08em] flex-shrink-0" style={{color:'#0891b2'}}>{p.team}</span>
                          {loading
                            ? <span className="inline-block h-2.5 w-16 rounded bg-slate-100 animate-pulse"/>
                            : p.person
                              ? <span className="text-[11px] font-bold text-slate-600 truncate">{p.person}</span>
                              : <span className="text-[11px] font-semibold text-slate-300 italic truncate">Belum diisi</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-auto">
                    {!loading&&kpi&&<KakiUbin kiri={`${kpi.piket.kegiatanToday} tamu hari ini`} warna="#0891b2"
                      kanan={`${Math.min(100,Math.round((kpi.piket.weekFilled/Math.max(kpi.piket.weekTotal,1))*100))}% terpenuhi`}/>}
                  </div>
                </div>

                {/* UNIT MOVEMENT */}
                <KartuModul
                  kelas="lg:col-span-3" ikon="🚚" judul="Unit Movement" warna="#d97706"
                  catatan="Bulan ini"
                  angka={loading?'—':(kpi?.units.totalLogs??0)}
                  satuan="log tercatat"
                  kaki={!loading&&kpi
                    ? <KakiUbin kiri="Saldo bulan ini" warna="#d97706"
                        kanan={`${kpi.units.masukThisMonth-kpi.units.keluarThisMonth>0?'+':''}${kpi.units.masukThisMonth-kpi.units.keluarThisMonth} unit`}/>
                    : undefined}>
                  {loading
                    ? [0,1].map(i=><div key={i} className="h-1.5 rounded bg-slate-100 animate-pulse"/>)
                    : <>
                        <BarisRincian label="Keluar" value={kpi?.units.keluarThisMonth??0} total={kpi?.units.totalLogs??0} warna={HATI}/>
                        <BarisRincian label="Masuk"  value={kpi?.units.masukThisMonth??0}  total={kpi?.units.totalLogs??0} warna={BAIK}/>
                      </>}
                </KartuModul>
              </div>

              <RelSeksi judul="Distribusi Tiket"/>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:contents">

                {/*
                  Beban handler sebagai PAPAN PERINGKAT, bukan bar chart.
                  Datanya sering cuma satu atau dua orang, dan grafik batang
                  berisi satu batang tidak membandingkan apa pun - yang dibaca
                  orang di sana adalah nama dan angkanya. Orang teratas diberi
                  aksen penuh, sisanya abu: penekanan, bukan peringkat berwarna.
                */}
                <div className={`${UBIN} lg:col-span-3 h-full`} style={{ boxShadow: BAYANG_UBIN }}>
                  <RelAksen warna={AKSEN}/>
                  <KepalaUbin ikon="🏅" judul="Beban Handler" warna={AKSEN} catatan="Open"/>
                  {loading ? <div className="h-28 rounded animate-pulse bg-slate-100"/>
                    : kpi?.tickets.byHandler.length ? <>
                      <div className="flex flex-col">
                        {kpi.tickets.byHandler.slice(0,5).map((h,i)=>(
                          <div key={h.name} className="flex items-center gap-2.5 py-[7px] border-b border-black/[0.05] last:border-b-0">
                            <span aria-hidden="true" className="w-7 h-7 rounded-[10px] grid place-items-center text-[10.5px] font-black text-white flex-shrink-0"
                              style={{ background: i===0 ? AKSEN : '#cbd5e1' }}>{inisial(h.name)}</span>
                            <span className="text-[12px] font-extrabold text-slate-800 flex-1 truncate">{h.name}</span>
                            <span className="text-[16px] font-black tabular-nums flex-shrink-0"
                              style={{ color: i===0 ? AKSEN : '#94a3b8' }}>{h.count}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-auto">
                        <KakiUbin kiri="Rata-rata beban" warna={AKSEN}
                          kanan={`${(kpi.tickets.open/Math.max(kpi.tickets.byHandler.length,1)).toFixed(1).replace('.',',')} tiket/orang`}/>
                      </div>
                    </> : <p className="text-sm text-center py-6 text-slate-400">Tidak ada data</p>}
                </div>

                {/* DIVISI */}
                <div className={`${UBIN} lg:col-span-3 h-full`} style={{ boxShadow: BAYANG_UBIN }}>
                  <RelAksen warna={AKSEN}/>
                  <KepalaUbin ikon="🏢" judul="Ticket per Divisi" warna={AKSEN}/>
                  {loading?<div className="h-32 rounded animate-pulse bg-slate-100"/>:
                    kpi?.tickets.byDivision.length
                      ? <HBarChart data={kpi.tickets.byDivision.map(d=>({label:d.div,value:d.count}))}/>
                      : <p className="text-sm text-center py-6 text-slate-400">Tidak ada data</p>}
                </div>

                {/*
                  Produk enam kolom: labelnya yang paling panjang di baris ini
                  ("Philips 55BDL2105X", "Microvision MV-U55…"), dan 3+3+6
                  menggenapkan barisnya jadi dua belas tanpa slot menggantung.
                */}
                <div className={`${UBIN} lg:col-span-6 h-full`} style={{ boxShadow: BAYANG_UBIN }}>
                  <RelAksen warna={AKSEN}/>
                  <KepalaUbin ikon="📦" judul="Ticket per Produk" warna={AKSEN} catatan="6 teratas"/>
                  {loading?<div className="h-32 rounded animate-pulse bg-slate-100"/>:
                    kpi?.tickets.byProduct?.length
                      ? <HBarChart lebarLabel="10rem" data={kpi.tickets.byProduct.map(p=>({label:p.product,value:p.count}))}/>
                      : <p className="text-sm text-center py-6 text-slate-400">Tidak ada data produk</p>}
                </div>
              </div>

              <RelSeksi judul="Tim & Pembelajaran"/>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:contents">

                {/* TREND — area, lihat TrenBulanan */}
                <div className={`${UBIN} ${scope.kind==='admin'?'lg:col-span-6':'lg:col-span-12'} h-full`} style={{ boxShadow: BAYANG_UBIN }}>
                  <RelAksen warna={AKSEN}/>
                  <KepalaUbin ikon="📈" judul={`Trend Ticket Bulanan ${new Date().getFullYear()}`} warna={AKSEN}
                    catatan={!loading&&kpi ? `${kpi.tickets.monthlyTickets.reduce((s,v)=>s+v,0)} total` : undefined}/>
                  {loading ? <div className="h-36 rounded animate-pulse bg-slate-100"/>
                    : kpi?.tickets.monthlyTickets?.some(v=>v>0)
                      ? <TrenBulanan data={kpi.tickets.monthlyTickets}/>
                      : <div className="flex flex-col items-center gap-2 py-10">
                          <span className="text-3xl opacity-20" aria-hidden="true">📊</span>
                          <p className="text-[11px] text-slate-400">Belum ada data ticket tahun ini.</p>
                        </div>}
                </div>

                {scope.kind==='admin' && <>
                  {/* LEARNING CENTER */}
                  <div className={`${UBIN} lg:col-span-3 h-full`} style={{ boxShadow: BAYANG_UBIN }}>
                    <RelAksen warna={BAIK}/>
                    <KepalaUbin ikon="🎓" judul="Learning Center" warna={BAIK}/>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        {label:'Peserta',  value:kpi?.learning.totalParticipants??0, w:'#0f172a'},
                        {label:'Attempt',  value:kpi?.learning.totalSessions??0,     w:'#0f172a'},
                        {label:'Avg skor', value:kpi?.learning.avgScore??0,          w:BAIK},
                      ].map(s=>(
                        <div key={s.label}>
                          <p className="text-[9.5px] font-black uppercase tracking-[0.07em] text-slate-400 truncate">{s.label}</p>
                          {loading
                            ? <div className="h-6 w-10 rounded bg-slate-100 animate-pulse mt-1"/>
                            : <p className="text-[24px] font-black leading-none mt-1 tabular-nums" style={{color:s.w,letterSpacing:'-0.03em'}}>{s.value}</p>}
                        </div>
                      ))}
                    </div>
                    {/*  Pass rate sebagai satu cincin - bagian-dari-keseluruhan
                        yang sesungguhnya, menggantikan dua donat yang dulu
                        menyatakan rasio yang sama dua kali. */}
                    {!loading&&kpi&&(()=>{
                      const gagal = Math.max(kpi.learning.totalSessions-kpi.learning.completedSessions,0);
                      const pct = kpi.learning.totalSessions>0
                        ? Math.round((kpi.learning.completedSessions/kpi.learning.totalSessions)*100) : 0;
                      const w = pct>=80?BAIK:pct>=60?HATI:KRITIS;
                      return (
                        <div className="flex items-center gap-3.5 mt-auto pt-4">
                          <Cincin ukuran={72} warna={w} nilai={kpi.learning.completedSessions} dari={kpi.learning.totalSessions} teks={`${pct}%`}/>
                          <div className="min-w-0">
                            <p className="text-[11px] font-extrabold text-slate-700">Pass rate</p>
                            <div className="flex flex-col gap-1 mt-1.5">
                              <span className="flex items-center gap-1.5 text-[10.5px] font-bold text-slate-500">
                                <i className="w-2.5 h-2.5 rounded-[3px] flex-shrink-0" style={{background:w}}/>{kpi.learning.completedSessions} lulus</span>
                              <span className="flex items-center gap-1.5 text-[10.5px] font-bold text-slate-500">
                                <i className="w-2.5 h-2.5 rounded-[3px] flex-shrink-0" style={{background:'#e2e8f0'}}/>{gagal} gagal</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/*
                    Pengguna: satu bilah bertumpuk, bukan empat bilah terpisah.
                    Yang ditanyakan tentang peran akun adalah KOMPOSISI - berapa
                    bagian dari seluruh akun - dan itu justru hilang kalau tiap
                    peran diberi bilah sendiri dengan patokan panjang yang sama.
                  */}
                  <div className={`${UBIN} lg:col-span-3 h-full`} style={{ boxShadow: BAYANG_UBIN }}>
                    <RelAksen warna="#475569"/>
                    <KepalaUbin ikon="👥" judul="Pengguna" warna="#475569"/>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[38px] font-black leading-[0.92] text-slate-900 tabular-nums" style={{letterSpacing:'-0.035em'}}>
                        {loading?'—':(kpi?.users.total??0)}</span>
                      <span className="text-[11px] font-bold text-slate-400">akun terdaftar</span>
                    </div>
                    {!loading&&kpi&&(()=>{
                      const WARNA = ['#4f46e5','#7c3aed','#d97706','#94a3b8','#0891b2','#e11d48'];
                      const peran = kpi.users.byRole.filter(r=>r.count>0);
                      return (
                        <div className="mt-auto pt-4">
                          <div className="flex gap-[2px] h-3 rounded-full overflow-hidden">
                            {peran.map((r,i)=>(
                              <span key={r.role??i} title={`${(r.role??'—').toUpperCase()}: ${r.count}`}
                                style={{flex:r.count, background:WARNA[i%WARNA.length]}}/>
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 mt-2.5">
                            {peran.map((r,i)=>(
                              <span key={r.role??i} className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-slate-500">
                                <i className="w-2.5 h-2.5 rounded-[3px] flex-shrink-0" style={{background:WARNA[i%WARNA.length]}}/>
                                {(r.role??'Belum diatur').toUpperCase()} {r.count}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </>}
              </div>

            </div>
          )}

          {/* Cross-Module and Audit Trail tabs removed — moved to Analytics Platform page */}
          {(tab as string)==='cross_removed'&&(
            <div className="space-y-5">
              <div className="lg:col-span-12 text-sm font-bold uppercase tracking-widest text-slate-500 mb-1">🔀 Cross-Module Overview — Ticket · Reminder · Learning Center</div>

              {/* Monthly bar chart: 3 modules side by side */}
              {(() => {
                const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
                const year = new Date().getFullYear();
                // Build monthly data from kpi data available in state
                // We'll use kpiTeam member data to aggregate
                const allMembers = kpiTeam.members;
                const ticketsByMonth = Array.from({length:12},(_,mi)=>
                  allMembers.reduce((s,m)=>s+(m.monthlyTickets?.[mi]??0),0)
                );
                const lcByMonth = Array.from({length:12},(_,mi)=>
                  allMembers.reduce((s,m)=>s+(m.monthlyLC?.[mi]??0),0)
                );
                // For reminders we use kpi.reminders.byCategory total as flat (no monthly breakdown yet)
                const maxVal = Math.max(...ticketsByMonth, ...lcByMonth, 1);
                return (
                  <div className={`${UBIN} lg:col-span-12`} style={{ boxShadow: BAYANG_UBIN }}>
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">📅 Aktivitas Bulanan {year}</h3>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{background:'#ef4444'}}/>Ticket</span>
                        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{background:'#6366f1'}}/>LC Attempt</span>
                      </div>
                    </div>
                    {allMembers.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-10">
                        <span className="text-3xl opacity-20">📊</span>
                        <p className="text-[10px] text-slate-400">Data KPI Team belum tersedia. Buka menu KPI Team untuk memuat data.</p>
                      </div>
                    ) : (
                      <div className="flex items-end gap-1.5" style={{height:160}}>
                        {MONTHS.map((m,mi)=>{
                          const t=ticketsByMonth[mi], l=lcByMonth[mi];
                          const hT=Math.round((t/maxVal)*140), hL=Math.round((l/maxVal)*140);
                          return (
                            <div key={mi} className="flex-1 flex flex-col items-center gap-1 group">
                              <div className="flex items-end gap-0.5 w-full justify-center" style={{height:148}}>
                                <div className="w-[42%] rounded-t transition-all duration-700" title={`Ticket: ${t}`}
                                  style={{height:hT||2, background:'#ef4444', opacity:t?0.85:0.12}}/>
                                <div className="w-[42%] rounded-t transition-all duration-700" title={`LC: ${l}`}
                                  style={{height:hL||2, background:'#6366f1', opacity:l?0.85:0.12}}/>
                              </div>
                              <span className="text-[10px] text-slate-400">{m}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Module summary comparison */}
              <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Tickets */}
                <div className={`${UBIN} space-y-3`} style={{ boxShadow: BAYANG_UBIN }}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center text-sm" style={{background:'#fee2e2'}}>🎫</div>
                    <span className="text-sm font-black uppercase tracking-widest text-slate-500">Ticketing</span>
                  </div>
                  {[
                    {label:'Total',val:kpi?.tickets.total??0,color:'#64748b'},
                    {label:'Open',val:kpi?.tickets.open??0,color:'#ef4444'},
                    {label:'Solved',val:kpi?.tickets.solved??0,color:'#10b981'},
                    {label:'Overdue',val:(kpi?.tickets.byStatus??[]).find(s=>s.status==='Overdue')?.count??0,color:'#f59e0b'},
                  ].map(r=>(
                    <div key={r.label} className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">{r.label}</span>
                      <span className="text-sm font-black" style={{color:r.color}}>{loading?'—':r.val}</span>
                    </div>
                  ))}
                </div>
                {/* Reminders */}
                <div className={`${UBIN} space-y-3`} style={{ boxShadow: BAYANG_UBIN }}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center text-sm" style={{background:'#ede9fe'}}>📅</div>
                    <span className="text-sm font-black uppercase tracking-widest text-slate-500">Reminder</span>
                  </div>
                  {[
                    {label:'Total',val:kpi?.reminders.total??0,color:'#64748b'},
                    {label:'Pending',val:kpi?.reminders.pending??0,color:'#f59e0b'},
                    {label:'Done',val:kpi?.reminders.done??0,color:'#10b981'},
                    {label:'Overdue',val:kpi?.reminders.overdueCount??0,color:'#ef4444'},
                  ].map(r=>(
                    <div key={r.label} className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">{r.label}</span>
                      <span className="text-sm font-black" style={{color:r.color}}>{loading?'—':r.val}</span>
                    </div>
                  ))}
                </div>
                {/* Learning Center */}
                <div className={`${UBIN} space-y-3`} style={{ boxShadow: BAYANG_UBIN }}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center text-sm" style={{background:'#ede9fe'}}>🎓</div>
                    <span className="text-sm font-black uppercase tracking-widest text-slate-500">Learning Center</span>
                  </div>
                  {[
                    {label:'Total Sesi',val:kpi?.learning.totalSessions??0,color:'#64748b'},
                    {label:'Selesai',val:kpi?.learning.completedSessions??0,color:'#10b981'},
                    {label:'Peserta Unik',val:kpi?.learning.totalParticipants??0,color:'#6366f1'},
                    {label:'Avg Skor',val:`${kpi?.learning.avgScore??0} pts`,color:'#f59e0b'},
                  ].map(r=>(
                    <div key={r.label} className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">{r.label}</span>
                      <span className="text-sm font-black" style={{color:r.color}}>{loading?'—':r.val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Team KPI summary table */}
              {kpiTeam.members.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-100">
                    <span className="text-sm font-black uppercase tracking-widest text-slate-500">👥 Ringkasan KPI Tim — {kpiTeam.filterYear}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" style={{minWidth:560}}>
                      <thead>
                        <tr style={{background:'#f8fafc',borderBottom:'1px solid #e2e8f0'}}>
                          {['Nama','Tim','Ticket','LC','BAST','Skor KPI'].map(h=>(
                            <th key={h} className="px-3 py-2 text-left text-sm font-bold uppercase tracking-widest text-slate-400">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {kpiTeam.members.map(m=>{
                          const _s = kpiSettings;
                          const lcFailedDyn = (m.lcScores ?? []).filter((sc: number) => sc < _s.lcMinScore).length;
                          const tickS = m.ticketsHandled>0?Math.max(0,1-m.ticketsOverdue/Math.max(m.ticketsHandled,1)):0;
                          const bastS = m.formReviewTotal===0?0:m.formReviewLowRating===0?1:Math.max(0,1-m.formReviewLowRating/Math.max(m.formReviewTotal,1));
                          const lcS   = m.lcAttempts===0?0:Math.max(0,1-(lcFailedDyn/Math.max(m.lcAttempts,1)));
                          const rndS  = m.techNotesApproved>=_s.rndTarget?1:m.techNotesApproved/_s.rndTarget;
                          const final = Math.round((_s.ticketOverdueWeight*tickS + _s.bastWeight*bastS + _s.lcWeight*lcS + _s.rndWeight*rndS) * 100);
                          const noData = m.ticketsHandled===0&&m.lcAttempts===0&&m.techNotesApproved===0;
                          const c = noData?'#94a3b8':final>=85?'#10b981':final>=70?'#3b82f6':final>=50?'#f59e0b':'#ef4444';
                          return (
                            <tr key={m.id} style={{borderBottom:'1px solid #f1f5f9'}} className="hover:bg-slate-50/50">
                              <td className="px-3 py-2 font-semibold text-slate-700">{m.name.split(' ').slice(0,2).join(' ')}</td>
                              <td className="px-3 py-2 text-slate-400 text-sm">{m.team_type.replace('Team PTS ','')}</td>
                              <td className="px-3 py-2"><span className="font-bold text-red-500">{m.ticketsHandled}</span><span className="text-slate-400 ml-1">({m.ticketsOverdue} overdue)</span></td>
                              <td className="px-3 py-2"><span className="font-bold text-indigo-500">{m.lcAttempts}</span><span className="text-slate-400 ml-1">avg {m.lcAvgScore}</span></td>
                              <td className="px-3 py-2"><span className="font-bold text-amber-500">{m.formReviewLowRating}</span><span className="text-slate-400 ml-1">low-rating</span></td>
                              <td className="px-3 py-2"><span className="text-sm font-black" style={{color:c}}>{noData?'—':`${final}%`}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {(tab as string)==='audit_removed'&&(
            <div className="rounded-2xl p-4 space-y-3"
              style={{ background:'rgba(255,255,255,0.92)', backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)', border:'1px solid rgba(0,0,0,0.07)', boxShadow:'0 2px 16px rgba(0,0,0,0.08)' }}>
              {/* Search + filter */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[180px]">
                  <svg aria-hidden="true" focusable="false" className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                  <input aria-label="Cari actor, aksi, target..." value={auditSearch} onChange={e=>setAuditSearch(e.target.value)}
                    placeholder="Cari actor, aksi, target..."
                    className="w-full rounded-lg pl-8 pr-3 py-2 text-sm outline-none bg-slate-50 border border-slate-200 text-slate-700 focus:border-blue-300 focus:ring-1 focus:ring-blue-100 transition-all"/>
                </div>
                {(['all','ticket','reminder','piket','user'] as const).map(f=>(
                  <button key={f} onClick={()=>setAuditFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold tracking-wide transition-all border ${auditFilter===f ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                    {f==='all'?'SEMUA':f.toUpperCase()}
                  </button>
                ))}
                <span className="text-sm ml-auto tracking-widest text-slate-400">{filteredAudit.length} ENTRI</span>
              </div>
              {/* List */}
              <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1"
                style={{ scrollbarWidth:'thin', scrollbarColor:'rgba(0,0,0,0.1) transparent' }}>
                {auditLoading
                  ? Array.from({length:6}).map((_,i)=>(
                      <div key={i} className="h-12 rounded-lg animate-pulse bg-slate-100"/>
                    ))
                  : filteredAudit.length===0
                    ? <div className="text-center py-12 text-sm tracking-widest text-slate-300">TIDAK ADA DATA</div>
                    : filteredAudit.map((entry:AuditEntry,idx:number)=>(
                        <div key={entry.id??idx}><AuditRow entry={entry}/></div>
                      ))}
              </div>
            </div>
          )}

        </div>{/* end content */}

      {/* ══ Settings Modal ══ */}
      {showSettings && typeof document !== 'undefined' && createPortal(
        <div role="dialog" aria-modal="true" aria-label="Pengaturan KPI" className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowSettings(false); }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <div className="font-bold text-slate-800 text-base">⚙️ Pengaturan KPI</div>
                <div className="text-sm text-slate-400 mt-0.5">Atur batas & bobot masing-masing komponen</div>
              </div>
              <button aria-label="Tutup" onClick={()=>setShowSettings(false)} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100">×</button>
            </div>
            <div className="p-6 space-y-5">
              {/* LC Min Score */}
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1.5 uppercase tracking-wide">🎓 Learning Center — Batas Nilai Minimum</label>
                <div className="flex items-center gap-3">
                  <input aria-label="🎓 Learning Center — Batas Nilai Minimum" type="range" min={40} max={85} step={5} value={kpiSettings.lcMinScore}
                    onChange={e=>setKpiSettings(p=>({...p, lcMinScore:Number(e.target.value)}))}
                    className="flex-1 accent-violet-600"/>
                  <span className="text-lg font-black text-violet-600 w-12 text-right">&lt;{kpiSettings.lcMinScore}</span>
                </div>
                <div className="text-sm text-slate-400 mt-1">Nilai di bawah ini dianggap tidak lulus KPI LC</div>
              </div>
              {/* RnD Target */}
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1.5 uppercase tracking-wide">📝 R&D Tech Note — Target per Tahun</label>
                <div className="flex items-center gap-3">
                  <input aria-label="📝 R&D Tech Note — Target per Tahun" type="range" min={1} max={8} step={1} value={kpiSettings.rndTarget}
                    onChange={e=>setKpiSettings(p=>({...p, rndTarget:Number(e.target.value)}))}
                    className="flex-1 accent-pink-600"/>
                  <span className="text-lg font-black text-pink-600 w-12 text-right">{kpiSettings.rndTarget}x</span>
                </div>
                <div className="text-sm text-slate-400 mt-1">Minimal Tech Note approved per tahun untuk nilai penuh</div>
              </div>
              {/* Bobot section */}
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-3 uppercase tracking-wide">📊 Bobot Komponen KPI (total harus 100%)</label>
                <div className="space-y-3">
                  {([
                    {key:'ticketOverdueWeight', label:'🎫 Ticketing', color:'#ef4444'},
                    {key:'bastWeight', label:'⭐ BAST & Demo', color:'#f59e0b'},
                    {key:'lcWeight', label:'🎓 Learning Center', color:'#6366f1'},
                    {key:'rndWeight', label:'📝 R&D Tech Note', color:'#ec4899'},
                  ] as {key: keyof KPISettings, label:string, color:string}[]).map(item=>(
                    <div key={item.key} className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-slate-600 w-36 flex-shrink-0">{item.label}</span>
                      <input aria-label="Bobot KPI" type="range" min={5} max={60} step={5} value={Math.round((kpiSettings[item.key] as number)*100)}
                        onChange={e=>setKpiSettings(p=>({...p, [item.key]:Number(e.target.value)/100}))}
                        className="flex-1" style={{accentColor:item.color}}/>
                      <span className="text-sm font-black w-10 text-right" style={{color:item.color}}>
                        {Math.round((kpiSettings[item.key] as number)*100)}%
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm text-slate-500">Total bobot sekarang:</span>
                  <span className={`text-sm font-black ${Math.round((kpiSettings.ticketOverdueWeight+kpiSettings.bastWeight+kpiSettings.lcWeight+kpiSettings.rndWeight)*100)===100?'text-emerald-600':'text-red-500'}`}>
                    {Math.round((kpiSettings.ticketOverdueWeight+kpiSettings.bastWeight+kpiSettings.lcWeight+kpiSettings.rndWeight)*100)}%
                    {Math.round((kpiSettings.ticketOverdueWeight+kpiSettings.bastWeight+kpiSettings.lcWeight+kpiSettings.rndWeight)*100)===100?' ✓':' ⚠ harus 100%'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-5 justify-end">
              <button onClick={()=>{
                  setKpiSettings(DEFAULT_KPI_SETTINGS);
                  saveKpiSettings(DEFAULT_KPI_SETTINGS);
                }}
                className="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">
                Reset Default
              </button>
              <button onClick={()=>{ saveKpiSettings(kpiSettings); setShowSettings(false); }}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-colors"
                style={{background:'linear-gradient(135deg,#7c3aed,#6d28d9)'}}>
                ✓ Simpan & Tutup
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
