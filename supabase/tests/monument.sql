-- Monument numbering and immutability. Applied after finalize in verify-migrations.

do $$
begin
  perform 1 from pg_constraint
  where conrelid = 'public.monument_entries'::regclass
    and conname = 'monument_entries_event_unique';
  if not found then
    raise exception 'missing monument_entries_event_unique';
  end if;
  perform 1 from pg_constraint
  where conrelid = 'public.monument_entries'::regclass
    and conname = 'monument_entries_number_unique';
  if not found then
    raise exception 'missing monument_entries_number_unique';
  end if;
  perform 1 from pg_constraint
  where conrelid = 'public.monument_entries'::regclass
    and conname = 'monument_entries_message_unique';
  if not found then
    raise exception 'missing monument_entries_message_unique';
  end if;
end;
$$;
