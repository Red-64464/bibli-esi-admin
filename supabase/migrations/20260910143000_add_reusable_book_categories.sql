-- Reusable library categories are stored separately from individual books.
create table if not exists public.bibli_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  created_by uuid references public.bibli_profiles(id) on delete set null
);

create unique index if not exists bibli_categories_name_unique
  on public.bibli_categories (lower(name));

alter table public.bibli_categories enable row level security;
revoke all on public.bibli_categories from anon, authenticated;
grant select, insert, update, delete on public.bibli_categories to authenticated;
grant all privileges on public.bibli_categories to service_role;

drop policy if exists bibli_categories_admin on public.bibli_categories;
create policy bibli_categories_admin on public.bibli_categories for all to authenticated
using ((select private.is_bibli_admin()))
with check ((select private.is_bibli_admin()));

-- Preserve existing categories and provide the library defaults from day one.
insert into public.bibli_categories(name)
select distinct trim(categorie)
from public.bibli_livres
where categorie is not null and trim(categorie) <> '' and trim(categorie) <> 'Autre'
on conflict do nothing;

insert into public.bibli_categories(name) values
  ('Algorithmique'), ('Architecture des ordinateurs'), ('Bases de données'),
  ('Développement Web'), ('Électronique'), ('Génie logiciel'),
  ('Informatique générale'), ('Intelligence artificielle'), ('Mathématiques'),
  ('Physique'), ('Programmation'), ('Réseaux & Télécoms'),
  ('Sécurité informatique'), ('Systèmes d''exploitation'), ('Économie & Gestion'),
  ('Langue & Communication'), ('Littérature'), ('Sciences'),
  ('Technologie & Ingénierie')
on conflict do nothing;

create or replace function public.bibli_sync_category_from_book()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.categorie is not null and trim(new.categorie) <> '' and trim(new.categorie) <> 'Autre' then
    insert into public.bibli_categories(name, created_by)
    values (trim(new.categorie), auth.uid())
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists bibli_livres_sync_category on public.bibli_livres;
create trigger bibli_livres_sync_category
after insert or update of categorie on public.bibli_livres
for each row execute function public.bibli_sync_category_from_book();
