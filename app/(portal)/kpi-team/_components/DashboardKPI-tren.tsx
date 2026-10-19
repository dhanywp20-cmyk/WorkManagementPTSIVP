'use client';
/** DashboardKPI-tren.tsx - dipecah dari DashboardKPI.tsx (scripts/pecah-modul.mjs); DashboardKPI.tsx tetap mengekspor ulang semuanya. */
import { Ikon } from '@/components/shared/Ikon';
import { SEVERITY_STYLE } from './DashboardKPI-bantu';
import { AuditEntry, Scope } from './DashboardKPI-tipe';
import { AKSEN } from './DashboardKPI-ubin';

/**
 * Trend bulanan sebagai AREA, bukan 12 batang pucat.
 *
 * Batang membandingkan besaran antar kategori yang berdiri sendiri; yang
 * ditanyakan di sini adalah bentuk perjalanan sepanjang tahun, dan itu
 * dibaca dari kemiringan garis. Bulan yang belum terjadi tidak digambar
 * sebagai nol - digambar sebagai garis putus, karena "belum ada datanya"
 * bukan "nilainya nol".
 */
/**
 * viewW/viewH beda per pemanggil, BUKAN satu proporsi tetap diregangkan
 * paksa (preserveAspectRatio="none" sempat dicoba - lingkaran titik datanya
 * jadi lonjong karena X dan Y diregangkan beda rasio, cacat yang lebih
 * mengganggu daripada masalah aslinya). viewBox tetap discale UNIFORM
 * (bawaan SVG) supaya lingkaran tetap bulat - yang berubah cuma proporsi
 * intrinsiknya sendiri, dipilih sesuai lebar kartu pemanggilnya:
 * 640x168 untuk kartu Admin (lg:col-span-6, ~720-770px - proporsi asli,
 * sudah pas di sana), 1400x220 untuk kartu Team (lg:col-span-12 - lebih
 * lebar, jadi rasionya dibuat lebih landai supaya tinggi hasil akhirnya
 * tidak ikut membengkak walau lebarnya jauh lebih besar).
 */
export function TrenBulanan({ data, viewW = 640, viewH = 168 }: { data: number[]; viewW?: number; viewH?: number }) {
  const MN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
  const cur = Math.min(new Date().getMonth(), 11);
  const W = viewW, H = viewH, pb = 26, pt = 18, sisi = 10;
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
export function inisial(nama: string) {
  return nama.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';
}

export function AuditRow({ entry }: { entry: AuditEntry }) {
  const s = SEVERITY_STYLE[entry.severity];
  const fmt = new Date(entry.ts).toLocaleString('id-ID', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
  return (
    <div className="flex items-start gap-3 px-3 py-2.5 rounded-xl transition-all"
      style={{ background: s.bg, border:`1px solid ${s.border}` }}>
      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-sm"
        style={{ background:`${s.dot}18` }}><Ikon nama={entry.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /></div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-bold truncate" style={{ color:'rgba(0,0,0,0.75)' }}>{entry.action}</span>
          <span className="text-sm shrink-0" style={{ color:'rgba(0,0,0,0.35)' }}>{fmt}</span>
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
    pts_sup:   { label: scope.ptsTeamType ?? 'PTS Supervisor', color: '#0e7490', icon: '🏪' },
    team:      { label: 'Team Member',        color: '#7c3aed', icon: '👤' },
    none:      { label: '-',                  color: '#6b7280', icon: '—'  },
  }[scope.kind];
  return (
    <span className="flex items-center gap-1 text-sm font-bold px-2 py-1 rounded-full"
      style={{ background:`${cfg.color}18`, color:cfg.color, border:`1px solid ${cfg.color}30` }}>
      <Ikon nama={cfg.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /> {cfg.label}
    </span>
  );
}
