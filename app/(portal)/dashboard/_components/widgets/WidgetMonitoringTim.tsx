'use client';

import React from 'react';
import { type WidgetProps, WidgetCard, EmptyState, Loading } from './primitives';
import { useDaftarTim, type Anggota } from './daftar-tim';
import { IkonTeks } from '@/components/shared/Ikon';
import { CincinProgres } from './bagian-widget';

export const TeamMonitoringWidget: React.FC<WidgetProps> = ({ openMenu }) => {
  const { loading, rows, atasan } = useDaftarTim();

  if (loading) return <WidgetCard title="Daily Report Tim" icon="🧭" accent="#0891b2"><Loading /></WidgetCard>;

  const total = rows.length;
  const sudah = rows.filter(r => r.reported).length;
  const belum = total - sudah;
  const pct = total > 0 ? Math.round((sudah / total) * 100) : 0;
  const belumList = rows.filter(r => !r.reported);

  type KelompokBelum = {
    kunci: string; nama: string; jabatan: string; anggota: Anggota[]; ketuaBelumLapor: boolean;
  };
  const kelompok = (() => {
    const punyaBawahan = new Set(belumList.map(m => m.atasanId).filter(Boolean) as string[]);
    const peta = new Map<string, KelompokBelum>();

    const ambil = (kunci: string, nama: string, jabatan: string) => {
      if (!peta.has(kunci)) peta.set(kunci, { kunci, nama, jabatan, anggota: [], ketuaBelumLapor: false });
      return peta.get(kunci)!;
    };

    for (const m of belumList) {
      if (m.atasanId) {
        const bos = atasan[m.atasanId];
        ambil(m.atasanId, bos?.nama ?? '—', bos?.jabatan ?? '').anggota.push(m);
      } else if (punyaBawahan.has(m.id)) {
        ambil(m.id, m.name, m.jabatan).ketuaBelumLapor = true;
      } else {
        ambil('(lainnya)', 'Lainnya', '').anggota.push(m);
      }
    }

    const idJadiAnggota = new Set(
      Array.from(peta.values()).flatMap(g => g.anggota.map(m => m.id))
    );
    const urut = (list: KelompokBelum[]) => list.slice().sort((a, b) =>
      Number(a.kunci === '(lainnya)') - Number(b.kunci === '(lainnya)')
      || b.anggota.length - a.anggota.length
      || a.nama.localeCompare(b.nama));
    const akar = urut(Array.from(peta.values()).filter(g => !idJadiAnggota.has(g.kunci)));
    return { peta, akar };
  })();

  const renderKelompok = (g: KelompokBelum, depth: number): React.ReactNode => (
    <div key={g.kunci} className={depth > 0 ? 'mt-2' : ''}>
      <div className="flex items-baseline gap-1.5 mb-0.5 pl-0.5">
        {g.ketuaBelumLapor && (
          <span className="w-1.5 h-1.5 rounded-full shrink-0 self-center" style={{ background: '#f59e0b' }}
            title="Belum daily report" />
        )}
        <span className={`text-[11px] font-bold truncate max-w-[170px] ${g.ketuaBelumLapor ? 'text-amber-700' : 'text-slate-500'}`}>{g.nama}</span>
        {g.jabatan && (
          <span className="text-[11px] font-semibold text-slate-500 shrink-0">{g.jabatan}</span>
        )}
        {g.anggota.length > 0 && (
          <span className="text-[11px] font-bold text-slate-500 shrink-0">{g.anggota.length}</span>
        )}
      </div>
      <div className="border-l-2 border-slate-200 pl-1.5 ml-0.5">
        {g.anggota.filter(m => kelompok.peta.has(m.id)).map(m => renderKelompok(kelompok.peta.get(m.id)!, depth + 1))}
        <div className="flex flex-wrap">
          {g.anggota.filter(m => !kelompok.peta.has(m.id)).map(m => (
            <button key={m.id} onClick={() => openMenu('daily-report')}
              className="flex items-center gap-1.5 py-1 px-1.5 hover:bg-slate-50 rounded-md transition-colors text-left">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: m.active > 0 ? '#dc2626' : '#f59e0b' }} />
              <span className="text-[13px] font-semibold text-slate-700 truncate max-w-[170px]">{m.name}</span>
              {m.active > 0 && (
                <span className="text-[11px] font-bold px-1 py-px rounded-full shrink-0"
                  style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626' }}>{m.active}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <WidgetCard title="Daily Report Tim" icon="🧭" accent="#0891b2"
      onSeeAll={() => openMenu('daily-report')} seeAllLabel="Buka">
      {total === 0 ? (
        <EmptyState text="Belum ada anggota Team PTS terdaftar." />
      ) : (
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 h-full">
          <div className="flex items-center gap-3 lg:w-[210px] shrink-0 lg:self-start">
            <CincinProgres pct={pct} sudah={sudah} total={total} />
            <dl className="grid gap-1.5 text-[12px] flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2"><dt className="flex items-center gap-1.5 text-slate-600"><span className="w-2 h-2 rounded-full bg-green-600" />Sudah isi</dt><dd className="font-bold text-slate-900 tabular-nums">{sudah}</dd></div>
              <div className="flex items-center justify-between gap-2"><dt className="flex items-center gap-1.5 text-slate-600"><span className="w-2 h-2 rounded-full" style={{ background: '#ea580c' }} />Belum isi</dt><dd className="font-bold text-slate-900 tabular-nums">{belum}</dd></div>
              <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100"><dt className="text-slate-600">Total tim</dt><dd className="font-bold text-slate-900 tabular-nums">{total}</dd></div>
            </dl>
          </div>
          <div className="min-w-0 flex-1 min-h-0 flex flex-col">
            {belumList.length === 0 ? (
              <div className="text-xs font-semibold text-green-700 flex items-center h-full min-h-[60px]"><IkonTeks nama="🎉" />Semua tim sudah update Daily Report hari ini!</div>
            ) : (
              <>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Belum Daily Report ({belumList.length})</div>
                <div className="grid gap-y-2.5 max-h-[190px] overflow-y-auto overscroll-contain pr-1">
                  {kelompok.akar.map(g => renderKelompok(g, 0))}
                </div>
              </>
            )}
            {sudah > 0 && (
              <div className="mt-3 pt-2.5 border-t border-slate-100">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Sudah isi ({sudah})</div>
                <p className="text-[12px] font-medium text-slate-600 leading-relaxed">{rows.filter(r => r.reported).map(r => r.name).join(' · ')}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </WidgetCard>
  );
};
