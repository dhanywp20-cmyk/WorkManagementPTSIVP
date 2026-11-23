'use client';

import React from 'react';
import { type WidgetProps, WidgetCard, EmptyState, Loading } from './primitives';
import { useDaftarTim, type Anggota } from './daftar-tim';
import { IkonTeks } from '@/components/shared/Ikon';
import { CincinProgres } from './bagian-widget';
import { JadwalMingguTim, BarisOtomatis, WARNA_STATUS } from './ringkasan-tim';

export const TeamMonitoringWidget: React.FC<WidgetProps> = ({ openMenu }) => {
  const { loading, rows, atasan, minggu, tanggal } = useDaftarTim();
  const judul = `Daily Report Tim · ${new Date(`${tanggal}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}`;

  if (loading) return <WidgetCard title={judul} icon="🧭" accent="#0891b2"><Loading /></WidgetCard>;

  const total = rows.length;
  const manualList = rows.filter(r => r.status === 'manual');
  const otomatisList = rows.filter(r => r.status === 'otomatis');
  const belumList = rows.filter(r => r.status === 'kosong');
  const sudah = manualList.length + otomatisList.length;
  const pct = total > 0 ? Math.round((sudah / total) * 100) : 0;
  const legenda = [
    { label: 'Isi manual', nilai: manualList.length, warna: WARNA_STATUS.manual },
    { label: 'Otomatis', nilai: otomatisList.length, warna: WARNA_STATUS.otomatis },
    { label: 'Kosong', nilai: belumList.length, warna: WARNA_STATUS.kosong },
  ];

  type KelompokBelum = {
    kunci: string; nama: string; jabatan: string; anggota: Anggota[]; ketuaBelumLapor: boolean;
  };
  const kelompok = (() => {
    const punyaBawahan = new Set(rows.map(m => m.atasanId).filter(Boolean) as string[]);
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
        ambil('(lainnya)', 'Tanpa atasan', '').anggota.push(m);
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
            title="Kosong: belum isi & tanpa aktivitas" />
        )}
        <span className={`text-[11px] font-bold wrap-break-word min-w-0 ${g.ketuaBelumLapor ? 'text-amber-700' : 'text-slate-500'}`}>{g.nama}</span>
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
              <span className="text-[13px] font-semibold text-slate-700 leading-snug wrap-break-word">{m.name}</span>
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
    <WidgetCard title={judul} icon="🧭" accent="#0891b2"
      onSeeAll={() => openMenu('daily-report')} seeAllLabel="Buka">
      {total === 0 ? (
        <EmptyState text="Belum ada anggota Team PTS terdaftar." />
      ) : (
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 h-full">
          <div className="lg:w-[230px] shrink-0 lg:self-start">
            <div className="flex items-center gap-3">
              <CincinProgres pct={pct} sudah={sudah} total={total} />
              <dl className="grid gap-1.5 text-[12px] flex-1 min-w-0">
                {legenda.map(l => (
                  <div key={l.label} className="flex items-center justify-between gap-2">
                    <dt className="flex items-center gap-1.5 text-slate-600"><span className="w-2 h-2 rounded-full" style={{ background: l.warna }} />{l.label}</dt>
                    <dd className="font-bold text-slate-900 tabular-nums">{l.nilai}</dd>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100"><dt className="text-slate-600">Total tim</dt><dd className="font-bold text-slate-900 tabular-nums">{total}</dd></div>
              </dl>
            </div>
            <JadwalMingguTim rows={rows} mulai={minggu.mulai} akhir={minggu.akhir} onBuka={() => openMenu('reminder-schedule')} />
          </div>
          <div className="min-w-0 flex-1 min-h-0 flex flex-col">
            {otomatisList.length > 0 && (
              <div className="mb-3">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Aktivitas hari ini · otomatis ({otomatisList.length})</div>
                <div className="grid max-h-[150px] overflow-y-auto overscroll-contain pr-1">
                  {otomatisList.map(m => <BarisOtomatis key={m.id} m={m} onBuka={() => openMenu('daily-report')} />)}
                </div>
              </div>
            )}
            {belumList.length === 0 ? (
              <div className="text-xs font-semibold text-green-700 flex items-center min-h-[40px]"><IkonTeks nama="🎉" />Semua tim punya Daily Report atau aktivitas hari ini!</div>
            ) : (
              <>
                <div className="text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: WARNA_STATUS.kosong }}>Kosong · belum isi & tanpa aktivitas ({belumList.length})</div>
                <div className="grid gap-y-2.5 max-h-[190px] overflow-y-auto overscroll-contain pr-1">
                  {kelompok.akar.map(g => renderKelompok(g, 0))}
                </div>
              </>
            )}
            {manualList.length > 0 && (
              <div className="mt-3 pt-2.5 border-t border-slate-100">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Isi manual ({manualList.length})</div>
                <p className="text-[12px] font-medium text-slate-600 leading-relaxed">{manualList.map(r => r.name).join(' · ')}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </WidgetCard>
  );
};
