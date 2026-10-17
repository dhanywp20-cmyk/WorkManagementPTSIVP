'use client';
/** DashboardKPI-ubin.tsx - dipecah dari DashboardKPI.tsx (scripts/pecah-modul.mjs); DashboardKPI.tsx tetap mengekspor ulang semuanya. */
import { BAYANG_UBIN, RelAksen, UBIN } from '@/app/(portal)/dashboard/_components/widgets/primitives';
import { Ikon } from '@/components/shared/Ikon';
import React from 'react';

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
export const AKSEN  = '#4f46e5';

export const BAIK   = '#059669';

export const HATI   = '#d97706';

export const KRITIS = '#e11d48';

export function HBarChart({ data, color, maxItems=6, lebarLabel='7rem' }: { data:{label:string;value:number}[]; color?:string; maxItems?:number; lebarLabel?:string }) {
  const top = data.slice(0, maxItems), max = Math.max(...top.map(d=>d.value), 1);
  return (
    <div className="flex flex-col gap-[7px]">
      {top.map((d,i) => (
        <div key={i} className="flex items-center gap-2">
          <span title={d.label} className="text-[11px] font-semibold shrink-0 text-right" style={{ color:'rgba(0,0,0,0.55)', width:lebarLabel, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.label}</span>
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background:'rgba(15,23,42,0.07)' }}>
            {/*  Opacity TETAP. Versi lama memudarkan tiap batang menurut
                peringkatnya (0.85 - i*0.07), jadi warna ikut menyandikan
                urutan - padahal panjang batang sudah melakukannya, dan
                batang terbawah terbaca pudar seolah datanya kurang sahih. */}
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width:`${(d.value/max)*100}%`, background: color ?? AKSEN }}/>
          </div>
          <span className="text-[11px] font-bold w-5 text-right shrink-0 tabular-nums" style={{ color:'rgba(0,0,0,0.6)' }}>{d.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Satu baris rincian di kartu modul: label · bilah tipis · angka. */
export function BarisRincian({ label, value, total, warna, teks }: {
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
export function KartuModul({ ikon, judul, warna, catatan, angka, satuan, percik, kaki, kelas, children }: {
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
          <span className="text-[11px] font-bold text-slate-500 truncate">{satuan}</span>
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
export function Percik({ nilai, warna, lebar = 88, tinggi = 30 }: {
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
      viewBox={`0 0 ${lebar} ${tinggi}`} className="shrink-0">
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
export function Cincin({ nilai, dari, warna, ukuran = 84, teks }: {
  nilai: number; dari: number; warna: string; ukuran?: number; teks: React.ReactNode;
}) {
  const pct = dari > 0 ? Math.min(1, nilai / dari) : 0;
  const r = ukuran / 2 - 7, kel = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: ukuran, height: ukuran }}>
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
export function RelSeksi({ judul }: { judul: string }) {
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
      {/* Keping putih tipis tetap dipakai: latar beranda bisa berupa foto
          (setelan "Latar Dashboard" = Gambar), dan teks polos di atas foto
          tidak terbaca. Di latar netral keping ini nyaris tak terlihat. */}
      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600 shrink-0 px-2.5 py-1 rounded-full bg-white/85 backdrop-blur-xs">{judul}</span>
      <span aria-hidden="true" className="flex-1 h-px bg-slate-200"/>
    </div>
  );
}

/** Kepala ubin seragam: chip ikon berwarna modul + judul + catatan kecil. */
export function KepalaUbin({ ikon, judul, warna, catatan }: {
  ikon: string; judul: string; warna: string; catatan?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 flex-1 truncate">{judul}</h3>
      {catatan && <span className="text-[11px] font-semibold text-slate-500 shrink-0">{catatan}</span>}
    </div>
  );
}

/** Kaki ubin: satu keterangan kiri, satu angka kanan, dipisah garis putus. */
export function KakiUbin({ kiri, kanan, warna }: { kiri: React.ReactNode; kanan: React.ReactNode; warna?: string }) {
  return (
    <div className="flex justify-between items-center mt-2.5 pt-2.5" style={{ borderTop: '1px dashed rgba(15,23,42,0.10)' }}>
      <span className="text-[11px] font-bold text-slate-500">{kiri}</span>
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
export function PitaItem({ label, angka, satuan, ikon, warna, visual, children }: {
  label: string; angka: React.ReactNode; satuan?: string; ikon: string; warna: string;
  /** Visual kecil di kanan (percikan / cincin) - opsional. */
  visual?: React.ReactNode; children?: React.ReactNode;
}) {
  return (
    /*  Tiap angka kini ubin sendiri (dulu enam kolom bergaris dalam satu
        kartu - terbaca seperti tabel). Ikon berwarna lembut memberi
        identitas cepat; angka tetap tinta gelap supaya kontrasnya aman. */
    <div className={`${UBIN} p-4! flex-row! items-center! gap-3 text-left`} style={{ boxShadow: BAYANG_UBIN }}>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500 truncate">
          <span className="w-6 h-6 rounded-lg grid place-items-center shrink-0" style={{ background: `${warna}14`, color: warna }}>
            <Ikon nama={ikon} ukuran={13} />
          </span>
          <span className="truncate">{label}</span>
        </p>
        <p className="text-[26px] sm:text-[28px] font-extrabold leading-none mt-2.5 tabular-nums text-slate-900" style={{ letterSpacing: '-0.03em' }}>
          {angka}{satuan && <span className="text-[13px] font-semibold ml-1 text-slate-500">{satuan}</span>}
        </p>
        <div className="flex items-center gap-2 mt-2 min-h-[18px]">{children}</div>
      </div>
      {visual && <div className="shrink-0">{visual}</div>}
    </div>
  );
}

/** Cincin rasio kecil untuk ubin ringkasan. */
export function CincinMini({ pct, warna }: { pct: number; warna: string }) {
  const r = 20, k = 2 * Math.PI * r, p = Math.max(0, Math.min(100, pct));
  return (
    <svg viewBox="0 0 48 48" className="w-14 h-14 -rotate-90" aria-hidden="true">
      <circle cx="24" cy="24" r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" />
      {p > 0 && <circle cx="24" cy="24" r={r} fill="none" stroke={warna} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={`${(p / 100) * k} ${k}`} className="transition-[stroke-dasharray] duration-700" />}
    </svg>
  );
}

export function LabelPita({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-medium whitespace-nowrap text-slate-500">{children}</span>;
}
