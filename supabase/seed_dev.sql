-- Optional local helper: open the seeded development event for 24 hours from now.
-- Does not add messages or reactions. Do not run this against production.

update public.events
set
  starts_at = now() - interval '1 minute',
  ends_at = now() + interval '24 hours',
  archived_at = null,
  finalized_at = null
where slug = 'the-wall';
