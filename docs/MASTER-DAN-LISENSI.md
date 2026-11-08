# File Master & License Manager — Panduan Pemilik

Dokumen ini untuk **pemilik platform** (server PTS IVP). Panduan untuk pelanggan ada di `docs/master/` dan ikut masuk ke ZIP sebagai `PANDUAN/`.

## 1. Server pemilik vs paket pelanggan

- **Server Anda** (repo ini, Vercel `work-management-ptsivp`) **tidak memakai lisensi sama sekali**: `lib/lisensi/mode.ts` berisi `WAJIB_LISENSI = false`, semua menu termasuk Database PTS aktif, tidak perlu env apa pun.
- **Paket pelanggan**: `buat-master.mjs` otomatis mengubah saklar menjadi `true`, sehingga platform pelanggan terkunci sampai diisi `LISENSI_KUNCI`.
- Platform **tidak bisa** menerbitkan lisensi. Penerbitan hanya lewat **License Manager** terpisah di laptop Anda.

| Barang | Disimpan di | Rahasia? |
|---|---|---|
| Kunci **privat** (`kunci-privat-lisensi.txt`) | Folder `RAHASIA-LISENSI-WM` + password manager. **Jangan** dipasang di server mana pun | **Ya.** Siapa pun yang memegangnya bisa membuat lisensi Pro sendiri |
| Kunci **publik** | `lib/lisensi/kunci-publik.ts` (ikut kode) | Tidak |

### Mengganti pasangan kunci (bila kunci privat bocor)

```bash
npx tsx scripts/lisensi/buat-pasangan-kunci.ts "<folder di luar repo>"
```

Tempel kunci publik baru ke `lib/lisensi/kunci-publik.ts` dan ke `PUBLIK_PLATFORM` di `scripts/lisensi/License-Manager-WM.html`, buat file master baru, lalu terbitkan ulang **semua** lisensi pelanggan — kunci lama otomatis tidak berlaku.

## 2. License Manager (aplikasi lokal, offline)

File: `scripts/lisensi/License-Manager-WM.html` (salinannya di folder `LICENSE-MANAGER` di samping `RAHASIA-LISENSI-WM`). Buka dengan **Chrome/Edge** (klik dua kali). Tidak butuh internet atau server.

1. **Muat kunci privat**: pilih `kunci-privat-lisensi.txt`. Harus muncul "Siap · kunci cocok dengan platform". Kunci hanya di memori dan hilang saat tab ditutup.
2. **Terbitkan**: jenis **Penuh / Demo**, edisi **Lite / Pro**, nama pelanggan, domain, masa berlaku **Custom hari / 1 tahun / 3 tahun / Seumur hidup** (seumur hidup tidak tersedia untuk Demo) → **Terbitkan kunci**.
3. **Salin pesan untuk pelanggan**: kunci + cara memasang, siap dikirim lewat WA/email.
4. **Riwayat**: tersimpan di browser laptop itu. Klik **Backup riwayat** secara berkala (file JSON) dan simpan di `RAHASIA-LISENSI-WM`; **Ekspor Excel** untuk laporan; **Perpanjang** mengisi ulang form dari lisensi lama.
5. **Periksa kunci**: tempel kunci dari pelanggan untuk melihat isi dan keasliannya.

Masa berlaku dihitung termasuk hari terbit: Demo 30 hari yang terbit 8 Nov berlaku sampai 7 Des pukul 23.59 WIB; 1 tahun = 365 hari.

**Lewat terminal** (alternatif):

```bash
npx tsx scripts/lisensi/terbitkan.ts --privat "<berkas kunci privat>" --pelanggan "PT Contoh" --edisi pro --domain wm.contoh.com --sampai 2027-12-31 [--demo]
```

Lisensi bersifat **offline**: tidak bisa dicabut sebelum tanggal berakhir. Untuk pelanggan berlangganan, beri tanggal berakhir dan terbitkan kunci baru saat perpanjangan.

## 3. Membuat file master

**Dari laptop, sekali jalan** (butuh PostgreSQL client 17+):

```bash
node scripts/pemilik/buat-file-lokal.mjs
```

Skrip meminta connection string *Session pooler* dan password (tidak tampil di layar), lalu membuat di `hasil-master/` (tidak ikut git):

- `wm-backup-asli-<tanggal>.zip` — backup penuh server pemilik: seluruh data, foto Storage, skema asli, kode sumber, `PULIHKAN.txt`
- `work-management-master-<tanggal>.zip` — file master untuk pelanggan (aplikasi + skema kosong + data demo)

**GitHub Actions**: tab **Actions** → **Buat file master** → **Run workflow** → isi label versi (butuh secret `SUPABASE_DB_URL` & `BACKUP_PASSPHRASE`). Hasilnya artifact berisi ZIP terenkripsi. Buka dengan:

```powershell
gpg --decrypt -o work-management-master-<versi>.zip work-management-master-<versi>.zip.gpg
```

### Isi ZIP vs repo

| Ikut | Tidak ikut |
|---|---|
| Kode aplikasi (saklar lisensi menyala), `public/`, `scripts/master/`, `vercel.json`, `.env.example` | `.github/`, `docs/` (audit internal), `sql/`, `arsip/`, `android/`, `e2e/`, `uji/`, `scripts/` selain `scripts/master/` (termasuk License Manager) |
| `skema/` hasil ekspor (tanpa data, kunci & ref project diganti placeholder) + `05-data-demo.sql` | Data basis data, file `.env*`, kunci privat |
| `PANDUAN/` dari `docs/master/` | Menu **Database PTS** beserta tautan OneDrive pemilik |

Pembuatan dibatalkan otomatis bila masih ditemukan JWT, kunci rahasia Supabase, kunci privat, atau tautan OneDrive pemilik.

## 4. Backup penuh platform pemilik

Workflow **Backup basis data mingguan** (Senin 02.00 WIB) menyimpan dua berkas terenkripsi di satu artifact (butuh secret `SUPABASE_DB_URL` & `BACKUP_PASSPHRASE`):

- `wm-db-YYYYMMDD.dump.gpg` — seluruh skema `public` + data
- `wm-db-YYYYMMDD-kode.tar.gz.gpg` — kode sumber pada komit yang sama

Cara restore: `docs/BACKUP-DB.md`. Foto Storage ikut di backup laptop (`buat-file-lokal.mjs`), tidak di workflow mingguan.

## 5. Batas perlindungan

Lisensi mencegah kunci dipakai di server/domain lain dan membuka menu sesuai edisi. Karena ZIP berisi **kode sumber**, pelanggan yang mengubah kode bisa saja melewati pemeriksaan — lindungi juga dengan **kontrak lisensi**. Simpan repo GitHub dalam mode **Private** sebelum menjual: selama repo publik, siapa pun bisa mengunduh kodenya langsung.
