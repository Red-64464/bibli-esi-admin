-- Enforce the librarian permissions in the database, not only in the React UI.

create or replace function private.is_bibli_member()
returns boolean language sql stable security definer set search_path = public, auth, pg_temp as $$
  select exists (select 1 from public.bibli_profiles where id = (select auth.uid()));
$$;

create or replace function private.is_bibli_super_admin()
returns boolean language sql stable security definer set search_path = public, auth, pg_temp as $$
  select exists (select 1 from public.bibli_profiles where id = (select auth.uid()) and role = 'super_admin');
$$;

create or replace function private.bibli_has_permission(permission_key text)
returns boolean language sql stable security definer set search_path = public, auth, pg_temp as $$
  select exists (
    select 1 from public.bibli_profiles
    where id = (select auth.uid())
      and (role = 'super_admin' or coalesce((permissions ->> permission_key)::boolean, false))
  );
$$;

revoke all on function private.is_bibli_member() from public;
revoke all on function private.is_bibli_super_admin() from public;
revoke all on function private.bibli_has_permission(text) from public;
grant execute on function private.is_bibli_member(), private.is_bibli_super_admin(), private.bibli_has_permission(text) to authenticated;

drop policy if exists bibli_profiles_admin on public.bibli_profiles;
create policy bibli_profiles_self_or_super_read on public.bibli_profiles for select to authenticated
using (id = (select auth.uid()) or (select private.is_bibli_super_admin()));
create policy bibli_profiles_super_write on public.bibli_profiles for all to authenticated
using ((select private.is_bibli_super_admin())) with check ((select private.is_bibli_super_admin()));

drop policy if exists bibli_livres_admin on public.bibli_livres;
create policy bibli_livres_member_read on public.bibli_livres for select to authenticated using ((select private.is_bibli_member()));
create policy bibli_livres_create on public.bibli_livres for insert to authenticated with check ((select private.bibli_has_permission('livres_ajouter')));
create policy bibli_livres_edit on public.bibli_livres for update to authenticated using ((select private.bibli_has_permission('livres_modifier'))) with check ((select private.bibli_has_permission('livres_modifier')));
create policy bibli_livres_remove on public.bibli_livres for delete to authenticated using ((select private.bibli_has_permission('livres_supprimer')));

drop policy if exists bibli_etudiants_admin on public.bibli_etudiants;
create policy bibli_etudiants_member_read on public.bibli_etudiants for select to authenticated using ((select private.is_bibli_member()));
create policy bibli_etudiants_create on public.bibli_etudiants for insert to authenticated with check ((select private.bibli_has_permission('etudiants_ajouter')));
create policy bibli_etudiants_edit on public.bibli_etudiants for update to authenticated using ((select private.bibli_has_permission('etudiants_modifier'))) with check ((select private.bibli_has_permission('etudiants_modifier')));
create policy bibli_etudiants_remove on public.bibli_etudiants for delete to authenticated using ((select private.bibli_has_permission('etudiants_supprimer')));

drop policy if exists bibli_prets_admin on public.bibli_prets;
create policy bibli_prets_member_read on public.bibli_prets for select to authenticated using ((select private.is_bibli_member()));
create policy bibli_prets_create on public.bibli_prets for insert to authenticated with check ((select private.bibli_has_permission('prets_creer')));
create policy bibli_prets_return on public.bibli_prets for update to authenticated using ((select private.bibli_has_permission('prets_retourner'))) with check ((select private.bibli_has_permission('prets_retourner')));
create policy bibli_prets_remove on public.bibli_prets for delete to authenticated using ((select private.is_bibli_super_admin()));

drop policy if exists bibli_reservations_admin on public.bibli_reservations;
create policy bibli_reservations_read on public.bibli_reservations for select to authenticated using ((select private.bibli_has_permission('reservations')));
create policy bibli_reservations_create on public.bibli_reservations for insert to authenticated with check ((select private.bibli_has_permission('reservations')));
create policy bibli_reservations_edit on public.bibli_reservations for update to authenticated using ((select private.bibli_has_permission('reservations'))) with check ((select private.bibli_has_permission('reservations')));
create policy bibli_reservations_remove on public.bibli_reservations for delete to authenticated using ((select private.bibli_has_permission('reservations')));

drop policy if exists bibli_amendes_admin on public.bibli_amendes;
create policy bibli_amendes_member_read on public.bibli_amendes for select to authenticated using ((select private.is_bibli_member()));
create policy bibli_amendes_member_write on public.bibli_amendes for all to authenticated using ((select private.is_bibli_member())) with check ((select private.is_bibli_member()));

drop policy if exists bibli_settings_admin on public.bibli_settings;
create policy bibli_settings_member_read on public.bibli_settings for select to authenticated using ((select private.is_bibli_member()));
create policy bibli_settings_super_write on public.bibli_settings for insert to authenticated with check ((select private.is_bibli_super_admin()));
create policy bibli_settings_super_update on public.bibli_settings for update to authenticated using ((select private.is_bibli_super_admin())) with check ((select private.is_bibli_super_admin()));
create policy bibli_settings_super_delete on public.bibli_settings for delete to authenticated using ((select private.is_bibli_super_admin()));

drop policy if exists bibli_activity_logs_admin on public.bibli_activity_logs;
create policy bibli_logs_read on public.bibli_activity_logs for select to authenticated using ((select private.bibli_has_permission('historique')));
create policy bibli_logs_create on public.bibli_activity_logs for insert to authenticated with check ((select private.is_bibli_member()));
create policy bibli_logs_super_write on public.bibli_activity_logs for update to authenticated using ((select private.is_bibli_super_admin())) with check ((select private.is_bibli_super_admin()));
create policy bibli_logs_super_delete on public.bibli_activity_logs for delete to authenticated using ((select private.is_bibli_super_admin()));

drop policy if exists bibli_covers_admin_write on storage.objects;
create policy bibli_covers_admin_insert on storage.objects for insert to authenticated with check (bucket_id = 'bibli-covers' and (select private.bibli_has_permission('livres_ajouter')));
create policy bibli_covers_admin_update on storage.objects for update to authenticated using (bucket_id = 'bibli-covers' and (select private.bibli_has_permission('livres_modifier'))) with check (bucket_id = 'bibli-covers' and (select private.bibli_has_permission('livres_modifier')));
create policy bibli_covers_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'bibli-covers' and (select private.bibli_has_permission('livres_supprimer')));
