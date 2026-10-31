-- OnboardOS on Supabase: one database for the workflow (dashboard stand-in today, Aditi's
-- durable actor next), Onboardy's conversations, and the admin's decisions.
--
-- Access: row-level security is ON with no policies, so the public REST API (anon or
-- publishable key) can read and write nothing. Servers connect to Postgres directly
-- (SUPABASE_DB_URL) and are the only writers.

create schema if not exists onboardos;

-- 1. Onboardings: the authoritative snapshot (shared/contract.ts `Onboarding`) plus the
--    runtime the workflow needs to resume after a restart (pending steps, SLA clocks).
create table if not exists onboardos.onboardings (
  id          text primary key,
  company     text not null,
  status      text not null check (status in ('in_progress', 'awaiting_review', 'revising', 'launch_ready')),
  snapshot    jsonb not null,               -- the Onboarding object served by GET /api/onboardings/:id
  runtime     jsonb not null default '{}',  -- pending steps, awaiting-since times, overdue flags
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists onboardings_created on onboardos.onboardings (created_at desc);

-- 2. Events: append-only history. seq is strictly increasing per onboarding.
create table if not exists onboardos.events (
  onboarding_id text not null references onboardos.onboardings (id) on delete cascade,
  seq           int  not null,
  id            uuid not null unique,
  at            timestamptz not null,
  type          text not null,
  actor         text not null,
  message       text not null,
  task_id       text,
  document_id   text,
  version       int,
  thread_id     text,
  to_actor      text,
  transport     text check (transport in ('agent_relay', 'simulated')),
  operation_id  text,
  primary key (onboarding_id, seq)
);
create or replace function onboardos.no_event_changes() returns trigger language plpgsql as $$
begin
  raise exception 'events are append-only';
end $$;
drop trigger if exists events_append_only on onboardos.events;
create trigger events_append_only before update or delete on onboardos.events
  for each row when (pg_trigger_depth() = 0 and current_setting('onboardos.allow_delete', true) is distinct from 'on')
  execute function onboardos.no_event_changes();

-- 3. Approvals: one row per human decision, always about one document version.
--    operation_id is unique: the same click can never record two decisions.
create table if not exists onboardos.approvals (
  id            uuid primary key,
  onboarding_id text not null references onboardos.onboardings (id) on delete cascade,
  document_id   text not null check (document_id in ('accounting_configuration', 'ledger_mapping')),
  version       int  not null check (version > 0),
  decision      text not null check (decision in ('approved', 'rejected')),
  comment       text,
  reviewer      text not null,
  at            timestamptz not null,
  operation_id  text not null unique
);
create index if not exists approvals_doc on onboardos.approvals (onboarding_id, document_id, version);

-- 4. Onboardy (ChatKit) conversations, per admin.
create table if not exists onboardos.chat_threads (
  id          text primary key,
  owner       text not null,
  created_at  timestamptz not null,
  data        jsonb not null
);
create index if not exists chat_threads_owner on onboardos.chat_threads (owner, created_at desc);

create table if not exists onboardos.chat_items (
  id          text primary key,
  thread_id   text not null references onboardos.chat_threads (id) on delete cascade,
  owner       text not null,
  created_at  timestamptz not null,
  ord         bigserial,
  data        jsonb not null
);
create index if not exists chat_items_thread on onboardos.chat_items (thread_id, created_at, ord);

create table if not exists onboardos.chat_attachments (
  id    text primary key,
  owner text not null,
  data  jsonb not null
);

-- Locked to the public API: RLS on, no policies, no grants to anon/authenticated.
alter table onboardos.onboardings      enable row level security;
alter table onboardos.events           enable row level security;
alter table onboardos.approvals        enable row level security;
alter table onboardos.chat_threads     enable row level security;
alter table onboardos.chat_items       enable row level security;
alter table onboardos.chat_attachments enable row level security;
revoke all on schema onboardos from anon, authenticated;
revoke all on all tables in schema onboardos from anon, authenticated;
