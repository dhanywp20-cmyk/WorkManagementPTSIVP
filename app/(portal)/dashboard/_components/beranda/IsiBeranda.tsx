'use client';

import React, { useMemo, useState } from 'react';
import { useDaftarTim } from '../widgets/daftar-tim';
import { AKSEN_UTAMA, BAYANG_UBIN, LABEL_UBIN, UBIN } from '../widgets/primitives';
import type { KPIData, Scope } from '@/lib/kpi-dasbor';
import type { User } from '../shared';
import { RincianBento } from './RincianBento';
import { Angka, Bilah, GrafikKolom, IkonPanah, fmtId } from './grafik';
import { KartuJadwalTim } from './KartuJadwalTim';
import { DAFTAR_PERIODE, hitungJadwal, hitungTiket, rentangPeriode, tanggalLokal, type KunciPeriode } from './periode';
import { susunBaris, tampil, type KunciWidget } from '@/lib/dasbor-widget';
import { useDasborWidget } from './useDasborWidget';

const MERAH = '#dc2626';
const KARTU = `${UBIN} bb-naik`;

export interface OpsiBeranda {
  user: User;
  openMenu: (key: string) => void;
  panelSamping?: React.ReactNode;
  rincianAtas?: React.ReactNode;
}

const urutan = (d: number, kol?: number) => ({ boxShadow: BAYANG_UBIN, ['--d' as string]: d, ...(kol ? { ['--kol' as string]: kol } : {}) }) as React.CSSProperties;

function KepalaKartu({ judul, sisi, onBuka }: { judul: string; sisi?: React.ReactNode; onBuka?: () => void }) {
  return (
    <header className="flex items-center gap-2 min-h-[22px] mb-2">
      <h3 className={`${LABEL_UBIN} flex-1 truncate`}>{judul}</h3>
      {sisi}
      {onBuka && (
        <button type="button" onClick={onBuka} aria-label={`Buka ${judul}`} title={`Buka ${judul}`}
          className="w-6 h-6 -mr-1 rounded-md grid place-items-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors">
          <IkonPanah />
        </button>
      )}
    </header>
  );
}

function KartuAngka({ d, kol, judul, nilai, satuan, kanan, warnaNilai, onBuka, children }: {
  d: number; kol?: number; judul: string; nilai: number; satuan?: string; kanan?: React.ReactNode; warnaNilai?: string; onBuka: () => void; children: React.ReactNode;
}) {
  return (
    <article className={`${KARTU} bb-sel-angka`} style={urutan(d, kol)}>
      <KepalaKartu judul={judul} onBuka={onBuka} />
      <div className="flex items-baseline gap-1.5 min-w-0">
        <span className="text-[30px] font-black leading-none tabular-nums" style={{ letterSpacing: '-0.03em', color: warnaNilai ?? '#0f172a' }}><Angka nilai={nilai} /></span>
        {satuan && <span className="text-[12px] font-semibold text-slate-500 truncate">{satuan}</span>}
        {kanan && <span className="ml-auto text-[13px] font-bold text-slate-700 tabular-nums shrink-0">{kanan}</span>}
      </div>
      <div className="mt-3">{children}</div>
    </article>
  );
}

export function IsiBeranda({ kpi, loading, scope, opsi }: {
  kpi: KPIData | null; loading: boolean; scope: Scope; opsi: OpsiBeranda;
}) {
  const { user, openMenu, panelSamping, rincianAtas } = opsi;
  const [periode, setPeriode] = useState<KunciPeriode>('30');
  const [seri, setSeri] = useState<'tiket' | 'jadwal'>('tiket');
  const tim = useDaftarTim();
  const w = useDasborWidget();
  const ada = (k: KunciWidget) => tampil(w, k);
  const adaDailyReport = !!rincianAtas && ada('daily-report-tim');

  const hariIni = tanggalLokal(new Date());
  const { mulai, akhir } = useMemo(() => rentangPeriode(periode, kpi?.deret), [periode, kpi]);
  const tiket = useMemo(() => hitungTiket(kpi?.deret, mulai, akhir), [kpi, mulai, akhir]);
  const jadwal = useMemo(() => hitungJadwal(kpi?.deret, mulai, akhir, hariIni), [kpi, mulai, akhir, hariIni]);

  const totalTim = tim.rows.length;
  const sudahLapor = tim.rows.filter(r => r.reported).length;
  const belumLapor = totalTim - sudahLapor;
  const terlambat = tiket.terlambat + jadwal.terlambat;
  const aktif = tiket.belum + jadwal.berjalan + jadwal.terlambat;
  const fmtRentang = (s: string, tahun = false) => new Date(`${s}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', ...(tahun ? { year: 'numeric' } : {}) });
  const kataPeriode = DAFTAR_PERIODE.find(p => p.kunci === periode)?.label.toLowerCase() ?? '';

  const temuan = !kpi ? null : [
    !ada('terlambat') && terlambat > 0 ? `${terlambat} pekerjaan terlambat` : '',
    !adaDailyReport && !tim.loading && belumLapor > 0 ? `${belumLapor} anggota belum isi Daily Report` : '',
    kpi.reminders.dueSoon > 0 ? `${kpi.reminders.dueSoon} jadwal jatuh tempo 7 hari ke depan` : '',
  ].filter(Boolean).join(' · ') || 'Tidak ada hal mendesak di luar kartu di bawah';

  const dataSeri = seri === 'tiket' ? tiket : jadwal;
  const akhirPekan = [0, 6].includes(new Date().getDay());
  const piket = [{ tim: 'IVP', nama: kpi?.piket.todayIVP }, { tim: 'UMP', nama: kpi?.piket.todayUMP }, { tim: 'MVI', nama: kpi?.piket.todayMvi }];
  const piketLibur = akhirPekan && !loading && piket.every(p => !p.nama);
  const kol = susunBaris(([
    { kunci: 'tiket-selesai', lebar: 2 }, { kunci: 'jadwal-tim', lebar: 2 }, { kunci: 'terlambat', lebar: 2 },
    { kunci: 'alur-kerja', lebar: 4 }, { kunci: 'piket', lebar: 2 },
  ] as { kunci: KunciWidget; lebar: number }[]).filter(x => ada(x.kunci)), 6);
  const adaKiri = Object.keys(kol).length > 0;

  return (
    <div>
      <div className="bb-baris-judul bb-naik">
        {ada('ringkasan') ? (
          <p className="flex items-center gap-2 min-w-0 text-[13px] font-semibold text-slate-700">
            <span aria-hidden="true" className="w-2 h-2 rounded-full shrink-0" style={{ background: terlambat > 0 ? MERAH : '#16a34a' }} />
            {temuan ?? <span className="bb-kerangka w-64" aria-hidden="true" />}
          </p>
        ) : <span />}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <span className="text-[12px] font-medium text-slate-500 tabular-nums whitespace-nowrap">{fmtRentang(mulai)} – {fmtRentang(akhir, true)}</span>
          <div className="bb-segmen" role="group" aria-label="Periode ringkasan">
            {DAFTAR_PERIODE.map(p => (
              <button key={p.kunci} type="button" aria-pressed={p.kunci === periode} onClick={() => setPeriode(p.kunci)}>{p.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="bb-utama">
        {adaKiri && <div className="bb-kiri">
          {ada('tiket-selesai') && <KartuAngka d={0} kol={kol['tiket-selesai']} judul="Tiket selesai" nilai={tiket.selesai} satuan={`dari ${tiket.total} tiket`} kanan={`${fmtId(tiket.persen)}%`}
            onBuka={() => openMenu('ticket-troubleshooting')}>
            <Bilah persen={tiket.persen} warna={AKSEN_UTAMA} label="Tiket selesai" />
            <p className="bb-catatan">{tiket.belum} belum selesai</p>
          </KartuAngka>}

          {ada('jadwal-tim') && <KartuJadwalTim kpi={kpi} d={1} kol={kol['jadwal-tim']} onBuka={() => openMenu('reminder-schedule')} />}

          {ada('terlambat') && <KartuAngka d={2} kol={kol.terlambat} judul="Terlambat" nilai={terlambat} satuan={`dari ${aktif} aktif`} warnaNilai={terlambat > 0 ? MERAH : undefined}
            kanan={aktif ? `${fmtId((terlambat / aktif) * 100)}%` : '—'} onBuka={() => openMenu('reminder-schedule')}>
            <Bilah persen={aktif ? (terlambat / aktif) * 100 : 0} warna={MERAH} tik label="Pekerjaan terlambat" />
            <p className="bb-catatan">{tiket.terlambat} tiket · {jadwal.terlambat} jadwal</p>
          </KartuAngka>}

          {ada('alur-kerja') && <article className={`${KARTU} bb-sel-grafik`} style={urutan(3, kol['alur-kerja'])}>
            <KepalaKartu judul="Alur kerja" onBuka={() => openMenu(seri === 'tiket' ? 'ticket-troubleshooting' : 'reminder-schedule')}
              sisi={
                <div className="bb-segmen bb-segmen-kecil" role="tablist" aria-label="Data grafik">
                  <button type="button" role="tab" aria-selected={seri === 'tiket'} onClick={() => setSeri('tiket')}>Tiket</button>
                  <button type="button" role="tab" aria-selected={seri === 'jadwal'} onClick={() => setSeri('jadwal')}>Jadwal</button>
                </div>
              } />
            <div className="flex items-end justify-between gap-3 flex-wrap mb-4">
              <div className="flex items-baseline gap-2">
                <span className="text-[26px] font-black leading-none tabular-nums text-slate-900" style={{ letterSpacing: '-0.03em' }}><Angka nilai={Math.round(dataSeri.persen * 10) / 10} desimal={1} />%</span>
                <span className="text-[12px] font-semibold text-slate-500">selesai dari {dataSeri.total} {seri === 'tiket' ? 'tiket masuk' : 'jadwal'}</span>
              </div>
              <span className="flex items-center gap-3 text-[11px] font-medium text-slate-500">
                <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm" style={{ background: AKSEN_UTAMA }} />Selesai</span>
                <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-slate-300" />Belum</span>
              </span>
            </div>
            <GrafikKolom titik={dataSeri.titik} warna={AKSEN_UTAMA} kataTotal={seri === 'tiket' ? 'tiket masuk' : 'jadwal'}
              ringkasan={`${dataSeri.total} ${seri} dalam ${kataPeriode}, ${dataSeri.selesai} selesai`} />
          </article>}

          {ada('piket') && <article className={`${KARTU} bb-sel-piket`} style={urutan(4, kol.piket)}>
            <KepalaKartu judul="Piket Showroom" onBuka={() => openMenu('picket-showroom')} />
            <p className="text-[12px] font-semibold text-slate-500 -mt-1 mb-2.5">{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            {piketLibur ? <p className="flex-1 grid place-items-center text-[12.5px] text-slate-500 py-3">Akhir pekan — tidak ada piket.</p> : <div className="flex flex-col gap-1.5 flex-1">
              {piket.map(p => (
                <div key={p.tim} className="bb-piket-baris">
                  <span>{p.tim}</span>
                  {loading ? <i className="bb-kerangka w-20" aria-hidden="true" />
                    : p.nama ? <b title={p.nama}>{p.nama}</b> : <em>{akhirPekan ? 'Akhir pekan' : 'Belum diisi'}</em>}
                </div>
              ))}
            </div>}
            <p className="bb-catatan mt-3">{kpi?.piket.weekFilled ?? 0} dari {kpi?.piket.weekTotal ?? 0} hari terisi · {kpi?.piket.kegiatanToday ?? 0} tamu hari ini</p>
          </article>}
        </div>}

        {panelSamping && ada('agenda') && <aside className="bb-samping bb-naik" style={{ ['--d' as string]: 2 } as React.CSSProperties}>{panelSamping}</aside>}
      </div>

      <RincianBento kpi={kpi} user={user} openMenu={openMenu} kartuTim={adaDailyReport ? rincianAtas : undefined} scope={scope} widget={w} />
    </div>
  );
}
