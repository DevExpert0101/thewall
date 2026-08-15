-- Edition identity and canonical-archive proof. Phase is still derived from
-- timestamps. edition_number is the public library key (Wall №001).

alter table public.events
  add column if not exists edition_number integer,
  add column if not exists winning_message_id uuid,
  add column if not exists archive_hash text,
  add column if not exists merkle_root text,
  add column if not exists archive_uri text,
  add column if not exists proof_tx text;

with numbered as (
  select id, row_number() over (order by starts_at asc, created_at asc) as n
  from public.events
)
update public.events e
set edition_number = numbered.n
from numbered
where e.id = numbered.id
  and e.edition_number is null;

create or replace function public.assign_edition_number()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.edition_number is null then
    select coalesce(max(edition_number), 0) + 1
      into new.edition_number
      from public.events;
  end if;
  return new;
end;
$$;

drop trigger if exists events_assign_edition on public.events;
create trigger events_assign_edition
before insert on public.events
for each row
execute procedure public.assign_edition_number();

alter table public.events
  alter column edition_number set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'events_edition_unique'
  ) then
    alter table public.events
      add constraint events_edition_unique unique (edition_number);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'events_edition_positive'
  ) then
    alter table public.events
      add constraint events_edition_positive check (edition_number >= 1);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'events_archive_hash_sha256'
  ) then
    alter table public.events
      add constraint events_archive_hash_sha256 check (
        archive_hash is null or archive_hash ~ '^[0-9a-f]{64}$'
      );
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'events_merkle_root_sha256'
  ) then
    alter table public.events
      add constraint events_merkle_root_sha256 check (
        merkle_root is null or merkle_root ~ '^[0-9a-f]{64}$'
      );
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'events_winning_message_fk'
  ) then
    alter table public.events
      add constraint events_winning_message_fk
      foreign key (winning_message_id) references public.messages (id)
      on delete set null;
  end if;
end
$$;

comment on column public.events.edition_number is
  'Official Wall number. Archive identity is edition_number, not slug.';
comment on column public.events.archive_hash is
  'SHA-256 of the canonical public archive JSON (final moderated dataset).';
comment on column public.events.merkle_root is
  'Merkle root over public message leaves. Recorded as proof; messages stay off-chain.';
comment on column public.events.archive_uri is
  'Permanent replica URI (ar:// or ipfs://) after the final public dataset is published.';
comment on column public.events.proof_tx is
  'Optional Base transaction that records archive_hash / merkle_root.';

create or replace function public.finalize_event_rankings(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events;
  v_winner uuid;
begin
  select * into v_event from public.events where id = p_event_id for update;
  if not found then
    raise exception 'event_not_found';
  end if;
  if now() < v_event.ends_at then
    raise exception 'event_still_live';
  end if;
  if v_event.finalized_at is not null then
    return;
  end if;

  with ranked as (
    select
      id,
      row_number() over (
        order by reaction_count desc, published_at asc, public_number asc
      ) as rnk
    from public.messages
    where event_id = p_event_id
  )
  update public.messages m
    set final_rank = ranked.rnk
    from ranked
    where m.id = ranked.id;

  select id into v_winner
    from public.messages
    where event_id = p_event_id and final_rank = 1
    limit 1;

  update public.events
    set finalized_at = now(),
        archived_at = coalesce(archived_at, now()),
        winning_message_id = v_winner
    where id = p_event_id;
end;
$$;

comment on table public.events is
  'A 24-hour Wall edition. Phase is derived from timestamps. Sealed editions live in the Archive.';
