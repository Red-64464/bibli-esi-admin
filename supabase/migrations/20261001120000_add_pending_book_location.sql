alter table public.bibli_pending_books
  add column if not exists emplacement text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bibli_pending_books_emplacement_check'
      and conrelid = 'public.bibli_pending_books'::regclass
  ) then
    alter table public.bibli_pending_books
      add constraint bibli_pending_books_emplacement_check
      check (emplacement is null or emplacement ~ '^[1-5][A-E]$');
  end if;
end
$$;
