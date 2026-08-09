-- The Wall: database schema
-- One wall. One day. One permanent record.

create sequence if not exists message_number_seq;

create table if not exists walls (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  created_at timestamptz not null default now(),
  ends_at timestamptz not null,
  frozen boolean not null default false
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  wall_id uuid not null references walls(id),
  message_number integer not null default nextval('message_number_seq'),
  content text not null check (char_length(content) between 1 and 140),
  reactions integer not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'live')),
  created_at timestamptz not null default now(),
  unique (wall_id, message_number)
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  address text not null,
  amount text not null,
  coin text not null,
  tx_hash text,
  status text not null default 'pending'
    check (status in ('pending', 'confirming', 'confirmed')),
  created_at timestamptz not null default now(),
  confirming_at timestamptz,
  confirmed_at timestamptz
);

create table if not exists reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  reactor_id text not null,
  created_at timestamptz not null default now(),
  unique (message_id, reactor_id)
);

create index if not exists messages_wall_status_idx on messages (wall_id, status, reactions desc);
create index if not exists messages_number_idx on messages (message_number);
create index if not exists reactions_reactor_idx on reactions (reactor_id);

-- ============ Row Level Security ============

alter table walls enable row level security;
alter table messages enable row level security;
alter table payments enable row level security;
alter table reactions enable row level security;

-- Anyone can view the wall and its (live) messages.
create policy "walls are public" on walls
  for select using (true);

create policy "live messages are public" on messages
  for select using (status = 'live');

-- Nobody reads or writes payments/reactions directly.
create policy "no direct payment access" on payments
  for all using (false) with check (false);

create policy "no direct reaction access" on reactions
  for all using (false) with check (false);

-- ============ Functions ============

-- Atomically record a reaction. Returns true if this viewer's reaction
-- was counted, false if already reacted / frozen / not live.
create or replace function public.react(mid uuid, rid text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted boolean;
begin
  if not exists (
    select 1 from messages m join walls w on w.id = m.wall_id
    where m.id = mid and m.status = 'live' and not w.frozen and w.ends_at > now()
  ) then
    return false;
  end if;

  insert into reactions (message_id, reactor_id)
  values (mid, rid)
  on conflict (message_id, reactor_id) do nothing
  returning true into inserted;

  if inserted is null then
    return false;
  end if;

  update messages set reactions = reactions + 1 where id = mid;
  return true;
end;
$$;

-- Confirm a payment (once simulated confirmations elapse) and publish the
-- message onto the live wall. Returns true on success.
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
    where p.id = pid and p.message_id = m.id and m.status = 'pending';

  return true;
end;
$$;

-- ============ Grants ============

grant select on walls to anon, authenticated, service_role;
grant update on walls to service_role;
grant select on messages to anon, authenticated, service_role;
grant insert, update, delete on messages to service_role;
grant select, insert, update on payments to service_role;
grant usage on sequence message_number_seq to service_role;
grant execute on function public.react(uuid, text) to anon, authenticated, service_role;
grant execute on function public.confirm_payment(uuid, text) to anon, authenticated, service_role;

-- ============ Realtime ============

alter publication supabase_realtime add table messages;

-- ============ Seed: the very first wall ============

insert into walls (title, ends_at)
values ('The Wall — August 8, 2026', now() + interval '5 minutes');
