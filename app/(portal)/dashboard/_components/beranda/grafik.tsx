'use client';

import React, { useMemo, useState } from 'react';
import { useAngkaNaik } from '@/components/shared/AngkaNaik';
import type { TitikGrafik } from './periode';

export const fmtId = (n: number, desimal = 1) => n.toLocaleString('id-ID', { maximumFractionDigits: desimal });

export function Angka({ nilai, desimal = 0 }: { nilai: number; desimal?: number }) {
  return <>{fmtId(useAngkaNaik(nilai), desimal)}</>;
}

export function IkonPanah() {
  return (
    <svg aria-hidden="true" focusable="false" className="bb-panah w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M9 7h8v8" />
    </svg>
  );
}

export function Bilah({ persen, warna, tik, label }: { persen: number; warna: string; tik?: boolean; label: string }) {
  const lebar = Math.max(0, Math.min(100, persen));
  return (
    <div className={`bb-bilah ${tik ? 'bb-bilah-tik' : ''}`} role="img" aria-label={`${label}: ${Math.round(lebar)}%`}>
      {lebar > 0 && <span style={{ width: `${lebar}%`, background: warna }} />}
    </div>
  );
}

export function RuasTim({ anggota, warna }: { anggota: { id: string; name: string; reported: boolean }[]; warna: string }) {
  const urut = [...anggota].sort((a, b) => Number(b.reported) - Number(a.reported));
  return (
    <div className="bb-ruas" role="img" aria-label={`${anggota.filter(a => a.reported).length} dari ${anggota.length} anggota sudah mengisi`}>
      {urut.map((a, i) => (
        <span key={a.id} title={`${a.name}: ${a.reported ? 'sudah isi' : 'belum isi'}`}
          style={{ background: a.reported ? warna : undefined, ['--i' as string]: i } as React.CSSProperties} />
      ))}
    </div>
  );
}

function skalaBulat(puncak: number) {
  if (puncak <= 4) return 4;
  const pangkat = 10 ** Math.floor(Math.log10(puncak));
  const langkah = [1, 2, 2.5, 5, 10].map(k => k * pangkat).find(k => k * 4 >= puncak) ?? pangkat * 10;
  return Math.max(4, Math.ceil(langkah) * 4);
}

export function GrafikKolom({ titik, warna, kataTotal, ringkasan }: {
  titik: TitikGrafik[]; warna: string; kataTotal: string; ringkasan: string;
}) {
  const [sorot, setSorot] = useState<number | null>(null);
  const n = titik.length;
  const atas = useMemo(() => skalaBulat(Math.max(1, ...titik.map(t => t.total))), [titik]);
  const garis = [atas, atas * 0.75, atas * 0.5, atas * 0.25, 0];
  const t = sorot !== null ? titik[sorot] : null;
  const rasio = sorot !== null ? (sorot + 0.5) / n : 0;
  const tengah = titik[Math.floor(n / 2)];
  const labelPendek = (k: string) => new Date(`${k}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

  return (
    <div className="bb-grafik" role="img" aria-label={ringkasan} onMouseLeave={() => setSorot(null)}>
      <div className="bb-grafik-sumbu-y" aria-hidden="true">
        {garis.map(g => <span key={g}>{Number.isInteger(g) ? g : ''}</span>)}
      </div>
      <div className="bb-grafik-area">
        <div className="bb-grafik-kanvas" key={`${n}-${titik[0]?.kunci}`}>
          <div className="bb-grafik-garis" aria-hidden="true">{garis.map(g => <i key={g} />)}</div>
          {titik.map((p, i) => (
            <div key={p.kunci} className={`bb-kolom ${i === sorot ? 'bb-kolom-aktif' : ''}`} onMouseEnter={() => setSorot(i)} onClick={() => setSorot(i)}>
              {p.total > 0 && (
                <span className="bb-batang" style={{ height: `${(p.total / atas) * 100}%`, ['--i' as string]: i } as React.CSSProperties}>
                  {p.total > p.tanda && <i className="bb-batang-sisa" style={{ flexGrow: p.total - p.tanda }} />}
                  {p.tanda > 0 && <i style={{ flexGrow: p.tanda, background: warna }} />}
                </span>
              )}
            </div>
          ))}
          {t && (
            <div className="bb-tip" style={{ left: `${rasio * 100}%`, transform: `translateX(${rasio < 0.22 ? '-10%' : rasio > 0.78 ? '-90%' : '-50%'})` }}>
              <b>{t.label}</b>
              <span>{t.total} {kataTotal} · {t.tanda} selesai</span>
            </div>
          )}
        </div>
        <div className="bb-grafik-sumbu-x" aria-hidden="true">
          <span>{titik[0] ? labelPendek(titik[0].kunci) : ''}</span>
          <span>{tengah ? labelPendek(tengah.kunci) : ''}</span>
          <b>Hari ini</b>
        </div>
      </div>
    </div>
  );
}
