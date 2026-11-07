export interface DeretKPI {
  tiket: { t: string; s: string }[];
  jadwal: { t: string; s: string }[];
}

export interface JadwalTim { id: string; proyek: string; kategori: string; pic: string; jam: string; selesai: boolean }
export interface JadwalDekat { hariIni: boolean; label: string; total: number; selesai: number; daftar: JadwalTim[] }
export interface BebanHari { kunci: string; label: string; jumlah: number }
export interface TiketTua { id: string; proyek: string; handler: string; status: string; hari: number }

export interface KPIData {
  deret?: DeretKPI;
  jadwalDekat?: JadwalDekat | null;
  bebanHari?: BebanHari[];
  tiketTua?: TiketTua[];
  tickets: {
    total: number; open: number; solved: number; waitingApproval: number;
    byHandler: { name: string; count: number }[];
    byStatus: { status: string; count: number; color: string }[];
    byDivision: { div: string; count: number }[];
    byProduct: { product: string; count: number }[];
    resolvedToday: number; avgResolutionDays: number;
    monthlyTickets: number[];
  };
  reminders: {
    total: number; pending: number; done: number; dueSoon: number;
    byCategory: { cat: string; count: number; color: string }[];
    byProduct: { product: string; byCategory: { cat: string; count: number }[] }[];
    overdueCount: number;
  };
  piket: {
    todayIVP: string | null; todayUMP: string | null; todayMvi: string | null;
    weekFilled: number; weekTotal: number; kegiatanToday: number;
  };
  units: { totalLogs: number; keluarThisMonth: number; masukThisMonth: number };
  users: { total: number; byRole: { role: string; count: number }[] };
  learning: { totalSessions: number; completedSessions: number; totalParticipants: number; avgScore: number };
}

export interface Scope {
  kind: 'admin' | 'pts_sup' | 'team' | 'none';
  ptsTeamType?: string;
  ptsMemberNames?: string[];
}
