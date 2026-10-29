/** incentive-scheme-aturan.ts - dipecah dari incentive-scheme.ts (scripts/pecah-modul.mjs); incentive-scheme.ts tetap mengekspor ulang semuanya. */
import { INCENTIVE_CATEGORIES } from './incentive-scheme-kategori-bawaan';
import { SkemaInsentif } from './incentive-scheme-tipe';

/**
 * Nilai bawaan = angka pada Proposal Insentif PTS IVP & MVI 2026.
 *
 * Sebelumnya bawaan di sini (50/20/15/15) TIDAK sama dengan proposal
 * (65/15/10/10) - dua sumber kebenaran untuk satu kebijakan. Disamakan supaya
 * tombol "Kembalikan ke bawaan" berarti "kembali ke angka proposal", bukan
 * ke angka yang tidak pernah disetujui siapa pun.
 *
 * CATATAN PENTING: baris yang SUDAH tersimpan di incentive_scheme_settings
 * menang atas nilai di sini. Mengubah berkas ini TIDAK mengubah perhitungan
 * yang sedang berjalan - itu harus dilakukan dari layar Skema Pembagian.
 * Disengaja: kebijakan uang tidak boleh berubah diam-diam karena deploy.
 */
export const SKEMA_BAWAAN: SkemaInsentif = {
  versi: 3,
  kategoriProyek: [...INCENTIVE_CATEGORIES],
  porsi: [
    { peran: 'pic',        label: 'PIC Proyek',                   persen: 65, bagiRata: true  },
    { peran: 'support',    label: 'Tim Support (Troubleshooting)', persen: 15, bagiRata: true  },
    { peran: 'supervisor', label: 'Supervisor',                   persen: 10, bagiRata: true  },
    { peran: 'manager',    label: 'Manager',                      persen: 10, bagiRata: false },
  ],
  //  Proposal: porsi Support diserap PIC -> PIC 80, Supervisor 10, Manager 10.
  tanpaSupport: { pic: 80, supervisor: 10, manager: 10 },
  jendelaSupportBulan: 12,
  hangusSupervisorKe: 'manager',
  //  Bawaan: sama-sama 100% ke Manager, PERSIS seperti perilaku lama - supaya
  //  memasang perubahan ini tidak mengubah pembayaran siapa pun sampai admin
  //  memang memutuskan memberi porsi Support.
  managerSebagaiPic: { adaSupport: { pic: 100 }, tanpaSupport: { pic: 100 } },
  //  Proposal Bagian B: Installer daerah 15%, HANYA mode Remote, dibayar
  //  penuh di tahun pertama (mengambil porsi Tahap 3).
  installerAktif: true,
  installerRemotePersen: 15,
  installerHanyaRemote: true,
  installerBayarDiMuka: true,
  tranche: [
    { nomor: 1, persen: 50, tahunKe: 1 },
    { nomor: 2, persen: 35, tahunKe: 2 },
    { nomor: 3, persen: 15, tahunKe: 3 },
  ],
  //  Angkanya = turunan proposal (65/15/10/10 x 85% + Installer 15). Diisi
  //  supaya saat saklarnya dinyalakan admin tidak mulai dari nol, melainkan
  //  dari keadaan yang persis sama dengan yang sedang berlaku.
  porsiRemote: {
    aktif: false,
    adaSupport:   { pic: 55.25, support: 12.75, supervisor: 8.5, manager: 8.5, installer: 15 },
    tanpaSupport: { pic: 68,    supervisor: 8.5, manager: 8.5,   installer: 15 },
  },
  //  Saklar MATI - baris di bawah baru berlaku begitu admin menyalakannya
  //  dari layar Skema Pembagian. Angkanya diisi contoh yang diminta (bukan
  //  0 semua) supaya begitu dinyalakan Admin tidak mulai dari kosong.
  supervisorSebagaiPic: {
    aktif: false,
    remote: {
      tanpaSupport: { pic: 55, manager: 25, installer: 20 },
      adaSupport:   { pic: 50, support: 15, manager: 15, installer: 20 },
    },
    onsite: {
      tanpaSupport: { pic: 70, manager: 30 },
      adaSupport:   { pic: 60, support: 15, manager: 25 },
    },
  },
};

/**
 * Porsi Installer yang BERLAKU untuk sebuah proyek, sesudah saklar & lingkupnya
 * diterapkan. Satu-satunya tempat aturan ini ditulis.
 *
 * Sebelumnya ungkapan `remote ? Math.max(0, Math.min(99, sk.installerRemotePersen)) : 0`
 * tersalin di empat berkas - hitungPembagian, hitungManagerSebagaiPic,
 * generateTranches, dan halaman Incentive PTS. Menambah saklar aktif/nonaktif
 * ke bentuk seperti itu berarti empat kesempatan untuk melewatkan satu, dan
 * yang terlewat tidak akan gagal terang-terangan: ia cuma membayar Installer
 * di satu layar dan tidak di layar lain.
 */
export function persenInstaller(sk: SkemaInsentif, remote: boolean): number {
  if (!sk.installerAktif) return 0;
  if (sk.installerHanyaRemote && !remote) return 0;
  //  Dibatasi 0-99, bukan 0-100: porsi 100% menyisakan 0 untuk seluruh Tim
  //  PTS, dan itu hampir pasti salah ketik, bukan kebijakan.
  return Math.max(0, Math.min(99, sk.installerRemotePersen || 0));
}

/**
 * Bagi `pool` rupiah menurut daftar persentase, HABIS TANPA SISA.
 *
 * KENAPA BUKAN Math.round() PER ORANG
 *
 * Membulatkan tiap bagian sendiri-sendiri membuat jumlahnya meleset dari pool.
 * Itu bukan kekhawatiran teoretis: disimulasikan pada 144.000 tranche dengan
 * pool "kotor" hasil 1% dari HPP, HAMPIR SETENGAHNYA (49,9%) meleset lebih
 * dari Rp 1 - selisih terbesar Rp 6,30. Karena processYearlyBatch menolak
 * tranche yang melesetnya > Rp 1, separuh pencairan akan gagal diproses dan
 * timnya tidak dibayar, dengan pesan galat yang menyesatkan ("split total
 * mismatch") karena angkanya sendiri sebenarnya benar.
 *
 * Cara yang dipakai di sini metode sisa terbesar (largest remainder), yang
 * juga dipakai pembagian kursi pemilu: semua dibulatkan ke BAWAH dulu, lalu
 * rupiah sisanya dibagikan satu per satu ke yang pecahannya paling besar.
 * Hasilnya dijamin persis sama dengan pool - bukan "cukup dekat".
 *
 * Rupiah sisa diberikan ke pecahan terbesar, BUKAN ke porsi terbesar. Kalau
 * ke porsi terbesar, PIC akan selalu mendapat kelebihan itu di setiap proyek
 * selamanya; dengan pecahan terbesar, yang menerima berganti-ganti mengikuti
 * angkanya sendiri - dan selisihnya memang hanya satu rupiah.
 */
export function bagikanTepat(pool: number, persenTiap: number[]): number[] {
  const target = Math.round(pool);
  if (!persenTiap.length || target <= 0) return persenTiap.map(() => 0);

  const tepat = persenTiap.map(p => (target * p) / 100);
  const bawah = tepat.map(v => Math.floor(v));
  let sisa = target - bawah.reduce((a, b) => a + b, 0);

  //  Bila daftar persennya tidak berjumlah 100 (mis. satu peran tidak punya
  //  penerima), sisanya bisa jauh lebih besar dari jumlah orang. Yang dibagikan
  //  hanya selisih pembulatan, jadi dibatasi sebanyak penerimanya saja.
  const urut = tepat
    .map((v, i) => ({ i, pecahan: v - Math.floor(v) }))
    .sort((a, b) => b.pecahan - a.pecahan);

  for (let k = 0; k < urut.length && sisa > 0; k++, sisa--) bawah[urut[k].i] += 1;
  return bawah;
}

// Pemeriksaan

export interface MasalahSkema {
  bidang: string;
  pesan: string;
  /**
   * true = tidak menghalangi penyimpanan. Dipakai untuk hal yang perhitungannya
   * tetap benar tapi berpotensi menyimpang dari dokumen kebijakan - keputusan
   * mana yang benar ada di manusia, bukan di validasi.
   */
  peringatan?: boolean;
}

/**
 * Periksa skema sebelum disimpan.
 *
 * Skema yang totalnya bukan 100 tidak ditolak diam-diam di kemudian hari - ia
 * akan lolos sampai batch pencairan berjalan, lalu seluruh proyek tahun itu
 * gagal diproses sekaligus. Karena itu pemeriksaannya dilakukan di depan.
 */
export function periksaSkema(sk: SkemaInsentif): MasalahSkema[] {
  const masalah: MasalahSkema[] = [];
  const bulat = (n: number) => Math.round(n * 100) / 100;

  /*
    Kategori kosong = tidak ada satu pun proyek yang akan masuk daftar
    Incentive. Ditolak sebagai galat, bukan peringatan: menyimpannya membuat
    seluruh modul tampak "tidak ada data" tanpa petunjuk apa pun tentang
    sebabnya.
  */
  const kategori = (sk.kategoriProyek ?? []).map(k => k.trim()).filter(Boolean);
  if (kategori.length === 0) {
    masalah.push({ bidang: 'kategoriProyek', pesan: 'Minimal satu kategori proyek harus diisi — tanpa itu tidak ada proyek yang masuk daftar Incentive.' });
  }
  if (new Set(kategori.map(k => k.toLowerCase())).size !== kategori.length) {
    masalah.push({ bidang: 'kategoriProyek', pesan: 'Ada kategori proyek yang kembar.' });
  }

  const totalPorsi = bulat(sk.porsi.reduce((t, p) => t + (p.persen || 0), 0));
  if (totalPorsi !== 100) masalah.push({ bidang: 'porsi', pesan: `Total porsi ${totalPorsi}% — harus tepat 100%.` });

  const kunci = sk.porsi.map(p => p.peran.trim().toLowerCase());
  if (new Set(kunci).size !== kunci.length) masalah.push({ bidang: 'porsi', pesan: 'Ada kunci peran yang kembar.' });
  if (kunci.some(k => !k)) masalah.push({ bidang: 'porsi', pesan: 'Ada peran tanpa kunci.' });
  if (!kunci.includes('pic')) masalah.push({ bidang: 'porsi', pesan: 'Peran "pic" wajib ada — ia penerima utama.' });

  const totalTanpa = bulat(Object.values(sk.tanpaSupport).reduce((t, n) => t + (n || 0), 0));
  if (totalTanpa !== 100) masalah.push({ bidang: 'tanpaSupport', pesan: `Total porsi tanpa support ${totalTanpa}% — harus tepat 100%.` });
  for (const k of Object.keys(sk.tanpaSupport)) {
    if (!kunci.includes(k)) masalah.push({ bidang: 'tanpaSupport', pesan: `Peran "${k}" tidak ada di daftar porsi.` });
  }

  for (const [nama, peta] of [
    ['ada support', sk.managerSebagaiPic.adaSupport],
    ['tanpa support', sk.managerSebagaiPic.tanpaSupport],
  ] as const) {
    const total = bulat(Object.values(peta ?? {}).reduce((t, n) => t + (n || 0), 0));
    if (total !== 100) {
      masalah.push({ bidang: 'managerSebagaiPic', pesan: `Manager-sebagai-PIC (${nama}) ${total}% — harus tepat 100%.` });
    }
  }

  if (sk.installerRemotePersen < 0 || sk.installerRemotePersen >= 100) {
    masalah.push({ bidang: 'installer', pesan: 'Porsi PTS Daerah harus 0–99%.' });
  }
  /*
    Peta Remote yang diatur sendiri ikut wajib 100% - dan wajib SENDIRI-SENDIRI,
    bukan gabungan. Kalau hanya totalnya yang diperiksa, satu peta boleh 110%
    asal yang lain 90%, dan yang salah cuma muncul pada proyek yang kebetulan
    memakai peta itu.
  */
  if (sk.porsiRemote?.aktif) {
    for (const [nama, peta] of [
      ['ada support', sk.porsiRemote.adaSupport],
      ['tanpa support', sk.porsiRemote.tanpaSupport],
    ] as const) {
      const total = bulat(Object.values(peta ?? {}).reduce((t, n) => t + (n || 0), 0));
      if (total !== 100) {
        masalah.push({ bidang: 'porsiRemote', pesan: `Porsi Remote (${nama}) ${total}% — harus tepat 100%.` });
      }
      for (const k of Object.keys(peta ?? {})) {
        if (k !== 'installer' && !kunci.includes(k)) {
          masalah.push({ bidang: 'porsiRemote', pesan: `Porsi Remote (${nama}): peran "${k}" tidak ada di daftar porsi.` });
        }
      }
    }
  }

  //  Tabel Supervisor-sebagai-PIC wajib 100% SENDIRI-SENDIRI juga, dengan
  //  alasan yang sama seperti porsiRemote - keempat peta ini dipakai pada
  //  keadaan proyek yang berbeda-beda, jadi total gabungan tidak berarti apa-apa.
  if (sk.supervisorSebagaiPic?.aktif) {
    for (const [nama, peta] of [
      ['remote, tanpa support', sk.supervisorSebagaiPic.remote.tanpaSupport],
      ['remote, ada support', sk.supervisorSebagaiPic.remote.adaSupport],
      ['onsite, tanpa support', sk.supervisorSebagaiPic.onsite.tanpaSupport],
      ['onsite, ada support', sk.supervisorSebagaiPic.onsite.adaSupport],
    ] as const) {
      const total = bulat(Object.values(peta ?? {}).reduce((t, n) => t + (n || 0), 0));
      if (total !== 100) {
        masalah.push({ bidang: 'supervisorSebagaiPic', pesan: `Supervisor-sebagai-PIC (${nama}) ${total}% — harus tepat 100%.` });
      }
      for (const k of Object.keys(peta ?? {})) {
        if (k !== 'installer' && !kunci.includes(k)) {
          masalah.push({ bidang: 'supervisorSebagaiPic', pesan: `Supervisor-sebagai-PIC (${nama}): peran "${k}" tidak ada di daftar porsi.` });
        }
      }
    }
  }

  //  Saklar menyala tapi porsinya 0 adalah setengah jalan: layarnya berkata
  //  "Installer ikut", hitungannya memberi nol. Salah satunya harus dibetulkan
  //  sebelum disimpan, dan mana yang dimaksud hanya orangnya yang tahu.
  if (sk.installerAktif && (sk.installerRemotePersen || 0) <= 0) {
    masalah.push({
      bidang: 'installer',
      pesan: 'PTS Daerah dinyalakan tapi porsinya 0% — isi porsinya, atau matikan saklarnya.',
    });
  }
  if (sk.jendelaSupportBulan < 0) masalah.push({ bidang: 'jendela', pesan: 'Jendela penilaian support tidak boleh negatif.' });

  const totalTranche = bulat(sk.tranche.reduce((t, x) => t + (x.persen || 0), 0));
  if (totalTranche !== 100) masalah.push({ bidang: 'tranche', pesan: `Total tahapan pencairan ${totalTranche}% — harus tepat 100%.` });
  if (!sk.tranche.length) masalah.push({ bidang: 'tranche', pesan: 'Minimal ada satu tahapan pencairan.' });
  /*
    Dua tahapan dengan "Tahun ke-" yang sama diam-diam membuat generateTranches()
    menulis payment_year yang SAMA untuk keduanya - satu tahun pencairan hilang,
    dan tahapan yang seharusnya jatuh di tahun terakhir malah tercatat di tahun
    yang sudah dipakai tahapan lain. Ini nyata terjadi: baris "Tahun ke-" bisa
    tertinggal dari cara lama (sebelum porsi Installer dipindah jadi baris
    tambahan, bukan mengambil alih tahap terakhir) tanpa ada yang menyadarinya
    sampai tahapannya sudah tergenerate salah.
  */
  const tahunKeList = sk.tranche.map(x => x.tahunKe);
  if (new Set(tahunKeList).size !== tahunKeList.length) {
    masalah.push({
      bidang: 'tranche',
      pesan: 'Ada dua tahapan dengan "Tahun ke-" yang sama — satu tahun pencairan akan hilang. Tiap tahapan harus punya "Tahun ke-" berbeda.',
    });
  }
  if (sk.tranche.some(x => x.tahunKe < 1)) {
    masalah.push({ bidang: 'tranche', pesan: '"Tahun ke-" tiap tahapan minimal 1.' });
  }

  /*
    TIDAK ADA LAGI syarat "porsi Installer harus sama dengan tahap terakhir".

    Peringatan itu ada selama Installer dibayar dengan cara mengambil alih
    tahap terakhir. Cara itu sudah diganti: porsi Installer kini dititipkan
    sebagai baris tambahan di tahap PERTAMA, dan seluruh tahapan tetap milik
    Tim PTS. Jadi porsi Installer boleh berapa pun tanpa mengganggu jadwal
    pencairan siapa pun, dan tidak ada lagi yang perlu disamakan.
  */

  return masalah;
}
