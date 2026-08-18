'use client';

/**
 * components/shared/Charts.tsx — grafik yang bisa dipakai SEMUA modul.
 *
 * Sebelumnya keempat komponen di berkas ini hidup di dalam app/kpi-team/, dan
 * MiniSpark bahkan disalin tiga kali — dua di antaranya dideklarasikan di DALAM
 * fungsi komponen, sehingga dibuat ulang setiap render dan memaksa React
 * melepas-pasang seluruh subtree-nya.
 *
 * Sampai berkas ini ada, satu-satunya grafik bersama adalah MiniPieChart. Pie
 * hanya bisa menjawab "komposisi sekarang berapa persen" — bukan pertanyaan
 * yang paling sering ditanyakan: MEMBAIK ATAU MEMBURUK? Itu butuh deret waktu,
 * dan deret waktu itulah yang disediakan di sini.
 */

// ─── Sparkline ───────────────────────────────────────────────────────────────

/**
 * Batang mungil untuk diselipkan di dalam baris tabel atau kartu.
 *
 * Opacity naik dari kiri ke kanan supaya arah waktu terbaca tanpa perlu sumbu:
 * batang paling pekat = paling baru.
 */
export function MiniSpark({
  values, color = '#3b82f6', width = 56, height = 18,
}: {
  values: number[]; color?: string; width?: number; height?: number;
}) {
  if (values.length === 0) return <svg width={width} height={height} aria-hidden="true" />;
  const max = Math.max(...values, 1);
  const bw = Math.max(2, Math.floor(width / values.length) - 1);
  return (
    <svg width={width} height={height} className="flex-shrink-0"
      role="img" aria-label={`Tren ${values.length} periode terakhir`}>
      {values.map((v, i) => {
        const bh = Math.max(2, (v / max) * height);
        return (
          <rect key={i} x={i * (bw + 1)} y={height - bh} width={bw} height={bh} rx={1}
            fill={color} opacity={0.35 + (i / values.length) * 0.65} />
        );
      })}
    </svg>
  );
}

// ─── Batang per bulan ────────────────────────────────────────────────────────

const BULAN = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

/**
 * Grafik batang 12 bulan. Bulan berjalan diberi warna penuh, sisanya diredupkan
 * — supaya mata langsung menemukan "sekarang" tanpa membaca label.
 *
 * `labels` bisa diisi bila deretnya bukan Januari–Desember (mis. periode 6
 * bulan terakhir); bila kosong dipakai inisial bulan.
 */
export function MonthBarChart({
  values, color, labels, highlightIndex, height = 72,
}: {
  values: number[]; color: string; labels?: string[];
  highlightIndex?: number; height?: number;
}) {
  const max = Math.max(...values, 1);
  const sorot = highlightIndex ?? new Date().getMonth();
  const teks = labels ?? BULAN;
  return (
    <div className="flex items-end gap-0.5" style={{ height }}>
      {values.map((v, i) => {
        const bh = Math.max(3, (v / max) * height);
        const kini = i === sorot;
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5">
            {v > 0 && <span className="text-[7px] font-bold text-slate-500 leading-none">{v}</span>}
            <div className="w-full rounded-t-sm transition-all duration-500"
              style={{ height: bh, background: kini ? color : `${color}55` }}
              title={`${teks[i] ?? i + 1}: ${v}`} />
            <span className="text-[7px] text-slate-400 leading-none">{teks[i] ?? ''}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Donat ───────────────────────────────────────────────────────────────────

/**
 * Cincin proporsi dengan angka di tengah. Berbeda dari MiniPieChart yang
 * membawa legenda sendiri — yang ini sengaja telanjang, untuk disandingkan di
 * dalam kartu yang sudah punya keterangannya.
 */
export function DonutChart({
  segments, size = 56, label,
}: {
  segments: { value: number; color: string }[]; size?: number; label?: string;
}) {
  const sw = 8, r = (size - sw) / 2, circ = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0);

  if (!total) {
    return (
      <div style={{ width: size, height: size }}
        className="flex items-center justify-center flex-shrink-0">
        <span className="text-[9px] text-slate-300">—</span>
      </div>
    );
  }

  let cum = 0;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg aria-hidden="true" focusable="false" width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={sw} />
        {segments.map((seg, i) => {
          const dash = (seg.value / total) * circ;
          const offset = -(cum / total) * circ;
          cum += seg.value;
          return (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={seg.color}
              strokeWidth={sw} strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={offset} />
          );
        })}
      </svg>
      {label && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] font-black text-slate-700">{label}</span>
        </div>
      )}
    </div>
  );
}

// ─── Pembanding periode ──────────────────────────────────────────────────────

/**
 * Selisih terhadap periode sebelumnya, dalam persen.
 *
 * Ini yang membuat sebuah angka bermakna: "82%" tidak memberi tahu apa pun
 * sampai diketahui bulan lalu berapa. Sengaja disediakan bersama grafik supaya
 * dipasang berbarengan.
 *
 * `lowerIsBetter` untuk metrik yang justru bagus kalau turun — waktu respons,
 * jumlah tiket terlambat, keluhan. Tanpa itu, penurunan yang bagus akan
 * diwarnai merah.
 */
export function TrendBadge({
  delta, lowerIsBetter = false, suffix = '%',
}: {
  delta: number; lowerIsBetter?: boolean; suffix?: string;
}) {
  const abs = Math.abs(delta);
  if (abs < 0.05) {
    return <span className="text-[10px] text-slate-400 font-medium">— 0{suffix}</span>;
  }
  const bagus = lowerIsBetter ? delta < 0 : delta > 0;
  const panah = delta > 0 ? '▲' : '▼';
  return (
    <span className="text-[10px] font-bold flex-shrink-0"
      style={{ color: bagus ? '#10b981' : '#ef4444' }}
      title={`${bagus ? 'Membaik' : 'Memburuk'} ${abs.toFixed(1)}${suffix} dibanding periode sebelumnya`}>
      {panah} {abs.toFixed(1)}{suffix}
    </span>
  );
}

/**
 * Hitung selisih persen antara periode sekarang dan sebelumnya.
 *
 * Kasus dari-nol ditangani eksplisit: naik dari 0 ke berapa pun bukan
 * "kenaikan tak hingga" melainkan 100%, dan 0→0 adalah 0 — bukan NaN yang
 * akhirnya tampil sebagai "NaN%" di layar.
 */
export function hitungDelta(sekarang: number, sebelumnya: number): number {
  if (sebelumnya === 0) return sekarang === 0 ? 0 : 100;
  return ((sekarang - sebelumnya) / sebelumnya) * 100;
}
