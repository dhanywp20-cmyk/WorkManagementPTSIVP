'use client';

import { NETRAL } from '@/lib/desain';
import { STATUS_ISU, URUTAN_STATUS, type BatangIsu, type StatusIsu } from '@/lib/isu/inti';
import { TEMA, fontAngka } from '../tampilan';

const WARNA_TERBUKA = TEMA.warna;
const WARNA_SOLVED = '#93c5fd';
const BATAS = 8;

function Legenda() {
  const titik = (w: string) => <span aria-hidden className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: w }} />;
  return (
    <div className="flex items-center gap-3 text-[11.5px]" style={{ color: NETRAL.tinta2 }}>
      <span className="inline-flex items-center gap-1.5">{titik(WARNA_TERBUKA)}Belum solved</span>
      <span className="inline-flex items-center gap-1.5">{titik(WARNA_SOLVED)}Solved</span>
    </div>
  );
}

export function PanelBatang({ judul, keterangan, data, aktif, onPilih, catatan }: {
  judul: string;
  keterangan: string;
  data: BatangIsu[];
  aktif: string;
  onPilih: (kunci: string) => void;
  catatan?: string;
}) {
  const tampil = data.slice(0, BATAS);
  const sisa = data.slice(BATAS);
  const maks = Math.max(1, ...tampil.map(b => b.total));
  return (
    <section className="rounded-xl p-3 sm:p-4 min-w-0" style={{ background: NETRAL.permukaan, border: `1px solid ${NETRAL.garis}` }}>
      <h3 className="text-[13.5px] font-bold" style={{ color: NETRAL.tinta }}>{judul}</h3>
      <p className="text-[11.5px] mb-2.5" style={{ color: TEMA.samar }}>{keterangan}</p>
      {tampil.length === 0 ? (
        <p className="py-6 text-center text-[12.5px]" style={{ color: TEMA.samar }}>Belum ada data.</p>
      ) : (
        <ul className="space-y-0.5">
          {tampil.map(b => {
            const dipilih = aktif === b.kunci;
            const redup = !!aktif && !dipilih;
            const solved = b.total - b.terbuka;
            const info = `${b.label}: ${b.total} isu (${b.terbuka} belum solved, ${solved} solved)`;
            return (
              <li key={b.kunci}>
                <button type="button" onClick={() => onPilih(dipilih ? '' : b.kunci)} aria-pressed={dipilih} title={`${info}. Klik untuk ${dipilih ? 'hapus saringan' : 'menyaring daftar'}.`}
                  aria-label={info}
                  className="w-full text-left rounded-lg px-1.5 py-1 transition-colors hover:bg-slate-50"
                  style={{ background: dipilih ? TEMA.tint : undefined, opacity: redup ? 0.45 : 1 }}>
                  <div className="flex items-baseline gap-2 text-[12.5px]">
                    <span className="truncate font-semibold" style={{ color: NETRAL.tinta }}>{b.label}</span>
                    <span className="ml-auto shrink-0 font-bold" style={{ ...fontAngka, color: NETRAL.tinta }}>{b.total}</span>
                    <span className="shrink-0 w-[70px] text-right text-[11px]" style={{ ...fontAngka, color: b.terbuka ? TEMA.bahaya : TEMA.samar }}>
                      {b.terbuka ? `${b.terbuka} terbuka` : 'semua solved'}
                    </span>
                  </div>
                  <div className="mt-1 h-2 flex gap-[2px]" style={{ width: `${(b.total / maks) * 100}%`, minWidth: 6 }}>
                    {b.terbuka > 0 && <span className="h-full rounded-sm" style={{ flex: b.terbuka, background: WARNA_TERBUKA }} />}
                    {solved > 0 && <span className="h-full rounded-sm" style={{ flex: solved, background: WARNA_SOLVED }} />}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {(sisa.length > 0 || catatan) && (
        <p className="mt-2 text-[11px]" style={{ color: TEMA.samar }}>
          {sisa.length > 0 && `+${sisa.length} lainnya (${sisa.reduce((n, b) => n + b.total, 0)} isu). `}{catatan}
        </p>
      )}
    </section>
  );
}


export function KomposisiStatus({ jumlah }: { jumlah: Record<StatusIsu, number> }) {
  const total = URUTAN_STATUS.reduce((n, s) => n + jumlah[s], 0);
  return (
    <section className="rounded-xl p-3 sm:p-4" style={{ background: NETRAL.permukaan, border: `1px solid ${NETRAL.garis}` }}>
      <div className="flex items-baseline gap-2 flex-wrap mb-2">
        <h3 className="text-[13.5px] font-bold" style={{ color: NETRAL.tinta }}>Komposisi status</h3>
        <span className="text-[11.5px]" style={{ ...fontAngka, color: TEMA.samar }}>{total} isu sesuai saringan</span>
      </div>
      {total > 0 && (
        <div className="h-3 flex gap-[2px] mb-2" role="img" aria-label={URUTAN_STATUS.map(s => `${STATUS_ISU[s].label} ${jumlah[s]}`).join(', ')}>
          {URUTAN_STATUS.filter(s => jumlah[s] > 0).map(s => (
            <span key={s} title={`${STATUS_ISU[s].label}: ${jumlah[s]}`} className="h-full first:rounded-l-md last:rounded-r-md" style={{ flex: jumlah[s], background: STATUS_ISU[s].warna }} />
          ))}
        </div>
      )}
      <div className="flex gap-x-4 gap-y-1 flex-wrap text-[12px]">
        {URUTAN_STATUS.map(s => (
          <span key={s} className="inline-flex items-center gap-1.5" style={{ color: NETRAL.tinta2 }}>
            <span aria-hidden className="w-2.5 h-2.5 rounded-sm" style={{ background: STATUS_ISU[s].warna }} />
            {STATUS_ISU[s].label}
            <b style={{ ...fontAngka, color: NETRAL.tinta }}>{jumlah[s]}</b>
            <span style={fontAngka}>{total ? `${Math.round((jumlah[s] / total) * 100)}%` : ''}</span>
          </span>
        ))}
      </div>
    </section>
  );
}

export { Legenda as LegendaBatang };
