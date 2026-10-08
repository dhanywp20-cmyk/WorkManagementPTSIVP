'use client';

import { useEffect } from 'react';
import { tumpukan, FOCUSABLE_SELECTOR } from './Modal';

/**
 * PenjagaDialog - perilaku keyboard yang sama untuk SEMUA popup, termasuk ±100 overlay yang dirakit
 * manual (bukan komponen Modal). Dipasang sekali di app/layout.tsx.
 *
 * Komponen Modal sudah mengurus Esc, fokus, dan jebakan Tab sendiri, tapi sebagian besar popup lama
 * masih `<div role="dialog">` buatan tangan tanpa itu semua - Esc tidak menutup apa pun, Tab lari ke
 * halaman di belakang. Menulis ulang semuanya sekaligus berisiko (lihat catatan di Modal.tsx), jadi
 * perilakunya dipasang dari sini tanpa menyentuh markup tiap popup:
 *
 *  - Esc menutup dialog PALING ATAS dengan menekan tombol tutupnya sendiri (Tutup/Batal/✕) - jadi
 *    jalurnya sama persis dengan klik pengguna. Tidak ketemu tombolnya -> tidak melakukan apa-apa.
 *  - Saat dialog muncul, fokus masuk ke dalamnya; Tab berputar di dalamnya; saat ditutup fokus kembali
 *    ke elemen yang membukanya.
 *
 * Selama ada Modal/ConfirmDialog terbuka (`tumpukan` tidak kosong), penjaga ini diam - keduanya
 * menangani dirinya sendiri dan tidak boleh tertangani dua kali.
 */

const PILIH_DIALOG = '[role="dialog"], [role="alertdialog"]';

function terlihat(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
}

/** z-index efektif: dari elemen itu sendiri atau leluhur fixed terdekatnya. */
function lapisanDari(el: HTMLElement): number {
  for (let e: HTMLElement | null = el; e; e = e.parentElement) {
    const z = parseInt(getComputedStyle(e).zIndex, 10);
    if (!Number.isNaN(z)) return z;
  }
  return 0;
}

/** Dialog paling atas yang terlihat: z-index tertinggi, seri -> yang terakhir di DOM. */
export function dialogTeratas(): HTMLElement | null {
  let pilih: HTMLElement | null = null, zPilih = -Infinity;
  document.querySelectorAll<HTMLElement>(PILIH_DIALOG).forEach(el => {
    if (!terlihat(el)) return;
    const z = lapisanDari(el);
    if (z >= zPilih) { pilih = el; zPilih = z; }
  });
  return pilih;
}

/** Tombol penutup milik dialog: label Tutup/Close, lalu teks Batal/Tutup/Kembali/✕/×. */
export function tombolTutup(dialog: HTMLElement): HTMLElement | null {
  const tombol = Array.from(dialog.querySelectorAll<HTMLElement>('button, [role="button"]'))
    .filter(b => !(b as HTMLButtonElement).disabled && terlihat(b) && b.closest(PILIH_DIALOG) === dialog);
  const label = (b: HTMLElement) => (b.getAttribute('aria-label') ?? '').trim().toLowerCase();
  const teks = (b: HTMLElement) => (b.textContent ?? '').trim().toLowerCase();
  return tombol.find(b => /^(tutup|close)\b/.test(label(b)))
    ?? tombol.find(b => ['✕', '×', 'x', '✖'].includes(teks(b)) || /^(batal|tutup|kembali|cancel|close)$/.test(teks(b)))
    ?? tombol.find(b => /^(batal|cancel)\b/.test(label(b)))
    ?? null;
}

export function PenjagaDialog() {
  useEffect(() => {
    const asal = new WeakMap<HTMLElement, Element | null>();
    let terbuka = new Set<HTMLElement>();

    //  Pantau dialog yang muncul/hilang: fokus masuk saat muncul, kembali ke pembukanya saat hilang.
    const periksa = () => {
      const kini = new Set(Array.from(document.querySelectorAll<HTMLElement>(PILIH_DIALOG)).filter(terlihat));
      kini.forEach(d => {
        if (terbuka.has(d)) return;
        asal.set(d, document.activeElement);
        if (tumpukan.length === 0 && !d.contains(document.activeElement)) {
          //  Biarkan autoFocus milik isian di dalamnya menang bila ada.
          requestAnimationFrame(() => {
            if (d.contains(document.activeElement)) return;
            if (!d.hasAttribute('tabindex')) d.setAttribute('tabindex', '-1');
            d.focus({ preventScroll: true });
          });
        }
      });
      terbuka.forEach(d => {
        if (kini.has(d)) return;
        const kembali = asal.get(d);
        if (kembali instanceof HTMLElement && kembali.isConnected && (document.activeElement === document.body || !document.activeElement)) {
          kembali.focus({ preventScroll: true });
        }
      });
      terbuka = kini;
    };
    let jadwal = 0;
    const pengamat = new MutationObserver(() => { cancelAnimationFrame(jadwal); jadwal = requestAnimationFrame(periksa); });
    //  childList saja: popup muncul/hilang lewat render bersyarat. Mengamati atribut style akan memicu
    //  pemeriksaan tiap frame di kanvas 3D Tools Team (label CSS2D bergerak tiap frame).
    pengamat.observe(document.body, { childList: true, subtree: true });

    const tekan = (e: KeyboardEvent) => {
      if (tumpukan.length > 0 || e.defaultPrevented) return;
      if (e.key !== 'Escape' && e.key !== 'Tab') return;
      const d = dialogTeratas();
      if (!d) return;
      if (e.key === 'Escape') {
        //  Esc di dropdown/combobox yang sedang terbuka atau <select> milik elemen itu, bukan dialognya.
        const sasaran = e.target as HTMLElement | null;
        if (sasaran?.closest?.('[aria-expanded="true"], select')) return;
        const t = tombolTutup(d);
        if (!t) return;
        e.preventDefault();
        t.click();
        return;
      }
      //  Tab: putar di dalam dialog teratas.
      const isi = Array.from(d.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(el => el.offsetParent !== null);
      if (!isi.length) { e.preventDefault(); d.focus(); return; }
      const pertama = isi[0], terakhir = isi[isi.length - 1], aktif = document.activeElement;
      if (!d.contains(aktif)) { e.preventDefault(); (e.shiftKey ? terakhir : pertama).focus(); return; }
      if (e.shiftKey && (aktif === pertama || aktif === d)) { e.preventDefault(); terakhir.focus(); }
      else if (!e.shiftKey && aktif === terakhir) { e.preventDefault(); pertama.focus(); }
    };
    document.addEventListener('keydown', tekan);
    return () => { pengamat.disconnect(); cancelAnimationFrame(jadwal); document.removeEventListener('keydown', tekan); };
  }, []);
  return null;
}
