-- 064: akun peserta event (daftar_via_event) tidak lagi bisa membaca data peserta event lain.
--
-- Sebelumnya 51 akun yang mendaftar sendiri lewat kode acara bisa membaca nama & nomor HP semua akun. Kini akun event
-- hanya membaca barisnya sendiri dan akun internal (staf & sales), yang tetap dibutuhkan untuk notifikasi WA ke admin /
-- handler. Akun internal tidak berubah.
--
-- Diuji di produksi dalam transaksi yang dibatalkan: Admin, Full Access, Sales internal tetap 127 baris; akun event
-- 127 -> 77 (dirinya + 76 akun internal), peserta event lain 51 -> 1.

create or replace function public.akun_event_saya() returns boolean
  language sql stable security definer set search_path to 'public', 'pg_temp' as
$$ select coalesce((select u.daftar_via_event from public.users u where u.id::text = jwt_claim('sub')), false) $$;

alter policy users_baca on public.users using (
  jwt_claim('sub') <> '' and (
    not akun_event_saya()
    or id::text = jwt_claim('sub')
    or not coalesce(daftar_via_event, false)
  )
);
