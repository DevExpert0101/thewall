-- Freeze checkout terms after insert, keep message text bound to its hash,
-- and deny public writes on events.

create extension if not exists pgcrypto;

create or replace function public.freeze_payment_intent_terms()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.message_text is distinct from old.message_text
     or new.message_hash is distinct from old.message_hash
     or new.amount is distinct from old.amount
     or new.recipient_wallet is distinct from old.recipient_wallet
     or new.currency is distinct from old.currency
     or new.network is distinct from old.network
     or new.event_id is distinct from old.event_id
     or new.anonymous_user_id is distinct from old.anonymous_user_id
  then
    raise exception 'intent_terms_frozen';
  end if;
  return new;
end;
$$;

drop trigger if exists payment_intents_freeze_terms on public.payment_intents;
create trigger payment_intents_freeze_terms
before update on public.payment_intents
for each row
execute procedure public.freeze_payment_intent_terms();

create or replace function public.assert_message_text_hash()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.text_hash is distinct from encode(digest(convert_to(new.text, 'UTF8'), 'sha256'), 'hex') then
    raise exception 'hash_mismatch';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_text_hash_matches on public.messages;
create trigger messages_text_hash_matches
before insert or update of text, text_hash on public.messages
for each row
execute procedure public.assert_message_text_hash();

revoke insert, update, delete on public.events from public, anon, authenticated;
revoke insert, update, delete on public.event_counters from public, anon, authenticated;
