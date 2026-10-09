#!/usr/bin/env bash
# scripts/pecah-baris.sh - Seperti pecah.sh tapi memakai NOMOR BARIS dari scripts/peta-jsx.mjs.
#
#   bash scripts/pecah-baris.sh <berkas.tsx> <folder-tujuan> "baris|NamaKomponen" ...
#
# Nomor baris diambil SEKALI dari peta (sebelum pemecahan), argumen diurutkan DARI BAWAH KE ATAS.
# Tiap ekstraksi menyisipkan satu baris impor di atas, jadi baris blok berikutnya digeser +1 per
# ekstraksi sebelumnya.
set -e
F="$1"; DIR="$2"; shift 2
geser=0
for pasangan in "$@"; do
  baris="${pasangan%%|*}"; nama="${pasangan##*|}"
  node scripts/ekstrak-jsx.mjs "$F" "$((baris + geser))" "$nama" "$DIR/$nama.tsx"
  geser=$((geser + 1))
done
