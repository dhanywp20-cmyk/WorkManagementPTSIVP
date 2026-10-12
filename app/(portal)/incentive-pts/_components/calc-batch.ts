/** calc-batch.ts - dipecah dari calc.ts (scripts/pecah-modul.mjs); calc.ts tetap mengekspor ulang semuanya. */
import { ambilPetaNominal } from '@/lib/incentive-nominal-api';
import { SkemaInsentif, ambilSkema, bagikanTepat, labelSkema } from '@/lib/incentive-scheme';
import { createNotification } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { formatRupiah } from './calc-format';
import { UUID_RE, calculateIncentiveSplits, fetchOrgUsers, findUpline, generateTranches, resolveUserId, validateSplitTotal } from './calc-pembagian';
import { fetchSupportFromTickets, jendelaSupportTahap } from './calc-support';
import { IncentiveProjectRow, SplitResult } from './calc-tipe';

/**
 * Buat tahapan pencairan DAN bekukan skema yang dipakai ke tiap barisnya.
 *
 * Skemanya disalin di sini - bukan dibaca ulang saat pencairan - karena satu
 * proyek dicairkan tiga kali dalam tiga tahun. Tanpa salinan ini, mengubah
 * porsi di tahun ke-2 akan membuat tahap 2 & 3 memakai angka baru sementara
 * tahap 1 sudah dibayar dengan angka lama, dan selisihnya tidak bisa
 * dijelaskan ke Finance yang sudah menerima rekap tahap 1.
 *
 * Yang membeku adalah aturan pada saat proyek SELESAI - itu kebijakan yang
 * berlaku ketika pekerjaannya dikerjakan, jadi itu pula yang seharusnya
 * membayarnya sampai lunas.
 */
export async function insertTranches(sk: SkemaInsentif, projectId: string, bastDate: string, modePenyelesaian?: 'onsite' | 'remote' | null) {
  const tranches = generateTranches(sk, projectId, bastDate, modePenyelesaian);
  const label = labelSkema(sk, new Date().toISOString(), null);
  const rows = tranches.map(t => ({
    project_id: projectId,
    tranche_number: t.tranche_number,
    percentage: t.percentage,
    payment_year: t.payment_year,
    status: 'pending',
    scheme_snapshot: sk as unknown as Record<string, unknown>,
    scheme_label: label,
  }));
  return supabase.from('incentive_tranches').insert(rows);
}

export async function insertSplits(
  projectId: string,
  trancheId: string | null,
  splits: SplitResult[],
  sourceTicketId?: string | null,
) {
  /*
    incentive_splits.user_id adalah kolom UUID - dan SplitResult.user_id
    sering datang dari supportUntukProyek(), yang memakai reminders.assigned_to
    / tickets.handler_username APA ADANYA sebagai "id" (username, mis.
    "Ferdinan_PTSIVP"), bukan UUID user sungguhan - lihat komentarnya.
    Menuliskannya langsung membuat Process Batch gagal "invalid input syntax
    for type uuid" persis di tahap terakhir (sesudah rupiah dihitung benar),
    dan satu tahapan yang gagal insert TIDAK ditandai processed - jadi
    amannya dijalankan ulang, bukan setengah tersimpan.

    Bukan UUID -> ditulis NULL, bukan ditolak seluruhnya: user_name tetap
    tercatat (splitnya tetap bisa diperiksa/dibayar manual), cuma tautan ke
    tabel users yang kosong untuk baris itu.
  */
  const rows = splits.map(s => ({
    project_id: projectId,
    tranche_id: trancheId,
    role: s.role,
    user_id: (s.user_id && UUID_RE.test(s.user_id)) ? s.user_id : null,
    user_name: s.user_name,
    percentage: s.percentage,
    amount: s.amount,
    source_ticket_id: sourceTicketId || null,
  }));
  return supabase.from('incentive_splits').insert(rows);
}

export async function processYearlyBatch(processingYear: number, managerUserId: string, managerUserName: string) {
  const { data: dueTranches, error: fetchErr } = await supabase
    .from('incentive_tranches')
    .select('*, project:reminders(*)')
    .eq('payment_year', processingYear)
    .eq('status', 'pending');

  if (fetchErr || !dueTranches) return { error: fetchErr, processed: 0 };

  /*
    Nominal proyek terkunci di server - bukan lagi kolom reminders. Tanpa peta
    ini setiap pool terbaca 0, dan tahapan akan "diproses" dengan baris bagian
    bernilai Rp 0 yang tidak bisa dikoreksi kecuali dibatalkan satu per satu.
    Karena itu gagal-memuat atau tidak-berhak DIHENTIKAN di sini, bukan
    diteruskan dengan angka nol.
  */
  const nominal = await ambilPetaNominal();
  if (nominal.error) return { error: nominal.error, processed: 0 };
  if (!nominal.terbuka) {
    return { error: { message: 'Hanya pemegang akses input/penuh Incentive PTS yang boleh memproses tahapan.' }, processed: 0 };
  }

  /*
    Skema TERKINI dibaca sekali di depan, TAPI ia hanya cadangan.

    Yang dipakai menghitung tiap tahapan adalah salinan skema yang dibekukan
    pada tahapan itu sendiri (scheme_snapshot). Satu proyek dicairkan tiga kali
    dalam tiga tahun; kalau tiap pencairan membaca skema terkini, mengubah
    porsi di tahun ke-2 akan membayar tahap 2 & 3 dengan angka yang berbeda
    dari tahap 1 yang sudah lunas - tanpa jejak bahwa keduanya berbeda.

    Cadangan ini dipakai hanya untuk tahapan yang dibuat SEBELUM pembekuan ada
    (salinannya null). Perilakunya sama seperti sebelumnya, jadi baris lama
    tidak mendadak gagal diproses.
  */
  const skTerkini = await ambilSkema();

  // Baca hierarki dari Struktur Organisasi (users.atasan_id + jabatan).
  // Fallback transisi: pts_team_mappings bila atasan_id belum dipetakan.
  const orgUsers = await fetchOrgUsers();
  type PtsMap = { staff_user_id: string; supervisor_user_id: string; supervisor: { id: string; full_name: string } };
  const { data: ptsTeamData } = await supabase.from('pts_team_mappings').select('staff_user_id, supervisor_user_id, supervisor:users!supervisor_user_id(id, full_name)');

  let processed = 0;
  const errors: string[] = [];

  for (const tranche of dueTranches) {
    const project = tranche.project as unknown as IncentiveProjectRow;
    if (!project) { errors.push(`Tranche ${tranche.id}: project not found`); continue; }
    project.incentive_value = nominal.peta[project.id] ?? 0;
    if (!(project.incentive_value > 0)) {
      errors.push(`Project "${project.project_name}" tahap ${tranche.tranche_number}: nominal belum diisi - dilewati.`);
      continue;
    }

    //  Skema yang membayar tahapan ini = yang dibekukan saat tahapan dibuat.
    const sk = (tranche.scheme_snapshot as SkemaInsentif | null) ?? skTerkini;
    if (!project.mode_penyelesaian) { errors.push(`Project "${project.project_name}": mode_penyelesaian kosong`); continue; }

    // Manager & Supervisor dari pohon atasan PIC (Struktur Organisasi)
    const picId = resolveUserId(project.pic_id || project.assigned_to, project.assign_name, orgUsers);
    const supUp = findUpline(picId, 'Supervisor', orgUsers);
    const mgrUp = findUpline(picId, 'Manager', orgUsers);
    const ptsMap = (ptsTeamData as PtsMap[] | null)?.find(m => m.staff_user_id === project.assigned_to);
    const supervisorUserId   = supUp?.id || ptsMap?.supervisor_user_id || '';
    const supervisorUserName = supUp?.full_name || ptsMap?.supervisor?.full_name || 'Supervisor';
    const projManagerId   = mgrUp?.id || managerUserId;
    const projManagerName = mgrUp?.full_name || managerUserName;

    /*
      Support dinilai untuk TAHAP INI saja, bukan sekali untuk seluruh proyek.
      tahunKe diambil dari jadwal tahapan; kalau nomornya tidak ditemukan
      (skema berubah sesudah tahapan dibuat), jatuh ke selisih tahun pembayaran
      terhadap tahun BAST - keduanya menghasilkan angka yang sama pada jadwal
      normal, dan yang kedua tetap masuk akal saat jadwalnya sudah berubah.
    */
    const tahunKe = sk.tranche.find(t => t.nomor === tranche.tranche_number)?.tahunKe
      ?? Math.max(1, (tranche.payment_year || 0) - new Date(project.bast_date || '').getFullYear());
    const rentangSupport = jendelaSupportTahap(project.bast_date, tahunKe);
    const { data: supports } = await fetchSupportFromTickets(project, rentangSupport);
    const splits = calculateIncentiveSplits(
      sk, project, projManagerId, projManagerName,
      supervisorUserId, supervisorUserName,
      (supports || []).map(s => ({ user_id: s.user_id, user_name: s.user_name || '' })),
      picId,
    );

    const pool = project.incentive_value || 0;

    /*
      PORSI INSTALLER vs TAHAPAN TIM PTS - dua hal yang berbeda.

      Tim PTS: porsi tiap orang dipecah menurut tahapan (50/35/15), jadi
      seseorang yang porsinya Rp 500.000 menerima 250rb, 175rb, lalu 75rb -
      tiga tahun berturut-turut.

      Installer: 15% miliknya dibayar LUNAS sekali, di tahap pertama. Ia tidak
      ikut dipecah tiga tahun. Karena itu porsinya dititipkan sebagai baris
      tambahan pada tahap pertama, BUKAN dengan mengambil alih tahap terakhir
      seperti sebelumnya - cara lama itu menghapus pencairan tahun ketiga
      untuk seluruh Tim PTS, bukan hanya untuk Installer.

      Bila `installerBayarDiMuka` dimatikan, Installer diperlakukan sama
      seperti Tim PTS: porsinya ikut dipecah ke tiap tahap.
    */
    /*
      Persentase diambil dari `splits` - hasil hitungPembagian - BUKAN dihitung
      ulang di sini.

      Sebelumnya porsi Installer dibaca lewat persenInstaller(), yang hanya
      melihat kolom "Porsi Installer". Padahal saat tabel Porsi Remote diatur
      sendiri, porsi Installer yang berlaku diambil dari BARIS installer di
      tabel itu. Kalau keduanya disetel berbeda, pool Tim PTS dipotong dengan
      satu angka sementara Installer dibayar dengan angka lain - jumlahnya
      tidak lagi sama dengan pool, dan seluruh tranche ditolak "split total
      mismatch". Membaca dari splits menghapus kemungkinan itu: yang memotong
      dan yang membayar kini sumbernya sama persis.
    */
    const barisInstaller = splits.find(s => s.role === 'installer');
    const pctInstaller = barisInstaller?.percentage ?? 0;
    const tahapPertama = sk.tranche.length ? Math.min(...sk.tranche.map(t => t.nomor)) : 1;
    const installerDiMuka = pctInstaller > 0 && sk.installerBayarDiMuka;
    const totalTahapTim = sk.tranche.reduce((n, t) => n + (t.persen || 0), 0) || 100;

    // Bagian tahap ini terhadap seluruh porsi Tim PTS (mis. 50/100).
    const bagian = (tranche.percentage || 0) / totalTahapTim;

    const timSaja = splits.filter(s => s.role !== 'installer');

    //  Rupiah "ideal" (masih pecahan) tiap penerima pada tahap ini: porsinya
    //  sendiri terhadap pool, lalu dipecah menurut tahapan. Inilah kebijakannya
    //  apa adanya - "porsi Anda Rp 500.000, dibayar 50/35/15 selama 3 tahun".
    const komponen: { split: SplitResult; ideal: number }[] = timSaja.map(s => ({
      split: s,
      ideal: pool * (s.percentage / 100) * bagian,
    }));

    if (pctInstaller > 0) {
      const idealInstaller = installerDiMuka
        ? (tranche.tranche_number === tahapPertama ? (pool * pctInstaller) / 100 : 0)
        : pool * (pctInstaller / 100) * bagian;
      if (idealInstaller > 0) {
        komponen.push({
          split: {
            ...(barisInstaller ?? {
              role: 'installer', user_id: '',
              user_name: project.installer_name || 'PTS Daerah',
              percentage: pctInstaller,
            }),
            amount: 0,
          },
          ideal: idealInstaller,
        });
      }
    }

    //  Pool tahap ini DIBULATKAN dulu. Sebelumnya ia dibiarkan pecahan
    //  (mis. 13.259.488,50) lalu dibandingkan dengan jumlah rupiah bulat -
    //  perbandingan yang tidak pernah bisa pas, dan itulah sebab separuh
    //  tranche ditolak "split total mismatch" padahal angkanya benar.
    const tranchePool = Math.round(komponen.reduce((n, k) => n + k.ideal, 0));
    //  Dibagi habis: persentase dinormalkan ke pool TAHAP INI (bukan ke pool
    //  proyek) supaya jumlah seluruh baris persis sama dengan tranchePool.
    const rupiahTahap = bagikanTepat(
      tranchePool,
      komponen.map(k => (tranchePool > 0 ? (k.ideal / tranchePool) * 100 : 0)),
    );
    const trancheSplits: SplitResult[] = komponen.map((k, i) => ({ ...k.split, amount: rupiahTahap[i] }));

    const validation = validateSplitTotal(trancheSplits, tranchePool);
    if (!validation.valid) {
      errors.push(`Project "${project.project_name}" tranche ${tranche.tranche_number}: split total mismatch (diff: Rp ${validation.diff})`);
      continue;
    }

    /*
      P1-4 (audit docs/AUTH-WORKFLOW-AUDIT.md) - RACE CONDITION SUNGGUHAN,
      bukan cuma "RLS menolak diam-diam" yang sudah ditutup sebelumnya.

      URUTAN LAMA: insertSplits() dulu, baru coba klaim (UPDATE ... status
      'processed') SESUDAHNYA. Itu menutup kasus update gagal diam-diam
      (T-1), tapi TIDAK menutup dua eksekusi paralel (dua tab, atau dua orang
      menekan "Proses Sekarang" nyaris bersamaan sebelum tombol pertama
      disable): keduanya sama-sama membaca tahapan 'pending' di awal fungsi,
      keduanya LOLOS insertSplits (RLS insert tidak melihat status), dan
      baru SESUDAH itu baru ketahuan siapa yang "menang" klaim - splits kedua
      sudah kadung tertulis duluan. Inilah sebab nyata "Bagian Saya" tampil
      berlipat di Batch 2027.

      URUTAN BARU: klaim (UPDATE bersyarat .eq('status','pending')) DULU,
      SEBELUM menulis satu baris split pun. UPDATE bersyarat begini atomik di
      Postgres - dari dua eksekusi paralel yang menyasar baris yang sama,
      HANYA SATU yang bisa mengenai baris (status masih 'pending' saat
      dieksekusi), yang satunya lagi mendapat 0 baris kembali dan berhenti
      SEBELUM sempat menulis splits sama sekali. Tidak ada lagi jendela waktu
      di mana keduanya sama-sama lolos menulis.
    */
    const { data: claimRows, error: claimErr } = await supabase
      .from('incentive_tranches')
      .update({ status: 'processed', processed_at: new Date().toISOString() })
      .eq('id', tranche.id)
      .eq('status', 'pending')
      .select('id');

    if (claimErr || !claimRows || claimRows.length === 0) {
      // 0 baris di sini BUKAN kegagalan untuk dilaporkan sebagai error keras -
      // bisa berarti proses lain sudah memenangkan tahapan ini duluan (race
      // tertutup, bekerja seperti seharusnya), atau memang RLS menolak
      // (akses Incentive sudah bukan input/penuh lagi). Keduanya sama-sama
      // "lewati tahapan ini", tidak ada yang perlu dibatalkan karena belum
      // ada splits yang ditulis.
      if (claimErr) {
        errors.push(`Project "${project.project_name}" tranche ${tranche.tranche_number}: gagal mengklaim tahapan (${claimErr.message}).`);
      }
      continue;
    }

    const { error: splitErr } = await insertSplits(project.id, tranche.id, trancheSplits);
    if (splitErr) {
      //  Klaim sudah menang tapi splits gagal ditulis - kembalikan ke
      //  'pending' supaya percobaan berikutnya masih bisa memprosesnya,
      //  bukan tersangkut 'processed' tanpa satu pun baris split.
      const { error: revertErr } = await supabase
        .from('incentive_tranches')
        .update({ status: 'pending', processed_at: null })
        .eq('id', tranche.id);
      errors.push(revertErr
        ? `Project "${project.project_name}" tranche ${tranche.tranche_number}: gagal insert splits (${splitErr.message}) DAN gagal mengembalikan status ke pending (${revertErr.message}). Tahapan ini tersangkut 'processed' tanpa splits - perlu diperbaiki manual.`
        : `Project "${project.project_name}" tranche ${tranche.tranche_number}: gagal insert splits (${splitErr.message}). Status dikembalikan ke pending, aman dicoba lagi.`);
      continue;
    }

    /*
      Kabari tiap penerima BEGITU tahapannya diproses - sebelumnya orang cuma
      tahu bagiannya bertambah kalau kebetulan membuka Incentive PTS sendiri.
      Fire-and-forget (createNotification sudah gagal diam-diam di dalamnya)
      supaya satu baris notifikasi gagal tidak menggagalkan/menunda batch
      yang splits-nya sendiri sudah berhasil tertulis di atas.
    */
    void Promise.all(trancheSplits
      .filter(s => s.user_id && UUID_RE.test(s.user_id) && s.amount > 0)
      .map(s => createNotification({
        user_id: s.user_id,
        type: 'project',
        title: '💰 Tahapan insentif diproses',
        body: `${project.project_name} - tahap ${tranche.tranche_number} tahun ${tranche.payment_year}: ${formatRupiah(s.amount)}`,
        action_url: '/incentive-pts',
        ref_id: project.id,
        created_by: managerUserName,
      })));

    processed++;
  }

  return { processed, errors, total: dueTranches.length };
}
