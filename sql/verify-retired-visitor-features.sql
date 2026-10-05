\set ON_ERROR_STOP on
do $$
declare retired text;
begin
  foreach retired in array array['library_capacity', 'library_current_occupancy', 'library_arrival_video_url', 'library_arrival_video_title'] loop
    if exists (select 1 from public.bibli_settings where key = retired) then
      raise exception 'Retired setting remains: %', retired;
    end if;
    begin
      insert into public.bibli_settings(key, value) values (retired, 'test');
      raise exception 'Retired setting can still be recreated: %', retired;
    exception when check_violation then null;
    end;
  end loop;
  if exists (select 1 from storage.buckets where id = 'bibli-route-videos') or
     exists (select 1 from storage.objects where bucket_id = 'bibli-route-videos') then
    raise exception 'Retired storage remains';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'storage' and policyname like 'bibli_route_videos_%') then
    raise exception 'Retired storage policies remain';
  end if;
end $$;
begin;
set local role anon;
select key from public.bibli_public_settings order by key;
select count(*) as public_books from public.bibli_public_livres;
rollback;
select 'books' as resource, count(*) from public.bibli_livres
union all select 'students', count(*) from public.bibli_etudiants
union all select 'loans', count(*) from public.bibli_prets;
