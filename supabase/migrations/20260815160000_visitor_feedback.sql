-- Private notes from visitors to stewards. Never part of the public Wall.

create table public.visitor_feedback (
  id uuid primary key default gen_random_uuid(),
  body text not null,
  category text not null default 'product',
  contact_email text,
  created_at timestamptz not null default now(),
  constraint visitor_feedback_body_len check (char_length(body) between 8 and 800),
  constraint visitor_feedback_category check (category in ('product', 'bug', 'other')),
  constraint visitor_feedback_email_len check (
    contact_email is null or char_length(contact_email) between 3 and 200
  )
);

comment on table public.visitor_feedback is
  'Visitor notes to stewards. Not published. Optional email is for reply only.';

alter table public.visitor_feedback enable row level security;
alter table public.visitor_feedback force row level security;

revoke all on public.visitor_feedback from public, anon, authenticated;
grant all on public.visitor_feedback to service_role;
