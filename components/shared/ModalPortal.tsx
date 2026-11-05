'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export function ModalPortal({ children }: { children: React.ReactNode }) {
  const [siap, setSiap] = useState(false);
  useEffect(() => setSiap(true), []);
  if (!siap || typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
