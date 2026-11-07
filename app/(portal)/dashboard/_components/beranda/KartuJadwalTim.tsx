'use client';

import React from 'react';
import { AKSEN_UTAMA, BAYANG_UBIN, LABEL_UBIN, UBIN } from '../widgets/primitives';
import type { KPIData } from '@/lib/kpi-dasbor';
import { Angka, IkonPanah } from './grafik';

const BARIS_MAKS = 2;

const inisial = (n: string) => n.trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase()).join('');

function warnaOrang(n: string) {
  const h = [...n].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  return { background: `hsl(${h} 70% 92%)`, color: `hsl(${h} 55% 32%)` };
}

function BebanMini({ beban }: { beban: NonNullable<KPIData['bebanHari']> }) {
  const puncak = Math.max(1, ...beban.map(b => b.jumlah));
  return (
    <div className="bb-beban" role="img" aria-label={`Jadwal 5 hari ke depan: ${beban.map(b => `${b.label} ${b.jumlah}`).join(', ')}`}>
      {beban.map(b => (
        <span key={b.kunci} title={`${b.label}: ${b.jumlah} jadwal`}>
          <i style={{ height: `${Math.max(3, (b.jumlah / puncak) * 22)}px`, background: b.jumlah ? AKSEN_UTAMA : '#e2e8f0' }} />
          <small>{b.label.charAt(0)}</small>
        </span>
      ))}
    </div>
  );
}

export function KartuJadwalTim({ kpi, d, onBuka }: { kpi: KPIData | null; d: number; onBuka: () => void }) {
  const jadwal = kpi?.jadwalDekat;
  const judul = jadwal && !jadwal.hariIni ? 'Jadwal tim berikutnya' : 'Jadwal tim hari ini';
  const keterangan = !jadwal ? 'mendatang' : jadwal.hariIni ? `${jadwal.selesai} selesai` : jadwal.label;
  const tampil = jadwal?.daftar.slice(0, BARIS_MAKS) ?? [];
  const sisa = (jadwal?.total ?? 0) - tampil.length;
  return (
    <article className={`${UBIN} bb-naik bb-sel-angka`} style={{ boxShadow: BAYANG_UBIN, ['--d' as string]: d } as React.CSSProperties}>
      <header className="flex items-center gap-2 min-h-[22px] mb-2">
        <h3 className={`${LABEL_UBIN} flex-1 truncate`}>{judul}</h3>
        <button type="button" onClick={onBuka} aria-label={`Buka ${judul}`} title={`Buka ${judul}`}
          className="w-6 h-6 -mr-1 rounded-md grid place-items-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors">
          <IkonPanah />
        </button>
      </header>
      <div className="flex items-end gap-1.5 min-w-0">
        <span className="text-[30px] font-black leading-none tabular-nums text-slate-900" style={{ letterSpacing: '-0.03em' }}><Angka nilai={jadwal?.total ?? 0} /></span>
        <span className="flex-1 min-w-0 text-[11.5px] font-semibold leading-[14px] text-slate-500"><span className="block">jadwal</span><span className="block truncate" title={keterangan}>{keterangan}</span></span>
        {(kpi?.bebanHari?.length ?? 0) > 0 && <BebanMini beban={kpi?.bebanHari ?? []} />}
      </div>
      <ul className="mt-2 flex flex-col">
        {tampil.map(j => (
          <li key={j.id} className={`bb-jadwal ${j.selesai ? 'bb-jadwal-selesai' : ''}`}>
            <time>{j.jam || '—'}</time>
            <b className="min-w-0 flex-1" title={`${j.proyek} · ${j.kategori}`}>{j.proyek}</b>
            <span className="bb-orang" title={j.pic} style={warnaOrang(j.pic)} aria-label={j.pic}>{inisial(j.pic) || '?'}</span>
          </li>
        ))}
        {!jadwal && <li className="bb-catatan">Belum ada jadwal terdekat</li>}
        {sisa > 0 && (
          <li><button type="button" onClick={onBuka} className="text-[11.5px] font-semibold hover:underline mt-1" style={{ color: AKSEN_UTAMA }}>+{sisa} jadwal lainnya</button></li>
        )}
      </ul>
    </article>
  );
}
