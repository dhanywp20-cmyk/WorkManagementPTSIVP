'use client';

/** useTurunanJadwal - dipecah dari app/(portal)/reminder-schedule/page.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import { kelompokkanReminder, pieKategori, pieDivisiSales, pieTeamPts, pieProduk } from './olah-data';
import { Status, Reminder, TeamUser, isDueToday } from './shared';
import { bolehDitugaskanOleh } from '@/lib/teams';
import { hasFullAccess } from '@/lib/constants';
import { isPimpinan } from '@/lib/pimpinan';

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
    // Sort by created_at desc (yang paling baru dibuat di atas)
    return (b.created_at || '').localeCompare(a.created_at || '');
  });

  // Group same-event reminders into one display row:
  // - reminder dengan batch_id sama (1 submission multi-tanggal) selalu digabung,
  //   berapa pun tanggalnya - supaya list tidak penuh oleh baris identik per hari.
  // - selain itu, tetap group by project/category/date/time (bulk-assign 1 hari).
  const groupedReminders = kelompokkanReminder(filteredReminders);

  const todayCount      = reminders.filter(r => isDueToday(r.due_date) && r.status !== 'done' && r.status !== 'cancelled').length;
  const pendingCount    = reminders.filter(r => r.status === 'pending').length;
  const doneCount       = reminders.filter(r => r.status === 'done').length;
  const totalCount      = reminders.length;

  // Pie chart data (hitungan murni: _components/olah-data.ts)

  const sourceReminders = filterYear === 'all' ? reminders : reminders.filter(r => r.due_date.startsWith(filterYear));

  const projectPieData = pieKategori(sourceReminders);
  const salesPieData = pieDivisiSales(sourceReminders);
  const teamPtsPieData = pieTeamPts(sourceReminders);
  const productPieData = pieProduk(sourceReminders);

  const isAdmin = ['admin', 'superadmin'].includes(currentUser?.role?.toLowerCase() ?? '');
  // Yang ditawarkan di dropdown assign: Manager hanya untuk Admin murni -
  // Team/Supervisor/bawahan tidak boleh meng-assign ke Manager.
  const teamUsersDitawarkan = teamUsers.filter(u => bolehDitugaskanOleh(u, isAdmin));
  // Manager PTS (mis. Dhany, role 'team') berhak approve & assign di tahap
  // admin_review - sama seperti admin. Terdeteksi dari salah satu:
  //   1. Toggle "Full Access" aktif (lib/constants.ts hasFullAccess) - cara
  //      yang disarankan sekarang, admin atur langsung per akun di Admin Panel.
  //   2. app_settings.manager_user_id (override lama, dipertahankan agar tidak
  //      merusak konfigurasi yang sudah ada).
  const isManager = !!currentUser?.id && (
    hasFullAccess(currentUser) ||
    (!!managerUserId && currentUser.id === managerUserId)
  );
  const canApproveAssign = isAdmin || isManager;
  // Sales Internal reviewer (utama atau kedua utk brand BOTH) di tahap internal_review.
  const isMyReviewStage = (r: Reminder) => r.routing_status === 'internal_review' &&
    (currentUser?.id === r.internal_sales_id || currentUser?.id === r.internal_sales_id_2);
  /*
    Boleh EDIT jadwal ini - kebijakan platform: setiap AKTOR yang sungguh
    bersinggungan dengan jadwal ini boleh membetulkan bagiannya sendiri;
    Admin & Full Access tanpa batas. Dua aktor:

      1. Sales/pembuat request (sales_name / created_by) - salah ketik data
         yang ia minta (nama project, catatan, alamat, dsb) harus bisa
         dibetulkan SENDIRI, bukan minta admin turun tangan atau ubah lewat
         Supabase langsung.
      2. Tim yang ditugaskan (assigned_to / assign_name) - mengisi update
         status/catatan pekerjaan yang ia kerjakan.

    Sebelumnya titik-titik ini (Re-Schedule, Resend Review, Update Status,
    dan tombol Edit Detail penuh) cuma memeriksa `role === 'team'` atau
    malah admin-only - SIAPA PUN anggota Team bisa menekan Re-Schedule
    jadwal orang lain, SEMENTARA pembuat request sendiri maupun tim yang
    mengerjakannya tidak bisa membetulkan salah ketiknya sendiri kalau bukan
    admin/Full Access - keduanya salah arah, dan itu sebab "salah assign
    harus lewat Supabase/admin" yang dikeluhkan.
  */
  const bolehEditReminder = (r: Reminder): boolean =>
    !isPimpinan(currentUser) && (isAdmin || isManager
    || (!!currentUser?.username && r.assigned_to === currentUser.username)
    || (!!currentUser?.full_name && r.assign_name === currentUser.full_name)
    || (!!currentUser?.full_name && r.sales_name === currentUser.full_name)
    || (!!currentUser?.username && r.created_by === currentUser.username));
  // Boleh approve kalau bagian-nya belum di-approve (reviewer utama vs kedua terpisah).
  const canInternalApprove = (r: Reminder) => {
    if (isPimpinan(currentUser)) return false;
    if (r.routing_status !== 'internal_review') return false;
    if (currentUser?.id === r.internal_sales_id && !r.internal_approved_at) return true;
    if (currentUser?.id === r.internal_sales_id_2 && !r.internal_approved_at_2) return true;
    return false;
  };
  // isAdmin, bukan role === 'admin': superadmin sebelumnya tidak bisa menambah
  // jadwal sama sekali karena tidak ikut disebut di sini.
  const canAddReminder = isAdmin || currentUser?.role === 'team';
  const isGuest = (currentUser?.role === 'guest' || currentUser?.role === 'sales') && !isPimpinan(currentUser);
  return { availableYears, filteredReminders, groupedReminders, todayCount, pendingCount, doneCount, totalCount, sourceReminders, projectPieData, salesPieData, teamPtsPieData, productPieData, isAdmin, teamUsersDitawarkan, isManager, canApproveAssign, isMyReviewStage, bolehEditReminder, canInternalApprove, canAddReminder, isGuest };
}
