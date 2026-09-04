'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { exportSummaryIncentive } from './_components/exportPengajuan';
import { setAksesIncentive, setBrandScopeIncentive } from '@/lib/incentive-akses-api';
import {
  bisaKonfigPenuh, bisaInputNominal, tingkatAkses,
  LABEL_AKSES, JELAS_AKSES, URUTAN_AKSES, type TingkatAkses,
} from '@/lib/incentive-akses';
import { MobileListCard, MobileCardBadge, ModalPortal, ConfirmDialog, type ConfirmState } from '@/components/shared';
import { logAudit } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { managerUtama } from '@/lib/penerima-admin';
import { SchemeTab } from './_components/SchemeTab';

void insertSplits; void validateSplitTotal;

interface CurrentUser { id?: string; username?: string; full_name?: string; role?: string; team_type?: string; incentive_akses?: string | null; allow_incentive_input?: boolean; incentive_brand_scope?: string | null; [k: string]: unknown; }

/**
 * Proyek ini boleh dilihat oleh petugas dengan lingkup brand tertentu?
 *
 * Lingkup kosong = tanpa batas (admin, dan petugas yang belum ditetapkan
 * lingkupnya). Proyek "BOTH" terlihat oleh KEDUA petugas - ia memang milik
 * bersama, dan menyembunyikannya dari salah satu justru membuat proyeknya
 * tidak terinput sama sekali.
 *
 * Proyek tanpa brand juga ditampilkan, bukan disembunyikan: kalau ada yang
 * lolos tanpa brand, itu harus KELIHATAN supaya bisa dibetulkan - bukan
 * lenyap dari kedua daftar tanpa ada yang tahu.
 */
function bolehLihatBrand(lingkup: string | null | undefined, brandProyek: string | null | undefined): boolean {
  if (!lingkup) return true;
  if (!brandProyek) return true;
  return brandProyek === lingkup || brandProyek === 'BOTH';
}

/*
  SIAPA BOLEH APA — DATA, BUKAN KODE.

  Dua fungsi ini dulu berbunyi `role === 'admin' || role === 'superadmin'`,
  dan seluruh tab konfigurasi digantung padanya. Akibatnya Manager PTS -
  pimpinan modul ini - hanya melihat tab "Projects", dan membukanya berarti
  mengubah kode lalu deploy ulang. Sekarang jawabannya dibaca dari kolom
  `users.incentive_akses` yang disetel dari tab "Pengaturan Akses" (lihat
  lib/incentive-akses.ts). Basis data memakai aturan yang sama lewat fungsi
  akses_insentif(), jadi layar tidak bisa memberi izin yang ditolak RLS -
  keadaan yang dulu membuat Process Batch gagal diam-diam.
*/
function bisaKonfig(u: CurrentUser | null) { return bisaKonfigPenuh(u); }
function bisaInput(u: CurrentUser | null) { return bisaInputNominal(u); }

/**
 * Ringkasan cepat "berapa bagian Handler" untuk kolom daftar.
 *
 * Angkanya diambil dari skema yang berlaku, bukan dipatok di sini. Versi lama
 * menulis 60% dan faktor 0.85 langsung di rumus ini - nilai yang sudah tidak
 * cocok lagi dengan tabel pembagian, sehingga kolom daftar dan layar rincian
 * bisa menampilkan angka yang berbeda untuk proyek yang sama.
 */
function calcHandlerSplit(sk: SkemaInsentif | null, p: IncentiveProjectRow): { pct: number; amt: number } | null {
  const pool = p.incentive_value || 0;
  if (!pool || !p.mode_penyelesaian || !sk) return null;
  /*
    Angkanya diambil dari petaPorsiBerlaku - fungsi yang sama dengan yang
    dipakai mesin pembayaran.

    Sebelumnya baris ini menghitung sendiri: porsi PIC dari `sk.porsi` dikali
    sisa pool sesudah Installer. Perhitungan itu tidak pernah melihat tabel
    Porsi Remote, jadi pada proyek Remote yang tabelnya diatur sendiri, kartu
    menulis 51% (60 x 0,85) padahal yang dibayar 40%. Layar dan pembayaran
    tidak boleh punya dua rumus untuk satu angka.

    Ringkasan memakai keadaan "ada Troubleshooting" - keadaan yang paling
    sering terjadi sepanjang 3 tahun masa pencairan.
  */
  const pct = persenPicBerlaku(
    sk, p.mode_penyelesaian === 'remote', true, p.pic_type === 'manager_pic',
  );
  return { pct, amt: Math.round((pool * pct) / 100) };
}

type TabKey = 'projects' | 'tranches' | 'late' | 'skema' | 'settings';

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

  async function loadAll() {
    setLoading(true);
    // Skema dimuat bersama data lain. Selama ia belum ada, layar tidak
    // menghitung apa pun (lihat calcHandlerSplit) - lebih baik kolomnya kosong
    // sesaat daripada menampilkan angka dari aturan yang salah.
    const [projRes, trancheRes, splitRes, lateRes, sk] = await Promise.all([
      fetchIncentiveProjects(), fetchTranches(), fetchVisibleSplits(), fetchLateTickets(), ambilSkema(),
    ]);
    setSkema(sk);
    if (projRes.data) setProjects(projRes.data);
    if (trancheRes.data) setTranches(trancheRes.data);
    if (splitRes.data) setAllSplits(splitRes.data);
    if (lateRes.data) setLateTickets(lateRes.data);
    const [usersRes, ptsTeamRes, orgRes] = await Promise.all([
      supabase.from('users').select('id, username, full_name, role, team_type, incentive_akses, allow_incentive_input, incentive_brand_scope, access_level, jabatan').order('full_name'),
      supabase.from('pts_team_mappings').select('staff_user_id, supervisor_user_id'),
      // Query terpisah & tahan-error: atasan_id dari Struktur Organisasi
      supabase.from('users').select('id, atasan_id'),
    ]);
    if (usersRes.data) {
      const atasanMap = new Map<string, string | null>((orgRes.data ?? []).map((r: { id: string; atasan_id: string | null }) => [r.id, r.atasan_id]));
      setAllUsers((usersRes.data as CurrentUser[]).map(u => ({ ...u, atasan_id: atasanMap.get(u.id as string) ?? null })));
    }
    if (ptsTeamRes.data) setPtsTeamMappings(ptsTeamRes.data as { staff_user_id: string; supervisor_user_id: string }[]);
    // Support per project (dari ticket Troubleshooting selesai) - untuk filter visibilitas list
    const { data: trouble } = await supabase.from('reminders').select('project_name, assigned_to, assign_name').eq('category', 'Troubleshooting').eq('status', 'done');
    const sm = new Map<string, Set<string>>();
    for (const t of (trouble || []) as { project_name: string | null; assigned_to: string | null; assign_name: string | null }[]) {
      if (!t.project_name) continue;
      const set = sm.get(t.project_name) || new Set<string>();
      if (t.assigned_to) set.add(t.assigned_to.toLowerCase());
      if (t.assign_name) set.add(t.assign_name.toLowerCase());
      sm.set(t.project_name, set);
    }
    setSupportMap(sm);
    setLoading(false);
  }

  async function openProjectDetail(p: IncentiveProjectRow) {
    setDetailProject(p);
    //  Tahun-tahun yang dinilai diambil dari jadwal tahapan itu sendiri, bukan
    //  angka 3 yang ditulis tangan - kalau tahapannya kelak jadi 2 atau 4 tahun,
    //  daftar ini ikut tanpa disentuh.
    const tahunDinilai = Array.from(new Set((skema?.tranche ?? []).map(t => t.tahunKe))).sort((a, b) => a - b);
    const [splitsRes, tranchesRes, ...supportsPerTahun] = await Promise.all([
      fetchVisibleSplits(p.id),
      supabase.from('incentive_tranches').select('*').eq('project_id', p.id).order('tranche_number'),
      ...tahunDinilai.map(th => fetchSupportFromTickets(p, jendelaSupportTahap(p.bast_date, th))),
    ]);
    setDetailSplits(splitsRes.data || []);
    setDetailTranches((tranchesRes.data || []) as IncentiveTranche[]);
    //  PIC, Supervisor, dan Manager dikeluarkan dari daftar yang DITAMPILKAN,
    //  bukan cuma dari yang dibayar. Mesin hitung sudah membuangnya (lihat
    //  tanpaPeranTetap di calc.ts); kalau layar ini tetap menampilkannya, orang
    //  membaca "Yoga dapat porsi Support" padahal tidak - dan selisih antara
    //  yang terlihat dan yang dibayar adalah hal terakhir yang boleh terjadi
    //  di layar nominal.
    const rapikan = (v: string) => (v ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
    const orgList = allUsers as unknown as OrgUser[];
    const picIdDetail = resolveUserId((p.pic_id || p.assigned_to) as string, p.assign_name, orgList);
    const supDetail = findUpline(picIdDetail, 'Supervisor', orgList);
    const mgrDetail = findUpline(picIdDetail, 'Manager', orgList);
    const picPenunjuk = new Set([
      p.assign_name, p.assigned_to, p.pic_id, picIdDetail,
      supDetail?.id, supDetail?.full_name,
      mgrDetail?.id, mgrDetail?.full_name,
    ].filter(Boolean).map(v => rapikan(String(v))));
    setDetailSupports(tahunDinilai.map((th, i) => ({
      tahunKe: th,
      ...jendelaSupportTahap(p.bast_date, th),
      orang: (supportsPerTahun[i]?.data || [])
        .filter((o: { user_id: string; user_name: string }) =>
          !picPenunjuk.has(rapikan(o.user_id)) && !picPenunjuk.has(rapikan(o.user_name))),
    })));
  }

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

  async function jalankanGabung() {
    if (!konfirmGabung) return;
    setMenggabung(true);
    const { error } = await satukanProyek(konfirmGabung.anggota);
    setMenggabung(false);
    if (error) { notify('error', 'Gagal menggabungkan: ' + error.message); return; }
    void logAudit({
      user_id: (currentUser?.id as string) ?? '', user_name: (currentUser?.full_name as string) ?? '',
      module: 'incentive-pts', action: 'update',
      target_id: konfirmGabung.anggota[0].id, target_name: konfirmGabung.nama,
      old_value: `${konfirmGabung.anggota.length} proyek terpisah`,
      new_value: '1 proyek insentif',
      notes: `Digabungkan lewat tombol Gabungkan · BAST ${konfirmGabung.bast_date} · kategori: `
        + konfirmGabung.anggota.map(a => a.category ?? '-').join(', '),
    });
    setKonfirmGabung(null);
    notify('success', `"${konfirmGabung.nama}" kini dihitung sebagai satu proyek.`);
    await loadAll();
  }
  const [pilihHapus, setPilihHapus] = useState<Set<string>>(new Set());
  const [konfirmHapus, setKonfirmHapus] = useState<IncentiveProjectRow[] | null>(null);
  const [menghapus, setMenghapus] = useState(false);

  const togglePilih = (id: string) => setPilihHapus(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  async function mintaKonfirmasiHapus(target: IncentiveProjectRow[]) {
    if (!target.length) return;
    /*
      Tahapan yang sudah diproses / dibayar MENGUNCI proyeknya.

      Rekap yang sudah diterima Finance memuat proyek ini. Kalau proyeknya
      hilang dari platform, angka pada rekap itu tidak bisa dijelaskan lagi -
      dan yang paling merepotkan, tidak ada yang tahu selisihnya berasal dari
      mana. Diperiksa ke basis data, bukan ke daftar di layar, karena layar
      bisa tertinggal dari keadaan sebenarnya.
    */
    const { data: terkunci } = await tahapanSudahJalan(target.map(p => p.id));
    if (terkunci.length) {
      const idTerkunci = new Set(terkunci.map(t => t.project_id));
      const nama = target.filter(p => idTerkunci.has(p.id)).map(p => p.project_name);
      notify('error',
        `Tidak bisa dikeluarkan — tahapan pencairannya sudah diproses/dibayar: ${nama.join(', ')}. ` +
        'Batalkan dulu tahapannya bila memang keliru.');
      return;
    }
    setKonfirmHapus(target);
  }

  async function jalankanHapus() {
    if (!konfirmHapus) return;
    setMenghapus(true);
    const ids = konfirmHapus.map(p => p.id);
    const { error } = await setProyekDikeluarkan(ids, true);
    setMenghapus(false);
    if (error) { notify('error', 'Gagal mengeluarkan: ' + error.message); return; }

    // Dicatat satu per satu, bukan sebagai satu baris "3 project dikeluarkan":
    // yang perlu bisa ditelusuri kelak adalah proyek MANA, bukan berapa banyak.
    for (const p of konfirmHapus) {
      void logAudit({
        user_id: (currentUser?.id as string) ?? '', user_name: (currentUser?.full_name as string) ?? '',
        module: 'incentive-pts', action: 'update',
        target_id: p.id, target_name: p.project_name,
        old_value: 'ikut dihitung di Incentive',
        new_value: 'dikeluarkan dari Incentive (jadwal tetap ada)',
        notes: 'Dikeluarkan lewat tombol Hapus di daftar Incentive PTS',
      });
    }
    setKonfirmHapus(null);
    setPilihHapus(new Set());
    notify('success', `${ids.length} project dikeluarkan dari Incentive. Jadwalnya tetap ada di Request Schedule.`);
    await loadAll();
  }

  async function handleSaveNominal() {
    if (!nominalProject) return;
    if (!nominalValue || Number(nominalValue) <= 0) { notify('error', 'Nominal incentive harus > 0'); return; }
    setSavingNominal(true);

    /*
      Nominal DIKUNCI begitu tahapan pencairan dibuat.

      Tahapan menyimpan persentase, bukan rupiah - nominalnya dihitung dari
      incentive_value pada saat pencairan. Jadi mengubah nominal sesudah Tahap 1
      cair membuat Tahap 2 & 3 dihitung dari pool yang BERBEDA dengan yang
      dipakai Tahap 1, dan jumlah seluruh tahapan tidak lagi sama dengan pool
      mana pun. Tidak ada galat yang muncul; yang terjadi cuma rekap tahun
      berikutnya tidak bisa dicocokkan dengan rekap tahun sebelumnya.

      Diperiksa ke database, bukan ke state layar, karena tahapan bisa saja
      baru dibuat orang lain sesudah layar ini dimuat.
    */
    const { data: adaTahapan } = await supabase
      .from('incentive_tranches').select('id').eq('project_id', nominalProject.id).limit(1);
    if (adaTahapan && adaTahapan.length > 0) {
      notify('error',
        'Nominal terkunci — tahapan pencairan untuk proyek ini sudah dibuat. '
        + 'Mengubahnya membuat tahapan berikutnya dihitung dari pool yang berbeda dengan tahap yang sudah cair. '
        + 'Hapus tahapannya lebih dulu bila nominalnya memang keliru.');
      setSavingNominal(false);
      return;
    }

    /*
      BAST ikut disimpan bila diubah - dan ke SELURUH baris sebatch, sama
      seperti alur penyelesaian di Reminder Schedule. Jadwal berhari-hari
      tersimpan sebagai beberapa baris; menulis ke satu baris saja meninggalkan
      sisanya tanpa BAST, dan wakil proyek yang dipilih layar ini (tanggal
      paling akhir) belum tentu baris yang barusan diperbaiki.
    */
    const bastBerubah = (nominalProject.bast_date ?? '') !== nominalBast;
    const isiSimpan: Record<string, unknown> = {
      incentive_value: Number(nominalValue),
      updated_at: new Date().toISOString(),
    };
    if (bastBerubah) isiSimpan.bast_date = nominalBast || null;

    const { error } = await (nominalProject.batch_id
      ? supabase.from('reminders').update(isiSimpan).eq('batch_id', nominalProject.batch_id)
      : supabase.from('reminders').update(isiSimpan).eq('id', nominalProject.id));
    if (error) { notify('error', 'Gagal: ' + error.message); setSavingNominal(false); return; }

    if (bastBerubah) {
      logAudit({
        user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '',
        action: 'update', module: 'incentive',
        target_id: nominalProject.id, target_name: nominalProject.project_name,
        old_value: nominalProject.bast_date ?? '(kosong)', new_value: nominalBast || '(kosong)',
        notes: 'Tanggal BAST dibetulkan dari layar Incentive',
      }).catch(() => {});
    }
    /*
      Peringatan terpisah kalau BAST TETAP kosong sesudah simpan.

      Tanpa ini, menyimpan nominal pada proyek yang BAST-nya belum diisi
      terasa berhasil ("Nominal tersimpan!") padahal tombol Generate Tahapan
      tetap tidak akan muncul - dan tidak ada petunjuk apa pun kenapa. Ini
      persis yang terjadi pada Steak 21 Gading Serpong: nominalnya diperbarui,
      kolom BAST di modal ini dibiarkan kosong (mungkin dikira otomatis
      terisi), lalu Generate Tahapan tetap tidak muncul tanpa pesan yang
      menjelaskan sebabnya.
    */
    const bastMasihKosong = !(nominalBast || nominalProject.bast_date);
    if (bastMasihKosong) {
      notify('error', `Nominal ${formatRupiah(Number(nominalValue))} tersimpan, tapi BAST masih kosong — `
        + 'isi Tanggal BAST di atas dulu, baru tombol Generate Tahapan akan muncul.');
    } else {
      notify('success', bastBerubah
        ? `Nominal ${formatRupiah(Number(nominalValue))} & tanggal BAST tersimpan!`
        : `Nominal ${formatRupiah(Number(nominalValue))} berhasil disimpan!`);
    }
    setSavingNominal(false); setNominalProject(null); setNominalValue(''); setNominalBast('');
    loadAll();
  }

  async function handleGenerateTranches() {
    if (!generateProject?.bast_date) { notify('error', 'BAST belum ada — isi lewat tombol 💲 Input Nominal pada proyek ini.'); return; }
    setGenerating(true);

    /*
      Penjaga duplikat. Tanpa ini, menekan tombolnya dua kali - atau dua orang
      menekannya bersamaan - menghasilkan DUA set tahapan untuk proyek yang
      sama, dan batch pencairan akan membayar keduanya. Tidak ada yang gagal,
      tidak ada galat; uangnya saja keluar dua kali.

      Diperiksa ke database, bukan ke state layar: state hanya tahu apa yang
      dimuat terakhir kali, sedangkan yang berbahaya justru tranche yang baru
      saja dibuat orang lain.
    */
    const { data: sudahAda } = await supabase
      .from('incentive_tranches').select('id').eq('project_id', generateProject.id).limit(1);
    if (sudahAda && sudahAda.length > 0) {
      notify('error', 'Tahapan untuk proyek ini sudah pernah dibuat. Hapus dulu yang lama bila ingin dibuat ulang.');
      setGenerating(false); setShowGenerateModal(false); setGenerateProject(null);
      return;
    }

    const { error } = await insertTranches(skema!, generateProject.id, generateProject.bast_date, generateProject.mode_penyelesaian);
    if (error) { notify('error', 'Gagal: ' + error.message); } else { notify('success', 'Tranche berhasil di-generate!'); }
    setGenerating(false); setShowGenerateModal(false); setGenerateProject(null);
    loadAll();
  }

  /**
   * Kandidat untuk Generate Tahapan Massal - proyek di tahun BAST yang
   * dipilih, yang memenuhi syarat SAMA dengan tombol Generate Tranche satu
   * per satu (hasNominal, BAST ada, belum punya tahapan). Dipisah dari
   * jalankanBulkGenerate supaya tombolnya bisa menampilkan jumlah kandidat
   * SEBELUM diklik, dan supaya modal konfirmasi menunjukkan daftar proyek
   * yang PERSIS akan diproses.
   */
  function kandidatBulkGenerate(tahun: number): IncentiveProjectRow[] {
    const punyaTahapan = new Set(tranches.map(t => t.project_id));
    return filteredProjects.filter(p =>
      p.bast_date && new Date(p.bast_date).getFullYear() === tahun
      && (p.incentive_value || 0) > 0
      && !punyaTahapan.has(p.id));
  }

  /**
   * Generate Tahapan untuk banyak proyek sekaligus, satu tahun BAST.
   *
   * Memanggil insertTranches yang SAMA dipakai tombol satu-per-satu - tidak
   * ada rumus tahapan kedua. Penjaga duplikatnya juga sama: dicek ulang ke
   * database tepat sebelum menulis (bukan ke `tranches` di state, yang bisa
   * saja sudah basi sejak modal konfirmasi dibuka), dan tiap proyek diproses
   * satu-satu (bukan satu INSERT borongan) supaya satu proyek yang gagal
   * tidak menggagalkan proyek lain dalam batch yang sama - dan supaya jelas
   * PROYEK MANA yang gagal, bukan cuma "sebagian gagal".
   */
  async function jalankanBulkGenerate() {
    if (!bulkGenerateConfirm || !bulkGenerateConfirm.length || !skema || filterBastYear == null) return;
    setBulkGenerating(true);
    const tahun = filterBastYear;
    const ids = bulkGenerateConfirm.map(p => p.id);
    const { data: sudahAdaRows } = await supabase
      .from('incentive_tranches').select('project_id').in('project_id', ids);
    const sudahAdaSet = new Set((sudahAdaRows ?? []).map((t: { project_id: string }) => t.project_id));

    const berhasil: string[] = [];
    const gagal: { nama: string; alasan: string }[] = [];
    const dilewati: string[] = [];
    for (const p of bulkGenerateConfirm) {
      if (sudahAdaSet.has(p.id)) { dilewati.push(p.project_name); continue; }
      if (!p.bast_date) { gagal.push({ nama: p.project_name, alasan: 'BAST kosong' }); continue; }
      const { error } = await insertTranches(skema, p.id, p.bast_date, p.mode_penyelesaian);
      if (error) { gagal.push({ nama: p.project_name, alasan: error.message }); continue; }
      berhasil.push(p.project_name);
      void logAudit({
        user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '',
        action: 'create', module: 'incentive-pts',
        target_id: p.id, target_name: p.project_name,
        new_value: 'tahapan dibuat',
        notes: `Dibuat lewat Generate Tahapan Massal · Tahun BAST ${tahun}`,
      });
    }
    setBulkGenerateResult({ tahun, berhasil, gagal, dilewati });
    setBulkGenerating(false);
    setBulkGenerateConfirm(null);
    loadAll();
  }

  async function handleBatchProcess() {
    if (!currentUser) return;
    setBatchProcessing(true);
    //  Dulu dicari lewat jabatan='Manager' AND team_type='Team PTS IVP' -
    //  nama tim dipaku, dan ada DUA jabatan Manager di basis data ini
    //  (PTS IVP & PTS UMP) sehingga .limit(1) memilih tanpa aturan. Untuk
    //  dokumen yang menyangkut uang itu tidak boleh diserahkan pada urutan
    //  baris. Lihat managerUtama() di lib/penerima-admin.ts.
    const mgrData = await managerUtama();
    const managerId = (mgrData?.id || currentUser.id || '') as string;
    const managerName = (mgrData?.full_name || currentUser.full_name || 'Manager') as string;
    const result = await processYearlyBatch(batchYear, managerId, managerName);
    if (result.error) { notify('error', 'Batch error: ' + (result.error as { message: string }).message); }
    else {
      let msg = `Batch ${batchYear}: ${result.processed}/${result.total} tranche diproses.`;
      if (result.errors?.length) msg += ` Errors: ${result.errors.join('; ')}`;
      notify(result.errors?.length ? 'error' : 'success', msg);
    }
    setBatchProcessing(false); setBatchConfirm(false); loadAll();
  }

  /** Batalkan hasil Process Batch satu tahun. Yang sudah Paid tidak disentuh. */
  async function jalankanBatalBatch() {
    if (batalBatch === null) return;
    setMembatalkan(true);
    const hasil = await batalkanBatchTahun(batalBatch);
    setMembatalkan(false);
    if (hasil.error) { notify('error', 'Gagal membatalkan: ' + hasil.error.message); return; }
    void logAudit({
      user_id: (currentUser?.id as string) ?? '', user_name: (currentUser?.full_name as string) ?? '',
      module: 'incentive', action: 'delete',
      target_name: `Batch ${batalBatch}`,
      old_value: `${hasil.jumlah} tahapan processed`,
      new_value: `${hasil.jumlah} tahapan kembali pending`,
      notes: `Pembatalan Process Batch ${batalBatch}. Baris pembagiannya dihapus. `
        + `${hasil.dilewati} tahapan berstatus Paid tidak disentuh.`,
    });
    notify(hasil.jumlah > 0 ? 'success' : 'error',
      hasil.jumlah > 0
        ? `Batch ${batalBatch} dibatalkan: ${hasil.jumlah} tahapan kembali Pending`
          + (hasil.dilewati ? `, ${hasil.dilewati} dilewati karena sudah Paid.` : '.')
        : `Tidak ada yang bisa dibatalkan di ${batalBatch}`
          + (hasil.dilewati ? ` — ${hasil.dilewati} tahapan sudah berstatus Paid.` : '.'));
    setBatalBatch(null); setKetikBatalBatch('');
    loadAll();
  }

  /** Hapus seluruh tahapan satu proyek supaya bisa dibuat ulang. */
  async function jalankanHapusTahapan() {
    if (!hapusTahapan) return;
    setMembatalkan(true);
    const hasil = await hapusTahapanProyek(hapusTahapan.id);
    setMembatalkan(false);
    if (hasil.error) { notify('error', hasil.error.message); return; }
    void logAudit({
      user_id: (currentUser?.id as string) ?? '', user_name: (currentUser?.full_name as string) ?? '',
      module: 'incentive', action: 'delete',
      target_id: hapusTahapan.id, target_name: hapusTahapan.project_name ?? '',
      old_value: `${hasil.jumlah} tahapan pencairan`,
      new_value: 'tanpa tahapan',
      notes: 'Tahapan dihapus lewat tombol Hapus Tahapan — nominal proyek kembali bisa disunting.',
    });
    notify('success', `${hasil.jumlah} tahapan "${hapusTahapan.project_name}" dihapus. Nominal terbuka lagi.`);
    setHapusTahapan(null); setKetikHapusTahapan('');
    loadAll();
  }

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
  async function siapkanDataExport() {
    //  Sama seperti Process Batch: lewat managerUtama(), bukan jabatan+tim
    //  yang dipaku - lihat catatan panjang di lib/penerima-admin.ts.
    const mgr = await managerUtama();
    const managerUserId = (mgr?.id || '') as string;
    const managerName   = (mgr?.full_name || 'Manager') as string;
    const { data: sumberSupport } = await ambilSumberSupport();
    const supportsMap = new Map<string, { user_id: string; user_name: string }[]>();
    for (const p of projects) {
      supportsMap.set(p.project_name, supportUntukProyek(sumberSupport, p));
    }
    return { managerUserId, managerName, supportsMap };
  }

  async function handleExportSummary() {
    setExporting(true);
    try {
      const { managerUserId, managerName, supportsMap } = await siapkanDataExport();
      /*
        Hanya project yang SUDAH masuk pipeline tahapan (Generate Tahapan
        sudah dijalankan - punya baris incentive_tranches, apa pun statusnya
        Pending/Processed/Paid) yang diexport - bukan seluruh project
        berstatus done. Project yang nominalnya belum diisi/belum di-generate
        bukan laporan pencairan yang bisa diperiksa Finance, cuma pekerjaan
        yang masih perlu disiapkan Admin di tab Project.
      */
      const projectsAktif = projects.filter(p => tranches.some(t => t.project_id === p.id));
      await exportSummaryIncentive({
        projects: projectsAktif, allUsers: allUsers as { id?: string; full_name?: string; jabatan?: string; atasan_id?: string | null }[],
        supportsMap, managerName, managerUserId, year: summaryExportYear,
      });
      notify('success', summaryExportYear != null
        ? `Export summary tahun ${summaryExportYear} berhasil! (${projectsAktif.length} project dengan tahapan aktif)`
        : `Export summary semua tahun berhasil! (${projectsAktif.length} project dengan tahapan aktif)`);
    } catch (err: unknown) { notify('error', 'Export gagal: ' + (err as Error).message); }
    setExporting(false);
  }

  /**
   * Export dari tab Tranche Schedule - beda sumbu filter dari Export Summary
   * di tab Project (yang menyaring lewat BAST). Di sini yang dipilih adalah
   * TAHUN BAYAR batch (tahunAktif, dropdown "Tahun" di tab ini) - jadi
   * proyeknya persis yang tampil di tabel tranche tahun itu, apa pun tahun
   * BAST masing-masing. Penting begitu banyak tahun sudah ke-record: tombol
   * ini yang dipakai re-export satu batch tahun bayar tertentu saja, tanpa
   * ikut menyeret proyek dari batch tahun lain.
   */
  async function handleExportBatch() {
    setExporting(true);
    try {
      const { managerUserId, managerName, supportsMap } = await siapkanDataExport();
      const idsBatch = [...new Set(tranches.filter(t => t.payment_year === tahunAktif).map(t => t.project_id))];
      const projectsBatch = projects.filter(p => idsBatch.includes(p.id));
      await exportSummaryIncentive({
        projects: projectsBatch, allUsers: allUsers as { id?: string; full_name?: string; jabatan?: string; atasan_id?: string | null }[],
        supportsMap, managerName, managerUserId, projectIds: idsBatch, batchYearLabel: tahunAktif,
      });
      notify('success', `Export batch tahun bayar ${tahunAktif} berhasil! (${projectsBatch.length} project)`);
    } catch (err: unknown) { notify('error', 'Export gagal: ' + (err as Error).message); }
    setExporting(false);
  }

  /*
    C4 (docs/UX-WORKFLOW-AUDIT.md): dulu tombol ini eksekusi langsung begitu
    diklik - tanpa modal konfirmasi, tanpa guard loading (klik ganda = dua
    request bersamaan), dan tanpa logAudit - kontras dengan Process Batch/
    Batalkan Batch/Hapus Tahapan di modul yang SAMA yang semuanya sudah
    lengkap ketiganya. "Tandai Paid" berarti uang sudah keluar - aksi paling
    final di alur ini, jadi pengamanannya disamakan, bukan dikurangi.
  */
  async function handleMarkPaid(trancheId: string, projectName: string, trancheNumber: number) {
    setMarkingPaid(trancheId);
    // select('id') + panjang diperiksa: RLS yang menolak diam-diam
    // mengembalikan 0 baris tanpa error (pola yang sama seperti temuan T-1
    // di seluruh audit sebelumnya) - tanpa ini toast "berhasil" bisa muncul
    // padahal tranche-nya tidak benar-benar berubah jadi Paid.
    const { data: terubah, error } = await supabase.from('incentive_tranches')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', trancheId).eq('status', 'processed').select('id');
    setMarkingPaid(null);
    if (error || !terubah || terubah.length === 0) {
      notify('error', error ? error.message : 'Gagal menandai Paid (mungkin sudah ditandai orang lain, atau akses tidak cukup).');
      return;
    }
    void logAudit({
      user_id: (currentUser?.id as string) ?? '', user_name: (currentUser?.full_name as string) ?? '',
      module: 'incentive', action: 'update',
      target_id: trancheId, target_name: `${projectName} — Tahap ${trancheNumber}`,
      old_value: 'processed', new_value: 'paid',
      notes: 'Ditandai Paid manual dari tabel Tranche Schedule.',
    });
    notify('success', 'Tranche ditandai Paid!'); loadAll();
    if (detailProject) openProjectDetail(detailProject);

    // M11 (docs/UX-WORKFLOW-AUDIT.md): modul ini dulu tidak mengirim
    // notifikasi apa pun di transisi manapun - penerima insentif harus buka
    // platform sendiri untuk tahu uangnya sudah cair. Diberi tahu lewat
    // in-app notification ke setiap orang yang punya bagian di tahap ini.
    try {
      const { data: splits } = await supabase.from('incentive_splits')
        .select('user_id, user_name, amount').eq('tranche_id', trancheId);
      for (const s of (splits ?? []) as { user_id: string; user_name: string; amount: number }[]) {
        if (!s.user_id) continue;
        void createNotification({
          user_id: s.user_id, type: 'system',
          title: `💰 Insentif Tahap ${trancheNumber} cair`,
          body: `${projectName} — bagian kamu ${formatRupiah(Math.round(s.amount))}`,
          action_url: '/incentive-pts',
          created_by: currentUser?.full_name ?? 'System',
        });
      }
    } catch { /* notifikasi gagal tidak boleh menggagalkan penandaan Paid yang sudah tersimpan */ }
  }

  function konfirmasiMarkPaid(trancheId: string, projectName: string, trancheNumber: number) {
    setConfirmState({
      message: `Tandai tahap ${trancheNumber} "${projectName}" sebagai Paid?`,
      description: 'Menandakan uang sudah keluar. Tidak ada tombol untuk membatalkannya kembali dari sini.',
      danger: true, confirmLabel: 'Ya, Tandai Paid',
      onConfirm: () => handleMarkPaid(trancheId, projectName, trancheNumber),
    });
  }

  /** Kata kunci pencarian di Pengaturan Akses. */
  const [cariUser, setCariUser] = useState('');

  /**
   * Tetapkan lingkup brand seorang petugas.
   *
   * Lewat route admin yang sama dengan toggle izin - kolom hak akses tidak
   * boleh ditulis langsung dari peramban, karena siapa pun yang memegang anon
   * key bisa memanggilnya.
   */
  async function handleSetBrandScope(userId: string, scope: string | null) {
    const { error } = await setBrandScopeIncentive(userId, scope);
    if (error) { notify('error', 'Gagal: ' + error.message); return; }
    setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, incentive_brand_scope: scope } : u));
    notify('success', scope ? `Lingkup diset ke ${scope}.` : 'Lingkup dilepas — petugas ini melihat semua brand.');
  }

  /**
   * Setel tingkat akses seseorang: lihat / input / penuh.
   *
   * Menggantikan saklar dua keadaan "Izinkan / Diizinkan" yang lama. Saklar
   * itu hanya bisa mengatur izin isi nominal; tidak pernah ada cara memberi
   * seseorang akses konfigurasi selain menjadikannya admin platform - dan
   * itulah sebabnya Manager PTS terkunci di luar layar skema selama ini.
   */
  async function handleSetAkses(userId: string, nilai: TingkatAkses) {
    const { error } = await setAksesIncentive(userId, nilai);
    if (error) { notify('error', 'Gagal: ' + error.message); return; }
    setAllUsers(prev => prev.map(u => u.id === userId
      ? { ...u, incentive_akses: nilai, allow_incentive_input: nilai !== 'lihat' }
      : u));
    notify('success', `Akses diset: ${LABEL_AKSES[nilai]}.`);
  }

  /**
   * Set brand (MVI/IVP/BOTH) manual langsung dari Incentive PTS - lewat ID
   * project (bukan nama), sesuai aturan target hapus/ubah di modul ini.
   *
   * Sebelumnya satu-satunya cara membetulkan project "tanpa brand" adalah
   * menghapus reminder-nya lalu meng-Sync ulang dari Reminder Schedule -
   * berisiko (bisa ikut menghapus BAST/nominal/tahapan yang sudah terlanjur
   * diproses) untuk sekadar membetulkan SATU kolom. UPDATE langsung ke
   * reminders.brand jauh lebih aman: tidak menyentuh kolom lain sama sekali.
   */
  async function handleSetProjectBrand(projectId: string, brand: 'MVI' | 'IVP' | 'BOTH') {
    //  .select('id') + cek baris hasilnya - bukan cuma error - supaya kalau
    //  RLS suatu saat diperketat dan diam-diam menolak baris ini, UI tidak
    //  ikut-ikutan bilang "berhasil" padahal tidak ada yang berubah. Lihat
    //  bug processYearlyBatch yang baru dibetulkan untuk alasan lengkapnya.
    const { data, error } = await supabase.from('reminders').update({ brand }).eq('id', projectId).select('id');
    if (error || !data || data.length === 0) {
      notify('error', 'Gagal set brand: ' + (error?.message ?? 'tidak ada baris yang berubah'));
      return;
    }
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, brand } : p));
    notify('success', `Brand diset ke ${brand}.`);
  }

  if (!appReady) return (
    <div className="flex items-center justify-center" style={{ minHeight: '100vh', backgroundImage: "url('/IVP_Background.png')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="flex flex-col items-center gap-3 bg-white/90 rounded-2xl px-8 py-6 shadow-xl">
        <div className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: 'rgba(99,102,241,0.2)', borderTopColor: '#f43f5e' }} />
        <p className="text-slate-500 text-sm font-semibold">Memuat Incentive PTS...</p>
      </div>
    </div>
  );

  // Privasi list: non-privileged hanya melihat project di mana dia terlibat
  // (handler/PIC, support dari ticket Troubleshooting, supervisor, atau manager).
  const canSeeAll = bisaInput(currentUser);
  const orgListAll = allUsers as unknown as OrgUser[];
  const userInProject = (p: IncentiveProjectRow): boolean => {
    if (!currentUser) return false;
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

  const thCls = 'px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider border border-gray-200';

  return (
    <div className="h-screen overflow-hidden flex flex-col" style={{ fontFamily: "'Inter', sans-serif", backgroundImage: "url('/IVP_Background.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>

      {toast && (
        <div className={`fixed top-4 right-4 z-[3000] px-4 py-3 rounded-xl shadow-lg text-sm font-semibold text-white flex items-center gap-2 ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
          {toast.type === 'success' ? '✅' : '❌'} {toast.msg}
        </div>
      )}

      {/* Header */}
      <header className="flex-shrink-0 z-50"
        style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '3px solid #f43f5e', boxShadow: '0 2px 12px rgba(99,102,241,0.10)' }}>
        <div className="w-full px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-purple-600 flex items-center justify-center text-white text-lg flex-shrink-0">💰</div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-gray-800">Incentive PTS</h1>
            <p className="text-[11px] text-gray-400">IndoVisual Professional Tools</p>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-right">
            <div><p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Total Pool</p><p className="text-sm font-black text-emerald-600">{formatRupiah(totalPool)}</p></div>
            <div><p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Projects</p><p className="text-sm font-black text-rose-600">{projects.length}</p></div>
            <div><p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Pending Nominal</p><p className="text-sm font-black text-amber-600">{pendingNominal}</p></div>
            <div><p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Pending Tranche</p><p className="text-sm font-black text-rose-600">{pendingTranche}</p></div>
          </div>
        </div>
      </header>

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
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: 'rgba(99,102,241,0.2)', borderTopColor: '#f43f5e' }} />
          </div>
        )}

        {/* ─── Projects tab ─── */}
        {tab === 'projects' && !loading && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 pt-4 pb-3 border-b border-gray-200 space-y-2">
              <div className="flex flex-wrap gap-2 items-center justify-between">
                <input aria-label="Cari project atau handler..." value={searchProject} onChange={e => setSearchProject(e.target.value)}
                  placeholder="🔍 Cari project atau handler..."
                  className="flex-1 min-w-[180px] max-w-sm px-4 py-2 rounded-lg text-sm outline-none bg-gray-50 border border-gray-200 text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-rose-400" />
                <select aria-label="Filter Tahun BAST" value={filterBastYear ?? ''}
                  onChange={e => setFilterBastYear(e.target.value === '' ? null : Number(e.target.value))}
                  className="px-3 py-2 rounded-lg text-sm outline-none bg-gray-50 border border-gray-200 text-gray-700 focus:ring-2 focus:ring-rose-400">
                  <option value="">📅 Semua Tahun BAST</option>
                  {bastYearsProjects.map(y => <option key={y} value={y}>Tahun BAST {y}</option>)}
                </select>
                <div className="flex items-center gap-2 flex-wrap">
                  {bisaInput(currentUser) && (
                    <span className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200">✏️ Kamu bisa input nominal</span>
                  )}
                  {bisaInput(currentUser) && (<>
                    {/*
                      Tahun export Summary TERPISAH dari filter Tahun BAST di
                      atas - filter di atas cuma mengubah tampilan tabel,
                      sedangkan orang yang lupa mengembalikannya ke "Semua"
                      sebelum export tidak boleh diam-diam mendapat file yang
                      lebih kecil dari yang dikira. Defaultnya selalu Semua
                      Tahun, harus dipilih sendiri kalau memang mau per tahun.
                    */}
                    <select aria-label="Tahun Export Summary" value={summaryExportYear ?? ''}
                      onChange={e => setSummaryExportYear(e.target.value === '' ? null : Number(e.target.value))}
                      className="px-2.5 py-1.5 rounded-lg text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 outline-none">
                      <option value="">Semua Tahun</option>
                      {bastYearsProjects.map(y => <option key={y} value={y}>Tahun {y}</option>)}
                    </select>
                    <button onClick={handleExportSummary} disabled={exporting}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50 flex items-center gap-1.5">
                      {exporting ? <div className="w-3 h-3 border-2 border-emerald-400/30 border-t-emerald-500 rounded-full animate-spin" /> : '📊'} Export Summary
                    </button>
                  </>)}
                  {bisaKonfig(currentUser) && filterBastYear != null && kandidatBulkGenerate(filterBastYear).length > 0 && (
                    <button onClick={() => setBulkGenerateConfirm(kandidatBulkGenerate(filterBastYear))}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 flex items-center gap-1.5">
                      🚀 Generate Tahapan Massal {filterBastYear} ({kandidatBulkGenerate(filterBastYear).length})
                    </button>
                  )}
                  {/* Tombol massal hanya muncul saat ada yang dipilih - tombol
                      hapus yang selalu terlihat mengundang klik tanpa maksud. */}
                  {bolehHapus && pilihHapus.size > 0 && (
                    <>
                      <span className="px-2 py-1.5 rounded-lg text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200">
                        {pilihHapus.size} dipilih
                      </span>
                      <button onClick={() => setPilihHapus(new Set())}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50">
                        Batal pilih
                      </button>
                      <button onClick={() => mintaKonfirmasiHapus(filteredProjects.filter(p => pilihHapus.has(p.id)))}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-red-600 border border-red-700 hover:bg-red-700 flex items-center gap-1.5">
                        🗑️ Keluarkan dari Incentive
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/*
                Spanduk kandidat gabung. Hanya muncul kalau ada yang terdeteksi,
                dan hanya untuk yang boleh mengelola insentif.

                Diletakkan di ATAS daftar, bukan sebagai lencana kecil di baris
                proyeknya: yang perlu diketahui adalah bahwa dua baris berbeda
                sebenarnya satu, dan itu tidak bisa disampaikan dari dalam salah
                satu barisnya saja.
              */}
              {bolehHapus && kandidatGabung.length > 0 && (
                <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-amber-200">
                    <p className="text-[13px] font-bold text-amber-900">
                      {kandidatGabung.length} proyek terdeteksi tercatat lebih dari sekali
                    </p>
                    <p className="text-[11px] text-amber-800 leading-relaxed mt-0.5">
                      Nama proyeknya sama dan tanggal BAST-nya berdekatan (selisih maksimal 7 hari),
                      tapi jadwalnya terpisah — biasanya Konfigurasi dan Training yang dijadwalkan
                      di hari berbeda dan ditutup dengan dua BAST berurutan. Selama belum
                      digabungkan, masing-masing punya pool nominal sendiri.
                      <b> Periksa dulu:</b> kalau ini memang dua kontrak berbeda, biarkan terpisah.
                    </p>
                  </div>
                  <div className="divide-y divide-amber-200">
                    {kandidatGabung.map((k, i) => (
                      <div key={i} className="px-4 py-2.5 flex items-center gap-3 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-bold text-slate-800 truncate">{k.nama}</p>
                          <p className="text-[11px] text-slate-600">
                            BAST {k.bast_date} · {k.anggota.length} jadwal ·{' '}
                            {k.anggota.map(a => `${a.category ?? '-'} (${a.assign_name ?? '-'})`).join(' + ')}
                          </p>
                        </div>
                        <button type="button" onClick={() => setKonfirmGabung(k)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 flex-shrink-0">
                          Gabungkan
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/*
                SPANDUK KELENGKAPAN DATA.

                Process Batch menolak proyek yang mode_penyelesaian-nya kosong -
                dan dulu satu-satunya cara mengetahuinya adalah menekan tombolnya
                lalu membaca daftar galat. Kelengkapan yang menentukan berhasil
                atau tidaknya pemrosesan harus terbaca SEBELUM tombol ditekan,
                bukan sesudah.

                Brand kosong tidak menggagalkan pemrosesan, tapi membuat proyek
                itu terlihat oleh SEMUA petugas apa pun lingkup brand-nya (lihat
                bolehLihatBrand) - jadi tetap perlu disebut, dengan nada yang
                lebih ringan.
              */}
              {bisaInput(currentUser) && (() => {
                const tanpaMode  = filteredProjects.filter(p => !p.mode_penyelesaian);
                const tanpaBrand = filteredProjects.filter(p => !p.brand);
                if (tanpaMode.length === 0 && tanpaBrand.length === 0) return null;
                return (
                  <div className="mb-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5">
                    <p className="text-[13px] font-bold text-sky-900">Data proyek belum lengkap</p>
                    <p className="text-[11px] text-sky-800 leading-relaxed mt-0.5">
                      {tanpaMode.length > 0 && (
                        <>
                          <b>{tanpaMode.length} proyek tanpa mode penyelesaian</b> (Remote/Onsite) — proyek ini
                          akan <b>gagal</b> saat Process Batch karena porsinya tidak bisa dihitung.
                          Isi dari Request Schedule, atau lewat tombol Input Nominal.{' '}
                        </>
                      )}
                      {tanpaBrand.length > 0 && (
                        <>
                          <b>{tanpaBrand.length} proyek tanpa brand</b> — masih ikut terhitung, tapi terlihat
                          oleh semua petugas apa pun lingkup brand-nya. Klik lencana brand di baris proyeknya
                          untuk menetapkan MVI / IVP / Kedua Brand.
                        </>
                      )}
                    </p>
                  </div>
                );
              })()}
              <p className="text-xs text-gray-400">
                <span className="font-bold text-gray-600">{filteredProjects.length}</span> project
                {bisaInput(currentUser) && (<>
                  &nbsp;·&nbsp;<span className="font-bold text-emerald-600">{filteredProjects.filter(p => (p.incentive_value||0)>0).length}</span> ada nominal ·&nbsp;
                  <span className="font-bold text-amber-600">{filteredProjects.filter(p => !(p.incentive_value||0)).length}</span> belum isi nominal
                </>)}
                {/*
                  Total nominal utk SEMUA role - dijumlah dari filteredProjects
                  (sudah tersaring ke project sendiri utk non-privileged),
                  BUKAN dari totalPool (total seluruh platform).
                */}
                &nbsp;·&nbsp;Total:&nbsp;
                <span className="font-bold text-emerald-600">
                  {formatRupiah(filteredProjects.filter(p => (p.incentive_value || 0) > 0).reduce((s, p) => s + (p.incentive_value || 0), 0))}
                </span>
              </p>
            </div>
            {/* ── MOBILE: kartu ringkas (nama + total incentive, tap utk detail) ── */}
            <div className="md:hidden divide-y divide-gray-100">
              {filteredProjects.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-gray-400">Belum ada project incentive.</div>
              ) : filteredProjects.map((p) => {
                const hasNominal = (p.incentive_value || 0) > 0;
                const handlerSplit = calcHandlerSplit(skema, p);
                //  Diurutkan ulang di sini - fetchTranches() mengurutkan lewat
                //  payment_year (dipakai tab Tahapan Pencairan mengelompokkan per
                //  tahun), bukan tranche_number. Kalau dua tahapan kebetulan
                //  bertahun sama (mis. gara-gara data lama yang salah), badge di
                //  sini bisa tampil "T1 T3 T2" - urutan tampilan proyek per
                //  proyek harus tetap T1 T2 T3 apa pun urutan hasil fetch-nya.
                const projTranches = tranches.filter(t => t.project_id === p.id)
                  .sort((a, b) => a.tranche_number - b.tranche_number);
                const showNominal = bisaInput(currentUser);
                return (
                  <MobileListCard
                    key={p.id}
                    title={p.project_name}
                    onClick={() => openProjectDetail(p)}
                    meta={<>
                      {p.product && <div className="truncate">📦 {p.product}</div>}
                      <div className="truncate">👷 {p.assign_name || '—'}{p.bast_date ? ` · BAST ${new Date(p.bast_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}` : ''}</div>
                    </>}
                    badges={<>
                      <MobileCardBadge className="bg-purple-100 text-purple-700 border border-purple-200">{p.category}</MobileCardBadge>
                      {/*
                        Nominal tampil utk semua role (dulu ikut showNominal,
                        yang privileged-only) - list ini sudah tersaring ke
                        project sendiri (userInProject), jadi bukan kebocoran
                        baru. showNominal TETAP dipakai di bawah utk tombol
                        Input Nominal & field Bagian Handler - dua hal itu
                        beda: satu aksi ubah data, satu lagi bisa jadi bagian
                        ORANG LAIN.
                      */}
                      {hasNominal
                        ? <span className="text-sm font-black text-emerald-600 whitespace-nowrap">{formatRupiah(p.incentive_value || 0)}</span>
                        : <span className="text-[10px] font-bold text-amber-600 whitespace-nowrap">⏳ Belum nominal</span>}
                    </>}
                    fields={[
                      { label: 'Mode', value: p.mode_penyelesaian === 'onsite' ? '🏢 Onsite' : p.mode_penyelesaian === 'remote' ? '💻 Remote' : '—' },
                      { label: 'Tranche', value: projTranches.length > 0 ? projTranches.map(t => `T${t.tranche_number}`).join(' ') : '—' },
                      { label: 'Bagian Handler', value: handlerSplit ? <span className="text-rose-700 font-bold">{formatRupiah(handlerSplit.amt)} ({handlerSplit.pct.toFixed(0)}%)</span> : '—', span2: true, hide: !showNominal },
                    ]}
                    actions={<>
                      <button aria-label="Lihat Detail" onClick={() => openProjectDetail(p)} title="Lihat Detail" className="inline-flex items-center justify-center w-7 h-7 rounded-lg border bg-white border-slate-200 text-blue-500 hover:bg-blue-50">
                        <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      </button>
                      {showNominal && (
                        <button aria-label="Input Nominal" disabled={tranches.some(t => t.project_id === p.id)}
                        onClick={() => { setNominalProject(p); setNominalValue(String(p.incentive_value || '')); setNominalBast((p.bast_date ?? '').slice(0, 10)); }}
                        title={tranches.some(t => t.project_id === p.id) ? 'Nominal terkunci — tahapan pencairan sudah dibuat' : 'Input Nominal'}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg border bg-white border-slate-200 text-rose-500 hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white">
                          <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </button>
                      )}
                      {hasNominal && projTranches.length === 0 && p.bast_date && (
                        <button aria-label="Generate Tranche" onClick={() => { setGenerateProject(p); setShowGenerateModal(true); }} title="Generate Tranche" className="inline-flex items-center justify-center w-7 h-7 rounded-lg border bg-white border-slate-200 text-blue-500 hover:bg-blue-50">
                          <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </button>
                      )}
                      {bisaKonfig(currentUser) && projTranches.length > 0
                        && !projTranches.some(t => t.status === 'paid') && (
                        <button aria-label={`Hapus tahapan ${p.project_name}`}
                          onClick={() => { setHapusTahapan(p); setKetikHapusTahapan(''); }}
                          title="Hapus tahapan pencairan (nominal terbuka lagi)"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg border bg-white border-amber-200 text-amber-600 hover:bg-amber-50">
                          <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a4 4 0 110 8h-1m-9-8l4-4m-4 4l4 4" /></svg>
                        </button>
                      )}
                    </>}
                  />
                );
              })}
            </div>

            {/* ── DESKTOP: tabel penuh (TIDAK diubah) ── */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.10),rgba(139,92,246,0.07))' }}>
                    <th className={`${thCls} w-10 text-center`}>No</th>
                    <th className={`${thCls} w-[210px] max-w-[210px]`}>Project</th>
                    <th className={`${thCls} w-[130px]`}>Handler</th>
                    <th className={`${thCls} w-[140px]`}>Kategori</th>
                    <th className={`${thCls} w-[100px]`}>Mode</th>
                    <th className={`${thCls} w-[110px]`}>BAST</th>
                    {/*
                      Nominal SEKARANG tampil utk semua role (dulu khusus
                      canInputNominal) - list ini sudah tersaring ke project
                      yang usernya sendiri terlibat (lihat userInProject di
                      atas), jadi menampilkan pool project di sini bukan
                      kebocoran baru: nominal & bagiannya sendiri sudah bisa
                      dilihat lewat modal detail juga. "Bagian Handler" TETAP
                      privileged-only - itu bisa jadi bagian ORANG LAIN kalau
                      yang login bukan handler-nya, beda dari Nominal (pool
                      project, bukan bagian personal siapa pun).
                    */}
                    <th className="px-3 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider border border-gray-200 w-[150px]">Nominal</th>
                    {bisaInput(currentUser) && <th className="px-3 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider border border-gray-200 w-[145px]">Bagian Handler</th>}
                    <th className={`${thCls} w-[90px] text-center`}>Tranche</th>
                    <th className={`${thCls} ${bolehHapus ? 'w-[130px]' : 'w-[100px]'} text-center`}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.length === 0 ? (
                    <tr><td colSpan={bisaInput(currentUser) ? 10 : 9} className="px-4 py-16 text-center border border-gray-200">
                      <p className="text-4xl mb-3">📭</p>
                      <p className="text-gray-500 font-medium">Belum ada project incentive</p>
                      <p className="text-gray-400 text-xs mt-1">Data muncul dari Reminder Schedule kategori Konfigurasi / Training yang sudah Completed</p>
                    </td></tr>
                  ) : filteredProjects.map((p, idx) => {
                    const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-rose-50/30';
                    const cellCls = `border border-gray-200 px-3 py-2.5 ${rowBg}`;
                    const hasNominal = (p.incentive_value || 0) > 0;
                    //  Lihat catatan di baris kartu mobile di atas - fetchTranches()
                    //  mengurutkan lewat payment_year, bukan tranche_number.
                    const projTranches = tranches.filter(t => t.project_id === p.id)
                      .sort((a, b) => a.tranche_number - b.tranche_number);
                    const handlerSplit = calcHandlerSplit(skema, p);
                    return (
                      <tr key={p.id} className="hover:bg-rose-50/60 transition-colors group">
                        <td className={`${cellCls} text-xs text-gray-400 text-center`}>{idx + 1}</td>
                        <td className={`${cellCls} max-w-[210px]`}>
                          <p className="font-semibold text-gray-800 leading-snug truncate max-w-[195px]" title={p.project_name}>{p.project_name}</p>
                          {p.product && <p className="text-[11px] text-rose-500 mt-0.5 truncate max-w-[195px]" title={p.product}>📦 {p.product}</p>}
                          {p.address && <p className="text-[11px] text-gray-400 mt-0.5 truncate max-w-[195px]" title={p.address}>📍 {p.address}</p>}
                        </td>
                        <td className={cellCls}>
                          <p className="text-sm font-medium text-gray-700">{p.assign_name || '—'}</p>
                          {p.pic_type === 'manager_pic' && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 mt-0.5 inline-block">Manager PIC</span>}
                          {/*
                            Lencana brand. Dua petugas Finance memakai daftar
                            yang sudah tersaring, jadi lencana ini bukan sekadar
                            hiasan - ia yang menjelaskan KENAPA sebuah proyek
                            ada di daftarnya, dan kenapa yang lain tidak.

                            Utk Admin, lencana ini KLIK-ABLE - membuka picker
                            MVI/IVP/Kedua kecil di bawahnya utk set manual.
                            Sebelumnya satu-satunya jalan membetulkan project
                            "tanpa brand" adalah hapus reminder lalu Sync ulang
                            dari Reminder Schedule - berisiko ikut menghapus
                            BAST/nominal/tahapan yang sudah terlanjur diproses,
                            padahal yang salah cuma satu kolom.
                          */}
                          {bisaKonfig(currentUser) ? (
                            <span className="relative inline-block mt-0.5 ml-1">
                              <button type="button"
                                onClick={() => setBrandEditFor(brandEditFor === p.id ? null : p.id)}
                                title="Klik untuk set brand manual"
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded border inline-block hover:opacity-75 transition-opacity ${
                                  p.brand === 'MVI'  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                  : p.brand === 'IVP' ? 'text-blue-700 bg-blue-50 border-blue-200'
                                  : p.brand === 'BOTH' ? 'text-violet-700 bg-violet-50 border-violet-200'
                                  : 'text-rose-700 bg-rose-50 border-rose-200'}`}>
                                {p.brand === 'MVI' ? '🏠 MVI' : p.brand === 'IVP' ? '🌐 IVP'
                                  : p.brand === 'BOTH' ? '🏠🌐 Kedua' : '⚠️ tanpa brand'} ✏️
                              </button>
                              {brandEditFor === p.id && (
                                <div className="absolute z-20 top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 p-1.5 flex gap-1 whitespace-nowrap">
                                  {(['MVI', 'IVP', 'BOTH'] as const).map(b => (
                                    <button key={b} type="button"
                                      onClick={() => { handleSetProjectBrand(p.id, b); setBrandEditFor(null); }}
                                      className="text-[10px] font-bold px-2 py-1 rounded hover:bg-gray-100 text-gray-700 border border-transparent hover:border-gray-200">
                                      {b === 'MVI' ? '🏠 MVI' : b === 'IVP' ? '🌐 IVP' : '🏠🌐 Kedua'}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </span>
                          ) : (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border mt-0.5 ml-1 inline-block ${
                              p.brand === 'MVI'  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                              : p.brand === 'IVP' ? 'text-blue-700 bg-blue-50 border-blue-200'
                              : p.brand === 'BOTH' ? 'text-violet-700 bg-violet-50 border-violet-200'
                              : 'text-rose-700 bg-rose-50 border-rose-200'}`}>
                              {p.brand === 'MVI' ? '🏠 MVI' : p.brand === 'IVP' ? '🌐 IVP'
                                : p.brand === 'BOTH' ? '🏠🌐 Kedua' : '⚠️ tanpa brand'}
                            </span>
                          )}
                        </td>
                        <td className={cellCls}>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-700 border border-purple-200">{p.category}</span>
                          {p.requires_controller_automation && (
                            <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">⚡{p.controller_automation_brand?.toUpperCase()}</span>
                          )}
                        </td>
                        <td className={cellCls}>
                          {p.mode_penyelesaian === 'onsite' && <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">🏢 Onsite</span>}
                          {p.mode_penyelesaian === 'remote' && (
                            <div>
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-700 border border-blue-200">💻 Remote</span>
                              {p.installer_name && <p className="text-[10px] text-blue-600 mt-0.5 truncate max-w-[90px]">🔧 {p.installer_name}</p>}
                              {p.installer_daerah && <p className="text-[10px] text-gray-400 truncate max-w-[90px]">📍 {p.installer_daerah}</p>}
                            </div>
                          )}
                          {!p.mode_penyelesaian && <span className="text-xs text-gray-300">—</span>}
                        </td>
                        <td className={cellCls}>
                          {p.bast_date
                            ? <p className="text-xs font-semibold text-gray-700">{new Date(p.bast_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                            : <span className="text-xs text-amber-500 italic">Belum diisi</span>}
                        </td>
                        <td className={`${cellCls} text-right`}>
                          {hasNominal
                            ? <p className="text-sm font-black text-emerald-600">{formatRupiah(p.incentive_value || 0)}</p>
                            : <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">⏳ Belum</span>}
                        </td>
                        {bisaInput(currentUser) && (
                          <td className={`${cellCls} text-right`}>
                            {handlerSplit ? (
                              <div>
                                <p className="text-sm font-black text-rose-700">{formatRupiah(handlerSplit.amt)}</p>
                                <p className="text-[10px] text-gray-400">{handlerSplit.pct.toFixed(0)}% pool</p>
                              </div>
                            ) : <span className="text-xs text-gray-300">—</span>}
                          </td>
                        )}
                        <td className={`${cellCls} text-center`}>
                          {projTranches.length > 0 ? (
                            <div className="flex gap-0.5 justify-center">
                              {projTranches.map(t => {
                                const st = TRANCHE_STATUS[t.status] || TRANCHE_STATUS.pending;
                                return <span key={t.id} title={`T${t.tranche_number} ${st.label}`} className="w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center" style={{ background: st.bg, color: st.color }}>{t.tranche_number}</span>;
                              })}
                            </div>
                          ) : <span className="text-xs text-gray-300">—</span>}
                        </td>
                        <td className={`${cellCls} text-center`} onClick={e => e.stopPropagation()}>
                          <div className="flex gap-1 justify-center">
                            {/* View — semua role bisa akses */}
                            <button aria-label="Lihat Detail" onClick={() => openProjectDetail(p)}
                              title="Lihat Detail"
                              className="inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-all bg-white border-slate-200 text-blue-500 hover:bg-blue-50 hover:border-blue-300 hover:shadow-sm">
                              <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            </button>
                            {bisaInput(currentUser) && (
                              <button aria-label="Input Nominal" onClick={() => { setNominalProject(p); setNominalValue(String(p.incentive_value || '')); setNominalBast((p.bast_date ?? '').slice(0, 10)); }}
                                title="Input Nominal"
                                className="inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-all bg-white border-slate-200 text-rose-500 hover:bg-rose-50 hover:border-rose-300 hover:shadow-sm">
                                <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              </button>
                            )}
                            {hasNominal && projTranches.length === 0 && p.bast_date && (
                              <button aria-label="Generate Tranche" onClick={() => { setGenerateProject(p); setShowGenerateModal(true); }}
                                title="Generate Tranche"
                                className="inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-all bg-white border-slate-200 text-blue-500 hover:bg-blue-50 hover:border-blue-300 hover:shadow-sm">
                                <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                              </button>
                            )}
                            {/*
                              Jalan kembali dari Generate Tranche. Muncul hanya
                              bila tahapannya memang ada DAN belum ada yang Paid -
                              tahap yang sudah dibayar tidak boleh dihapus dari layar.
                              */}
                              {bisaKonfig(currentUser) && projTranches.length > 0
                              && !projTranches.some(t => t.status === 'paid') && (
                              <button aria-label={`Hapus tahapan ${p.project_name}`}
                                onClick={() => { setHapusTahapan(p); setKetikHapusTahapan(''); }}
                                title="Hapus tahapan pencairan (nominal terbuka lagi)"
                                className="inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-all bg-white border-amber-200 text-amber-600 hover:bg-amber-50 hover:border-amber-400 hover:shadow-sm">
                                <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a4 4 0 110 8h-1m-9-8l4-4m-4 4l4 4" /></svg>
                              </button>
                              )}
                            {bolehHapus && (
                              <>
                                <button aria-label={`Keluarkan ${p.project_name} dari Incentive`}
                                  onClick={() => mintaKonfirmasiHapus([p])} title="Keluarkan dari Incentive"
                                  className="inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-all bg-white border-slate-200 text-red-500 hover:bg-red-50 hover:border-red-300 hover:shadow-sm">
                                  <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                                <input type="checkbox" checked={pilihHapus.has(p.id)}
                                  onChange={() => togglePilih(p.id)}
                                  aria-label={`Pilih ${p.project_name}`}
                                  title="Pilih untuk dikeluarkan bersama yang lain"
                                  className="w-4 h-4 self-center accent-red-600 cursor-pointer" />
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {filteredProjects.length > 0 && (bisaInput(currentUser) ? (
                  <tfoot>
                    <tr style={{ background: 'rgba(99,102,241,0.06)' }}>
                      <td colSpan={6} className="px-3 py-2.5 border border-gray-200 text-xs font-bold text-gray-600 text-right">TOTAL</td>
                      <td className="px-3 py-2.5 border border-gray-200 text-right text-sm font-black text-emerald-700">{formatRupiah(totalPool)}</td>
                      <td className="px-3 py-2.5 border border-gray-200 text-right text-sm font-black text-rose-700">
                        {formatRupiah(filteredProjects.reduce((s, p) => s + (calcHandlerSplit(skema, p)?.amt || 0), 0))}
                      </td>
                      <td colSpan={2} className="border border-gray-200" />
                    </tr>
                  </tfoot>
                ) : (
                  /*
                    Non-privileged: total DIHITUNG DARI filteredProjects (yang
                    sudah tersaring ke project dia sendiri), BUKAN dari
                    `totalPool` (total SELURUH platform) - kalau dipakai
                    totalPool di sini, Team akan melihat total nominal
                    seluruh perusahaan, bukan cuma project miliknya sendiri.
                    Tanpa kolom Bagian Handler - itu bisa jadi bagian orang
                    lain, tidak pas dijumlah jadi satu angka utk yang login.
                  */
                  <tfoot>
                    <tr style={{ background: 'rgba(99,102,241,0.06)' }}>
                      <td colSpan={6} className="px-3 py-2.5 border border-gray-200 text-xs font-bold text-gray-600 text-right">TOTAL (project saya)</td>
                      <td className="px-3 py-2.5 border border-gray-200 text-right text-sm font-black text-emerald-700">
                        {formatRupiah(filteredProjects.filter(p => (p.incentive_value || 0) > 0).reduce((s, p) => s + (p.incentive_value || 0), 0))}
                      </td>
                      <td colSpan={2} className="border border-gray-200" />
                    </tr>
                  </tfoot>
                ))}
              </table>
            </div>
          </div>
        )}

        {/* ─── Tranches tab ─── */}
        {tab === 'tranches' && bisaInput(currentUser) && !loading && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex gap-2 items-center">
                {/*
                  "Tahun Bayar", bukan cuma "Tahun" - dropdown ini menyaring
                  lewat payment_year tranche (kapan UANGNYA cair), BUKAN tahun
                  BAST proyek. Proyek dengan BAST 2026 wajar muncul di sini
                  saat "Tahun Bayar: 2027" karena itu tahun Tahap 1-nya cair -
                  label generik "Tahun" saja gampang disalahsangka sebagai
                  tahun proyek/BAST.
                */}
                <label className="text-xs font-bold text-gray-500">Tahun Bayar:</label>
                <select value={tahunAktif} onChange={e => setFilterYear(Number(e.target.value))}
                  className="px-3 py-2 rounded-lg text-sm border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-rose-400">
                  {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
                  {uniqueYears.length === 0 && <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>}
                </select>
              </div>
              <div className="flex gap-2">
                {bisaKonfig(currentUser) && (
                  <button onClick={() => { setBatchYear(tahunAktif); setBatchConfirm(true); }}
                    className="px-4 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90" style={{ background: 'linear-gradient(135deg,#e11d48,#7c3aed)' }}>
                    🚀 Process Batch {tahunAktif}
                  </button>
                )}
                {/*
                  Jalan kembali dari Process Batch. Sengaja ditaruh bersebelahan
                  dengan tombol yang dibatalkannya - kalau tersembunyi di layar
                  lain, orang yang baru saja salah pencet tidak akan menemukannya
                  saat justru paling dibutuhkan.
                */}
                {bisaKonfig(currentUser) && filteredTranches.some(t => t.status === 'processed') && (
                  <button onClick={() => { setBatalBatch(tahunAktif); setKetikBatalBatch(''); }}
                    title={`Kembalikan tahapan ${tahunAktif} dari Processed ke Pending`}
                    className="px-4 py-2 rounded-xl text-sm font-bold border-2 border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100">
                    ↩️ Batalkan Batch {tahunAktif}
                  </button>
                )}
                {/*
                  Export batch tahun bayar yang lagi aktif di dropdown "Tahun"
                  atas - beda dari "Export Summary" di tab Project (yang
                  menyaring lewat BAST). Sengaja ditaruh di sini juga: begitu
                  platform ini sudah jalan tahunan dan banyak tahun tercatat,
                  Finance perlu bisa re-export SATU batch tahun bayar tertentu
                  saja (mis. menjelang Process Batch, atau setelah ada Support
                  baru terdeteksi) tanpa harus mengutak-atik filter BAST di
                  tab lain. Lihat handleExportBatch.
                */}
                <button onClick={handleExportBatch} disabled={exporting}
                  title={`Export project pada batch Tahun Bayar ${tahunAktif} (mengikuti dropdown Tahun Bayar di atas) - BUKAN tahun BAST proyeknya`}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50 flex items-center gap-1.5">
                  {exporting ? <div className="w-3 h-3 border-2 border-emerald-400/30 border-t-emerald-500 rounded-full animate-spin" /> : '📊'} Export Batch Tahun Bayar {tahunAktif}
                </button>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.10),rgba(139,92,246,0.07))' }}>
                      {['Project', 'Handler', 'Tranche', '%', 'Tahun Bayar', 'Status', 'Aksi'].map(h => (
                        <th key={h} className={thCls}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTranches.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-12 text-center border border-gray-200">
                        <p className="text-3xl mb-2">📅</p>
                        <p className="text-gray-500 font-medium">Tidak ada tranche untuk Tahun Bayar {tahunAktif}</p>
                      </td></tr>
                    ) : filteredTranches.map((t, idx) => {
                      const st = TRANCHE_STATUS[t.status] || TRANCHE_STATUS.pending;
                      const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-rose-50/30';
                      return (
                        <tr key={t.id} className={`hover:bg-rose-50/60 transition-colors ${rowBg}`}>
                          <td className="px-3 py-2.5 border border-gray-200">
                            <p className="font-bold text-gray-800">{t.project?.project_name || '—'}</p>
                            <p className="text-[10px] text-gray-400">{t.project?.category}</p>
                          </td>
                          <td className="px-3 py-2.5 border border-gray-200 text-sm text-gray-700">{t.project?.assign_name || '—'}</td>
                          <td className="px-3 py-2.5 border border-gray-200"><span className="px-2 py-1 rounded-lg text-xs font-bold bg-gray-100 text-gray-600">T{t.tranche_number}</span></td>
                          <td className="px-3 py-2.5 border border-gray-200 font-bold text-gray-700">{t.percentage}%</td>
                          <td className="px-3 py-2.5 border border-gray-200 text-gray-600">
                            {/*
                              Tahun bayar dibandingkan dengan yang SEHARUSNYA
                              menurut skema: tahun BAST + tahunKe tahap itu.

                              Perlu ditandai karena tahapan lama tidak ikut
                              berubah ketika aturannya diperbaiki - baris yang
                              dibuat sebelum perbaikan tetap membawa tahun
                              lamanya, dan dari layar ia terlihat sama sahnya
                              dengan baris yang benar. Selisih seperti ini
                              memindahkan uang antar tahun anggaran, jadi lebih
                              baik terlihat mencolok daripada rapi tapi keliru.
                            */}
                            {(() => {
                              const bast = t.project?.bast_date;
                              const tahunKe = skema?.tranche.find(x => x.nomor === t.tranche_number)?.tahunKe;
                              const seharusnya = bast && tahunKe != null
                                ? new Date(bast).getFullYear() + tahunKe : null;
                              const menyimpang = seharusnya != null && seharusnya !== t.payment_year;
                              return (
                                <span className="flex items-center gap-1.5 flex-wrap">
                                  <span className={menyimpang ? 'font-bold text-amber-700' : ''}>{t.payment_year}</span>
                                  {menyimpang && (
                                    <span title={`Menurut skema seharusnya ${seharusnya} (BAST ${bast} + tahun ke-${tahunKe}). `
                                      + 'Tahapan ini kemungkinan dibuat sebelum aturannya diperbaiki — hapus tahapannya lalu Generate ulang.'}
                                      className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 whitespace-nowrap cursor-help">
                                      ⚠ harusnya {seharusnya}
                                    </span>
                                  )}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="px-3 py-2.5 border border-gray-200"><span className="px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: st.bg, color: st.color }}>{st.icon} {st.label}</span></td>
                          <td className="px-3 py-2.5 border border-gray-200">
                            {t.status === 'processed' && bisaKonfig(currentUser) && (
                              <button onClick={() => konfirmasiMarkPaid(t.id, t.project?.project_name || '—', t.tranche_number)}
                                disabled={markingPaid === t.id}
                                className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-emerald-600 hover:bg-emerald-50 border border-emerald-200 transition-all disabled:opacity-50">
                                {markingPaid === t.id ? '⏳...' : '✅ Tandai Paid'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─── Late Ticket Queue tab ─── */}
        {tab === 'late' && bisaInput(currentUser) && !loading && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200" style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.08),rgba(234,88,12,0.05))' }}>
              <h2 className="font-bold text-gray-800">🕐 Late Ticket Queue</h2>
              <p className="text-xs text-gray-400 mt-0.5">Ticket Troubleshooting yang masuk setelah cutoff project induk — dilampirkan ke tranche berikutnya yang belum dibayar.</p>
            </div>
            {lateTickets.length === 0
              ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-2xl mb-2">📭</p>
                  <p className="text-sm text-gray-500 italic">Belum ada late ticket yang dilampirkan.</p>
                </div>
              )
              : (
                <div className="divide-y divide-gray-100">
                  {lateTickets.map(lt => (
                    <div key={lt.id} className="px-5 py-3 flex items-center justify-between hover:bg-amber-50/40 transition-colors">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Tranche {lt.attached_tranche_number}</p>
                        <p className="text-xs text-gray-400">{new Date(lt.attached_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}{lt.note ? ` · ${lt.note}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-amber-700">{formatRupiah(lt.ticket_value || 0)}</span>
                        {lt.is_sunset && <span className="px-2 py-0.5 rounded text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200">Sunset</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        )}

        {/* ─── Skema pembagian (admin) ─── */}
        {tab === 'skema' && bisaKonfig(currentUser) && (
          <SchemeTab
            olehNama={(currentUser?.full_name as string) || (currentUser?.username as string) || 'admin'}
            notify={notify}
          />
        )}

        {/* ─── Settings tab ─── */}
        {tab === 'settings' && bisaKonfig(currentUser) && !loading && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200" style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.08),rgba(139,92,246,0.05))' }}>
              <h2 className="font-bold text-gray-800">⚙️ Akses Incentive PTS</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Tingkat akses tiap orang diatur di sini — tidak ada lagi yang ditentukan dari kode.
                Role <strong>admin</strong> selalu Konfigurasi penuh dan selalu melihat semua brand.
              </p>
              {/*
                Keterangan tiga tingkat dicetak di layar, bukan hanya di tooltip.
                Tombol yang membagi-bagi uang harus bisa dibaca akibatnya
                sebelum ditekan, terutama oleh orang yang baru memakai modul ini.
              */}
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                {URUTAN_AKSES.map(t => (
                  <div key={t} className="rounded-lg border border-indigo-100 bg-white/70 px-3 py-2">
                    <p className="text-[11px] font-bold text-indigo-700">{LABEL_AKSES[t]}</p>
                    <p className="text-[10px] text-gray-500 leading-snug mt-0.5">{JELAS_AKSES[t]}</p>
                  </div>
                ))}
              </div>
              {/*
                Pencarian. Daftar ini berisi seluruh user guest & team - pada
                perusahaan sebesar ini menggulirnya untuk menemukan dua orang
                Finance jauh lebih lambat daripada mengetik namanya.
              */}
              <input value={cariUser} onChange={e => setCariUser(e.target.value)}
                placeholder="🔍 Cari nama atau username…" aria-label="Cari pengguna"
                className="mt-3 w-full sm:max-w-xs text-xs px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div className="divide-y divide-gray-100">
              {(() => {
                const q = cariUser.trim().toLowerCase();
                const daftar = allUsers
                  .filter(u => u.role === 'guest' || u.role === 'team')
                  .filter(u => !q
                    || ((u.full_name as string) || '').toLowerCase().includes(q)
                    || ((u.username as string) || '').toLowerCase().includes(q));
                if (daftar.length === 0) {
                  return <p className="px-5 py-4 text-sm text-gray-500 italic">
                    {q ? `Tidak ada pengguna cocok dengan "${cariUser}".` : 'Tidak ada user guest/team.'}
                  </p>;
                }
                return daftar.map(u => {
                  const akses = tingkatAkses(u);
                  const diriSendiri = u.id === currentUser?.id;
                  /*
                    Full Access (Kelola Akun) SELALU menang jadi 'penuh' di
                    sini juga (lihat tingkatAkses di lib/incentive-akses.ts) -
                    tombol tiga tingkat di bawah karena itu tidak berarti
                    apa-apa untuknya: mengklik "Lihat saja" akan tersimpan ke
                    kolom, tapi tampilannya tetap 'penuh' di render berikutnya
                    karena Full Access mengambil alih. Daripada tombolnya
                    terlihat "tidak berfungsi", untuk akun begini tombolnya
                    diganti keterangan - turunkan aksesnya lewat Kelola Akun,
                    bukan dari sini.
                  */
                  const viaFullAccess = (u.role === 'team' || u.role === 'team_pts') && (u.access_level as string | null) === 'full';
                  return (
                    <div key={u.id as string} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-gray-50 transition-colors flex-wrap">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-700">
                          {u.full_name as string}
                          {diriSendiri && <span className="ml-1.5 text-[10px] font-bold text-indigo-500">(Anda)</span>}
                        </p>
                        <p className="text-xs text-gray-500">
                          {u.username as string} · {u.role as string}
                          {u.jabatan ? ` · ${u.jabatan as string}` : ''}{u.team_type ? ` · ${u.team_type as string}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {/*
                          Pemilih lingkup hanya muncul untuk yang sudah punya
                          akses input/penuh. Menetapkan lingkup pada orang yang
                          hanya boleh melihat tidak berakibat apa-apa, dan
                          menampilkannya hanya membuat daftar ini penuh kontrol
                          yang tidak mengubah apa pun.
                        */}
                        {akses !== 'lihat' && (
                          <div className="flex items-center gap-1" role="group" aria-label={`Lingkup brand ${u.full_name as string}`}>
                            {([['MVI', '🏠 MVI'], ['IVP', '🌐 IVP'], [null, 'Semua']] as const).map(([nilai, label]) => {
                              const aktif = (u.incentive_brand_scope ?? null) === nilai;
                              return (
                                <button key={label} onClick={() => handleSetBrandScope(u.id as string, nilai)}
                                  title={nilai ? `Hanya proyek brand ${nilai} (proyek Kedua Brand tetap terlihat)` : 'Melihat semua brand'}
                                  className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-all ${aktif
                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                    : 'border-gray-200 bg-white text-gray-500 hover:border-indigo-300'}`}>
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {/*
                          Tiga tombol, bukan satu saklar: tingkat aksesnya
                          memang tiga, dan menyembunyikan yang ketiga di balik
                          saklar dua keadaan itulah yang dulu membuat "beri
                          Manager akses penuh" mustahil tanpa mengubah kode.
                        */}
                        {viaFullAccess ? (
                          <span title="Diberikan lewat toggle Full Access di Kelola Akun. Untuk mengubahnya, cabut Full Access di sana - bukan di sini."
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold border-2"
                            style={{ borderColor: '#10b981', background: '#ecfdf5', color: '#047857' }}>
                            🔓 Konfigurasi penuh · Full Access
                          </span>
                        ) : (
                        <div className="flex items-center gap-1" role="group" aria-label={`Tingkat akses ${u.full_name as string}`}>
                          {URUTAN_AKSES.map(t => {
                            const aktif = akses === t;
                            //  Menurunkan akses diri sendiri ditolak server; tombolnya
                            //  dimatikan di sini supaya penolakan itu tidak jadi kejutan.
                            const terkunci = diriSendiri && t !== 'penuh';
                            //  Warnanya lewat style, bukan kelas Tailwind yang
                            //  dirangkai dari variabel: kelas seperti
                            //  `border-${warna}-500` tidak pernah ikut ter-build
                            //  karena Tailwind memindai kode sebagai teks.
                            const warna = t === 'penuh'
                              ? { garis: '#10b981', latar: '#ecfdf5', teks: '#047857' }
                              : t === 'input'
                                ? { garis: '#6366f1', latar: '#eef2ff', teks: '#4338ca' }
                                : { garis: '#9ca3af', latar: '#f9fafb', teks: '#4b5563' };
                            return (
                              <button key={t} disabled={terkunci}
                                onClick={() => handleSetAkses(u.id as string, t)}
                                title={terkunci ? 'Tidak bisa menurunkan akses Anda sendiri.' : JELAS_AKSES[t]}
                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border-2 transition-all ${terkunci
                                  ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                                  : aktif ? '' : 'border-gray-200 bg-white text-gray-500 hover:border-indigo-300'}`}
                                style={aktif && !terkunci
                                  ? { borderColor: warna.garis, background: warna.latar, color: warna.teks }
                                  : undefined}>
                                {aktif ? '✅ ' : ''}{LABEL_AKSES[t]}
                              </button>
                            );
                          })}
                        </div>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}
      </div>

      {/* ─── MODAL: Input Nominal ─── */}
      {nominalProject && (
      <ModalPortal>
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1100] p-4" onClick={e => { if (e.target === e.currentTarget) setNominalProject(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" style={{ border: '1.5px solid rgba(99,102,241,0.3)' }}>
            <div className="px-5 py-4" style={{ background: 'linear-gradient(135deg,#e11d48,#7c3aed)' }}>
              <h3 className="text-base font-bold text-white">💰 Input Nominal Incentive</h3>
              <p className="text-xs text-rose-200 mt-0.5 truncate">{nominalProject.project_name}</p>
            </div>
            <div className="p-5 space-y-4">
              {/*
                BAST - terisi otomatis saat Handler klik Completed, TAPI tetap
                bisa dibetulkan di sini.

                Alasannya bukan kelengkapan fitur: status Completed sengaja
                dikunci di Reminder Schedule ("tidak dapat diubah kembali"), dan
                formulir Edit-nya tidak punya input BAST sama sekali. Jadi
                begitu sebuah proyek terlanjur selesai tanpa BAST - mis. jadwal
                multi-tanggal yang BAST-nya menempel di baris lain, atau jadwal
                lama dari sebelum modal penyelesaian ada - tidak ada satu pun
                jalan di layar untuk membetulkannya, dan tombol Generate Tahapan
                tidak akan pernah muncul karena syaratnya adalah adanya BAST.
                Satu-satunya jalan keluar tersisa adalah menyunting basis data
                langsung, dan itu bukan sesuatu yang boleh jadi prosedur normal
                untuk data yang menentukan pembayaran.
              */}
              <div className="px-4 py-3 rounded-xl bg-gray-50 border border-gray-200">
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Tanggal BAST</p>
                  {nominalProject.bast_date
                    ? <span className="flex-shrink-0 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">Auto ✓</span>
                    : <span className="flex-shrink-0 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">Perlu diisi</span>}
                </div>
                <input type="date" value={nominalBast} onChange={e => setNominalBast(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-rose-400" />
                <p className="text-[11px] text-gray-400 mt-1.5">
                  {nominalBast
                    ? <>Tahapan akan jatuh di {new Date(nominalBast).getFullYear() + 1} · {new Date(nominalBast).getFullYear() + 2} · {new Date(nominalBast).getFullYear() + 3}</>
                    : 'Biasanya terisi sendiri saat Handler klik Completed. Isi di sini kalau kosong — tanpa BAST, tahapan pencairan tidak bisa dibuat.'}
                </p>
              </div>

              {/* Mode info */}
              {nominalProject.mode_penyelesaian && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-50 border border-gray-200">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${nominalProject.mode_penyelesaian === 'onsite' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                    {nominalProject.mode_penyelesaian === 'onsite' ? '🏢 Onsite' : '💻 Remote'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {/*
                      Dulu ditulis literal ('100%'/'85%'/'60%'/'51%'), lepas dari skema
                      yang sedang berlaku - begitu Scheme Setting diubah, angka di sini
                      diam-diam berbeda dari yang benar-benar dibayar (dihitung
                      calcHandlerSplit beberapa baris di bawah). Sekarang pakai fungsi
                      yang sama dengan mesin pembayaran (persenPicBerlaku), dengan
                      asumsi "ada Troubleshooting" - konvensi yang sama dipakai
                      calcHandlerSplit di atas untuk ringkasan ini.
                    */}
                    {nominalProject.pic_type === 'manager_pic' ? 'Manager PIC → ' : 'Standard → '}
                    {skema ? formatPct(persenPicBerlaku(
                      skema, nominalProject.mode_penyelesaian === 'remote', true,
                      nominalProject.pic_type === 'manager_pic',
                    )) : '—'} handler
                  </span>
                </div>
              )}

              {/* Nominal */}
              <div>
                <label className="block text-xs font-bold mb-1.5 text-gray-500 uppercase tracking-widest">Nilai Incentive (Rp) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">Rp</span>
                  <input type="number" min={0} value={nominalValue} onChange={e => setNominalValue(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-rose-400"
                    placeholder="Contoh: 15000000" autoFocus />
                </div>
                {nominalValue && Number(nominalValue) > 0 && (
                  <div className="mt-2 p-3 rounded-xl bg-rose-50 border border-rose-100 space-y-1">
                    <p className="text-xs font-bold text-rose-600">{formatRupiah(Number(nominalValue))}</p>
                    {nominalProject.mode_penyelesaian && (() => {
                      const split = calcHandlerSplit(skema, { ...nominalProject, incentive_value: Number(nominalValue) });
                      return split ? <p className="text-[11px] text-gray-500">Bagian handler: <strong className="text-rose-700">{formatRupiah(split.amt)}</strong> ({formatPct(split.pct)})</p> : null;
                    })()}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => { setNominalProject(null); setNominalValue(''); setNominalBast(''); }} className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-gray-500 border border-gray-200 hover:bg-gray-50">Batal</button>
              <button onClick={handleSaveNominal} disabled={savingNominal}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#e11d48,#7c3aed)' }}>
                {savingNominal && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Simpan
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>
      )}

      {/* ─── MODAL: Project Detail ─── */}
      {detailProject && (
      <ModalPortal>
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1100] p-4 overflow-y-auto" onClick={e => { if (e.target === e.currentTarget) setDetailProject(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-full flex flex-col overflow-hidden border border-gray-200">
            <div className="px-6 py-5" style={{ background: 'linear-gradient(135deg,#e11d48,#7c3aed)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">{detailProject.project_name}</h2>
                  <p className="text-xs text-rose-200 mt-0.5">{detailProject.assign_name} · {detailProject.category}</p>
                </div>
                <button aria-label="Tutup" onClick={() => setDetailProject(null)} className="bg-white/15 hover:bg-white/25 text-white p-2 rounded-lg">
                  <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="p-6 flex-1 min-h-0 overflow-y-auto space-y-5">
              <div className={`grid ${bisaInput(currentUser) ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
                {bisaInput(currentUser) && (
                  <div className="rounded-xl p-3 text-center bg-emerald-50 border border-emerald-100">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Total Pool</p>
                    <p className="text-base font-black text-emerald-700">{formatRupiah(detailProject.incentive_value || 0)}</p>
                  </div>
                )}
                <div className="rounded-xl p-3 text-center bg-blue-50 border border-blue-100">
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Mode</p>
                  <p className="text-sm font-bold text-blue-700">{detailProject.mode_penyelesaian === 'onsite' ? '🏢 Onsite' : detailProject.mode_penyelesaian === 'remote' ? '💻 Remote' : '—'}</p>
                  {detailProject.mode_penyelesaian === 'remote' && detailProject.installer_name && (
                    <p className="text-[10px] text-blue-500 mt-0.5 font-medium">🔧 {detailProject.installer_name}{detailProject.installer_daerah ? ` · ${detailProject.installer_daerah}` : ''}</p>
                  )}
                </div>
                <div className="rounded-xl p-3 text-center bg-violet-50 border border-violet-100">
                  <p className="text-[10px] font-bold text-violet-600 uppercase tracking-widest">BAST</p>
                  <p className="text-sm font-bold text-violet-700">{detailProject.bast_date ? new Date(detailProject.bast_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</p>
                </div>
              </div>

              {/*
                Controller Automation yang dipilih di Reminder Schedule.
                Datanya SUDAH tersimpan sejak dulu (requires_controller_automation
                + controller_automation_brand) dan sudah tampil sebagai lencana di
                kartu daftar - tapi hilang begitu detailnya dibuka. Padahal justru
                di sinilah ia dibutuhkan: brand Controller-lah yang menjelaskan
                kenapa sebuah proyek jatuh ke skema Manager-sebagai-PIC (Extron /
                Wyrestorm biasanya ditangani langsung Manager), jadi tanpa
                keterangan ini pembagiannya terlihat seperti keputusan tanpa sebab.
              */}
              <div className="rounded-xl p-3 border border-emerald-100 bg-emerald-50/60">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">⚡ Controller Automation</p>
                  {detailProject.requires_controller_automation ? (
                    <span className="text-[11px] font-black px-2 py-0.5 rounded-lg bg-emerald-600 text-white">
                      {detailProject.controller_automation_brand?.toUpperCase() || 'YA'}
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500">Tidak dipakai</span>
                  )}
                </div>
                <p className="text-[10px] text-emerald-700/70 mt-1 leading-relaxed">
                  Dipilih saat pembuatan Request Schedule dan ikut tercatat pada proyek ini.
                  {detailProject.pic_type === 'manager_pic' && ' Proyek ini memakai skema Manager-sebagai-PIC karena handler-nya berjabatan Manager.'}
                </p>
              </div>

              {/* Pembagian Incentive — auto-calculated, selalu tampil */}
              {(() => {
                const pool = detailProject.incentive_value || 0;
                const effectiveMode = detailProject.mode_penyelesaian || 'onsite';
                const effectivePool = pool > 0 ? pool : 1_000_000;
                const isEstimate = pool <= 0 || !detailProject.mode_penyelesaian;
                // Manager & Supervisor dibaca dari Struktur Organisasi (users.atasan_id + jabatan),
                // BUKAN hardcode nama. Resolve PIC via id/nama, lalu walk-up pohon atasan.
                const orgList = allUsers as unknown as OrgUser[];
                const picId = resolveUserId((detailProject.pic_id || detailProject.assigned_to) as string, detailProject.assign_name, orgList);
                const mgrUp = findUpline(picId, 'Manager', orgList);
                const supUp = findUpline(picId, 'Supervisor', orgList);
                // Fallback transisi (tanpa hardcode nama): pts_team_mappings utk supervisor, jabatan utk manager
                const dbPtsMap = ptsTeamMappings.find(m => m.staff_user_id === detailProject.assigned_to);
                const mgrUser = mgrUp
                  ? allUsers.find(u => u.id === mgrUp.id)
                  : (allUsers.find(u => ((u.jabatan as string) || '') === 'Manager' && ((u.team_type as string) || '').toLowerCase().includes('pts'))
                     ?? allUsers.find(u => ((u.jabatan as string) || '') === 'Manager'));
                const supUser = supUp
                  ? allUsers.find(u => u.id === supUp.id)
                  : dbPtsMap ? allUsers.find(u => u.id === dbPtsMap.supervisor_user_id) : undefined;
                const managerId   = (mgrUser?.id        || '') as string;
                const managerName = (mgrUser?.full_name || 'Manager') as string;
                const supervisorId   = (supUser?.id        || '') as string;
                const supervisorName = (supUser?.full_name || 'Supervisor') as string;
                const displayProject: IncentiveProjectRow = { ...detailProject, incentive_value: effectivePool, mode_penyelesaian: effectiveMode };
                //  Pratinjau memakai Support TAHUN PERTAMA - komposisinya berbeda tiap
                //  tahun, jadi satu angka gabungan tidak akan pernah benar untuk
                //  tahun mana pun. Rinciannya ada di daftar per tahun di bawah.
                const supportTahun1 = detailSupports.find(x => x.tahunKe === 1)?.orang ?? [];
                const splits = calculateIncentiveSplits(skema!, displayProject, managerId, managerName, supervisorId, supervisorName, supportTahun1, picId);
                if (!splits.length) return null;
                // Privasi: non-privileged (selain Admin & yang ditunjuk input nominal)
                // hanya melihat bagiannya sendiri - bukan total pool / bagian orang lain.
                const privileged = bisaInput(currentUser);
                const myName = (currentUser?.full_name || '').toLowerCase().trim();
                const visibleSplits = privileged
                  ? splits
                  : splits.filter(s => (s.user_id && s.user_id === currentUser?.id) || (!!myName && (s.user_name || '').toLowerCase().trim() === myName));
                const schemeLabel = detailProject.pic_type === 'manager_pic' ? 'Manager sebagai PIC' : 'Standard';
                const modeLabel = effectiveMode === 'remote' ? 'Remote' : 'Onsite';
                return (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-bold text-gray-700">{privileged ? '💰 Pembagian Incentive' : '💰 Bagian Saya'}</h3>
                      <div className="flex items-center gap-1.5">
                        {privileged && <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{schemeLabel} · {modeLabel}</span>}
                        {isEstimate && <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">Estimasi</span>}
                      </div>
                    </div>
                    {!privileged && visibleSplits.length === 0 && (
                      <div className="rounded-xl px-4 py-6 text-center bg-gray-50 border border-gray-100">
                        <p className="text-sm text-gray-400">Kamu tidak tercatat mendapat bagian di project ini.</p>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      {visibleSplits.map((s, i) => {
                        const rl = ROLE_LABELS[s.role] || { label: s.role, color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' };
                        const isInstaller = s.role === 'installer';
                        return (
                          <div key={i} className="flex items-center justify-between rounded-xl px-4 py-2.5"
                            style={{ background: isInstaller ? 'rgba(245,158,11,0.07)' : 'rgba(99,102,241,0.05)', border: `1px solid ${isInstaller ? 'rgba(245,158,11,0.2)' : 'rgba(99,102,241,0.12)'}` }}>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: rl.bg, color: rl.color }}>{rl.label}</span>
                              <div>
                                <p className="text-sm font-semibold text-gray-800">{s.user_name || '—'}</p>
                                {isInstaller && detailProject.installer_daerah && (
                                  <p className="text-[10px] text-gray-400">📍 {detailProject.installer_daerah}</p>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-black text-gray-800">
                                {pool > 0 ? formatRupiah(s.amount) : '—'}
                              </p>
                              <p className="text-[10px] text-gray-400">{formatPct(s.percentage)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {isEstimate && (
                      <p className="text-[10px] text-amber-500 mt-1.5 italic">
                        {!pool
                          ? '* Belum ada nominal — angka Rp akan muncul setelah input nominal.'
                          : '* Mode belum diset (estimasi Onsite) — akan update setelah Handler klik Completed di Reminder Schedule.'}
                      </p>
                    )}
                  </div>
                );
              })()}

              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-2">📅 Tranches</h3>
                {detailTranches.length === 0
                  ? <p className="text-xs text-gray-400 italic">Belum ada tranche.</p>
                  : detailTranches.map(t => {
                    const st = TRANCHE_STATUS[t.status] || TRANCHE_STATUS.pending;
                    const amt = (detailProject.incentive_value || 0) * (t.percentage / 100);
                    return (
                      <div key={t.id} className="flex items-center justify-between rounded-lg px-4 py-3 bg-gray-50 border border-gray-100 mb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-black text-gray-700">T{t.tranche_number}</span>
                          <span className="text-sm text-gray-600">{t.percentage}%{bisaInput(currentUser) ? ` · ${formatRupiah(Math.round(amt))}` : ''}</span>
                          <span className="text-xs text-gray-400">Tahun {t.payment_year}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: st.bg, color: st.color }}>{st.icon} {st.label}</span>
                          {t.status === 'processed' && bisaKonfig(currentUser) && (
                            <button onClick={() => konfirmasiMarkPaid(t.id, detailProject.project_name || '—', t.tranche_number)}
                              disabled={markingPaid === t.id}
                              className="px-2 py-1 rounded text-[10px] font-bold text-emerald-600 hover:bg-emerald-50 border border-emerald-200 disabled:opacity-50">
                              {markingPaid === t.id ? '⏳...' : 'Tandai Paid'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                }
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-2">{bisaInput(currentUser) ? '💰 Incentive Splits' : '💰 Bagian Saya (Tercatat)'}</h3>
                {(() => {
                  const myNm = (currentUser?.full_name || '').toLowerCase().trim();
                  const visDb = bisaInput(currentUser) ? detailSplits : detailSplits.filter(s => (s.user_id && s.user_id === currentUser?.id) || (!!myNm && (s.user_name || '').toLowerCase().trim() === myNm));
                  return visDb.length === 0
                  ? <p className="text-xs text-gray-400 italic">{bisaInput(currentUser) ? 'Belum ada split. Proses batch untuk generate.' : 'Belum ada bagian tercatat untukmu.'}</p>
                  : visDb.map(s => {
                    const rl = ROLE_LABELS[s.role] || { label: s.role, color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' };
                    return (
                      <div key={s.id} className="flex items-center justify-between rounded-lg px-4 py-2.5 bg-gray-50 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: rl.bg, color: rl.color }}>{rl.label}</span>
                          <span className="text-sm text-gray-700">{s.user_name || '—'}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-gray-800">{formatRupiah(s.amount || 0)}</span>
                          <span className="text-xs text-gray-400 ml-2">({formatPct(s.percentage)})</span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-1">👥 Support per Tahun Pencairan</h3>
                <p className="text-[11px] text-gray-600 mb-2 leading-relaxed">
                  Diambil otomatis dari <strong>ticket Troubleshooting yang berstatus Solved</strong> dan dari
                  <strong> jadwal Troubleshooting yang ditutup selesai</strong> — keduanya dibaca, karena
                  Troubleshooting memang tercatat di dua tempat. Yang menentukan tahunnya adalah tanggal
                  pekerjaan itu <strong>selesai</strong>, bukan tanggal dilaporkan. Tiap tahun dinilai ulang:
                  yang menangani boleh orang yang sama atau berbeda, dan yang tidak menangani di tahun itu
                  tidak ikut dibayar untuk tahun itu.
                </p>
                <div className="space-y-2">
                  {detailSupports.map(th => {
                    const rentang = th.dari
                      ? `${new Date(th.dari).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })} → ${th.sampai ? new Date(th.sampai).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}`
                      : `s.d. ${th.sampai ? new Date(th.sampai).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} (termasuk sebelum BAST)`;
                    return (
                      <div key={th.tahunKe} className="rounded-xl border border-gray-100 overflow-hidden">
                        <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-gray-50 flex-wrap">
                          <span className="text-[11px] font-black uppercase tracking-widest text-gray-500">Tahun {th.tahunKe}</span>
                          <span className="text-[10px] text-gray-400">{rentang}</span>
                        </div>
                        {th.orang.length === 0 ? (
                          //  Bukan sekadar "kosong": tanpa Support di tahun itu, porsinya
                          //  jatuh ke PIC menurut skema "tanpa support" - dan itu perlu
                          //  terbaca supaya angkanya tidak terlihat seperti salah hitung.
                          <p className="text-[11px] text-gray-400 italic px-3 py-2">
                            Belum ada Troubleshooting yang selesai di tahun ini — porsi Support tahun ini diserap PIC.
                          </p>
                        ) : th.orang.map(s => (
                          <div key={`${th.tahunKe}-${s.user_id}`} className="flex items-center justify-between px-3 py-1.5 border-t border-gray-50">
                            <span className="text-sm text-gray-700">{s.user_name || s.user_id}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200">Troubleshooting</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </ModalPortal>
      )}

      {/* ─── MODAL: Generate Tranche ─── */}
      {showGenerateModal && generateProject && (
      <ModalPortal>
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1200] p-4" onClick={e => { if (e.target === e.currentTarget) { setShowGenerateModal(false); setGenerateProject(null); } }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4">⚡ Generate Tranche</h3>
            <p className="text-sm text-gray-500 mb-1">Project: <strong className="text-gray-800">{generateProject.project_name}</strong></p>
            <p className="text-sm text-gray-500 mb-4">BAST: <strong>{generateProject.bast_date}</strong> · Pool: <strong className="text-emerald-600">{formatRupiah(generateProject.incentive_value || 0)}</strong></p>
            {/*
              Pratinjau memisahkan porsi Tim PTS dan porsi Installer, karena
              keduanya memang dibayar dengan cara berbeda: Tim PTS dipecah
              menurut tahapan, Installer lunas sekali di tahap pertama.
              Sebelumnya baris ini menampilkan pool x persen tahap begitu saja -
              angka yang tidak pernah benar untuk proyek Remote, sebab porsi
              Installer sudah dipotong lebih dulu dari pool Tim PTS.
            */}
            {(() => {
              const pool = generateProject.incentive_value || 0;
              //  Lewat petaPorsiBerlaku, bukan persenInstaller: saat tabel Porsi
              //  Remote diatur sendiri, porsi Installer diambil dari baris di
              //  tabel itu - bukan dari kolom "Porsi Installer".
              const pctInst = petaPorsiBerlaku(
                skema!, generateProject.mode_penyelesaian === 'remote', true,
              ).pctInstaller;
              const poolTim = pool * ((100 - pctInst) / 100);
              const daftar = generateTranches(skema!, generateProject.id, generateProject.bast_date!, generateProject.mode_penyelesaian);
              const tahapPertama = daftar.length ? Math.min(...daftar.map(t => t.tranche_number)) : 1;
              return (
                <div className="space-y-2 mb-6">
                  {daftar.map(t => {
                    const installerDiSini = pctInst > 0 && skema!.installerBayarDiMuka && t.tranche_number === tahapPertama;
                    return (
                      <div key={t.tranche_number} className="rounded-lg px-4 py-2.5 border border-gray-100" style={{ background: 'rgb(249,250,251)' }}>
                        <div className="flex justify-between items-baseline gap-2 flex-wrap">
                          <span className="text-sm font-bold text-gray-700">Tahap {t.tranche_number} · Bayar {t.payment_year}</span>
                          <span className="text-sm text-gray-500">
                            Tim PTS {t.percentage}% · {formatRupiah(Math.round(poolTim * t.percentage / 100))}
                          </span>
                        </div>
                        {installerDiSini && (
                          <div className="flex justify-between items-baseline gap-2 flex-wrap mt-1 pt-1 border-t border-gray-100">
                            <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">+ Installer — lunas sekali</span>
                            <span className="text-sm text-amber-700 font-bold">{pctInst}% · {formatRupiah(Math.round(pool * pctInst / 100))}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {pctInst > 0 && (
                    <p className="text-[11px] text-gray-500 leading-relaxed pt-1">
                      Porsi Installer {pctInst}% dipotong dari pool lebih dulu; sisa {100 - pctInst}% milik Tim PTS
                      itulah yang dipecah {daftar.map(t => `${t.percentage}%`).join(' / ')} selama {daftar.length} tahun.
                    </p>
                  )}
                </div>
              );
            })()}
            <div className="flex gap-3">
              <button onClick={() => { setShowGenerateModal(false); setGenerateProject(null); }} className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-gray-500 border border-gray-200 hover:bg-gray-50">Batal</button>
              <button onClick={handleGenerateTranches} disabled={generating}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#e11d48,#7c3aed)' }}>
                {generating && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Generate
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>
      )}

      {/* ─── MODAL: Konfirmasi Generate Tahapan Massal ─── */}
      {bulkGenerateConfirm && (
      <ModalPortal>
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(3px)' }}
          onClick={() => !bulkGenerating && setBulkGenerateConfirm(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()} role="dialog" aria-modal="true"
            aria-labelledby="judul-bulk-generate">
            <div className="px-5 py-4 bg-blue-600 text-white">
              <h3 id="judul-bulk-generate" className="font-bold text-base">
                🚀 Generate Tahapan untuk {bulkGenerateConfirm.length} project — Tahun BAST {filterBastYear}?
              </h3>
            </div>
            <div className="p-5 space-y-3">
              <ul className="max-h-52 overflow-y-auto space-y-1 rounded-lg bg-slate-50 border border-slate-200 p-2.5">
                {bulkGenerateConfirm.map(p => (
                  <li key={p.id} className="text-sm text-slate-700 truncate" title={p.project_name}>
                    • {p.project_name}
                    <span className="ml-1 text-[11px] font-bold text-emerald-600">
                      {formatRupiah(p.incentive_value || 0)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="text-[13px] leading-relaxed space-y-1.5">
                <p className="text-slate-600">
                  Tiap project diproses satu-satu lewat fungsi yang sama dengan tombol{' '}
                  <strong>Generate Tranche</strong> perorangan — persentase per tahap dan tahun
                  pembayaran dihitung dari BAST masing-masing project, bukan tanggal hari ini.
                </p>
                <p className="text-slate-600">
                  Project yang <strong>sudah</strong> punya tahapan (dibuat orang lain sesudah
                  daftar ini dimuat) otomatis dilewati — tidak akan dibuat dobel.
                </p>
              </div>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button onClick={() => setBulkGenerateConfirm(null)} disabled={bulkGenerating}
                className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-50">
                Batal
              </button>
              <button onClick={jalankanBulkGenerate} disabled={bulkGenerating}
                className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                {bulkGenerating && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Generate {bulkGenerateConfirm.length} Tahapan
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>
      )}

      {/* ─── MODAL: Hasil Generate Tahapan Massal ─── */}
      {bulkGenerateResult && (
      <ModalPortal>
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(3px)' }}
          onClick={() => setBulkGenerateResult(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()} role="dialog" aria-modal="true"
            aria-labelledby="judul-hasil-bulk-generate">
            <div className="px-5 py-4 bg-slate-800 text-white">
              <h3 id="judul-hasil-bulk-generate" className="font-bold text-base">
                Hasil Generate Tahapan Massal {bulkGenerateResult.tahun}
              </h3>
            </div>
            <div className="p-5 space-y-3 max-h-96 overflow-y-auto">
              {bulkGenerateResult.berhasil.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-emerald-700 mb-1">✅ Berhasil ({bulkGenerateResult.berhasil.length})</p>
                  <ul className="text-[13px] text-slate-600 space-y-0.5">
                    {bulkGenerateResult.berhasil.map(n => <li key={n}>• {n}</li>)}
                  </ul>
                </div>
              )}
              {bulkGenerateResult.dilewati.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-amber-700 mb-1">⏭️ Dilewati — sudah ada tahapan ({bulkGenerateResult.dilewati.length})</p>
                  <ul className="text-[13px] text-slate-600 space-y-0.5">
                    {bulkGenerateResult.dilewati.map(n => <li key={n}>• {n}</li>)}
                  </ul>
                </div>
              )}
              {bulkGenerateResult.gagal.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-red-700 mb-1">❌ Gagal ({bulkGenerateResult.gagal.length})</p>
                  <ul className="text-[13px] text-slate-600 space-y-0.5">
                    {bulkGenerateResult.gagal.map(g => <li key={g.nama}>• {g.nama} — {g.alasan}</li>)}
                  </ul>
                </div>
              )}
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button onClick={() => setBulkGenerateResult(null)}
                className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-slate-700 hover:bg-slate-800">
                Tutup
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>
      )}

      {/* ─── MODAL: Batch Confirm ─── */}
      {batchConfirm && (
      <ModalPortal>
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1200] p-4" onClick={e => { if (e.target === e.currentTarget) setBatchConfirm(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-red-200">
            <h3 className="text-lg font-bold text-gray-800 mb-2">🚀 Konfirmasi Process Batch</h3>
            <p className="text-sm text-gray-500 mb-2">Proses semua tranche <strong>payment_year = {batchYear}</strong> status <strong>pending</strong>.</p>
            {(() => {
              const cnt = tranches.filter(t => t.payment_year === batchYear && t.status === 'pending').length;
              return cnt > 0
                ? <p className="text-sm font-bold text-rose-600 mb-3">📋 {cnt} tranche siap diproses</p>
                : <p className="text-sm font-bold text-amber-600 mb-3">⚠️ Tidak ada tranche pending untuk tahun {batchYear}. Pastikan tranche sudah di-generate terlebih dahulu.</p>;
            })()}
            {/*
              Dulu tertulis "tidak bisa di-undo". Sekarang bisa - ada tombol
              "Batalkan Batch" di sebelah tombol ini - dan menakut-nakuti dengan
              hal yang tidak lagi benar membuat orang enggan menguji fiturnya
              sama sekali. Yang tetap tidak bisa ditarik cuma tahap yang sudah
              berstatus Paid, dan itulah yang disebutkan.
            */}
            <div className="px-4 py-3 rounded-xl mb-4 bg-amber-50 border border-amber-200">
              <p className="text-xs font-bold text-amber-700 mb-1">↩️ Bisa dibatalkan.</p>
              <p className="text-[11px] text-amber-700 leading-relaxed">
                Setelah diproses, tombol <strong>Batalkan Batch {batchYear}</strong> akan muncul untuk
                mengembalikan tahapan ini ke Pending. Yang sudah bertanda <strong>Paid</strong> tidak
                ikut bisa dibatalkan — status itu berarti uangnya sudah keluar.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setBatchConfirm(false)} className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-gray-500 border border-gray-200 hover:bg-gray-50">Batal</button>
              <button onClick={handleBatchProcess} disabled={batchProcessing}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
                {batchProcessing && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Proses Sekarang
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>
      )}

      {/* ─── MODAL: Batalkan Batch satu tahun ─── */}
      {batalBatch !== null && (() => {
        const bisa = tranches.filter(t => t.payment_year === batalBatch && t.status === 'processed').length;
        const paid = tranches.filter(t => t.payment_year === batalBatch && t.status === 'paid').length;
        const kunci = `BATALKAN ${batalBatch}`;
        return (
        <ModalPortal>
          <div role="dialog" aria-modal="true" aria-labelledby="judul-batal-batch"
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1200] p-4"
            onClick={e => { if (e.target === e.currentTarget) { setBatalBatch(null); setKetikBatalBatch(''); } }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-amber-200">
              <h3 id="judul-batal-batch" className="text-lg font-bold text-gray-800 mb-2">↩️ Batalkan Batch {batalBatch}</h3>
              <p className="text-sm text-gray-500 mb-3">
                Baris pembagian hasil batch tahun ini dihapus, dan tahapannya kembali ke
                status <strong>Pending</strong> supaya bisa diproses ulang.
              </p>
              <div className="rounded-xl border border-gray-100 bg-gray-50 divide-y divide-gray-100 mb-3 text-sm">
                <div className="flex justify-between px-3 py-2">
                  <span className="text-gray-600">Dikembalikan ke Pending</span>
                  <strong className="text-amber-700">{bisa} tahapan</strong>
                </div>
                <div className="flex justify-between px-3 py-2">
                  <span className="text-gray-600">Dilewati (sudah Paid)</span>
                  <strong className={paid ? 'text-emerald-700' : 'text-gray-400'}>{paid} tahapan</strong>
                </div>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed mb-3">
                Tahapannya sendiri TIDAK dihapus — hanya hasil pemrosesannya. Nominal proyek
                tetap terkunci. Untuk menghapus tahapan, pakai tombol ↩️ di baris proyeknya.
              </p>
              <label className="block text-xs font-bold text-gray-600 mb-1">
                Ketik <span className="font-mono text-amber-700">{kunci}</span> untuk melanjutkan
              </label>
              <input type="text" value={ketikBatalBatch} autoFocus
                onChange={e => setKetikBatalBatch(e.target.value)}
                placeholder={kunci}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-amber-400" />
              <div className="flex gap-3">
                <button onClick={() => { setBatalBatch(null); setKetikBatalBatch(''); }}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-gray-500 border border-gray-200 hover:bg-gray-50">Tutup</button>
                <button onClick={jalankanBatalBatch}
                  disabled={membatalkan || ketikBatalBatch.trim().toUpperCase() !== kunci || bisa === 0}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,#d97706,#b45309)' }}>
                  {membatalkan && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  Batalkan
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
        );
      })()}

      {/* ─── MODAL: Hapus tahapan satu proyek ─── */}
      {hapusTahapan && (() => {
        const punya = tranches.filter(t => t.project_id === hapusTahapan.id);
        const paid = punya.filter(t => t.status === 'paid').length;
        const kunci = 'HAPUS TAHAPAN';
        return (
        <ModalPortal>
          <div role="dialog" aria-modal="true" aria-labelledby="judul-hapus-tahapan"
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1200] p-4"
            onClick={e => { if (e.target === e.currentTarget) { setHapusTahapan(null); setKetikHapusTahapan(''); } }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-amber-200">
              <h3 id="judul-hapus-tahapan" className="text-lg font-bold text-gray-800 mb-2">↩️ Hapus Tahapan Pencairan</h3>
              <p className="text-sm text-gray-500 mb-1">Project: <strong className="text-gray-800">{hapusTahapan.project_name}</strong></p>
              <p className="text-sm text-gray-500 mb-3">
                {punya.length} tahapan berikut pembagiannya akan dihapus. Sesudah itu
                nominal pool bisa disunting lagi dan tahapannya dibuat ulang.
              </p>
              {paid > 0 ? (
                <div className="px-4 py-3 rounded-xl mb-4 bg-red-50 border border-red-200">
                  <p className="text-xs font-bold text-red-600">
                    Ditolak — {paid} tahapan sudah berstatus Paid. Tahap yang uangnya sudah keluar
                    tidak boleh dihapus dari sini; itu perkara koreksi pembukuan.
                  </p>
                </div>
              ) : (
                <>
                  <div className="px-4 py-3 rounded-xl mb-3 bg-amber-50 border border-amber-200">
                    <p className="text-[11px] text-amber-700 leading-relaxed">
                      Yang dihapus hanya tahapan &amp; pembagiannya. Data proyeknya sendiri —
                      nominal, BAST, mode, PIC — tidak disentuh.
                    </p>
                  </div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">
                    Ketik <span className="font-mono text-amber-700">{kunci}</span> untuk melanjutkan
                  </label>
                  <input type="text" value={ketikHapusTahapan} autoFocus
                    onChange={e => setKetikHapusTahapan(e.target.value)}
                    placeholder={kunci}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </>
              )}
              <div className="flex gap-3">
                <button onClick={() => { setHapusTahapan(null); setKetikHapusTahapan(''); }}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-gray-500 border border-gray-200 hover:bg-gray-50">Tutup</button>
                <button onClick={jalankanHapusTahapan}
                  disabled={membatalkan || paid > 0 || ketikHapusTahapan.trim().toUpperCase() !== kunci}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,#d97706,#b45309)' }}>
                  {membatalkan && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  Hapus Tahapan
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
        );
      })()}

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
      {konfirmGabung && (
        <ModalPortal>
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
            style={{ background: 'rgba(15,23,42,0.55)' }} onClick={() => !menggabung && setKonfirmGabung(null)}>
            <div onClick={e => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
              <div className="px-5 py-3.5 bg-amber-600 text-white">
                <h3 className="font-bold text-base">Gabungkan jadi satu proyek?</h3>
              </div>
              <div className="p-5 space-y-3 text-[13px] leading-relaxed">
                <p className="font-bold text-slate-800">{konfirmGabung.nama}</p>
                <div className="rounded-lg bg-slate-50 border border-slate-200 divide-y divide-slate-200">
                  {konfirmGabung.anggota.map((a, i) => (
                    <div key={i} className="px-3 py-2 flex justify-between gap-3">
                      <span className="text-slate-700">{a.category ?? '-'}</span>
                      <span className="text-slate-500 text-right">{a.assign_name ?? '-'} · {a.due_date}</span>
                    </div>
                  ))}
                </div>
                <p className="text-slate-700">
                  Setelah digabung, keduanya dihitung <b>satu proyek dengan satu pool nominal</b>.
                </p>
                <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Bila penangannya berbeda, yang satu menjadi <b>PIC</b> dan yang lain masuk sebagai{' '}
                  <b>Support</b> — bagiannya mengecil, tapi tidak hilang. Yang hilang adalah pool
                  kedua yang memang seharusnya tidak ada.
                </p>
                <p className="text-slate-500 text-[12px]">
                  Kalau ini sebenarnya dua kontrak berbeda, tekan Batal dan biarkan terpisah.
                </p>
              </div>
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
                <button onClick={() => setKonfirmGabung(null)} disabled={menggabung}
                  className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-50">
                  Batal
                </button>
                <button onClick={jalankanGabung} disabled={menggabung}
                  className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-60 flex items-center gap-2">
                  {menggabung && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  Ya, Gabungkan
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {konfirmHapus && (
      <ModalPortal>
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(3px)' }}
          onClick={() => !menghapus && setKonfirmHapus(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()} role="dialog" aria-modal="true"
            aria-labelledby="judul-konfirmasi-hapus">
            <div className="px-5 py-4 bg-red-600 text-white">
              <h3 id="judul-konfirmasi-hapus" className="font-bold text-base">
                Keluarkan {konfirmHapus.length} project dari Incentive?
              </h3>
            </div>
            <div className="p-5 space-y-3">
              <ul className="max-h-40 overflow-y-auto space-y-1 rounded-lg bg-slate-50 border border-slate-200 p-2.5">
                {konfirmHapus.map(p => (
                  <li key={p.id} className="text-sm text-slate-700 truncate" title={p.project_name}>
                    • {p.project_name}
                    {(p.incentive_value || 0) > 0 && (
                      <span className="ml-1 text-[11px] font-bold text-emerald-600">
                        {formatRupiah(p.incentive_value || 0)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <div className="text-[13px] leading-relaxed space-y-1.5">
                <p className="text-red-700">
                  <strong>Yang hilang:</strong> project tidak lagi muncul di daftar Incentive PTS
                  dan tidak ikut dihitung pembagiannya.
                </p>
                <p className="text-emerald-700">
                  <strong>Yang tetap:</strong> jadwalnya di Request Schedule, beserta seluruh
                  riwayat dan catatan aktivitasnya — tidak ada yang dihapus.
                </p>
                <p className="text-slate-600">
                  Bisa dikembalikan kapan saja lewat tombol <strong>Sync ke Incentive</strong>
                  {' '}di Request Schedule.
                </p>
              </div>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button onClick={() => setKonfirmHapus(null)} disabled={menghapus}
                className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-50">
                Batal
              </button>
              <button onClick={jalankanHapus} disabled={menghapus}
                className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
                {menghapus && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Ya, keluarkan
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>
      )}

      <ConfirmDialog state={confirmState} onCancel={() => setConfirmState(null)} />
    </div>
  );
}
