'use client';

export type { DeretKPI, JadwalTim, JadwalDekat, BebanHari, TiketTua, KPIData, Scope } from '@/lib/kpi-dasbor';

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

export interface AuditEntry {
  id: string; module: string; actor: string; action: string;
  target: string; detail: string; ts: string;
  severity: 'info' | 'warn' | 'critical'; icon: string;
}

