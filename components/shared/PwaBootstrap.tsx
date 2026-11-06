'use client';
import { useEffect } from 'react';
import { daftarSW } from '@/lib/notifikasi/push-client';

export function PwaBootstrap() {
  useEffect(() => { void daftarSW(); }, []);
  return null;
}
