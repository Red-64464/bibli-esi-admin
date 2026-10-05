# Retirement of occupancy and access video

Removed from public and admin: occupancy cards/sliders/navigation, route video
playback/upload/settings, related subscriptions and cached visitor information.
Opening hours, book availability, loans and current non-visitor settings remain.

Database migration: `supabase/migrations/20261004180000_retire_visitor_features.sql`.
It deletes only four visitor settings, narrows the public view/RLS, removes
the four video policies and blocks retired keys from being recreated by old tabs.
Do not rewrite old migrations: their history is preserved.

The dedicated `bibli-route-videos` bucket and its two objects were removed
through the Storage API, not direct storage SQL. A private server backup of
both files (SHA-256 verified), the four settings and original settings schema
is retained at `/home/codex-admin/backups/bibliesi-retirement-20261004-1724`.
This backup is not public; retained backup files still consume disk space.

Read-only inventory: `sql/audit-retired-visitor-features.sql`.
Post-retirement checks: `sql/verify-retired-visitor-features.sql`.
All 12 existing BiblESI tables keep RLS enabled. Existing catalog, students,
loans, lookup cache, audit logs and unrelated media were preserved.

Only feature retirement was deployed to the VPS runtime checkouts. The public
visual redesign remains local for review. No GitHub push was performed.
