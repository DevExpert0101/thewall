-- pgcrypto is optional. PostgreSQL 13+ and PGlite provide gen_random_uuid() in core.
do $$
begin
  create extension if not exists pgcrypto;
exception
  when others then
    null;
end;
$$;
