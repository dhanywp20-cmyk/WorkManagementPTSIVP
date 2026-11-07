# Menyambungkan DB Team Services

Status saat ini: project Supabase Services di-pause, jadi tidak ada DB Services yang aktif.
Aplikasi tetap jalan normal. Ticketing tidak tertahan karena panggilan ke Services diputus
setelah 8 detik dan dilewati selama 60 detik berikutnya (`lib/supabase.ts`, `fetchServices`).

Dokumen ini langkah menyambungkan kembali saat Services group sudah siap.

## 1. Siapkan project Supabase Services

Project harus terpisah dari DB utama (`frxdbqcojaiosjoghdqk`). Tabel yang dipakai aplikasi:

| Tabel | Dipakai untuk | Dipakai di |
| --- | --- | --- |
| `tickets` | Salinan ticket yang di-assign ke Team Services | `ticketing/_components/useTambahAktivitas.ts`, `useServicesTicket.ts`, `useTolakBukaUlang.ts` |
| `activity_logs` | Riwayat aktivitas ticket Services | `useServicesTicket.ts`, `useTambahAktivitas.ts`, `useBukaTicket.ts` |
| `overdue_settings` | Batas overdue ticket Services | `useTambahAktivitas.ts`, `useHapusTicket.ts` |
| `users` | Admin Services penerima notifikasi WA | `app/api/services/notify-admins/route.ts` |

Realtime: aplikasi berlangganan kanal `svc-tickets-rt` ke tabel `tickets` dan `activity_logs`
(`useEfekLiveTicketing.ts`). Aktifkan Realtime untuk kedua tabel itu di project Services.

Kolom `tickets` yang dikirim saat mirror ada di `useTambahAktivitas.ts` (insert ke
`supabaseServices.from("tickets")`). `id` dan `pts_ticket_id` sama dengan id ticket di DB utama.

## 2. Isi environment variable di Vercel

Project Settings → Environment Variables (Production), lalu deploy ulang:

- `NEXT_PUBLIC_SUPABASE_SERVICES_URL` - URL project Services
- `NEXT_PUBLIC_SUPABASE_SERVICES_ANON_KEY` - anon / publishable key project Services
- `SUPABASE_SERVICES_SERVICE_ROLE_KEY` - opsional, dipakai server untuk notifikasi WA admin Services

Jangan isi URL yang sama dengan DB utama. Pemeriksaan di bawah akan menolaknya.

## 3. Periksa kesiapan

Login sebagai admin, lalu buka `/api/services/kesiapan`. Hasilnya:

| `tahap` | Arti |
| --- | --- |
| `env` | URL / anon key Services belum terbaca. Isi env lalu deploy ulang |
| `url_sama` | URL Services sama dengan DB utama |
| `tabel` | Ada tabel yang tidak terjangkau. Daftarnya ada di `tabel[]`. Kalau project di-pause, aktifkan dulu |
| `siap` | Semua tabel terjangkau. Alur assign ke Team Services siap dipakai |

Pemeriksaan hanya membaca jumlah baris (`head`), tidak mengambil isi tabel.

## 4. Uji alur

1. Buat ticket uji di Ticketing, assign ke Team Services.
2. Pastikan muncul di sisi Services dengan status `Waiting Approval`.
3. Ubah status dari sisi Services, pastikan riwayatnya kembali terlihat di Ticketing.
4. Hapus ticket uji.
