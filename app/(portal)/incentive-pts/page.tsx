'use client';

import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import { supabase } from '@/lib/supabase';
import { getSession, startSessionWatcher } from '@/lib/auth';
import {
  IncentiveProjectRow, IncentiveTranche, IncentiveSplit, LateTicketLink,
  fetchIncentiveProjects, fetchTranches, fetchVisibleSplits, fetchSupportFromTickets, jendelaSupportTahap, fetchLateTickets,
  ambilSumberSupport, supportUntukProyek,
  deteksiKandidatGabung, satukanProyek, type KandidatGabung,
  setProyekDikeluarkan, tahapanSudahJalan,
  insertTranches, insertSplits, processYearlyBatch,
  batalkanBatchTahun, hapusTahapanProyek,
  calculateIncentiveSplits, validateSplitTotal, generateTranches, findUpline, resolveUserId, OrgUser,
  fetchOrgUsers,
  ambilSkema, persenInstaller, persenPicBerlaku, petaPorsiBerlaku, type SkemaInsentif,
  formatRupiah, formatPct,
  ROLE_LABELS, TRANCHE_STATUS,
} from './_components/calc';
import { setAksesIncentive, setBrandScopeIncentive } from '@/lib/incentive-akses-api';
import { simpanNominal } from '@/lib/incentive-nominal-api';
import {
  bisaKonfigPenuh, bisaInputNominal, tingkatAkses,
  LABEL_AKSES, JELAS_AKSES, URUTAN_AKSES, type TingkatAkses,
} from '@/lib/incentive-akses';
import { PageHeader, MobileListCard, MobileCardBadge, ModalPortal, ConfirmDialog, type ConfirmState, Paginasi, usePaginasi } from '@/components/shared';
import { logAudit } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { managerUtama } from '@/lib/penerima-admin';
import { SchemeTab } from './_components/SchemeTab';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { Toast } from '@/components/shared/Toast';
import { ModalKonfirmHapus } from './_components/ModalKonfirmHapus';
import { ModalKonfirmGabung } from './_components/ModalKonfirmGabung';
import { ModalHapusTahapan } from './_components/ModalHapusTahapan';
import { ModalBatalBatch } from './_components/ModalBatalBatch';
import { ModalKonfirmBatch } from './_components/ModalKonfirmBatch';
import { ModalHasilGenerateMassal } from './_components/ModalHasilGenerateMassal';
import { ModalKonfirmGenerateMassal } from './_components/ModalKonfirmGenerateMassal';
import { ModalGenerateTranche } from './_components/ModalGenerateTranche';

void insertSplits; void validateSplitTotal;

import { bolehLihatBrand, bisaKonfig, bisaInput, calcHandlerSplit, type CurrentUser, type TabKey } from './_components/aturan-halaman';
import { ModalDetailProyekInsentif } from './_components/ModalDetailProyekInsentif';
import { ModalNominalProyek } from './_components/ModalNominalProyek';
import { TabPengaturanAkses } from './_components/TabPengaturanAkses';
import { TabJadwalTranche } from './_components/TabJadwalTranche';
import { TabelProyekInsentif } from './_components/TabelProyekInsentif';
import { DaftarProyekInsentifHP } from './_components/DaftarProyekInsentifHP';
import { FilterProyekInsentif } from './_components/FilterProyekInsentif';
import { usePengaturanInsentif } from './_components/usePengaturanInsentif';
import { useGabungHapusProyek } from './_components/useGabungHapusProyek';
import { useMuatInsentif } from './_components/useMuatInsentif';
import { useEksporInsentif } from './_components/useEksporInsentif';
import { useTahapanInsentif } from './_components/useTahapanInsentif';
import { IsiInsentif } from './_components/IsiInsentif';

export default function IncentivePTSPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [appReady, setAppReady] = useState(false);
  const [tab, setTab] = useState<TabKey>('projects');
  /** Skema pembagian yang berlaku - sumber tunggal seluruh angka di layar ini. */
  const [skema, setSkema] = useState<SkemaInsentif | null>(null);

  const [projects, setProjects] = useState<IncentiveProjectRow[]>([]);
  const [tranches, setTranches] = useState<(IncentiveTranche & { project: IncentiveProjectRow })[]>([]);
  const [allSplits, setAllSplits] = useState<IncentiveSplit[]>([]);
  const [allUsers, setAllUsers] = useState<CurrentUser[]>([]);
  const [ptsTeamMappings, setPtsTeamMappings] = useState<{ staff_user_id: string; supervisor_user_id: string }[]>([]);
  // project_name  set username/full_name (lowercase) yang membantu di ticket Troubleshooting
  const [supportMap, setSupportMap] = useState<Map<string, Set<string>>>(new Map());
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
  const [searchProject, setSearchProject] = useState('');
  /** ID project yang lencana brand-nya lagi dibuka jadi picker set manual - null = tidak ada yang dibuka. */
  const [brandEditFor, setBrandEditFor] = useState<string | null>(null);

  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchConfirm, setBatchConfirm] = useState(false);
  const [batchYear, setBatchYear] = useState<number>(new Date().getFullYear());

  const [detailProject, setDetailProject] = useState<IncentiveProjectRow | null>(null);
  const [detailSplits, setDetailSplits] = useState<IncentiveSplit[]>([]);
  const [detailTranches, setDetailTranches] = useState<IncentiveTranche[]>([]);
  /**
   * Support per TAHUN pencairan, bukan satu daftar untuk seluruh proyek.
   * Yang menangani Troubleshooting di tahun berjalan ikut dapat bagian pada
   * pencairan tahun itu - tahun berikutnya dinilai ulang dari awal.
   */
  const [detailSupports, setDetailSupports] = useState<
    { tahunKe: number; dari: string | null; sampai: string | null; orang: { user_id: string; user_name: string }[] }[]
  >([]);

  const [nominalProject, setNominalProject] = useState<IncentiveProjectRow | null>(null);
  const [nominalValue, setNominalValue] = useState('');
  //  BAST bisa dibetulkan dari modal ini - lihat alasannya di modalnya.
  const [nominalBast, setNominalBast] = useState('');
  const [savingNominal, setSavingNominal] = useState(false);

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateProject, setGenerateProject] = useState<IncentiveProjectRow | null>(null);

  /*
    Filter Tahun BAST pada daftar Project - beda dari `filterYear`/`tahunAktif`
    di tab Tahapan Pencairan (itu menyaring payment_year milik tahapan yang
    SUDAH dibuat). Ini menyaring proyek berdasar tahun kapan pekerjaannya
    selesai (bast_date), supaya daftar tidak makin panjang tiap tahun platform
    berjalan, dan supaya Generate Tahapan Massal di bawah tahu proyek mana
    yang termasuk "tahun ini".
  */
  const [filterBastYear, setFilterBastYear] = useState<number | null>(null);
  const [bulkGenerateConfirm, setBulkGenerateConfirm] = useState<IncentiveProjectRow[] | null>(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkGenerateResult, setBulkGenerateResult] =
    useState<{ tahun: number; berhasil: string[]; gagal: { nama: string; alasan: string }[]; dilewati: string[] } | null>(null);
  const [summaryExportYear, setSummaryExportYear] = useState<number | null>(null);

  /*
    PEMBATALAN - dua tingkat, dua keadaan terpisah.

    Keduanya memakai konfirmasi KETIK ULANG, bukan sekadar tombol "Ya". Aksi
    yang menghapus baris uang tidak boleh bisa diselesaikan dengan satu klik
    refleks di dialog yang tampilannya sama dengan dialog lain.
  */
  const [batalBatch, setBatalBatch] = useState<number | null>(null);
  const [ketikBatalBatch, setKetikBatalBatch] = useState('');
  const [hapusTahapan, setHapusTahapan] = useState<IncentiveProjectRow | null>(null);
  const [ketikHapusTahapan, setKetikHapusTahapan] = useState('');
  const [membatalkan, setMembatalkan] = useState(false);
  const [generating, setGenerating] = useState(false);
  // C4: guard klik-ganda + modal konfirmasi untuk "Tandai Paid"
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const [exporting, setExporting] = useState(false);
  const [exportingSaya, setExportingSaya] = useState(false);
  const [lateTickets, setLateTickets] = useState<LateTicketLink[]>([]);

  const notify = (type: 'success' | 'error', msg: string) => { setToast({ type, msg }); setTimeout(() => setToast(null), 4000); };

  useEffect(() => {
    const u = getSession<CurrentUser>();
    // Saat di dalam iframe dashboard, redirect window INDUK (bukan iframe) agar tidak
    // muncul dashboard-di-dalam-dashboard (layer dobel). Konsisten dgn modul lain.
    if (!u) { const target = window.top !== window ? window.top : window; if (target) target.location.href = '/dashboard'; return; }
    setCurrentUser(u);
    /*
      Tingkat akses dibaca ULANG dari basis data, tidak dipercayakan pada
      salinan sesi di peramban: sesi bisa berumur berhari-hari, sementara
      aksesnya baru saja diubah dari layar Pengaturan Akses. Yang dipakai
      layar harus sama dengan yang dipakai RLS, kalau tidak tombolnya
      terlihat tapi penyimpanannya ditolak diam-diam.
    */
    supabase.from('users').select('incentive_akses, allow_incentive_input, incentive_brand_scope').eq('username', u.username as string).single()
      .then(({ data }: { data: { incentive_akses: string | null; allow_incentive_input: boolean; incentive_brand_scope: string | null } | null }) => {
        if (data) setCurrentUser(prev => prev ? { ...prev, incentive_akses: data.incentive_akses, allow_incentive_input: data.allow_incentive_input, incentive_brand_scope: data.incentive_brand_scope } : prev);
      });
    loadAll().then(() => setAppReady(true));
    const cleanup = startSessionWatcher();
    return cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { loadAll, openProjectDetail } = useMuatInsentif({ allUsers, setAllSplits, setAllUsers, setDetailProject, setDetailSplits, setDetailSupports, setDetailTranches, setLateTickets, setLoading, setProjects, setPtsTeamMappings, setSkema, setSupportMap, setTranches, skema });

  /*
    Mengeluarkan proyek dari daftar Incentive.

    "Hapus" di sini TIDAK menghapus jadwalnya. Daftar Incentive diturunkan dari
    Request Schedule, jadi menghapus barisnya berarti ikut menghapus riwayat
    pekerjaan yang tidak bersalah - padahal yang ingin dibatalkan cuma
    perhitungan insentifnya. Yang berubah hanya penanda `incentive_excluded`,
    dan Request Schedule punya tombol untuk mengembalikannya.
  */
  /*
    Dulu baris ini memakai bolehKelolaIncentive() dari lib/kelompok - aturan
    KETIGA di modul yang sama, di samping isAdmin dan canInputNominal, dan
    satu-satunya yang mengenal Manager PTS (lewat jabatan + team_type yang
    dipaku di kode). Tiga aturan untuk satu pertanyaan berarti tiga jawaban
    yang bisa berbeda: itulah sebabnya Manager PTS bisa menggabungkan dan
    mengeluarkan proyek, tapi tidak bisa membuka Skema Pembagian.

    Sekarang satu aturan saja - tingkat akses dari basis data.
  */
  const bolehHapus = bisaKonfig(currentUser);

  /*
    Deteksi jadwal yang KEMUNGKINAN satu proyek - dan berhenti di situ.

    Satu proyek sering dikerjakan lewat beberapa jadwal: Konfigurasi Senin,
    Training tiga hari kemudian. Keduanya jadwal berbeda dengan kategori
    berbeda, jadi terbaca sebagai DUA proyek dengan dua pool nominal.

    Yang TIDAK dilakukan: menggabungkannya sendiri. "BPKP Aceh" dan "BPKP Aceh
    Tahap 2" bisa jadi dua kontrak, dan penggabungan otomatis yang keliru tidak
    terlihat siapa pun - insentif seseorang berkurang tanpa ada yang tahu.
    Duplikat yang dibiarkan justru cepat ketahuan, seperti yang sudah terjadi.
    Untuk data uang, kesalahan yang terlihat lebih baik daripada yang
    tersembunyi. Jadi platform menandai, orang yang memutuskan.

    Penandanya tanggal BAST, bukan kemiripan nama - lihat lib/kelompok-insentif.ts.
  */
  const kandidatGabung = useMemo(() => deteksiKandidatGabung(projects), [projects]);
  const [konfirmGabung, setKonfirmGabung] = useState<KandidatGabung | null>(null);
  const [menggabung, setMenggabung] = useState(false);

  const { jalankanGabung, pilihHapus, setPilihHapus, konfirmHapus, setKonfirmHapus, menghapus, setMenghapus, togglePilih, mintaKonfirmasiHapus, jalankanHapus } = useGabungHapusProyek({ currentUser, konfirmGabung, loadAll, notify, setKonfirmGabung, setMenggabung });

  //  Privasi list: non-privileged hanya melihat project di mana dia terlibat
  //  (handler/PIC, support dari ticket Troubleshooting, supervisor, atau manager).
  //
  //  Blok ini (sampai `hal`) HARUS dihitung di atas gerbang `!appReady` di
  //  bawah - usePaginasi() di dalamnya adalah HOOK React. Sebelumnya blok ini
  //  ada SESUDAH `if (!appReady) return (...)`, jadi render pertama (appReady
  //  masih false) melompati usePaginasi() sama sekali, sementara render
  //  berikutnya (sesudah loadAll() selesai) memanggilnya - jumlah hook yang
  //  dipanggil jadi beda antar render, dan React melempar error #310
  //  ("Rendered more hooks than during the previous render"), meng-crash
  //  SELURUH halaman. Menyalakan hook ini di setiap render (apa pun nilai
  //  appReady) menghapus akar masalahnya.
  const canSeeAll = bisaInput(currentUser);
  const orgListAll = allUsers as unknown as OrgUser[];
  /*
    mySplitProjectIds: proyek tempat aku SUDAH TERCATAT punya bagian
    (incentive_splits), terlepas dari siapa PIC/handler proyek itu SEKARANG.

    Kenapa ini perlu di samping pengecekan field proyek di bawah: kalau PIC
    sebuah proyek diganti sesudah tahapannya diproses/dibayar (orang resign,
    kesalahan data dibetulkan, reassign) - orang LAMA yang bagiannya sudah
    Paid dan nominalnya tercatat permanen di incentive_splits akan kehilangan
    akses melihat proyek itu SAMA SEKALI, karena userInProject() di bawah cuma
    membaca field proyek SAAT INI (pic_id/assigned_to/assign_name), bukan
    "apakah aku pernah tercatat dapat bagian di sana". Uang yang sudah cair
    tidak boleh "hilang" dari pandangan pemiliknya hanya karena administrasi
    proyeknya berubah belakangan.

    allSplits SUDAH tersaring privasi dari server (lihat fetchVisibleSplits di
    calc.ts / GET /api/incentive/splits): utk akses 'lihat' isinya HANYA
    baris miliknya sendiri, jadi memakainya di sini tidak membocorkan bagian
    siapa pun - persis dataset yang sama yang sudah dipercaya untuk mengisi
    "Bagian Saya" di modal detail.
  */
  const mySplitProjectIds = new Set(allSplits.map(s => s.project_id));
  const userInProject = (p: IncentiveProjectRow): boolean => {
    if (!currentUser) return false;
    if (mySplitProjectIds.has(p.id)) return true;                              // sudah tercatat dapat bagian - lihat catatan di atas
    const uid = currentUser.id;
    const uname = (currentUser.username || '').toLowerCase();
    const ufull = (currentUser.full_name || '').toLowerCase();
    if (uid && p.pic_id && p.pic_id === uid) return true;                       // PIC by id
    if (uname && (p.assigned_to || '').toLowerCase() === uname) return true;    // handler by username
    if (ufull && (p.assign_name || '').toLowerCase() === ufull) return true;    // handler by name
    const sup = supportMap.get(p.project_name);                                 // support (troubleshooting)
    if (sup && ((uname && sup.has(uname)) || (ufull && sup.has(ufull)))) return true;
    const picId = resolveUserId((p.pic_id || p.assigned_to) as string, p.assign_name, orgListAll);
    if (uid && findUpline(picId, 'Supervisor', orgListAll)?.id === uid) return true; // supervisor
    if (uid && findUpline(picId, 'Manager', orgListAll)?.id === uid) return true;    // manager
    return false;
  };
  const filteredProjects = projects.filter(p =>
    (!searchProject || p.project_name.toLowerCase().includes(searchProject.toLowerCase()) || (p.assign_name || '').toLowerCase().includes(searchProject.toLowerCase()))
  ).filter(p => canSeeAll || userInProject(p))
    /*
      Saringan lingkup brand. Dua petugas Finance tidak boleh saling melihat
      nominal proyek yang bukan urusannya - nominal insentif adalah data
      kredensial, bukan sekadar angka.

      Admin (lingkupnya kosong) tetap melihat semuanya; ia memang yang
      menunjuk keduanya dan yang merekap ke Finance.
    */
    .filter(p => bolehLihatBrand(currentUser?.incentive_brand_scope, p.brand))
    .filter(p => filterBastYear == null
      || (p.bast_date && new Date(p.bast_date).getFullYear() === filterBastYear));
  //  Tahun BAST yang benar-benar ada di daftar proyek - sumber pilihan untuk
  //  filter Project list DAN dropdown tahun Export Summary. Diurutkan turun:
  //  tahun berjalan/terbaru duluan, itu yang paling sering dicari.
  const bastYearsProjects = [...new Set(
    projects.filter(p => p.bast_date).map(p => new Date(p.bast_date as string).getFullYear()),
  )].sort((a, b) => b - a);

  /*
    Kartu "Insentif Saya" - ringkasan personal, bukan cuma bisa dilihat lewat
    menggulir tabel proyek satu-satu. Ikut Filter Tahun BAST yang sama dengan
    tabel di bawahnya supaya angkanya selalu konsisten dengan yang sedang
    dilihat, bukan diam-diam total sepanjang masa.

    Aman untuk SEMUA tingkat akses: allSplits sudah difilter privasi dari
    server (tier 'lihat' cuma menerima baris miliknya sendiri), dan di sini
    disaring lagi eksplisit by user_id - untuk tier 'input'/'penuh' yang
    allSplits-nya berisi SEMUA orang, filter ini memastikan kartu ini tetap
    cuma menghitung bagian milik currentUser sendiri, bukan seluruh tim.
  */
  const trancheById = new Map(tranches.map(t => [t.id, t]));
  const mySplitsInYear = currentUser
    ? allSplits.filter(s => {
        if (s.user_id !== currentUser.id) return false;
        if (filterBastYear == null) return true;
        const tr = s.tranche_id ? trancheById.get(s.tranche_id) : null;
        return tr ? tr.payment_year === filterBastYear : false;
      })
    : [];
  const myTotalInsentif = mySplitsInYear.reduce((sum, s) => sum + (s.amount || 0), 0);
  const myPaidInsentif = mySplitsInYear
    .filter(s => trancheById.get(s.tranche_id || '')?.status === 'paid')
    .reduce((sum, s) => sum + (s.amount || 0), 0);
  const myPendingInsentif = myTotalInsentif - myPaidInsentif;
  const myProjectCount = new Set(mySplitsInYear.map(s => s.project_id)).size;
  /*
    Paginasi hanya memotong BARIS yang dirender. Baris TOTAL di <tfoot>
    sengaja tetap dihitung dari seluruh filteredProjects - total yang cuma
    menjumlah 15 baris yang kebetulan sedang tampil adalah angka uang yang
    salah, dan itu jenis kesalahan yang tidak akan langsung terlihat.
  */
  const hal = usePaginasi(filteredProjects);

  const uniqueYears = [...new Set(tranches.map(t => t.payment_year))].sort();
  /*
    Tahun yang dipilih HARUS salah satu yang benar-benar ada tahapannya.

    Sebelumnya filterYear bermula dari tahun berjalan (mis. 2026) sementara
    daftar pilihannya berisi tahun pencairan (2027, 2028, 2029). Sebuah
    <select> yang nilainya tidak cocok dengan satu pun <option> menampilkan
    option PERTAMA - jadi layar tertulis "2027" padahal keadaan sebenarnya
    masih 2026. Akibatnya tabel kosong, tombolnya berbunyi "Process Batch
    2026", dan menekannya memproses tahun yang memang tidak punya tahapan:
    tidak ada galat, tidak ada hasil, dan tidak ada petunjuk kenapa.

    Dirapikan di sini, bukan di useEffect, supaya tahun yang dipakai menyaring
    dan yang tercetak di tombol selalu sama dengan yang terbaca di layar.
  */
  const tahunAktif = uniqueYears.includes(filterYear)
    ? filterYear
    : (uniqueYears[0] ?? filterYear);
  const filteredTranches = tranches.filter(t => t.payment_year === tahunAktif);
  const totalPool = projects.filter(p => (p.incentive_value || 0) > 0).reduce((s, p) => s + (p.incentive_value || 0), 0);
  const pendingNominal = projects.filter(p => !(p.incentive_value || 0)).length;
  const pendingTranche = tranches.filter(t => t.status === 'pending').length;

  const { handleSaveNominal, handleGenerateTranches, kandidatBulkGenerate, jalankanBulkGenerate, handleBatchProcess, jalankanBatalBatch, jalankanHapusTahapan } = useTahapanInsentif({ batalBatch, batchYear, bulkGenerateConfirm, currentUser, filterBastYear, filteredProjects, generateProject, hapusTahapan, loadAll, nominalBast, nominalProject, nominalValue, notify, setBatalBatch, setBatchConfirm, setBatchProcessing, setBulkGenerateConfirm, setBulkGenerateResult, setBulkGenerating, setGenerateProject, setGenerating, setHapusTahapan, setKetikBatalBatch, setKetikHapusTahapan, setMembatalkan, setNominalBast, setNominalProject, setNominalValue, setSavingNominal, setShowGenerateModal, skema, tranches });

  /**
   * Manager + peta Support yang dipakai KEDUA tombol export (Export Summary
   * di tab Project, Export Batch di tab Tranche Schedule) - satu sumber,
   * supaya angka yang tampil di dua berkas tidak pernah diam-diam menyimpang.
   *
   * Penilaian Support memakai aturan yang SAMA dengan mesin pembayaran.
   *
   * Di sini dulu ada salinan sendiri: satu kueri ke `reminders` saja, lalu
   * dikelompokkan dengan project_name apa adanya sebagai kunci. Dua hal yang
   * sudah lama diperbaiki di fetchSupportFromTickets hilang di salinan itu,
   * dan keduanya membuat kolom Support kosong tanpa pesan apa pun:
   *
   *   1. Ticket yang diselesaikan (tickets berstatus Solved) tidak dibaca
   *      sama sekali. Troubleshooting yang ditutup lewat Ticketing - tanpa
   *      pernah dijadwalkan ulang sebagai reminder Onsite - karena itu tidak
   *      pernah menghasilkan porsi Support.
   *   2. Nama proyek dicocokkan persis. "BPKP ICT TIMUR" dan "BPKP ICT
   *      Timur" jadi dua kunci berbeda, jadi catatan Troubleshooting-nya
   *      tidak pernah bertemu proyeknya.
   *
   * Sekarang sumbernya diambil sekali (tiga kueri untuk seluruh proyek,
   * bukan per proyek) lalu dicocokkan dengan fungsi yang sama yang dipakai
   * Process Batch - jadi yang tampil di rekap dan yang dibayar tidak bisa
   * berbeda.
   */
  const { siapkanDataExport, handleExportSummary, handleExportInsentifSaya, handleExportBatch } = useEksporInsentif({ allUsers, currentUser, filterBastYear, mySplitsInYear, notify, projects, setExporting, setExportingSaya, summaryExportYear, tahunAktif, trancheById, tranches });

  /*
    C4 (docs/UX-WORKFLOW-AUDIT.md): dulu tombol ini eksekusi langsung begitu
    diklik - tanpa modal konfirmasi, tanpa guard loading (klik ganda = dua
    request bersamaan), dan tanpa logAudit - kontras dengan Process Batch/
    Batalkan Batch/Hapus Tahapan di modul yang SAMA yang semuanya sudah
    lengkap ketiganya. "Tandai Paid" berarti uang sudah keluar - aksi paling
    final di alur ini, jadi pengamanannya disamakan, bukan dikurangi.
  */
  const { handleMarkPaid, konfirmasiMarkPaid, cariUser, setCariUser, handleSetBrandScope, handleSetAkses, handleSetProjectBrand } = usePengaturanInsentif({ currentUser, detailProject, loadAll, notify, openProjectDetail, setAllUsers, setConfirmState, setMarkingPaid, setProjects });

  if (!appReady) return (
    <div className="flex items-center justify-center" style={{ minHeight: '100%', background: 'var(--latar-halaman)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="flex flex-col items-center gap-3 bg-white/90 rounded-2xl px-8 py-6 shadow-xl">
        <div className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: 'rgba(99,102,241,0.2)', borderTopColor: '#f43f5e' }} />
        <p className="text-slate-500 text-sm font-semibold">Memuat Incentive PTS...</p>
      </div>
    </div>
  );

  const thCls = 'px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider border border-gray-200';

  return (
    <div className="h-screen overflow-hidden flex flex-col" style={{ fontFamily: "'Inter', sans-serif", background: 'var(--latar-halaman)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>

      <Toast notif={toast} />

      {/* Header - header baku semua modul (components/shared/PageHeader) */}
      <PageHeader icon="💰" title="Incentive PTS" subtitle="Insentif tim PTS per proyek & tranche pembayaran" color="#f43f5e">
          <div className="hidden sm:flex items-center gap-4 text-right">
            <div><p className="text-[11px] text-gray-500 uppercase font-bold tracking-wider">Total Pool</p><p className="text-sm font-black text-emerald-700">{formatRupiah(totalPool)}</p></div>
            <div><p className="text-[11px] text-gray-500 uppercase font-bold tracking-wider">Projects</p><p className="text-sm font-black text-rose-600">{projects.length}</p></div>
            <div><p className="text-[11px] text-gray-500 uppercase font-bold tracking-wider">Pending Nominal</p><p className="text-sm font-black text-amber-700">{pendingNominal}</p></div>
            <div><p className="text-[11px] text-gray-500 uppercase font-bold tracking-wider">Pending Tranche</p><p className="text-sm font-black text-rose-600">{pendingTranche}</p></div>
          </div>
      </PageHeader>

      {/* Tabs */}
      <div className="flex-shrink-0 z-40"
        style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(99,102,241,0.12)' }}>
        <div className="w-full px-4 flex gap-1 overflow-x-auto">
          {([
            { id: 'projects', label: '📋 Projects',            show: true },
            { id: 'tranches', label: '📅 Tranche Schedule',    show: bisaInput(currentUser) },
            { id: 'late',     label: '🕐 Late Ticket Queue',   show: bisaInput(currentUser) },
            { id: 'skema',    label: '🧮 Skema Pembagian',    show: bisaKonfig(currentUser) },
            { id: 'settings', label: '⚙️ Pengaturan Akses',   show: bisaKonfig(currentUser) },
          ] as { id: TabKey; label: string; show: boolean }[])
            .filter(t => t.show)
            .map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-all ${tab === t.id ? 'border-rose-500 text-rose-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {t.label}
              </button>
            ))}
        </div>
      </div>

      {/* Content */}
      <IsiInsentif
        allUsers={allUsers} bastYearsProjects={bastYearsProjects} bolehHapus={bolehHapus} brandEditFor={brandEditFor} cariUser={cariUser} currentUser={currentUser} exporting={exporting} exportingSaya={exportingSaya} filterBastYear={filterBastYear} filteredProjects={filteredProjects} filteredTranches={filteredTranches} hal={hal} handleExportBatch={handleExportBatch} handleExportInsentifSaya={handleExportInsentifSaya} handleExportSummary={handleExportSummary} handleSetAkses={handleSetAkses} handleSetBrandScope={handleSetBrandScope} handleSetProjectBrand={handleSetProjectBrand} kandidatBulkGenerate={kandidatBulkGenerate} kandidatGabung={kandidatGabung} konfirmasiMarkPaid={konfirmasiMarkPaid} lateTickets={lateTickets} loading={loading} markingPaid={markingPaid} mintaKonfirmasiHapus={mintaKonfirmasiHapus} myPaidInsentif={myPaidInsentif} myPendingInsentif={myPendingInsentif} myProjectCount={myProjectCount} mySplitsInYear={mySplitsInYear} myTotalInsentif={myTotalInsentif} notify={notify} openProjectDetail={openProjectDetail} pilihHapus={pilihHapus} searchProject={searchProject} setBatalBatch={setBatalBatch} setBatchConfirm={setBatchConfirm} setBatchYear={setBatchYear} setBrandEditFor={setBrandEditFor} setBulkGenerateConfirm={setBulkGenerateConfirm} setCariUser={setCariUser} setFilterBastYear={setFilterBastYear} setFilterYear={setFilterYear} setGenerateProject={setGenerateProject} setHapusTahapan={setHapusTahapan} setKetikBatalBatch={setKetikBatalBatch} setKetikHapusTahapan={setKetikHapusTahapan} setKonfirmGabung={setKonfirmGabung} setNominalBast={setNominalBast} setNominalProject={setNominalProject} setNominalValue={setNominalValue} setPilihHapus={setPilihHapus} setSearchProject={setSearchProject} setShowGenerateModal={setShowGenerateModal} setSummaryExportYear={setSummaryExportYear} skema={skema} summaryExportYear={summaryExportYear} tab={tab} tahunAktif={tahunAktif} thCls={thCls} togglePilih={togglePilih} totalPool={totalPool} tranches={tranches} uniqueYears={uniqueYears}
      />

      {/* ─── MODAL: Input Nominal ─── */}
      <ModalNominalProyek
        handleSaveNominal={handleSaveNominal} nominalBast={nominalBast} nominalProject={nominalProject} nominalValue={nominalValue} savingNominal={savingNominal} setNominalBast={setNominalBast} setNominalProject={setNominalProject} setNominalValue={setNominalValue} skema={skema}
      />

      {/* ─── MODAL: Project Detail ─── */}
      <ModalDetailProyekInsentif
        allUsers={allUsers} currentUser={currentUser} detailProject={detailProject} detailSplits={detailSplits} detailSupports={detailSupports} detailTranches={detailTranches} konfirmasiMarkPaid={konfirmasiMarkPaid} markingPaid={markingPaid} ptsTeamMappings={ptsTeamMappings} setDetailProject={setDetailProject} skema={skema}
      />

      {/* ─── MODAL: Generate Tranche ─── */}
      <ModalGenerateTranche
        generateProject={generateProject} generating={generating} handleGenerateTranches={handleGenerateTranches} setGenerateProject={setGenerateProject} setShowGenerateModal={setShowGenerateModal} showGenerateModal={showGenerateModal} skema={skema}
      />

      {/* ─── MODAL: Konfirmasi Generate Tahapan Massal ─── */}
      <ModalKonfirmGenerateMassal
        bulkGenerateConfirm={bulkGenerateConfirm} bulkGenerating={bulkGenerating} filterBastYear={filterBastYear} jalankanBulkGenerate={jalankanBulkGenerate} setBulkGenerateConfirm={setBulkGenerateConfirm}
      />

      {/* ─── MODAL: Hasil Generate Tahapan Massal ─── */}
      <ModalHasilGenerateMassal
        bulkGenerateResult={bulkGenerateResult} setBulkGenerateResult={setBulkGenerateResult}
      />

      {/* ─── MODAL: Batch Confirm ─── */}
      <ModalKonfirmBatch
        batchConfirm={batchConfirm} batchProcessing={batchProcessing} batchYear={batchYear} handleBatchProcess={handleBatchProcess} setBatchConfirm={setBatchConfirm} tranches={tranches}
      />

      {/* ─── MODAL: Batalkan Batch satu tahun ─── */}
      <ModalBatalBatch
        batalBatch={batalBatch} jalankanBatalBatch={jalankanBatalBatch} ketikBatalBatch={ketikBatalBatch} membatalkan={membatalkan} setBatalBatch={setBatalBatch} setKetikBatalBatch={setKetikBatalBatch} tranches={tranches}
      />

      {/* ─── MODAL: Hapus tahapan satu proyek ─── */}
      <ModalHapusTahapan
        hapusTahapan={hapusTahapan} jalankanHapusTahapan={jalankanHapusTahapan} ketikHapusTahapan={ketikHapusTahapan} membatalkan={membatalkan} setHapusTahapan={setHapusTahapan} setKetikHapusTahapan={setKetikHapusTahapan} tranches={tranches}
      />

      {/* ── Konfirmasi keluarkan dari Incentive ──────────────────────────────
          Dialognya menyebut apa yang HILANG dan apa yang TETAP. Kalimat
          "Yakin hapus?" saja membuat orang menebak-nebak seberapa jauh
          akibatnya, dan pada layar yang menyangkut nominal, menebak adalah
          hal yang paling ingin dihindari. Nama proyeknya ikut ditulis satu
          per satu supaya salah pilih ketahuan sebelum tombolnya ditekan. */}
      {/*
        Konfirmasi gabung. Menyebut akibatnya pada UANG, bukan cuma "yakin?".
        Yang berubah bukan tampilan: dua pool jadi satu, dan penangan jadwal
        kedua berpindah dari PIC ke Support - itu keputusan yang harus dibaca
        sebelum ditekan, bukan sesudahnya.
      */}
      <ModalKonfirmGabung
        jalankanGabung={jalankanGabung} konfirmGabung={konfirmGabung} menggabung={menggabung} setKonfirmGabung={setKonfirmGabung}
      />

      <ModalKonfirmHapus
        jalankanHapus={jalankanHapus} konfirmHapus={konfirmHapus} menghapus={menghapus} setKonfirmHapus={setKonfirmHapus}
      />

      <ConfirmDialog state={confirmState} onCancel={() => setConfirmState(null)} />
    </div>
  );
}
