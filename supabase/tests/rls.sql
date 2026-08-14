-- RLS verification queries
-- Automated: scripts/verify-migrations.mjs sets role anon inside a transaction.
-- Manual: run as the `anon` role in the Supabase SQL editor:
--   set role anon;
-- After running, reset with: reset role;

-- EXPECT: events are readable
select count(*) as events_visible from public.events;

-- EXPECT: counters are readable
select total_messages, total_reactions from public.event_counters;

-- EXPECT: public_messages view is readable (redacted text only)
select public_number, text, is_removed from public.public_messages limit 5;

-- EXPECT: public_message_events readable
select public_number from public.public_message_events limit 5;

-- EXPECT FAIL: payment intents (privilege or zero rows)
select * from public.payment_intents;

-- EXPECT FAIL: payments (wallets)
select * from public.payments;

-- EXPECT FAIL: message ownership tokens
select * from public.message_ownership;

-- EXPECT FAIL: wall key hashes
select * from public.message_claims;

-- EXPECT FAIL: prize payout addresses
select * from public.prize_nominations;

-- EXPECT FAIL: reports
select * from public.reports;

-- EXPECT FAIL: moderation actions
select * from public.moderation_actions;

-- EXPECT FAIL: admin users
select * from public.admin_users;

-- EXPECT FAIL: direct messages table
select * from public.messages;

-- EXPECT FAIL: cannot insert a message as anon
insert into public.messages (
  event_id, public_number, payment_intent_id, text, text_hash
) values (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  1,
  gen_random_uuid(),
  'should fail',
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
);

-- EXPECT FAIL: cannot execute publish RPC as anon
select public.publish_paid_message(
  gen_random_uuid(),
  '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  '0x0000000000000000000000000000000000000001',
  '0x0000000000000000000000000000000000000002',
  1,
  'USDC',
  'base',
  'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
);
