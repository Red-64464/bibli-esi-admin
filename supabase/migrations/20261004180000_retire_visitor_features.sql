-- Retire only occupancy and route video. Preserve catalog, loans and hours.
-- Before applying: back up these four settings and the dedicated video bucket.
begin;
set local lock_timeout = '5s';

delete from public.bibli_settings where key in (
  'library_capacity', 'library_current_occupancy',
  'library_arrival_video_url', 'library_arrival_video_title'
);
alter table public.bibli_settings drop constraint if exists bibli_settings_no_retired_visitor_keys;
alter table public.bibli_settings add constraint bibli_settings_no_retired_visitor_keys
  check (key not in ('library_capacity', 'library_current_occupancy', 'library_arrival_video_url', 'library_arrival_video_title'));

create or replace view public.bibli_public_settings
with (security_invoker = true) as
select key, value from public.bibli_settings where key in (
  'library_name', 'library_email', 'library_logo_url',
  'library_hours', 'library_is_closed', 'library_closed_message'
);
grant select on public.bibli_public_settings to anon, authenticated;
revoke insert, update, delete on public.bibli_public_settings from anon;

drop policy if exists bibli_settings_public_read on public.bibli_settings;
create policy bibli_settings_public_read on public.bibli_settings
for select to anon, authenticated using (key in (
  'library_name', 'library_email', 'library_logo_url',
  'library_hours', 'library_is_closed', 'library_closed_message'
));

drop policy if exists bibli_route_videos_public_read on storage.objects;
drop policy if exists bibli_route_videos_admin_insert on storage.objects;
drop policy if exists bibli_route_videos_admin_update on storage.objects;
drop policy if exists bibli_route_videos_admin_delete on storage.objects;
-- Files and bucket must be removed using the Storage API, NEVER SQL DELETE.
notify pgrst, 'reload schema';
commit;
