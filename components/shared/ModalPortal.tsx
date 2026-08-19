'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * ModalPortal - mencabut overlay ke <body>.
 *
 * Kenapa ada
 * Ada DUA cara sebuah popup gagal tampil, dan keduanya tidak kelihatan dari
 * kode popup itu sendiri - penyebabnya selalu ada di leluhurnya:
 *
 * 1. TERPERANGKAP STACKING CONTEXT.
 *    Leluhur ber-`position` + `z-index` (mis. pembungkus halaman
 *    `relative z-10`) membentuk stacking context baru. Semua z-index di
 *    dalamnya jadi RELATIF terhadap kotak itu, bukan terhadap halaman. Jadi
 *    modal Z.overlayTop di dalam pembungkus z-10 tetap kalah dari modal
 *    Z.overlay yang berada langsung di bawah <body> - angkanya lebih besar,
 *    tapi dibandingkan di liga yang berbeda. Inilah kenapa popup Assign muncul
 *    di BELAKANG popup detail.
 *
 * 2. TERPERANGKAP CONTAINING BLOCK.
 *    `position: fixed` diukur terhadap viewport HANYA bila tidak ada leluhur
 *    ber-`transform`, `filter`, `backdrop-filter`, `perspective`, atau
 *    `contain`. Satu saja leluhur seperti itu - dan kartu ber-`backdropFilter`
 *    tersebar di banyak halaman - membuat `inset-0` berhenti di tepi kartu,
 *    bukan di tepi layar. Popup-nya "muncul", tapi terpotong di tengah layar.
 *
 * Dengan portal, overlay berada langsung di bawah <body>: tidak ada leluhur
 * yang bisa memerangkapnya, dan z-index-nya kembali dibandingkan di liga yang
 * sama dengan seluruh overlay lain. Pakai skala di lib/z-index.ts agar
 * urutannya bisa dibaca dari nama, bukan dari angka.
 *
 * Event React tetap menggelembung mengikuti pohon React (bukan pohon DOM),
 * jadi onClick/onChange di dalam overlay bekerja persis seperti sebelumnya.
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
