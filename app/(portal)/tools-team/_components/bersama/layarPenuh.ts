'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export function useLayarPenuh() {
  const [penuh, setPenuh] = useState(false);
  const layarRef = useRef(false);
  useEffect(() => {
    const ubah = () => { if (!document.fullscreenElement && layarRef.current) { layarRef.current = false; setPenuh(false); } };
    document.addEventListener('fullscreenchange', ubah);
    return () => document.removeEventListener('fullscreenchange', ubah);
  }, []);
  const atur = useCallback((v: boolean) => {
    setPenuh(v);
    if (v) document.documentElement.requestFullscreen?.().then(() => { layarRef.current = true; }).catch(() => {});
    else if (document.fullscreenElement) { layarRef.current = false; void document.exitFullscreen().catch(() => {}); }
  }, []);
  useEffect(() => {
    if (!penuh) return;
    const tekan = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('[role="dialog"]')) atur(false); };
    window.addEventListener('keydown', tekan);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', tekan); document.body.style.overflow = ''; };
  }, [penuh, atur]);
  return [penuh, atur] as const;
}

export const KonteksLayarPenuh = createContext<{ penuh: boolean; atur: (v: boolean) => void } | null>(null);

export function useLayarPenuhAlat() {
  const k = useContext(KonteksLayarPenuh);
  const lokal = useLayarPenuh();
  return k ? ([k.penuh, k.atur] as const) : lokal;
}
