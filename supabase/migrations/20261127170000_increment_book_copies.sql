create or replace function public.bibli_add_book_copy(book_id uuid, shelf text)
returns integer language plpgsql security invoker set search_path = public as $$
declare result integer;
begin
  if shelf is null or shelf !~ '^[1-5][A-E]$' then
    raise exception 'Choisissez une étagère valide.';
  end if;
  update public.bibli_livres
    set nb_exemplaires = nb_exemplaires + 1,
        emplacement = coalesce(nullif(emplacement, ''), shelf)
    where id = book_id and nb_exemplaires < 500
      and (emplacement is null or emplacement = '' or upper(emplacement) = shelf
           or upper(emplacement) = substring(shelf,2,1) || substring(shelf,1,1))
    returning nb_exemplaires into result;
  if result is null then
    raise exception 'Impossible d’ajouter cet exemplaire : vérifiez vos droits et utilisez la même étagère que la fiche existante.';
  end if;
  return result;
end $$;
revoke all on function public.bibli_add_book_copy(uuid,text) from public, anon;
grant execute on function public.bibli_add_book_copy(uuid,text) to authenticated;
