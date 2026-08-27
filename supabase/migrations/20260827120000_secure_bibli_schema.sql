-- Bibl'ESI: isolated, production-ready schema for the shared self-hosted Supabase.
-- All application tables use the bibli_ prefix so no other VPS project is affected.

create schema if not exists private;

create table if not exists public.bibli_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (char_length(username) between 3 and 80),
  display_name text,
  email text not null unique,
  role text not null default 'librarian' check (role in ('super_admin', 'librarian')),
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  last_login timestamptz
);

create table if not exists public.bibli_livres (
  id uuid primary key default gen_random_uuid(),
  titre text not null check (char_length(trim(titre)) > 0),
  sous_titre text,
  auteur text,
  isbn text unique,
  editeur text,
  annee integer check (annee is null or annee between 1000 and 2100),
  langue text,
  categorie text,
  tags text[] not null default '{}',
  resume text,
  description text,
  emplacement text,
  nb_exemplaires integer not null default 1 check (nb_exemplaires > 0),
  exemplaires_total integer generated always as (nb_exemplaires) stored,
  statut text not null default 'disponible' check (statut in ('disponible', 'emprunté', 'réservé', 'indisponible')),
  disponible boolean not null default true,
  exemplaires_disponibles integer generated always as (case when disponible then nb_exemplaires else 0 end) stored,
  couverture_url text,
  date_ajout timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bibli_etudiants (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (char_length(trim(nom)) > 0),
  prenom text not null check (char_length(trim(prenom)) > 0),
  email text unique,
  numero_etudiant text unique,
  telephone text,
  photo_url text,
  photo_carte_url text,
  notes_admin text,
  champs_custom jsonb not null default '{}'::jsonb,
  date_inscription timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bibli_prets (
  id uuid primary key default gen_random_uuid(),
  livre_id uuid not null references public.bibli_livres(id) on delete restrict,
  etudiant_id uuid not null references public.bibli_etudiants(id) on delete restrict,
  date_pret date not null default current_date,
  date_retour_prevue date,
  date_retour timestamptz,
  date_rappel date,
  notes text,
  statut text not null default 'en_cours' check (statut in ('en_cours', 'retourné', 'en_retard')),
  rendu boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists bibli_one_active_loan_per_book
  on public.bibli_prets(livre_id) where rendu = false;

create table if not exists public.bibli_reservations (
  id uuid primary key default gen_random_uuid(),
  livre_id uuid not null references public.bibli_livres(id) on delete cascade,
  etudiant_id uuid not null references public.bibli_etudiants(id) on delete cascade,
  date_reservation date not null default current_date,
  date_souhaitee date,
  statut text not null default 'en_attente' check (statut in ('en_attente', 'honorée', 'annulée')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.bibli_amendes (
  id uuid primary key default gen_random_uuid(),
  pret_id uuid references public.bibli_prets(id) on delete cascade,
  etudiant_id uuid not null references public.bibli_etudiants(id) on delete cascade,
  montant numeric(10,2) not null default 0 check (montant >= 0),
  jours_retard integer not null default 0 check (jours_retard >= 0),
  taux_journalier numeric(10,2) not null default 50 check (taux_journalier >= 0),
  statut text not null default 'impayee' check (statut in ('impayee', 'payee', 'annulee')),
  date_creation timestamptz not null default now(),
  date_paiement timestamptz,
  note text,
  created_by uuid references public.bibli_profiles(id) on delete set null
);

create table if not exists public.bibli_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.bibli_activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.bibli_profiles(id) on delete set null,
  action_type text not null,
  description text not null,
  user_info text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists bibli_livres_title_idx on public.bibli_livres(titre);
create index if not exists bibli_livres_category_idx on public.bibli_livres(categorie);
create index if not exists bibli_prets_student_idx on public.bibli_prets(etudiant_id);
create index if not exists bibli_prets_active_idx on public.bibli_prets(rendu, date_retour_prevue);
create index if not exists bibli_reservations_status_idx on public.bibli_reservations(statut);
create index if not exists bibli_logs_created_idx on public.bibli_activity_logs(created_at desc);

insert into public.bibli_settings(key, value) values
  ('library_name', 'Bibl''ESI'),
  ('library_email', ''),
  ('library_logo_url', ''),
  ('default_loan_days', '14'),
  ('max_books_per_student', '3'),
  ('send_reminder_emails', 'false'),
  ('reminder_days_before', '3'),
  ('remind_on_due_date', 'true'),
  ('notify_overdue', 'true'),
  ('fine_rate_per_day', '50'),
  ('block_overdue_borrowers', 'true'),
  ('library_hours', '{"lundi":{"ouvert":true,"debut":"08:00","fin":"17:00"},"mardi":{"ouvert":true,"debut":"08:00","fin":"17:00"},"mercredi":{"ouvert":true,"debut":"08:00","fin":"17:00"},"jeudi":{"ouvert":true,"debut":"08:00","fin":"17:00"},"vendredi":{"ouvert":true,"debut":"08:00","fin":"14:00"},"samedi":{"ouvert":false,"debut":"09:00","fin":"12:00"},"dimanche":{"ouvert":false,"debut":"","fin":""}}'),
  ('library_closed_message', ''),
  ('library_is_closed', 'false')
on conflict (key) do nothing;

create or replace function private.is_bibli_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1 from public.bibli_profiles
    where id = (select auth.uid())
  );
$$;

revoke all on function private.is_bibli_admin() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_bibli_admin() to authenticated;

create or replace function public.bibli_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists bibli_livres_touch_updated_at on public.bibli_livres;
create trigger bibli_livres_touch_updated_at before update on public.bibli_livres
for each row execute function public.bibli_touch_updated_at();
drop trigger if exists bibli_etudiants_touch_updated_at on public.bibli_etudiants;
create trigger bibli_etudiants_touch_updated_at before update on public.bibli_etudiants
for each row execute function public.bibli_touch_updated_at();
drop trigger if exists bibli_prets_touch_updated_at on public.bibli_prets;
create trigger bibli_prets_touch_updated_at before update on public.bibli_prets
for each row execute function public.bibli_touch_updated_at();

-- Private operational tables: only authenticated Bibl'ESI admins can access them.
alter table public.bibli_profiles enable row level security;
alter table public.bibli_livres enable row level security;
alter table public.bibli_etudiants enable row level security;
alter table public.bibli_prets enable row level security;
alter table public.bibli_reservations enable row level security;
alter table public.bibli_amendes enable row level security;
alter table public.bibli_settings enable row level security;
alter table public.bibli_activity_logs enable row level security;

revoke all on public.bibli_profiles, public.bibli_livres, public.bibli_etudiants, public.bibli_prets, public.bibli_reservations, public.bibli_amendes, public.bibli_settings, public.bibli_activity_logs from anon, authenticated;
grant select, insert, update, delete on public.bibli_profiles, public.bibli_livres, public.bibli_etudiants, public.bibli_prets, public.bibli_reservations, public.bibli_amendes, public.bibli_settings, public.bibli_activity_logs to authenticated;
grant all privileges on public.bibli_profiles, public.bibli_livres, public.bibli_etudiants, public.bibli_prets, public.bibli_reservations, public.bibli_amendes, public.bibli_settings, public.bibli_activity_logs to service_role;

drop policy if exists bibli_profiles_admin on public.bibli_profiles;
create policy bibli_profiles_admin on public.bibli_profiles for all to authenticated
using ((select private.is_bibli_admin())) with check ((select private.is_bibli_admin()));
drop policy if exists bibli_livres_admin on public.bibli_livres;
create policy bibli_livres_admin on public.bibli_livres for all to authenticated
using ((select private.is_bibli_admin())) with check ((select private.is_bibli_admin()));
drop policy if exists bibli_etudiants_admin on public.bibli_etudiants;
create policy bibli_etudiants_admin on public.bibli_etudiants for all to authenticated
using ((select private.is_bibli_admin())) with check ((select private.is_bibli_admin()));
drop policy if exists bibli_prets_admin on public.bibli_prets;
create policy bibli_prets_admin on public.bibli_prets for all to authenticated
using ((select private.is_bibli_admin())) with check ((select private.is_bibli_admin()));
drop policy if exists bibli_reservations_admin on public.bibli_reservations;
create policy bibli_reservations_admin on public.bibli_reservations for all to authenticated
using ((select private.is_bibli_admin())) with check ((select private.is_bibli_admin()));
drop policy if exists bibli_amendes_admin on public.bibli_amendes;
create policy bibli_amendes_admin on public.bibli_amendes for all to authenticated
using ((select private.is_bibli_admin())) with check ((select private.is_bibli_admin()));
drop policy if exists bibli_settings_admin on public.bibli_settings;
create policy bibli_settings_admin on public.bibli_settings for all to authenticated
using ((select private.is_bibli_admin())) with check ((select private.is_bibli_admin()));
drop policy if exists bibli_activity_logs_admin on public.bibli_activity_logs;
create policy bibli_activity_logs_admin on public.bibli_activity_logs for all to authenticated
using ((select private.is_bibli_admin())) with check ((select private.is_bibli_admin()));

-- Public catalogue is exposed by narrow, read-only security-invoker views.
create or replace view public.bibli_public_livres with (security_invoker = true) as
  select id, titre, sous_titre, auteur, isbn, editeur, annee, langue, categorie, tags, resume,
         description, emplacement, nb_exemplaires, exemplaires_total, exemplaires_disponibles, statut, disponible, couverture_url, date_ajout
  from public.bibli_livres;

create or replace view public.bibli_public_settings with (security_invoker = true) as
  select key, value from public.bibli_settings
  where key in ('library_name', 'library_email', 'library_logo_url', 'library_hours', 'library_is_closed', 'library_closed_message');

grant select on public.bibli_public_livres, public.bibli_public_settings to anon, authenticated;

drop policy if exists bibli_livres_public_read on public.bibli_livres;
create policy bibli_livres_public_read on public.bibli_livres for select to anon, authenticated using (true);
drop policy if exists bibli_settings_public_read on public.bibli_settings;
create policy bibli_settings_public_read on public.bibli_settings for select to anon, authenticated
using (key in ('library_name', 'library_email', 'library_logo_url', 'library_hours', 'library_is_closed', 'library_closed_message'));

grant select (id, titre, sous_titre, auteur, isbn, editeur, annee, langue, categorie, tags, resume, description, emplacement, nb_exemplaires, exemplaires_total, exemplaires_disponibles, statut, disponible, couverture_url, date_ajout) on public.bibli_livres to anon, authenticated;
grant select (key, value) on public.bibli_settings to anon, authenticated;

insert into storage.buckets (id, name, public)
values ('bibli-covers', 'bibli-covers', true)
on conflict (id) do update set public = true;

drop policy if exists bibli_covers_public_read on storage.objects;
create policy bibli_covers_public_read on storage.objects for select to anon, authenticated using (bucket_id = 'bibli-covers');
drop policy if exists bibli_covers_admin_write on storage.objects;
create policy bibli_covers_admin_write on storage.objects for all to authenticated
using (bucket_id = 'bibli-covers' and (select private.is_bibli_admin()))
with check (bucket_id = 'bibli-covers' and (select private.is_bibli_admin()));
