-- One-screen wall: scatter plots, no giant zoomable surface.

alter table public.monument_state
  alter column canvas_width set default 1440,
  alter column canvas_height set default 900,
  alter column cell_width set default 280,
  alter column cell_height set default 160;

update public.monument_state
set
  canvas_width = 1440,
  canvas_height = 900,
  cell_width = 280,
  cell_height = 160
where singleton = true;

create or replace function public.monument_plot(p_position integer)
returns table (x integer, y integer, width integer, height integer)
language plpgsql
stable
set search_path = public
as $$
declare
  v_state public.monument_state;
  v_span_x integer;
  v_span_y integer;
begin
  if p_position is null or p_position < 1 then
    raise exception 'invalid_monument_position';
  end if;
  select * into v_state from public.monument_state where singleton = true;
  if not found then
    raise exception 'monument_state_missing';
  end if;
  v_span_x := greatest(v_state.canvas_width - v_state.cell_width, 0);
  v_span_y := greatest(v_state.canvas_height - v_state.cell_height, 0);
  return query
    select
      case
        when v_span_x = 0 then 0
        else (((p_position::bigint * 747796405 + 17) & 4294967295) % (v_span_x + 1))::integer
      end,
      case
        when v_span_y = 0 then 0
        else (((p_position::bigint * 747796405 + 41) & 4294967295) % (v_span_y + 1))::integer
      end,
      v_state.cell_width,
      v_state.cell_height;
end;
$$;

revoke all on function public.monument_plot(integer) from public, anon, authenticated;
grant execute on function public.monument_plot(integer) to service_role;
