select format('alter publication supabase_realtime add table %I.%I;', schemaname, tablename)
from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' order by tablename;
