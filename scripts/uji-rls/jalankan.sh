#!/usr/bin/env bash
#
#  Uji policy RLS di replika Postgres LOKAL, sebelum menyentuh produksi.
#
#  Dipakai untuk apa: menjawab "apakah policy yang baru saya tulis benar-benar
#  menyaring seperti yang saya kira" - dengan mencoba SELECT/UPDATE/DELETE
#  sungguhan sebagai beberapa peran berbeda, bukan dengan membaca ulang
#  syaratnya dan merasa yakin.
#
#  Kenapa perlu: tiga bug pada sql/kunci-tabel-lanjutan{,-2}.sql lolos dari
#  pembacaan berulang kali dan baru ketahuan di sini - termasuk satu berkas
#  yang memasang policy DELETE lengkap di tabel yang RLS-nya ternyata belum
#  menyala, sehingga seluruh penjagaannya diabaikan Postgres tanpa satu pun
#  peringatan. Daftar policy-nya terlihat benar; perilakunya tidak.
#
#  Cara pakai:
#      bash scripts/uji-rls/jalankan.sh
#
#  Syarat: postgresql client + server terpasang lokal (paket postgresql-16
#  atau sejenis). TIDAK menyentuh basis data produksi sama sekali - seluruh
#  isinya cluster sementara di /var/tmp yang dibuat dan dibuang sendiri.
#
#  Yang perlu diingat: skema di 00-skema.sql adalah TIRUAN - hanya kolom yang
#  disentuh policy. Ia membuktikan policy-nya berperilaku benar, bukan bahwa
#  seluruh kolom produksi sudah terwakili. Kalau sebuah policy menyebut kolom
#  baru, tambahkan kolom itu ke 00-skema.sql lebih dulu.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
UJI="$REPO/scripts/uji-rls"
BASIS=/var/tmp/uji-rls
export PGDATA="$BASIS/pgdata" PGHOST="$BASIS" PGUSER=postgres
export PATH="/usr/lib/postgresql/16/bin:$PATH"

echo "▶ menyiapkan cluster sementara di $BASIS"
if [ -d "$PGDATA" ]; then pg_ctl -D "$PGDATA" stop -s -m immediate 2>/dev/null || true; fi
rm -rf "$BASIS"; mkdir -p "$BASIS"

#  Postgres menolak berjalan sebagai root; di lingkungan yang memang root
#  (kontainer CI) dipakai user terpisah.
JALAN_SEBAGAI=""
if [ "$(id -u)" = "0" ]; then
  id pgtest >/dev/null 2>&1 || useradd -m pgtest
  chown -R pgtest "$BASIS"; JALAN_SEBAGAI="pgtest"
fi
lari() { if [ -n "$JALAN_SEBAGAI" ]; then su "$JALAN_SEBAGAI" -c "PATH=$PATH PGDATA=$PGDATA $1"; else eval "$1"; fi; }

lari "initdb -D $PGDATA -A trust -U postgres" >/dev/null
#  listen_addresses='' -> hanya socket unix di $BASIS, tidak membuka port TCP
#  sama sekali. Selain lebih tertutup, ini menghilangkan satu-satunya sebab
#  kegagalan yang muncul saat berkas ini ditulis: bentrok port dengan
#  instans Postgres lain yang kebetulan sedang jalan di mesin yang sama.
lari "pg_ctl -D $PGDATA -l $BASIS/log -o \"-c listen_addresses='' -k $BASIS\" start" >/dev/null
trap 'lari "pg_ctl -D $PGDATA stop -s -m immediate" >/dev/null 2>&1 || true' EXIT

psql -q -d postgres -c "CREATE DATABASE uji;"

echo "▶ memasang skema tiruan"
psql -v ON_ERROR_STOP=1 -q -d uji -f "$UJI/00-skema.sql"

echo "▶ memasang fungsi fondasi (diambil dari berkas sql/ yang asli)"
FOND="$BASIS/fondasi.sql"; : > "$FOND"
ambil() { awk "/^CREATE OR REPLACE FUNCTION $2\(/,/^$3/" "$REPO/sql/$1" >> "$FOND"; }
ambil rls-project-progress.sql jwt_claim          '\$\$;'
ambil rls-project-progress.sql is_progress_admin  '\$\$;'
ambil rls-project-progress.sql jwt_full_name      '\$\$;'
ambil rls-lingkup-project.sql  jwt_user_id        '\$\$;'
ambil rls-lingkup-project.sql  lingkup_semua      '\$\$;'
ambil rls-lingkup-project.sql  lingkup_divisi     '\$\$;'
ambil rls-lingkup-project.sql  boleh_lihat_project '\$\$;'
ambil rls-nyalakan.sql         boleh_lihat_baris  '\$\$;'
ambil rls-nyalakan.sql         buang_policy_lama  'END \$fn\$;'
psql -v ON_ERROR_STOP=1 -q -d uji -f "$FOND"
psql -q -d uji -c "GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;"

echo "▶ menerapkan berkas keamanan yang diuji"
psql -v ON_ERROR_STOP=1 -q -d uji -f "$REPO/sql/kunci-tabel-lanjutan.sql"   > /dev/null
psql -v ON_ERROR_STOP=1 -q -d uji -f "$REPO/sql/kunci-tabel-lanjutan-2.sql" > /dev/null

echo "▶ mengisi data uji"
psql -v ON_ERROR_STOP=1 -q -d uji -f "$UJI/02-seed.sql"
#  Baris bernama kosong / NULL - inilah yang membongkar kebocoran
#  `'' = jwt_full_name()` pada pengunjung yang belum login.
psql -q -d uji <<'SQL'
INSERT INTO piket_tamu_detail (nama_sales, sales_division, tamu_instansi)
  VALUES ('', '', 'Baris nama kosong'), (NULL, NULL, 'Baris nama NULL');
INSERT INTO tickets (sales_name, sales_division, created_by, title)
  VALUES ('', '', '', 'Tiket nama kosong');
SQL

echo "▶ menjalankan uji perilaku"
echo
psql -d uji -f "$UJI/03-uji.sql" 2>&1 | grep -v '^CREATE FUNCTION'

echo
echo "▶ Yang harus terlihat pada hasil di atas:"
echo "   A. kolom 'anon(blm login)' NOL di setiap baris."
echo "   B. tickets & project_requests hanya admin; reminders admin + manager."
echo "   C. 'Sales B(BUKAN)' ditolak di kedua baris."
echo "   D. UPDATE & DELETE activity_logs ditolak, termasuk untuk admin."
echo "   F. dua kolom terakhir ditolak (tidak boleh nyelonong / memalsukan)."
