-- Database integrity probes. Each SELECT must return 0 rows after any load.
-- Complements numbering.sql and verify.sql.
--
-- publish_paid_message and add_fire_reaction are the only writers for
-- numbers, payments, and 🔥. Unique constraints are the last defense if a
-- lock is skipped. These queries catch drift that the schema does not
-- CHECK automatically.

-- Duplicate public numbers
select event_id, public_number, count(*)
from public.messages
group by event_id, public_number
having count(*) > 1;

-- Duplicate transaction hashes
select transaction_hash, count(*)
from public.payments
group by transaction_hash
having count(*) > 1;

-- Duplicate 🔥 (same user, same sentence)
select message_id, anonymous_user_id, count(*)
from public.reactions
group by message_id, anonymous_user_id
having count(*) > 1;

-- Completed payment with no monument row
select p.id
from public.payments p
left join public.messages m on m.payment_intent_id = p.payment_intent_id
where p.status = 'completed' and m.id is null;

-- Monument row with no ownership ticket
select m.id
from public.messages m
left join public.message_ownership o on o.message_id = m.id
where o.message_id is null;

-- 🔥 count drift vs reaction rows
select m.id, m.reaction_count, count(r.id) as actual
from public.messages m
left join public.reactions r on r.message_id = m.id
group by m.id, m.reaction_count
having m.reaction_count is distinct from count(r.id);

-- Event total_reactions drift
select c.event_id, c.total_reactions, coalesce(sum(m.reaction_count), 0) as from_messages
from public.event_counters c
left join public.messages m on m.event_id = c.event_id
group by c.event_id, c.total_reactions
having c.total_reactions is distinct from coalesce(sum(m.reaction_count), 0);

-- Duplicate ranks (living or redacted — ranks stay after seal)
select event_id, final_rank, count(*)
from public.messages
where final_rank is not null
group by event_id, final_rank
having count(*) > 1;

-- Reaction pointed at the wrong event
select r.id
from public.reactions r
join public.messages m on m.id = r.message_id
where r.event_id is distinct from m.event_id;
