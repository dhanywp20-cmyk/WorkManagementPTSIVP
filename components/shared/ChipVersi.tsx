'use client';
import React from 'react';

const VERSI    = process.env.NEXT_PUBLIC_VERSI_APP || '';
const KOMIT    = process.env.NEXT_PUBLIC_KOMIT_APP || '';

export function ChipVersi({ gaya = 'gelap', className = 'inline-flex' }: {
  gaya?: 'gelap' | 'terang';
  className?: string;
}) {
  const bagian = [VERSI && `v${VERSI}`, KOMIT].filter(Boolean) as string[];
  if (bagian.length === 0) return null;

  const terang = gaya === 'terang';
  return (
    <span
      title={`Versi ${VERSI}${KOMIT ? ` · commit ${KOMIT}` : ''}`}
      className={`items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide ${className}`}
      style={terang
        ? { color: 'rgba(255,255,255,0.72)', background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.16)' }
        : { color: '#64748b', background: 'rgba(255,255,255,0.75)', border: '1px solid rgba(15,23,42,0.08)' }}>
      {bagian.map((b, i) => (
        <React.Fragment key={b}>
          {i > 0 && <span aria-hidden="true" style={{ opacity: 0.45 }}>·</span>}
          <span className={i === 1 && KOMIT ? 'font-mono' : ''}>{b}</span>
        </React.Fragment>
      ))}
    </span>
  );
}
