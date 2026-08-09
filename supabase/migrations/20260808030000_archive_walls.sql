-- Permanent record: resetting the wall no longer wipes history.
-- The current wall is sealed (frozen) and preserved forever along with its
-- messages, payments and reactions. Only a fresh wall is started.
-- The artifact and certificates remain readable for sealed walls.

create or replace function public.reset_wall(
  duration_minutes int default 5,
  new_wall_title text default 'The Wall'
)
returns walls
language plpgsql
security definer
set search_path = public
as $$
declare
  w walls%rowtype;
begin
  -- Seal every open wall as a permanent, frozen record. Nothing is deleted.
  update walls set frozen = true where not frozen;

  -- Message numbers are never reset: every voice earns its place in The
  -- Wall's history, #000001 onward, across every wall ever sealed.
  insert into walls (title, ends_at)
  values (new_wall_title, now() + make_interval(mins => duration_minutes))
  returning * into w;

  return w;
end;
$$;

grant execute on function public.reset_wall(int, text) to service_role;
revoke execute on function public.reset_wall(int, text) from anon, authenticated;
