'use client';

import { kelompokkanReminder, pieKategori, pieDivisiSales, pieTeamPts, pieProduk } from './olah-data';
import { Status, Reminder, TeamUser, isDueToday } from './shared';
import { bolehDitugaskanOleh } from '@/lib/teams';
import { hasFullAccess } from '@/lib/constants';
import { isPimpinan } from '@/lib/pimpinan';
import { bolehUbahJadwal } from '@/lib/jadwal/aturan';

export interface TurunanJadwalKonteks {
  currentUser: TeamUser | null;
  filterCategory: string;
  filterStatus: Status | "all";
  filterYear: string;
  managerUserId: string;
  productFilter: string | null;
  reminders: Reminder[];
  searchDivisionSales: string;
  searchProduct: string;
  searchProject: string;
  searchSales: string;
  searchTeamHandler: string;
  selectedCalDay: string | null;
  teamUsers: TeamUser[];
}

export function useTurunanJadwal(k: TurunanJadwalKonteks) {
  const { currentUser, filterCategory, filterStatus, filterYear, managerUserId, productFilter, reminders, searchDivisionSales, searchProduct, searchProject, searchSales, searchTeamHandler, selectedCalDay, teamUsers } = k;
  const availableYears = Array.from(new Set(reminders.map(r => r.due_date.substring(0, 4)))).sort((a, b) => b.localeCompare(a));

  const filteredReminders = reminders.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (filterYear !== 'all' && !r.due_date.startsWith(filterYear)) return false;
    if (filterCategory !== 'all' && r.category !== filterCategory) return false;
    const rName = ((r.project_name || '').trim() || ((r as any).title || '').trim()).toLowerCase();
    if (searchProject && !rName.includes(searchProject.toLowerCase()) &&
        !r.address?.toLowerCase().includes(searchProject.toLowerCase())) return false;
    if (searchSales && !r.sales_name?.toLowerCase().includes(searchSales.toLowerCase())) return false;
    if (searchDivisionSales && !r.sales_division?.toLowerCase().includes(searchDivisionSales.toLowerCase())) return false;
    if (searchTeamHandler && !r.assign_name?.toLowerCase().includes(searchTeamHandler.toLowerCase()) &&
        !r.assigned_to?.toLowerCase().includes(searchTeamHandler.toLowerCase())) return false;
    if (productFilter && r.product !== productFilter) return false;
    if (searchProduct && !r.product?.toLowerCase().includes(searchProduct.toLowerCase())) return false;
    if (selectedCalDay && r.due_date !== selectedCalDay) return false;
    return true;
  }).sort((a, b) => {
    return (b.created_at || '').localeCompare(a.created_at || '');
  });

  const groupedReminders = kelompokkanReminder(filteredReminders);

  const todayCount      = reminders.filter(r => isDueToday(r.due_date) && r.status !== 'done' && r.status !== 'cancelled').length;
  const pendingCount    = reminders.filter(r => r.status === 'pending').length;
  const doneCount       = reminders.filter(r => r.status === 'done').length;
  const totalCount      = reminders.length;

  const sourceReminders = filterYear === 'all' ? reminders : reminders.filter(r => r.due_date.startsWith(filterYear));

  const projectPieData = pieKategori(sourceReminders);
  const salesPieData = pieDivisiSales(sourceReminders);
  const teamPtsPieData = pieTeamPts(sourceReminders);
  const productPieData = pieProduk(sourceReminders);

  const isAdmin = ['admin', 'superadmin'].includes(currentUser?.role?.toLowerCase() ?? '');
  const teamUsersDitawarkan = teamUsers.filter(u => bolehDitugaskanOleh(u, isAdmin));
  const isManager = !!currentUser?.id && (
    hasFullAccess(currentUser) ||
    (!!managerUserId && currentUser.id === managerUserId)
  );
  const canApproveAssign = isAdmin || isManager;
  const isMyReviewStage = (r: Reminder) => r.routing_status === 'internal_review' &&
    (currentUser?.id === r.internal_sales_id || currentUser?.id === r.internal_sales_id_2);
  const bolehEditReminder = (r: Reminder): boolean =>
    bolehUbahJadwal(currentUser, r, { isAdmin, isManager, pimpinan: isPimpinan(currentUser) });
  const canInternalApprove = (r: Reminder) => {
    if (isPimpinan(currentUser)) return false;
    if (r.routing_status !== 'internal_review') return false;
    if (currentUser?.id === r.internal_sales_id && !r.internal_approved_at) return true;
    if (currentUser?.id === r.internal_sales_id_2 && !r.internal_approved_at_2) return true;
    return false;
  };
  const canAddReminder = isAdmin || currentUser?.role === 'team';
  const isGuest = (currentUser?.role === 'guest' || currentUser?.role === 'sales') && !isPimpinan(currentUser);
  return { availableYears, filteredReminders, groupedReminders, todayCount, pendingCount, doneCount, totalCount, sourceReminders, projectPieData, salesPieData, teamPtsPieData, productPieData, isAdmin, teamUsersDitawarkan, isManager, canApproveAssign, isMyReviewStage, bolehEditReminder, canInternalApprove, canAddReminder, isGuest };
}
