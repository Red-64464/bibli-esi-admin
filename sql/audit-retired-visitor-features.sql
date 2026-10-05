-- Read-only inventory: no private records or credentials are selected.
select key from public.bibli_settings order by key;
select pg_get_viewdef('public.bibli_public_settings'::regclass, true) as public_settings_view;
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where tablename = 'bibli_settings' or (schemaname = 'storage' and coalesce(qual, '') || coalesce(with_check, '') like '%bibli-route-videos%');
select n.nspname as schema, p.proname, pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f'
  and pg_get_functiondef(p.oid) ~ 'library_capacity|library_current_occupancy|library_arrival_video|bibli-route-videos|affluence';
select id, public, file_size_limit from storage.buckets where id like 'bibli%';
select bucket_id, count(*) as files, sum(coalesce((metadata->>'size')::bigint, 0)) as bytes
from storage.objects where bucket_id like 'bibli%' group by bucket_id;
select table_name from information_schema.tables
where table_schema = 'public' and table_name like 'bibli%' order by table_name;
select schemaname, relname, n_live_tup, n_dead_tup, pg_size_pretty(pg_total_relation_size(relid)) as total_size
from pg_stat_user_tables where relname like 'bibli%' order by relname;
select n.nspname as schema, c.relname as table_name, c.relrowsecurity as rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'bibli%';
