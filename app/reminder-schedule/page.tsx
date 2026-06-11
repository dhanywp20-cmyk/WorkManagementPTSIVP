'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { setSession, clearSession, getSession, startSessionWatcher } from '@/lib/auth';
import { isAdmin as checkIsAdmin } from '@/lib/constants';
import { notifyReminderApproved } from '@/lib/notifications';
import { logAudit } from '@/lib/audit';

import {
  Priority, Status, RepeatType, Reminder, TeamUser, GuestUser,
  REVIEW_TRIGGER_CATEGORIES, PRIORITY_CONFIG, STATUS_CONFIG, CATEGORIES, CATEGORY_CONFIG,
  REPEAT_OPTIONS, SALES_DIVISIONS, PIE_COLORS,
  formatDate, formatDatetime, isDueToday,
  getFonnteToken, sendFonnteWA,
} from './_components/shared';
import { PriorityBadge, StatusBadge, CategoryBadge } from './_components/Badges';
import {
  FormField, SectionHeader, SectionHeaderSmall, InfoRow,
  LoadingScreen, MiniPieChart, PageHeader,
  ViewIconBtn, RescheduleIconBtn, ApproveIconBtn, DeleteIconBtn, ActionGroup,
} from '@/components/shared';
import { MiniCalendar } from './_components/MiniCalendar';
import { RescheduleModal } from './_components/RescheduleModal';
import { RequestJadwalModal, type JadwalRequest } from './_components/RequestJadwalModal';
import { ReminderFormModal, type ReminderForm } from './_components/ReminderFormModal';


function ReminderSchedulePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [appReady, setAppReady]             = useState(false);
  const [dashLoading, setDashLoading]       = useState(false);
  const [loginTime, setLoginTime]           = useState<number | null>(null);
  const [showNotificationPopup, setShowNotificationPopup] = useState(false);
  const [showBellPopup, setShowBellPopup]   = useState(false);
  const [myReminders, setMyReminders]       = useState<Reminder[]>([]);
  const [currentUser, setCurrentUser]       = useState<TeamUser | null>(null);
  const [teamUsers, setTeamUsers]           = useState<TeamUser[]>([]);
  const [guestUsers, setGuestUsers]         = useState<GuestUser[]>([]);
  const [reminders, setReminders]           = useState<Reminder[]>([]);
  const [listLoading, setListLoading]       = useState(false);
  const [saving, setSaving]                 = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<Reminder | null>(null);

  const [view, setView]                     = useState<'list' | 'form'>('list');
  const [showFormModal, setShowFormModal]   = useState(false);
  const [detailReminder, setDetailReminder] = useState<Reminder | null>(null);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);

  // Filters — extended with team handler & category
  const [filterStatus, setFilterStatus]     = useState<Status | 'all'>('all');
  const [filterYear, setFilterYear]         = useState<string>('all');
  const [searchProject, setSearchProject]   = useState('');
  const [searchSales, setSearchSales]       = useState('');

  // ── Auto-apply filter dari Global Search (?q=...) ──
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearchProject(q);
  }, [searchParams]);
  const [searchDivisionSales, setSearchDivisionSales]       = useState('');
  const [searchTeamHandler, setSearchTeamHandler] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchProduct, setSearchProduct] = useState('');
  const [productFilter, setProductFilter] = useState<string | null>(null);

  const [calendarMonth, setCalendarMonth]   = useState(new Date());
  const [toast, setToast]                   = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [selectedCalDay, setSelectedCalDay] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  // Kalender-only selection — tidak mempengaruhi filter list/chart/summary
  const [calOnlyDay, setCalOnlyDay]         = useState<string | null>(null);
  const [sendingWA, setSendingWA]           = useState<string | null>(null);

  // ─── Delete Modal State ───────────────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget]       = useState<Reminder | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // ─── Update Status with photo ──────────────────────────────────────────────
  const [pendingStatus, setPendingStatus]   = useState<Status | null>(null);
  const [statusPhoto, setStatusPhoto]       = useState<File | null>(null);
  const [statusPhotoPreview, setStatusPhotoPreview] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const statusPhotoRef = useRef<HTMLInputElement>(null);

  // ─── Resend Form Review ────────────────────────────────────────────────────
  const [resendingFormReview, setResendingFormReview] = useState(false);

  // ─── Guest Request Jadwal State ───────────────────────────────────────────
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);

  // ─── Approve & Assign State (admin only) ─────────────────────────────────
  const [approveTarget, setApproveTarget] = useState<Reminder | null>(null);
  const [approveAssignTo, setApproveAssignTo] = useState('');
  const [approveDate, setApproveDate] = useState('');
  const [approveTime, setApproveTime] = useState('');
  const [approveSaving, setApproveSaving] = useState(false);

  const notify = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const emptyForm: Omit<Reminder, 'id' | 'created_at' | 'created_by' | 'wa_sent_h1'> = {
    project_name: '', description: '', assigned_to: '', assign_name: '',
    due_date: new Date().toISOString().split('T')[0],
    due_time: '09:00', priority: 'medium', status: 'pending',
    repeat: 'none', category: 'Demo Product',
    sales_name: '', sales_division: '', address: '', pic_name: '', pic_phone: '',
    notes: '', product: '', warranty_years: null,
  };
  const [formData, setFormData] = useState(emptyForm);
  const fd = (patch: Partial<typeof emptyForm>) => setFormData(prev => ({ ...prev, ...patch }));

  // ─── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const user = getSession<TeamUser>();
    if (!user) {
      const target = window.top !== window ? window.top : window;
      if (target) target.location.href = '/dashboard';
      return;
    }
    setCurrentUser(user);
    setLoginTime(Date.now());

    // Fetch parallel — tidak tunggu satu selesai dulu
    Promise.all([
      fetchTeamUsers(),
      fetchGuestUsers(),
      fetchRemindersQuiet(user),
    ]).then(() => {
      setAppReady(true); // ← tampilkan konten setelah data siap
      // Popup notif setelah data loaded
      if (user && (user.role === 'team' || user.role === 'admin')) {
        supabase
          .from('reminders')
          .select('*')
          .eq('assigned_to', user.username)
          .neq('status', 'done')
          .neq('status', 'cancelled')
          .order('due_date', { ascending: true })
          .then(({ data: activeData }: { data: any[] | null }) => {
            const active = (activeData ?? []) as Reminder[];
            if (active.length > 0) {
              setMyReminders(active);
              setTimeout(() => setShowNotificationPopup(true), 800);
            }
          });
      }
    });

    // Realtime — subscribe setelah user di-set
    const ch = supabase.channel('reminders-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reminders' }, () => {
        const u = getSession<TeamUser>() ?? user;
        fetchRemindersQuiet(u);
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, []);

  // ─── Session timeout check ───────────────────────────────────────────────
  useEffect(() => {
    const checkSession = () => {
      const valid = getSession();
      if (!valid) {
        clearSession();
        const target = window.top !== window ? window.top : window;
        if (target) target.location.href = '/dashboard';
      }
    };
    checkSession();
    const interval = setInterval(checkSession, 60000);
    return () => clearInterval(interval);
  }, []);

  // ─── H-1 WA auto-send ────────────────────────────────────────────────────
  // Ditangani oleh Supabase Edge Function: daily-reminder (pg_cron)
  // Berjalan otomatis setiap hari tanpa perlu buka halaman

  const fetchTeamUsers = async () => {
    const { data } = await supabase.from('users').select('id, username, full_name, role, team_type, phone_number, sales_division, allowed_menus').order('full_name');
    if (data) setTeamUsers(data.filter((u: TeamUser) => u.team_type === 'Team PTS'));
  };

  const fetchGuestUsers = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, username, full_name, role, phone_number, sales_division')
      .eq('role', 'guest')
      .order('full_name');
    if (data) setGuestUsers(data as GuestUser[]);
  };

  // 🔥 PERUBAHAN UTAMA: Urutkan berdasarkan created_at terbaru di paling atas
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Hapus ${selectedIds.size} jadwal yang dipilih?`)) return;
    setBulkDeleting(true);
    const { error } = await supabase.from('service_reminders').delete().in('id', Array.from(selectedIds));
    if (!error) { setReminders(p => p.filter(r => !selectedIds.has(r.id))); setSelectedIds(new Set()); }
    else notify('error', 'Gagal: ' + error.message);
    setBulkDeleting(false);
  };

  const toggleSelectId = (id: string) => setSelectedIds(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const toggleSelectAll = () => setSelectedIds(prev =>
    prev.size === filteredReminders.length ? new Set() : new Set(filteredReminders.map(r => r.id))
  );

  // Helper: fetch reminders dengan filter guest — ambil yg sales_name = full_name ATAU created_by = username
  const fetchRemindersForUser = async (activeUser: TeamUser | null): Promise<Reminder[]> => {
    if (!activeUser || activeUser.role !== 'guest') {
      // Admin & team: ambil semua
      const { data, error } = await supabase.from('reminders').select('*').order('created_at', { ascending: false });
      return (!error && data) ? (data as Reminder[]) : [];
    }
    // Guest: ambil schedule yg atas nama dia (dibuat admin) + yg dia request sendiri (created_by)
    const [bySales, byCreator] = await Promise.all([
      supabase.from('reminders').select('*').eq('sales_name', activeUser.full_name).order('created_at', { ascending: false }),
      supabase.from('reminders').select('*').eq('created_by', activeUser.username).order('created_at', { ascending: false }),
    ]);
    const combined = [...(bySales.data ?? []), ...(byCreator.data ?? [])];
    // Deduplicate by id, sort by created_at desc
    const seen = new Set<string>();
    return (combined as Reminder[])
      .filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; })
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  };

  const fetchRemindersQuiet = async (user?: TeamUser | null) => {
    let activeUser: TeamUser | null = user ?? currentUser;
    if (!activeUser) activeUser = getSession<TeamUser>();
    const data = await fetchRemindersForUser(activeUser);
    setReminders(data);
  };

  const fetchReminders = async () => {
    setListLoading(true);
    let activeUser: TeamUser | null = currentUser;
    if (!activeUser) activeUser = getSession<TeamUser>();
    const data = await fetchRemindersForUser(activeUser);
    setReminders(data);
    setTimeout(() => setListLoading(false), 400);
  };

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!formData.project_name.trim())            { notify('error', 'Nama project wajib diisi!');  return; }
    if (!formData.assigned_to)             { notify('error', 'Pilih anggota team!');           return; }
    if (!formData.due_date)                { notify('error', 'Tanggal wajib diisi!');          return; }
    if (!formData.address.trim()) { notify('error', 'Lokasi Project wajib diisi!');  return; }

    const isTriggerCat = (REVIEW_TRIGGER_CATEGORIES as readonly string[]).includes(formData.category);
    if (!formData.sales_name?.trim()) {
      notify('error', 'Pilih Sales wajib diisi!');
      return;
    }
    if (isTriggerCat && !formData.sales_name?.trim()) {
      notify('error', `Kategori "${formData.category}" memerlukan pilihan Guest / Sales untuk form review!`);
      return;
    }

    const assignee = teamUsers.find(u => u.username === formData.assigned_to);
    const payload = { ...formData, assign_name: assignee?.full_name ?? formData.assigned_to, created_by: currentUser?.username ?? 'system', ...(editingReminder ? { updated_at: new Date().toISOString() } : {}) };

    setSaving(true);
    const { error } = editingReminder
      ? await supabase.from('reminders').update(payload).eq('id', editingReminder.id)
      : await supabase.from('reminders').insert([payload]);

    if (error) {
      notify('error', 'Gagal menyimpan: ' + error.message);
      setSaving(false);
      return;
    }

    notify('success', editingReminder ? 'Reminder diperbarui!' : 'Reminder ditambahkan!');

    // ── Kirim WA notifikasi ke assignee saat reminder BARU dibuat ────────────
    if (!editingReminder && assignee?.phone_number) {
      const assigneeName = assignee.full_name ?? formData.assigned_to;
      const createdBy = currentUser?.username ?? 'system';
      const msg =
        `🗓️ *JADWAL BARU — PTS IVP*\n\n` +
        `Halo *${assigneeName}*, kamu mendapat jadwal baru:\n\n` +
        `*Nama Project: ${formData.project_name}*\n` +
        `*Deskripsi: ${formData.description}*\n` +
        `📦 *Product: ${formData.product}*\n` +
        `🏷️ Kategori: ${formData.category}\n` +
        `📍 Lokasi: ${formData.address || '-'}\n` +
        `👤 Sales: ${formData.sales_name}${formData.sales_division ? ' - ' + formData.sales_division : ''}\n` +
        `🕐 Jadwal: *${formatDate(formData.due_date)}${formData.due_time ? ' · ' + formData.due_time : ''}*\n` +
        (formData.pic_name  ? `🙋 PIC: ${formData.pic_name}${formData.pic_phone ? ' - ' + formData.pic_phone : ''}\n\n`    : '') +
        (formData.notes     ? `📝 Catatan: ${formData.notes}\n\n`    : '') +
        `-\n` +
       `Link Dashboard: https://work-management-ptsivp.vercel.app/dashboard\n` +
        `jangan lupa peralatan & Semangat💪🏼`;

      const waResult = await sendFonnteWA(assignee.phone_number, msg, { reminderType: 'new_schedule' });
      if (waResult.ok) notify('success', `WA notifikasi terkirim ke ${assigneeName}!`);
    }
    // ─────────────────────────────────────────────────────────────────────────

    setSaving(false);
    setShowFormModal(false);
    setView('list');
    setEditingReminder(null);
    setFormData(emptyForm);
    fetchRemindersQuiet();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('reminders').delete().eq('id', deleteTarget.id);
    if (error) { notify('error', 'Gagal menghapus.'); return; }
    notify('success', 'Reminder dihapus.');
    setDetailReminder(null);
    setShowDeleteModal(false);
    setDeleteTarget(null);
    setDeleteConfirmText('');
    fetchRemindersQuiet();
  };

  const openDeleteModal = (r: Reminder) => {
    setDeleteTarget(r);
    setDeleteConfirmText('');
    setShowDeleteModal(true);
  };

  const handleStatusChange = async (id: string, status: Status, photoUrl?: string) => {
    const updatePayload: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (photoUrl) updatePayload['completion_photo_url'] = photoUrl;
    const { error } = await supabase.from('reminders').update(updatePayload).eq('id', id);
    if (error) { notify('error', 'Gagal update status.'); return; }
    notify('success', 'Status diperbarui!');
    // ── WA ke handler saat status Done ───────────────────────────────────
    if (status === 'done') {
      try {
        const reminder = reminders.find(r => r.id === id);
        if (reminder) {
          const { data: handlerUser } = await supabase
            .from('users').select('phone_number, full_name')
            .eq('username', reminder.assigned_to)
            .eq('team_type', 'Team PTS').single();
          if (handlerUser?.phone_number) {
            const msg =
              `✅ *JADWAL SELESAI — PTS IVP*\n\n` +
              `Terima kasih *${handlerUser.full_name}*!\n` +
              `Jadwal *${reminder.project_name}* sudah *Selesai*.\n` +
              `📦 *Product: ${reminder.product ?? '-'}*\n` +
              `🏷️ ${reminder.category} · ${formatDate(reminder.due_date)}\n` +
              `\nTetap semangat! 💪`;
            await sendFonnteWA(handlerUser.phone_number, msg);
          }

          // ── Auto-insert ke form_reviews jika kategori trigger & ada sales_name ──
          const isTriggerCategory = (REVIEW_TRIGGER_CATEGORIES as readonly string[]).includes(reminder.category);
          const salesName = reminder.sales_name?.trim();
          if (isTriggerCategory && salesName) {
            try {
              // Selalu fetch guest dari DB (tidak andalkan state guestUsers yang bisa saja belum terisi)
              const { data: guestFromDb } = await supabase
                .from('users')
                .select('id, username, full_name, role, phone_number, sales_division')
                .eq('role', 'guest')
                .eq('full_name', salesName)
                .maybeSingle();

              // Fallback ke guestUsers state jika DB tidak return
              const resolvedGuest = guestFromDb ?? guestUsers.find(g => g.full_name === salesName) ?? null;

              // Cek apakah sudah ada form_review untuk reminder ini
              const { data: existingReview } = await supabase
                .from('form_reviews')
                .select('id')
                .eq('reminder_id', reminder.id)
                .eq('sales_name', salesName)
                .maybeSingle();

              if (!existingReview) {
                const reviewCategory = reminder.category === 'Demo Product' ? 'Demo Product' : 'BAST';
                const productValue = reminder.product?.trim() || '';
                const { error: reviewErr } = await supabase.from('form_reviews').insert([{
                  reminder_id: reminder.id,
                  project_name: reminder.project_name,
                  address: reminder.address || '',
                  sales_name: salesName,
                  sales_division: reminder.sales_division || '',
                  assign_name: reminder.assign_name,
                  assigned_to: reminder.assigned_to,
                  reminder_category: reminder.category,
                  review_category: reviewCategory,
                  // Auto-insert product ke kolom yang sesuai berdasarkan review_category
                  ...(reviewCategory === 'Demo Product'
                    ? { product_demo: productValue }
                    : { product_bast: productValue }),
                  // guest_fullname = full_name Guest (= sales_name), wajib NOT NULL
                  guest_fullname: resolvedGuest?.full_name ?? salesName,
                  // guest_username untuk filter di Form Review page
                  guest_username: resolvedGuest?.username ?? '',
                }]);

                if (!reviewErr) {
                  notify('success', `Form review otomatis dibuat untuk ${salesName}!`);

                  // Kirim WA notifikasi ke guest
                  if (resolvedGuest?.phone_number) {
                    const guestMsg =
                      `⭐ *REVIEW DIMINTA — PTS IVP*\n\n` +
                      `Halo *${resolvedGuest.full_name}*!\n\n` +
                      `Jadwal *${reminder.category}* untuk project:\n` +
                      `*Kategori: ${reminder.category}*\n` +
                      `*Team kami: ${reminder.assign_name}*\n` +
                      `📦 *Product: ${reminder.product ?? '-'}*\n` +
                      `📋 *${reminder.project_name}*\n` +
                      `📍 ${reminder.address || '-'}\n\n` +
                      `telah selesai dilaksanakan oleh tim kami.\n\n` +
                      `Mohon berikan penilaian / review Anda melalui dashboard:\n` +
                      `🔗 https://work-management-ptsivp.vercel.app/dashboard\n\n` +
                      `Terima kasih! 🙏`;
                    await sendFonnteWA(resolvedGuest.phone_number, guestMsg);
                  }
                }
              }
            } catch { }
          }
        }
      } catch { }
    }
    // ─────────────────────────────────────────────────────────────────────
    fetchRemindersQuiet();
    if (detailReminder?.id === id) setDetailReminder(prev => prev ? { ...prev, status } : null);
  };

  const handleConfirmStatusUpdate = async () => {
    if (!detailReminder || !pendingStatus) return;
    if (pendingStatus === 'done' && !statusPhoto) {
      notify('error', 'Foto wajib diupload untuk status Completed!');
      return;
    }
    setUpdatingStatus(true);
    let photoUrl: string | undefined;
    if (statusPhoto) {
      const ext = statusPhoto.name.split('.').pop();
      const fileName = `completion_${detailReminder.id}_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('reminder-photos')
        .upload(fileName, statusPhoto, { upsert: true });
      if (upErr) {
        notify('error', 'Gagal upload foto: ' + upErr.message);
        setUpdatingStatus(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('reminder-photos').getPublicUrl(fileName);
      photoUrl = urlData?.publicUrl;
    }
    await handleStatusChange(detailReminder.id, pendingStatus, photoUrl);
    setPendingStatus(null);
    setStatusPhoto(null);
    setStatusPhotoPreview(null);
    setUpdatingStatus(false);
  };

  // ─── Resend / Manual Send Form Review ke Guest ────────────────────────────
  const handleResendFormReview = async (r: Reminder) => {
    if (!r.sales_name?.trim()) {
      notify('error', 'Reminder ini tidak memiliki Sales yang terpilih!');
      return;
    }
    const isTrigger = (REVIEW_TRIGGER_CATEGORIES as readonly string[]).includes(r.category);
    if (!isTrigger) {
      notify('error', `Kategori "${r.category}" tidak memerlukan form review.`);
      return;
    }
    if (r.status !== 'done') {
      notify('error', 'Status reminder harus Completed untuk mengirim form review!');
      return;
    }

    setResendingFormReview(true);
    try {
      const salesName = r.sales_name.trim();

      // Selalu fetch guest terbaru dari DB berdasarkan full_name === sales_name
      const { data: guestFromDb } = await supabase
        .from('users')
        .select('id, username, full_name, role, phone_number, sales_division')
        .eq('role', 'guest')
        .eq('full_name', salesName)
        .maybeSingle();

      const resolvedGuest = guestFromDb ?? guestUsers.find(g => g.full_name === salesName) ?? null;

      if (!resolvedGuest) {
        notify('error', `Guest dengan nama "${salesName}" tidak ditemukan di database!`);
        setResendingFormReview(false);
        return;
      }

      // Cek apakah form_review sudah ada
      const { data: existingReview } = await supabase
        .from('form_reviews')
        .select('id, guest_username')
        .eq('reminder_id', r.id)
        .eq('sales_name', salesName)
        .maybeSingle();

      if (existingReview) {
        // Patch guest_username jika masih kosong (data lama)
        if (!existingReview.guest_username && resolvedGuest.username) {
          await supabase.from('form_reviews')
            .update({ guest_username: resolvedGuest.username })
            .eq('id', existingReview.id);
        }
        // Form sudah ada — hanya kirim ulang WA
      } else {
        // Buat form_review baru
        const reviewCategory = r.category === 'Demo Product' ? 'Demo Product' : 'BAST';
        const productValue = r.product?.trim() || '';
        const { error: reviewErr } = await supabase.from('form_reviews').insert([{
          reminder_id: r.id,
          project_name: r.project_name,
          address: r.address || '',
          sales_name: salesName,
          sales_division: r.sales_division || '',
          assign_name: r.assign_name,
          assigned_to: r.assigned_to,
          reminder_category: r.category,
          review_category: reviewCategory,
          // Auto-insert product ke kolom yang sesuai berdasarkan review_category
          ...(reviewCategory === 'Demo Product'
            ? { product_demo: productValue }
            : { product_bast: productValue }),
          // guest_fullname = full_name Guest (= sales_name), wajib NOT NULL
          guest_fullname: resolvedGuest.full_name ?? salesName,
          // guest_username untuk filter di Form Review page
          guest_username: resolvedGuest.username,
        }]);
        if (reviewErr) {
          notify('error', 'Gagal membuat form review: ' + reviewErr.message);
          setResendingFormReview(false);
          return;
        }
      }

      // Kirim / kirim ulang WA notif ke Guest
      if (resolvedGuest.phone_number) {
        const guestMsg =
          `⭐ *FORM REVIEW — PTS IVP*\n\n` +
          `Halo *${resolvedGuest.full_name}*!\n\n` +
          `Jadwal *${r.category}* untuk project:\n` +
          `*Kategori: ${r.category}*\n` +
          `*Team kami: ${r.assign_name}*\n` +
          `📋 *${r.project_name}*\n` +
          `📦 *Product: ${r.product ?? '-'}*\n` +
          `📍 ${r.address || '-'}\n\n` +
          (r.notes ? `📝 Catatan: ${r.notes}\n` : '') +
          `telah selesai dilaksanakan oleh tim kami.\n\n` +
          `Mohon berikan penilaian / review Anda melalui dashboard:\n` +
          `🔗 https://work-management-ptsivp.vercel.app/dashboard\n\n` +
          `Terima kasih! 🙏`;
        const waResult = await sendFonnteWA(resolvedGuest.phone_number, guestMsg);
        if (waResult.ok) notify('success', `Form review & WA berhasil dikirim ke ${resolvedGuest.full_name}!`);
        else notify('success', `Form review OK. WA gagal: ${waResult.reason ?? 'unknown'}`);
      } else {
        notify('success', `Form review dibuat untuk ${resolvedGuest.full_name}. (Nomor WA tidak ada)`);
      }
    } catch (ex: any) {
      notify('error', 'Terjadi kesalahan: ' + ex.message);
    }
    setResendingFormReview(false);
  };

  const openEdit = (r: Reminder) => {
    setEditingReminder(r);
    setFormData({ project_name: r.project_name || (r as any).title || '', description: r.description, assigned_to: r.assigned_to, assign_name: r.assign_name ?? '', due_date: r.due_date,
      due_time: r.due_time, priority: r.priority, status: r.status, repeat: r.repeat, category: r.category,
      sales_name: r.sales_name ?? '', sales_division: r.sales_division ?? '', address: r.address ?? '',
      pic_name: r.pic_name ?? '', pic_phone: r.pic_phone ?? '', notes: r.notes ?? '', product: r.product ?? '' });
    setDetailReminder(null);
    setShowFormModal(true);
  };

  // ─── Re-Schedule ───────────────────────────────────────────────────────────

  const handleReschedule = async (newDate: string, newTime: string, reason: string) => {
    if (!rescheduleTarget) return;
    const noteAdd = reason ? `\n[Re-Schedule ${formatDate(newDate)}: ${reason}]` : '';
    const { error } = await supabase.from('reminders').update({
      due_date: newDate,
      due_time: newTime,
      updated_at: new Date().toISOString(),
      notes: (rescheduleTarget.notes ?? '') + noteAdd,
    }).eq('id', rescheduleTarget.id);
    if (error) {
      notify('error', `Gagal re-schedule: ${error.message}`);
      return;
    }
    notify('success', `Jadwal berhasil dipindah ke ${formatDate(newDate)}!`);
    // ── WA ke handler tentang reschedule ──────────────────────────────────
    try {
      const { data: handlerUser } = await supabase
        .from('users').select('phone_number, full_name')
        .eq('username', rescheduleTarget.assigned_to)
        .eq('team_type', 'Team PTS').single();
      if (handlerUser?.phone_number) {
        const msg =
          `📅 *JADWAL DIUBAH — PTS IVP*\n\n` +
          `Halo *${handlerUser.full_name}*, jadwal kamu telah di-reschedule:\n\n` +
          `*Project: ${rescheduleTarget.project_name}*\n` +
          `*Kategori: ${rescheduleTarget.category}*\n` +
          `📦 *Product: ${rescheduleTarget.product ?? '-'}*\n` +
          `📌 Jadwal Lama: ${formatDate(rescheduleTarget.due_date)} ${rescheduleTarget.due_time}\n` +
          `📅 Jadwal Baru: *${formatDate(newDate)} ${newTime}*\n` +
          (rescheduleTarget.pic_name ? `🙋 PIC: ${rescheduleTarget.pic_name}\n` : '') +
          (rescheduleTarget.pic_phone ? `📱 No. PIC: ${rescheduleTarget.pic_phone}\n` : '') +
          (rescheduleTarget.notes ? `📝 Catatan: ${rescheduleTarget.notes}\n` : '') +
          (reason ? `📝 Alasan: ${reason}\n` : '') +
          `\n🔗 https://work-management-ptsivp.vercel.app/dashboard`;
        await sendFonnteWA(handlerUser.phone_number, msg);
      }
    } catch { }
    // ─────────────────────────────────────────────────────────────────────
    setRescheduleTarget(null);
    setDetailReminder(null);
    fetchRemindersQuiet();
  };

  // ─── Manual WA send ────────────────────────────────────────────────────────

  const handleSendWA = async (r: Reminder) => {
    if (!r.assigned_to) { notify('error', 'Reminder belum di-assign ke handler.'); return; }
    setSendingWA(r.id);

    // Ambil phone_number handler dari tabel users
    const { data: handlerData, error: handlerErr } = await supabase
      .from('users')
      .select('phone_number, full_name')
      .eq('username', r.assigned_to)
      .eq('team_type', 'Team PTS')
      .single();

    if (handlerErr || !handlerData?.phone_number) {
      setSendingWA(null);
      notify('error', `Nomor WA handler (${r.assign_name || r.assigned_to}) tidak tersedia di database.`);
      return;
    }

    const msg =
      `📋 *REMINDER JADWAL PTS IVP*\n\n` +
      `Halo *${handlerData.full_name}*, ada jadwal yang perlu kamu kerjakan:\n\n` +
      `*Nama Project: ${r.project_name}*\n` +
      `*Deskripsi: ${r.description}*\n` +
      `*Kategori: ${r.category}*\n` +
      `📦 *Product: ${r.product ?? '-'}*\n` +
      `📍 Lokasi: ${r.address || '-'}\n` +
      `👤 Sales: ${r.sales_name || '-'}\n` +
      `    Divisi Sales: ${r.sales_division || '-'}\n` +
      `🕐 Jadwal: *${formatDate(r.due_date)} · ${r.due_time}*\n` +
      (r.pic_name ? `🙋 PIC: ${r.pic_name}\n` : '') +
      (r.pic_phone ? `📱 No. PIC: ${r.pic_phone}\n` : '') +
      (r.notes ? `📝 Catatan: ${r.notes}\n` : '') +
      `\n_Pesan dari Reminder Schedule PTS IVP_`;

    const result = await sendFonnteWA(handlerData.phone_number, msg, { reminderType: 'manual', reminderId: r.id });
    setSendingWA(null);
    if (result.ok) notify('success', `WA berhasil dikirim ke ${handlerData.full_name}!`);
    else notify('error', `Gagal kirim WA: ${result.reason ?? 'Unknown error'}`);
  };

  // ─── Export Excel ──────────────────────────────────────────────────────────

  const handleExportExcel = () => {
    const runExport = (XLSX: any) => {
      const exportDate = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
      const border = { top:{style:'thin',color:{rgb:'E2E8F0'}},bottom:{style:'thin',color:{rgb:'E2E8F0'}},left:{style:'thin',color:{rgb:'E2E8F0'}},right:{style:'thin',color:{rgb:'E2E8F0'}} };
      const boldBorder = { top:{style:'thin',color:{rgb:'000000'}},bottom:{style:'thin',color:{rgb:'000000'}},left:{style:'thin',color:{rgb:'000000'}},right:{style:'thin',color:{rgb:'000000'}} };
      const hdr = { font:{name:'Arial',bold:true,sz:10,color:{rgb:'FFFFFF'}}, fill:{fgColor:{rgb:'0E7490'},patternType:'solid'}, alignment:{horizontal:'center',vertical:'center',wrapText:true}, border: boldBorder };
      const cell = (v: any) => ({ v: v ?? '', t: 's', s: { font:{name:'Arial',sz:10}, alignment:{vertical:'center',wrapText:true}, border } });
      const titleStyle = { font:{name:'Arial',bold:true,sz:14,color:{rgb:'0E7490'}}, alignment:{horizontal:'left',vertical:'center'} };
      const COLS = 14;
      const data: any[][] = [
        [{ v:'\uD83D\uDDD3\uFE0F REMINDER SCHEDULE \u2014 PTS IVP', t:'s', s:titleStyle }, ...Array(COLS-1).fill({v:'',t:'s',s:{}})],
        [{ v:`Tanggal Export: ${exportDate} | Total: ${filteredReminders.length} data`, t:'s', s:{font:{name:'Arial',sz:10,color:{rgb:'6B7280'}}} }, ...Array(COLS-1).fill({v:'',t:'s',s:{}})],
        Array(COLS).fill({v:'',t:'s',s:{}}),
        ['No','Project','Product','Kategori','Sales','Divisi','Assign To','Status','Prioritas','Tanggal','Waktu','PIC','Telepon PIC','Catatan'].map(h=>({v:h,t:'s',s:hdr})),
        ...filteredReminders.map((r,i) => {
          const status = STATUS_CONFIG[r.status];
          const statusCell = { v: status.label, t:'s', s:{ font:{name:'Arial',sz:10,bold:true}, fill:{fgColor:{rgb: r.status==='done'?'DCFCE7':r.status==='cancelled'?'F3F4F6':'FEF3C7'},patternType:'solid'}, alignment:{horizontal:'center',vertical:'center'}, border } };
          return [
            {v:i+1, t:'n', s:{font:{name:'Arial',sz:10},alignment:{horizontal:'center',vertical:'center'},border}},
            cell(r.project_name), cell(r.product), cell(r.category),
            cell(r.sales_name), cell(r.sales_division), cell(r.assign_name),
            statusCell,
            cell(PRIORITY_CONFIG[r.priority].label),
            cell(r.due_date), cell(r.due_time ?? '-'), cell(r.pic_name ?? '-'),
            cell(r.pic_phone ?? '-'), cell(r.notes ?? '-'),
          ];
        }),
      ];
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!merges'] = [{ s:{r:0,c:0}, e:{r:0,c:COLS-1} }, { s:{r:1,c:0}, e:{r:1,c:COLS-1} }];
      ws['!cols'] = [5,28,18,16,20,12,20,14,12,12,10,20,16,30].map(w=>({wch:w}));
      ws['!rows'] = [{hpt:28},{hpt:16},{hpt:6},{hpt:26}];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '\uD83D\uDDD3\uFE0F Reminder Schedule');
      XLSX.writeFile(wb, `ReminderSchedule_PTS_${new Date().toISOString().split('T')[0]}.xlsx`, { bookType:'xlsx', type:'binary', cellStyles:true });
      notify('success', 'Export Excel berhasil!');
    };
    if ((window as any).XLSX) runExport((window as any).XLSX);
    else {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = () => runExport((window as any).XLSX);
      s.onerror = () => notify('error', 'Gagal memuat library Excel.');
      document.head.appendChild(s);
    }
  };

  // ─── Filters ───────────────────────────────────────────────────────────────

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

  const todayCount      = reminders.filter(r => isDueToday(r.due_date) && r.status !== 'done' && r.status !== 'cancelled').length;
  const pendingCount    = reminders.filter(r => r.status === 'pending').length;
  const doneCount       = reminders.filter(r => r.status === 'done').length;
  const totalCount      = reminders.length;

  // ─── Pie chart data ────────────────────────────────────────────────────────

  const sourceReminders = filterYear === 'all' ? reminders : reminders.filter(r => r.due_date.startsWith(filterYear));

  const projectPieData = (() => {
    const map: Record<string, number> = {};
    sourceReminders.forEach(r => { const k = r.category; map[k] = (map[k] || 0) + 1; });
    return Object.entries(map).map(([label, value], i) => ({ label, value, color: PIE_COLORS[i % PIE_COLORS.length] }));
  })();

  const salesPieData = (() => {
    const map: Record<string, number> = {};
    sourceReminders.forEach(r => { if (r.sales_division) { map[r.sales_division] = (map[r.sales_division] || 0) + 1; } });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([label, value], i) => ({ label, value, color: PIE_COLORS[i % PIE_COLORS.length] }));
  })();

  const teamPtsPieData = (() => {
    const map: Record<string, number> = {};
    sourceReminders.forEach(r => { if (r.assign_name) { map[r.assign_name] = (map[r.assign_name] || 0) + 1; } });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([label, value], i) => ({ label, value, color: PIE_COLORS[i % PIE_COLORS.length] }));
  })();

  const productPieData = (() => {
    const map: Record<string, number> = {};
    sourceReminders.forEach(r => { if (r.product) { map[r.product] = (map[r.product] || 0) + 1; } });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([label, value], i) => ({ label, value, color: PIE_COLORS[i % PIE_COLORS.length] }));
  })();

  const isAdmin = ['admin', 'superadmin'].includes(currentUser?.role?.toLowerCase() ?? '');
  const canAddReminder = currentUser?.role === 'admin' || currentUser?.role === 'team';
  const isGuest = currentUser?.role === 'guest' || currentUser?.role === 'sales';

  // ─── Cek Form Review menggantung (guest/sales) ────────────────────────────
  useEffect(() => {
    if (!isGuest || !currentUser?.full_name) return;
    const checkPendingReviews = async () => {
      const { data } = await supabase
        .from('form_reviews')
        .select('id, grade_product_knowledge, grade_product_knowledge_bast, grade_training_customer')
        .eq('sales_name', currentUser.full_name);
      const pending = (data ?? []).filter((r: any) =>
        !r.grade_product_knowledge && !r.grade_product_knowledge_bast && !r.grade_training_customer
      );
      setPendingReviewCount(pending.length);
    };
    checkPendingReviews();
  }, [isGuest, currentUser?.full_name]);

  // ─── Handler: Guest Request Jadwal ────────────────────────────────────────
  const handleRequestJadwal = async (data: JadwalRequest) => {
    if (!currentUser) return;

    // Selalu fetch sales_division terbaru dari DB untuk menghindari data stale di localStorage
    // Ambil dari data modal dulu (paling fresh), lalu currentUser, lalu fetch DB
    let salesDivision = (data as any).sales_division || currentUser.sales_division || '';
    if (!salesDivision) {
      try {
        const { data: freshUser } = await supabase
          .from('users')
          .select('sales_division')
          .eq('id', currentUser.id)
          .single();
        if (freshUser?.sales_division) {
          salesDivision = freshUser.sales_division;
          // Update currentUser di state & localStorage agar sinkron
          const updatedUser = { ...currentUser, sales_division: salesDivision };
          setCurrentUser(updatedUser);
          setSession(updatedUser);
        }
      } catch { /* gunakan nilai kosong jika gagal */ }
    }

    // Insert ke tabel reminders dengan status pending & assigned_to kosong
    // Admin nantinya assign ke team dari list yang ada
    const payload = {
      project_name: data.project_name,
      description: data.description,
      address: data.address,
      category: data.category,
      due_date: data.due_date,
      due_time: data.due_time,
      sales_name: currentUser.full_name,
      sales_division: salesDivision,
      pic_name: data.pic_name,
      pic_phone: data.pic_phone,
      product: data.product,
      notes: data.notes
        ? `[REQUEST SALES] ${data.notes}`
        : '[REQUEST SALES] Menunggu assignment dari Admin',
      priority: 'medium' as const,
      status: 'pending' as const,
      repeat: 'none' as const,
      // assigned_to & assign_name dikosongkan — Admin yang assign
      assigned_to: '',
      assign_name: '',
      created_by: currentUser.username,
    };

    const { error } = await supabase.from('reminders').insert([payload]);
    if (error) {
      notify('error', 'Gagal mengirim request: ' + error.message);
      return;
    }

    notify('success', 'Request jadwal berhasil dikirim! Menunggu approval Admin.');
    setShowRequestModal(false);
    fetchRemindersQuiet();

    // Kirim WA notifikasi ke semua admin
    try {
      const { data: admins } = await supabase
        .from('users')
        .select('phone_number, full_name')
        .eq('role', 'admin');
      if (admins && admins.length > 0) {
        const msg =
          `📩 *REQUEST JADWAL BARU — PTS IVP*\n\n` +
          `Sales *${currentUser.full_name}* mengajukan request jadwal:\n\n` +
          `📋 *Project: ${data.project_name}*\n` +
          `🏷️ Kategori: ${data.category}\n` +
          `📦 Product: ${data.product || '-'}\n` +
          `📍 Lokasi: ${data.address}\n` +
          `🕐 Usulan: *${formatDate(data.due_date)}${data.due_time ? ' · ' + data.due_time : ''}*\n` +
          (data.description ? `📝 Deskripsi: ${data.description}\n` : '') +
          (data.pic_name ? `🙋 PIC: ${data.pic_name}${data.pic_phone ? ' - ' + data.pic_phone : ''}\n` : '') +
          `\nSilakan review & assign ke Team PTS:\n` +
          `🔗 https://work-management-ptsivp.vercel.app/dashboard`;
        for (const admin of admins) {
          if (admin.phone_number) {
            await sendFonnteWA(admin.phone_number, msg);
          }
        }
      }
    } catch { }
  };

  // ─── Handler: Admin Approve & Assign request dari Sales ─────────────────
  const handleApproveAssign = async () => {
    if (!approveTarget || !approveAssignTo) return;
    const assignee = teamUsers.find(u => u.username === approveAssignTo);
    if (!assignee) return;
    setApproveSaving(true);

    // Update reminder: assign ke team, clear REQUEST SALES note prefix
    const cleanNotes = (approveTarget.notes ?? '').replace('[REQUEST SALES] ', '').replace('[REQUEST SALES]', '').trim();
    const { error } = await supabase.from('reminders').update({
      assigned_to: assignee.username,
      assign_name: assignee.full_name,
      due_date: approveDate || approveTarget.due_date,
      due_time: approveTime || approveTarget.due_time,
      notes: cleanNotes || undefined,
    }).eq('id', approveTarget.id);

    if (error) {
      notify('error', 'Gagal approve: ' + error.message);
      setApproveSaving(false);
      return;
    }

    notify('success', `Request disetujui & di-assign ke ${assignee.full_name}!`);

    // WA ke team yang di-assign
    if (assignee.phone_number) {
      const msg =
        `🗓️ *JADWAL BARU — PTS IVP*

` +
        `Halo *${assignee.full_name}*, kamu mendapat jadwal baru dari request Sales:

` +
        `*Nama Project: ${approveTarget.project_name}*
` +
        `🏷️ Kategori: ${approveTarget.category}
` +
        `📦 Product: ${approveTarget.product || '-'}
` +
        `📍 Lokasi: ${approveTarget.address || '-'}
` +
        `👤 Sales: ${approveTarget.sales_name}${approveTarget.sales_division ? ' - ' + approveTarget.sales_division : ''}
` +
        `🕐 Jadwal: *${formatDate(approveDate || approveTarget.due_date)}${(approveTime || approveTarget.due_time) ? ' · ' + (approveTime || approveTarget.due_time) : ''}*
` +
        (approveTarget.pic_name ? `🙋 PIC: ${approveTarget.pic_name}${approveTarget.pic_phone ? ' - ' + approveTarget.pic_phone : ''}
` : '') +
        `
jangan lupa peralatan & Semangat💪🏼
` +
        `🔗 https://work-management-ptsivp.vercel.app/dashboard`;
      await sendFonnteWA(assignee.phone_number, msg);
    }

    // WA ke sales yang request — konfirmasi approved
    try {
      const { data: salesUser } = await supabase
        .from('users').select('phone_number, full_name')
        .eq('full_name', approveTarget.sales_name).eq('role', 'guest').maybeSingle();
      if (salesUser?.phone_number) {
        const salesMsg =
          `✅ *REQUEST JADWAL DISETUJUI — PTS IVP*

` +
          `Halo *${salesUser.full_name}*!

` +
          `Request jadwal kamu untuk project:
` +
          `📋 *${approveTarget.project_name}*
` +
          `🏷️ Kategori: ${approveTarget.category}
` +
          `📍 ${approveTarget.address || '-'}

` +
          `telah *disetujui* dan akan dikerjakan oleh:
` +
          `👷 *${assignee.full_name}*
` +
          `🕐 Jadwal: *${formatDate(approveDate || approveTarget.due_date)}${(approveTime || approveTarget.due_time) ? ' · ' + (approveTime || approveTarget.due_time) : ''}*

` +
          `Terima kasih! 🙏
` +
          `🔗 https://work-management-ptsivp.vercel.app/dashboard`;
        await sendFonnteWA(salesUser.phone_number, salesMsg);
      }
    } catch { /* ignore WA error */ }

    // ── In-app notification to the sales requester ──────────────────────────
    try {
      if (approveTarget.notes?.includes('[REQUEST SALES]')) {
        // Find the sales user by name to get their id
        const { data: salesUserFull } = await supabase
          .from('users').select('id, full_name')
          .eq('full_name', approveTarget.sales_name)
          .in('role', ['guest', 'sales']).maybeSingle();
        if (salesUserFull?.id) {
          notifyReminderApproved(
            salesUserFull.id, salesUserFull.full_name,
            approveTarget.id, approveTarget.project_name,
            approveDate || approveTarget.due_date,
            currentUser?.full_name ?? 'Admin'
          ).catch(() => {});
        }
      }
    } catch { /* ignore */ }

    // ── Audit log ─────────────────────────────────────────────────────────────
    logAudit({
      user_id: currentUser?.id ?? '',
      user_name: currentUser?.full_name ?? '',
      action: 'approve',
      module: 'reminder',
      target_id: approveTarget.id,
      target_name: approveTarget.project_name,
      new_value: assignee.full_name,
    }).catch(() => {});

    setApproveTarget(null);
    setApproveAssignTo('');
    setApproveDate('');
    setApproveTime('');
    setApproveSaving(false);
    setDetailReminder(null);
    fetchRemindersQuiet();
  };

  const myActiveReminders = reminders.filter(r =>
    currentUser && r.assigned_to === currentUser.username && r.status !== 'done' && r.status !== 'cancelled'
  );

  // ─── Login handler ─────────────────────────────────────────────────────────
  const handleLogout = () => {
    setSelectMode(false); setSelectedIds(new Set()); setFilterStatus('all'); setFilterYear('all'); setFilterCategory('all');
    setSearchProject(''); setSearchSales(''); setSearchDivisionSales('');
    setSearchTeamHandler(''); setSearchProduct(''); setProductFilter(null);
    setSelectedCalDay(null);
    clearSession();
    setCurrentUser(null); setLoginTime(null);
    // Redirect ke halaman login dashboard (parent window jika di dalam iframe)
    const target = window.top !== window ? window.top : window;
    if (target) target.location.href = '/dashboard';
  };

  // ─── Not ready — tampilkan loading screen saat pertama kali fetch data ────
  if (!appReady) return <LoadingScreen />;

  return (
    <div className="h-screen overflow-hidden flex flex-col relative" style={{
      backgroundImage: `url('/IVP_Background.png')`,
      backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed',
    }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(255,255,255,0.08)' }} />
      <div className="relative z-10 flex flex-col flex-1 overflow-hidden">

        {/* Toast */}
        {toast && (
          <div className={`fixed top-5 right-5 z-[200] px-5 py-3.5 rounded-xl shadow-2xl text-sm font-bold flex items-center gap-2 text-white ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}
            style={{ boxShadow: toast.type === 'success' ? '0 4px 20px rgba(16,185,129,0.4)' : '0 4px 20px rgba(220,38,38,0.4)' }}>
            {toast.type === 'success' ? '✅' : '❌'} {toast.msg}
          </div>
        )}

        {/* ── RESCHEDULE MODAL ── */}
        {rescheduleTarget && (
          <RescheduleModal
            reminder={rescheduleTarget}
            onClose={() => setRescheduleTarget(null)}
            onSave={handleReschedule}
          />
        )}

        {/* ── REQUEST JADWAL MODAL (Guest/Sales) ── */}
        {showRequestModal && currentUser && (
          <RequestJadwalModal
            salesName={currentUser.full_name}
            salesUsername={currentUser.username}
            salesDivision={currentUser.sales_division ?? ''}
            onClose={() => setShowRequestModal(false)}
            onSubmit={handleRequestJadwal}
          />
        )}

        {/* ── APPROVE & ASSIGN MODAL (Admin only) ── */}
        {approveTarget && isAdmin && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[110] p-4"
            onClick={e => { if (e.target === e.currentTarget) { setApproveTarget(null); setApproveAssignTo(''); } }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
              style={{ animation: 'scale-in 0.25s ease-out', border: '2px solid rgba(34,197,94,0.4)' }}>
              {/* Header */}
              <div className="px-6 py-5 flex items-center justify-between"
                style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)' }}>
                <div>
                  <h3 className="text-lg font-bold text-white">✅ Approve & Assign Request</h3>
                  <p className="text-green-200/80 text-xs mt-0.5 truncate max-w-[300px]">{approveTarget.project_name}</p>
                </div>
                <button onClick={() => { setApproveTarget(null); setApproveAssignTo(''); }}
                  className="bg-white/15 hover:bg-white/25 text-white p-2 rounded-lg transition-all">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-4">
                {/* Info request */}
                <div className="rounded-xl p-3 space-y-1"
                  style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)' }}>
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Request dari Sales</p>
                  <p className="text-sm font-bold text-slate-800">{approveTarget.sales_name}{approveTarget.sales_division ? ` · ${approveTarget.sales_division}` : ''}</p>
                  <p className="text-xs text-slate-500">📍 {approveTarget.address || '-'} · 🏷️ {approveTarget.category}</p>
                  <p className="text-xs text-slate-500">📅 Usulan: {formatDate(approveTarget.due_date)} {approveTarget.due_time}</p>
                </div>

                {/* Assign to Team */}
                <div>
                  <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: '#94a3b8' }}>
                    Assign ke Team PTS *
                  </label>
                  <select
                    value={approveAssignTo}
                    onChange={e => setApproveAssignTo(e.target.value)}
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all text-slate-800 focus:ring-2 focus:ring-green-500/40"
                    style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.12)' }}>
                    <option value="">-- Pilih Anggota Team PTS --</option>
                    {teamUsers.map(u => <option key={u.id} value={u.username}>{u.full_name}</option>)}
                  </select>
                </div>

                {/* Konfirmasi / ubah tanggal */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: '#94a3b8' }}>
                      Tanggal (opsional ubah)
                    </label>
                    <input type="date"
                      value={approveDate || approveTarget.due_date}
                      onChange={e => setApproveDate(e.target.value)}
                      className="w-full rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-500/40 text-slate-800"
                      style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.12)' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: '#94a3b8' }}>
                      Waktu (opsional ubah)
                    </label>
                    <input type="time"
                      value={approveTime || approveTarget.due_time}
                      onChange={e => setApproveTime(e.target.value)}
                      className="w-full rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-500/40 text-slate-800"
                      style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.12)' }} />
                  </div>
                </div>

                {/* Info WA */}
                <div className="rounded-xl p-3 flex items-start gap-2"
                  style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <span className="text-base flex-shrink-0">💬</span>
                  <p className="text-[11px] text-green-700 leading-relaxed">
                    WA notifikasi akan otomatis dikirim ke <strong>Team PTS</strong> yang di-assign dan ke <strong>Sales</strong> yang request bahwa jadwalnya sudah disetujui.
                  </p>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-1">
                  <button onClick={() => { setApproveTarget(null); setApproveAssignTo(''); setApproveDate(''); setApproveTime(''); }}
                    className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all"
                    style={{ background: '#f8fafc', color: '#64748b', border: '1px solid rgba(0,0,0,0.12)' }}>
                    Batal
                  </button>
                  <button
                    onClick={handleApproveAssign}
                    disabled={approveSaving || !approveAssignTo}
                    className="flex-[2] text-white py-3 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: '0 4px 14px rgba(22,163,74,0.35)' }}>
                    {approveSaving
                      ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Menyimpan...</>
                      : <>✅ Approve &amp; Assign</>
                    }
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── DELETE MODAL ── */}
        {showDeleteModal && deleteTarget && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[110] p-4">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-md w-full p-6"
              style={{ animation: 'scale-in 0.25s ease-out', border: '2px solid rgba(220,38,38,0.5)' }}>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">🗑️</span>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">Hapus Reminder</h3>
                  <p className="text-xs font-medium text-gray-500">{deleteTarget.project_name}</p>
                  <p className="text-xs text-gray-400">{deleteTarget.category}</p>
                </div>
              </div>
              <div className="rounded-xl p-3 mb-4 text-xs"
                style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: '#b91c1c' }}>
                ⚠️ <strong>Tindakan ini tidak dapat dibatalkan.</strong> Reminder ini akan dihapus permanen dari database.
              </div>
              <div className="mb-4">
                <label className="block text-sm font-bold mb-1 text-gray-700">
                  Ketik <span className="font-mono bg-red-100 text-red-700 px-1.5 py-0.5 rounded">HAPUS</span> untuk konfirmasi
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder="Ketik HAPUS di sini..."
                  className="w-full rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                  style={{ border: '2px solid rgba(220,38,38,0.3)', background: 'white' }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleDelete}
                  disabled={deleteConfirmText !== 'HAPUS'}
                  className="bg-gradient-to-r from-red-600 to-red-800 text-white py-2.5 rounded-xl font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:from-red-700 hover:to-red-900">
                  🗑️ Hapus Permanen
                </button>
                <button
                  onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); setDeleteConfirmText(''); }}
                  className="bg-gray-100 text-gray-700 py-2.5 rounded-xl font-bold hover:bg-gray-200 transition-all">
                  ✕ Batal
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── FORM MODAL (Tambah / Edit Reminder) ── */}
        {/* Bulk Delete Confirm Modal */}
      {bulkConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border-2 border-red-400">
            <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 flex items-center gap-3">
              <span className="text-2xl">🗑️</span>
              <div><h3 className="font-bold text-white">Hapus {selectedIds.size} Jadwal?</h3>
              <p className="text-red-100 text-xs mt-0.5">Tindakan ini tidak dapat dibatalkan</p></div>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-5">Kamu akan menghapus <strong>{selectedIds.size} jadwal</strong> yang dipilih secara permanen dari sistem.</p>
              <div className="flex gap-3">
                <button onClick={() => setBulkConfirm(false)} className="flex-1 border-2 border-gray-300 text-gray-700 py-2.5 rounded-xl font-bold hover:bg-gray-50 transition-all text-sm">Batal</button>
                <button onClick={async () => {
                  setBulkConfirm(false); setBulkDeleting(true);
                  const { error } = await supabase.from('service_reminders').delete().in('id', Array.from(selectedIds));
                  if (!error) { setReminders(p => p.filter(r => !selectedIds.has(r.id))); setSelectedIds(new Set()); setSelectMode(false); }
                  else notify('error', 'Gagal: ' + error.message);
                  setBulkDeleting(false);
                }} className="flex-[2] bg-gradient-to-r from-red-600 to-red-700 text-white py-2.5 rounded-xl font-bold shadow-lg transition-all text-sm hover:from-red-700 hover:to-red-800">
                  🗑️ Ya, Hapus Permanen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showFormModal && (
        <ReminderFormModal
          editingReminder={editingReminder}
          formData={formData as ReminderForm}
          setFormData={setFormData as (data: ReminderForm) => void}
          saving={saving}
          teamUsers={teamUsers}
          guestUsers={guestUsers}
          onClose={() => { setShowFormModal(false); setEditingReminder(null); setFormData(emptyForm); }}
          onSubmit={handleSave}
        />
      )}

        {/* ── NOTIFICATION POPUP ── */}
        {showNotificationPopup && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
            <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden border-4 border-yellow-400"
              style={{ animation: 'scale-in 0.3s ease-out' }}>
              <div className="p-5 border-b-2 border-yellow-300" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl animate-bounce">🔔</span>
                    <div>
                      <h3 className="text-lg font-bold text-white">Reminder Kamu</h3>
                      <p className="text-sm text-white/90">{myReminders.length} reminder aktif yang diassign ke kamu</p>
                    </div>
                  </div>
                  <button onClick={() => setShowNotificationPopup(false)} className="text-white hover:bg-white/20 rounded-lg p-2 font-bold">✕</button>
                </div>
              </div>
              <div className="max-h-[calc(80vh-140px)] overflow-y-auto p-4 space-y-2">
                {myReminders.map(r => (
                  <div key={r.id} onClick={() => { setDetailReminder(r); setShowNotificationPopup(false); }}
                    className="rounded-xl p-3 border-2 cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all"
                    style={{ background: 'rgba(249,250,251,0.9)', borderColor: '#e5e7eb' }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <CategoryBadge category={r.category} />
                          <PriorityBadge priority={r.priority} />
                        </div>
                        <p className="font-bold text-sm text-gray-800 truncate">{(r.project_name || '').trim() || ((r as any).title || '').trim() || '—'}</p>
                        {r.address && <p className="text-xs text-gray-500 mt-0.5">📍 {r.address}</p>}
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <StatusBadge status={r.status} />
                        <p className="text-[10px] text-gray-500 mt-1">{formatDate(r.due_date)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t-2 border-gray-200 bg-gray-50">
                <button onClick={() => setShowNotificationPopup(false)}
                  className="w-full bg-gradient-to-r from-red-600 to-red-800 text-white py-3 rounded-xl font-bold transition-all">
                  ✕ Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── BELL POPUP ── */}
        {showBellPopup && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
            <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden border-4 border-yellow-400"
              style={{ animation: 'scale-in 0.3s ease-out' }}>
              <div className="p-5 border-b-2 border-yellow-300" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">🔔</span>
                    <div>
                      <h3 className="text-lg font-bold text-white">Reminder Aktif Kamu</h3>
                      <p className="text-sm text-white/90">{myActiveReminders.length} aktif</p>
                    </div>
                  </div>
                  <button onClick={() => setShowBellPopup(false)} className="text-white hover:bg-white/20 rounded-lg p-2 font-bold">✕</button>
                </div>
              </div>
              <div className="max-h-[calc(80vh-140px)] overflow-y-auto p-4 space-y-2">
                {myActiveReminders.length === 0 ? (
                  <div className="text-center py-10 text-gray-500">
                    <div className="text-5xl mb-3">✅</div>
                    <p className="font-semibold">Tidak ada reminder aktif</p>
                  </div>
                ) : myActiveReminders.map(r => (
                  <div key={r.id} onClick={() => { setDetailReminder(r); setShowBellPopup(false); }}
                    className="rounded-xl p-3 border-2 cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all"
                    style={{ background: 'rgba(249,250,251,0.9)', borderColor: '#e5e7eb' }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <CategoryBadge category={r.category} />
                        </div>
                        <p className="font-bold text-sm text-gray-800 truncate">{(r.project_name || '').trim() || ((r as any).title || '').trim() || '—'}</p>
                        {r.address && <p className="text-xs text-gray-500 mt-0.5">📍 {r.address}</p>}
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <StatusBadge status={r.status} />
                        <p className="text-[10px] text-gray-500 mt-1">{formatDate(r.due_date)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t-2 border-gray-200 bg-gray-50">
                <button onClick={() => setShowBellPopup(false)}
                  className="w-full bg-gradient-to-r from-red-600 to-red-800 text-white py-3 rounded-xl font-bold transition-all">
                  ✕ Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── DETAIL POPUP ── */}
        {detailReminder && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 overflow-y-auto"
            onClick={e => { if (e.target === e.currentTarget) { setDetailReminder(null); setPendingStatus(null); setStatusPhoto(null); setStatusPhotoPreview(null); } }}>
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-2xl my-4 overflow-hidden"
              style={{ animation: 'scale-in 0.25s ease-out', border: '1px solid rgba(0,0,0,0.1)', maxHeight: '96vh' }}>
              <div className="px-6 py-5 relative" style={{
                background: (() => { const c = CATEGORY_CONFIG[detailReminder.category]; return c ? `linear-gradient(135deg,${c.accent}dd,${c.accent}88)` : 'linear-gradient(135deg,#1d4ed8,#1e40af)'; })()
              }}>
                <button onClick={() => { setDetailReminder(null); setPendingStatus(null); setStatusPhoto(null); setStatusPhotoPreview(null); }}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/20 hover:bg-black/30 text-white flex items-center justify-center font-bold text-lg">✕</button>
                <div className="flex flex-wrap gap-2 mb-3">
                  <PriorityBadge priority={detailReminder.priority} onHeader />
                  <StatusBadge status={detailReminder.status} onHeader />
                  <CategoryBadge category={detailReminder.category} onHeader />
                  {detailReminder.repeat !== 'none' && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">
                      🔁 {REPEAT_OPTIONS.find(r => r.value === detailReminder.repeat)?.label}
                    </span>
                  )}
                  {detailReminder.wa_sent_h1 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/80 text-white">✅ WA H-1 Terkirim</span>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-white leading-tight">{(detailReminder.project_name || '').trim() || ((detailReminder as any).title || '').trim() || '—'}</h2>
                {/* Lokasi Project langsung di bawah nama project */}
                {detailReminder.address && (
                  <p className="text-white/80 text-sm mt-1 flex items-center gap-1.5">
                    <span>📍</span>{detailReminder.address}
                  </p>
                )}
                {detailReminder.description && <p className="text-white/70 text-xs mt-1.5">{detailReminder.description}</p>}
                {/* Troubleshooting link ke Ticketing — navigasi internal */}
                {detailReminder.category === 'Troubleshooting' && (
                  <button
                    onClick={e => { e.stopPropagation(); setDetailReminder(null); router.push('/ticketing'); }}
                    className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:scale-[1.03]"
                    style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.92)' }}>
                    🎫 Buka Platform Ticketing
                  </button>
                )}
              </div>

              <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(95vh - 180px)' }}>
                <div>
                  <SectionHeaderSmall icon="📋" title="Detail Jadwal" />
                  <div className="mt-3 grid grid-cols-2 gap-4">
                    <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.08)' }}>
                      <p className="text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: '#64748b' }}>Assign To</p>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                          style={{ background: 'rgba(220,38,38,0.2)', color: '#dc2626' }}>
                          {detailReminder.assign_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{detailReminder.assign_name}</p>
                          <p className="text-xs" style={{ color: '#64748b' }}>@{detailReminder.assigned_to}</p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.08)' }}>
                      <p className="text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: '#64748b' }}>📅 Jadwal</p>
                      <p className="text-sm font-bold text-slate-800">{formatDate(detailReminder.due_date)}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>⏰ {detailReminder.due_time}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <SectionHeaderSmall icon="🏢" title="Informasi Project" />
                  <div className="mt-3 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.08)' }}>
                    {detailReminder.product && <InfoRow icon="📦" label="Product / Unit" value={detailReminder.product} />}
                    <InfoRow icon="👤" label="Nama Sales & Divisi" value={[detailReminder.sales_name, detailReminder.sales_division].filter(Boolean).join(' / ')} />
                    {detailReminder.sales_name && (REVIEW_TRIGGER_CATEGORIES as readonly string[]).includes(detailReminder.category) && (
                      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', background: 'rgba(124,58,237,0.04)' }}>
                        <span className="text-base flex-shrink-0">⭐</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#7c3aed' }}>Guest Review (Sales)</p>
                          <p className="text-sm font-semibold text-violet-700">{detailReminder.sales_name}</p>
                          {detailReminder.sales_division && <p className="text-[10px] text-violet-500">{detailReminder.sales_division}</p>}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {detailReminder.status === 'done' ? (
                            <span className="text-[10px] font-bold px-2 py-1 rounded-full text-white" style={{ background: '#7c3aed' }}>
                              Form Review ✓
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#d97706', border: '1px solid rgba(245,158,11,0.4)' }}>
                              ⏳ Setelah Completed
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {detailReminder.pic_name && <InfoRow icon="🙋" label="Nama PIC Project" value={detailReminder.pic_name} />}
                    {detailReminder.pic_phone && (
                      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                        <span className="text-base flex-shrink-0">📱</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#64748b' }}>No. Telepon PIC</p>
                          <a href={`tel:${detailReminder.pic_phone}`} className="text-sm font-semibold hover:underline" style={{ color: '#60a5fa' }}
                            onClick={e => e.stopPropagation()}>{detailReminder.pic_phone}</a>
                        </div>
                      </div>
                    )}
                    {detailReminder.description && <InfoRow icon="📝" label="Deskripsi" value={detailReminder.description} />}
                  </div>
                </div>

                {detailReminder.notes && (
                  <div className="rounded-xl p-4" style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)' }}>
                    <p className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: '#f59e0b' }}>📝 Catatan</p>
                    <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">{detailReminder.notes}</p>
                  </div>
                )}

                {/* ── Warranty Status — hanya untuk Konfigurasi & Konfigurasi & Training ── */}
                {(detailReminder.category === 'Konfigurasi' || detailReminder.category === 'Konfigurasi & Training') && (() => {
                  const wy = (detailReminder as any).warranty_years as 1 | 2 | 3 | null | undefined;
                  const bastDate = detailReminder.due_date;
                  if (!wy || !bastDate) return (
                    <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: 'rgba(100,116,139,0.07)', border: '1px solid rgba(100,116,139,0.2)' }}>
                      <span className="text-xl">🛡️</span>
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Masa Garansi</p>
                        <p className="text-sm text-slate-400 italic">Tidak dikonfigurasi</p>
                      </div>
                    </div>
                  );
                  const bast = new Date(bastDate + 'T00:00:00');
                  const expiry = new Date(bastDate + 'T00:00:00');
                  expiry.setFullYear(expiry.getFullYear() + wy);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const isInWarranty = today <= expiry;
                  const diffMs = expiry.getTime() - today.getTime();
                  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                  const expiryStr = expiry.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                  const bastStr = bast.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                  return (
                    <div className="rounded-xl p-4" style={isInWarranty
                      ? { background: 'rgba(14,165,233,0.08)', border: '1.5px solid rgba(14,165,233,0.35)' }
                      : { background: 'rgba(239,68,68,0.07)', border: '1.5px solid rgba(239,68,68,0.35)' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{isInWarranty ? '🛡️' : '⚠️'}</span>
                        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: isInWarranty ? '#0369a1' : '#dc2626' }}>
                          Status Garansi
                        </p>
                        <span className="ml-auto px-2.5 py-1 rounded-full text-[11px] font-bold" style={isInWarranty
                          ? { background: 'rgba(14,165,233,0.18)', color: '#0369a1' }
                          : { background: 'rgba(239,68,68,0.15)', color: '#dc2626' }}>
                          {isInWarranty ? '✅ In Warranty' : '❌ Out of Warranty'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-2 text-xs">
                        <div>
                          <p className="text-slate-400 mb-0.5">BAST / Mulai</p>
                          <p className="font-semibold text-slate-700">{bastStr}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 mb-0.5">Garansi Berakhir</p>
                          <p className="font-semibold" style={{ color: isInWarranty ? '#0369a1' : '#dc2626' }}>{expiryStr}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 mb-0.5">Durasi</p>
                          <p className="font-semibold text-slate-700">{wy} Tahun</p>
                        </div>
                        <div>
                          <p className="text-slate-400 mb-0.5">{isInWarranty ? 'Sisa Hari' : 'Sudah Lewat'}</p>
                          <p className="font-bold" style={{ color: isInWarranty ? '#0369a1' : '#dc2626' }}>
                            {isInWarranty ? `${diffDays} hari` : `${Math.abs(diffDays)} hari`}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div>
                  <p className="text-[10px] font-bold tracking-widest uppercase mb-3" style={{ color: '#64748b' }}>Update Status</p>
                  {detailReminder.status === 'done' ? (
                    <div className="rounded-xl px-4 py-3 flex items-center gap-2 mb-3" style={{ background: 'rgba(16,185,129,0.1)', border: '1.5px solid rgba(16,185,129,0.35)' }}>
                      <span className="text-lg">✅</span>
                      <div>
                        <p className="text-xs font-bold text-emerald-700">Jadwal Selesai</p>
                        <p className="text-[10px] text-emerald-600">Status completed tidak dapat diubah kembali.</p>
                      </div>
                    </div>
                  ) : (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {(Object.keys(STATUS_CONFIG) as Status[]).filter(s => s !== 'done' || detailReminder.status !== 'done').map(s => {
                      const c = STATUS_CONFIG[s];
                      const isActive = (pendingStatus ?? detailReminder.status) === s;
                      return (
                        <button key={s}
                          onClick={() => {
                            setPendingStatus(s);
                            if (s !== 'done') { setStatusPhoto(null); setStatusPhotoPreview(null); }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isActive ? 'ring-2 ring-offset-1 scale-105' : 'opacity-70 hover:opacity-100'}`}
                          style={{ background: c.bg, color: c.color, border: `2px solid ${c.border}`, '--tw-ring-color': c.border } as React.CSSProperties}>
                          {c.icon} {c.label}
                        </button>
                      );
                    })}
                  </div>
                  )}

                  {/* Photo upload - wajib jika status Completed, sembunyikan jika sudah done */}
                  {detailReminder.status !== 'done' && (pendingStatus ?? detailReminder.status) === 'done' && (
                    <div className="rounded-xl p-3 mb-3" style={{ background: 'rgba(16,185,129,0.07)', border: '1.5px solid rgba(16,185,129,0.3)' }}>
                      <p className="text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: '#059669' }}>
                        📸 Foto Bukti Selesai <span className="text-red-500">*Wajib</span>
                      </p>
                      <input
                        ref={statusPhotoRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setStatusPhoto(file);
                            const reader = new FileReader();
                            reader.onload = ev => setStatusPhotoPreview(ev.target?.result as string);
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      {statusPhotoPreview ? (
                        <div className="relative">
                          <img src={statusPhotoPreview} alt="preview" className="w-full max-h-40 object-cover rounded-lg" />
                          <button
                            onClick={() => { setStatusPhoto(null); setStatusPhotoPreview(null); if (statusPhotoRef.current) statusPhotoRef.current.value = ''; }}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold hover:bg-red-600">
                            ✕
                          </button>
                          <p className="text-[11px] text-emerald-700 font-semibold mt-1.5">✅ {statusPhoto?.name}</p>
                        </div>
                      ) : (
                        <button
                          onClick={() => statusPhotoRef.current?.click()}
                          className="w-full border-2 border-dashed rounded-xl py-6 flex flex-col items-center gap-2 transition-all hover:bg-emerald-50"
                          style={{ borderColor: 'rgba(16,185,129,0.5)' }}>
                          <span className="text-2xl">📷</span>
                          <span className="text-xs font-bold text-emerald-700">Klik untuk upload foto</span>
                          <span className="text-[10px] text-gray-400">JPG, PNG, WEBP — maks. 10MB</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Tombol Update Status */}
                  {pendingStatus && pendingStatus !== detailReminder.status && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setPendingStatus(null); setStatusPhoto(null); setStatusPhotoPreview(null); }}
                        className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                        style={{ background: 'rgba(0,0,0,0.06)', color: '#64748b', border: '1px solid rgba(0,0,0,0.12)' }}>
                        Batal
                      </button>
                      <button
                        onClick={handleConfirmStatusUpdate}
                        disabled={updatingStatus || (pendingStatus === 'done' && !statusPhoto)}
                        className="flex-1 py-2 rounded-xl text-xs font-bold text-white transition-all flex items-center justify-center gap-2 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ background: 'linear-gradient(135deg,#059669,#047857)', boxShadow: '0 3px 12px rgba(5,150,105,0.35)' }}>
                        {updatingStatus
                          ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                        }
                        {updatingStatus ? 'Menyimpan...' : 'Konfirmasi Update'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Foto Bukti Selesai - tampil jika status done dan ada foto */}
                {detailReminder.status === 'done' && detailReminder.completion_photo_url && (
                  <div className="rounded-2xl overflow-hidden" style={{ border: '1.5px solid rgba(16,185,129,0.35)', background: 'rgba(16,185,129,0.05)' }}>
                    <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: 'rgba(16,185,129,0.12)', borderBottom: '1px solid rgba(16,185,129,0.2)' }}>
                      <span className="text-base">📸</span>
                      <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#059669' }}>Foto Bukti Selesai</p>
                    </div>
                    <div className="p-3">
                      <img
                        src={detailReminder.completion_photo_url}
                        alt="Foto bukti selesai"
                        className="w-full rounded-xl object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        style={{ maxHeight: 220 }}
                        onClick={() => window.open(detailReminder.completion_photo_url, '_blank')}
                      />
                      <a
                        href={detailReminder.completion_photo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 flex items-center justify-center gap-1.5 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 transition-colors">
                        🔗 Buka foto di tab baru
                      </a>
                    </div>
                  </div>
                )}

                {/* Action buttons di detail popup */}
                {(isAdmin || currentUser?.role === 'team') && (
                  <div className="flex gap-3 pt-2 flex-wrap">
                    {/* Approve & Assign — admin only, request sales belum di-assign */}
                    {isAdmin && !detailReminder.assigned_to && detailReminder.notes?.includes('[REQUEST SALES]') && (
                      <button
                        onClick={() => { setApproveTarget(detailReminder); setApproveAssignTo(''); setApproveDate(detailReminder.due_date); setApproveTime(detailReminder.due_time); }}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02]"
                        style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', color: 'white', boxShadow: '0 4px 12px rgba(22,163,74,0.3)' }}>
                        ✅ Approve &amp; Assign ke Team
                      </button>
                    )}
                    {/* Re-Schedule — admin + team PTS bisa */}
                    {detailReminder.status !== 'done' && (
                      <button onClick={() => { setRescheduleTarget(detailReminder); }}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02]"
                        style={{ background: 'linear-gradient(135deg,#d97706,#b45309)', color: 'white', boxShadow: '0 4px 12px rgba(217,119,6,0.3)' }}>
                        📅 Re-Schedule
                      </button>
                    )}
                    {/* Resend Form Review — muncul jika kategori trigger & status done & ada sales_name */}
                    {(isAdmin || currentUser?.role === 'team') &&
                      detailReminder.status === 'done' &&
                      detailReminder.sales_name?.trim() &&
                      (REVIEW_TRIGGER_CATEGORIES as readonly string[]).includes(detailReminder.category) && (
                      <button
                        onClick={() => handleResendFormReview(detailReminder)}
                        disabled={resendingFormReview}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] disabled:opacity-60"
                        style={{ background: 'linear-gradient(135deg,#7c3aed,#5b21b6)', color: 'white', boxShadow: '0 4px 12px rgba(124,58,237,0.3)' }}>
                        {resendingFormReview
                          ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          : '⭐'}
                        {resendingFormReview ? 'Mengirim...' : 'Resend Form Review'}
                      </button>
                    )}
                    {/* Send WA — admin only */}
                    {isAdmin && (
                      <button onClick={() => handleSendWA(detailReminder)} disabled={sendingWA === detailReminder.id}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] disabled:opacity-60"
                        style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', color: 'white', boxShadow: '0 4px 12px rgba(22,163,74,0.3)' }}>
                        {sendingWA === detailReminder.id
                          ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          : '💬'}
                        Kirim WA
                      </button>
                    )}
                    {/* Edit — admin only */}
                    {isAdmin && (
                      <button onClick={() => openEdit(detailReminder)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02]"
                        style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: 'white', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}>
                        ✏️ Edit
                      </button>
                    )}
                    {/* TIDAK ADA tombol Hapus di detail popup — hapus hanya dari ACT di tabel */}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── HEADER ── */}
        <PageHeader icon="🗓️" title="Reminder Schedule" color="#0891b2" colorLight="#0e7490">
          <button onClick={() => setShowBellPopup(true)}
            className="relative p-2 rounded-xl transition-all hover:bg-cyan-50 border-2 border-transparent hover:border-cyan-200">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {myActiveReminders.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                style={{ background: '#f59e0b' }}>
                {myActiveReminders.length}
              </span>
            )}
          </button>

          {canAddReminder && view === 'list' && (
            <button onClick={() => { setEditingReminder(null); setFormData(emptyForm); setShowFormModal(true); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:scale-105 hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#0891b2,#0e7490)', boxShadow: '0 4px 14px rgba(8,145,178,0.4)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
              Tambah Reminder
            </button>
          )}

          {/* ── Tombol Request Jadwal — hanya untuk role Guest/Sales ── */}
          {isGuest && view === 'list' && (
            <div className="flex flex-col items-end gap-1">
              <button
                onClick={() => { if (pendingReviewCount === 0) setShowRequestModal(true); }}
                disabled={pendingReviewCount > 0}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all"
                style={pendingReviewCount > 0
                  ? { background: 'linear-gradient(135deg,#9ca3af,#6b7280)', boxShadow: 'none', cursor: 'not-allowed', opacity: 0.7 }
                  : { background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', boxShadow: '0 4px 14px rgba(37,99,235,0.4)', cursor: 'pointer' }
                }
                title={pendingReviewCount > 0 ? `Ada ${pendingReviewCount} form review belum dinilai` : ''}
              >
                {pendingReviewCount > 0
                  ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                  : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                }
                📩 Request Jadwal
              </button>
              {pendingReviewCount > 0 && (
                <span className="text-[11px] font-semibold text-amber-600 flex items-center gap-1">
                  ⚠️ Selesaikan {pendingReviewCount} form review dulu
                </span>
              )}
            </div>
          )}
        </PageHeader>

        <div className="flex-1 overflow-y-auto max-w-[1600px] mx-auto w-full px-5 py-5 space-y-4">
          {view === 'list' && (
            <>
              {/* ── Stat cards (clickable filter) ── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  {
                    label: 'Total Jadwal', value: totalCount, sub: 'Semua reminder',
                    gradient: 'linear-gradient(135deg,#4f46e5,#6d28d9)', icon: '📋', shadow: 'rgba(79,70,229,0.35)',
                    onClick: () => { setFilterStatus('all'); setSelectedCalDay(null); },
                    active: filterStatus === 'all' && !selectedCalDay,
                  },
                  {
                    label: 'Pending', value: pendingCount, sub: 'Menunggu tindakan',
                    gradient: 'linear-gradient(135deg,#d97706,#b45309)', icon: '⏳', shadow: 'rgba(217,119,6,0.35)',
                    onClick: () => setFilterStatus(filterStatus === 'pending' ? 'all' : 'pending'),
                    active: filterStatus === 'pending',
                  },
                  {
                    label: 'Selesai', value: doneCount, sub: 'Terselesaikan',
                    gradient: 'linear-gradient(135deg,#059669,#047857)', icon: '✅', shadow: 'rgba(5,150,105,0.35)',
                    onClick: () => setFilterStatus(filterStatus === 'done' ? 'all' : 'done'),
                    active: filterStatus === 'done',
                  },
                  {
                    label: 'Hari Ini', value: todayCount, sub: 'Jadwal hari ini',
                    gradient: 'linear-gradient(135deg,#0891b2,#0e7490)', icon: '📅', shadow: 'rgba(8,145,178,0.35)',
                    onClick: () => setSelectedCalDay(selectedCalDay === new Date().toISOString().split('T')[0] ? null : new Date().toISOString().split('T')[0]),
                    active: selectedCalDay === new Date().toISOString().split('T')[0],
                  },
                ].map(card => (
                  <div key={card.label}
                    onClick={card.onClick}
                    className="rounded-2xl p-4 relative overflow-hidden flex flex-col gap-2 cursor-pointer transition-all hover:scale-[1.03] select-none"
                    style={{
                      background: card.gradient,
                      boxShadow: card.active ? `0 6px 24px ${card.shadow}` : `0 4px 16px ${card.shadow}`,
                      outline: card.active ? '3px solid white' : 'none',
                      transform: card.active ? 'scale(1.04)' : undefined,
                    }}>
                    <div className="absolute right-3 top-2 text-4xl opacity-[0.15] select-none">{card.icon}</div>
                    {card.active && (
                      <div className="absolute inset-0 rounded-2xl border-4 border-white/50 pointer-events-none" />
                    )}
                    <span className="text-3xl font-black text-white leading-none">{card.value}</span>
                    <div>
                      <p className="text-sm font-bold text-white leading-tight">{card.label}</p>
                      <p className="text-[10px] font-medium leading-tight" style={{ color: 'rgba(255,255,255,0.75)' }}>{card.sub}</p>
                    </div>
                    {card.active && <span className="absolute top-2 left-2 text-white/80 text-[9px] font-bold uppercase tracking-widest">Filter Aktif ✓</span>}
                  </div>
                ))}
              </div>

              {/* ── Pie Charts — klick untuk filter ── */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <MiniPieChart
                  data={projectPieData} title="Kegiatan / Kategori" icon="🖥️"
                  activeFilter={filterCategory !== 'all' ? filterCategory : null}
                  onSliceClick={label => setFilterCategory(filterCategory === label ? 'all' : label)}
                />
                <MiniPieChart
                  data={salesPieData} title="Divisi Sales" icon="👤"
                  activeFilter={searchDivisionSales || null}
                  onSliceClick={label => setSearchDivisionSales(searchDivisionSales === label ? '' : label)}
                />
                <MiniPieChart
                  data={teamPtsPieData} title="Team PTS" icon="👥"
                  activeFilter={searchTeamHandler || null}
                  onSliceClick={label => setSearchTeamHandler(searchTeamHandler === label ? '' : label)}
                />
                <MiniPieChart
                  data={productPieData} title="Product / Unit" icon="📦"
                  activeFilter={productFilter}
                  onSliceClick={label => setProductFilter(productFilter === label ? null : label)}
                />
              </div>

              {/* Active filter chips */}
              {/* Main area: list + calendar */}
              <div className="flex gap-4 items-start">

                {/* ── TICKET LIST ── */}
                <div className="flex-1 min-w-0 rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(200,200,200,0.6)', backdropFilter: 'blur(12px)' }}>

                  {/* ── TICKET LIST header + refresh/export ── */}
                  <div className="flex flex-wrap items-center justify-between px-5 py-3.5 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Schedule List</span>
                      <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2.5 py-1 rounded-full">{filteredReminders.length}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {(isAdmin || currentUser?.role === 'superadmin') && (
                        <button onClick={() => { setSelectMode(m => !m); setSelectedIds(new Set()); }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${selectMode ? 'bg-red-50 border-red-300 text-red-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                          {selectMode ? '✕ Batal' : '☑ Select'}
                        </button>
                      )}
                      <button onClick={fetchReminders} disabled={listLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:bg-gray-100 border border-gray-200 text-gray-600 disabled:opacity-60 bg-white">
                        <svg className={`w-3.5 h-3.5 ${listLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        Refresh
                      </button>
                      <button onClick={handleExportExcel} disabled={filteredReminders.length === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:scale-105 disabled:opacity-40"
                        style={{ background: 'linear-gradient(135deg,#0891b2,#0e7490)', boxShadow: '0 2px 8px rgba(8,145,178,0.3)' }}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                        Export Excel
                      </button>
                    </div>
                  </div>

                  {/* ── Search / Filter bar — tepat di bawah TICKET LIST ── */}
                  <div className="px-5 py-3 border-b border-gray-100" style={{ background: 'rgba(255,255,255,0.97)' }}>
                    <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Search Project / Location</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[11px]">🔍</span>
                          <input value={searchProject} onChange={e => setSearchProject(e.target.value)}
                            className="w-full rounded-lg pl-7 pr-3 py-1.5 text-xs outline-none bg-gray-50 border border-gray-200 focus:bg-white focus:border-red-300 transition-all"
                            placeholder="Search project / lokasi..." />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Search Sales Name</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[11px]">👤</span>
                          <input value={searchSales} onChange={e => setSearchSales(e.target.value)}
                            className="w-full rounded-lg pl-7 pr-3 py-1.5 text-xs outline-none bg-gray-50 border border-gray-200 focus:bg-white focus:border-red-300 transition-all"
                            placeholder="Search sales..." />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">📦 Product</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[11px]">📦</span>
                          <input value={searchProduct} onChange={e => { setSearchProduct(e.target.value); setProductFilter(null); }}
                            className="w-full rounded-lg pl-7 pr-3 py-1.5 text-xs outline-none bg-gray-50 border border-gray-200 focus:bg-white focus:border-red-300 transition-all"
                            placeholder="Cari product..." />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Team Handler</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[11px]">👷</span>
                          <input value={searchTeamHandler} onChange={e => setSearchTeamHandler(e.target.value)}
                            className="w-full rounded-lg pl-7 pr-3 py-1.5 text-xs outline-none bg-gray-50 border border-gray-200 focus:bg-white focus:border-purple-300 transition-all"
                            placeholder="Search handler..." />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Status</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[11px]">🏷️</span>
                          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
                            className="w-full rounded-lg pl-7 pr-3 py-1.5 text-xs outline-none bg-gray-50 border border-gray-200 focus:bg-white focus:border-red-300 appearance-none cursor-pointer transition-all">
                            <option value="all">All Status</option>
                            {(Object.keys(STATUS_CONFIG) as Status[]).map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                          </select>
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px] pointer-events-none">▼</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Filter Year</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[11px]">📅</span>
                          <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
                            className="w-full rounded-lg pl-7 pr-3 py-1.5 text-xs outline-none bg-gray-50 border border-gray-200 focus:bg-white focus:border-red-300 appearance-none cursor-pointer transition-all">
                            <option value="all">All Years</option>
                            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                          </select>
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px] pointer-events-none">▼</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bulk delete bar — admin only, selectMode only */}
                  {selectMode && (isAdmin || currentUser?.role === 'superadmin') && selectedIds.size > 0 && (
                    <div className="px-5 py-2.5 flex items-center justify-between border-b border-gray-200" style={{ background: 'rgba(220,38,38,0.07)' }}>
                      <span className="text-sm font-bold text-red-700">{selectedIds.size} jadwal dipilih</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-500 px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50">Batal Pilih</button>
                        <button onClick={() => setBulkConfirm(true)} disabled={bulkDeleting}
                          className="text-xs font-bold text-white px-4 py-1.5 rounded-lg disabled:opacity-50 flex items-center gap-1"
                          style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
                          {bulkDeleting ? '⏳ Menghapus...' : `🗑️ Hapus ${selectedIds.size}`}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Filter Aktif chips — di bawah filter bar ── */}
                  {(filterCategory !== 'all' || filterStatus !== 'all' || searchSales || searchDivisionSales || searchTeamHandler || searchProject || selectedCalDay || productFilter || searchProduct) && (
                    <div className="px-5 py-2.5 border-b border-gray-100 flex flex-wrap gap-2 items-center" style={{ background: 'rgba(255,255,255,0.97)' }}>
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Filter Aktif:</span>
                      {filterCategory !== 'all' && <button onClick={() => setFilterCategory('all')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#7c3aed' }}>🏷️ {filterCategory} ✕</button>}
                      {filterStatus !== 'all' && <button onClick={() => setFilterStatus('all')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#d97706' }}>Status: {STATUS_CONFIG[filterStatus as Status]?.label} ✕</button>}
                      {searchSales && <button onClick={() => setSearchSales('')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#475569' }}>👤 {searchSales} ✕</button>}
                      {searchDivisionSales && <button onClick={() => setSearchDivisionSales('')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#ec4899' }}>Division: {searchDivisionSales} ✕</button>}
                      {searchTeamHandler && <button onClick={() => setSearchTeamHandler('')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#7c3aed' }}>👷 {searchTeamHandler} ✕</button>}
                      {searchProject && <button onClick={() => setSearchProject('')} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#475569' }}>🔍 {searchProject} ✕</button>}
                      {productFilter && <button onClick={() => { setProductFilter(null); setSearchProduct(''); }} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#6366f1' }}>📦 {productFilter} ✕</button>}
                      {selectedCalDay && <button onClick={() => setSelectedCalDay(null)} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white transition-all hover:opacity-80" style={{ background: '#0891b2' }}>📅 {formatDate(selectedCalDay)} ✕</button>}
                      <button onClick={() => { setFilterCategory('all'); setFilterStatus('all'); setSearchSales(''); setSearchDivisionSales(''); setSearchTeamHandler(''); setSearchProject(''); setSelectedCalDay(null); setProductFilter(null); setSearchProduct(''); }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all hover:opacity-80" style={{ background: 'rgba(220,38,38,0.12)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.25)' }}>🗑️ Reset Semua</button>
                    </div>
                  )}

                  {/* ── TABLE ── */}
                  {listLoading ? (
                    <div className="space-y-2 p-4">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="animate-pulse flex gap-3 items-center bg-white/60 rounded-xl p-3 border border-gray-200">
                          <div className="flex-1 space-y-2"><div className="h-3 bg-gray-200 rounded w-2/5"></div><div className="h-2 bg-gray-100 rounded w-1/4"></div></div>
                          <div className="h-3 bg-gray-200 rounded w-1/6"></div><div className="h-3 bg-gray-200 rounded w-1/5"></div>
                          <div className="h-5 bg-gray-200 rounded-full w-16"></div><div className="h-6 bg-gray-200 rounded-lg w-14"></div>
                        </div>
                      ))}
                    </div>
                  ) : filteredReminders.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-5xl mb-3">📭</div>
                      <p className="text-gray-600 font-semibold text-sm">Tidak ada reminder ditemukan</p>
                      <p className="text-xs text-gray-400 mt-1">Coba ubah filter atau tambahkan reminder baru</p>
                    </div>
                  ) : (
                    <>
                    {/* ── MOBILE: Card view ── */}
                    <div className="md:hidden divide-y divide-gray-100">
                      {filteredReminders.map((r, idx) => {
                        const today = isDueToday(r.due_date);
                        const dueDate = new Date(r.due_date + 'T00:00:00');
                        return (
                          <div key={r.id}
                            className={`px-4 py-3.5 ${today ? 'bg-red-50/50 border-l-4 border-l-red-400' : 'border-l-4 border-l-transparent'}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm text-gray-800 leading-tight truncate">{(r.project_name || r.title || '').trim() || '—'}</p>
                                {r.address && <p className="text-[10px] text-gray-400 mt-0.5 truncate">📍 {r.address.split(',')[0]}</p>}
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <span className="text-[10px] font-semibold text-indigo-600">{(CATEGORY_CONFIG[r.category] ?? { icon: '📁' }).icon} {r.category}</span>
                                  {r.product && <span className="text-[10px] text-indigo-500 font-medium">{r.product}</span>}
                                </div>
                              </div>
                              <div className="shrink-0 flex flex-col items-end gap-1">
                                <div className="inline-flex flex-col items-center px-2 py-1 rounded-lg text-center"
                                  style={{ background: today ? 'rgba(220,38,38,0.12)' : 'rgba(99,102,241,0.08)', border: today ? '1px solid rgba(220,38,38,0.35)' : '1px solid rgba(99,102,241,0.2)' }}>
                                  <span className="text-base font-black leading-none" style={{ color: today ? '#dc2626' : '#4f46e5' }}>{dueDate.getDate()}</span>
                                  <span className="text-[8px] font-bold uppercase" style={{ color: today ? '#dc2626' : '#6366f1' }}>{dueDate.toLocaleDateString('id-ID',{month:'short',year:'2-digit'})}</span>
                                </div>
                                <StatusBadge status={r.status} />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-xs">
                              {r.sales_name && <div className="truncate"><span className="text-gray-400">Sales: </span><span className="text-gray-700 font-medium">{r.sales_name}</span></div>}
                              {r.assign_name && <div className="truncate"><span className="text-gray-400">Handler: </span><span className="text-gray-700 font-medium">{r.assign_name}</span></div>}
                              {r.notes && !r.notes.includes('[REQUEST SALES]') && <div className="col-span-2 truncate text-gray-400">{r.notes.substring(0,60)}{r.notes.length>60?'…':''}</div>}
                            </div>
                            <div className="flex items-center gap-1.5 mt-3">
                              <ViewIconBtn onClick={() => setDetailReminder(r)} title="Detail" />
                              {(isAdmin || currentUser?.role === 'team') && r.status !== 'done' && (
                                <RescheduleIconBtn onClick={() => setRescheduleTarget(r)} title="Re-Schedule" />
                              )}
                              {isAdmin && !r.assigned_to && r.notes?.includes('[REQUEST SALES]') && (
                                <ApproveIconBtn onClick={() => { setApproveTarget(r); setApproveAssignTo(''); setApproveDate(r.due_date); setApproveTime(r.due_time); }} title="Approve & Assign" pulse />
                              )}
                              {isAdmin && (
                                <DeleteIconBtn onClick={() => openDeleteModal(r)} title="Hapus" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-white/90">
                        <span className="text-xs text-gray-400">{filteredReminders.length} jadwal</span>
                      </div>
                    </div>

                    {/* ── DESKTOP: Table view ── */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full border-collapse" style={{ tableLayout: 'fixed', background: 'transparent' }}>
                        <colgroup>
                          <col style={{ width: '3%' }} />
                          <col style={{ width: '13%' }} />
                          <col style={{ width: '12%' }} />
                          <col style={{ width: '10%' }} />
                          <col style={{ width: '8%' }} />
                          <col style={{ width: '6%' }} />
                          <col style={{ width: '8%' }} />
                          <col style={{ width: '5%' }} />
                          <col style={{ width: '5%' }} />
						  <col style={{ width: '5%' }} />
                        </colgroup>
                        <thead>
                          <tr className="border-b-2 border-gray-100" style={{ background: "rgba(255,255,255,0.97)" }}>
                            <th className="px-3 py-2.5 text-center text-[10px] font-bold text-gray-500 uppercase tracking-wide border-r border-gray-200">
                      {selectMode && (isAdmin || currentUser?.role === 'superadmin')
                        ? <input type="checkbox"
                            checked={selectedIds.size === filteredReminders.length && filteredReminders.length > 0}
                            onChange={toggleSelectAll} className="w-4 h-4 rounded accent-red-600 cursor-pointer" title="Pilih Semua" />
                        : 'No'}
                    </th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wide border-r border-gray-200">Project</th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wide border-r border-gray-200">Product</th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wide border-r border-gray-200">Kegiatan</th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wide border-r border-gray-200">Sales</th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wide border-r border-gray-200">Handler</th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wide border-r border-gray-200">Status</th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wide border-r border-gray-200">Garansi</th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wide border-r border-gray-200">Tanggal</th>
                            <th className="px-1 py-2 text-center text-[10px] font-bold text-gray-500 uppercase tracking-wide">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredReminders.map((r, idx) => {
                            const today = isDueToday(r.due_date);
                            return (
                              <tr key={r.id}
                                className={`border-b border-gray-200 hover:bg-red-50/30 transition-colors cursor-pointer ${today ? 'bg-red-50/15 border-l-4 border-l-red-400' : 'border-l-4 border-l-transparent'}`}
                                >
                                {/* No */}
                                <td className="px-3 py-3 border-r border-gray-200 align-middle text-center" onClick={e => e.stopPropagation()}>
                            {selectMode && (isAdmin || currentUser?.role === 'superadmin')
                              ? <input type="checkbox" checked={selectedIds.has(r.id)}
                                  onChange={() => toggleSelectId(r.id)} className="w-4 h-4 rounded accent-red-600 cursor-pointer" />
                              : <span className="text-[11px] font-bold text-gray-500">{idx + 1}</span>}
                          </td>
                                {/* Project */}
                                <td className="px-3 py-3 border-r border-gray-200 align-middle">
                                  <div className="font-bold text-gray-800 text-xs leading-tight break-words">{(r.project_name || '').trim() || (r.title || '').trim() || '—'}</div>
                                  {r.address && <div className="text-[10px] text-gray-400 truncate mt-0.5">📍 {r.address.split(',')[0]}</div>}
                                  <div className="text-[10px] text-gray-400 mt-0.5">{formatDatetime(r.created_at).split(',')[0]}</div>
                                </td>
                                {/* Product */}
                                <td className="px-3 py-3 border-r border-gray-200 align-middle">
                                  {r.product ? (
                                    <button
                                      onClick={e => { e.stopPropagation(); setProductFilter(productFilter === r.product ? null : (r.product ?? null)); }}
                                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded text-left break-words leading-tight transition-all"
                                      style={{ background: productFilter === r.product ? '#6366f1' : '#eef2ff', color: productFilter === r.product ? 'white' : '#4338ca' }}>
                                      {r.product}
                                    </button>
                                  ) : <span className="text-gray-300 text-xs">—</span>}
                                </td>
                                {/* Kegiatan */}
                                <td className="px-3 py-3 border-r border-gray-200 align-middle">
                                  <div className="flex items-center gap-1">
                                    <span className="text-sm">{(CATEGORY_CONFIG[r.category] ?? { icon: '📁' }).icon}</span>
                                    <span className="text-[10px] font-semibold text-gray-700 leading-tight break-words">{r.category}</span>
                                    {r.sales_name && (REVIEW_TRIGGER_CATEGORIES as readonly string[]).includes(r.category) && (
                                    <div className="inline-flex items-center gap-1 mt-1 px-1.5 py-1"
                                      >
                                      ⭐ {/*r.sales_name*/}
                                    </div>
                                  )}
                                  </div>
                                  {r.category === 'Troubleshooting' && (
                                    <button
                                      onClick={e => { e.stopPropagation(); router.push('/ticketing'); }}
                                      className="mt-1 inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded text-blue-600 hover:text-blue-800 transition-colors"
                                      style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                                      🎫 Ticketing
                                    </button>
                                  )}
                                </td>
                                {/* Sales */}
                                <td className="px-3 py-3 border-r border-gray-200 align-middle">
                                  <div className="text-xs font-semibold text-gray-700 leading-tight truncate">{r.sales_name || '—'}</div>
                                  {r.sales_division && <div className="text-[10px] text-purple-600 font-semibold truncate mt-0.5">{r.sales_division}</div>}
                                </td>
                                {/* Handler */}
                                <td className="px-3 py-3 border-r border-gray-200 align-middle">
                                  <div className="flex items-center gap-1">
                                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                                      style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}>
                                      {r.assign_name?.charAt(0)?.toUpperCase() || '?'}
                                    </div>
                                    <span className="text-[10px] font-bold text-gray-800 truncate">{r.assign_name}</span>
                                  </div>
                                </td>
                                {/* Status */}
                                <td className="px-3 py-3 border-r border-gray-200 align-middle">
                                  <StatusBadge status={r.status} />
                                  {!r.assigned_to && r.notes?.includes('[REQUEST SALES]') && (
                                    <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 text-[5px] font-bold text-white"
                                      style={{ background: '#2563eb' }}>
                                      📩 Req. Sales
                                    </span>
                                  )}
                                  {r.wa_sent_h1 && <p className="text-[9px] font-bold text-green-600 mt-0.5">✅ WA H-1</p>}
                                </td>
                                {/* Garansi */}
                                <td className="px-3 py-3 border-r border-gray-200 align-middle">
                                  {(r.category === 'Konfigurasi' || r.category === 'Konfigurasi & Training') && (r as any).warranty_years ? (() => {
                                    const wy = (r as any).warranty_years as number;
                                    const expiry = new Date(r.due_date + 'T00:00:00');
                                    expiry.setFullYear(expiry.getFullYear() + wy);
                                    const now = new Date(); now.setHours(0,0,0,0);
                                    const isIn = now <= expiry;
                                    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / 86400000);
                                    return (
                                      <div>
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                                          style={isIn ? { background: 'rgba(14,165,233,0.15)', color: '#0369a1' } : { background: 'rgba(239,68,68,0.12)', color: '#dc2626' }}>
                                          {isIn ? '🛡️' : '⚠️'} {isIn ? 'In' : 'Out'}
                                        </span>
                                        <div className="text-[9px] text-gray-400 mt-0.5">{wy}Y · {isIn ? `sisa ${diffDays}h` : `lewat ${Math.abs(diffDays)}h`}</div>
                                      </div>
                                    );
                                  })() : <span className="text-gray-300 text-xs">—</span>}
                                </td>
                                {/* Tanggal */}
                                <td className="px-2 py-1 border-r border-gray-200 align-middle">
                                  <div className="inline-flex flex-col items-center px-2 py-1 rounded-lg text-center"
                                    style={{
                                      background: today ? 'rgba(220,38,38,0.12)' : 'rgba(99,102,241,0.08)',
                                      border: today ? '1px solid rgba(220,38,38,0.35)' : '1px solid rgba(99,102,241,0.2)',
                                    }}>
                                    <span className="text-base font-black leading-none" style={{ color: today ? '#dc2626' : '#4f46e5' }}>
                                      {new Date(r.due_date + 'T00:00:00').getDate()}
                                    </span>
                                    <span className="text-[8px] font-bold uppercase leading-tight" style={{ color: today ? '#dc2626' : '#6366f1' }}>
                                      {new Date(r.due_date + 'T00:00:00').toLocaleDateString('id-ID', { month: 'short', year: '2-digit' })}
                                    </span>
                                    {r.due_time && <span className="text-[8px] text-gray-400 leading-tight">{r.due_time}</span>}
                                  </div>
                                </td>
                                {/* ACT */}
                                <td className="px-3 py-1 align-middle text-center" onClick={e => e.stopPropagation()}>
                                  <ActionGroup>
                                    {/* Detail */}
                                    <ViewIconBtn onClick={() => setDetailReminder(r)} title="Detail" />
                                    {/* Re-Schedule — semua team PTS & admin bisa lihat */}
                                    {(isAdmin || currentUser?.role === 'team') && r.status !== 'done' && (
                                      <RescheduleIconBtn onClick={() => setRescheduleTarget(r)} title="Re-Schedule" />
                                    )}
                                    {/* Approve & Assign — admin only, hanya utk request sales yg belum di-assign */}
                                    {isAdmin && !r.assigned_to && r.notes?.includes('[REQUEST SALES]') && (
                                      <ApproveIconBtn onClick={() => { setApproveTarget(r); setApproveAssignTo(''); setApproveDate(r.due_date); setApproveTime(r.due_time); }} title="Approve & Assign" pulse />
                                    )}
                                    {/* Hapus — admin only */}
                                    {isAdmin && (
                                      <DeleteIconBtn onClick={() => openDeleteModal(r)} title="Hapus" />
                                    )}
                                  </ActionGroup>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <div className="flex items-center justify-between px-5 py-2.5 border-t border-gray-200" style={{ background: 'rgba(255,255,255,0.97)' }}>
                        <span className="text-[10px] text-gray-400">{filteredReminders.length} jadwal ditemukan</span>
                        <span className="text-[10px] text-gray-400">{filteredReminders.length > 0 ? `1–${filteredReminders.length}` : '0'} of {reminders.length}</span>
                      </div>
                    </div>{/* end hidden md:block */}
                    </>{/* end fragment */}
                  )}
                </div>

                {/* ── MINI CALENDAR SIDEBAR — hanya tampil untuk admin & team, disembunyikan untuk guest/sales ── */}
                {!isGuest && (
                  <MiniCalendar
                    reminders={reminders}
                    calendarMonth={calendarMonth}
                    setCalendarMonth={setCalendarMonth}
                    selectedCalDay={calOnlyDay}
                    setSelectedCalDay={setCalOnlyDay}
                  />
                )}
              </div>
            </>
          )}

          {/* ─── FORM VIEW ── (digantikan oleh showFormModal popup) */}

        </div>

      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity:0; transform:translateY(14px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes scale-in {
          from { opacity:0; transform:scale(0.92); }
          to   { opacity:1; transform:scale(1); }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
          40% { transform: scale(1); opacity: 1; }
        }
        select option { background: #ffffff; color: #1e293b; }
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(0.3); cursor: pointer; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(220,38,38,0.25); border-radius: 4px; }
      `}</style>
    </div>
  );
}

export default function ReminderSchedulePage() {
  return (
    <Suspense>
      <ReminderSchedulePageInner />
    </Suspense>
  );
}
