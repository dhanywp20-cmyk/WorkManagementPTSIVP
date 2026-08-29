# uji/

Tes yang menjaga dua hal yang kalau bocor tidak menimbulkan pesan kesalahan
apa pun — jadi tidak akan ketahuan sampai ada yang melapor.

Menjalankan (dari akar proyek, isi env boleh nilai palsu — tidak ada
koneksi jaringan yang benar-benar dipakai, yang diperiksa cuma URL kueri
yang terbentuk):

    NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy \
    NEXT_PUBLIC_SUPABASE_SERVICES_URL=https://y.supabase.co \
    NEXT_PUBLIC_SUPABASE_SERVICES_ANON_KEY=dummy \
    npx tsx uji/lingkup-project.ts && npx tsx uji/cari-reminder.ts

## lingkup-project.ts

Siapa boleh menemukan project siapa. Sales HANYA project atas namanya
sendiri; Sales Internal ditambah divisi yang dipetakan kepadanya; admin dan
Team PTS tanpa batas (lihat alasannya di lib/project-scope.ts).

Ikut diuji: nama atau divisi yang memuat tanda kutip tidak boleh MENAMBAH
kondisi pada filter — kalau bisa, seorang Sales cukup mengganti namanya
untuk membuka daftar pelanggan divisi lain.

## cari-reminder.ts

Membuktikan pembatas lingkup benar-benar terpasang di SETIAP kueri yang
dibuat cariReminderByNama(), bukan cuma di salah satunya, dan bahwa
project_name tidak lagi digabung sekueri dengan kolom peninggalan `title`.

## tahun-support.mjs

Tanggal selesainya sebuah Troubleshooting jatuh di tahun pencairan yang mana.
Diuji dengan kasus nyata (BAST 09 Feb 2026) plus kasus batas: tepat di ulang
tahun BAST, sehari sesudahnya, sebelum BAST, dan lewat 3 tahun.

Yang paling penting di sini: 1.600 tanggal berturut-turut diperiksa untuk
memastikan tidak ada tanggal yang masuk ke DUA tahun sekaligus. Kalau
jendelanya tumpang tindih, satu orang dibayar dua kali untuk pekerjaan yang
sama.

    node uji/tahun-support.mjs

## supervisor-jadi-pic.ts

Orang yang sama tidak boleh dibayar dua kali dalam satu proyek. Diuji dengan
kasus nyata BPKP ICT Timur: Yoga KS tercatat sebagai PIC sekaligus Supervisor,
dan `pic_id` proyeknya kosong — keadaan yang membuat penjagaan lama tidak
pernah aktif.

Ikut diuji ketiga pilihan `hangusSupervisorKe` (hangus / ke Manager / ke PIC),
masing-masing harus tetap berjumlah 100% dan tepat sebesar pool, plus satu
kasus kendali: PIC dan Supervisor orang berbeda — barisnya tidak boleh ikut
terhapus.

Aturan kedua yang dijaga berkas ini: porsi Support hanya untuk ORANG LAIN.
PIC, Supervisor, dan Manager tidak pernah terdeteksi sebagai Support — masing
masing sudah dibayar lewat porsi perannya sendiri, dan menangani
Troubleshooting memang bagian dari tanggung jawab itu.

Diuji enam bentuk: hanya PIC yang menangani; PIC bersama orang lain (yang lain
dapat porsi PENUH, bukan dibagi dengan PIC); satu orang yang sekaligus PIC +
Supervisor + penangan; Supervisor yang menangani; Manager yang menangani; dan
campuran Supervisor + Manager + satu orang luar. Pada semua kasus totalnya
tetap tepat 100% dan tepat sebesar pool.

    npx tsx uji/supervisor-jadi-pic.ts

## kelompok-daily-report.ts

Siapa yang pekerjaannya terangkum di Daily Report. Menjaga agar PTS MVI tidak
kembali terlewat seperti sebelumnya, dan agar yang memang tidak boleh ikut
(PTS UMP, Team Services, Sales, akun admin) tetap di luar.

    npx tsx uji/kelompok-daily-report.ts

## pengaturan-ai.mjs

Nama model dari Admin Panel ikut masuk ke ALAMAT yang dipanggil server, jadi
isiannya tidak boleh bisa mengubah alamat itu. Diuji delapan bentuk isian yang
menyimpang — termasuk yang menyisipkan query string berisi kunci lain dan yang
memanjat direktori — semuanya harus jatuh kembali ke model bawaan.

Ikut dijaga: suhu dijepit ke rentang 0–2, dan arahan dipotong di 4000 karakter.

    node uji/pengaturan-ai.mjs

## urutan-soal.ts

Aturan urutan soal di Bank Soal (lib/urutan-soal.ts). Yang dijaga: soal yang
sudah diatur tangan tidak terselip oleh soal baru; pemasangan yang SQL-nya
belum dijalankan tetap memakai urutan lama (created_at menurun) alih-alih
berubah sendiri; menukar dua soal hanya menulis DUA baris, bukan seluruh isi
grup; dan setelah berkali-kali digeser nomornya tetap 1..n tanpa bolong,
kembar, atau soal yang hilang.

    npx tsx uji/urutan-soal.ts

## galat-unggah.mjs

Penerjemahan galat unggah jawaban bergambar. Peserta melihat pesan ini di
tengah quiz berbatas waktu, jadi yang dijaga: teks mentah Postgres tidak sampai
apa adanya ("new row violates row-level security policy" terbaca seperti "kamu
tidak berhak", padahal artinya pemasangannya belum lengkap); galat pemasangan
menyebut berkas SQL mana yang perlu dijalankan; dan galat yang BUKAN soal
pemasangan — jaringan putus, sesi kedaluwarsa — tidak ikut tertelan jadi
kalimat generik.

    node uji/galat-unggah.mjs

## profil-ai.mjs

Pemisahan profil AI pembuat soal dan penilai essay. Yang dijaga: bawaan penilai
TIDAK ikut jatuh ke model pembuat soal (jatah hariannya jauh lebih sempit, dan
warisan diam-diam itu justru menghapus pemisahan yang ingin dicapai); suhu 0
tidak dikira nilai kosong; `otomatis` hanya menyala untuk boolean true; nama
model yang menyisipkan pemisah jalur ditolak; dan token koreksi yang kosong
jatuh ke token pembuat soal alih-alih mematikan penilaian.

    node uji/profil-ai.mjs

## daftar-model.mjs

Pengolahan daftar model dari Google jadi pilihan di layar. Ada karena satu
kekeliruan yang terulang: nama model DITEBAK, tidak diperiksa —
`gemini-2.5-flash-lite` dipilih sebagai bawaan penilai tanpa dicek, ternyata
tidak ada pada kunci yang dipakai, dan penilaian gagal 404 untuk semua orang.

Yang dijaga: model penyematan dan pembuat gambar tidak ikut tampil (memilihnya
gagal dengan pesan yang tidak nyambung); awalan `models/` dibuang; daftarnya
terurut; jawaban Google yang cacat tidak meledak; dan model tersimpan yang
sudah hilang dari daftar tetap terdeteksi, supaya tidak diam-diam tergantikan
baris pertama.

    node uji/daftar-model.mjs

## banding-model.mjs

Fitur "Bandingkan 2 model" di panel Generate AI. Yang paling dijaga: nama model
yang dikirim peramban masuk ke ALAMAT yang dipanggil server, jadi delapan bentuk
menyimpang diuji — termasuk yang memanjat direktori, menyisipkan query string
berisi kunci lain, dan menempelkan alamat host lain — semuanya harus jatuh
kembali ke model tersimpan, bukan ditolak (permintaannya tetap jalan).

Ikut dijaga: membandingkan model dengan dirinya sendiri ditolak (dua panggilan
untuk tidak memberi tahu apa pun), dan kegagalan satu model tidak membuang hasil
model satunya — yang berhasil tetap bisa disimpan.

    node uji/banding-model.mjs

## kelompok-insentif.ts

Kapan beberapa jadwal dihitung SATU proyek insentif — menggantikan
`gabung-batch.ts` yang cakupannya kini termuat seluruhnya di sini.

Dua sebab jadwal terbelah, keduanya sah: `batch_id` (satu pengiriman form untuk
beberapa hari) dan `incentive_group_id` (jadwal terpisah yang ternyata satu
proyek — Konfigurasi Senin, Training tiga hari kemudian). Tanpa penggabungan,
tiap pecahan punya pool nominalnya sendiri dan insentifnya terhitung berkali.

Yang paling dijaga adalah hal-hal yang TIDAK boleh terjadi:

- satu batch berisi dua penangan tidak boleh melipat jadi satu — di layar
  insentif itu berarti seseorang kehilangan haknya tanpa ada yang menyadarinya;
- dua kontrak untuk klien yang sama (BAST berbeda) tidak boleh terdeteksi
  sebagai kandidat;
- dua proyek berbeda yang kebetulan serah-terima di hari sama juga tidak;
- mendeteksi tidak boleh mengubah data apa pun — ia hanya menandai;
- menggabungkan harus menandai SELURUH baris tiap jadwal, bukan wakilnya saja,
  kalau tidak duplikatnya muncul lagi saat daftar dimuat ulang.

Lapis pencegahannya (pertanyaan "kelanjutan atau terpisah?" saat jadwal dibuat)
memakai fungsi yang sama, jadi layar dan basis data tidak bisa menyimpang
diam-diam soal aturan yang menentukan uang.

    npx tsx uji/kelompok-insentif.ts

