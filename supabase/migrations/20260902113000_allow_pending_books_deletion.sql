-- Les personnes disposant du droit de suppression de livres peuvent aussi
-- retirer une fiche d'identification et ses deux photos privées.
grant delete on table public.bibli_pending_books to authenticated;

drop policy if exists bibli_pending_books_delete on public.bibli_pending_books;
create policy bibli_pending_books_delete on public.bibli_pending_books
  for delete to authenticated
  using ((select private.bibli_has_permission('livres_supprimer')));

drop policy if exists bibli_pending_books_files_delete on storage.objects;
create policy bibli_pending_books_files_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'bibli-pending-books'
    and (select private.bibli_has_permission('livres_supprimer'))
  );
