create table if not exists public.member_blocks (
  blocker_id uuid not null references public.members(id) on delete cascade,
  blocked_member_id uuid not null references public.members(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_member_id),
  constraint member_blocks_distinct_members_check check (blocker_id <> blocked_member_id)
);

create index if not exists member_blocks_blocked_member_idx
  on public.member_blocks (blocked_member_id);

alter table public.member_blocks enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'member_blocks'
      and policyname = 'member_blocks_select_own'
  ) then
    execute $policy$
      create policy "member_blocks_select_own"
      on public.member_blocks
      for select
      to authenticated
      using (auth.uid() = blocker_id)
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'member_blocks'
      and policyname = 'member_blocks_insert_own'
  ) then
    execute $policy$
      create policy "member_blocks_insert_own"
      on public.member_blocks
      for insert
      to authenticated
      with check (auth.uid() = blocker_id and blocker_id <> blocked_member_id)
    $policy$;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'member_blocks'
      and policyname = 'member_blocks_delete_own'
  ) then
    execute $policy$
      create policy "member_blocks_delete_own"
      on public.member_blocks
      for delete
      to authenticated
      using (auth.uid() = blocker_id)
    $policy$;
  end if;
end
$$;

grant select, insert, delete on public.member_blocks to authenticated;
