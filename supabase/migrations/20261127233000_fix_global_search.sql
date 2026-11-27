begin;

create function public.bibli_search_admin(search_term text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with term as (select lower(btrim(search_term)) as value),
  books as (
    select b.id, b.titre, b.auteur, b.isbn, b.statut, b.disponible
    from public.bibli_livres b cross join term
    where length(term.value) >= 2 and strpos(lower(concat_ws(' ', b.titre, b.auteur, b.isbn)), term.value) > 0
    order by b.titre, b.id limit 10
  ),
  students as (
    select e.id, e.nom, e.prenom, e.email, e.numero_etudiant
    from public.bibli_etudiants e cross join term
    where length(term.value) >= 2 and strpos(lower(concat_ws(' ', e.prenom, e.nom, e.email, e.numero_etudiant)), term.value) > 0
    order by e.nom, e.prenom, e.id limit 10
  ),
  loans as (
    select p.id, p.date_pret, p.rendu, p.statut, p.date_retour_prevue,
      jsonb_build_object('titre', b.titre) as livres,
      jsonb_build_object('nom', e.nom, 'prenom', e.prenom) as etudiants
    from public.bibli_prets p
    join public.bibli_livres b on b.id = p.livre_id
    join public.bibli_etudiants e on e.id = p.etudiant_id
    cross join term
    where length(term.value) >= 2
      and (strpos(lower(concat_ws(' ', b.titre, b.auteur, b.isbn)), term.value) > 0
        or strpos(lower(concat_ws(' ', e.prenom, e.nom, e.email, e.numero_etudiant)), term.value) > 0)
    order by p.date_pret desc, p.id limit 10
  )
  select jsonb_build_object(
    'livres', coalesce((select jsonb_agg(books order by titre, id) from books), '[]'::jsonb),
    'etudiants', coalesce((select jsonb_agg(students order by nom, prenom, id) from students), '[]'::jsonb),
    'prets', coalesce((select jsonb_agg(loans order by date_pret desc, id) from loans), '[]'::jsonb)
  );
$$;

revoke all on function public.bibli_search_admin(text) from public, anon;
grant execute on function public.bibli_search_admin(text) to authenticated;

commit;
