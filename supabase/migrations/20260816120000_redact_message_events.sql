-- Keep the realtime fanout table in lockstep with moderation.
-- Anon can SELECT public_message_events; removed sentences must not linger there.

create or replace function public.moderate_message(
  p_message_id uuid,
  p_administrator_id uuid,
  p_action text,
  p_reason_code text,
  p_note text,
  p_confirmed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message public.messages;
  v_reason text;
  v_removal_text constant text := 'Message removed under archive policy.';
begin
  if p_confirmed is not true then
    raise exception 'confirmation_required';
  end if;
  if p_action not in ('remove', 'restore') then
    raise exception 'invalid_moderation_action';
  end if;
  if p_reason_code not in ('hate', 'harassment', 'sexual', 'spam', 'illegal', 'doxxing', 'other') then
    raise exception 'invalid_reason';
  end if;

  select * into v_message from public.messages where id = p_message_id for update;
  if not found then
    raise exception 'message_not_found';
  end if;

  v_reason := p_reason_code;
  if p_note is not null and length(trim(p_note)) > 0 then
    v_reason := p_reason_code || ': ' || left(trim(p_note), 400);
  end if;

  if p_action = 'remove' then
    update public.messages
      set removed_at = coalesce(removed_at, now()),
          removal_reason_code = p_reason_code,
          moderation_status = 'removed'
      where id = p_message_id;
    update public.reports
      set status = 'reviewed'
      where message_id = p_message_id
        and status = 'open';
    update public.public_message_events
      set text = v_removal_text
      where event_id = v_message.event_id
        and public_number = v_message.public_number;
  else
    update public.messages
      set removed_at = null,
          removal_reason_code = null,
          moderation_status = 'approved'
      where id = p_message_id;
    update public.public_message_events
      set text = v_message.text
      where event_id = v_message.event_id
        and public_number = v_message.public_number;
  end if;

  insert into public.moderation_actions (message_id, action, reason, administrator_id)
  values (p_message_id, p_action, v_reason, p_administrator_id);

  return jsonb_build_object(
    'ok', true,
    'public_number', v_message.public_number,
    'action', p_action
  );
end;
$$;

update public.public_message_events e
set text = 'Message removed under archive policy.'
from public.messages m
where e.event_id = m.event_id
  and e.public_number = m.public_number
  and m.removed_at is not null;

comment on table public.public_message_events is
  'Public-safe realtime fanout. Text is redacted when a sentence is removed.';
