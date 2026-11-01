alter table public.newsletter_subscribers rename to subscribers;
alter index if exists public.newsletter_subscribers_status_idx rename to subscribers_status_idx;

alter table public.subscribers enable row level security;
revoke all on public.subscribers from anon, authenticated;