-- The public settings view is readable by visitors, but it must never accept
-- anonymous changes. Views are not returned by pg_tables, so this is explicit.
revoke insert, update, delete on table public.bibli_public_settings from anon;
