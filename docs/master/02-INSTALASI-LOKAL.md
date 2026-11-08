# 02 — Instalasi di Server Sendiri (Lokal / VPS)

Aplikasi berjalan di server milik perusahaan. Basis data bisa tetap di **Supabase Cloud** (disarankan) atau ikut di server sendiri dengan **Supabase self-hosted (Docker)**.

| Pilihan | Basis data | Cocok untuk |
|---|---|---|
| A | Supabase Cloud | Server kantor/VPS, ingin perawatan basis data minimal |
| B | Supabase self-hosted (Docker) di server yang sama | Jaringan tertutup / data tidak boleh keluar kantor |

## Kebutuhan server

- Ubuntu Server 22.04/24.04 LTS (disarankan) atau Windows Server 2019+
- 2 vCPU, 4 GB RAM (pilihan A); 4 vCPU, 8 GB RAM (pilihan B), disk 40 GB+
- Node.js 22, PostgreSQL client 17, Git
- Domain atau alamat IP tetap — **harus sama dengan domain di kunci lisensi**

---

## Pilihan A — Aplikasi lokal + Supabase Cloud

### 1. Basis data
Ikuti [01-INSTALASI-CLOUD.md](01-INSTALASI-CLOUD.md) **bagian 1** (Supabase + skema).

### 2. Pasang aplikasi (Ubuntu)

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs nginx
sudo npm i -g pm2
sudo mkdir -p /opt/work-management && sudo chown $USER /opt/work-management
unzip work-management-master-<versi>.zip -d /opt/work-management
cd /opt/work-management
cp .env.example .env.local && nano .env.local   # isi semua nilai wajib
npm ci
npm run build
pm2 start npm --name work-management -- start   # jalan di port 3000
pm2 save && pm2 startup                          # ikuti perintah yang dicetak
npm run buat-admin
```

### 3. Nginx + HTTPS

`/etc/nginx/sites-available/work-management`:

```nginx
server {
  server_name wm.perusahaan.com;
  client_max_body_size 50m;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/work-management /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d wm.perusahaan.com
```

> `proxy_set_header Host $host` wajib: lisensi diperiksa terhadap nama domain yang diakses pengguna.

### 4. Jadwal otomatis (pengganti cron Vercel)

`crontab -e` (waktu server dalam UTC):

```cron
0 1 * * *  curl -fsS -H "Authorization: Bearer <CRON_SECRET>" https://wm.perusahaan.com/api/cron/escalate > /dev/null
0 23 * * * curl -fsS -H "Authorization: Bearer <CRON_SECRET>" https://wm.perusahaan.com/api/cron/digest > /dev/null
```

### Windows Server

1. Pasang Node.js 22 LTS (installer resmi), Git, dan PostgreSQL 17 (cukup *Command Line Tools*).
2. Ekstrak ZIP ke `C:\work-management`, salin `.env.example` menjadi `.env.local`, isi nilainya.
3. PowerShell di folder itu: `npm ci`, `npm run build`, `npm run buat-admin`.
4. Jalankan sebagai layanan: `npm i -g pm2 pm2-windows-startup`, `pm2 start npm --name work-management -- start`, `pm2 save`, `pm2-startup install`.
5. Reverse proxy & HTTPS: IIS + URL Rewrite/ARR, atau Caddy (`caddy reverse-proxy --from wm.perusahaan.com --to 127.0.0.1:3000`).
6. Jadwal: **Task Scheduler** → aksi `curl.exe -fsS -H "Authorization: Bearer <CRON_SECRET>" https://wm.perusahaan.com/api/cron/escalate` (08.00 WIB) dan `/api/cron/digest` (06.00 WIB).

---

## Pilihan B — Supabase self-hosted (Docker)

1. Pasang Docker & Docker Compose. Ikuti panduan resmi: <https://supabase.com/docs/guides/self-hosting/docker>.
2. Di berkas `.env` Supabase: buat `JWT_SECRET` baru (40+ karakter), lalu hasilkan `ANON_KEY` dan `SERVICE_ROLE_KEY` dari secret itu (generator ada di halaman panduan resmi). Ganti `POSTGRES_PASSWORD` dan `DASHBOARD_PASSWORD`.
3. `docker compose up -d`. Studio terbuka di `http://<server>:8000`.
4. Pasang skema memakai koneksi langsung ke Postgres (`postgresql://postgres:<POSTGRES_PASSWORD>@<server>:5432/postgres`) — perintah sama dengan [01](01-INSTALASI-CLOUD.md) bagian 1 langkah 4–5.
5. Isi `.env.local` aplikasi:
   - `NEXT_PUBLIC_SUPABASE_URL=https://supabase.perusahaan.com` (alamat API Kong, lewat reverse proxy + HTTPS)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` = kunci dari langkah 2
   - `SUPABASE_JWT_SECRET` = `JWT_SECRET` yang sama
6. Lanjutkan Pilihan A langkah 2–4.

> Browser pengguna memanggil Supabase secara langsung, jadi alamat Supabase harus bisa dijangkau dari komputer pengguna (bukan hanya dari server aplikasi) dan memakai HTTPS bila aplikasinya HTTPS.

---

## Pemeriksaan akhir

- [ ] `pm2 status` menunjukkan `work-management` *online*
- [ ] `https://wm.perusahaan.com/api/health` menjawab `{"ok":true}`
- [ ] Admin Panel → **Lisensi**: aktif, domain cocok
- [ ] Unggah foto berhasil, notifikasi realtime muncul
- [ ] Backup otomatis berjalan — [04-BACKUP.md](04-BACKUP.md)
