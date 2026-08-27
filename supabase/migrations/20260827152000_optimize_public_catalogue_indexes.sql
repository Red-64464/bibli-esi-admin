create index if not exists bibli_livres_public_status_idx
on public.bibli_livres(statut, disponible);

create index if not exists bibli_livres_public_filters_idx
on public.bibli_livres(categorie, langue, annee);

create index if not exists bibli_livres_public_date_idx
on public.bibli_livres(date_ajout desc);

create index if not exists bibli_livres_public_lower_title_idx
on public.bibli_livres(lower(titre));

create index if not exists bibli_livres_public_lower_author_idx
on public.bibli_livres(lower(auteur));

create index if not exists bibli_livres_public_settings_key_idx
on public.bibli_settings(key)
where key in (
  'library_name',
  'library_email',
  'library_logo_url',
  'library_hours',
  'library_is_closed',
  'library_closed_message'
);
