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

    if (!skema) { notify('error', 'Skema insentif belum termuat, coba lagi sesaat lagi.'); setGenerating(false); return; }
    const { error } = await insertTranches(skema, generateProject.id, generateProject.bast_date, generateProject.mode_penyelesaian);
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
      await (await import('./_components/exportPengajuan')).exportSummaryIncentive({
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
   * Export personal - satu-satunya export yang boleh diakses tier 'lihat'
   * sekalipun, karena isinya cuma baris milik currentUser sendiri (mySplitsInYear
   * sudah difilter by user_id, terlepas dari tingkat akses). Ikut Filter Tahun
   * BAST yang sama dengan kartu "Insentif Saya" supaya berkasnya persis
   * mencerminkan angka yang sedang dilihat, bukan diam-diam lintas tahun.
   */
  async function handleExportInsentifSaya() {
    if (!currentUser) return;
    setExportingSaya(true);
    try {
      const projectById = new Map(projects.map(p => [p.id, p]));
      await (await import('./_components/exportInsentifSaya')).exportInsentifSaya({
        splits: mySplitsInYear,
        trancheById,
        projectById,
        userName: currentUser.full_name || currentUser.username || 'Saya',
        year: filterBastYear,
      });
      notify('success', 'Export Insentif Saya berhasil!');
    } catch (err: unknown) { notify('error', 'Export gagal: ' + (err as Error).message); }
    setExportingSaya(false);
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
      await (await import('./_components/exportPengajuan')).exportSummaryIncentive({
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

  if (!appReady) return (
    <div className="flex items-center justify-center" style={{ minHeight: '100%', background: 'var(--latar-halaman)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="flex flex-col items-center gap-3 bg-white/90 rounded-2xl px-8 py-6 shadow-xl">
        <div className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: 'rgba(99,102,241,0.2)', borderTopColor: '#f43f5e' }} />
        <p className="text-slate-500 text-sm font-semibold">Memuat Incentive PTS...</p>
      </div>
    </div>
  );

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
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: 'rgba(99,102,241,0.2)', borderTopColor: '#f43f5e' }} />
          </div>
        )}

        {/* ─── Projects tab ─── */}
        {tab === 'projects' && !loading && (<>
          {currentUser && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50 via-white to-purple-50 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-black text-gray-700 flex items-center gap-1.5"><IkonTeks nama="💰" />Insentif Saya
                  <span className="text-[11px] font-semibold text-gray-500">
                    {filterBastYear == null ? '· semua tahun BAST' : `· tahun BAST ${filterBastYear}`}
                  </span>
                </h3>
                {mySplitsInYear.length > 0 && (
                  <button onClick={handleExportInsentifSaya} disabled={exportingSaya}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 disabled:opacity-50 flex items-center gap-1.5">
                    {exportingSaya ? <div className="w-3 h-3 border-2 border-rose-400/30 border-t-rose-500 rounded-full animate-spin" /> : '📥'} Export Bagian Saya
                  </button>
                )}
              </div>
              {mySplitsInYear.length === 0 ? (
                <p className="text-xs text-gray-500">Belum ada bagian insentif tercatat untuk kamu di periode ini.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <p className="text-[11px] text-gray-500 uppercase font-bold tracking-wider">Total</p>
                    <p className="text-lg font-black text-gray-700">{formatRupiah(myTotalInsentif)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500 uppercase font-bold tracking-wider">Sudah Cair</p>
                    <p className="text-lg font-black text-emerald-700">{formatRupiah(myPaidInsentif)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500 uppercase font-bold tracking-wider">Belum Cair</p>
                    <p className="text-lg font-black text-amber-700">{formatRupiah(myPendingInsentif)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500 uppercase font-bold tracking-wider">Jumlah Project</p>
                    <p className="text-lg font-black text-rose-600">{myProjectCount}</p>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <FilterProyekInsentif
              bastYearsProjects={bastYearsProjects} bolehHapus={bolehHapus} currentUser={currentUser} exporting={exporting} filterBastYear={filterBastYear} filteredProjects={filteredProjects} handleExportSummary={handleExportSummary} kandidatBulkGenerate={kandidatBulkGenerate} kandidatGabung={kandidatGabung} mintaKonfirmasiHapus={mintaKonfirmasiHapus} pilihHapus={pilihHapus} searchProject={searchProject} setBulkGenerateConfirm={setBulkGenerateConfirm} setFilterBastYear={setFilterBastYear} setKonfirmGabung={setKonfirmGabung} setPilihHapus={setPilihHapus} setSearchProject={setSearchProject} setSummaryExportYear={setSummaryExportYear} summaryExportYear={summaryExportYear}
            />
            {/* ── MOBILE: kartu ringkas (nama + total incentive, tap utk detail) ── */}
            <DaftarProyekInsentifHP
              currentUser={currentUser} filteredProjects={filteredProjects} hal={hal} openProjectDetail={openProjectDetail} setGenerateProject={setGenerateProject} setHapusTahapan={setHapusTahapan} setKetikHapusTahapan={setKetikHapusTahapan} setNominalBast={setNominalBast} setNominalProject={setNominalProject} setNominalValue={setNominalValue} setShowGenerateModal={setShowGenerateModal} skema={skema} tranches={tranches}
            />

            {/* ── DESKTOP: tabel penuh (TIDAK diubah) ── */}
            <TabelProyekInsentif
              bolehHapus={bolehHapus} brandEditFor={brandEditFor} currentUser={currentUser} filteredProjects={filteredProjects} hal={hal} handleSetProjectBrand={handleSetProjectBrand} mintaKonfirmasiHapus={mintaKonfirmasiHapus} openProjectDetail={openProjectDetail} pilihHapus={pilihHapus} setBrandEditFor={setBrandEditFor} setGenerateProject={setGenerateProject} setHapusTahapan={setHapusTahapan} setKetikHapusTahapan={setKetikHapusTahapan} setNominalBast={setNominalBast} setNominalProject={setNominalProject} setNominalValue={setNominalValue} setShowGenerateModal={setShowGenerateModal} skema={skema} thCls={thCls} togglePilih={togglePilih} totalPool={totalPool} tranches={tranches}
            />
          </div>
        </>)}

        {/* ─── Tranches tab ─── */}
        <TabJadwalTranche
          currentUser={currentUser} exporting={exporting} filteredTranches={filteredTranches} handleExportBatch={handleExportBatch} konfirmasiMarkPaid={konfirmasiMarkPaid} loading={loading} markingPaid={markingPaid} setBatalBatch={setBatalBatch} setBatchConfirm={setBatchConfirm} setBatchYear={setBatchYear} setFilterYear={setFilterYear} setKetikBatalBatch={setKetikBatalBatch} skema={skema} tab={tab} tahunAktif={tahunAktif} thCls={thCls} uniqueYears={uniqueYears}
        />

        {/* ─── Late Ticket Queue tab ─── */}
        {tab === 'late' && bisaInput(currentUser) && !loading && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200" style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.08),rgba(234,88,12,0.05))' }}>
              <h2 className="font-bold text-gray-800"><IkonTeks nama="🕐" />Late Ticket Queue</h2>
              <p className="text-xs text-gray-500 mt-0.5">Ticket Troubleshooting yang masuk setelah cutoff project induk — dilampirkan ke tranche berikutnya yang belum dibayar.</p>
            </div>
            {lateTickets.length === 0
              ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-2xl mb-2"><Ikon nama="📭" ukuran="1em" className="inline-block align-[-0.12em]" /></p>
                  <p className="text-sm text-gray-500 italic">Belum ada late ticket yang dilampirkan.</p>
                </div>
              )
              : (
                <div className="divide-y divide-gray-100">
                  {lateTickets.map(lt => (
                    <div key={lt.id} className="px-5 py-3 flex items-center justify-between hover:bg-amber-50/40 transition-colors">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Tranche {lt.attached_tranche_number}</p>
                        <p className="text-xs text-gray-500">{new Date(lt.attached_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}{lt.note ? ` · ${lt.note}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-amber-700">{formatRupiah(lt.ticket_value || 0)}</span>
                        {lt.is_sunset && <span className="px-2 py-0.5 rounded text-[11px] font-bold text-orange-600 bg-orange-50 border border-orange-200">Sunset</span>}
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
        <TabPengaturanAkses
          allUsers={allUsers} cariUser={cariUser} currentUser={currentUser} handleSetAkses={handleSetAkses} handleSetBrandScope={handleSetBrandScope} loading={loading} setCariUser={setCariUser} tab={tab}
        />
      </div>

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
