-- M4: Activity logs immutable — hanya boleh INSERT, tidak boleh UPDATE atau DELETE
-- Jalankan di Supabase SQL Editor (boleh tanpa RLS aktif karena kita pakai policy eksplisit)

-- Aktifkan RLS pada activity_logs
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Hapus policy lama jika ada
DROP POLICY IF EXISTS "allow_insert_activity_logs" ON activity_logs;
DROP POLICY IF EXISTS "allow_select_activity_logs" ON activity_logs;
DROP POLICY IF EXISTS "deny_update_activity_logs" ON activity_logs;
DROP POLICY IF EXISTS "deny_delete_activity_logs" ON activity_logs;

-- Semua user (anon) boleh INSERT (server-side insert dari API)
CREATE POLICY "allow_insert_activity_logs"
  ON activity_logs FOR INSERT
  TO anon
  WITH CHECK (true);

-- Semua user boleh SELECT
CREATE POLICY "allow_select_activity_logs"
  ON activity_logs FOR SELECT
  TO anon
  USING (true);

-- UPDATE dan DELETE tidak dibuat = secara default tidak diizinkan oleh RLS
-- Artinya: tidak ada yang bisa mengubah atau menghapus activity log
