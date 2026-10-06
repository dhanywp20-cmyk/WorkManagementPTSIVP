# Rotasi kunci Supabase (WAJIB - audit 6 Okt 2026)

## 1. Masalahnya, dalam bahasa sederhana

Repo GitHub ini **publik**. Kunci `service_role` project utama (`frxdbqcojaiosjoghdqk`,
berlaku sampai 2035) pernah ter-commit di riwayat Git (commit awal Mei, "dihapus" Juni - tapi
riwayat Git tidak pernah benar-benar hilang, siapa pun bisa membukanya). Kunci itu **masih
kunci aktif**: sidiknya sama dengan yang tersimpan di tabel `rahasia_integrasi`.

`service_role` = kunci master database. Pemegangnya bisa membaca & mengubah **semua tabel tanpa
dibatasi RLS** - termasuk hash password, nomor HP, nominal insentif - langsung lewat internet,
tanpa perlu login ke aplikasi. Menjadikan repo private TIDAK menyelesaikan ini: salinan riwayat
mungkin sudah diambil orang. Satu-satunya perbaikan: **mengganti kuncinya** sehingga yang bocor mati.

Yang TIDAK perlu dikhawatirkan: `NEXT_PUBLIC_SUPABASE_ANON_KEY` memang publik (ada di setiap
halaman web) dan dibatasi RLS - hanya ikut berganti karena berasal dari secret yang sama.

## 2. Dampaknya bagi pengguna

| Hal | Apa yang terjadi |
|---|---|
| Waktu tidak bisa dipakai | **±5-10 menit**: dari klik "generate" di Supabase sampai deploy ulang di Vercel selesai. Kerjakan saat sepi (malam / akhir pekan). |
| Selama itu | Aplikasi memuat data kosong / error. **Tidak ada data yang hilang atau berubah.** |
| Pengguna setelahnya | Tidak perlu login ulang secara paksa: sesi (cookie) tetap sah dan token data diterbitkan ulang otomatis saat halaman dimuat ulang. Bila ada halaman yang tampak kosong: muat ulang, atau keluar-masuk sekali. |
| Aplikasi Android | **Tidak perlu apa-apa** - isinya hanya membungkus situs web, tidak menyimpan kunci. APK tidak perlu dibuat ulang. |
| Notifikasi push / WA / Telegram | Tidak terpengaruh (token Fonnte/Telegram/Firebase terpisah). |
| Orang yang punya kunci lama | Langsung ditolak. Inilah tujuannya. |

## 3. Persiapan (5 menit, sebelum mulai)

- Siapkan **tempat mencatat** (password manager atau catatan pribadi). Jangan kirim kunci lewat chat/email.
- Buka 2 tab: **Supabase** (project `frxdbqcojaiosjoghdqk`) dan **Vercel** (project `work-management-ptsivp`).
- Pastikan kamu bisa login ke keduanya dengan akun pemilik.
- Siapkan `docs/ROTASI-KUNCI.md` ini di layar. Jangan mulai bila ragu - tidak ada batas waktu.

## 4. Langkah (urut, jangan dibalik)

**Langkah 1 - Supabase: buat secret baru**
Project Settings -> **API** (atau **JWT Keys**) -> bagian **Legacy JWT Secret** ->
**Generate a new JWT secret** (nama tombol bisa sedikit berbeda). Konfirmasi.
Setelah ini 3 nilai baru terbentuk - salin ke catatan pribadi:
1. **JWT Secret** (teks panjang)
2. **anon key** (diawali `eyJ...`)
3. **service_role key** (diawali `eyJ...`)
> Mulai detik ini kunci lama mati dan aplikasi gagal memuat data - lanjut cepat ke langkah 2-3.

**Langkah 2 - Vercel: ganti 3 variabel**
Project -> Settings -> **Environment Variables**. Edit (centang **Production** dan **Preview**):

| Variabel | Isi baru |
|---|---|
| `SUPABASE_JWT_SECRET` | JWT Secret |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key |

Jangan ubah `NEXT_PUBLIC_SUPABASE_URL` (alamat project tidak berubah).

**Langkah 3 - Vercel: deploy ulang**
Deployments -> deployment **Production** paling atas -> menu **⋯** -> **Redeploy**
(**jangan** centang "Use existing Build Cache"). Tunggu status *Ready*. Wajib: kunci
`NEXT_PUBLIC_*` ditanam saat build, jadi tanpa deploy ulang aplikasi tetap memakai kunci lama.

**Langkah 4 - Supabase SQL Editor: perbarui salinan kunci di basis data**
Fungsi basis data (mis. jadwal reminder) membaca kunci dari tabel ini:
```sql
UPDATE rahasia_integrasi SET nilai = '<service_role key baru>'
WHERE kunci = 'supabase.service_role_key';
```
(Ganti isi `<...>` dengan kunci dari catatan pribadi. Jangan simpan skrip berisi kunci.)

**Langkah 5 - GitHub (hanya bila dipakai)**
Repo -> Settings -> Secrets and variables -> Actions: bila `SUPABASE_SERVICE_ROLE_KEY`
sudah diisi (rilis APK otomatis), ganti dengan yang baru. Belum diisi? Lewati.

**Langkah 6 - Jalankan migrasi 035 & 036** (SQL Editor, urut). 035 menghapus fungsi lama yang
masih menyimpan kunci tertulis; 036 menambah fungsi Kesehatan Sistem.

## 5. Verifikasi (3 menit)

1. Buka aplikasi di jendela baru -> login -> dashboard terisi (bukan kosong).
2. Admin Panel -> **Sistem -> Kesehatan Sistem** -> **Periksa ulang**: tidak boleh ada peringatan
   merah soal "kunci server" / "fungsi berisi token".
3. (opsional) Buka `/api/auth/db-token-check` saat login sebagai admin: harus menyatakan
   JWT secret **benar** (status 200). Status 401 = `SUPABASE_JWT_SECRET` di Vercel salah ketik.
4. Buat 1 ticket uji -> muncul -> hapus.

## 6. Bila ada yang salah

| Gejala | Penyebab | Perbaikan |
|---|---|---|
| Semua halaman kosong / "gagal memuat" setelah deploy | `SUPABASE_JWT_SECRET` atau anon key di Vercel salah salin | Periksa 3 variabel (tanpa spasi / baris baru di ujung), simpan, **Redeploy** lagi |
| Login gagal | `SUPABASE_SERVICE_ROLE_KEY` salah | Sama - koreksi lalu Redeploy |
| Hanya tombol Reminder / jadwal yang error | Langkah 4 terlewat | Jalankan UPDATE di langkah 4 |
| Panik, ingin kembali ke kunci lama | Umumnya **tidak bisa** - Supabase tidak menyimpan secret lama setelah diganti | Cukup selesaikan langkah 2-4 dengan nilai baru; datanya aman |

Tidak ada langkah yang menghapus data. Yang paling buruk terjadi hanyalah aplikasi tidak bisa
dipakai sementara sampai variabel benar.

## 7. Cara mengecek apakah kunci lama pernah disalahgunakan

Supabase -> **Logs** -> **API Gateway / Postgres**: cari permintaan ke `/rest/v1/` yang
berasal dari IP di luar Vercel/kantor, atau lonjakan `SELECT` ke tabel `users` /
`user_credentials`. Tidak ada log mencurigakan tidak membuktikan aman - tetap rotasi.
Jika ada indikasi penyalahgunaan: setelah rotasi, minta semua pengguna ganti password
(Admin Panel -> User Management).

## 8. Token Fonnte (ditunda atas keputusan pemilik)

Token Fonnte sempat tertulis di fungsi basis data `handle_ticket_assignment`. Migrasi 035
menghapus fungsinya, sehingga token tidak lagi ada di definisi fungsi mana pun - tinggal di
`rahasia_integrasi` (tidak terbaca anon). Mengganti token tetap disarankan kapan pun nanti
(Fonnte -> Device -> token baru -> Admin Panel -> Integrations).

## 9. Sesudahnya

- Repo boleh tetap publik **selama tidak ada kunci di dalamnya**. Aturan: kunci hanya di env
  Vercel / tabel `rahasia_integrasi`, tidak pernah di berkas yang di-commit.
- Halaman Kesehatan Sistem memantau fungsi basis data yang berisi kunci tertulis, dan
  Telegram admin menerima alert bila ada peringatan merah.
