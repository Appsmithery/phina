create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  category text not null check (category in ('bug', 'feature_request', 'confusing', 'general_feedback', 'praise')),
  message text not null check (char_length(trim(message)) > 0),
  sentiment text null check (sentiment in ('negative', 'neutral', 'positive')),
  source text not null,
  screen text not null,
  context_json jsonb null,
  wants_follow_up boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.user_feedback enable row level security;

create policy "user_feedback_insert_own"
on public.user_feedback
for insert
to authenticated
with check (auth.uid() = member_id);

create policy "user_feedback_select_own"
on public.user_feedback
for select
to authenticated
using (auth.uid() = member_id);

grant insert, select on public.user_feedback to authenticated;
