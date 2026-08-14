-- Atomic moderation: a destructive change and its audit row commit together.
-- Executed only by the service role. Public/anon/authenticated cannot call these.

alter table public.moderation_actions
  drop constraint moderation_actions_action;

alter table public.moderation_actions
  add constraint moderation_actions_action check (
    action in ('remove', 'restore', 'flag', 'approve', 'dismiss')
  );

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
  else
    update public.messages
      set removed_at = null,
          removal_reason_code = null,
          moderation_status = 'approved'
      where id = p_message_id;
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

create or replace function public.review_report(
  p_report_id uuid,
  p_administrator_id uuid,
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
  v_report public.reports;
  v_reason text;
begin
  if p_confirmed is not true then
    raise exception 'confirmation_required';
  end if;
  if p_reason_code not in ('hate', 'harassment', 'sexual', 'spam', 'illegal', 'doxxing', 'other') then
    raise exception 'invalid_reason';
  end if;

  select * into v_report from public.reports where id = p_report_id for update;
  if not found then
    raise exception 'report_not_found';
  end if;

  v_reason := p_reason_code;
  if p_note is not null and length(trim(p_note)) > 0 then
    v_reason := p_reason_code || ': ' || left(trim(p_note), 400);
  end if;

  update public.reports
    set status = 'dismissed'
    where id = p_report_id;

  insert into public.moderation_actions (message_id, action, reason, administrator_id)
  values (v_report.message_id, 'dismiss', v_reason, p_administrator_id);

  return jsonb_build_object(
    'ok', true,
    'report_id', v_report.id,
    'action', 'dismiss'
  );
end;
$$;

revoke all on function public.moderate_message(uuid, uuid, text, text, text, boolean)
  from public, anon, authenticated;
revoke all on function public.review_report(uuid, uuid, text, text, boolean)
  from public, anon, authenticated;

grant execute on function public.moderate_message(uuid, uuid, text, text, text, boolean)
  to service_role;
grant execute on function public.review_report(uuid, uuid, text, text, boolean)
  to service_role;

comment on function public.moderate_message(uuid, uuid, text, text, text, boolean) is
  'Remove or restore a message and write the audit row in one transaction. Confirmation required.';
comment on function public.review_report(uuid, uuid, text, text, boolean) is
  'Dismiss a report and write the audit row in one transaction. Confirmation required.';
