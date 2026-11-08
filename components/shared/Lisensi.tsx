'use client';
import { useEffect, useState } from 'react';
import { HARI_PERINGATAN, LABEL_ALASAN, type StatusLisensi } from '@/lib/lisensi/inti';

export type StatusLisensiKlien = Omit<StatusLisensi, 'id' | 'domain'>;

let muat: Promise<StatusLisensiKlien | null> | null = null;

export function muatLisensi(ulang = false): Promise<StatusLisensiKlien | null> {
  if (!muat || ulang) {
    muat = fetch('/api/lisensi/status', { cache: 'no-store' })
      .then(r => (r.ok ? (r.json() as Promise<StatusLisensiKlien>) : null))
      .catch(() => { muat = null; return null; });
  }
  return muat;
}

export function useLisensi(): StatusLisensiKlien | null {
  const [s, setS] = useState<StatusLisensiKlien | null>(null);
  useEffect(() => {
    let hidup = true;
    muatLisensi().then(v => { if (hidup) setS(v); });
    return () => { hidup = false; };
  }, []);
  return s;
}

export function BannerLisensi({ s, admin }: { s: StatusLisensiKlien | null; admin: boolean }) {
  if (!s || s.pengembangan) return null;
  if (!s.sah) {
    return (
      <div role="alert" className="mx-3 sm:mx-5 mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-800">
        <b>Lisensi platform tidak aktif.</b> {s.alasan ? LABEL_ALASAN[s.alasan] : ''}.{' '}
        {admin ? 'Buka Admin Panel → Lisensi untuk memasang atau memperpanjang kunci.' : 'Hubungi admin platform Anda.'}
      </div>
    );
  }
  if (admin && s.sisaHari !== null && s.sisaHari <= HARI_PERINGATAN) {
    return (
      <div role="status" className="mx-3 sm:mx-5 mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-900">
        Lisensi {s.edisi === 'pro' ? 'Pro' : 'Lite'} berakhir dalam <b>{s.sisaHari} hari</b> ({s.kedaluwarsa}). Hubungi penyedia platform untuk perpanjangan.
      </div>
    );
  }
  return null;
}
