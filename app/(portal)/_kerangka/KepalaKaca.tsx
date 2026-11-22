'use client';
import React, { useEffect, useState } from 'react';
import { LogoMerek } from '@/components/shared';

export function KepalaKaca({ judul, alat, inisial, namaUser, onProfil }: {
  judul: string;
  alat: React.ReactNode;
  inisial: string;
  namaUser: string;
  onProfil: () => void;
}) {
  const [kini, setKini] = useState<Date | null>(null);
  useEffect(() => {
    const segarkan = () => setKini(new Date());
    segarkan();
    const t = window.setInterval(segarkan, 30_000);
    return () => window.clearInterval(t);
  }, []);

  const tanggal = kini?.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }) ?? '';
  const jam = kini?.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) ?? '';

  return (
    <header className="pk-kepala">
      <LogoMerek ukuran="sm" className="flex md:hidden" />
      <div className="pk-kepala-judul">
        <h1>{judul}</h1>
        <p suppressHydrationWarning>{tanggal}{jam && <> · <span className="tabular-nums">{jam}</span></>}</p>
      </div>
      <div className="pk-alat">
        {alat}
        <button type="button" className="pk-avatar pk-avatar-kepala" onClick={onProfil} aria-label={`Profil ${namaUser}`} title={namaUser}>
          {inisial}
        </button>
      </div>
    </header>
  );
}
