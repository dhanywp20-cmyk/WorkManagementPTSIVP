'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';

type Tip = { teks: string; x: number; y: number } | null;

export function useTipSamping() {
  const [tip, setTip] = useState<Tip>(null);

  const tampil = (el: HTMLElement, teks: string) => {
    const r = el.getBoundingClientRect();
    setTip({ teks, x: r.right + 12, y: r.top + r.height / 2 });
  };
  const sembunyi = () => setTip(null);

  const pasang = (teks: string) => ({
    onPointerEnter: (e: React.PointerEvent<HTMLElement>) => tampil(e.currentTarget, teks),
    onPointerLeave: sembunyi,
    onFocus: (e: React.FocusEvent<HTMLElement>) => tampil(e.currentTarget, teks),
    onBlur: sembunyi,
    onPointerDown: sembunyi,
  });

  const elemen = tip && typeof document !== 'undefined'
    ? createPortal(
      <span role="tooltip"
        className="pointer-events-none fixed z-[2000] -translate-y-1/2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg"
        style={{ left: tip.x, top: tip.y, background: '#26221f', animation: 'fadeIn 90ms ease-out both' }}>
        {tip.teks}
      </span>,
      document.body)
    : null;

  return { pasang, elemen };
}
