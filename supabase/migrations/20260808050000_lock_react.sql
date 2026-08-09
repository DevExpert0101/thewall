-- Postgres grants EXECUTE on functions to PUBLIC by default, so revoking from
-- anon/authenticated alone is not enough: the react() RPC must be callable
-- ONLY by the service role (our guarded API route).
revoke execute on function public.react(uuid, text) from public, anon, authenticated;
grant execute on function public.react(uuid, text) to service_role;
