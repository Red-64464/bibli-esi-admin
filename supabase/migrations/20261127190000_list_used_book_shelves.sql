create or replace function public.bibli_used_book_shelves()
returns table (shelf text, locations text[])
language sql
stable
security invoker
set search_path = ''
as $$
  with used_locations as (
    select distinct emplacement, upper(trim(emplacement)) as code
    from public.bibli_livres
    where emplacement is not null
  ),
  labelled_locations as (
    select emplacement,
           case
             when code ~ '^[A-E][1-5]$' then code
             when code ~ '^[1-5][A-E]$' then right(code, 1) || left(code, 1)
           end as shelf
    from used_locations
  )
  select shelf, array_agg(emplacement order by emplacement) as locations
  from labelled_locations
  where shelf is not null
  group by shelf
  order by shelf;
$$;

revoke all on function public.bibli_used_book_shelves() from public, anon;
grant execute on function public.bibli_used_book_shelves() to authenticated;

notify pgrst, 'reload schema';
