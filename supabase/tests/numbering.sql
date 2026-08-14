-- Concurrency check for sequential numbering.
-- publish_paid_message locks event_counters FOR UPDATE, then increments
-- next_message_number. UNIQUE (event_id, public_number) rejects duplicates if
-- that lock is ever bypassed.
--
-- Manual two-session check (distinct created intents, both committed):
--   begin;
--   select public.publish_paid_message(...);
--   commit;
--
-- Automated checks below must return zero rows after any publish load.

select event_id, public_number, count(*)
from public.messages
group by event_id, public_number
having count(*) > 1;
-- EXPECT: 0 rows

select
  c.event_id,
  c.total_messages,
  (select count(*) from public.messages m where m.event_id = c.event_id) as actual
from public.event_counters c
where c.total_messages is distinct from (
  select count(*) from public.messages m where m.event_id = c.event_id
);
-- EXPECT: 0 rows

select
  c.event_id,
  c.next_message_number,
  coalesce((select max(m.public_number) from public.messages m where m.event_id = c.event_id), 0) + 1 as expected_next
from public.event_counters c
where c.next_message_number is distinct from (
  coalesce((select max(m.public_number) from public.messages m where m.event_id = c.event_id), 0) + 1
);
-- EXPECT: 0 rows
