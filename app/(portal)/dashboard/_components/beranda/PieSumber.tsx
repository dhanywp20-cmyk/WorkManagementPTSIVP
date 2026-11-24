'use client';

import React from 'react';
import type { KPIData } from '@/lib/kpi-dasbor';
import { MiniPieChart } from '@/components/shared';
import { PIE_COLORS } from '@/lib/jadwal/tampilan';

type Masukan = { label: string; value: number; color?: string };

export const HALAMAN_SUMBER = ['Produk & Divisi', 'Handler & Status'] as const;

const warnai = (data: Masukan[]) => data
  .filter(d => d.value > 0)
  .sort((a, b) => b.value - a.value)
  .map((d, i) => ({ label: d.label || '—', value: d.value, color: d.color || PIE_COLORS[i % PIE_COLORS.length] }));

export function SwitchSumber({ halaman, onPilih }: { halaman: number; onPilih: (h: number) => void }) {
  return (
    <div className="bb-segmen bb-segmen-kecil" role="tablist" aria-label="Kelompok grafik tiket">
      {HALAMAN_SUMBER.map((nama, h) => (
        <button key={nama} type="button" role="tab" aria-selected={h === halaman} onClick={() => onPilih(h)}>{nama}</button>
      ))}
    </div>
  );
}

export function PieSumberTiket({ kpi, halaman }: { kpi: KPIData | null; halaman: number }) {
  const t = kpi?.tickets;
  const grup: { judul: string; ikon: string; data: Masukan[] }[] = [
    { judul: 'Produk', ikon: '📦', data: t?.byProduct.map(p => ({ label: p.product, value: p.count })) ?? [] },
    { judul: 'Divisi', ikon: '🏢', data: t?.byDivision.map(d => ({ label: d.div, value: d.count })) ?? [] },
    { judul: 'Handler', ikon: '👥', data: t?.byHandler.map(h => ({ label: h.name, value: h.count })) ?? [] },
    { judul: 'Status', ikon: '🏷️', data: t?.byStatus.map(s => ({ label: s.status, value: s.count, color: s.color })) ?? [] },
  ];
  return (
    <div className="bb-pie-wadah mt-auto">
      <div key={halaman} role="tabpanel" aria-label={HALAMAN_SUMBER[halaman]} className="bb-pie-kisi bb-geser">
        {grup.slice(halaman * 2, halaman * 2 + 2).map(g => (
          <div key={g.judul} className="bb-pie-sel">
            <MiniPieChart data={warnai(g.data)} title={g.judul} icon={g.ikon} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PiePembelajaran({ kpi, techNote }: { kpi: KPIData | null; techNote: { disetujui: number; menunggu: number } | null }) {
  const lc = kpi?.learning;
  const lulus = lc?.completedSessions ?? 0;
  const belum = Math.max(0, (lc?.totalSessions ?? 0) - lulus);
  const persen = lulus + belum ? Math.round((lulus / (lulus + belum)) * 100) : 0;
  return (
    <div className="bb-pie-wadah mt-auto">
      <div className="bb-pie-kisi">
        <div className="bb-pie-sel">
          <MiniPieChart title="Quiz" icon="🎯" centerValue={`${persen}%`} centerLabel="lulus" data={[
            { label: 'Lulus', value: lulus, color: '#10b981' },
            { label: 'Belum lulus', value: belum, color: '#e11d48' },
          ]} />
        </div>
        {techNote && (
          <div className="bb-pie-sel">
            <MiniPieChart title={`Tech Note ${new Date().getFullYear()}`} icon="📋" data={[
              { label: 'Disetujui', value: techNote.disetujui, color: '#7c3aed' },
              { label: 'Menunggu', value: techNote.menunggu, color: '#f59e0b' },
            ]} />
          </div>
        )}
      </div>
    </div>
  );
}
