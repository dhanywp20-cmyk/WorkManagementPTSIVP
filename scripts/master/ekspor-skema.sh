#!/usr/bin/env bash
# Pakai: DB_URL="postgresql://..." bash scripts/master/ekspor-skema.sh <folder-keluar>
set -euo pipefail
KELUAR="${1:?folder keluar wajib diisi}"
: "${DB_URL:?isi DB_URL dengan connection string Session pooler Supabase}"
PSQL="${PSQL:-psql}"
PG_DUMP="${PG_DUMP:-pg_dump}"
KUERI="$(cd "$(dirname "$0")" && pwd)/kueri"
mkdir -p "$KELUAR"

kepala() { printf -- '-- %s\n-- Diekspor %s dari basis data sumber. Jalankan berurutan: 00, 01, 02, 03, 04.\n\n' "$1" "$(date -u +%Y-%m-%dT%H:%MZ)"; }

{ kepala "Ekstensi yang dipakai platform"; "$PSQL" "$DB_URL" -X -At -v ON_ERROR_STOP=1 -f "$KUERI/00-ekstensi.sql"; } > "$KELUAR/00-ekstensi.sql"
{ kepala "Skema public: tabel, fungsi, trigger, index, RLS"; "$PG_DUMP" "$DB_URL" --schema-only --no-owner --no-privileges --schema=public; } > "$KELUAR/01-skema-public.sql"
{ kepala "Bucket & kebijakan Supabase Storage"; "$PSQL" "$DB_URL" -X -At -v ON_ERROR_STOP=1 -f "$KUERI/02-storage.sql"; } > "$KELUAR/02-storage.sql"
{ kepala "Tabel yang memakai Realtime"; "$PSQL" "$DB_URL" -X -At -v ON_ERROR_STOP=1 -f "$KUERI/03-realtime.sql"; } > "$KELUAR/03-realtime.sql"
if ! { kepala "Jadwal pg_cron (cek & ganti placeholder sebelum dijalankan)"; "$PSQL" "$DB_URL" -X -At -v ON_ERROR_STOP=1 -f "$KUERI/04-cron.sql"; } > "$KELUAR/04-cron.sql" 2>/dev/null; then
  { kepala "Jadwal pg_cron"; echo "-- pg_cron tidak aktif di basis data sumber."; } > "$KELUAR/04-cron.sql"
fi
ls -la "$KELUAR"
