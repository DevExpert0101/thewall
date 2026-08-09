-- Read a device's reacted message ids. Direct table access is blocked by RLS
-- (using(false)) for every role, so this is the sanctioned read path, used by
-- /api/messages to render the "· you" state. Runs as owner to bypass RLS.
create or replace function public.reacted_ids(rid text)
returns uuid[]
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(array_agg(message_id order by created_at desc), '{}'::uuid[])
  from reactions
  where reactor_id = rid;
$$;

revoke all on function public.reacted_ids(text) from public, anon, authenticated;
grant execute on function public.reacted_ids(text) to service_role;
