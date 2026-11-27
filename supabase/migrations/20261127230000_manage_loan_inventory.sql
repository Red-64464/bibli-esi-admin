begin;

alter table public.bibli_livres alter column exemplaires_disponibles drop expression;

create function private.bibli_set_book_stock()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  active_loans integer;
begin
  select count(*) into active_loans
  from public.bibli_prets
  where livre_id = new.id and not rendu;

  if new.nb_exemplaires < active_loans then
    raise exception 'Il reste % exemplaire(s) actuellement en prêt.', active_loans;
  end if;

  if new.statut in ('reserve', 'perdu', 'en_reparation')
    or (active_loans = 0 and (new.statut = 'emprunte' or not new.disponible)) then
    new.exemplaires_disponibles := 0;
    new.disponible := false;
  else
    new.exemplaires_disponibles := new.nb_exemplaires - active_loans;
    new.disponible := new.exemplaires_disponibles > 0;
    new.statut := case when new.disponible then 'disponible' else 'emprunte' end;
  end if;
  return new;
end;
$$;

create trigger bibli_livres_calculate_stock
before insert or update of nb_exemplaires, exemplaires_disponibles, statut, disponible
on public.bibli_livres
for each row execute function private.bibli_set_book_stock();

create function private.bibli_validate_loan()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  previous_book uuid;
  previous_student uuid;
  current_book public.bibli_livres%rowtype;
  loan_count integer;
  loan_limit integer;
begin
  if tg_op <> 'INSERT' then
    previous_book := old.livre_id;
    previous_student := old.etudiant_id;
  end if;
  if tg_op = 'DELETE' then
    perform 1 from public.bibli_livres where id = previous_book for update;
    return old;
  end if;

  perform 1 from public.bibli_livres
    where id in (previous_book, new.livre_id) order by id for update;
  if new.rendu then return new; end if;

  if tg_op = 'INSERT' or old.rendu or previous_book is distinct from new.livre_id then
    select * into current_book from public.bibli_livres where id = new.livre_id;
    if not found or current_book.exemplaires_disponibles < 1 then
      raise exception 'Aucun exemplaire disponible pour ce livre.';
    end if;
  end if;

  if tg_op = 'INSERT' or old.rendu or previous_student is distinct from new.etudiant_id then
    perform 1 from public.bibli_etudiants
      where id in (previous_student, new.etudiant_id) order by id for update;
    select case when value ~ '^[0-9]{1,5}$' then value::integer else 3 end
      into loan_limit from public.bibli_settings where key = 'max_books_per_student';
    loan_limit := coalesce(loan_limit, 3);
    select count(*) into loan_count from public.bibli_prets
      where etudiant_id = new.etudiant_id and not rendu and id <> new.id;
    if loan_limit > 0 and loan_count >= loan_limit then
      raise exception 'Cet étudiant a atteint la limite de % prêt(s) en cours.', loan_limit;
    end if;
  end if;
  return new;
end;
$$;

create function private.bibli_refresh_loan_stock()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  previous_book uuid;
  current_book uuid;
begin
  if tg_op <> 'INSERT' and not old.rendu then previous_book := old.livre_id; end if;
  if tg_op <> 'DELETE' and not new.rendu then current_book := new.livre_id; end if;

  update public.bibli_livres
    set statut = case when statut = 'emprunte' then 'disponible' else statut end,
        disponible = statut in ('emprunte', 'disponible')
    where id in (previous_book, current_book);
  return null;
end;
$$;

create trigger bibli_prets_validate_stock
before insert or delete or update of livre_id, etudiant_id, rendu on public.bibli_prets
for each row execute function private.bibli_validate_loan();

create trigger bibli_prets_refresh_stock
after insert or delete or update of livre_id, rendu on public.bibli_prets
for each row execute function private.bibli_refresh_loan_stock();

revoke all on function private.bibli_set_book_stock(),
  private.bibli_validate_loan(), private.bibli_refresh_loan_stock()
  from public, anon, authenticated;

drop index if exists public.bibli_one_active_loan_per_book;
create index bibli_active_loans_by_book on public.bibli_prets(livre_id) where not rendu;

update public.bibli_livres set nb_exemplaires = nb_exemplaires;

create function public.bibli_convert_reservation(reservation_id uuid, expected_return date)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  booking public.bibli_reservations%rowtype;
  loan_id uuid;
begin
  select * into booking from public.bibli_reservations where id = reservation_id for update;
  if not found or booking.statut not in ('en_attente', 'confirmee') then
    raise exception 'Cette réservation ne peut plus être convertie.';
  end if;
  insert into public.bibli_prets (livre_id, etudiant_id, date_retour_prevue)
  values (booking.livre_id, booking.etudiant_id, expected_return) returning id into loan_id;
  update public.bibli_reservations set statut = 'honorée' where id = booking.id;
  return loan_id;
end;
$$;

revoke all on function public.bibli_convert_reservation(uuid, date) from public, anon;
grant execute on function public.bibli_convert_reservation(uuid, date) to authenticated;

commit;
