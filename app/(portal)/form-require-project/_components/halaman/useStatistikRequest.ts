'use client';

/** useStatistikRequest - dipecah dari app/(portal)/form-require-project/page.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import { daftarKebutuhan } from '../ruangan';
import { usePaginasi } from '@/components/shared';
import { ProjectRequest, PIE_COLORS } from '../shared';

export interface StatistikRequestKonteks {
  filterDivision: string;
  filterHandler: string;
  filterKebutuhan: string;
  filterMonth: string;
  filterStatus: string;
  filterYear: string;
  requests: ProjectRequest[];
  searchQuery: string;
  searchSales: string;
}

export function useStatistikRequest(k: StatistikRequestKonteks) {
  const { filterDivision, filterHandler, filterKebutuhan, filterMonth, filterStatus, filterYear, requests, searchQuery, searchSales } = k;
  const availableYears = [...new Set(requests.map(r => new Date(r.created_at).getFullYear().toString()))].sort((a, b) => b.localeCompare(a));

  // Paginasi daftar - lihat components/shared/Paginasi.tsx.
  const filteredRequests = requests.filter(r => {
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    const matchYear = filterYear === 'all' || new Date(r.created_at).getFullYear().toString() === filterYear;
    const matchMonth = filterMonth === 'all' || (new Date(r.created_at).getMonth() + 1).toString().padStart(2, '0') === filterMonth;
    const matchHandler = filterHandler === 'all' || (r.assign_name || '') === filterHandler;
    const matchDivision = filterDivision === 'all' || (r.sales_division || 'Lainnya') === filterDivision;
    const matchKebutuhan = filterKebutuhan === 'all' || daftarKebutuhan(r).includes(filterKebutuhan);
    const matchProject = !searchQuery || r.project_name.toLowerCase().includes(searchQuery.toLowerCase())
      || (r.project_location || '').toLowerCase().includes(searchQuery.toLowerCase())
      || (r.room_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchSales = !searchSales || (r.sales_name || '').toLowerCase().includes(searchSales.toLowerCase())
      || (r.requester_name || '').toLowerCase().includes(searchSales.toLowerCase())
      || (r.sales_division || '').toLowerCase().includes(searchSales.toLowerCase());
    return matchStatus && matchYear && matchMonth && matchHandler && matchDivision && matchKebutuhan && matchProject && matchSales;
  });

  const hal = usePaginasi(filteredRequests);

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    in_progress: requests.filter(r => r.status === 'in_progress').length,
    completed: requests.filter(r => r.status === 'completed').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  };

  const statusPieData = [
    { label: 'Pending', value: stats.pending, color: '#f59e0b' },
    { label: 'Approved', value: stats.approved, color: '#10b981' },
    { label: 'In Progress', value: stats.in_progress, color: '#3b82f6' },
    { label: 'Completed', value: stats.completed, color: '#8b5cf6' },
    { label: 'Rejected', value: stats.rejected, color: '#ef4444' },
  ].filter(d => d.value > 0);

  const divisionCounts: Record<string, number> = {};
  for (const r of requests) { const d = r.sales_division || 'Lainnya'; divisionCounts[d] = (divisionCounts[d] || 0) + 1; }
  const divisionPieData = Object.entries(divisionCounts).map(([label, value], i) => ({ label, value, color: PIE_COLORS[i % PIE_COLORS.length] }));

  const assignedCounts: Record<string, number> = {};
  for (const r of requests) { const a = r.assign_name || 'Unassigned'; assignedCounts[a] = (assignedCounts[a] || 0) + 1; }
  const assignedPieData = Object.entries(assignedCounts).map(([label, value], i) => ({ label, value, color: PIE_COLORS[i % PIE_COLORS.length] }));

  const productCounts: Record<string, number> = {};
  for (const r of requests) {
    const prods = r.solution_product?.length ? r.solution_product : (r.solution_other ? [r.solution_other] : ['Lainnya']);
    for (const p of prods) { productCounts[p] = (productCounts[p] || 0) + 1; }
  }
  const productPieData = Object.entries(productCounts).map(([label, value], i) => ({ label, value, color: PIE_COLORS[i % PIE_COLORS.length] }));

  const kebutuhanCounts: Record<string, number> = {};
  for (const r of requests) for (const k of daftarKebutuhan(r)) kebutuhanCounts[k] = (kebutuhanCounts[k] || 0) + 1;
  const kebutuhanPieData = Object.entries(kebutuhanCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], i) => ({ label, value, color: PIE_COLORS[i % PIE_COLORS.length] }));
  return { availableYears, filteredRequests, hal, stats, statusPieData, divisionCounts, divisionPieData, assignedCounts, assignedPieData, productCounts, productPieData, kebutuhanCounts, kebutuhanPieData };
}
