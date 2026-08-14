-- Query paths used by the wall, admin, and publish APIs.
-- Unique constraints already create unique indexes; these are additional.

create index messages_event_published_idx
  on public.messages (event_id, published_at desc, public_number desc);

create index messages_event_visible_published_idx
  on public.messages (event_id, published_at desc, public_number desc)
  where removed_at is null;

create index messages_event_reactions_idx
  on public.messages (event_id, reaction_count desc, published_at asc);

create index messages_event_text_hash_idx
  on public.messages (event_id, text_hash);

create index messages_moderation_idx
  on public.messages (moderation_status, published_at desc);

create index reactions_event_created_idx
  on public.reactions (event_id, created_at desc);

create index reactions_message_created_idx
  on public.reactions (message_id, created_at desc);

create index reactions_user_idx
  on public.reactions (anonymous_user_id, created_at desc);

create index payment_intents_user_idx
  on public.payment_intents (anonymous_user_id, created_at desc);

create index payment_intents_status_expiry_idx
  on public.payment_intents (status, expires_at);

create index payment_intents_event_idx
  on public.payment_intents (event_id, created_at desc);

create index payments_created_idx
  on public.payments (created_at desc);

create index reports_status_idx
  on public.reports (status, created_at desc);

create index reports_message_idx
  on public.reports (message_id, created_at desc);

create index moderation_actions_message_idx
  on public.moderation_actions (message_id, created_at desc);

create index public_message_events_event_idx
  on public.public_message_events (event_id, created_at desc);

create index payment_failures_intent_idx
  on public.payment_failures (payment_intent_id, created_at desc);

create index analytics_events_name_idx
  on public.analytics_events (name, created_at desc);
