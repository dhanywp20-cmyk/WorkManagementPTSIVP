-- Menghapus seluruh data demo dari 05-data-demo.sql (id berawalan d0000000-0000-4000-8000-).
-- Data asli pelanggan tidak tersentuh.

BEGIN;

DELETE FROM public.form_reviews        WHERE id::text LIKE 'd0000000-0000-4000-8000-%';
DELETE FROM public.tickets             WHERE id::text LIKE 'd0000000-0000-4000-8000-%';
DELETE FROM public.project_requests    WHERE id::text LIKE 'd0000000-0000-4000-8000-%';
DELETE FROM public.progress_projects   WHERE id::text LIKE 'd0000000-0000-4000-8000-%';
DELETE FROM public.tech_notes          WHERE id::text LIKE 'd0000000-0000-4000-8000-%';
DELETE FROM public.tech_note_folders   WHERE id::text LIKE 'd0000000-0000-4000-8000-%'
  AND NOT EXISTS (SELECT 1 FROM public.tech_notes n WHERE n.folder_id = tech_note_folders.id);
DELETE FROM public.movement_logs       WHERE id::text LIKE 'd0000000-0000-4000-8000-%';
DELETE FROM public.piket_schedules     WHERE id::text LIKE 'd0000000-0000-4000-8000-%';
DELETE FROM public.daily_reports       WHERE id::text LIKE 'd0000000-0000-4000-8000-%';
DELETE FROM public.reminders           WHERE id::text LIKE 'd0000000-0000-4000-8000-%';
DELETE FROM public.projects            WHERE name IN (
  'Ruang Rapat Direksi - PT Demo Sejahtera', 'Videowall Lobby - Hotel Demo', 'LED Outdoor - Mall Demo',
  'Kelas Pintar - Sekolah Demo', 'Command Center - Dinas Demo', 'Auditorium - Kampus Demo', 'Meeting Room - PT Demo Sejahtera')
  AND NOT EXISTS (SELECT 1 FROM public.project_source_links l WHERE l.project_id = projects.id);
DELETE FROM public.users               WHERE id::text LIKE 'd0000000-0000-4000-8000-%';

COMMIT;
