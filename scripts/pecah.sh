#!/usr/bin/env bash
# scripts/pecah.sh - Jalankan scripts/ekstrak-jsx.mjs berkali-kali pada satu berkas.
#
#   bash scripts/pecah.sh <berkas.tsx> <folder-tujuan> "pola baris awal|NamaKomponen" ...
#
# Pola = teks (persis) yang ada di baris awal blok; dicari ulang sebelum tiap ekstraksi karena tiap
# ekstraksi menambah satu baris impor & menyusutkan blok. Urutkan argumen DARI BAWAH KE ATAS berkas.
set -e
F="$1"; DIR="$2"; shift 2
mkdir -p "$DIR"
for pasangan in "$@"; do
  pola="${pasangan%|*}"; nama="${pasangan##*|}"
  baris=$(grep -nF -- "$pola" "$F" | tail -1 | cut -d: -f1)  # kemunculan TERAKHIR (urutan bawah -> atas)
  if [ -z "$baris" ]; then echo "pola tidak ada: $pola"; exit 1; fi
  node scripts/ekstrak-jsx.mjs "$F" "$baris" "$nama" "$DIR/$nama.tsx"
done
