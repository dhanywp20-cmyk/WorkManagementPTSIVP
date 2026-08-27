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
