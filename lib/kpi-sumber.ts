/**
 * lib/kpi-sumber.ts - Baris sumber penilaian KPI Team & pemilahannya per periode.
 *
 * Halaman KPI menampilkan periode ini DAN periode sebelumnya (untuk panah naik/turun). Dulu kedua
 * periode masing-masing mengambil 7 tabel sumber sendiri; sekarang diambil SEKALI untuk rentang
 * gabungan lalu dipilah di sini dengan kolom tanggal yang sama persis seperti filter di server.
 */

export interface SumberKPI {
  tickets: any[];
  actLogs: any[];
  reminders: any[];
  lcAttempts: any[];
  piketRows: any[];
  formReviews: any[];
  techNotes: any[];
}

/** Kolom tanggal penyaring tiap sumber - harus sama dengan .gte()/.lte() di query-nya. */
const KOLOM_TANGGAL: Record<keyof SumberKPI, string> = {
  tickets: 'created_at',
  actLogs: 'created_at',
  reminders: 'created_at',
  lcAttempts: 'started_at',
  piketRows: 'day_date',
  formReviews: 'created_at',
  techNotes: 'reviewed_at',
};

/**
 * Batas waktu dibandingkan dalam milidetik (bukan teks): tanggal polos `2026-10-01` dibaca tengah
 * malam UTC seperti PostgreSQL membaca literal tanpa zona untuk kolom timestamptz di Supabase.
 */
function ms(nilai: string): number {
  return Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(nilai) ? `${nilai}T00:00:00Z` : /[zZ]|[+-]\d{2}:?\d{2}$/.test(nilai) ? nilai : `${nilai}Z`);
}

/** Baris sumber yang tanggalnya di dalam [start, end hari itu 23:59:59] - meniru filter query. */
export function saringSumberKPI(sumber: SumberKPI, start: string, end: string): SumberKPI {
  const awal = ms(start), akhir = ms(`${end}T23:59:59`);
  const hasil = {} as SumberKPI;
  for (const k of Object.keys(KOLOM_TANGGAL) as (keyof SumberKPI)[]) {
    const kolom = KOLOM_TANGGAL[k];
    hasil[k] = sumber[k].filter(b => {
      const v = b?.[kolom];
      if (!v) return false;
      //  piket: kolom DATE dibandingkan dengan tanggal polos `end` (bukan end+23:59:59) di query-nya.
      if (k === 'piketRows') return v >= start && v <= end;
      const t = ms(String(v));
      return t >= awal && t <= akhir;
    });
  }
  return hasil;
}
