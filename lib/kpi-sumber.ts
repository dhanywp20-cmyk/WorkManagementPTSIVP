
export interface SumberKPI {
  tickets: any[];
  actLogs: any[];
  reminders: any[];
  lcAttempts: any[];
  piketRows: any[];
  formReviews: any[];
  techNotes: any[];
}

const KOLOM_TANGGAL: Record<keyof SumberKPI, string> = {
  tickets: 'created_at',
  actLogs: 'created_at',
  reminders: 'created_at',
  lcAttempts: 'started_at',
  piketRows: 'day_date',
  formReviews: 'created_at',
  techNotes: 'reviewed_at',
};

function ms(nilai: string): number {
  return Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(nilai) ? `${nilai}T00:00:00Z` : /[zZ]|[+-]\d{2}:?\d{2}$/.test(nilai) ? nilai : `${nilai}Z`);
}

export function saringSumberKPI(sumber: SumberKPI, start: string, end: string): SumberKPI {
  const awal = ms(start), akhir = ms(`${end}T23:59:59`);
  const hasil = {} as SumberKPI;
  for (const k of Object.keys(KOLOM_TANGGAL) as (keyof SumberKPI)[]) {
    const kolom = KOLOM_TANGGAL[k];
    hasil[k] = sumber[k].filter(b => {
      const v = b?.[kolom];
      if (!v) return false;
      if (k === 'piketRows') return v >= start && v <= end;
      const t = ms(String(v));
      return t >= awal && t <= akhir;
    });
  }
  return hasil;
}
