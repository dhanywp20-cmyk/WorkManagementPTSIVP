select format('create extension if not exists %I with schema %I;', e.extname, n.nspname)
from pg_extension e join pg_namespace n on n.oid = e.extnamespace
where e.extname in ('pgcrypto', 'uuid-ossp', 'pg_trgm', 'unaccent', 'citext', 'pg_net', 'pg_cron', 'btree_gist')
order by e.extname;
