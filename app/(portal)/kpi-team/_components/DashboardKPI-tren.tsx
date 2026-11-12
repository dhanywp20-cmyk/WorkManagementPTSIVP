'use client';
import { Ikon } from '@/components/shared/Ikon';
import { SEVERITY_STYLE } from './DashboardKPI-bantu';
import { AuditEntry } from './DashboardKPI-tipe';

export { TrenBulanan } from '@/components/shared/grafik-kpi';

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
