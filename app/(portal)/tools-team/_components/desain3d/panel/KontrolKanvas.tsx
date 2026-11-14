'use client';
import { DaftarKanvas } from './DaftarKanvas';
import type { AlatDesain } from './alat';

export function KontrolKanvas({ a }: { a: AlatDesain }) {
  return <DaftarKanvas a={a} />;
}
