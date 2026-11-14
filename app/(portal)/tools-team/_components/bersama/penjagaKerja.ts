'use client';
import { useEffect, useRef } from 'react';

export function usePeringatanKeluar(aktif: boolean) {
  useEffect(() => {
    if (!aktif) return;
    const tahan = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', tahan);
    return () => window.removeEventListener('beforeunload', tahan);
  }, [aktif]);
}

export function bacaDraf<T>(kunci: string): T | null {
  try { const s = localStorage.getItem(kunci); return s ? (JSON.parse(s) as T) : null; } catch { return null; }
}

export function useDrafLokal<T>(kunci: string, nilai: T, pulihkan: (v: T) => void, jeda = 600) {
  const pulihkanRef = useRef(pulihkan);
  const siap = useRef(false);
  useEffect(() => { pulihkanRef.current = pulihkan; });
  useEffect(() => {
    const d = bacaDraf<T>(kunci);
    if (d) pulihkanRef.current(d);
    siap.current = true;
  }, [kunci]);
  useEffect(() => {
    if (!siap.current || nilai === undefined) return;
    const t = setTimeout(() => { try { localStorage.setItem(kunci, JSON.stringify(nilai)); } catch { return; } }, jeda);
    return () => clearTimeout(t);
  }, [kunci, nilai, jeda]);
}
