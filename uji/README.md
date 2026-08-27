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
