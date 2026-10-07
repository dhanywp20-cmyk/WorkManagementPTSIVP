'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Sama bila tiap kunci identik (Object.is) - cukup untuk state React yang diperbarui secara immutable. */
function samaDangkal<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const ka = Object.keys(a as object), kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  return ka.every(k => Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/**
 * Undo / redo untuk alat Tools Team.
 *
 * `nilai` = potret state yang ingin bisa dibatalkan (mis. { ruang, benda }),
 * `terapkan` = cara mengembalikan potret itu ke state. Perubahan beruntun
 * (mengetik angka, menyeret benda tiap frame) digabung jadi satu langkah lewat
 * jeda singkat, jadi satu kali Undo membatalkan satu tindakan, bukan satu
 * piksel seretan. Pintasan: Ctrl/⌘+Z, Ctrl+Y, Ctrl/⌘+Shift+Z - tidak aktif
 * saat kursor di kolom isian (supaya undo teks bawaan peramban tetap jalan).
 */
export function useRiwayat<T>(nilai: T, terapkan: (v: T) => void, opsi: { jeda?: number; maks?: number } = {}) {
  const jeda = opsi.jeda ?? 450, maks = opsi.maks ?? 100;
  const lalu = useRef<T[]>([]);
  const nanti = useRef<T[]>([]);
  const tercatat = useRef<T>(nilai);
  const nilaiRef = useRef<T>(nilai); nilaiRef.current = nilai;
  const lewati = useRef(false);
  const terapkanRef = useRef(terapkan); terapkanRef.current = terapkan;
  const [, segarkan] = useState(0);

  const catat = useCallback(() => {
    const v = nilaiRef.current;
    if (samaDangkal(v, tercatat.current)) return;
    lalu.current.push(tercatat.current);
    if (lalu.current.length > maks) lalu.current.shift();
    nanti.current = [];
    tercatat.current = v;
    segarkan(x => x + 1);
  }, [maks]);

  useEffect(() => {
    if (lewati.current) { lewati.current = false; tercatat.current = nilai; return; }
    const t = setTimeout(catat, jeda);
    return () => clearTimeout(t);
  }, [nilai, jeda, catat]);

  const pasang = (v: T) => {
    tercatat.current = v;
    if (!samaDangkal(v, nilaiRef.current)) { lewati.current = true; terapkanRef.current(v); }
    segarkan(x => x + 1);
  };

  const undo = useCallback(() => {
    catat();   // perubahan yang masih dalam jeda ikut jadi satu langkah
    const v = lalu.current.pop();
    if (v === undefined) return;
    nanti.current.push(tercatat.current);
    pasang(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catat]);

  const redo = useCallback(() => {
    catat();
    const v = nanti.current.pop();
    if (v === undefined) return;
    lalu.current.push(tercatat.current);
    pasang(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catat]);

  /** Mulai riwayat baru (mis. setelah membuka file lain) - langkah lama tidak berlaku lagi. */
  const mulaiBaru = useCallback((v: T) => {
    lalu.current = []; nanti.current = []; tercatat.current = v; lewati.current = !samaDangkal(v, nilaiRef.current);
    segarkan(x => x + 1);
  }, []);

  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', tekan);
    return () => window.removeEventListener('keydown', tekan);
  }, [undo, redo]);

  return { undo, redo, bisaUndo: lalu.current.length > 0 || !samaDangkal(nilai, tercatat.current), bisaRedo: nanti.current.length > 0, mulaiBaru };
}
