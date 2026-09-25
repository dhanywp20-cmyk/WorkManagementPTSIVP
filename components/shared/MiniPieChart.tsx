'use client';
import { useState } from 'react';
import { Ikon } from './Ikon';
import { NETRAL } from '@/lib/desain';

/**
 * Shared MiniPieChart - kartu komposisi (bagian dari keseluruhan).
 *
 * Dirombak 2026-09-25 mengikuti kaidah visualisasi data, bukan selera:
 *  - Cincin tipis dengan CELAH 2px antar segmen (warna permukaan), bukan blok
 *    tebal menempel. Tanpa glow/drop-shadow.
 *  - Teks memakai warna tinta (slate), BUKAN warna seri - titik warna di
 *    sampingnya yang membawa identitas. Angka rata kanan, plus persentase,
 *    karena "41" tidak berarti apa-apa tanpa "59%".
 *  - Legenda tidak lagi dipotong max-height + scroll (segmen ke-6 dulu hilang
 *    dari pandangan). Lebih dari 7 kategori dilipat ke "Lainnya" - lebih dari
 *    itu donat tidak bisa dibaca siapa pun.
 *  - Arahkan kursor ke segmen/legenda: angka tengah menampilkan segmen itu.
 *  - Nilai persentase yang TIDAK menjumlah ke 100 (valueSuffix '%', mis.
 *    "Progres per Project") tidak digambar sebagai donat - donat menyiratkan
 *    bagian-dari-keseluruhan. Ditampilkan sebagai meter per baris.
 *
 * Props tidak berubah (kompatibel dengan seluruh pemanggil).
 */

const MAKS_KATEGORI = 7;
const WARNA_LAINNYA = NETRAL.garisKuat;
const PERMUKAAN = NETRAL.permukaan;

type Item = { label: string; value: number; color: string; lipat?: boolean };

function lipatKeLainnya(items: Item[]): Item[] {
  if (items.length <= MAKS_KATEGORI) return items;
  // Pertahankan 6 terbesar dalam URUTAN ASLINYA - warna mengikuti entitas,
  // bukan peringkat, jadi urutan & warna yang sudah dikenal tidak bergeser.
  const teratas = new Set([...items].sort((a, b) => b.value - a.value).slice(0, MAKS_KATEGORI - 1).map(i => i.label));
  const tetap = items.filter(i => teratas.has(i.label));
  const sisa = items.filter(i => !teratas.has(i.label));
  return [...tetap, { label: `Lainnya (${sisa.length})`, value: sisa.reduce((s, i) => s + i.value, 0), color: WARNA_LAINNYA, lipat: true }];
}

function Kartu({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-2 sm:p-4 flex flex-col gap-1.5 sm:gap-3 min-w-0"
      style={{ background: NETRAL.permukaan, border: `1px solid ${NETRAL.garis}`, boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
      <p className="flex items-center gap-1.5 text-[10px] sm:text-[12.5px] font-semibold text-slate-700 leading-tight">
        {icon && <Ikon nama={icon} ukuran={14} className="text-slate-400" />}
        <span className="truncate">{title}</span>
      </p>
      {children}
    </div>
  );
}

export function MiniPieChart({
  data, title, icon, activeFilter, onSliceClick,
  centerValue, centerLabel, valueSuffix,
}: {
  data: { label?: string; name?: string; value: number; color: string }[];
  title: string; icon: string;
  activeFilter?: string | null;
  onSliceClick?: (label: string) => void;
  /**
   * Angka besar di tengah. Default = jumlah seluruh nilai.
   * Diisi manual bila menjumlahkan slice TIDAK bermakna.
   */
  centerValue?: string | number;
  centerLabel?: string;
  /** Akhiran nilai di legenda, mis. '%'. */
  valueSuffix?: string;
}) {
  const [hov, setHov] = useState<number | null>(null);
  const semua: Item[] = data.map(d => ({ label: d.label ?? d.name ?? '', value: d.value, color: d.color }));
  const total = semua.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return (
      <Kartu title={title} icon={icon}>
        <p className="text-slate-400 text-[11px] sm:text-xs text-center py-3 sm:py-6">Belum ada data</p>
      </Kartu>
    );
  }

  const bisaKlik = typeof onSliceClick === 'function';

  // ── Mode meter: nilai persentase per baris, bukan komposisi ──
  if (valueSuffix === '%') {
    return (
      <Kartu title={title} icon={icon}>
        {centerValue !== undefined && (
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg sm:text-2xl font-bold text-slate-900 leading-none">{centerValue}</span>
            <span className="text-[9px] sm:text-[10px] font-medium text-slate-400 uppercase tracking-wide">{(centerLabel ?? '').toLowerCase()}</span>
          </div>
        )}
        <ul className="flex flex-col gap-1.5 sm:gap-2">
          {semua.map((s, i) => (
            <li key={i}>
              <button type="button" disabled={!bisaKlik} onClick={() => onSliceClick?.(s.label)}
                className={`w-full text-left ${bisaKlik ? 'cursor-pointer' : 'cursor-default'}`}>
                <div className="flex items-center justify-between gap-2 text-[9.5px] sm:text-[11px]">
                  <span className="truncate text-slate-600 font-medium">{s.label}</span>
                  <span className="font-semibold text-slate-800 tabular-nums flex-shrink-0">{s.value}%</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, s.value))}%`, background: s.color }} />
                </div>
              </button>
            </li>
          ))}
        </ul>
      </Kartu>
    );
  }

  // ── Mode donat: komposisi ──
  const items = lipatKeLainnya(semua);
  const cx = 60, cy = 60, r = 52, ir = 38;
  let sudut = -Math.PI / 2;
  const slices = items.map((d, i) => {
    const a = (d.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(sudut), y1 = cy + r * Math.sin(sudut);
    const x2 = cx + r * Math.cos(sudut + a), y2 = cy + r * Math.sin(sudut + a);
    const xi1 = cx + ir * Math.cos(sudut), yi1 = cy + ir * Math.sin(sudut);
    const xi2 = cx + ir * Math.cos(sudut + a), yi2 = cy + ir * Math.sin(sudut + a);
    const besar = a > Math.PI ? 1 : 0;
    const path = `M ${xi1} ${yi1} L ${x1} ${y1} A ${r} ${r} 0 ${besar} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${ir} ${ir} 0 ${besar} 0 ${xi1} ${yi1} Z`;
    sudut += a;
    return { ...d, path, i, penuh: d.value === total };
  });

  const persen = (v: number) => Math.round((v / total) * 100);
  const aktifIdx = activeFilter ? slices.findIndex(s => s.label === activeFilter) : -1;
  const sorot = hov ?? (aktifIdx >= 0 ? aktifIdx : null);
  const redup = (i: number) => sorot !== null && sorot !== i;
  const tengah = sorot !== null
    ? { angka: `${slices[sorot].value}`, ket: `${persen(slices[sorot].value)}% · ${slices[sorot].label}` }
    : { angka: `${centerValue ?? total}`, ket: (centerLabel ?? 'Total').toLowerCase() };

  const klik = (s: { label: string; lipat?: boolean }) => { if (bisaKlik && !s.lipat) onSliceClick!(s.label); };
  const ringkasan = slices.map(s => `${s.label} ${s.value} (${persen(s.value)}%)`).join(', ');

  return (
    <Kartu title={title} icon={icon}>
      {/* flex-wrap: di kartu sempit legenda turun ke bawah donat, bukan
          menyusut sampai hilang (terukur dulu 0px pada kartu 78-108px). */}
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
        <svg role="img" aria-label={`${title}: ${ringkasan}`} width="120" height="120" viewBox="0 0 120 120"
          className="flex-shrink-0 w-[64px] h-[64px] sm:w-[116px] sm:h-[116px]">
          {slices.map(s => s.penuh ? (
            <circle key={s.i} cx={cx} cy={cy} r={(r + ir) / 2} fill="none" stroke={s.color} strokeWidth={r - ir}
              opacity={redup(s.i) ? 0.3 : 1}
              onMouseEnter={() => setHov(s.i)} onMouseLeave={() => setHov(null)} onClick={() => klik(s)}
              style={{ cursor: bisaKlik && !s.lipat ? 'pointer' : 'default', transition: 'opacity .15s' }} />
          ) : (
            <path key={s.i} d={s.path} fill={s.color} stroke={PERMUKAAN} strokeWidth={2} strokeLinejoin="round"
              opacity={redup(s.i) ? 0.3 : 1}
              onMouseEnter={() => setHov(s.i)} onMouseLeave={() => setHov(null)} onClick={() => klik(s)}
              style={{ cursor: bisaKlik && !s.lipat ? 'pointer' : 'default', transition: 'opacity .15s' }} />
          ))}
          <text x="60" y="61" textAnchor="middle" fontSize="19" fontWeight="700" fill="#0f172a">{tengah.angka}</text>
          <text x="60" y="75" textAnchor="middle" fontSize="7.5" fill="#64748b" fontWeight="500">
            {tengah.ket.length > 22 ? tengah.ket.slice(0, 21) + '…' : tengah.ket}
          </text>
        </svg>

        <ul className="flex flex-col gap-px sm:gap-0.5 flex-1 basis-[92px] min-w-[92px] sm:basis-[160px] sm:min-w-[160px] max-w-[240px]">
          {slices.map(s => {
            const aktif = activeFilter === s.label;
            return (
              <li key={s.i}>
                <button type="button" disabled={!bisaKlik || s.lipat} aria-pressed={bisaKlik ? aktif : undefined}
                  onMouseEnter={() => setHov(s.i)} onMouseLeave={() => setHov(null)}
                  onFocus={() => setHov(s.i)} onBlur={() => setHov(null)}
                  onClick={() => klik(s)}
                  className={`w-full grid grid-cols-[8px_1fr_auto_auto] items-center gap-1.5 sm:gap-2 rounded-md px-1 sm:px-1.5 py-0.5 sm:py-1 text-left transition-colors ${bisaKlik && !s.lipat ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default'} ${aktif ? 'bg-slate-100' : ''}`}
                  style={{ opacity: redup(s.i) ? 0.55 : 1 }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                  <span className={`text-[9.5px] sm:text-[11px] truncate ${aktif ? 'font-semibold text-slate-900' : 'font-medium text-slate-600'}`}>{s.label}</span>
                  <span className="text-[9.5px] sm:text-[11px] font-semibold text-slate-800 tabular-nums text-right">{s.value}{valueSuffix ?? ''}</span>
                  <span className="text-[9px] sm:text-[10px] text-slate-400 tabular-nums text-right w-7 sm:w-8">{persen(s.value)}%</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Kartu>
  );
}
