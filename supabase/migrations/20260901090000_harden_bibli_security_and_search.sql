-- Bibl'ESI: defense in depth for public access and faster catalogue searches.
-- Only Bibl'ESI tables are affected; other projects sharing this Supabase stay unchanged.

create extension if not exists pg_trgm;

create index if not exists bibli_livres_title_trgm_idx
  on public.bibli_livres using gin (lower(titre) gin_trgm_ops);
create index if not exists bibli_livres_author_trgm_idx
  on public.bibli_livres using gin (lower(coalesce(auteur, '')) gin_trgm_ops);
create index if not exists bibli_livres_category_trgm_idx
  on public.bibli_livres using gin (lower(coalesce(categorie, '')) gin_trgm_ops);
create index if not exists bibli_prets_rendu_date_pret_idx
  on public.bibli_prets (rendu, date_pret desc);
create index if not exists bibli_etudiants_numero_etudiant_trgm_idx
  on public.bibli_etudiants using gin (lower(coalesce(numero_etudiant, '')) gin_trgm_ops);

-- RLS already blocks anonymous writes. Revoking the SQL privileges as well
-- prevents accidental future exposure if a policy is changed incorrectly.
do $$
declare
  target_table text;
begin
  for target_table in
    select tablename
    from pg_tables
    where schemaname = 'public' and left(tablename, 6) = 'bibli_'
  loop
    execute format('revoke insert, update, delete on table public.%I from anon', target_table);
  end loop;
end $$;

analyze public.bibli_livres;
analyze public.bibli_etudiants;
analyze public.bibli_prets;
analyze public.bibli_reservations;
