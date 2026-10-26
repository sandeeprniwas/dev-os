-- =====================================================================
-- ContractIQ — rls-policies.sql (security migration)
-- Paste into Supabase → SQL Editor → Run, on a project that already ran
-- supabase/database.sql. Atomic and idempotent. A fresh project only needs
-- database.sql (it already contains everything below).
--
-- What it does (docs/security/security-plan.md):
--   1. Sliding-window rate limiting table `rate_limit_events` (service role only)
--      and removal of the old fixed-window rate_limits / check_rate_limit().
--   2. Server-authoritative writes: clients can no longer INSERT/UPDATE
--      contracts or INSERT/DELETE key_terms, or insert assistant chat messages.
--   3. Integrity constraints: bounded contract_text, owner-scoped file_path.
--   4. RLS enabled on every table (idempotent) + self-check.
-- =====================================================================

begin;

-- 1. Rate limiting --------------------------------------------------------
drop function if exists public.check_rate_limit(text, integer, integer);
drop table if exists public.rate_limits;

create table if not exists public.rate_limit_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users (id) on delete cascade,
  subject    text not null check (char_length(subject) between 3 and 80),
  action     text not null check (action in ('auth', 'chat', 'process', 'upload')),
  created_at timestamptz not null default now()
);
create index if not exists idx_rate_limit_events_lookup  on public.rate_limit_events (subject, action, created_at desc);
create index if not exists idx_rate_limit_events_created on public.rate_limit_events (created_at);
comment on table public.rate_limit_events is 'Sliding-window rate-limit events (per user, or per hashed IP for auth). Service role only.';

revoke all on public.rate_limit_events from anon, authenticated;
grant all on public.rate_limit_events to service_role;

-- 2. Server-authoritative writes -------------------------------------------
drop policy if exists contracts_insert_own on public.contracts;
drop policy if exists contracts_update_own on public.contracts;
revoke insert, update on public.contracts from authenticated;

drop policy if exists key_terms_insert_own on public.key_terms;
drop policy if exists key_terms_delete_own on public.key_terms;
revoke insert, delete on public.key_terms from authenticated;

drop policy if exists chat_messages_insert_own on public.chat_messages;
create policy chat_messages_insert_own on public.chat_messages
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and role = 'user'
    and exists (select 1 from public.chat_sessions s where s.id = session_id and s.user_id = (select auth.uid()))
  );

-- 3. Integrity constraints ---------------------------------------------------
do $$ begin
  alter table public.contracts add constraint contracts_text_size
    check (char_length(contract_text) between 1 and 200000);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.contracts add constraint contracts_file_path_owner
    check (file_path is null or file_path like (user_id::text || '/' || id::text || '/%'));
exception when duplicate_object then null; end $$;

-- 4. RLS on every table (idempotent) ---------------------------------------
alter table public.profiles          enable row level security;
alter table public.contracts         enable row level security;
alter table public.custom_key_terms  enable row level security;
alter table public.key_terms         enable row level security;
alter table public.chat_sessions     enable row level security;
alter table public.chat_messages     enable row level security;
alter table public.user_feedback     enable row level security;
alter table public.llm_usage         enable row level security;
alter table public.rate_limit_events enable row level security;

-- 5. Self-check (aborts the transaction on failure) --------------------------
do $$
declare
  t text;
  problems text[] := '{}';
begin
  foreach t in array array['profiles','contracts','custom_key_terms','key_terms','chat_sessions',
                           'chat_messages','user_feedback','llm_usage','rate_limit_events'] loop
    if not exists (select 1 from pg_tables where schemaname = 'public' and tablename = t and rowsecurity) then
      problems := problems || format('RLS not enabled on public.%s', t);
    end if;
  end loop;
  if has_table_privilege('authenticated', 'public.rate_limit_events', 'select') then
    problems := problems || 'authenticated can read rate_limit_events'::text;
  end if;
  if has_table_privilege('authenticated', 'public.contracts', 'insert')
     or has_column_privilege('authenticated', 'public.contracts', 'contract_text', 'update') then
    problems := problems || 'authenticated can write contracts'::text;
  end if;
  if has_table_privilege('authenticated', 'public.key_terms', 'insert') then
    problems := problems || 'authenticated can insert key_terms'::text;
  end if;
  if not has_table_privilege('service_role', 'public.rate_limit_events', 'insert') then
    problems := problems || 'service_role cannot write rate_limit_events'::text;
  end if;
  if exists (select 1 from storage.buckets where id = 'contracts' and public) then
    problems := problems || 'storage bucket "contracts" is public'::text;
  end if;
  if array_length(problems, 1) > 0 then
    raise exception 'ContractIQ security self-check failed: %', array_to_string(problems, '; ');
  end if;
  raise notice 'ContractIQ security migration applied and verified.';
end;
$$;

commit;
