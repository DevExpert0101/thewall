-- Structural checks. Run as a role that can read pg_catalog (migration owner).

do $$
declare
  missing text;
begin
  select string_agg(t, ', ')
  into missing
  from unnest(array[
    'events',
    'event_counters',
    'payment_intents',
    'payments',
    'messages',
    'reactions',
    'message_ownership',
    'reports',
    'moderation_actions',
    'admin_users',
    'reaction_signals',
    'admin_ops_actions',
    'monument_entries',
    'monument_state'
  ]) as t
  where not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = t
  );

  if missing is not null then
    raise exception 'missing tables: %', missing;
  end if;
end;
$$;

-- Required unique constraints exist.
do $$
begin
  perform 1 from pg_constraint
  where conrelid = 'public.payments'::regclass and conname = 'payments_tx_hash';
  if not found then
    raise exception 'missing payments_tx_hash';
  end if;
  perform 1 from pg_constraint
  where conrelid = 'public.payments'::regclass and conname = 'payments_intent_unique';
  if not found then
    raise exception 'missing payments_intent_unique';
  end if;
  perform 1 from pg_constraint
  where conrelid = 'public.messages'::regclass and conname = 'messages_event_number';
  if not found then
    raise exception 'missing messages_event_number';
  end if;
  perform 1 from pg_constraint
  where conrelid = 'public.reactions'::regclass and conname = 'reactions_unique_user_message';
  if not found then
    raise exception 'missing reactions_unique_user_message';
  end if;
  perform 1 from pg_constraint
  where conrelid = 'public.messages'::regclass and conname = 'messages_event_rank_unique';
  if not found then
    raise exception 'missing messages_event_rank_unique';
  end if;
  perform 1 from pg_trigger
  where tgrelid = 'public.reactions'::regclass and tgname = 'reactions_sync_counts';
  if not found then
    raise exception 'missing reactions_sync_counts';
  end if;
  perform 1 from pg_indexes
  where schemaname = 'public' and indexname = 'reactions_user_idempotency_uidx';
  if not found then
    raise exception 'missing reactions_user_idempotency_uidx';
  end if;
  perform 1 from pg_indexes
  where schemaname = 'public' and indexname = 'reactions_event_created_message_idx';
  if not found then
    raise exception 'missing reactions_event_created_message_idx';
  end if;
end;
$$;

-- RLS enabled on every product table.
do $$
declare
  missing text;
begin
  select string_agg(c.relname, ', ')
  into missing
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname in (
      'events', 'event_counters', 'payment_intents', 'payments', 'messages',
      'reactions', 'message_ownership', 'reports', 'moderation_actions',
      'admin_users', 'reaction_signals', 'admin_ops_actions',
      'monument_entries', 'monument_state'
    )
    and c.relrowsecurity is not true;

  if missing is not null then
    raise exception 'rls disabled on: %', missing;
  end if;
end;
$$;

-- Seed is a single empty development event.
do $$
declare
  v_events integer;
  v_messages integer;
  v_reactions integer;
  v_totals integer;
begin
  select count(*) into v_events from public.events;
  if v_events <> 1 then
    raise exception 'expected exactly one seeded event, found %', v_events;
  end if;

  select count(*) into v_messages from public.messages;
  if v_messages <> 0 then
    raise exception 'seed must not include messages, found %', v_messages;
  end if;

  select count(*) into v_reactions from public.reactions;
  if v_reactions <> 0 then
    raise exception 'seed must not include reactions, found %', v_reactions;
  end if;

  select total_messages + total_reactions into v_totals
  from public.event_counters
  where event_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  if v_totals is distinct from 0 then
    raise exception 'seed must not fabricate popularity totals';
  end if;
end;
$$;
