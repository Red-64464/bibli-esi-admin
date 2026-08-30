insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bibli-route-videos',
  'bibli-route-videos',
  true,
  83886080,
  array['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists bibli_route_videos_public_read on storage.objects;
create policy bibli_route_videos_public_read on storage.objects
for select to anon, authenticated
using (bucket_id = 'bibli-route-videos');

drop policy if exists bibli_route_videos_admin_insert on storage.objects;
create policy bibli_route_videos_admin_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'bibli-route-videos'
  and (select private.bibli_has_permission('parametres'))
);

drop policy if exists bibli_route_videos_admin_update on storage.objects;
create policy bibli_route_videos_admin_update on storage.objects
for update to authenticated
using (
  bucket_id = 'bibli-route-videos'
  and (select private.bibli_has_permission('parametres'))
)
with check (
  bucket_id = 'bibli-route-videos'
  and (select private.bibli_has_permission('parametres'))
);

drop policy if exists bibli_route_videos_admin_delete on storage.objects;
create policy bibli_route_videos_admin_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'bibli-route-videos'
  and (select private.bibli_has_permission('parametres'))
);
