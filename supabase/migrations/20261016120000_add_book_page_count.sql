alter table public.bibli_livres
  add column if not exists nb_pages integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'bibli_livres_nb_pages_positive'
      and conrelid = 'public.bibli_livres'::regclass
  ) then
    alter table public.bibli_livres
      add constraint bibli_livres_nb_pages_positive
      check (nb_pages is null or nb_pages > 0);
  end if;
end $$;

grant select (nb_pages) on public.bibli_livres to anon, authenticated;

create or replace view public.bibli_public_livres
with (security_invoker = true) as
  select id, titre, sous_titre, auteur, isbn, editeur, annee, langue,
         categorie, tags, resume, description, emplacement,
         nb_exemplaires, exemplaires_total, exemplaires_disponibles,
         statut, disponible, couverture_url, date_ajout, nb_pages
  from public.bibli_livres;

grant select on public.bibli_public_livres to anon, authenticated;
