'use client';

import { useState, useEffect, useCallback, useMemo, type CSSProperties } from 'react';
import { bisaDiklik } from '@/components/shared/bisaDiklik';
import { supabase } from '@/lib/supabase';
import { clearSession, getSession } from '@/lib/auth';

import {
  DAILY_REPORT_CATEGORIES, CATEGORY_CONFIG,
  formatDate,
  type TeamUser, type GuestUser,
} from '@/app/(portal)/reminder-schedule/_components/shared';

import {
  todayISO, formatLogTime,
  fetchAllReminders, fetchAllTickets,
  fetchReminderActivities, fetchTicketActivities,
  fetchExistingReport, fetchReports,
  saveReport, saveTeamEntries,
  type ReminderActivity, type TicketActivity,
  type ManualActivity, type TeamEntry,
  type DailyReport,
  hapusAktivitasManual, RENTANG_HARI } from './_components/shared';

import { logAudit } from '@/lib/audit';
import { hasFullAccess } from '@/lib/constants';
import { isPimpinan } from '@/lib/pimpinan';
import { namaKelompokPTSDitugaskan, useKelompokPTSDitugaskan } from '@/lib/kelompok';

import {
  FormField, SectionHeaderSmall, LoadingScreen, ListEmptyState, Username, ModalPortal, ConfirmDialog, type ConfirmState } from '@/components/shared';
import { MiniPieChart, PageHeader, StatCardGrid, Paginasi, usePaginasi, TombolEkspor } from '@/components/shared';
import type { Ekspor } from '@/lib/ekspor-tabel';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { Toast as ToastBersama } from '@/components/shared/Toast';
import { inp, inpCls, card, cardHdr, TH, TD, SB, sb, AVC, avc, ini, newManualKey, newTeamKey, emptyManual, emptyTeamEntry, PW, CatPicker, SalesDrop, Toast, type FlatRow } from './_components/bantu-halaman';
import { DaftarLaporanHarian } from './_components/DaftarLaporanHarian';
import { FilterLaporanHarian } from './_components/FilterLaporanHarian';
import { IsiLaporan } from './_components/IsiLaporan';
import { DetailLaporan } from './_components/DetailLaporan';
import { FormLaporan } from './_components/FormLaporan';
import { useFormLaporan } from './_components/useFormLaporan';
import { useDrafLaporan } from './_components/useDrafLaporan';
import { useDataLaporan } from './_components/useDataLaporan';
import { useMuatLaporan } from './_components/useMuatLaporan';

// MAIN
export default function DailyReportPage() {
  const [appReady, setAppReady]       = useState(false);
  const [currentUser, setCurrentUser] = useState<TeamUser | null>(null);
  const [teamUsers, setTeamUsers]     = useState<TeamUser[]>([]);
  /**
   * Judul grafik mengikuti kelompok yang benar-benar dirangkum. Menuliskan
   * "Team PTS IVP" di sana - seperti sebelumnya - membuat grafik yang berisi
   * dua kelompok mengaku berisi satu, dan itu jenis kekeliruan yang tidak akan
   * pernah dilaporkan siapa pun karena tampak wajar.
   */
  const kelompokPTS = useKelompokPTSDitugaskan();
  const judulKelompokPTS = kelompokPTS.length === 1
    ? kelompokPTS[0].nama
    : `Team PTS (${kelompokPTS.map(k => k.label).join(' & ')})`;
  const [guestUsers, setGuestUsers]   = useState<GuestUser[]>([]);

  // Live data (dari reminder + ticket platform, tanpa perlu submit dulu)
  const [liveReminders, setLiveReminders] = useState<(ReminderActivity & { handler_username?: string; report_date?: string })[]>([]);
  const [liveTickets, setLiveTickets]     = useState<(TicketActivity & { handler_username?: string; report_date?: string })[]>([]);
  const [liveLoading, setLiveLoading]     = useState(false);

  // Submitted reports
  const [reports, setReports]         = useState<DailyReport[]>([]);

  // Filter
  const [filterDate, setFilterDate]   = useState('');
  const [filterUser, setFilterUser]   = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [searchProject, setSearchProject] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterHandler, setFilterHandler]   = useState<string | null>(null);
  const [filterDivision, setFilterDivision] = useState<string | null>(null);
  const [filterProduct, setFilterProduct]   = useState<string | null>(null);

  // Form state
  const [formOpen, setFormOpen]       = useState(false);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [formDate, setFormDate]       = useState(todayISO());
  const [formUserId, setFormUserId]   = useState('');
  const [reminderNotes, setReminderNotes] = useState('');
  /** Draf ringkasan AI: sedang menyusun / pesan gagal. */
  const [menyusun, setMenyusun] = useState(false);
  const [galatSusun, setGalatSusun] = useState('');
  const [formReminders, setFormReminders] = useState<ReminderActivity[]>([]);
  const [formTickets, setFormTickets]     = useState<TicketActivity[]>([]);
  const [manualActs, setManualActs]       = useState<ManualActivity[]>([]);
  const [teamEntries, setTeamEntries]     = useState<TeamEntry[]>([]);
  const [formLoading, setFormLoading]     = useState(false);
  const [saving, setSaving]               = useState(false);

  // Modal detail
  const [modalRow, setModalRow]       = useState<any | null>(null);

  const [toast, setToast]             = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const notify = (type: 'success' | 'error', msg: string) => { setToast({ type, msg }); setTimeout(() => setToast(null), 3500); };
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  /**
   * Boleh hapus = PEMILIK laporan atau Admin/Full Access - aturan yang sama
   * dengan policy dr_ubah di basis data, jadi tombolnya tidak pernah
   * menjanjikan sesuatu yang nanti ditolak server.
   */
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

  // Admin/superadmin, ATAU akun Team PTS dengan toggle "Full Access" aktif
  // (lihat lib/constants.ts hasFullAccess).
  const isAdmin = hasFullAccess(currentUser);
  //  Akun pimpinan (lib/pimpinan.ts) MELIHAT laporan seluruh tim seperti admin, tetapi tidak
  //  menulis: tombol tambah disembunyikan dan basis data menolak tulis (migrasi 034).
  const pimpinan = isPimpinan(currentUser);
  const lihatSemua = isAdmin || pimpinan;

  // Init
  useEffect(() => {
    const user = getSession<TeamUser>();
    if (!user) {
      const target = window.top !== window ? window.top : window;
      if (target) target.location.href = '/dashboard';
      return;
    }
    setCurrentUser(user);
    Promise.all([loadTeamUsers(), loadGuestUsers()]).then(() => setAppReady(true));
    // session check
    const iv = setInterval(() => {
      if (!getSession()) {
        clearSession();
        const w = window.top !== window ? window.top : window;
        if (w) w.location.href = '/dashboard';
      }
    }, 60000);
    return () => clearInterval(iv);
  }, []);

  /**
   * Anggota tim yang pekerjaannya dirangkum di layar ini.
   *
   * Kelompoknya diambil dari lib/kelompok.ts, BUKAN ditulis di sini.
   * Sebelumnya baris ini berbunyi `team_type === 'Team PTS IVP'` - satu nama
   * kelompok yang terpaku di kode - sehingga seluruh anggota Team PTS MVI
   * tidak pernah masuk daftar. Akibatnya ticket dan reminder mereka tidak
   * pernah terangkum di Daily Report, dan namanya juga tidak bisa dipilih.
   * Judul halaman ini sendiri sudah lama berbunyi "PTS IVP & MVI".
   *
   * Kegagalannya tidak bersuara: layarnya tampil normal, hanya isinya separuh.
   *
   * Dengan namaKelompokPTS(), menambah kelompok PTS baru lewat Admin Panel
   * langsung ikut terangkum tanpa menyunting berkas ini lagi.
   */
  const { loadTeamUsers, loadGuestUsers, loadLiveData, loadReports } = useMuatLaporan({ currentUser, filterDate, filterUser, lihatSemua, setGuestUsers, setLiveLoading, setLiveReminders, setLiveTickets, setReports, setTeamUsers, teamUsers });

  useEffect(() => {
    if (!currentUser) return;
    // Untuk admin: tunggu teamUsers selesai load dulu (hindari fetch dengan usernames=[])
    if (lihatSemua && teamUsers.length === 0) return;
    loadLiveData();
    loadReports();
  }, [currentUser, lihatSemua, teamUsers, filterDate, filterUser]);

  // Build flat rows: gabung live data + manual dari submitted reports

  const { allRows, filteredRows, dataEkspor, hal, stats, belumLaporHariIni, PIE_C, catPieData, handlerPieData, divisionPieData, productPieData } = useDataLaporan({ filterCategory, filterDate, filterDivision, filterHandler, filterProduct, filterSource, filterStatus, filterUser, lihatSemua, liveReminders, liveTickets, reports, searchProject, teamUsers });

  /*
    Draf isian di perangkat: pernah terjadi simpan Daily Report hilang diam-diam (permintaan
    tidak sampai server, halaman di dalam iframe termuat ulang di tengah simpan). Isian manual
    & catatan disimpan sementara di localStorage selama form terbuka, lalu dipulihkan saat form
    dibuka lagi (tanggal/akun/report yang sama). Dihapus setelah berhasil simpan atau Batal.
  */
  const { kunciDraf, bacaDraf, hapusDraf, adaIsian, pulihkanDraf } = useDrafLaporan({ currentUser, editingId, formDate, formOpen, formUserId, manualActs, notify, reminderNotes, saving, setManualActs, setReminderNotes });

  // Form helpers
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
      <FormLaporan
        autoCount={autoCount} currentUser={currentUser} editingId={editingId} formDate={formDate} formLoading={formLoading} formReminders={formReminders} formTickets={formTickets} formUserId={formUserId} galatSusun={galatSusun} guestUsers={guestUsers} handleSave={handleSave} hapusDraf={hapusDraf} isAdmin={isAdmin} manualActs={manualActs} menyusun={menyusun} reminderNotes={reminderNotes} saving={saving} setEditingId={setEditingId} setFormDate={setFormDate} setFormOpen={setFormOpen} setFormUserId={setFormUserId} setManualActs={setManualActs} setReminderNotes={setReminderNotes} susunDenganAI={susunDenganAI} targetUser={targetUser} teamEntries={teamEntries} teamUsers={teamUsers} updM={updM} updT={updT}
      />
    </ModalPortal>
    );
  };

  // DETAIL MODAL (popup persis reminder-schedule)
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

  // MAIN LIST VIEW
  return (
    <PW>
      <PageHeader icon="📋" title="Daily Report" subtitle="PTS IVP & MVI" color="#059669" colorLight="#047857">
        {!pimpinan && (
          <button onClick={openNewForm}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm text-white hover:scale-[1.02] transition-all"
            style={{ background: 'linear-gradient(135deg,#059669,#047857)', boxShadow: '0 4px 14px rgba(5,150,105,0.4)' }}>
            <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            + Tambah Report
          </button>
        )}
      </PageHeader>

      <IsiLaporan
        belumLaporHariIni={belumLaporHariIni} bolehHapus={bolehHapus} catPieData={catPieData} dataEkspor={dataEkspor} divisionPieData={divisionPieData} filterCategory={filterCategory} filterDate={filterDate} filterDivision={filterDivision} filterHandler={filterHandler} filterProduct={filterProduct} filterSource={filterSource} filterStatus={filterStatus} filterUser={filterUser} filteredRows={filteredRows} hal={hal} handlerPieData={handlerPieData} judulKelompokPTS={judulKelompokPTS} lihatSemua={lihatSemua} liveLoading={liveLoading} loadLiveData={loadLiveData} loadReports={loadReports} mintaHapus={mintaHapus} openEditForm={openEditForm} pimpinan={pimpinan} productPieData={productPieData} reports={reports} searchProject={searchProject} setFilterCategory={setFilterCategory} setFilterDate={setFilterDate} setFilterDivision={setFilterDivision} setFilterHandler={setFilterHandler} setFilterProduct={setFilterProduct} setFilterSource={setFilterSource} setFilterStatus={setFilterStatus} setFilterUser={setFilterUser} setModalRow={setModalRow} setSearchProject={setSearchProject} stats={stats} teamUsers={teamUsers}
      />

      {/*  Dipanggil sebagai FUNGSI biasa ({FormModal()}), BUKAN elemen JSX
          (<FormModal />) - FormModal/DetailModal didefinisikan ulang di
          setiap render DailyReportPage (identitas fungsinya berubah tiap
          kali), jadi <FormModal /> membuat React melihat "tipe komponen
          baru" pada SETIAP keystroke di input mana pun di dalam modal
          (typing memanggil setState di parent -> re-render -> FormModal
          didefinisikan ulang). React lalu meng-unmount seluruh pohon modal
          lama dan mount ulang yang baru - input kehilangan fokus persis
          sebelum karakternya sempat kelihatan, terasa seperti modal
          tertutup/mundur sendiri padahal cuma mengetik satu huruf.
          Memanggilnya sebagai fungsi membuat JSX yang dikembalikan menyatu
          langsung ke pohon render DailyReportPage - React membandingkan
          elemen DOM sebenarnya (ModalPortal, div, input, ...) yang
          tipenya stabil antar render, bukan identitas FormModal. */}
      {FormModal()}
      {DetailModal()}
      <ConfirmDialog state={confirmState} onCancel={() => setConfirmState(null)} />
      <Toast t={toast} />
    </PW>
  );
}
