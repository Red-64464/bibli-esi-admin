#!/usr/bin/env bash
set -euo pipefail

runtime_dir=/home/codex-admin/bibli-esi-admin-runtime
anon_key=$(sed -n 's/^SUPABASE_ANON_KEY=//p' "$runtime_dir/deploy/.env")

echo '--- database indexes ---'
sudo docker exec -i supabase-db psql -At -U postgres -d postgres <<'SQL'
select indexname
from pg_indexes
where schemaname = 'public'
  and indexname like 'bibli_%'
order by indexname;
SQL

echo '--- anonymous write grants ---'
sudo docker exec -i supabase-db psql -At -U postgres -d postgres <<'SQL'
select table_name || ':' || privilege_type
from information_schema.role_table_grants
where grantee = 'anon'
  and table_schema = 'public'
  and table_name like 'bibli_%'
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
order by table_name, privilege_type;
SQL

echo '--- expected admin account ---'
sudo docker exec -i supabase-db psql -At -U postgres -d postgres <<'SQL'
select count(*) from auth.users where email = 'admin@bibliesi.local';
SQL

no_auth=$(curl -sS -o /tmp/send-email-noauth.json -w '%{http_code}' \
  -X POST 'https://supabase.75.119.140.201.nip.io/functions/v1/send-email' \
  -H "apikey: $anon_key" -H 'content-type: application/json' --data '{}')
login=$(curl -sS -o /tmp/send-email-login.json -w '%{http_code}' \
  -X POST 'https://supabase.75.119.140.201.nip.io/auth/v1/token?grant_type=password' \
  -H "apikey: $anon_key" -H 'content-type: application/json' \
  --data '{"email":"admin@bibliesi.local","password":"admin 123"}')
access_token=$(grep -o '"access_token":"[^"]*"' /tmp/send-email-login.json | head -n1 | cut -d '"' -f4 || true)
if [[ -n "$access_token" ]]; then
  authenticated=$(curl -sS -o /tmp/send-email-auth.json -w '%{http_code}' \
    -X POST 'https://supabase.75.119.140.201.nip.io/functions/v1/send-email' \
    -H "apikey: $anon_key" -H "authorization: Bearer $access_token" \
    -H 'content-type: application/json' --data '{}')
else
  authenticated=not-run
fi
rm -f /tmp/send-email-noauth.json /tmp/send-email-login.json /tmp/send-email-auth.json
printf 'send_email_no_auth=%s\nsend_email_login=%s\nsend_email_authenticated_invalid_payload=%s\n' \
  "$no_auth" "$login" "$authenticated"
