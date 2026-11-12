'use client';

import { useState, useEffect } from 'react';
import { clearSession, getSession } from '@/lib/auth/sesi';

import { CATEGORY_CONFIG, type TeamUser, type GuestUser } from '@/lib/jadwal/tampilan';

import { todayISO, type ReminderActivity, type TicketActivity, type ManualActivity, type TeamEntry, type DailyReport, hapusAktivitasManual } from './_components/shared';

import { hasFullAccess } from '@/lib/constants';
import { isPimpinan } from '@/lib/pimpinan';
import { useKelompokPTSDitugaskan } from '@/lib/kelompok/inti';

import { LoadingScreen, ModalPortal, ConfirmDialog, type ConfirmState } from '@/components/shared';
import { PageHeader } from '@/components/shared';
import { sb, PW, Toast, type FlatRow } from './_components/bantu-halaman';
import { IsiLaporan } from './_components/IsiLaporan';
import { DetailLaporan } from './_components/DetailLaporan';
import { FormLaporan } from './_components/FormLaporan';
import { useFormLaporan } from './_components/useFormLaporan';
import { useDrafLaporan } from './_components/useDrafLaporan';
import { useDataLaporan } from './_components/useDataLaporan';
import { useMuatLaporan } from './_components/useMuatLaporan';
import { KonteksLaporan, type NilaiKonteksLaporan } from './_components/konteks-laporan';
import { KonteksFormLaporan } from './_components/konteks-form-laporan';

export default function DailyReportPage() {
  const [appReady, setAppReady]       = useState(false);
  const [currentUser, setCurrentUser] = useState<TeamUser | null>(null);
  const [teamUsers, setTeamUsers]     = useState<TeamUser[]>([]);
  const kelompokPTS = useKelompokPTSDitugaskan();
  const judulKelompokPTS = kelompokPTS.length === 1
    ? kelompokPTS[0].nama
    : `Team PTS (${kelompokPTS.map(k => k.label).join(' & ')})`;
  const [guestUsers, setGuestUsers]   = useState<GuestUser[]>([]);

  const [liveReminders, setLiveReminders] = useState<(ReminderActivity & { handler_username?: string; report_date?: string })[]>([]);
  const [liveTickets, setLiveTickets]     = useState<(TicketActivity & { handler_username?: string; report_date?: string })[]>([]);
  const [liveLoading, setLiveLoading]     = useState(false);

  const [reports, setReports]         = useState<DailyReport[]>([]);

  const [filterDate, setFilterDate]   = useState('');
  const [filterUser, setFilterUser]   = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [searchProject, setSearchProject] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterHandler, setFilterHandler]   = useState<string | null>(null);
  const [filterDivision, setFilterDivision] = useState<string | null>(null);
  const [filterProduct, setFilterProduct]   = useState<string | null>(null);

  const [formOpen, setFormOpen]       = useState(false);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [formDate, setFormDate]       = useState(todayISO());
  const [formUserId, setFormUserId]   = useState('');
  const [reminderNotes, setReminderNotes] = useState('');
  const [menyusun, setMenyusun] = useState(false);
  const [galatSusun, setGalatSusun] = useState('');
  const [formReminders, setFormReminders] = useState<ReminderActivity[]>([]);
  const [formTickets, setFormTickets]     = useState<TicketActivity[]>([]);
  const [manualActs, setManualActs]       = useState<ManualActivity[]>([]);
  const [teamEntries, setTeamEntries]     = useState<TeamEntry[]>([]);
  const [formLoading, setFormLoading]     = useState(false);
  const [saving, setSaving]               = useState(false);

  const [modalRow, setModalRow]       = useState<any | null>(null);

  const [toast, setToast]             = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const notify = (type: 'success' | 'error', msg: string) => { setToast({ type, msg }); setTimeout(() => setToast(null), 3500); };
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const bolehHapus = (row: any): boolean => {
    if (!row.report_id || row.manual_index === undefined || !currentUser) return false;
    const r = reports.find(x => x.id === row.report_id);
    if (!r) return false;
    return isAdmin || r.user_id === currentUser.id;
  };

  const mintaHapus = (row: any) => {
    const r = reports.find(x => x.id === row.report_id);
    if (!r || row.manual_index === undefined) return;
    setConfirmState({
      message: 'Hapus aktivitas ini dari Daily Report?',
      description: `"${row.project_name}" (${row.report_date}) akan dihapus dari laporan. Aktivitas lain di laporan yang sama tidak terpengaruh.`,
      danger: true,
      confirmLabel: 'Hapus',
      onConfirm: async () => {
        const sisa = r.manual_activities.filter((_, i) => i !== row.manual_index);
        const hasil = await hapusAktivitasManual(r.id, sisa);
        if (!hasil.ok) { notify('error', hasil.error); return; }
        notify('success', 'Aktivitas dihapus.');
        await loadReports();
      },
    });
  };

  const isAdmin = hasFullAccess(currentUser);
  const pimpinan = isPimpinan(currentUser);
  const lihatSemua = isAdmin || pimpinan;

  useEffect(() => {
    const user = getSession<TeamUser>();
    if (!user) {
      const target = window.top !== window ? window.top : window;
      if (target) target.location.href = '/dashboard';
      return;
    }
    setCurrentUser(user);
    Promise.all([loadTeamUsers(), loadGuestUsers()]).then(() => setAppReady(true));
    const iv = setInterval(() => {
      if (!getSession()) {
        clearSession();
        const w = window.top !== window ? window.top : window;
        if (w) w.location.href = '/dashboard';
      }
    }, 60000);
    return () => clearInterval(iv);
  }, []);

  const { loadTeamUsers, loadGuestUsers, loadLiveData, loadReports } = useMuatLaporan({ currentUser, filterDate, filterUser, lihatSemua, setGuestUsers, setLiveLoading, setLiveReminders, setLiveTickets, setReports, setTeamUsers, teamUsers });

  useEffect(() => {
    if (!currentUser) return;
    if (lihatSemua && teamUsers.length === 0) return;
    loadLiveData();
    loadReports();
  }, [currentUser, lihatSemua, teamUsers, filterDate, filterUser]);

  const { filteredRows, dataEkspor, hal, stats, belumLaporHariIni, catPieData, handlerPieData, divisionPieData, productPieData } = useDataLaporan({ filterCategory, filterDate, filterDivision, filterHandler, filterProduct, filterSource, filterStatus, filterUser, lihatSemua, liveReminders, liveTickets, reports, searchProject, teamUsers });

  const { bacaDraf, hapusDraf, pulihkanDraf } = useDrafLaporan({ currentUser, editingId, formDate, formOpen, formUserId, manualActs, notify, reminderNotes, saving, setManualActs, setReminderNotes });

  const { openNewForm, openEditForm, handleSave, updM, updT } = useFormLaporan({ bacaDraf, currentUser, editingId, formDate, formOpen, formReminders, formTickets, formUserId, hapusDraf, isAdmin, loadLiveData, loadReports, manualActs, notify, pulihkanDraf, reminderNotes, setEditingId, setFormDate, setFormLoading, setFormOpen, setFormReminders, setFormTickets, setFormUserId, setManualActs, setReminderNotes, setSaving, setTeamEntries, teamEntries, teamUsers });

  if (!appReady) return <LoadingScreen />;

  const susunDenganAI = async () => {
    setMenyusun(true); setGalatSusun('');
    try {
      const r = await fetch('/api/asisten/draf-daily-report', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tanggal: formDate, jadwal: formReminders, tiket: formTickets, manual: manualActs }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.alasan ?? 'Gagal menyusun draf.');
      setReminderNotes(prev => (prev.trim() ? `${prev.trim()}\n\n${j.draf}` : j.draf));
    } catch (e) {
      setGalatSusun((e as Error).message);
    } finally {
      setMenyusun(false);
    }
  };

  const FormModal = () => {
    if (!formOpen) return null;
    const targetUser = isAdmin ? teamUsers.find(u => u.id === formUserId) : currentUser;
    const autoCount = formReminders.length + formTickets.length;
    return (
    <ModalPortal>
      <KonteksFormLaporan.Provider value={{
        nilai: { autoCount, currentUser, editingId, formDate, formLoading, formReminders, formTickets, formUserId, galatSusun, guestUsers, isAdmin,
          manualActs, menyusun, reminderNotes, saving, targetUser, teamEntries, teamUsers },
        ubah: { setEditingId, setFormDate, setFormOpen, setFormUserId, setManualActs, setReminderNotes },
        aksi: { handleSave, hapusDraf, susunDenganAI, updM, updT },
      }}>
        <FormLaporan />
      </KonteksFormLaporan.Provider>
    </ModalPortal>
    );
  };

  const DetailModal = () => {
    if (!modalRow) return null;
    const row: FlatRow = modalRow;
    const c = CATEGORY_CONFIG[row.category] ?? CATEGORY_CONFIG['Internal'];
    const badge = sb(row.status);
    const linkedReport = row.report_id ? reports.find(r => r.id === row.report_id) : undefined;
    return (
    <ModalPortal>
      <DetailLaporan
        badge={badge} c={c} linkedReport={linkedReport} openEditForm={openEditForm} openNewForm={openNewForm} pimpinan={pimpinan} reports={reports} row={row} setModalRow={setModalRow}
      />
    </ModalPortal>
    );
  };

  const konteksLaporan: NilaiKonteksLaporan = {
    sesi: { judulKelompokPTS, lihatSemua, pimpinan, teamUsers },
    izin: { bolehHapus },
    data: { belumLaporHariIni, dataEkspor, filteredRows, hal, liveLoading, loadLiveData, loadReports, reports },
    ringkasan: { catPieData, divisionPieData, handlerPieData, productPieData, stats },
    filter: { filterCategory, filterDate, filterDivision, filterHandler, filterProduct, filterSource, filterStatus, filterUser, searchProject, setFilterCategory, setFilterDate,
      setFilterDivision, setFilterHandler, setFilterProduct, setFilterSource, setFilterStatus, setFilterUser, setSearchProject },
    aksi: { mintaHapus, openEditForm, setModalRow },
  };
  return (
    <PW>
      <PageHeader icon="📋" title="Daily Report" subtitle="PTS IVP & MVI">
        {!pimpinan && (
          <button onClick={openNewForm}
            className="tombol-utama flex items-center gap-1.5 px-4 py-2 rounded-kontrol font-bold text-sm hover:scale-[1.02] transition-all">
            <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            + Tambah Report
          </button>
        )}
      </PageHeader>

      <KonteksLaporan.Provider value={konteksLaporan}>

        <IsiLaporan />

      </KonteksLaporan.Provider>

      {FormModal()}
      {DetailModal()}
      <ConfirmDialog state={confirmState} onCancel={() => setConfirmState(null)} />
      <Toast t={toast} />
    </PW>
  );
}
