-- Livres pour lesquels aucun catalogue externe n'a fourni de notice.
-- Les deux photos sont privées et servent à une validation humaine ultérieure.
create table if not exists public.bibli_pending_books (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending'
    check (status in ('pending', 'researching', 'ready', 'added', 'rejected')),
  raw_scan text,
  isbn text,
  titre_suggere text,
  auteur_suggere text,
  notes text,
  cover_path text not null,
  evidence_path text not null,
  ocr_text text,
  ocr_data jsonb not null default '{}'::jsonb,
  lookup_sources jsonb not null default '[]'::jsonb,
  lookup_attempts integer not null default 1 check (lookup_attempts > 0),
  last_lookup_at timestamptz,
  resolved_livre_id uuid references public.bibli_livres(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bibli_pending_books_status_created_idx
  on public.bibli_pending_books (status, created_at desc);
create index if not exists bibli_pending_books_isbn_idx
  on public.bibli_pending_books (isbn) where isbn is not null;

alter table public.bibli_pending_books enable row level security;
revoke all on public.bibli_pending_books from anon;
grant select, insert, update on public.bibli_pending_books to authenticated;
grant all privileges on public.bibli_pending_books to service_role;

create policy bibli_pending_books_read on public.bibli_pending_books for select to authenticated
  using ((select private.bibli_has_permission('livres_ajouter')));
create policy bibli_pending_books_create on public.bibli_pending_books for insert to authenticated
  with check (
    (select private.bibli_has_permission('livres_ajouter'))
    and created_by = (select auth.uid())
  );
create policy bibli_pending_books_update on public.bibli_pending_books for update to authenticated
  using ((select private.bibli_has_permission('livres_modifier')))
  with check ((select private.bibli_has_permission('livres_modifier')));

-- Les échecs de catalogue sont aussi mémorisés peu de temps : pas d'appels
-- identiques en boucle lorsque les trois fournisseurs ne connaissent pas un ISBN.
alter table public.bibli_book_lookup_cache alter column metadata drop not null;
alter table public.bibli_book_lookup_cache add column if not exists found boolean not null default true;
alter table public.bibli_book_lookup_cache add column if not exists failure_reason text;
alter table public.bibli_book_lookup_cache add column if not exists last_checked_at timestamptz not null default now();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bibli-pending-books',
  'bibli-pending-books',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy bibli_pending_books_files_read on storage.objects for select to authenticated
  using (
    bucket_id = 'bibli-pending-books'
    and (select private.bibli_has_permission('livres_ajouter'))
  );
create policy bibli_pending_books_files_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'bibli-pending-books'
    and (select private.bibli_has_permission('livres_ajouter'))
  );
create policy bibli_pending_books_files_update on storage.objects for update to authenticated
  using (
    bucket_id = 'bibli-pending-books'
    and (select private.bibli_has_permission('livres_modifier'))
  )
  with check (
    bucket_id = 'bibli-pending-books'
    and (select private.bibli_has_permission('livres_modifier'))
  );
create policy bibli_pending_books_files_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'bibli-pending-books'
    and (select private.is_bibli_super_admin())
  );
