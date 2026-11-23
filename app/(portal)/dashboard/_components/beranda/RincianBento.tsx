'use client';

import React from 'react';
import { AKSEN_UTAMA, BAYANG_UBIN, LABEL_UBIN, UBIN } from '../widgets/primitives';
import type { User } from '../shared';
import type { KPIData, Scope } from '@/lib/kpi-dasbor';
import { TrenBulanan } from '@/components/shared/grafik-kpi';
import { PieSumberTiket } from './PieSumber';
import { susunBaris, tampil, type KunciWidget, type PengaturanDasbor } from '@/lib/dasbor-widget';
import { Angka, Bilah, IkonPanah, fmtId } from './grafik';
import { useSorotanModul } from './useSorotanModul';

const MERAH = '#dc2626';
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function Kartu({ judul, kol, onBuka, sisi, kalimat, kelas = '', children }: {
  judul: string; kol: number; kelas?: string; onBuka?: () => void; sisi?: React.ReactNode; kalimat?: React.ReactNode; children?: React.ReactNode;
}) {
  return (
    <article className={`${UBIN} bb-bv ${kelas}`} style={{ boxShadow: BAYANG_UBIN, ['--kol' as string]: kol } as React.CSSProperties}>
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

function KartuAsalTiket({ kpi, kol, onBuka }: { kpi: KPIData | null; kol: number; onBuka: () => void }) {
  const produk = kpi?.tickets.byProduct.slice().sort((x, y) => y.count - x.count)[0];
  const kalimat = !produk ? 'Belum ada data tiket.' : <><b className="font-extrabold">{produk.product}</b> paling sering bermasalah: {produk.count} tiket.</>;
  return (
    <Kartu judul="Sumber tiket" kol={kol} onBuka={onBuka} kalimat={kalimat} kelas="bb-sumber">
      <PieSumberTiket kpi={kpi} />
    </Kartu>
  );
}

export function RincianBento({ kpi, user, openMenu, scope, widget }: {
  kpi: KPIData | null; user: User; openMenu: (key: string) => void; scope: Scope; widget: PengaturanDasbor;
}) {
  const s = useSorotanModul(user);
  const tua = kpi?.tiketTua ?? [];
  const ada = (k: KunciWidget) => tampil(widget, k);
  const antrean = [{ kunci: 'tiket', label: 'Tiket Waiting Approval', jumlah: kpi?.tickets.waitingApproval ?? 0, menu: 'ticket-troubleshooting' }, ...s.antrean]
    .filter(a => a.jumlah > 0).sort((a, b) => b.jumlah - a.jumlah);
  const menunggu = antrean.reduce((n, a) => n + a.jumlah, 0);

  const bulan = new Date().getMonth();
  const deret = kpi?.tickets.monthlyTickets ?? [];
  const ini = deret[bulan] ?? 0, lalu = bulan > 0 ? (deret[bulan - 1] ?? 0) : null;
  const beda = lalu === null ? null : ini - lalu;
  const puncak = deret.slice(0, bulan + 1).reduce((p, v, i) => (v > deret[p] ? i : p), 0);

  const lc = kpi?.learning;
  const persenLulus = lc?.totalSessions ? (lc.completedSessions / lc.totalSessions) * 100 : 0;

  const tersedia: Record<string, boolean> = {
    'menunggu-keputusan': s.antrean.length > 0 && ada('menunggu-keputusan'),
    'unit-di-luar': !!s.unit && ada('unit-di-luar'),
    'sumber-tiket': ada('sumber-tiket'),
    'tren-tiket': ada('tren-tiket'),
    'tiket-terlama': ada('tiket-terlama'),
    'project-progress': ada('project-progress'),
    'nilai-sales': !!s.review && ada('nilai-sales'),
    'pembelajaran': scope.kind === 'admin' && ada('pembelajaran'),
  };
  const kol = susunBaris(([
    { kunci: 'menunggu-keputusan', lebar: 2 }, { kunci: 'sumber-tiket', lebar: 8 }, { kunci: 'unit-di-luar', lebar: 2 },
    { kunci: 'tren-tiket', lebar: 6 },
    { kunci: 'tiket-terlama', lebar: 3 }, { kunci: 'project-progress', lebar: 3 }, { kunci: 'nilai-sales', lebar: 3 }, { kunci: 'pembelajaran', lebar: 3 },
  ] as { kunci: KunciWidget; lebar: number }[]).filter(x => tersedia[x.kunci]), 12);
  if (!Object.keys(kol).length) return null;

  return (
    <div className="bb-bento bb-naik" style={{ ['--d' as string]: 6 } as React.CSSProperties}>
      {tersedia['menunggu-keputusan'] && (
        <Kartu judul="Menunggu keputusan" kol={kol['menunggu-keputusan']}
          kalimat={menunggu ? <><span className="tabular-nums"><Angka nilai={menunggu} /></span> hal menunggu keputusan.</> : <span className="text-emerald-700">✓ Semua sudah diputuskan.</span>}>
          {antrean.length > 0 && (
            <div className="flex flex-col">
              {antrean.map(a => (
                <button key={a.kunci} type="button" disabled={!a.menu} onClick={() => a.menu && openMenu(a.menu)} className="bb-antre">
                  <span className="truncate">{a.label}</span>
                  <b className="bb-antre-ada">{a.jumlah}</b>
                </button>
              ))}
            </div>
          )}
        </Kartu>
      )}

      {tersedia['sumber-tiket'] && <KartuAsalTiket kpi={kpi} kol={kol['sumber-tiket']} onBuka={() => openMenu('ticket-troubleshooting')} />}

      {tersedia['unit-di-luar'] && s.unit && (
        <Kartu judul="Unit di luar" kol={kol['unit-di-luar']} onBuka={() => openMenu('unit-movement')}
          kalimat={s.unit.total === 0 ? <span className="text-emerald-700">✓ Semua unit pinjaman sudah kembali.</span>
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

      {tersedia['tren-tiket'] && (
        <Kartu judul={`Tren tiket ${new Date().getFullYear()}`} kol={kol['tren-tiket']}
          kalimat={<>{BULAN[bulan]} {ini} tiket{beda !== null && beda !== 0 && <>, {beda > 0 ? 'naik' : 'turun'} {Math.abs(beda)} dari {BULAN[bulan - 1]}</>}. Tersibuk: {BULAN[puncak]} ({deret[puncak] ?? 0}).</>}>
          <div className="mt-auto"><TrenBulanan data={deret.length ? deret : Array(12).fill(0)} viewH={140} warna={AKSEN_UTAMA} /></div>
        </Kartu>
      )}

      {tersedia['tiket-terlama'] && (
        <Kartu judul="Tiket terlama" kol={kol['tiket-terlama']} onBuka={() => openMenu('ticket-troubleshooting')}
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
      )}

      {tersedia['project-progress'] && (
        <Kartu judul="Project Progress" kol={kol['project-progress']} onBuka={() => openMenu('project-progress')}
          sisi={<span className="text-[11px] font-semibold text-slate-500">Target terdekat</span>}>
          <div className="bb-proyek-kisi">
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
          </div>
        </Kartu>
      )}

      {tersedia['nilai-sales'] && s.review && (
        <Kartu judul="Nilai dari Sales" kol={kol['nilai-sales']} onBuka={() => openMenu('form-bast')}>
          {s.review.jumlah === 0 ? <Kosong teks="Belum ada review." /> : (
            <>
              <div className="flex items-baseline gap-1.5 mb-2">
                <span className="text-[30px] font-black leading-none tabular-nums text-slate-900" style={{ letterSpacing: '-0.03em' }}>{fmtId(s.review.rata)}</span>
                <span className="text-[12px] font-semibold text-slate-500">dari 5</span>
              </div>
              <Bilah persen={(s.review.rata / 5) * 100} warna={AKSEN_UTAMA} label="Rata-rata nilai review" />
              <p className="bb-catatan">{s.review.jumlah} review Demo & BAST terbaru</p>
              <p className="bb-catatan mt-auto" title={s.review.terendahNama}>Terendah: {s.review.terendahNama} ({fmtId(s.review.terendahNilai)})</p>
            </>
          )}
        </Kartu>
      )}

      {tersedia.pembelajaran && (
        <Kartu judul="Pembelajaran tim" kol={kol.pembelajaran} onBuka={() => openMenu('learning-center')}>
          <div className="flex items-baseline gap-1.5 mb-2">
            <span className="text-[30px] font-black leading-none tabular-nums text-slate-900" style={{ letterSpacing: '-0.03em' }}>{fmtId(persenLulus, 0)}%</span>
            <span className="text-[12px] font-semibold text-slate-500">lulus quiz</span>
          </div>
          <Bilah persen={persenLulus} warna={AKSEN_UTAMA} label="Tingkat lulus quiz" />
          <p className="bb-catatan">{lc?.totalParticipants ?? 0} peserta · skor rata-rata {lc?.avgScore ?? 0}</p>
          {s.techNote && <p className="bb-catatan mt-auto">Tech Note {new Date().getFullYear()}: {s.techNote.disetujui} disetujui · {s.techNote.menunggu} menunggu</p>}
        </Kartu>
      )}
    </div>
  );
}
