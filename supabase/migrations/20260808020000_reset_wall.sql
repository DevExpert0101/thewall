-- Dev/simulation control: wipe the current wall (cascades to messages,
-- payments and reactions), restart the message sequence and begin a fresh
-- wall. Safe-guarded to service_role so it can never run from the browser.

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
  delete from messages where true; -- cascades to payments and reactions
  delete from walls where true;

  insert into walls (title, ends_at)
  values (new_wall_title, now() + make_interval(mins => duration_minutes))
  returning * into w;

  return w;
end;
$$;

grant execute on function public.reset_wall(int, text) to service_role;
revoke execute on function public.reset_wall(int, text) from anon, authenticated;
