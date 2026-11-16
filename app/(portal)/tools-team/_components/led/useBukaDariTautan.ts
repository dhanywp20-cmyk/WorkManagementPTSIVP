'use client';
import { useEffect, useRef } from 'react';
import type { Berkas } from '../bersama/berkas/useBerkas';

let sudahDibuka = false;

export function useBukaDariTautan(b: Berkas) {
  const bRef = useRef(b);
  useEffect(() => { bRef.current = b; });
  useEffect(() => {
    if (sudahDibuka) return;
    const url = new URL(window.location.href);
    const id = url.searchParams.get('led');
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return;
    sudahDibuka = true;
    url.searchParams.delete('led');
    window.history.replaceState(window.history.state, '', url.toString());
    void bRef.current.buka(id);
  }, []);
}
