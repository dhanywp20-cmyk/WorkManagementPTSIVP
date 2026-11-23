'use client';

import React from 'react';
import type { KPIData } from '@/lib/kpi-dasbor';
import { MiniPieChart } from '@/components/shared';
import { PIE_COLORS } from '@/lib/jadwal/tampilan';

type Masukan = { label: string; value: number; color?: string };

const warnai = (data: Masukan[]) => data
  .filter(d => d.value > 0)
  .sort((a, b) => b.value - a.value)
  .map((d, i) => ({ label: d.label || '—', value: d.value, color: d.color || PIE_COLORS[i % PIE_COLORS.length] }));

export function PieSumberTiket({ kpi }: { kpi: KPIData | null }) {
  const t = kpi?.tickets;
  const grup: { judul: string; ikon: string; data: Masukan[] }[] = [
    { judul: 'Produk', ikon: '📦', data: t?.byProduct.map(p => ({ label: p.product, value: p.count })) ?? [] },
    { judul: 'Divisi', ikon: '🏢', data: t?.byDivision.map(d => ({ label: d.div, value: d.count })) ?? [] },
    { judul: 'Handler', ikon: '👥', data: t?.byHandler.map(h => ({ label: h.name, value: h.count })) ?? [] },
    { judul: 'Status', ikon: '🏷️', data: t?.byStatus.map(s => ({ label: s.status, value: s.count, color: s.color })) ?? [] },
  ];
  return (
    <div className="bb-pie-wadah mt-auto">
      <div className="bb-pie-kisi">
        {grup.map(g => <MiniPieChart key={g.judul} data={warnai(g.data)} title={g.judul} icon={g.ikon} />)}
      </div>
    </div>
  );
}
