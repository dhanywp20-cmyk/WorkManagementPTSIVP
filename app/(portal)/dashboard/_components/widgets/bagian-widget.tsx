'use client';



export function CincinProgres({ pct, sudah, total }: { pct: number; sudah: number; total: number }) {
  const r = 34, k = 2 * Math.PI * r;
  const warna = pct >= 80 ? '#16a34a' : pct >= 50 ? '#d97706' : '#ea580c';
  return (
    <div className="relative w-[88px] h-[88px] shrink-0" role="img" aria-label={`${sudah} dari ${total} sudah isi daily report (${pct}%)`}>
      <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90" aria-hidden="true">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
        {pct > 0 && <circle cx="40" cy="40" r={r} fill="none" stroke={warna} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${(Math.max(0, Math.min(100, pct)) / 100) * k} ${k}`} className="transition-[stroke-dasharray] duration-700" />}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-xl font-extrabold text-slate-900 tabular-nums">{pct}%</span>
        <span className="text-[11px] font-semibold text-slate-500 mt-1 tabular-nums">{sudah}/{total}</span>
      </div>
    </div>
  );
}

export function StatPills({ items }: { items: { label: string; value: number; color: string }[] }) {
  return (
    <div className="grid grid-cols-3 gap-3 mb-3">
      {items.map((s, i) => (
        <div key={i} className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span aria-hidden="true" className="w-2 h-2 rounded-[3px] shrink-0" style={{ background: s.color }} />
            <span className="text-[10px] font-black uppercase tracking-[0.07em] text-slate-500 truncate">{s.label}</span>
          </div>
          <div className="text-[26px] font-black leading-none mt-1 tabular-nums text-slate-900" style={{ letterSpacing: '-0.03em' }}>{s.value}</div>
        </div>
      ))}
    </div>
  );
}

export function MiniRow({ title, sub, tone }: { title: string; sub: string; tone?: string }) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-slate-100 last:border-0">
      <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: tone ?? '#94a3b8' }} />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-slate-700 truncate">{title}</div>
        <div className="text-[11px] text-slate-500 truncate">{sub}</div>
      </div>
    </div>
  );
}
