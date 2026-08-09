-- Moderation removal must remain possible after the Wall seals.
--
-- The museum guards make every message immutable once the wall is over —
-- except the moderation pathway: an emergency removal (status live->removed)
-- and a mistaken-removal restore (removed->live) are the only status
-- transitions permitted on a sealed wall, and they may touch only the
-- removed_* audit columns. Content, number, reactions and moderation_status
-- stay locked forever.

create or replace function public.guard_messages_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from walls w
    where w.id = old.wall_id and (w.frozen or w.ends_at <= now())
  ) then
    -- Sealed wall: moderation may only flip status live<->removed. Any other
    -- change is a violation of the permanent record.
    if (new.status <> old.status) and
       not ((old.status = 'live' and new.status = 'removed') or
            (old.status = 'removed' and new.status = 'live')) then
      raise exception 'The Wall is sealed. Messages are permanent and cannot be edited.';
    end if;

    if (new.content <> old.content)
       or (new.message_number <> old.message_number)
       or (new.reactions <> old.reactions)
       or (new.moderation_status <> old.moderation_status)
       or (new.wall_id <> old.wall_id) then
      raise exception 'The Wall is sealed. Messages are permanent and cannot be edited.';
    end if;
  end if;
  return new;
end;
$$;
