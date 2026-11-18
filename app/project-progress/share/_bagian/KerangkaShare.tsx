'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Eye } from 'lucide-react';
import { FooterPlatform, LogoMerek } from '@/components/shared';
import { NETRAL } from '@/lib/desain';
import { TEMA } from '@/app/(portal)/project-progress/_components/tampilan';

export function KerangkaShare({ latar, label, judul, sub, aksi, children }: {
  latar: CSSProperties;
  label: string;
  judul: string;
  sub?: string;
  aksi?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col overflow-hidden" style={{ ...latar, height: '100dvh' }}>
      <header className="shrink-0 z-40"
        style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderBottom: `1px solid ${NETRAL.garis}` }}>
        <div className="max-w-6xl mx-auto px-3 sm:px-4 h-14 flex items-center gap-3">
          <LogoMerek ukuran="sm" className="flex" />
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] leading-none" style={{ color: TEMA.samar }}>{label}</p>
            <h1 className="text-[15px] font-semibold leading-tight truncate mt-1" style={{ color: NETRAL.tinta }}>{judul}</h1>
            {sub && <p className="text-[11px] leading-tight truncate hidden sm:block" style={{ color: TEMA.samar }}>{sub}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {aksi}
            <span className="h-8 px-2.5 rounded-lg text-[11.5px] font-semibold inline-flex items-center gap-1.5"
              style={{ background: NETRAL.permukaanRedam, color: NETRAL.tinta2, border: `1px solid ${NETRAL.garis}` }}>
              <Eye size={13} /> <span className="hidden sm:inline">View Only</span>
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-5 space-y-4">{children}</div>
      </main>

      <FooterPlatform />
    </div>
  );
}

export function KepalaLaporan({ eyebrow, judul, keterangan, meta }: { eyebrow: string; judul: string; keterangan?: string; meta: string[] }) {
  return (
    <section className="rounded-xl px-4 sm:px-6 py-4 sm:py-5" style={{ background: 'rgba(255,255,255,0.94)', border: `1px solid ${NETRAL.garis}` }}>
      <p className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: TEMA.warna }}>{eyebrow}</p>
      <h2 className="text-[20px] sm:text-[24px] font-semibold tracking-tight leading-tight mt-1" style={{ color: NETRAL.tinta }}>{judul}</h2>
      {keterangan && <p className="text-[13.5px] mt-1.5 max-w-3xl whitespace-pre-wrap" style={{ color: NETRAL.tinta2 }}>{keterangan}</p>}
      {meta.length > 0 && (
        <p className="text-[12px] mt-2.5 flex flex-wrap gap-x-3 gap-y-1" style={{ color: TEMA.samar }}>
          {meta.map(m => <span key={m}>{m}</span>)}
        </p>
      )}
    </section>
  );
}
