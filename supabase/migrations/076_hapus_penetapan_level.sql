-- 076 - Penetapan Level A/B/C/D, Net Profit & tarif dikerjakan internal Sales, tidak di platform.
-- Menghapus tabel dari 075 yang belum pernah terisi (0 baris saat dihapus) dan kunci "tarif" di skema.

drop table if exists public.incentive_penetapan_log;
drop table if exists public.incentive_penetapan;

update public.incentive_scheme_settings set scheme = scheme - 'tarif' where scheme ? 'tarif';
update public.incentive_tranches set scheme_snapshot = scheme_snapshot - 'tarif' where scheme_snapshot ? 'tarif';
