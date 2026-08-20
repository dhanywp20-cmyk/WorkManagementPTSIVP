'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * ModalPortal - mencabut overlay ke <body>.
 *
 * Dua hal di leluhur bisa membuat popup gagal tampil, dan keduanya tidak
 * terlihat dari kode popup itu sendiri:
 *
 * 1. Leluhur ber-`position` + `z-index` membentuk stacking context, sehingga
 *    z-index di dalamnya hanya dibandingkan sesama isi kotak itu. Modal
 *    berangka besar bisa kalah dari modal berangka kecil yang di-portal.
 * 2. `position: fixed` diukur terhadap viewport hanya bila tidak ada leluhur
 *    ber-`transform`, `filter`, `backdrop-filter`, `perspective`, atau
 *    `contain`. Satu kartu ber-backdropFilter cukup membuat `inset-0`
 *    berhenti di tepi kartu, bukan tepi layar.
 *
 * Di bawah <body> tidak ada leluhur yang bisa memerangkapnya. Pakai skala di
 * lib/z-index.ts. Event React tetap menggelembung mengikuti pohon React, jadi
 * onClick/onChange di dalam overlay bekerja seperti biasa.
 */
export function ModalPortal({ children }: { children: React.ReactNode }) {
  // Portal baru dipasang setelah mount: saat render di server document belum
  // ada, dan render pertama di klien harus sama dengan hasil server supaya
  // tidak memicu hydration mismatch.
  const [siap, setSiap] = useState(false);
  useEffect(() => setSiap(true), []);
  if (!siap || typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
