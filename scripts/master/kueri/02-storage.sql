select format('insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values (%L, %L, %L, %s, %s) on conflict (id) do nothing;',
  id, name, public, coalesce(file_size_limit::text, 'null'), coalesce(quote_literal(allowed_mime_types::text) || '::text[]', 'null'))
from storage.buckets order by id;
select format('drop policy if exists %I on storage.objects;', policyname) || chr(10) ||
  format('create policy %I on storage.objects as %s for %s to %s%s%s;', policyname, permissive, cmd, array_to_string(roles, ', '),
    case when qual is not null then ' using (' || qual || ')' else '' end,
    case when with_check is not null then ' with check (' || with_check || ')' else '' end)
from pg_policies where schemaname = 'storage' and tablename = 'objects' order by policyname;
