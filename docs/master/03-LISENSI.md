# 03 — Lisensi

Platform hanya berjalan dengan **kunci lisensi** dari penyedia. Kunci ditandatangani secara digital, diperiksa di server Anda sendiri, dan **tidak memerlukan koneksi internet** ke server penyedia.

## Isi kunci

| Data | Arti |
|---|---|
| Edisi | **Lite** atau **Pro** (lihat tabel menu di `README.md`) |
| Pelanggan | Nama perusahaan pemegang lisensi |
| Domain | Alamat tempat platform boleh berjalan, mis. `wm.perusahaan.com`, `192.168.1.20`, `*.perusahaan.com`. Kosong = semua alamat |
| Jenis | **Penuh** atau **Demo** (uji coba dengan batas waktu; admin selalu melihat sisa hari demo) |
| Berlaku sampai | Tanggal akhir (pukul 23.59 WIB); kosong = seumur hidup |

Kunci tidak bisa diubah sendiri — perubahan satu huruf pun membuatnya tidak sah.

## Memasang kunci

| Tempat | Cara |
|---|---|
| Vercel | Project → Settings → Environment Variables → `LISENSI_KUNCI` = kunci → **Redeploy** |
| Server lokal | Tambahkan `LISENSI_KUNCI=<kunci>` di `.env.local`, lalu `pm2 restart work-management` |

Periksa di **Admin Panel → Lisensi**: status, edisi, domain, dan sisa masa berlaku.

## Bila lisensi tidak aktif

Pengguna hanya bisa membuka halaman Dashboard dengan pemberitahuan merah; semua menu dan API terkunci. Penyebab tertulis di Admin Panel → Lisensi:

| Pesan | Penyelesaian |
|---|---|
| Kunci lisensi belum dipasang | Isi `LISENSI_KUNCI`, deploy/restart |
| Kunci lisensi rusak atau terpotong | Salin ulang seluruh kunci (diawali `WM1.`) tanpa spasi atau baris baru |
| Kunci lisensi tidak sah | Kunci diubah atau bukan dari penyedia resmi — minta kunci baru |
| Kunci lisensi bukan untuk alamat server ini | Akses lewat domain yang terdaftar, atau minta kunci dengan domain baru |
| Masa lisensi sudah habis | Hubungi penyedia untuk perpanjangan, pasang kunci baru |

Admin mendapat peringatan kuning **14 hari** sebelum lisensi berakhir. Data tidak pernah dihapus saat lisensi habis; semuanya kembali normal setelah kunci baru dipasang.

## Pindah server / ganti domain / naik edisi

Minta kunci baru ke penyedia dengan domain atau edisi yang baru, lalu pasang seperti di atas. Tidak perlu instal ulang dan data tetap utuh.
