# File Master & License Manager — Panduan Pemilik

Dokumen ini untuk **pemilik platform** (server PTS IVP). Panduan untuk pelanggan ada di `docs/master/` dan ikut masuk ke ZIP sebagai `PANDUAN/`.

## 1. Kunci lisensi pemilik

| Barang | Disimpan di | Rahasia? |
|---|---|---|
| Kunci **privat** (`kunci-privat-lisensi.txt`) | Password manager + env `LISENSI_KUNCI_PRIVAT` di Vercel server pemilik | **Ya.** Siapa pun yang memegangnya bisa membuat lisensi Pro sendiri |
| Kunci **publik** | `lib/lisensi/kunci-publik.ts` (ikut kode) | Tidak |
| Lisensi server pemilik (`lisensi-server-pemilik.txt`) | Env `LISENSI_KUNCI` di Vercel server pemilik | Tidak terlalu (terkunci ke domain pemilik) |

Lisensi server pemilik berisi tanda **pemilik**: hanya server dengan lisensi ini yang menampilkan menu **Database PTS** dan **License Manager**.

### Wajib sebelum kode lisensi dipakai di produksi

Vercel → project `work-management-ptsivp` → Settings → Environment Variables (Production **dan** Preview):

1. `LISENSI_KUNCI` = isi `lisensi-server-pemilik.txt`
2. `LISENSI_KUNCI_PRIVAT` = isi `kunci-privat-lisensi.txt`
3. Redeploy.

Tanpa `LISENSI_KUNCI`, platform pemilik ikut terkunci. `npm run dev` di laptop tetap jalan tanpa kunci (mode pengembangan, edisi Pro).

### Mengganti pasangan kunci (bila kunci privat bocor)

```bash
npx tsx scripts/lisensi/buat-pasangan-kunci.ts "<folder di luar repo>"
```

Tempel kunci publik baru ke `lib/lisensi/kunci-publik.ts`, deploy, lalu terbitkan ulang **semua** lisensi pelanggan dan lisensi server pemilik — kunci lama otomatis tidak berlaku.

## 2. Menerbitkan lisensi pelanggan

**Lewat aplikasi**: Admin Panel → **Lisensi** → License Manager → isi pelanggan, edisi, domain, tanggal berakhir → **Terbitkan kunci** → **Salin kunci**. Semua lisensi tercatat di `app_settings.lisensi_terbit`.

**Lewat terminal** (tanpa aplikasi):

```bash
npx tsx scripts/lisensi/terbitkan.ts --privat "<berkas kunci privat>" --pelanggan "PT Contoh" --edisi pro --domain wm.contoh.com --sampai 2027-12-31
```

Lisensi bersifat **offline**: tidak bisa dicabut sebelum tanggal berakhir. Untuk pelanggan berlangganan, beri tanggal berakhir (mis. 1 tahun) dan terbitkan kunci baru saat perpanjangan.

## 3. Membuat file master

**GitHub Actions (disarankan)**: tab **Actions** → **Buat file master** → **Run workflow** → isi label versi. Hasilnya artifact `work-management-master-<versi>` berisi ZIP terenkripsi. Buka dengan:

```powershell
gpg --decrypt -o work-management-master-<versi>.zip work-management-master-<versi>.zip.gpg
```

Passphrase = secret `BACKUP_PASSPHRASE`.

**Dari laptop, sekali jalan** (butuh PostgreSQL client 17+):

```bash
node scripts/pemilik/buat-file-lokal.mjs
```

Skrip meminta connection string *Session pooler* (tidak tampil di layar), lalu membuat di `hasil-master/` (tidak ikut git):

- `wm-backup-asli-<tanggal>.zip` — backup penuh server pemilik: seluruh data basis data utama (+ Team Services bila diisi), skema asli, kode sumber, `PULIHKAN.txt`
- `work-management-master-<tanggal>.zip` — file master untuk pelanggan (aplikasi + skema kosong)

### Isi ZIP vs repo

| Ikut | Tidak ikut |
|---|---|
| Kode aplikasi, `public/`, `scripts/master/`, `vercel.json`, `.env.example` | `.github/`, `docs/` (audit internal), `sql/`, `arsip/`, `android/`, `e2e/`, `uji/`, `scripts/` selain `scripts/master/` |
| `skema/` hasil ekspor (tanpa data, kunci & ref project diganti placeholder) | Data basis data, file `.env*`, kunci privat |
| `PANDUAN/` dari `docs/master/` | Menu **Database PTS** beserta tautan OneDrive pemilik |

Pembuatan dibatalkan otomatis bila masih ditemukan JWT, kunci rahasia Supabase, kunci privat, atau tautan OneDrive pemilik.

## 4. Backup penuh platform pemilik

Workflow **Backup basis data mingguan** (Senin 02.00 WIB) sekarang menyimpan dua berkas terenkripsi di satu artifact:

- `wm-db-YYYYMMDD.dump.gpg` — seluruh skema `public` + data
- `wm-db-YYYYMMDD-kode.tar.gz.gpg` — kode sumber pada komit yang sama

Cara restore: `docs/BACKUP-DB.md`. File Storage dan environment variable dibackup terpisah (lihat `docs/master/04-BACKUP.md` bagian 2–3).

## 5. Batas perlindungan

Lisensi mencegah kunci dipakai di server/domain lain dan membuka menu sesuai edisi. Karena ZIP berisi **kode sumber**, pelanggan yang mengubah kode bisa saja melewati pemeriksaan — lindungi juga dengan **kontrak lisensi**. Simpan repo GitHub dalam mode **Private** sebelum menjual: selama repo publik, siapa pun bisa mengunduh kodenya langsung.
