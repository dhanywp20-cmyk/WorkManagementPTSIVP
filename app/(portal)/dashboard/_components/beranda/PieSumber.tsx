'use client';

import React, { useState } from 'react';
import type { KPIData } from '@/lib/kpi-dasbor';
import { MiniPieChart } from '@/components/shared';
import { PIE_COLORS } from '@/lib/jadwal/tampilan';

type Masukan = { label: string; value: number; color?: string };

const PER_HALAMAN = 2;

const warnai = (data: Masukan[]) => data
  .filter(d => d.value > 0)
  .sort((a, b) => b.value - a.value)
  .map((d, i) => ({ label: d.label || '—', value: d.value, color: d.color || PIE_COLORS[i % PIE_COLORS.length] }));

function Panah({ arah, onKlik, label }: { arah: 'kiri' | 'kanan'; onKlik: () => void; label: string }) {
  return (
    <button type="button" onClick={onKlik} aria-label={label} title={label} className="bb-pie-panah">
      <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        <path d={arah === 'kiri' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
      </svg>
    </button>
  );
}

export function PieSumberTiket({ kpi }: { kpi: KPIData | null }) {
  const [halaman, setHalaman] = useState(0);
  const t = kpi?.tickets;
  const grup: { judul: string; ikon: string; data: Masukan[] }[] = [
    { judul: 'Produk', ikon: '📦', data: t?.byProduct.map(p => ({ label: p.product, value: p.count })) ?? [] },
    { judul: 'Divisi', ikon: '🏢', data: t?.byDivision.map(d => ({ label: d.div, value: d.count })) ?? [] },
    { judul: 'Handler', ikon: '👥', data: t?.byHandler.map(h => ({ label: h.name, value: h.count })) ?? [] },
    { judul: 'Status', ikon: '🏷️', data: t?.byStatus.map(s => ({ label: s.status, value: s.count, color: s.color })) ?? [] },
  ];
  const jumlah = Math.ceil(grup.length / PER_HALAMAN);
  const tampil = grup.slice(halaman * PER_HALAMAN, (halaman + 1) * PER_HALAMAN);
  const geser = (n: number) => setHalaman(h => (h + n + jumlah) % jumlah);
  const namaHalaman = (h: number) => grup.slice(h * PER_HALAMAN, (h + 1) * PER_HALAMAN).map(g => g.judul).join(' & ');

  return (
    <div className="bb-pie-wadah mt-auto" role="group" aria-roledescription="carousel" aria-label="Grafik sumber tiket">
      <div className="bb-pie-baris">
        <Panah arah="kiri" onKlik={() => geser(-1)} label={`Tampilkan ${namaHalaman((halaman - 1 + jumlah) % jumlah)}`} />
        <div key={halaman} className="bb-pie-kisi bb-geser" aria-live="polite">
          {tampil.map(g => (
            <div key={g.judul} className="bb-pie-sel">
              <MiniPieChart data={warnai(g.data)} title={g.judul} icon={g.ikon} />
            </div>
          ))}
        </div>
        <Panah arah="kanan" onKlik={() => geser(1)} label={`Tampilkan ${namaHalaman((halaman + 1) % jumlah)}`} />
      </div>
      <div className="bb-pie-titik">
        {Array.from({ length: jumlah }, (_, h) => (
          <button key={h} type="button" aria-label={`Halaman ${h + 1}: ${namaHalaman(h)}`} aria-current={h === halaman}
            onClick={() => setHalaman(h)}>{namaHalaman(h)}</button>
        ))}
      </div>
    </div>
  );
}
