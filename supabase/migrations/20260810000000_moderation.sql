-- Moderation: pre-publication gate, user reports, and emergency removal.
--
-- Every message passes an automatic moderation pipeline before payment can be
-- created; the DB layer below is the backstop so that a message can only ever
-- go live once it has been approved.

-- ---- Messages --------------------------------------------------------------

alter table messages add column if not exists moderation_status text not null default 'pending'
  check (moderation_status in ('pending', 'approved', 'rejected'));

-- Human-readable reasons from the automatic pipeline, e.g. 'spam', 'pii'.
alter table messages add column if not exists moderation_notes text;

-- Emergency removal: the message is hidden from the live wall and the
-- permanent record, but the row (number + original content) survives for audit
-- and appeals. 'removed' is a message status, so the existing
-- status = 'live' select policies hide it everywhere at once.
alter table messages drop constraint if exists messages_status_check;
alter table messages add constraint messages_status_check
  check (status in ('pending', 'live', 'removed'));

alter table messages add column if not exists removed_at timestamptz;
alter table messages add column if not exists removed_reason text;

-- Publish only when moderation has approved. If a message is still 'pending'
-- (async moderation) or 'rejected', a confirmed payment does not go live.
create or replace function public.confirm_payment(pid uuid, tx text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  wall_frozen boolean;
begin
  if exists (
    select 1 from payments p
    join messages m on m.id = p.message_id
    join walls w on w.id = m.wall_id
    where p.id = pid and (w.frozen or w.ends_at <= now())
  ) then
    return false;
  end if;

  update payments
    set status = 'confirmed', tx_hash = tx, confirmed_at = now()
    where id = pid and status <> 'confirmed';

  update messages m
    set status = 'live'
    from payments p
    where p.id = pid and p.message_id = m.id
      and m.status = 'pending'
      and m.moderation_status = 'approved';

  return true;
end;
$$;

-- ---- Reports ---------------------------------------------------------------

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  reason text not null check (reason in (
    'harassment',
    'personal_information',
    'illegal_content',
    'hate',
    'adult_content',
    'spam',
    'other'
  )),
  details text,
  reporter_hash text,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists reports_status_idx on reports (status, created_at desc);
create index if not exists reports_message_idx on reports (message_id);

alter table reports enable row level security;

-- Reports are only touched through the API routes (service_role).
create policy "no direct report access" on reports
  for all using (false) with check (false);

grant select, insert, update on reports to service_role;
