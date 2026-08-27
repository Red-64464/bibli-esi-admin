-- Cache privé des métadonnées récupérées chez les catalogues externes.
-- Aucun utilisateur navigateur ne reçoit un accès direct à cette table.
create table if not exists public.bibli_book_lookup_cache (
  isbn text primary key,
  metadata jsonb not null,
  sources jsonb not null default '[]'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bibli_book_lookup_cache enable row level security;

revoke all on table public.bibli_book_lookup_cache from anon, authenticated;
grant all on table public.bibli_book_lookup_cache to service_role;

create index if not exists bibli_book_lookup_cache_expires_at_idx
  on public.bibli_book_lookup_cache (expires_at);
