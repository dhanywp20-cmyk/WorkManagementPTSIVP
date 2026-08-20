'use client';

import React from 'react';

import * as XLSX from 'xlsx-js-style';

/**
 * Tipe, konstanta, dan penolong KPI Team yang dipakai bersama halaman, popup rincian, dan ekspor Excel.
 */

// Types

export interface KPIUser {
  id: string; full_name: string; role: string;
  team_type?: string; jabatan?: string; allowed_menus?: string[];
  access_level?: string;
}

export interface KPIMember {
  id: string; name: string; team_type: string; jabatan: string;
  ticketsHandled: number; ticketsSolved: number; ticketsOverdue: number; avgResolutionDays: number;
  remindersAssigned: number; remindersDone: number;
  lcAttempts: number; lcAvgScore: number; lcPassed: number;
  lcScores: number[];
  piketFilled: number; ticketAvgResponseHours: number;
  formReviewTotal: number;
  formReviewLowRating: number;
  techNotesApproved: number;
  monthlyTickets: number[];
}

export interface KPISettings {
  lcMinScore: number;
  rndTarget: number;
  ticketOverdueWeight: number;
  bastWeight: number;
  lcWeight: number;
  rndWeight: number;
}

export const DEFAULT_KPI_SETTINGS: KPISettings = {
  lcMinScore: 70, rndTarget: 2,
  ticketOverdueWeight: 0.20, bastWeight: 0.40, lcWeight: 0.30, rndWeight: 0.10,
};

export interface KPIPeriodSnapshot {
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
    formReviewTotal: number; formReviewLowRating: number; techNotesApproved: number;
    tickScore: number; bastScore: number; lcScore: number; rndScore: number;
    finalKPI: number;
  }[];
  settings_json?: {
    lcMinScore: number; rndTarget: number; ticketOverdueWeight: number;
    bastWeight: number; lcWeight: number; rndWeight: number;
  } | null;
}

export interface Scope {
  kind: 'admin' | 'pts_sup' | 'team' | 'none';
  ptsTeamType?: string;
}

export type PeriodKey = 'Minggu Ini' | 'Bulan Ini' | '3 Bulan' | '6 Bulan' | '1 Tahun';

export type SortKey = 'name' | 'tickets' | 'solved' | 'solveRate' | 'avgDays' | 'remRate' | 'lcScore' | 'piket';

export type SortDir = 'asc' | 'desc';

// Constants

export const PERIODS: PeriodKey[] = ['Minggu Ini', 'Bulan Ini', '3 Bulan', '6 Bulan', '1 Tahun'];

export const PERIOD_EMOJI: Record<PeriodKey, string> = {
  'Minggu Ini': '📅', 'Bulan Ini': '🗓️', '3 Bulan': '📆', '6 Bulan': '🗃️', '1 Tahun': '📊',
};

export const TEAM_COLORS: Record<string, string> = {
  'Team PTS IVP': '#0284c7', 'Team PTS UMP': '#7c3aed', 'Team PTS MVI': '#0d9488',
};

export const STATUS_COLORS: Record<string, string> = {
  'Solved': '#10b981', 'Pending': '#3b82f6', 'Overdue': '#ef4444',
  'Waiting Approval': '#f59e0b', 'Cancelled': '#6b7280',
  'Process Repair': '#f97316', 'Warranty': '#8b5cf6',
  'Out Of Warranty': '#ec4899', 'Submit RMA': '#06b6d4',
};

export const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

export const MN     = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];

export const KPI_COLOR = '#0284c7';

// Helpers

export function fmt(d: Date): string { return d.toISOString().split('T')[0]; }

export function getPeriodRange(period: PeriodKey) {
  const now = new Date();
  if (period === 'Minggu Ini') {
    const dow = now.getDay();
    const mon = new Date(now); mon.setDate(now.getDate() + (dow === 0 ? -6 : 1 - dow)); mon.setHours(0,0,0,0);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const pMon = new Date(mon); pMon.setDate(mon.getDate() - 7);
    const pSun = new Date(pMon); pSun.setDate(pMon.getDate() + 6);
    return { start: fmt(mon), end: fmt(sun), prevStart: fmt(pMon), prevEnd: fmt(pSun) };
  }
  if (period === 'Bulan Ini') {
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const ps = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const pe = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: fmt(s), end: fmt(e), prevStart: fmt(ps), prevEnd: fmt(pe) };
  }
  if (period === '3 Bulan') {
    const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const s = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const pe = new Date(s); pe.setDate(pe.getDate() - 1);
    const ps = new Date(pe.getFullYear(), pe.getMonth() - 2, 1);
    return { start: fmt(s), end: fmt(e), prevStart: fmt(ps), prevEnd: fmt(pe) };
  }
  if (period === '6 Bulan') {
    const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const s = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const pe = new Date(s); pe.setDate(pe.getDate() - 1);
    const ps = new Date(pe.getFullYear(), pe.getMonth() - 5, 1);
    return { start: fmt(s), end: fmt(e), prevStart: fmt(ps), prevEnd: fmt(pe) };
  }
  // 1 Tahun
  const s = new Date(now.getFullYear(), 0, 1);
  const e = new Date(now.getFullYear(), 11, 31);
  const ps = new Date(now.getFullYear() - 1, 0, 1);
  const pe = new Date(now.getFullYear() - 1, 11, 31);
  return { start: fmt(s), end: fmt(e), prevStart: fmt(ps), prevEnd: fmt(pe) };
}

export function progressColor(pct: number): string {
  if (pct >= 90) return '#10b981';
  if (pct >= 70) return '#f59e0b';
  return '#ef4444';
}

export const MONTHS_ID = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
