'use client';

import { todayISO, fetchReminderActivities, fetchTicketActivities, fetchExistingReport, saveReport, saveTeamEntries, type ReminderActivity, type TicketActivity, type ManualActivity, type TeamEntry, type DailyReport } from './shared';
import { newManualKey, emptyManual, emptyTeamEntry } from './bantu-halaman';
import { useEffect } from 'react';
import { formatDate } from '@/lib/jadwal/aturan';
import { type TeamUser } from '@/lib/jadwal/tampilan';
import { logAudit } from '@/lib/audit';

export interface FormLaporanKonteks {
  bacaDraf: () => { formDate: string; formUserId: string; editingId: string | null; reminderNotes: string; manualActs: ManualActivity[]; waktu: number; } | null;
  currentUser: TeamUser | null;
  editingId: string | null;
  formDate: string;
  formOpen: boolean;
  formReminders: ReminderActivity[];
  formTickets: TicketActivity[];
  formUserId: string;
  hapusDraf: () => void;
  isAdmin: boolean;
  loadLiveData: () => Promise<void>;
  loadReports: () => Promise<void>;
  manualActs: ManualActivity[];
  notify: (type: "success" | "error", msg: string) => void;
  pulihkanDraf: (cocok: (d: { formDate: string; formUserId: string; editingId: string | null; reminderNotes: string; manualActs: ManualActivity[]; waktu: number; }) => boolean) => boolean;
  reminderNotes: string;
  setEditingId: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setFormDate: import("react").Dispatch<import("react").SetStateAction<string>>;
  setFormLoading: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setFormOpen: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setFormReminders: import("react").Dispatch<import("react").SetStateAction<ReminderActivity[]>>;
  setFormTickets: import("react").Dispatch<import("react").SetStateAction<TicketActivity[]>>;
  setFormUserId: import("react").Dispatch<import("react").SetStateAction<string>>;
  setManualActs: import("react").Dispatch<import("react").SetStateAction<ManualActivity[]>>;
  setReminderNotes: import("react").Dispatch<import("react").SetStateAction<string>>;
  setSaving: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setTeamEntries: import("react").Dispatch<import("react").SetStateAction<TeamEntry[]>>;
  teamEntries: TeamEntry[];
  teamUsers: TeamUser[];
}

export function useFormLaporan(k: FormLaporanKonteks) {
  const { bacaDraf, currentUser, editingId, formDate, formOpen, formReminders, formTickets, formUserId, hapusDraf, isAdmin, loadLiveData, loadReports, manualActs, notify, pulihkanDraf, reminderNotes, setEditingId, setFormDate, setFormLoading, setFormOpen, setFormReminders, setFormTickets, setFormUserId, setManualActs, setReminderNotes, setSaving, setTeamEntries, teamEntries, teamUsers } = k;
  const openNewForm = async () => {
    const date = todayISO();
    setFormDate(date); setFormUserId(isAdmin ? '' : currentUser?.id ?? '');
    setReminderNotes(''); setManualActs([emptyManual(currentUser?.username ?? '')]);
    setEditingId(null); setFormReminders([]); setFormTickets([]);
    if (isAdmin) setTeamEntries(teamUsers.map(u => emptyTeamEntry(u)));
    else setTeamEntries([]);
    const draf = bacaDraf();
    if (draf && !draf.editingId && pulihkanDraf(() => true)) {
      setFormDate(draf.formDate); setFormUserId(draf.formUserId);
    }
    if (!isAdmin && currentUser?.username) {
      setFormLoading(true);
      const [rem, tick] = await Promise.all([
        fetchReminderActivities(currentUser.username, date),
        fetchTicketActivities(currentUser.username, date),
      ]);
      setFormReminders(rem); setFormTickets(tick); setFormLoading(false);
    }
    setFormOpen(true);
  };

  const openEditForm = async (report: DailyReport) => {
    setFormDate(report.report_date); setFormUserId(report.user_id);
    setReminderNotes(report.reminder_notes ?? '');
    setManualActs((report.manual_activities ?? []).length
      ? report.manual_activities.map(m => ({ ...m, _key: newManualKey() }))
      : [emptyManual(currentUser?.username ?? '')]);
    setEditingId(report.id);
    pulihkanDraf(d => d.editingId === report.id);
    const username = isAdmin ? (teamUsers.find(u => u.id === report.user_id)?.username ?? '') : (currentUser?.username ?? '');
    setFormLoading(true);
    const [rem, tick] = await Promise.all([
      fetchReminderActivities(username, report.report_date),
      fetchTicketActivities(username, report.report_date),
    ]);
    setFormReminders(rem); setFormTickets(tick); setFormLoading(false);
    setFormOpen(true);
  };

  useEffect(() => {
    if (!formOpen) return;
    const username = isAdmin ? (teamUsers.find(u => u.id === formUserId)?.username ?? '') : (currentUser?.username ?? '');
    if (!username || !formDate) return;
    let cancelled = false;
    setFormLoading(true);
    Promise.all([fetchReminderActivities(username, formDate), fetchTicketActivities(username, formDate)]).then(([rem, tick]) => {
      if (!cancelled) { setFormReminders(rem); setFormTickets(tick); setFormLoading(false); }
    });
    return () => { cancelled = true; };
  }, [formDate, formUserId, formOpen]);

  const handleSave = async () => {
    const targetUserId = isAdmin ? formUserId : currentUser?.id ?? '';
    const targetUser = teamUsers.find(u => u.id === targetUserId) ?? currentUser;
    if (!formDate) { notify('error', 'Tanggal wajib dipilih!'); return; }
    if (!targetUserId) { notify('error', 'Pilih anggota team!'); return; }
    if (!editingId) {
      const existing = await fetchExistingReport(targetUserId, formDate);
      if (existing) { notify('error', `Report ${targetUser?.full_name} tgl ${formatDate(formDate)} sudah ada!`); return; }
    }
    setSaving(true);
    if (isAdmin && teamEntries.length) {
      const clean = teamEntries.filter(e => e.project_name.trim()).map(({ _key, ...rest }) => ({ ...rest, report_date: formDate, source: 'manual' as const }));
      if (clean.length) {
        let hasilTim: { ok: boolean; error?: string };
        try { hasilTim = await saveTeamEntries(clean as any, formDate, currentUser?.username ?? ''); }
        catch { hasilTim = { ok: false, error: 'koneksi terputus. Isian masih ada - coba simpan lagi.' }; }
        if (!hasilTim.ok) { notify('error', 'Gagal menyimpan isian tim: ' + hasilTim.error); setSaving(false); return; }
      }
    }
    const cleanManual = manualActs.filter(m => m.project_name.trim() || m.description.trim())
      .map(({ _key, ...rest }) => ({ ...rest, submitted_by: rest.submitted_by || currentUser?.username || 'system' }));
    let result: { ok: boolean; error?: string };
    try {
      result = await saveReport({
      ...(editingId ? { id: editingId } : {}),
      report_date: formDate, user_id: targetUserId, user_name: targetUser?.full_name ?? '',
      sales_division: targetUser?.sales_division ?? '',
      reminder_activities: formReminders, ticket_activities: formTickets,
      manual_activities: cleanManual, reminder_notes: reminderNotes,
      created_by: currentUser?.username ?? 'system',
      } as any);
    } catch {
      result = { ok: false, error: 'koneksi terputus. Isian masih ada - coba simpan lagi.' };
    }
    if (!result.ok) { notify('error', 'Gagal menyimpan: ' + result.error); setSaving(false); return; }
    hapusDraf();
    void logAudit({ user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '', action: editingId ? 'update' : 'create', module: 'daily-report', target_id: editingId ?? formDate, target_name: `Report ${targetUser?.full_name} - ${formDate}` });
    notify('success', editingId ? 'Report diperbarui!' : 'Report berhasil disimpan!');
    setSaving(false); setFormOpen(false); setEditingId(null);
    loadReports(); loadLiveData();
  };

  const updM = (key: string, p: Partial<ManualActivity>) => setManualActs(prev => prev.map(m => m._key === key ? { ...m, ...p } : m));
  const updT = (key: string, p: Partial<TeamEntry>) => setTeamEntries(prev => prev.map(e => e._key === key ? { ...e, ...p } : e));
  return { openNewForm, openEditForm, handleSave, updM, updT };
}
