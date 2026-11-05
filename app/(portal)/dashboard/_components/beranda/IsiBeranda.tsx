'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { statDari } from '@/lib/checklist';
import { useDaftarTim } from '../widgets/daftar-tim';
import { AKSEN_UTAMA, BAYANG_UBIN, LABEL_UBIN, UBIN } from '../widgets/primitives';
import type { KPIData, Scope } from '@/app/(portal)/kpi-team/_components/DashboardKPI-tipe';
import { BarisTicketKPI } from '@/app/(portal)/kpi-team/_components/dasbor/BarisTicketKPI';
import { BarisRingkasanKPI } from '@/app/(portal)/kpi-team/_components/dasbor/BarisRingkasanKPI';
import { BarisTrenKPI } from '@/app/(portal)/kpi-team/_components/dasbor/BarisTrenKPI';
import { Angka, Bilah, GrafikKolom, IkonPanah, RuasTim, fmtId } from './grafik';
import { DAFTAR_PERIODE, hitungJadwal, hitungTiket, rentangPeriode, tanggalLokal, type KunciPeriode } from './periode';

const MERAH = '#dc2626';
const KARTU = `${UBIN} bb-naik`;

export interface OpsiBeranda {
  openMenu: (key: string) => void;
  panelSamping?: React.ReactNode;
  rincianAtas?: React.ReactNode;
}

const urutan = (d: number) => ({ boxShadow: BAYANG_UBIN, ['--d' as string]: d }) as React.CSSProperties;

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

function KartuAngka({ d, judul, nilai, satuan, kanan, warnaNilai, onBuka, children }: {
  d: number; judul: string; nilai: number; satuan?: string; kanan?: React.ReactNode; warnaNilai?: string; onBuka: () => void; children: React.ReactNode;
}) {
  return (
    <article className={`${KARTU} bb-sel-angka`} style={urutan(d)}>
      <KepalaKartu judul={judul} onBuka={onBuka} />
      <div className="flex items-baseline gap-1.5 min-w-0">
        <span className="text-[30px] font-black leading-none tabular-nums" style={{ letterSpacing: '-0.03em', color: warnaNilai ?? '#0f172a' }}><Angka nilai={nilai} /></span>
        {satuan && <span className="text-[12px] font-semibold text-slate-500 truncate">{satuan}</span>}
        {kanan && <span className="ml-auto text-[13px] font-bold text-slate-700 tabular-nums flex-shrink-0">{kanan}</span>}
      </div>
      <div className="mt-3">{children}</div>
    </article>
  );
}

interface BarisProyek { id: string; nama: string; target: string; kendala: number; persen: number }

function useProyekTerdekat(): { loading: boolean; daftar: BarisProyek[] } {
  const [hasil, setHasil] = useState<{ loading: boolean; daftar: BarisProyek[] }>({ loading: true, daftar: [] });
  useEffect(() => {
    let alive = true;
    (async () => {
      let daftar: BarisProyek[] = [];
      try {
        const { data: proyek, error } = await supabase.from('checklist_proyek')
          .select('id, nama, target_date, status').neq('status', 'done')
          .order('target_date', { ascending: true, nullsFirst: false }).limit(3);
        if (!error && proyek?.length) {
          const { data: dftr } = await supabase.from('checklist_daftar').select('id, proyek_id').in('proyek_id', proyek.map((p: { id: string }) => p.id));
          const idDaftar = (dftr ?? []).map((d: { id: string }) => d.id);
          const { data: items } = idDaftar.length
            ? await supabase.from('checklist_item').select('daftar_id, selesai, kendala').in('daftar_id', idDaftar).limit(5000)
            : { data: [] };
          const milik = new Map((dftr ?? []).map((d: { id: string; proyek_id: string }) => [d.id, d.proyek_id]));
          daftar = proyek.map((p: { id: string; nama: string; target_date: string | null }) => {
            const stat = statDari((items ?? []).filter((i: { daftar_id: string }) => milik.get(i.daftar_id) === p.id));
            return {
              id: p.id, nama: p.nama, kendala: stat.kendala,
              target: p.target_date ? new Date(`${p.target_date}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '—',
              persen: stat.total ? Math.round((stat.selesai / stat.total) * 100) : 0,
            };
          });
        }
      } catch {  }
      if (alive) setHasil({ loading: false, daftar });
    })();
    return () => { alive = false; };
  }, []);
  return hasil;
}

export function IsiBeranda({ kpi, loading, scope, opsi }: {
  kpi: KPIData | null; loading: boolean; scope: Scope; opsi: OpsiBeranda;
}) {
  const { openMenu, panelSamping, rincianAtas } = opsi;
  const [periode, setPeriode] = useState<KunciPeriode>('30');
  const [seri, setSeri] = useState<'tiket' | 'jadwal'>('tiket');
  const tim = useDaftarTim();
  const proyek = useProyekTerdekat();

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
    terlambat > 0 ? `${terlambat} pekerjaan terlambat` : 'Tidak ada pekerjaan terlambat',
    !tim.loading && totalTim > 0 ? (belumLapor > 0 ? `${belumLapor} anggota belum isi Daily Report` : 'semua anggota sudah isi Daily Report') : '',
    kpi.reminders.dueSoon > 0 ? `${kpi.reminders.dueSoon} jadwal jatuh tempo 7 hari ke depan` : '',
  ].filter(Boolean).join(' · ');

  const dataSeri = seri === 'tiket' ? tiket : jadwal;
  const piket = [{ tim: 'IVP', nama: kpi?.piket.todayIVP }, { tim: 'UMP', nama: kpi?.piket.todayUMP }, { tim: 'MVI', nama: kpi?.piket.todayMvi }];

  return (
    <div>
      <div className="bb-baris-judul bb-naik">
        <p className="flex items-center gap-2 min-w-0 text-[13px] font-semibold text-slate-700">
          <span aria-hidden="true" className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: terlambat > 0 ? MERAH : '#16a34a' }} />
          {temuan ?? <span className="bb-kerangka w-64" aria-hidden="true" />}
        </p>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          <span className="text-[12px] font-medium text-slate-500 tabular-nums whitespace-nowrap">{fmtRentang(mulai)} – {fmtRentang(akhir, true)}</span>
          <div className="bb-segmen" role="group" aria-label="Periode ringkasan">
            {DAFTAR_PERIODE.map(p => (
              <button key={p.kunci} type="button" aria-pressed={p.kunci === periode} onClick={() => setPeriode(p.kunci)}>{p.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="bb-utama">
        <div className="bb-kiri">
          <KartuAngka d={0} judul="Tiket selesai" nilai={tiket.selesai} satuan={`dari ${tiket.total} tiket`} kanan={`${fmtId(tiket.persen)}%`}
            onBuka={() => openMenu('ticket-troubleshooting')}>
            <Bilah persen={tiket.persen} warna={AKSEN_UTAMA} label="Tiket selesai" />
            <p className="bb-catatan">{tiket.belum} belum selesai</p>
          </KartuAngka>

          <KartuAngka d={1} judul="Daily Report" nilai={sudahLapor} satuan={`dari ${totalTim} anggota`}
            kanan={totalTim ? `${fmtId((sudahLapor / totalTim) * 100, 0)}%` : '—'} onBuka={() => openMenu('daily-report')}>
            <RuasTim anggota={tim.rows} warna={AKSEN_UTAMA} />
            <p className="bb-catatan">{belumLapor ? `${belumLapor} anggota belum isi hari ini` : 'Semua sudah isi hari ini'}</p>
          </KartuAngka>

          <KartuAngka d={2} judul="Terlambat" nilai={terlambat} satuan={`dari ${aktif} aktif`} warnaNilai={terlambat > 0 ? MERAH : undefined}
            kanan={aktif ? `${fmtId((terlambat / aktif) * 100)}%` : '—'} onBuka={() => openMenu('reminder-schedule')}>
            <Bilah persen={aktif ? (terlambat / aktif) * 100 : 0} warna={MERAH} tik label="Pekerjaan terlambat" />
            <p className="bb-catatan">{tiket.terlambat} tiket · {jadwal.terlambat} jadwal</p>
          </KartuAngka>

          <article className={`${KARTU} bb-sel-grafik`} style={urutan(3)}>
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
          </article>

          <article className={`${KARTU} bb-sel-piket`} style={urutan(4)}>
            <KepalaKartu judul="Piket Showroom" onBuka={() => openMenu('picket-showroom')} />
            <p className="text-[12px] font-semibold text-slate-500 -mt-1 mb-2.5">{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            <div className="flex flex-col gap-1.5 flex-1">
              {piket.map(p => (
                <div key={p.tim} className="bb-piket-baris">
                  <span>{p.tim}</span>
                  {loading ? <i className="bb-kerangka w-20" aria-hidden="true" />
                    : p.nama ? <b title={p.nama}>{p.nama}</b> : <em>Belum diisi</em>}
                </div>
              ))}
            </div>
            <p className="bb-catatan mt-3">{kpi?.piket.weekFilled ?? 0} dari {kpi?.piket.weekTotal ?? 0} hari terisi · {kpi?.piket.kegiatanToday ?? 0} tamu hari ini</p>
          </article>

          <article className={`${KARTU} bb-sel-proyek`} style={urutan(5)}>
            <KepalaKartu judul="Project Progress" onBuka={() => openMenu('project-progress')} sisi={<span className="text-[11px] font-semibold text-slate-500">Target terdekat</span>} />
            {proyek.loading ? <span className="bb-kerangka w-full h-12" aria-hidden="true" />
              : proyek.daftar.length === 0 ? <p className="text-[12px] text-slate-500 py-3">Belum ada proyek berjalan.</p>
                : proyek.daftar.map(p => (
                  <button key={p.id} type="button" className="bb-proyek" onClick={() => openMenu('project-progress')}>
                    <span className="bb-proyek-nama" title={p.nama}>{p.nama}</span>
                    <span className="bb-proyek-info">{p.target}{p.kendala > 0 && <em> · {p.kendala} kendala</em>}</span>
                    <span className="bb-proyek-bilah"><Bilah persen={p.persen} warna={AKSEN_UTAMA} label={p.nama} /></span>
                    <span className="bb-proyek-angka">{p.persen}%</span>
                  </button>
                ))}
          </article>
        </div>

        {panelSamping && <aside className="bb-samping bb-naik" style={{ ['--d' as string]: 2 } as React.CSSProperties}>{panelSamping}</aside>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-4 items-stretch mt-3 md:mt-4 bb-rincian">
        {rincianAtas && <div className="lg:col-span-12">{rincianAtas}</div>}
        <BarisTicketKPI kpi={kpi} loading={loading} scope={scope} tanpaPiket />
        <BarisRingkasanKPI kpi={kpi} loading={loading} />
        <BarisTrenKPI kpi={kpi} loading={loading} scope={scope} />
      </div>
    </div>
  );
}
