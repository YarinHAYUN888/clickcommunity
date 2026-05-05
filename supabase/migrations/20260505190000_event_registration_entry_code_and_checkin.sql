alter table public.event_registrations
  add column if not exists entry_code text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists checked_in_at timestamptz;

create unique index if not exists event_registrations_entry_code_unique
  on public.event_registrations (entry_code)
  where entry_code is not null;
