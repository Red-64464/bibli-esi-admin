-- Photos de cartes étudiantes : stockage privé uniquement.
alter table public.bibli_etudiants
  add column if not exists photo_carte_recto_path text,
  add column if not exists photo_carte_verso_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bibli-student-cards',
  'bibli-student-cards',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 8388608,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists bibli_student_cards_insert on storage.objects;
create policy bibli_student_cards_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'bibli-student-cards'
    and (select private.bibli_has_permission('etudiants_ajouter'))
  );

drop policy if exists bibli_student_cards_select on storage.objects;
create policy bibli_student_cards_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'bibli-student-cards'
    and (select private.bibli_has_permission('etudiants_voir'))
  );

drop policy if exists bibli_student_cards_delete on storage.objects;
create policy bibli_student_cards_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'bibli-student-cards'
    and (select private.bibli_has_permission('etudiants_modifier'))
  );
