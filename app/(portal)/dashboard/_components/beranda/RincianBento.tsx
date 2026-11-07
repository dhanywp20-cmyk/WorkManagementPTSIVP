'use client';

import React, { useState } from 'react';
import { AKSEN_UTAMA, BAYANG_UBIN, LABEL_UBIN, UBIN } from '../widgets/primitives';
import type { User } from '../shared';
import type { KPIData, Scope } from '@/lib/kpi-dasbor';
import { HBarChart, TrenBulanan } from '@/components/shared/grafik-kpi';
import { Angka, Bilah, IkonPanah, fmtId } from './grafik';
import { useSorotanModul } from './useSorotanModul';

const MERAH = '#dc2626';
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function Kartu({ judul, kelas, onBuka, sisi, kalimat, children }: {
  judul: string; kelas: string; onBuka?: () => void; sisi?: React.ReactNode; kalimat?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <article className={`${UBIN} ${kelas}`} style={{ boxShadow: BAYANG_UBIN }}>
      <header className="flex items-center gap-2 min-h-[22px] mb-1.5">
        <h3 className={`${LABEL_UBIN} flex-1 truncate`}>{judul}</h3>
        {sisi}
        {onBuka && (
          <button type="button" onClick={onBuka} aria-label={`Buka ${judul}`} title={`Buka ${judul}`}
            className="w-6 h-6 -mr-1 rounded-md grid place-items-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors">
            <IkonPanah />
          </button>
        )}
      </header>
      {kalimat && <p className="text-[13.5px] font-semibold text-slate-800 leading-snug mb-2.5">{kalimat}</p>}
      {children}
    </article>
  );
}

function Kosong({ teks }: { teks: string }) {
  return <p className="flex-1 grid place-items-center text-[12px] text-slate-500 text-center py-5">{teks}</p>;
}

const inisial = (n: string) => n.trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase()).join('');

function warnaOrang(n: string) {
  const h = [...n].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  return { background: `hsl(${h} 70% 92%)`, color: `hsl(${h} 55% 32%)` };
}

type TabAsal = 'produk' | 'divisi' | 'handler' | 'status';

function KartuAsalTiket({ kpi, kelas, onBuka }: { kpi: KPIData | null; kelas: string; onBuka: () => void }) {
  const [tab, setTab] = useState<TabAsal>('produk');
  const t = kpi?.tickets;
  const data = !t ? [] : tab === 'produk' ? t.byProduct.map(p => ({ label: p.product, value: p.count }))
    : tab === 'divisi' ? t.byDivision.map(d => ({ label: d.div, value: d.count }))
      : tab === 'handler' ? t.byHandler.map(h => ({ label: h.name, value: h.count }))
        : t.byStatus.map(s => ({ label: s.status, value: s.count }));
  const atas = data[0];
  const kalimat = !atas ? 'Belum ada data tiket.'
    : tab === 'produk' ? <><b className="font-extrabold">{atas.label}</b> paling sering bermasalah: {atas.value} tiket.</>
      : tab === 'divisi' ? <>Divisi <b className="font-extrabold">{atas.label}</b> paling banyak melapor: {atas.value} tiket.</>
        : tab === 'handler' ? <><b className="font-extrabold">{atas.label}</b> memegang tiket terbuka terbanyak: {atas.value}.</>
          : <>Status terbanyak <b className="font-extrabold">{atas.label}</b>: {atas.value} tiket.</>;
  const label: Record<TabAsal, string> = { produk: 'Produk', divisi: 'Divisi', handler: 'Handler', status: 'Status' };
  return (
    <Kartu judul="Sumber tiket" kelas={kelas} onBuka={onBuka} kalimat={kalimat}
      sisi={
        <div className="bb-segmen bb-segmen-kecil" role="tablist" aria-label="Kelompok tiket">
          {(Object.keys(label) as TabAsal[]).map(k => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{label[k]}</button>
          ))}
        </div>
      }>
      <div key={tab} className="bb-geser flex flex-col flex-1">
        {data.length ? <HBarChart data={data} color={AKSEN_UTAMA} lebarLabel="8.5rem" maxItems={5} /> : <Kosong teks="Tidak ada data." />}
      </div>
    </Kartu>
  );
}

export function RincianBento({ kpi, user, openMenu, kartuTim, scope }: {
  kpi: KPIData | null; user: User; openMenu: (key: string) => void; kartuTim?: React.ReactNode; scope: Scope;
}) {
  const s = useSorotanModul(user);
  const jadwal = kpi?.jadwalDekat;
  const hariIniStr = !!jadwal?.hariIni;
  const tua = kpi?.tiketTua ?? [];
  const menunggu = s.antrean.reduce((n, a) => n + a.jumlah, 0) + (kpi?.tickets.waitingApproval ?? 0);

  const bulan = new Date().getMonth();
  const deret = kpi?.tickets.monthlyTickets ?? [];
  const ini = deret[bulan] ?? 0, lalu = bulan > 0 ? (deret[bulan - 1] ?? 0) : null;
  const beda = lalu === null ? null : ini - lalu;
  const puncak = deret.slice(0, bulan + 1).reduce((p, v, i) => (v > deret[p] ? i : p), 0);

  const lc = kpi?.learning;
  const adaBelajar = scope.kind === 'admin';
  const persenLulus = lc?.totalSessions ? (lc.completedSessions / lc.totalSessions) * 100 : 0;

  const adaUnit = !!s.unit, adaReview = !!s.review;
  const adaAntrean = s.antrean.length > 0;
  const adaTim = !!kartuTim;

  return (
    <div className="bb-bento bb-naik" style={{ ['--d' as string]: 6 } as React.CSSProperties}>
      <Kartu judul={hariIniStr ? 'Jadwal tim hari ini' : 'Jadwal tim berikutnya'} kelas="bb-b7" onBuka={() => openMenu('reminder-schedule')}
        kalimat={!jadwal ? undefined : jadwal.hariIni
          ? <>{jadwal.total} jadwal hari ini, {jadwal.selesai} sudah selesai.</>
          : <>Tidak ada jadwal hari ini. Berikutnya {jadwal.label}: {jadwal.total} jadwal.</>}>
        {!jadwal ? <Kosong teks="Belum ada jadwal mendatang." /> : (
          <ul className="flex flex-col flex-1 min-h-0">
            {jadwal.daftar.map(j => (
              <li key={j.id} className={`bb-jadwal ${j.selesai ? 'bb-jadwal-selesai' : ''}`}>
                <time>{j.jam || '—'}</time>
                <span className="min-w-0 flex-1">
                  <b title={j.proyek}>{j.proyek}</b>
                  <small>{j.kategori}{j.selesai && ' · selesai'}</small>
                </span>
                <span className="bb-orang" title={j.pic} style={warnaOrang(j.pic)} aria-label={j.pic}>{inisial(j.pic) || '?'}</span>
              </li>
            ))}
            {jadwal.total > jadwal.daftar.length && (
              <li className="pt-2 mt-auto"><button type="button" className="text-[12px] font-semibold hover:underline" style={{ color: AKSEN_UTAMA }} onClick={() => openMenu('reminder-schedule')}>+{jadwal.total - jadwal.daftar.length} jadwal lainnya</button></li>
            )}
          </ul>
        )}
        {(kpi?.bebanHari?.length ?? 0) > 0 && (
          <div className="bb-lima" role="img" aria-label={`Jadwal 5 hari ke depan: ${kpi?.bebanHari?.map(b => `${b.label} ${b.jumlah}`).join(', ')}`}>
            {kpi?.bebanHari?.map(b => (
              <div key={b.kunci}>
                <b className={b.jumlah ? '' : 'text-slate-400'}>{b.jumlah}</b>
                <i style={{ height: `${Math.max(4, (b.jumlah / Math.max(1, ...(kpi?.bebanHari ?? []).map(x => x.jumlah))) * 28)}px`, background: b.jumlah ? AKSEN_UTAMA : '#e2e8f0' }} />
                <span>{b.label}</span>
              </div>
            ))}
          </div>
        )}
      </Kartu>

      <KartuAsalTiket kpi={kpi} kelas="bb-b5" onBuka={() => openMenu('ticket-troubleshooting')} />

      {kartuTim && <div className={`bb-tim ${adaAntrean || adaUnit ? 'bb-b5' : 'bb-b12'} min-w-0`}>{kartuTim}</div>}

      {adaAntrean && (
        <Kartu judul="Menunggu keputusan" kelas={adaTim ? (adaUnit ? 'bb-b4' : 'bb-b7') : (adaUnit ? 'bb-b7' : 'bb-b12')}
          kalimat={menunggu ? <><span className="tabular-nums"><Angka nilai={menunggu} /></span> hal menunggu keputusan.</> : 'Semua sudah diputuskan.'}>
          <div className="flex flex-col">
            {[{ kunci: 'tiket', label: 'Tiket Waiting Approval', jumlah: kpi?.tickets.waitingApproval ?? 0, menu: 'ticket-troubleshooting' }, ...s.antrean]
              .sort((a, b) => b.jumlah - a.jumlah).map(a => (
                <button key={a.kunci} type="button" disabled={!a.menu} onClick={() => a.menu && openMenu(a.menu)} className="bb-antre">
                  <span className="truncate">{a.label}</span>
                  <b className={a.jumlah ? 'bb-antre-ada' : ''}>{a.jumlah}</b>
                </button>
              ))}
          </div>
        </Kartu>
      )}

      {adaUnit && s.unit && (
        <Kartu judul="Unit di luar" kelas={adaTim ? (adaAntrean ? 'bb-b3' : 'bb-b7') : (adaAntrean ? 'bb-b5' : 'bb-b12')} onBuka={() => openMenu('unit-movement')}
          kalimat={s.unit.total === 0 ? 'Semua unit pinjaman sudah kembali.'
            : s.unit.lewat > 0 ? <><span style={{ color: MERAH }}>{s.unit.lewat} unit</span> lewat tanggal kembali.</>
              : <>{s.unit.total} unit dipinjam, semua masih dalam tenggat.</>}>
          <div className="flex flex-col">
            {s.unit.daftar.map(u => (
              <div key={u.id} className="bb-unit">
                <b title={u.barang}>{u.barang}</b>
                <small title={`${u.proyek} · ${u.pic}`}>{u.pic} · {u.hariLewat > 0 ? <em>lewat {u.hariLewat} hari</em> : `kembali ${u.kembali}`}</small>
              </div>
            ))}
          </div>
          <p className="bb-catatan mt-auto pt-2">Bulan ini: {kpi?.units.keluarThisMonth ?? 0} keluar · {kpi?.units.masukThisMonth ?? 0} masuk</p>
        </Kartu>
      )}

      <Kartu judul="Tiket terlama" kelas={adaReview && adaBelajar ? 'bb-b5' : adaReview || adaBelajar ? 'bb-b7' : 'bb-b12'} onBuka={() => openMenu('ticket-troubleshooting')}
        kalimat={tua.length ? <>Tiket tertua sudah terbuka <span style={{ color: tua[0].hari > 7 ? MERAH : undefined }}>{tua[0].hari} hari</span>.</> : 'Tidak ada tiket terbuka.'}>
        <div className="flex flex-col">
          {tua.map(t => (
            <button key={t.id} type="button" className="bb-antre bb-antre-dua" onClick={() => openMenu('ticket-troubleshooting')}>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate font-semibold text-slate-800">{t.proyek}</span>
                <small className="block truncate text-[11px] text-slate-500">{t.handler} · {t.status}</small>
              </span>
              <b className={t.hari > 7 ? 'text-red-600' : ''}>{t.hari} hari</b>
            </button>
          ))}
        </div>
      </Kartu>

      {adaReview && s.review && (
        <Kartu judul="Nilai dari Sales" kelas={adaBelajar ? 'bb-b3' : 'bb-b5'} onBuka={() => openMenu('form-bast')}>
          {s.review.jumlah === 0 ? <Kosong teks="Belum ada review." /> : (
            <>
              <div className="flex items-baseline gap-1.5 mb-2">
                <span className="text-[30px] font-black leading-none tabular-nums text-slate-900" style={{ letterSpacing: '-0.03em' }}>{fmtId(s.review.rata)}</span>
                <span className="text-[12px] font-semibold text-slate-500">dari 5</span>
              </div>
              <Bilah persen={(s.review.rata / 5) * 100} warna="#d97706" label="Rata-rata nilai review" />
              <p className="bb-catatan">{s.review.jumlah} review Demo & BAST terbaru</p>
              <p className="bb-catatan mt-auto" title={s.review.terendahNama}>Terendah: {s.review.terendahNama} ({fmtId(s.review.terendahNilai)})</p>
            </>
          )}
        </Kartu>
      )}

      {adaBelajar && (
        <Kartu judul="Pembelajaran tim" kelas={adaReview ? 'bb-b4' : 'bb-b5'} onBuka={() => openMenu('learning-center')}>
          <div className="flex items-baseline gap-1.5 mb-2">
            <span className="text-[30px] font-black leading-none tabular-nums text-slate-900" style={{ letterSpacing: '-0.03em' }}>{fmtId(persenLulus, 0)}%</span>
            <span className="text-[12px] font-semibold text-slate-500">lulus quiz</span>
          </div>
          <Bilah persen={persenLulus} warna="#059669" label="Tingkat lulus quiz" />
          <p className="bb-catatan">{lc?.totalParticipants ?? 0} peserta · skor rata-rata {lc?.avgScore ?? 0}</p>
          {s.techNote && <p className="bb-catatan mt-auto">Tech Note {new Date().getFullYear()}: {s.techNote.disetujui} disetujui · {s.techNote.menunggu} menunggu</p>}
        </Kartu>
      )}

      <Kartu judul={`Tren tiket ${new Date().getFullYear()}`} kelas="bb-b7"
        kalimat={<>{BULAN[bulan]} {ini} tiket{beda !== null && beda !== 0 && <>, {beda > 0 ? 'naik' : 'turun'} {Math.abs(beda)} dari {BULAN[bulan - 1]}</>}. Tersibuk: {BULAN[puncak]} ({deret[puncak] ?? 0}).</>}>
        <div className="mt-auto"><TrenBulanan data={deret.length ? deret : Array(12).fill(0)} viewW={640} viewH={150} warna={AKSEN_UTAMA} /></div>
      </Kartu>

      <Kartu judul="Project Progress" kelas="bb-b5" onBuka={() => openMenu('project-progress')}
        sisi={<span className="text-[11px] font-semibold text-slate-500">Target terdekat</span>}>
        {s.loading ? <span className="bb-kerangka w-full h-12" aria-hidden="true" />
          : s.proyek.length === 0 ? <Kosong teks="Belum ada proyek berjalan." />
            : s.proyek.map(p => (
              <button key={p.id} type="button" className="bb-proyek" onClick={() => openMenu('project-progress')}>
                <span className="bb-proyek-nama" title={p.nama}>{p.nama}</span>
                <span className="bb-proyek-angka">{p.persen}%</span>
                <span className="bb-proyek-bilah"><Bilah persen={p.persen} warna={AKSEN_UTAMA} label={p.nama} /></span>
                <span className="bb-proyek-info">Target {p.target}{p.kendala > 0 && <em> · {p.kendala} kendala</em>}</span>
              </button>
            ))}
      </Kartu>
    </div>
  );
}
