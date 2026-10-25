'use client';

/** useDataLaporan - dipecah dari app/(portal)/daily-report/page.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import { useMemo } from 'react';
import { type FlatRow } from './bantu-halaman';
import type { Ekspor } from '@/lib/ekspor-tabel';
import { usePaginasi } from '@/components/shared';
import { todayISO, type ReminderActivity, type TicketActivity, type DailyReport } from './shared';
import { CATEGORY_CONFIG, type TeamUser } from '@/app/(portal)/reminder-schedule/_components/shared';

export interface DataLaporanKonteks {
  filterCategory: string | null;
  filterDate: string;
  filterDivision: string | null;
  filterHandler: string | null;
  filterProduct: string | null;
  filterSource: string;
  filterStatus: string;
  filterUser: string;
  lihatSemua: boolean;
  liveReminders: (ReminderActivity & { handler_username?: string; report_date?: string; })[];
  liveTickets: (TicketActivity & { handler_username?: string; report_date?: string; })[];
  reports: DailyReport[];
  searchProject: string;
  teamUsers: TeamUser[];
}

export function useDataLaporan(k: DataLaporanKonteks) {
  const { filterCategory, filterDate, filterDivision, filterHandler, filterProduct, filterSource, filterStatus, filterUser, lihatSemua, liveReminders, liveTickets, reports, searchProject, teamUsers } = k;
  const allRows = useMemo<FlatRow[]>(() => {
    const rows: FlatRow[] = [];

    // Build ticket key set untuk deduplication
    // Key format: `${project_name_lower}|${handler_username_lower}|${date}`
    // Reminder Troubleshooting yang sudah ada tiketnya di platform ticketing tidak
    // ditampilkan duplikat - ticket lebih prioritas karena lebih lengkap (action_taken, status aktual)
    const ticketKeySet = new Set<string>(
      liveTickets.map(t => {
        const hu = ((t as any).handler_username ?? '').toLowerCase();
        const rd = ((t as any).report_date ?? '').split('T')[0];
        return `${(t.project_name ?? '').trim().toLowerCase()}|${hu}|${rd}`;
      })
    );

    // Reminder - langsung dari platform, tanpa perlu submit
    liveReminders.forEach(r => {
      const hr = (r as any).handler_username ?? '';
      const tu = teamUsers.find(u => u.username === hr);
      const rd = ((r as any).report_date ?? '').split('T')[0];

      // Jika reminder kategori Troubleshooting DAN sudah ada ticket yang matching
      // (project_name + handler + tanggal sama)  skip untuk hindari duplicate
      if ((r.category ?? '').toLowerCase() === 'troubleshooting') {
        const key = `${(r.project_name ?? '').trim().toLowerCase()}|${hr.toLowerCase()}|${rd}`;
        if (ticketKeySet.has(key)) return;
      }

      rows.push({
        id: 'rem_' + r.reminder_id,
        source: 'reminder',
        report_date: rd,
        project_name: r.project_name || r.title || '-',
        address: r.address || '',
        product: r.product || '',
        category: r.category || 'Internal',
        kegiatan_icon: '🔔',
        kegiatan_label: r.category || 'Reminder',
        sales_name: r.sales_name || '',
        sales_division: r.sales_division || '',
        handler_name: tu?.full_name ?? hr,
        handler_username: hr,
        status: r.status || 'pending',
        jam: r.due_time || '-',
        raw: r,
      });
    });

    // Ticket - langsung dari platform
    liveTickets.forEach(t => {
      const hu = (t as any).handler_username ?? '';
      const tu = teamUsers.find(u => u.username === hu);
      const rd = (t as any).report_date ?? '';
      rows.push({
        id: 'tck_' + t.ticket_id,
        source: 'ticket',
        report_date: rd,
        project_name: t.project_name || '-',
        address: t.address || '',
        product: '',
        category: 'Troubleshooting',
        kegiatan_icon: '🔧',
        kegiatan_label: t.issue_case || 'Troubleshooting',
        sales_name: t.sales_name || '',
        sales_division: t.sales_division || '',
        handler_name: tu?.full_name ?? hu,
        handler_username: hu,
        status: t.new_status || '-',
        jam: t.log_time || '-',
        raw: t,
      });
    });

    // Manual - dari submitted daily_reports saja
    reports.forEach(r => {
      r.manual_activities.forEach((m, idx) => {
        const tu = teamUsers.find(u => u.id === r.user_id);
        rows.push({
          id: `man_${r.id}_${idx}`,
          source: 'manual',
          manual_index: idx,
          report_date: r.report_date,
          project_name: m.project_name || '-',
          address: m.address || '',
          product: '',
          category: m.category || 'Internal',
          kegiatan_icon: '✍️',
          kegiatan_label: m.description || m.category || 'Manual',
          sales_name: m.sales_name || '',
          sales_division: m.sales_division || '',
          handler_name: r.user_name,
          handler_username: tu?.username ?? '',
          status: 'manual',
          jam: '-',
          report_id: r.id,
          raw: m,
        });
      });
    });

    // Sort: terbaru dulu
    rows.sort((a, b) => b.report_date.localeCompare(a.report_date) || a.jam.localeCompare(b.jam));
    return rows;
  }, [liveReminders, liveTickets, reports, teamUsers]);

  // Filter rows
  const filteredRows = useMemo(() => {
    return allRows.filter(row => {
      if (searchProject) {
        const q = searchProject.toLowerCase();
        if (!row.project_name.toLowerCase().includes(q) && !row.address.toLowerCase().includes(q) && !row.sales_name.toLowerCase().includes(q) && !row.handler_name.toLowerCase().includes(q)) return false;
      }
      if (filterStatus && row.status.toLowerCase() !== filterStatus.toLowerCase()) return false;
      if (filterSource && row.source !== filterSource) return false;
      if (filterCategory && row.category !== filterCategory) return false;
      if (filterHandler && (row.handler_name || row.handler_username) !== filterHandler) return false;
      if (filterDivision && row.sales_division !== filterDivision) return false;
      if (filterProduct && row.product !== filterProduct) return false;
      return true;
    });
  }, [allRows, searchProject, filterStatus, filterCategory, filterHandler, filterDivision, filterProduct]);

  /** Ekspor Activity List sesuai filter yang aktif (Excel · Cetak · PNG). */
  const dataEkspor = (): Ekspor<FlatRow> => ({
    judul: `Daily Report${filterDate ? ` ${filterDate}` : ''}`, menu: 'Daily Report', warna: ['#059669', '#047857'],
    baris: filteredRows,
    filter: [['Tanggal', filterDate], ['Anggota', filterUser ? (teamUsers.find(u => u.id === filterUser)?.full_name ?? filterUser) : ''], ['Cari', searchProject],
      ['Status', filterStatus], ['Sumber', filterSource], ['Kategori', filterCategory], ['Teknisi', filterHandler], ['Divisi', filterDivision], ['Produk', filterProduct]],
    kolom: [
      { judul: 'Tanggal', ambil: r => r.report_date }, { judul: 'Jam', ambil: r => r.jam },
      { judul: 'Kegiatan', ambil: r => r.kegiatan_label }, { judul: 'Kategori', ambil: r => r.category },
      { judul: 'Project', ambil: r => r.project_name }, { judul: 'Alamat', ambil: r => r.address }, { judul: 'Produk', ambil: r => r.product },
      { judul: 'Sales', ambil: r => r.sales_name }, { judul: 'Divisi', ambil: r => r.sales_division },
      { judul: 'Teknisi', ambil: r => r.handler_name || r.handler_username }, { judul: 'Status', ambil: r => r.status },
    ],
  });

  // Paginasi daftar - lihat components/shared/Paginasi.tsx.
  const hal = usePaginasi(filteredRows);

  const stats = useMemo(() => {
    const total = allRows.length;
    const pending = allRows.filter(r => ['pending', 'in progress', 'proses'].includes(r.status.toLowerCase())).length;
    const selesai = allRows.filter(r => ['done', 'completed', 'selesai', 'solved'].includes(r.status.toLowerCase())).length;
    const today = todayISO();
    const hariIni = allRows.filter(r => r.report_date === today).length;
    const fromTicket   = allRows.filter(r => r.source === 'ticket').length;
    const fromReminder = allRows.filter(r => r.source === 'reminder').length;
    const fromManual   = allRows.filter(r => r.source === 'manual').length;
    return { total, pending, selesai, hariIni, fromTicket, fromReminder, fromManual };
  }, [allRows]);

  /*
    M7 (docs/UX-WORKFLOW-AUDIT.md): dulu tidak ada cara melihat siapa yang
    BELUM mengisi report hari ini - allRows hanya merangkum aktivitas yang
    SUDAH ADA. Supervisor harus membandingkan manual dengan daftar tim di
    kepala. Dibandingkan di sini terhadap teamUsers (daftar anggota tim
    sesungguhnya), bukan disimpulkan dari data yang sudah ada.
  */
  const belumLaporHariIni = useMemo(() => {
    if (!lihatSemua || teamUsers.length === 0) return [];
    const today = todayISO();
    const sudahLapor = new Set(
      allRows.filter(r => r.report_date === today).map(r => (r.handler_username || '').toLowerCase())
    );
    return teamUsers.filter(u => u.username && !sudahLapor.has(u.username.toLowerCase()));
  }, [teamUsers, allRows, lihatSemua]);

  // Donut data
  const PIE_C = ['#7c3aed','#0ea5e9','#10b981','#e11d48','#f59e0b','#6366f1','#14b8a6','#f97316','#8b5cf6','#06b6d4','#ec4899','#84cc16'];

  const catPieData = useMemo(() => {
    const m = new Map<string, number>();
    allRows.forEach(r => m.set(r.category, (m.get(r.category) ?? 0) + 1));
    return Array.from(m.entries()).map(([label, value]) => ({ label, value, color: CATEGORY_CONFIG[label]?.accent ?? '#94a3b8' }));
  }, [allRows]);

  const handlerPieData = useMemo(() => {
    const m = new Map<string, number>();
    allRows.forEach(r => { const k = r.handler_name || r.handler_username; if (k) m.set(k, (m.get(k) ?? 0) + 1); });
    return Array.from(m.entries()).sort((a,b)=>b[1]-a[1]).map(([label, value], i) => ({ label, value, color: PIE_C[i % PIE_C.length] }));
  }, [allRows]);

  const divisionPieData = useMemo(() => {
    const m = new Map<string, number>();
    allRows.forEach(r => { if (r.sales_division) m.set(r.sales_division, (m.get(r.sales_division) ?? 0) + 1); });
    return Array.from(m.entries()).sort((a,b)=>b[1]-a[1]).map(([label, value], i) => ({ label, value, color: PIE_C[(i+3) % PIE_C.length] }));
  }, [allRows]);

  const productPieData = useMemo(() => {
    const m = new Map<string, number>();
    allRows.forEach(r => { if (r.product) m.set(r.product, (m.get(r.product) ?? 0) + 1); });
    return Array.from(m.entries()).sort((a,b)=>b[1]-a[1]).map(([label, value], i) => ({ label, value, color: PIE_C[(i+2) % PIE_C.length] }));
  }, [allRows]);
  return { allRows, filteredRows, dataEkspor, hal, stats, belumLaporHariIni, PIE_C, catPieData, handlerPieData, divisionPieData, productPieData };
}
