'use client';

export interface KPIData {
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

interface KPITeamMember {
  id: string;
  name: string;
  team_type: string;
  jabatan: string;
  ticketsHandled: number;
  ticketsSolved: number;
  ticketsOverdue: number;
  avgResolutionDays: number;
  remindersAssigned: number;
  remindersDone: number;
  remindersOverdue: number;
  lcAttempts: number;
  lcAvgScore: number;
  lcPassed: number;
  lcFailedBelow75: number;
  lcScores: number[];
  piketFilled: number;
  ticketAvgResponseHours: number;
  formReviewLowRating: number;
  formReviewTotal: number;
  monthlyTickets: number[];
  monthlyLC: number[];
  techNotesApproved: number;
  manual: {
    komplainCount: number;
    responTime: number;
    bastDemo: number;
    bastDemoTotal: number;
    reportBulanan: number;
    learningMastery: number;
  };
}

export interface KPITeamState {
  members: KPITeamMember[];
  loading: boolean;
  editingMember: string | null;
  editValues: Partial<KPITeamMember['manual']>;
  filterYear: number;
  filterPeriod: '6m' | '1y';
  filterStartMonth: number;
  filterTeam: string;
}

interface KPIPeriodSnapshot {
  id: string;
  period_label: string;
  year: number;
  period: '6m' | '1y';
  start_month: number;
  end_month: number;
  team_type: string;
  created_at: string;
  created_by: string;
  members_json: {
    id: string; name: string; jabatan: string; team_type: string;
    ticketsHandled: number; ticketsSolved: number; ticketsOverdue: number;
    lcAttempts: number; lcAvgScore: number; lcPassed: number;
    formReviewTotal: number; formReviewLowRating: number;
    techNotesApproved: number;
    tickScore: number; bastScore: number; lcScore: number; rndScore: number;
    finalKPI: number;
  }[];
  settings_json?: {
    lcMinScore: number; rndTarget: number;
    ticketOverdueWeight: number; bastWeight: number; lcWeight: number; rndWeight: number;
  } | null;
}

export interface AuditEntry {
  id: string; module: string; actor: string; action: string;
  target: string; detail: string; ts: string;
  severity: 'info' | 'warn' | 'critical'; icon: string;
}

export interface Scope {
  kind: 'admin' | 'pts_sup' | 'team' | 'none';
  ptsTeamType?: string;
  ptsMemberNames?: string[];
}
