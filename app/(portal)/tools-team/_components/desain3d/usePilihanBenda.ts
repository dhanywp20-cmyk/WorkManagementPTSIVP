'use client';
import { useEffect, useRef, useState } from 'react';

export function usePilihanBenda() {
  const [pilih, setPilih] = useState<string | null>(null);
  const [pilihLain, setPilihLain] = useState<string[]>([]);
  const [modeBanyak, setModeBanyak] = useState(false);
  const pilihRef = useRef(pilih), pilihLainRef = useRef(pilihLain), modeBanyakRef = useRef(modeBanyak);
  useEffect(() => { pilihRef.current = pilih; pilihLainRef.current = pilihLain; modeBanyakRef.current = modeBanyak; }, [pilih, pilihLain, modeBanyak]);
  const dariToggle = useRef(false);
  const setPilihan = (utama: string | null, lain: string[]) => {
    if (utama !== pilihRef.current) dariToggle.current = true;
    setPilih(utama); setPilihLain(lain);
  };
  useEffect(() => {
    if (dariToggle.current) { dariToggle.current = false; return; }
    setPilihLain(l => (l.length ? [] : l));
  }, [pilih]);
  return { pilih, setPilih, pilihLain, setPilihLain, modeBanyak, setModeBanyak, pilihRef, pilihLainRef, modeBanyakRef, dariToggle, setPilihan };
}
