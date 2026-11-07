

export const RADIUS = {
  kecil: '0.5rem',
  kontrol: '0.75rem',
  kartu: '1rem',
  panel: '1.5rem',
  bulat: '9999px',
} as const;

export const BAYANG = {
  kartu: '0 4px 24px rgba(0,0,0,0.10)',
  kartu3d: 'inset 0 1px 0 #fff, 0 1px 0 #e2e8f0, 0 3px 0 #dfe5ee, 0 6px 10px -2px rgba(15,23,42,0.10), 0 24px 40px -18px rgba(15,23,42,0.28)',
  dropdown: '0 8px 32px rgba(0,0,0,0.18)',
  modal: '0 8px 40px rgba(0,0,0,0.18)',
  toast: '0 4px 32px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)',
} as const;

export const JARAK = {
  rapat: '0.5rem',
  kontrol: '0.75rem',
  sedang: '1rem',
  longgar: '1.25rem',
  lega: '1.5rem',
} as const;

export const TEKS = {
  judulHalaman: 'text-xl md:text-2xl font-bold tracking-tight',
  judulBagian: 'text-sm font-bold text-slate-800',
  judulKartu: 'text-sm font-bold',
  isi: 'text-sm',
  keterangan: 'text-xs text-slate-500',
  label: 'text-[10px] font-bold tracking-widest uppercase text-slate-400',
  bantuan: 'text-[11px] text-slate-400 leading-relaxed',
  galat: 'text-xs font-semibold text-rose-600',
} as const;

export const WARNA = {
  berhasil: { utama: '#059669', teks: '#047857', latar: 'rgba(16,185,129,0.10)', garis: 'rgba(16,185,129,0.35)' },
  bahaya:   { utama: '#dc2626', teks: '#b91c1c', latar: 'rgba(239,68,68,0.10)',  garis: 'rgba(239,68,68,0.35)' },
  awas:     { utama: '#d97706', teks: '#b45309', latar: 'rgba(245,158,11,0.10)', garis: 'rgba(245,158,11,0.35)' },
  info:     { utama: '#0284c7', teks: '#0369a1', latar: 'rgba(2,132,199,0.10)',  garis: 'rgba(2,132,199,0.35)' },
  netral:   { utama: '#64748b', teks: '#475569', latar: 'rgba(100,116,139,0.08)', garis: 'rgba(100,116,139,0.25)' },
} as const;

export type NamaWarna = keyof typeof WARNA;

export function gayaWarna(nama: NamaWarna): { background: string; color: string; border: string } {
  const w = WARNA[nama];
  return { background: w.latar, color: w.teks, border: `1px solid ${w.garis}` };
}

export const NETRAL = {
  halaman: '#f3f5f8',
  permukaan: '#ffffff',
  permukaanRedam: '#f8fafc',
  garis: '#e2e8f0',
  garisKuat: '#cbd5e1',
  tinta: '#0f172a',
  tinta2: '#475569',
  tinta3: '#94a3b8',
} as const;

export const LATAR_HALAMAN: { background: string } = { background: NETRAL.halaman };

export const SERI = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'] as const;

const STATUS_KE_WARNA: Record<string, NamaWarna> = {
  solved: 'berhasil', done: 'berhasil', selesai: 'berhasil', approved: 'berhasil', paid: 'berhasil', completed: 'berhasil', lulus: 'berhasil',
  processed: 'info', 'in progress': 'info', in_progress: 'info', proses: 'info', 'process repair': 'info', open: 'info',
  pending: 'awas', 'pending review': 'awas', revision: 'awas', 'perlu revisi': 'awas',
  'waiting approval': 'awas', waiting: 'awas', menunggu: 'awas', review: 'awas', warranty: 'awas', 'submit rma': 'awas',
  overdue: 'bahaya', rejected: 'bahaya', ditolak: 'bahaya', blocked: 'bahaya', 'out of warranty': 'bahaya', gagal: 'bahaya',
  cancelled: 'netral', canceled: 'netral', batal: 'netral', archived: 'netral', draft: 'netral',
};

export function warnaUntukStatus(status: string | null | undefined): NamaWarna {
  return STATUS_KE_WARNA[(status ?? '').trim().toLowerCase()] ?? 'netral';
}

export const WARNA_STATUS_TICKET: Record<string, string> = {
  'Waiting Approval': '#f97316', 'Pending': '#f59e0b', 'Solved': '#10b981',
  'Cancelled': '#6b7280', 'Overdue': '#ef4444', 'Warranty': '#8b5cf6',
  'Out Of Warranty': '#ec4899', 'Process Repair': '#2563eb', 'Submit RMA': '#06b6d4',
};
