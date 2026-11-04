'use client';

import { useEffect } from 'react';
import { tumpukan, FOCUSABLE_SELECTOR } from './Modal';

const PILIH_DIALOG = '[role="dialog"], [role="alertdialog"]';

function terlihat(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
}

function lapisanDari(el: HTMLElement): number {
  for (let e: HTMLElement | null = el; e; e = e.parentElement) {
    const z = parseInt(getComputedStyle(e).zIndex, 10);
    if (!Number.isNaN(z)) return z;
  }
  return 0;
}

export function dialogTeratas(): HTMLElement | null {
  let pilih: HTMLElement | null = null, zPilih = -Infinity;
  document.querySelectorAll<HTMLElement>(PILIH_DIALOG).forEach(el => {
    if (!terlihat(el)) return;
    const z = lapisanDari(el);
    if (z >= zPilih) { pilih = el; zPilih = z; }
  });
  return pilih;
}

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

    const periksa = () => {
      const kini = new Set(Array.from(document.querySelectorAll<HTMLElement>(PILIH_DIALOG)).filter(terlihat));
      kini.forEach(d => {
        if (terbuka.has(d)) return;
        asal.set(d, document.activeElement);
        if (tumpukan.length === 0 && !d.contains(document.activeElement)) {
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
    pengamat.observe(document.body, { childList: true, subtree: true });

    const tekan = (e: KeyboardEvent) => {
      if (tumpukan.length > 0 || e.defaultPrevented) return;
      if (e.key !== 'Escape' && e.key !== 'Tab') return;
      const d = dialogTeratas();
      if (!d) return;
      if (e.key === 'Escape') {
        const sasaran = e.target as HTMLElement | null;
        if (sasaran?.closest?.('[aria-expanded="true"], select')) return;
        const t = tombolTutup(d);
        if (!t) return;
        e.preventDefault();
        t.click();
        return;
      }
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
