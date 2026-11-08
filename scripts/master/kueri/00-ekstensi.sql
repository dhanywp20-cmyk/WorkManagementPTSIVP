select format('create extension if not exists %I with schema %I;', e.extname, n.nspname)
from pg_extension e join pg_namespace n on n.oid = e.extnamespace
where e.extname not in ('plpgsql', 'pg_stat_statements', 'pg_graphql', 'supabase_vault', 'pgsodium', 'pgjwt')
order by e.extname;
