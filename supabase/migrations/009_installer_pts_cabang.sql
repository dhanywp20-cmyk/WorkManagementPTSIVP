-- PTS Cabang menggantikan isian manual "Nama Installer" dengan akun sungguhan
-- (opsional - tetap bisa diketik manual). installer_name/installer_daerah
-- TIDAK dihapus/diubah: tetap sumber tampilan & rekap insentif yang sudah ada.
-- Kolom baru murni tambahan yang menaut ke akun kalau dipilih dari dropdown.
--
-- ON DELETE SET NULL: akun PTS Cabang yang dihapus tidak boleh ikut menghapus
-- reminder-nya - jadwal itu tetap ada, cuma tautannya lepas (installer_name
-- tetap tersimpan apa adanya, jadi tidak kehilangan jejak siapa yang dulu
-- mengerjakan).
ALTER TABLE reminders
  ADD COLUMN IF NOT EXISTS installer_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
