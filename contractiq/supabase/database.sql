-- =====================================================================
-- ContractIQ — database.sql
-- Complete database setup for a Supabase project (Postgres 15+).
--
-- HOW TO RUN: Supabase → SQL Editor → New query → paste this whole file → Run.
--
-- Properties
--   • Atomic      — wrapped in one transaction; any failure rolls everything back.
--   • Idempotent  — safe to re-run on an existing project; never drops data.
--   • Self-checking — section 13 asserts RLS, grants and storage, and aborts
--                   the transaction if anything is missing.
--
-- Creates
--   6 enums · 9 tables · 1 view · 17 indexes · 8 triggers · 5 RPC functions ·
--   Row Level Security + policies on every table · explicit least-privilege
--   grants · private `contracts` Storage bucket + folder-scoped policies.
--
-- Requirements covered: FR-13 (RLS on all data), FR-14 (single paste-and-run file),
-- PRD §5 security & retention constraints.
-- Reference: docs/specs/database.md · Canonical copy: contractiq/supabase/database.sql
-- (docs/specs/supabase-schema.sql must stay byte-identical; a unit test enforces it).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------
do $$ begin create type public.contract_type as enum ('nda', 'msa');
exception when duplicate_object then null; end $$;

do $$ begin create type public.detected_contract_type as enum ('nda', 'msa', 'other');
exception when duplicate_object then null; end $$;

do $$ begin create type public.contract_status as enum ('uploaded', 'processing', 'completed', 'error');
exception when duplicate_object then null; end $$;

do $$ begin create type public.chat_role as enum ('user', 'assistant');
exception when duplicate_object then null; end $$;

do $$ begin create type public.feedback_rating as enum ('up', 'down');
exception when duplicate_object then null; end $$;

do $$ begin create type public.llm_operation as enum ('extraction', 'chat');
exception when duplicate_object then null; end $$;


-- ---------------------------------------------------------------------
-- 2. Shared trigger function: updated_at
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ---------------------------------------------------------------------
-- 3. Tables (dependency order)
-- ---------------------------------------------------------------------

-- 3.1 profiles — 1:1 with auth.users
create table if not exists public.profiles (
  id                      uuid primary key references auth.users (id) on delete cascade,
  email                   text not null,
  full_name               text check (full_name is null or char_length(full_name) <= 120),
  analyses_count          integer not null default 0 check (analyses_count >= 0),
  onboarding_completed_at timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- 3.2 contracts — one uploaded contract + its extracted text
create table if not exists public.contracts (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  title               text not null check (char_length(title) between 1 and 200),
  contract_type       public.contract_type not null,
  detected_type       public.detected_contract_type,
  status              public.contract_status not null default 'uploaded',
  original_filename   text not null check (char_length(original_filename) between 1 and 255),
  file_path           text,
  file_size_bytes     integer not null check (file_size_bytes between 1 and 10485760),
  page_count          smallint not null check (page_count between 1 and 20),
  word_count          integer not null check (word_count >= 100),
  token_count         integer not null check (token_count between 1 and 15000),
  contract_text       text not null,
  prompt_version      text,
  model               text,
  processing_ms       integer check (processing_ms is null or processing_ms >= 0),
  error_code          text,
  error_message       text,
  processed_at        timestamptz,
  review_completed_at timestamptz,
  last_accessed_at    timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- 3.3 custom_key_terms — user-defined terms requested before processing (FR-05)
create table if not exists public.custom_key_terms (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  term_name   text not null check (char_length(term_name) between 2 and 80),
  is_manual   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- 3.4 key_terms — extracted results (standard + custom, same shape)
create table if not exists public.key_terms (
  id               uuid primary key default gen_random_uuid(),
  contract_id      uuid not null references public.contracts (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  term_key         text not null check (char_length(term_key) between 1 and 120),
  term_name        text not null check (char_length(term_name) between 1 and 120),
  value            text check (value is null or char_length(value) <= 1000),
  original_value   text,
  page_number      smallint check (page_number is null or page_number between 1 and 20),
  confidence_score smallint not null check (confidence_score between 0 and 100),
  source_sentence  text check (source_sentence is null or char_length(source_sentence) <= 1000),
  source_verified  boolean not null default false,
  is_custom        boolean not null default false,
  is_edited        boolean not null default false,
  edited_at        timestamptz,
  sort_order       smallint not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint key_terms_contract_term_key_unique unique (contract_id, term_key)
);

-- 3.5 chat_sessions — one persistent conversation per contract (US-012)
create table if not exists public.chat_sessions (
  id            uuid primary key default gen_random_uuid(),
  contract_id   uuid not null unique references public.contracts (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  message_count integer not null default 0 check (message_count >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 3.6 chat_messages — every chat turn (FR-09)
create table if not exists public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.chat_sessions (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        public.chat_role not null,
  content     text not null check (char_length(content) between 1 and 8000),
  cited_pages smallint[] not null default '{}',
  query_class text check (query_class is null or query_class in ('contract', 'history', 'both')),
  latency_ms  integer check (latency_ms is null or latency_ms >= 0),
  created_at  timestamptz not null default now()
);

-- 3.7 user_feedback — thumbs up/down per review (FR-12)
create table if not exists public.user_feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  contract_id uuid not null references public.contracts (id) on delete cascade,
  rating      public.feedback_rating not null,
  comment     text check (comment is null or char_length(comment) <= 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint user_feedback_user_contract_unique unique (user_id, contract_id)
);

-- 3.8 llm_usage — cost / latency telemetry per OpenAI call (written with the service role)
create table if not exists public.llm_usage (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  contract_id         uuid references public.contracts (id) on delete set null,
  operation           public.llm_operation not null,
  model               text not null,
  input_tokens        integer not null default 0 check (input_tokens >= 0),
  output_tokens       integer not null default 0 check (output_tokens >= 0),
  cached_input_tokens integer not null default 0 check (cached_input_tokens >= 0),
  cost_usd            numeric(10, 6) not null default 0,
  latency_ms          integer not null default 0 check (latency_ms >= 0),
  attempts            smallint not null default 1 check (attempts between 1 and 5),
  success             boolean not null,
  finish_reason       text,
  created_at          timestamptz not null default now()
);

-- 3.9 rate_limit_events — sliding-window rate limiting (service role only; security plan §3)
--     Replaces the earlier fixed-window rate_limits table / check_rate_limit() function.
drop function if exists public.check_rate_limit(text, integer, integer);
drop table if exists public.rate_limits;

create table if not exists public.rate_limit_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users (id) on delete cascade,      -- null for anonymous auth requests
  subject    text not null check (char_length(subject) between 3 and 80), -- 'user:<uuid>' or 'ip:<salted hash>'
  action     text not null check (action in ('auth', 'chat', 'process', 'upload')),
  created_at timestamptz not null default now()
);

-- 3.10 Integrity constraints on server-controlled columns (added idempotently for existing projects)
do $$ begin
  alter table public.contracts add constraint contracts_text_size
    check (char_length(contract_text) between 1 and 200000);
exception when duplicate_object then null; end $$;

do $$ begin
  -- A contract may only point at its own object: {user_id}/{contract_id}/… (blocks cross-tenant paths)
  alter table public.contracts add constraint contracts_file_path_owner
    check (file_path is null or file_path like (user_id::text || '/' || id::text || '/%'));
exception when duplicate_object then null; end $$;


-- ---------------------------------------------------------------------
-- 4. Indexes
-- ---------------------------------------------------------------------
create index if not exists idx_contracts_user_created  on public.contracts (user_id, created_at desc);
create index if not exists idx_contracts_user_type     on public.contracts (user_id, contract_type);
create index if not exists idx_contracts_user_title    on public.contracts (user_id, lower(title));
create index if not exists idx_contracts_retention     on public.contracts (last_accessed_at) where file_path is not null;

create unique index if not exists idx_custom_key_terms_contract_name on public.custom_key_terms (contract_id, lower(term_name));
create index if not exists idx_custom_key_terms_user                on public.custom_key_terms (user_id);

create index if not exists idx_key_terms_contract_sort on public.key_terms (contract_id, sort_order);
create index if not exists idx_key_terms_user_edited   on public.key_terms (user_id, edited_at) where is_edited;

create index if not exists idx_chat_sessions_user           on public.chat_sessions (user_id);
create index if not exists idx_chat_messages_session_created on public.chat_messages (session_id, created_at);
create index if not exists idx_chat_messages_user           on public.chat_messages (user_id);

create index if not exists idx_user_feedback_contract on public.user_feedback (contract_id);

create index if not exists idx_llm_usage_created      on public.llm_usage (created_at);
create index if not exists idx_llm_usage_user_created on public.llm_usage (user_id, created_at);
create index if not exists idx_llm_usage_contract     on public.llm_usage (contract_id);

create index if not exists idx_rate_limit_events_lookup on public.rate_limit_events (subject, action, created_at desc);
create index if not exists idx_rate_limit_events_created on public.rate_limit_events (created_at);


-- ---------------------------------------------------------------------
-- 5. updated_at triggers
-- ---------------------------------------------------------------------
drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_contracts_updated_at on public.contracts;
create trigger trg_contracts_updated_at before update on public.contracts
  for each row execute function public.set_updated_at();

drop trigger if exists trg_key_terms_updated_at on public.key_terms;
create trigger trg_key_terms_updated_at before update on public.key_terms
  for each row execute function public.set_updated_at();

drop trigger if exists trg_chat_sessions_updated_at on public.chat_sessions;
create trigger trg_chat_sessions_updated_at before update on public.chat_sessions
  for each row execute function public.set_updated_at();

drop trigger if exists trg_user_feedback_updated_at on public.user_feedback;
create trigger trg_user_feedback_updated_at before update on public.user_feedback
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------
-- 6. Business triggers
-- ---------------------------------------------------------------------

-- 6.1 Create a profile for every new auth user
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users that signed up before this script ran
insert into public.profiles (id, email)
select u.id, coalesce(u.email, '') from auth.users u
on conflict (id) do nothing;

-- 6.2 Max 5 custom terms per contract
create or replace function public.enforce_custom_term_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.custom_key_terms where contract_id = new.contract_id) >= 5 then
    raise exception 'custom_term_limit_exceeded' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_custom_key_terms_limit on public.custom_key_terms;
create trigger trg_custom_key_terms_limit before insert on public.custom_key_terms
  for each row execute function public.enforce_custom_term_limit();

-- 6.3 Keep chat_sessions.message_count in sync
create or replace function public.bump_chat_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.chat_sessions
     set message_count = message_count + 1,
         updated_at    = now()
   where id = new.session_id;
  return new;
end;
$$;

drop trigger if exists trg_chat_messages_bump_session on public.chat_messages;
create trigger trg_chat_messages_bump_session after insert on public.chat_messages
  for each row execute function public.bump_chat_session();


-- ---------------------------------------------------------------------
-- 7. RPC functions (called from the app with the user's session)
-- ---------------------------------------------------------------------

-- 7.1 Replace a contract's custom-term list atomically (S5)
create or replace function public.replace_custom_terms(p_contract_id uuid, p_terms text[])
returns setof public.custom_key_terms
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if coalesce(array_length(p_terms, 1), 0) > 5 then
    raise exception 'custom_term_limit_exceeded' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.contracts c
     where c.id = p_contract_id and c.user_id = auth.uid()
  ) then
    raise exception 'contract_not_found' using errcode = 'P0002';
  end if;

  delete from public.custom_key_terms where contract_id = p_contract_id;

  insert into public.custom_key_terms (contract_id, user_id, term_name)
  select p_contract_id, auth.uid(), btrim(t)
    from unnest(coalesce(p_terms, '{}'::text[])) as t;

  return query
    select * from public.custom_key_terms
     where contract_id = p_contract_id
     order by created_at, term_name;
end;
$$;

-- 7.2 Inline edit preserving the AI's original value (S9)
create or replace function public.edit_key_term(p_id uuid, p_value text)
returns public.key_terms
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r public.key_terms;
begin
  update public.key_terms
     set original_value = case when is_edited then original_value else value end,
         value          = p_value,
         is_edited      = true,
         edited_at      = now()
   where id = p_id
     and value is distinct from p_value
  returning * into r;

  if r.id is null then
    select * into r from public.key_terms where id = p_id;
  end if;

  if r.id is null then
    raise exception 'key_term_not_found' using errcode = 'P0002';
  end if;

  return r;
end;
$$;

-- 7.3 Get-or-create the chat session for a contract (S10)
create or replace function public.get_or_create_chat_session(p_contract_id uuid)
returns public.chat_sessions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r public.chat_sessions;
begin
  select * into r from public.chat_sessions where contract_id = p_contract_id;
  if r.id is not null then
    return r;
  end if;

  insert into public.chat_sessions (contract_id, user_id)
  values (p_contract_id, auth.uid())
  on conflict (contract_id) do nothing
  returning * into r;

  if r.id is null then
    select * into r from public.chat_sessions where contract_id = p_contract_id;
  end if;

  if r.id is null then
    raise exception 'contract_not_found' using errcode = 'P0002';
  end if;

  return r;
end;
$$;

-- 7.4 Dashboard counters (S11)
create or replace function public.get_dashboard_stats()
returns table (total bigint, nda bigint, msa bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)                                          as total,
         count(*) filter (where contract_type = 'nda')     as nda,
         count(*) filter (where contract_type = 'msa')     as msa
    from public.contracts
   where user_id = auth.uid();
$$;

-- 7.5 Count a successful analysis (future quota hook)
create or replace function public.increment_analyses_count()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles set analyses_count = analyses_count + 1 where id = auth.uid();
$$;


-- ---------------------------------------------------------------------
-- 8. Views
-- ---------------------------------------------------------------------
create or replace view public.term_corrections
with (security_invoker = true) as
select kt.id,
       kt.contract_id,
       kt.user_id,
       c.contract_type,
       kt.term_key,
       kt.term_name,
       kt.is_custom,
       kt.original_value,
       kt.value as corrected_value,
       kt.confidence_score,
       kt.edited_at
  from public.key_terms kt
  join public.contracts c on c.id = kt.contract_id
 where kt.is_edited;


-- ---------------------------------------------------------------------
-- 9. Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.contracts        enable row level security;
alter table public.custom_key_terms enable row level security;
alter table public.key_terms        enable row level security;
alter table public.chat_sessions    enable row level security;
alter table public.chat_messages    enable row level security;
alter table public.user_feedback    enable row level security;
alter table public.llm_usage        enable row level security;
alter table public.rate_limit_events enable row level security;

-- profiles: read/update own; rows are created by trigger only
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- contracts: full CRUD on own rows
drop policy if exists contracts_select_own on public.contracts;
create policy contracts_select_own on public.contracts
  for select to authenticated using (user_id = (select auth.uid()));

-- contracts are created and updated only by the server (service role) after validation,
-- so clients cannot write contract_text, token counts, status or file paths directly.
drop policy if exists contracts_insert_own on public.contracts;
drop policy if exists contracts_update_own on public.contracts;

drop policy if exists contracts_delete_own on public.contracts;
create policy contracts_delete_own on public.contracts
  for delete to authenticated using (user_id = (select auth.uid()));

-- custom_key_terms: own rows; inserts must target an own contract
drop policy if exists custom_key_terms_select_own on public.custom_key_terms;
create policy custom_key_terms_select_own on public.custom_key_terms
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists custom_key_terms_insert_own on public.custom_key_terms;
create policy custom_key_terms_insert_own on public.custom_key_terms
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.contracts c where c.id = contract_id and c.user_id = (select auth.uid()))
  );

drop policy if exists custom_key_terms_delete_own on public.custom_key_terms;
create policy custom_key_terms_delete_own on public.custom_key_terms
  for delete to authenticated using (user_id = (select auth.uid()));

-- key_terms: own rows; inserts must target an own contract
drop policy if exists key_terms_select_own on public.key_terms;
create policy key_terms_select_own on public.key_terms
  for select to authenticated using (user_id = (select auth.uid()));

-- extracted terms are written only by the server (service role); clients may edit values via edit_key_term()
drop policy if exists key_terms_insert_own on public.key_terms;

drop policy if exists key_terms_update_own on public.key_terms;
create policy key_terms_update_own on public.key_terms
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists key_terms_delete_own on public.key_terms;

-- chat_sessions: own rows; inserts must target an own contract
drop policy if exists chat_sessions_select_own on public.chat_sessions;
create policy chat_sessions_select_own on public.chat_sessions
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists chat_sessions_insert_own on public.chat_sessions;
create policy chat_sessions_insert_own on public.chat_sessions
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.contracts c where c.id = contract_id and c.user_id = (select auth.uid()))
  );

drop policy if exists chat_sessions_update_own on public.chat_sessions;
create policy chat_sessions_update_own on public.chat_sessions
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists chat_sessions_delete_own on public.chat_sessions;
create policy chat_sessions_delete_own on public.chat_sessions
  for delete to authenticated using (user_id = (select auth.uid()));

-- chat_messages: own rows; inserts must target an own session
drop policy if exists chat_messages_select_own on public.chat_messages;
create policy chat_messages_select_own on public.chat_messages
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists chat_messages_insert_own on public.chat_messages;
create policy chat_messages_insert_own on public.chat_messages
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and role = 'user'          -- assistant messages are written only by the server
    and exists (select 1 from public.chat_sessions s where s.id = session_id and s.user_id = (select auth.uid()))
  );

drop policy if exists chat_messages_delete_own on public.chat_messages;
create policy chat_messages_delete_own on public.chat_messages
  for delete to authenticated using (user_id = (select auth.uid()));

-- user_feedback: own rows; inserts must target an own contract
drop policy if exists user_feedback_select_own on public.user_feedback;
create policy user_feedback_select_own on public.user_feedback
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists user_feedback_insert_own on public.user_feedback;
create policy user_feedback_insert_own on public.user_feedback
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.contracts c where c.id = contract_id and c.user_id = (select auth.uid()))
  );

drop policy if exists user_feedback_update_own on public.user_feedback;
create policy user_feedback_update_own on public.user_feedback
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists user_feedback_delete_own on public.user_feedback;
create policy user_feedback_delete_own on public.user_feedback
  for delete to authenticated using (user_id = (select auth.uid()));

-- llm_usage: users may read their own usage; writes only via the service role (bypasses RLS)
drop policy if exists llm_usage_select_own on public.llm_usage;
create policy llm_usage_select_own on public.llm_usage
  for select to authenticated using (user_id = (select auth.uid()));

-- rate_limit_events: no client policies (RLS on, no policies = no direct access); service role only.


-- ---------------------------------------------------------------------
-- 10. Privileges (explicit least-privilege grants; RLS still applies)
--     Newer Supabase projects do NOT auto-grant table privileges to the
--     API roles, so every privilege the app needs is granted here, and
--     everything else is revoked first so the result is the same on
--     old and new projects.
-- ---------------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;

-- Start from nothing for the client roles
revoke all on public.profiles, public.contracts, public.custom_key_terms, public.key_terms,
              public.chat_sessions, public.chat_messages, public.user_feedback,
              public.llm_usage, public.rate_limit_events, public.term_corrections
  from anon, authenticated;

-- Service role (server-side only: usage logging, scheduled jobs, health check)
grant all on public.profiles, public.contracts, public.custom_key_terms, public.key_terms,
             public.chat_sessions, public.chat_messages, public.user_feedback,
             public.llm_usage, public.rate_limit_events
  to service_role;
grant select on public.term_corrections to service_role;

-- profiles: read own; update only these columns (never analyses_count)
grant select on public.profiles to authenticated;
grant update (full_name, onboarding_completed_at) on public.profiles to authenticated;

-- contracts: read and delete own rows; inserts/updates happen server-side only
grant select, delete on public.contracts to authenticated;

-- custom_key_terms: replaced via delete + insert
grant select, insert, delete on public.custom_key_terms to authenticated;

-- key_terms: read own; only the editable columns can change (via edit_key_term)
grant select on public.key_terms to authenticated;
grant update (value, original_value, is_edited, edited_at) on public.key_terms to authenticated;

-- chat
grant select, insert, update, delete on public.chat_sessions to authenticated;
grant select, insert, delete on public.chat_messages to authenticated;

-- feedback (upsert = insert + update)
grant select, insert, update, delete on public.user_feedback to authenticated;

-- llm_usage: read own only; writes via the service role
grant select on public.llm_usage to authenticated;

-- term_corrections view (security_invoker → RLS of key_terms applies)
grant select on public.term_corrections to authenticated;

-- rate_limit_events: no client privileges (service role only)

-- Functions: callable by signed-in users only
revoke execute on function public.replace_custom_terms(uuid, text[])            from public, anon;
revoke execute on function public.edit_key_term(uuid, text)                     from public, anon;
revoke execute on function public.get_or_create_chat_session(uuid)              from public, anon;
revoke execute on function public.get_dashboard_stats()                         from public, anon;
revoke execute on function public.increment_analyses_count()                    from public, anon;
grant  execute on function public.replace_custom_terms(uuid, text[])            to authenticated;
grant  execute on function public.edit_key_term(uuid, text)                     to authenticated;
grant  execute on function public.get_or_create_chat_session(uuid)              to authenticated;
grant  execute on function public.get_dashboard_stats()                         to authenticated;
grant  execute on function public.increment_analyses_count()                    to authenticated;

-- Trigger functions are never called directly
revoke execute on function public.handle_new_user()            from public, anon, authenticated;
revoke execute on function public.bump_chat_session()          from public, anon, authenticated;
revoke execute on function public.enforce_custom_term_limit()  from public, anon;


-- ---------------------------------------------------------------------
-- 11. Storage: private `contracts` bucket + folder-scoped policies
--     Object path inside the bucket: {user_id}/{contract_id}/{filename}.pdf
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contracts', 'contracts', false, 10485760, array['application/pdf'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists contracts_storage_insert_own on storage.objects;
create policy contracts_storage_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'contracts' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists contracts_storage_select_own on storage.objects;
create policy contracts_storage_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'contracts' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists contracts_storage_delete_own on storage.objects;
create policy contracts_storage_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'contracts' and (storage.foldername(name))[1] = (select auth.uid())::text);


-- ---------------------------------------------------------------------
-- 12. Documentation (visible in Supabase Studio and generated types)
-- ---------------------------------------------------------------------
comment on table public.profiles is 'App-level user profile, 1:1 with auth.users; created by trigger on sign-up.';
comment on column public.profiles.analyses_count is 'Successful extractions; future quota hook. Not client-writable.';

comment on table public.contracts is 'One uploaded NDA/MSA and its extracted text (single source of truth for AI grounding).';
comment on column public.contracts.contract_text is 'Full text with [PAGE N] markers, extracted once at upload.';
comment on column public.contracts.file_path is 'Object path in the contracts bucket ({user_id}/{contract_id}/{slug}.pdf); NULL if storage failed or the PDF was purged after 90 idle days.';
comment on column public.contracts.token_count is 'GPT-4o (o200k_base) token count of contract_text; max 15,000.';
comment on column public.contracts.last_accessed_at is 'Drives 90-day PDF retention.';
comment on column public.contracts.review_completed_at is 'North Star metric: set when the user marks the review complete.';

comment on table public.custom_key_terms is 'Up to 5 user-defined terms requested before processing (FR-05).';
comment on table public.key_terms is 'Extracted terms (standard and custom) with value, page, confidence and verbatim source sentence.';
comment on column public.key_terms.original_value is 'AI value captured on the first user edit (feedback loop).';
comment on column public.key_terms.source_verified is 'True when source_sentence was found in contract_text by server-side verification.';
comment on column public.key_terms.confidence_score is '0-100. Capped at 49 when the source sentence could not be verified. Not client-writable.';

comment on table public.chat_sessions is 'One persistent chat conversation per contract (US-012).';
comment on table public.chat_messages is 'Every chat turn with role, content, cited pages and timestamp (FR-09).';
comment on table public.user_feedback is 'Thumbs up/down + optional comment, one per user per contract (FR-12).';
comment on table public.llm_usage is 'Token/cost/latency telemetry per OpenAI call. Written only with the service role. Never contains contract or chat text.';
comment on table public.rate_limit_events is 'Sliding-window rate-limit events (per user, or per hashed IP for auth). Service role only.';
comment on view public.term_corrections is 'Edited key terms with original and corrected values (correction-rate metric). security_invoker: RLS applies.';

comment on function public.replace_custom_terms(uuid, text[]) is 'Atomically replaces a contract''s custom terms (max 5).';
comment on function public.edit_key_term(uuid, text) is 'Inline edit that preserves the first AI value in original_value.';
comment on function public.get_or_create_chat_session(uuid) is 'Race-safe get-or-create of the chat session for a contract.';
comment on function public.get_dashboard_stats() is 'Total / NDA / MSA contract counts for the current user.';
comment on function public.increment_analyses_count() is 'Increments the caller''s analyses_count after a successful extraction.';


-- ---------------------------------------------------------------------
-- 13. Self-check — aborts (and rolls back) the whole script on failure
-- ---------------------------------------------------------------------
do $$
declare
  t           text;
  app_tables  text[] := array['profiles','contracts','custom_key_terms','key_terms','chat_sessions',
                              'chat_messages','user_feedback','llm_usage','rate_limit_events'];
  problems    text[] := '{}';
begin
  foreach t in array app_tables loop
    if not exists (select 1 from pg_tables where schemaname = 'public' and tablename = t and rowsecurity) then
      problems := problems || format('RLS not enabled on public.%s', t);
    end if;
    if not has_table_privilege('service_role', format('public.%I', t), 'select') then
      problems := problems || format('service_role cannot select public.%s', t);
    end if;
    if has_table_privilege('anon', format('public.%I', t), 'select') then
      problems := problems || format('anon can select public.%s', t);
    end if;
  end loop;

  if not has_table_privilege('authenticated', 'public.contracts', 'select, delete') then
    problems := problems || 'authenticated cannot read/delete own contracts'::text;
  end if;
  if not has_column_privilege('authenticated', 'public.key_terms', 'value', 'update') then
    problems := problems || 'authenticated cannot update key_terms.value'::text;
  end if;
  if has_column_privilege('authenticated', 'public.key_terms', 'confidence_score', 'update') then
    problems := problems || 'authenticated can update key_terms.confidence_score'::text;
  end if;
  if has_column_privilege('authenticated', 'public.profiles', 'analyses_count', 'update') then
    problems := problems || 'authenticated can update profiles.analyses_count'::text;
  end if;
  if has_table_privilege('authenticated', 'public.rate_limit_events', 'select') then
    problems := problems || 'authenticated can read public.rate_limit_events'::text;
  end if;
  if has_table_privilege('authenticated', 'public.contracts', 'insert')
     or has_column_privilege('authenticated', 'public.contracts', 'contract_text', 'update')
     or has_column_privilege('authenticated', 'public.contracts', 'file_path', 'update') then
    problems := problems || 'authenticated can write server-controlled contract columns'::text;
  end if;
  if has_table_privilege('authenticated', 'public.key_terms', 'insert') then
    problems := problems || 'authenticated can insert key_terms'::text;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contracts_file_path_owner') then
    problems := problems || 'contracts_file_path_owner constraint missing'::text;
  end if;
  if has_function_privilege('anon', 'public.get_dashboard_stats()', 'execute') then
    problems := problems || 'anon can execute get_dashboard_stats()'::text;
  end if;

  if not exists (select 1 from storage.buckets where id = 'contracts' and public = false) then
    problems := problems || 'private storage bucket "contracts" missing'::text;
  end if;
  if (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
        and policyname like 'contracts_storage_%_own') <> 3 then
    problems := problems || 'expected 3 storage policies on storage.objects'::text;
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'on_auth_user_created') then
    problems := problems || 'auth.users trigger on_auth_user_created missing'::text;
  end if;

  if array_length(problems, 1) > 0 then
    raise exception 'ContractIQ database self-check failed: %', array_to_string(problems, '; ');
  end if;
  raise notice 'ContractIQ database self-check passed.';
end;
$$;

commit;
