alter table public.bibli_livres add column if not exists sous_titre text;
alter table public.bibli_livres add column if not exists exemplaires_total integer generated always as (nb_exemplaires) stored;
alter table public.bibli_livres add column if not exists exemplaires_disponibles integer generated always as (case when disponible then nb_exemplaires else 0 end) stored;
grant select (sous_titre, exemplaires_total, exemplaires_disponibles) on public.bibli_livres to anon, authenticated;
drop view if exists public.bibli_public_livres;
create view public.bibli_public_livres with (security_invoker = true) as
  select id, titre, sous_titre, auteur, isbn, editeur, annee, langue, categorie, tags, resume,
         description, emplacement, nb_exemplaires, exemplaires_total, exemplaires_disponibles,
         statut, disponible, couverture_url, date_ajout
  from public.bibli_livres;
grant select on public.bibli_public_livres to anon, authenticated;
