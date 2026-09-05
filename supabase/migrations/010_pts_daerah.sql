-- Alamat daerah/kota untuk akun kelompok "PTS Cabang" (lihat field `cabang`
-- di lib/kelompok.ts). Diisi admin saat membuat/mengedit akun PTS Cabang,
-- lalu dipakai auto-fill field Daerah/Kota saat akun ini dipilih di dropdown
-- Installer pada panel Mode Penyelesaian, Reminder Schedule mode Remote.
-- Kosong/NULL untuk seluruh akun lain (IVP/MVI/UMP/Sales/dst) - tidak berarti apa-apa di sana.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS pts_daerah TEXT;
