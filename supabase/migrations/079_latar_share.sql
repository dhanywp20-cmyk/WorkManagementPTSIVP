-- 079 - Gambar latar sendiri untuk halaman link share hanya-lihat (pihak eksternal).
--
--  checklist_proyek.share_latar : latar halaman /project-progress/share/<token>
--  isu_grup.share_latar         : latar halaman /project-progress/share/isu/<token>
--
--  null = ikut latar platform (pengaturan merek). Isinya URL publik gambar di bucket
--  merek-files/share-latar/, diunggah lewat /api/project-progress/share/latar.

alter table public.checklist_proyek add column if not exists share_latar text;
alter table public.isu_grup add column if not exists share_latar text;
