-- Keep the public surface read-only while exposing settings used by the visitor app.
create or replace view public.bibli_public_settings
with (security_invoker = true) as
  select key, value
  from public.bibli_settings
  where key in (
    'library_name',
    'library_email',
    'library_logo_url',
    'library_hours',
    'library_is_closed',
    'library_closed_message',
    'library_capacity',
    'library_current_occupancy',
    'library_arrival_video_url',
    'library_arrival_video_title'
  );

grant select on public.bibli_public_settings to anon, authenticated;
revoke insert, update, delete on public.bibli_public_settings from anon;
