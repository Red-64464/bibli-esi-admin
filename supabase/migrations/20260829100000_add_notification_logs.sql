create table if not exists public.bibli_notification_logs (
  id uuid primary key default gen_random_uuid(),
  pret_id uuid not null references public.bibli_prets(id) on delete cascade,
  kind text not null check (kind in ('before_due', 'due_today', 'overdue')),
  scheduled_for date not null,
  recipient_email text not null,
  sent_at timestamptz not null default now(),
  unique (pret_id, kind, scheduled_for)
);

create index if not exists bibli_notification_logs_sent_idx
  on public.bibli_notification_logs(sent_at desc);

alter table public.bibli_notification_logs enable row level security;
create policy bibli_notification_logs_admin_read on public.bibli_notification_logs
  for select to authenticated using ((select private.is_bibli_member()));
