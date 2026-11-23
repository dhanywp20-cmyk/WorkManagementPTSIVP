'use client';

import type { ReactNode } from 'react';
import { MapPin, TrendingUp } from 'lucide-react';
import { StatCard, type StatCardItem } from '@/components/shared';
import { NETRAL } from '@/lib/desain';
import { STATUS_ISU, labelTanggalLengkap, labelTanggalPendek, type HariTren, type LaporanIsu, type StatusIsu } from '@/lib/isu/inti';
import { TEMA, fontAngka } from '../tampilan';

type SaringStatus = string;

const kartu = { background: NETRAL.permukaan, border: `1px solid ${NETRAL.garis}` };
const WARNA_BARU = '#2563eb';
const WARNA_SOLVED = '#16a34a';

function Kepala({ ikon: Ikon, judul, sub, kanan }: { ikon: typeof TrendingUp; judul: string; sub?: string; kanan?: ReactNode }) {
  return (
    <div className="flex items-start gap-2 px-4 pt-3.5 pb-2">
      <Ikon size={15} className="mt-0.5 shrink-0" style={{ color: TEMA.samar }} />
      <div className="min-w-0 flex-1">
        <h3 className="text-[13.5px] font-semibold leading-tight" style={{ color: NETRAL.tinta }}>{judul}</h3>
        {sub && <p className="text-[11.5px] mt-0.5" style={{ color: TEMA.samar }}>{sub}</p>}
      </div>
      {kanan}
    </div>
  );
}

function Legenda({ warna, label, nilai }: { warna: string; label: string; nilai: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium whitespace-nowrap" style={{ color: NETRAL.tinta2 }}>
      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: warna }} />{label}
      <b style={{ ...fontAngka, color: NETRAL.tinta }}>{nilai}</b>
    </span>
  );
}

export function TrenIsu({ tren }: { tren: HariTren[] }) {
  const maks = Math.max(1, ...tren.map(h => Math.max(h.baru, h.solved)));
  const totalBaru = tren.reduce((a, h) => a + h.baru, 0);
  const totalSolved = tren.reduce((a, h) => a + h.solved, 0);
  const akhir = tren.length - 1;
  const tandaX = (n: number) => n === akhir || (n % 7 === 0 && akhir - n >= 4);
  return (
    <section className="rounded-xl overflow-hidden lg:col-span-2" style={kartu}>
      <Kepala ikon={TrendingUp} judul={`Tren ${tren.length} hari terakhir`} sub="Isu baru dilaporkan vs isu yang solved per hari"
        kanan={<div className="hidden sm:flex items-center gap-3"><Legenda warna={WARNA_BARU} label="Baru" nilai={totalBaru} /><Legenda warna={WARNA_SOLVED} label="Solved" nilai={totalSolved} /></div>} />
      <div className="flex sm:hidden items-center gap-3 px-4 pb-1">
        <Legenda warna={WARNA_BARU} label="Baru" nilai={totalBaru} /><Legenda warna={WARNA_SOLVED} label="Solved" nilai={totalSolved} />
      </div>
      <div className="px-4 pb-3.5 pt-1">
        <div className="flex gap-2">
          <div className="flex flex-col justify-between h-36 text-[10px] text-right w-5 shrink-0" style={{ ...fontAngka, color: TEMA.samar }}>
            <span>{maks}</span><span>{maks > 1 ? Math.round(maks / 2) : ''}</span><span>0</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="relative h-36">
              {[0, 50, 100].map(p => (
                <span key={p} aria-hidden className="absolute inset-x-0 h-px" style={{ bottom: `${p}%`, background: p ? NETRAL.garis : NETRAL.garisKuat }} />
              ))}
              <div className="absolute inset-0 flex items-end gap-[2px] sm:gap-[3px]" role="img"
                aria-label={`Tren ${tren.length} hari: ${totalBaru} isu baru, ${totalSolved} solved`}>
                {tren.map(h => (
                  <div key={h.tanggal} title={`${labelTanggalLengkap(h.tanggal)} · Baru ${h.baru} · Solved ${h.solved}`}
                    className="flex-1 h-full flex items-end justify-center gap-px rounded-sm hover:bg-slate-100/70 transition-colors">
                    <span className="w-1/2 max-w-[9px] rounded-t-[2px]" style={{ height: `${(h.baru / maks) * 100}%`, background: WARNA_BARU }} />
                    <span className="w-1/2 max-w-[9px] rounded-t-[2px]" style={{ height: `${(h.solved / maks) * 100}%`, background: WARNA_SOLVED }} />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-[2px] sm:gap-[3px] mt-1.5">
              {tren.map((h, n) => (
                <span key={h.tanggal} className="flex-1 relative h-3.5">
                  {tandaX(n) && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 text-[10px] whitespace-nowrap" style={{ ...fontAngka, color: TEMA.samar }}>
                      {labelTanggalPendek(h.tanggal)}
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LokasiTerbuka({ data, aktif, onPilih }: {
  data: LaporanIsu['lokasiTerbuka'];
  aktif: string;
  onPilih: (lokasi: string) => void;
}) {
  const tampil = data.slice(0, 7);
  const maks = Math.max(1, ...tampil.map(l => l.terbuka));
  return (
    <section className="rounded-xl overflow-hidden flex flex-col" style={kartu}>
      <Kepala ikon={MapPin} judul="Lokasi dengan isu terbuka" sub={data.length ? `${data.length} lokasi · klik untuk menyaring` : undefined} />
      {tampil.length === 0
        ? <p className="flex-1 px-4 pb-6 pt-4 text-center text-[12.5px]" style={{ color: TEMA.samar }}>Tidak ada isu terbuka. Semua isu sudah solved.</p>
        : (
          <ul className="px-2 pb-2.5 space-y-0.5">
            {tampil.map(l => {
              const dipilih = aktif === l.lokasi;
              return (
                <li key={l.lokasi}>
                  <button type="button" onClick={() => onPilih(dipilih ? '' : l.lokasi)} aria-pressed={dipilih}
                    className="w-full text-left rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-50"
                    style={dipilih ? { background: TEMA.tint, boxShadow: `inset 0 0 0 1px ${TEMA.garisTint}` } : undefined}>
                    <span className="flex items-center gap-2">
                      <span className="flex-1 min-w-0 truncate text-[12.5px] font-medium" style={{ color: NETRAL.tinta }}>{l.lokasi}</span>
                      <span className="text-[12px] font-semibold shrink-0" style={{ ...fontAngka, color: STATUS_ISU.open.warna }}>{l.terbuka}</span>
                      <span className="text-[11px] shrink-0 w-10 text-right" style={{ ...fontAngka, color: TEMA.samar }}>/ {l.total}</span>
                    </span>
                    <span className="mt-1 block h-1.5 rounded-full overflow-hidden" style={{ background: NETRAL.permukaanRedam }}>
                      <span className="block h-full rounded-full" style={{ width: `${(l.terbuka / maks) * 100}%`, background: STATUS_ISU.open.warna, opacity: 0.75 }} />
                    </span>
                  </button>
                </li>
              );
            })}
            {data.length > tampil.length && (
              <li className="px-2 pt-1 text-[11.5px]" style={{ color: TEMA.samar }}>+{data.length - tampil.length} lokasi lainnya</li>
            )}
          </ul>
        )}
    </section>
  );
}

export function RingkasanLaporan({ r, lokasi, status, onStatus, kota, onKota, catatan }: {
  r: LaporanIsu;
  lokasi: LaporanIsu['lokasiTerbuka'];
  status: SaringStatus;
  onStatus: (s: SaringStatus) => void;
  kota: string;
  onKota: (k: string) => void;
  catatan?: string;
}) {
  const p = r.perStatus;
  return (
    <div className="space-y-3">
      {catatan && <p className="text-[11.5px] font-medium px-1" style={{ color: TEMA.samar }}>{catatan}</p>}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3">
        {([
        { label: 'Total isu', value: r.total, sub: `${r.baru7} baru dalam 7 hari`, accent: '#475569', onClick: () => onStatus('semua') },
        { label: 'Belum solved', value: r.terbuka, sub: `Open ${p.open} · Progress ${p.progress} · Pending ${p.pending}`, accent: STATUS_ISU.open.warna, active: status === 'aktif', onClick: () => onStatus(status === 'aktif' ? 'semua' : 'aktif') },
        { label: 'Tingkat penyelesaian', value: `${r.persenSolved}%`, sub: `${p.solved} dari ${r.total} isu solved`, accent: STATUS_ISU.solved.warna, active: status === 'solved', onClick: () => onStatus(status === 'solved' ? 'semua' : 'solved') },
        { label: 'Rata-rata penyelesaian', value: r.rataSelesai === null ? '–' : `${r.rataSelesai} hari`, sub: 'dari laporan sampai solved', accent: '#2563eb' },
        { label: 'Lokasi terdampak', value: r.lokasiTerdampak, sub: r.terbuka ? `isu terlama terbuka ${r.terlamaTerbuka} hari` : 'tidak ada isu terbuka', accent: '#b45309' },
        ] as StatCardItem[]).map((it, n) => (
          <div key={it.label} className={`grid ${n === 4 ? 'col-span-2 md:col-span-1' : ''}`}><StatCard {...it} /></div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <TrenIsu tren={r.tren} />
        <LokasiTerbuka data={lokasi} aktif={kota} onPilih={onKota} />
      </div>
    </div>
  );
}
