-- Development seed only. supabase db push does not apply this file.
-- One event, zero messages, zero reactions — no fabricated popularity.

insert into public.events (
  id,
  slug,
  title,
  starts_at,
  ends_at,
  configuration
)
values (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'the-wall',
  'THE WALL',
  now() + interval '1 hour',
  now() + interval '25 hours',
  jsonb_build_object(
    'price', '1.00',
    'currency', 'USDC',
    'network', 'base',
    'maxGraphemes', 140
  )
)
on conflict (slug) do nothing;

-- Counter row is created by events_ensure_counter. Insert is a no-op if present.
insert into public.event_counters (event_id, next_message_number, total_messages, total_reactions)
values ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 1, 0, 0)
on conflict (event_id) do nothing;
