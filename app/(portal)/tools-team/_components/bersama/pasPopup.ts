'use client';
import { type RefObject, useLayoutEffect } from 'react';

const TEPI = 8;

export function usePasPopup(ref: RefObject<HTMLElement | null>, buka: boolean) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!buka || !el) return;
    const atur = () => {
      const s = el.style;
      s.transform = ''; s.top = ''; s.bottom = ''; s.marginTop = ''; s.marginBottom = '';
      const b = el.getBoundingClientRect();
      const lebar = window.innerWidth;
      let geser = 0;
      if (b.left < TEPI || b.width > lebar - TEPI * 2) geser = TEPI - b.left;
      else if (b.right > lebar - TEPI) geser = lebar - TEPI - b.right;
      if (geser) s.transform = `translateX(${Math.round(geser)}px)`;
      const induk = el.offsetParent?.getBoundingClientRect();
      if (induk && b.bottom > window.innerHeight - TEPI && induk.top > b.height + TEPI && induk.top > window.innerHeight - induk.bottom) {
        s.top = 'auto'; s.bottom = '100%'; s.marginTop = '0'; s.marginBottom = '6px';
      }
    };
    atur();
    window.addEventListener('resize', atur);
    return () => window.removeEventListener('resize', atur);
  }, [ref, buka]);
}
