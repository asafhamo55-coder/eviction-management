-- Eviction Management System — initial schema (isolated in `eviction_management` schema)
--
-- This migration is designed to coexist with HOA and Property Management
-- modules already living in `public`. It does NOT touch `public` at all.
-- All EMS objects live in the `eviction_management` schema.

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

create schema if not exists eviction_management;
grant usage on schema eviction_management to anon, authenticated, service_role;
alter default privileges in schema eviction_management grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema eviction_management grant all on functions to anon, authenticated, service_role;
alter default privileges in schema eviction_management grant all on sequences to anon, authenticated, service_role;

-- =====================================================================
-- Enums (namespaced inside eviction_management)
-- =====================================================================
create type eviction_management.org_plan as enum ('free', 'per_case', 'pro');
create type eviction_management.user_role as enum ('owner', 'manager', 'viewer');
create type eviction_management.case_status as enum (
  'DRAFT','INTAKE_COMPLETE','NOTICE_REQUIRED','NOTICE_SERVED','CURE_PERIOD',
  'TENANT_CURED','TENANT_VACATED','CURE_EXPIRED','FILING_REQUIRED','FILED',
  'SUMMONS_ISSUED','SERVICE_REQUIRED','SERVED','SERVICE_FAILED',
  'ALTERNATE_SERVICE_PENDING','AWAITING_RESPONSE','TENANT_ANSWERED',
  'DEFAULT_AVAILABLE','HEARING_SCHEDULED','HEARING_HELD',
  'JUDGMENT_FOR_LANDLORD','JUDGMENT_FOR_TENANT','SETTLEMENT',
  'WRIT_REQUESTED','WRIT_ISSUED','LOCKOUT_SCHEDULED','LOCKOUT_COMPLETE',
  'POST_EVICTION','CLOSED_RESOLVED','CLOSED_WRITTEN_OFF',
  'ATTORNEY_REQUIRED','ATTORNEY_ENGAGED'
);
create type eviction_management.grounds as enum (
  'NON_PAYMENT','LEASE_VIOLATION_CURABLE','LEASE_VIOLATION_NON_CURABLE',
  'HOLDOVER','NUISANCE_ILLEGAL','NO_CAUSE'
);
create type eviction_management.tenancy_type as enum (
  'WRITTEN_LEASE','ORAL_LEASE','M2M','WEEK_TO_WEEK','AT_WILL',
  'SUBSIDIZED','MOBILE_HOME_PARK'
);
create type eviction_management.property_type as enum ('SFR','CONDO','SMALL_MULTI','LARGE_MULTI');
create type eviction_management.rule_type as enum (
  'NOTICE_PERIOD','FILING_FORM','COURT_VENUE','FEE','SERVICE_METHOD',
  'WRIT_WAIT','RELOCATION_ASSIST','ALLOWED_GROUNDS_OVERLAY','ANSWER_PERIOD'
);
create type eviction_management.service_method as enum (
  'PERSONAL','SUBSTITUTE_AND_MAIL','POST_AND_MAIL','CERTIFIED_MAIL','EMAIL'
);
create type eviction_management.document_type as enum (
  'NOTICE','COMPLAINT','SUMMONS','AFFIDAVIT_OF_SERVICE','JUDGMENT',
  'WRIT_OF_POSSESSION','SETTLEMENT','ENGAGEMENT_LETTER','OTHER'
);
create type eviction_management.case_event_actor as enum ('LANDLORD','TENANT','SYSTEM','ATTORNEY','COURT');
create type eviction_management.comm_channel as enum ('EMAIL','SMS','PORTAL','MAIL','IN_PERSON');
create type eviction_management.comm_direction as enum ('INBOUND','OUTBOUND');

-- =====================================================================
-- Helpers
-- =====================================================================
create or replace function eviction_management.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- =====================================================================
-- Organizations & profiles
-- EMS keeps its own org/profile records so it works fully standalone.
-- A user signed in via Supabase Auth gets an EMS org + profile created
-- on first visit by calling eviction_management.ensure_profile().
-- =====================================================================
create table eviction_management.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  plan        eviction_management.org_plan not null default 'free',
  billing_customer_id text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_orgs_updated before update on eviction_management.organizations
  for each row execute function eviction_management.touch_updated_at();

create table eviction_management.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  org_id      uuid references eviction_management.organizations(id) on delete set null,
  role        eviction_management.user_role not null default 'owner',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on eviction_management.profiles (org_id);
create trigger trg_profiles_updated before update on eviction_management.profiles
  for each row execute function eviction_management.touch_updated_at();

-- Idempotent bootstrap: call from the EMS app on first login.
-- Returns the user's EMS org_id (creating one if needed).
create or replace function eviction_management.ensure_profile(p_org_name text default null)
returns uuid
language plpgsql security definer set search_path = eviction_management, public, auth as $$
declare
  v_user_id uuid := auth.uid();
  v_email   text;
  v_org_id  uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  select org_id into v_org_id from eviction_management.profiles where id = v_user_id;
  if v_org_id is not null then return v_org_id; end if;

  select email into v_email from auth.users where id = v_user_id;

  insert into eviction_management.organizations (name)
    values (coalesce(p_org_name, 'My Organization'))
    returning id into v_org_id;

  insert into eviction_management.profiles (id, email, full_name, org_id, role)
    values (v_user_id, v_email, null, v_org_id, 'owner')
    on conflict (id) do update
      set org_id = excluded.org_id,
          email  = excluded.email
    returning org_id into v_org_id;

  return v_org_id;
end $$;
grant execute on function eviction_management.ensure_profile(text) to authenticated;

create or replace function eviction_management.current_org_id() returns uuid
language sql stable security definer set search_path = eviction_management, auth as $$
  select org_id from eviction_management.profiles where id = auth.uid()
$$;
grant execute on function eviction_management.current_org_id() to authenticated;

-- =====================================================================
-- Properties / leases / renters
-- (We use `renters` instead of `tenants` to avoid confusion with the
-- platform's existing public.tenants org/SaaS-tenant table.)
-- =====================================================================
create table eviction_management.properties (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references eviction_management.organizations(id) on delete cascade,
  address_line1 text not null,
  address_line2 text,
  city        text not null,
  state       text not null,
  postal_code text not null,
  county      text,
  jurisdiction_code text,
  property_type eviction_management.property_type not null default 'SFR',
  rent_control_flag boolean not null default false,
  federal_funding_flag boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on eviction_management.properties (org_id);
create trigger trg_properties_updated before update on eviction_management.properties
  for each row execute function eviction_management.touch_updated_at();

create table eviction_management.renters (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references eviction_management.organizations(id) on delete cascade,
  full_name   text not null,
  email       text,
  phone       text,
  scra_status text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on eviction_management.renters (org_id);
create trigger trg_renters_updated before update on eviction_management.renters
  for each row execute function eviction_management.touch_updated_at();

create table eviction_management.leases (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references eviction_management.organizations(id) on delete cascade,
  property_id uuid not null references eviction_management.properties(id) on delete restrict,
  tenancy_type eviction_management.tenancy_type not null default 'WRITTEN_LEASE',
  start_date  date not null,
  end_date    date,
  rent_amount_cents integer not null default 0,
  rent_due_day smallint not null default 1,
  terms       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on eviction_management.leases (org_id);
create index on eviction_management.leases (property_id);
create trigger trg_leases_updated before update on eviction_management.leases
  for each row execute function eviction_management.touch_updated_at();

create table eviction_management.lease_renters (
  lease_id  uuid not null references eviction_management.leases(id) on delete cascade,
  renter_id uuid not null references eviction_management.renters(id) on delete cascade,
  primary key (lease_id, renter_id)
);

-- =====================================================================
-- Cases
-- =====================================================================
create table eviction_management.cases (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references eviction_management.organizations(id) on delete cascade,
  lease_id    uuid not null references eviction_management.leases(id) on delete restrict,
  status      eviction_management.case_status not null default 'DRAFT',
  grounds     eviction_management.grounds not null,
  jurisdiction_code text not null,
  opened_at   timestamptz not null default now(),
  resolved_at timestamptz,
  attorney_id uuid,
  flags       jsonb not null default '[]'::jsonb,
  computed    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on eviction_management.cases (org_id, status);
create index on eviction_management.cases (lease_id);
create trigger trg_cases_updated before update on eviction_management.cases
  for each row execute function eviction_management.touch_updated_at();

create table eviction_management.case_events (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references eviction_management.cases(id) on delete cascade,
  type        text not null,
  actor_type  eviction_management.case_event_actor not null,
  actor_id    uuid,
  payload     jsonb not null default '{}'::jsonb,
  prev_state  eviction_management.case_status,
  next_state  eviction_management.case_status,
  created_at  timestamptz not null default now()
);
create index on eviction_management.case_events (case_id, created_at desc);

create or replace function eviction_management.case_events_no_mutate() returns trigger
language plpgsql as $$
begin raise exception 'eviction_management.case_events is append-only'; end $$;
create trigger case_events_no_update
  before update or delete on eviction_management.case_events
  for each row execute function eviction_management.case_events_no_mutate();

-- =====================================================================
-- Jurisdictional rules
-- =====================================================================
create table eviction_management.jurisdiction_rules (
  id              uuid primary key default gen_random_uuid(),
  jurisdiction_code text not null,
  rule_type       eviction_management.rule_type not null,
  grounds         eviction_management.grounds[] not null default '{}',
  tenancy_types   eviction_management.tenancy_type[] not null default '{}',
  payload         jsonb not null,
  statute_citation text,
  effective_from  date not null default current_date,
  effective_to    date,
  source_url      text,
  verified_by     text,
  verified_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index on eviction_management.jurisdiction_rules (jurisdiction_code, rule_type, effective_from desc);

-- =====================================================================
-- Templates / documents / notices / filings / hearings
-- =====================================================================
create table eviction_management.form_templates (
  id          uuid primary key default gen_random_uuid(),
  jurisdiction_code text not null,
  type        eviction_management.document_type not null,
  version     text not null,
  fields_schema jsonb not null default '{}'::jsonb,
  body        text not null,
  attorney_signoff text,
  signoff_at  timestamptz,
  effective_from date not null default current_date,
  effective_to date,
  unique (jurisdiction_code, type, version)
);

create table eviction_management.documents (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references eviction_management.organizations(id) on delete cascade,
  case_id     uuid references eviction_management.cases(id) on delete cascade,
  type        eviction_management.document_type not null,
  storage_key text,
  hash_sha256 text,
  signed_by   jsonb not null default '[]'::jsonb,
  generated_from_template uuid references eviction_management.form_templates(id),
  created_at  timestamptz not null default now()
);
create index on eviction_management.documents (case_id);

create table eviction_management.notices (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references eviction_management.cases(id) on delete cascade,
  type        text not null,
  served_at   timestamptz,
  service_method eviction_management.service_method,
  served_by   uuid,
  evidence_doc_id uuid references eviction_management.documents(id),
  computed_expires_at timestamptz,
  created_at  timestamptz not null default now()
);
create index on eviction_management.notices (case_id);

create table eviction_management.filings (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references eviction_management.cases(id) on delete cascade,
  court_name  text,
  filed_at    timestamptz,
  external_filing_id text,
  status      text,
  fee_cents   integer,
  document_id uuid references eviction_management.documents(id),
  created_at  timestamptz not null default now()
);
create index on eviction_management.filings (case_id);

create table eviction_management.hearings (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references eviction_management.cases(id) on delete cascade,
  court_name  text,
  scheduled_at timestamptz,
  type        text,
  outcome     text,
  notes       text,
  created_at  timestamptz not null default now()
);
create index on eviction_management.hearings (case_id);

-- =====================================================================
-- Ledger / payments
-- =====================================================================
create table eviction_management.ledger_entries (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references eviction_management.organizations(id) on delete cascade,
  lease_id    uuid not null references eviction_management.leases(id) on delete cascade,
  case_id     uuid references eviction_management.cases(id) on delete set null,
  posted_at   timestamptz not null default now(),
  debit_cents integer not null default 0,
  credit_cents integer not null default 0,
  memo        text
);
create index on eviction_management.ledger_entries (lease_id, posted_at desc);

create table eviction_management.payments (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references eviction_management.organizations(id) on delete cascade,
  case_id     uuid references eviction_management.cases(id) on delete set null,
  amount_cents integer not null,
  type        text not null,
  source      text,
  stripe_intent_id text,
  status      text not null default 'pending',
  created_at  timestamptz not null default now()
);
create index on eviction_management.payments (case_id);

-- =====================================================================
-- Evidence / communications / tasks
-- =====================================================================
create table eviction_management.evidence (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references eviction_management.organizations(id) on delete cascade,
  case_id     uuid not null references eviction_management.cases(id) on delete cascade,
  type        text not null,
  captured_at timestamptz,
  geotag      jsonb,
  hash_sha256 text,
  storage_key text,
  description text,
  created_at  timestamptz not null default now()
);
create index on eviction_management.evidence (case_id);

create table eviction_management.communications (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references eviction_management.organizations(id) on delete cascade,
  case_id     uuid not null references eviction_management.cases(id) on delete cascade,
  channel     eviction_management.comm_channel not null,
  direction   eviction_management.comm_direction not null,
  subject     text,
  body        text,
  attachments jsonb not null default '[]'::jsonb,
  delivered_at timestamptz,
  created_at  timestamptz not null default now()
);
create index on eviction_management.communications (case_id, created_at desc);

create table eviction_management.tasks (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references eviction_management.organizations(id) on delete cascade,
  case_id     uuid references eviction_management.cases(id) on delete cascade,
  assignee_id uuid references eviction_management.profiles(id) on delete set null,
  type        text not null,
  title       text not null,
  due_at      timestamptz,
  status      text not null default 'open',
  blocking_state eviction_management.case_status,
  created_at  timestamptz not null default now()
);
create index on eviction_management.tasks (assignee_id, status, due_at);

-- =====================================================================
-- Attorneys / engagements
-- =====================================================================
create table eviction_management.attorneys (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  email       text,
  bar_id      text,
  jurisdictions text[] not null default '{}',
  practice_areas text[] not null default '{}',
  rates       jsonb not null default '{}'::jsonb,
  rating      numeric(3,2),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table eviction_management.engagements (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references eviction_management.organizations(id) on delete cascade,
  case_id     uuid not null references eviction_management.cases(id) on delete cascade,
  attorney_id uuid not null references eviction_management.attorneys(id) on delete restrict,
  scope       text not null,
  fee_arrangement jsonb not null default '{}'::jsonb,
  status      text not null default 'pending',
  created_at  timestamptz not null default now()
);

-- =====================================================================
-- Row-Level Security
-- =====================================================================
alter table eviction_management.organizations    enable row level security;
alter table eviction_management.profiles         enable row level security;
alter table eviction_management.properties       enable row level security;
alter table eviction_management.renters          enable row level security;
alter table eviction_management.leases           enable row level security;
alter table eviction_management.lease_renters    enable row level security;
alter table eviction_management.cases            enable row level security;
alter table eviction_management.case_events      enable row level security;
alter table eviction_management.documents        enable row level security;
alter table eviction_management.notices          enable row level security;
alter table eviction_management.filings          enable row level security;
alter table eviction_management.hearings         enable row level security;
alter table eviction_management.ledger_entries   enable row level security;
alter table eviction_management.payments         enable row level security;
alter table eviction_management.evidence         enable row level security;
alter table eviction_management.communications   enable row level security;
alter table eviction_management.tasks            enable row level security;
alter table eviction_management.engagements      enable row level security;
alter table eviction_management.jurisdiction_rules enable row level security;
alter table eviction_management.form_templates     enable row level security;
alter table eviction_management.attorneys          enable row level security;

create policy "rules readable by all authenticated"
  on eviction_management.jurisdiction_rules for select to authenticated using (true);
create policy "templates readable by all authenticated"
  on eviction_management.form_templates for select to authenticated using (true);
create policy "attorneys readable by all authenticated"
  on eviction_management.attorneys for select to authenticated using (active);

create policy "own org" on eviction_management.organizations
  for select using (id = eviction_management.current_org_id());

create policy "own profile read"  on eviction_management.profiles
  for select using (id = auth.uid() or org_id = eviction_management.current_org_id());
create policy "own profile update" on eviction_management.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  for t in select unnest(array[
    'properties','renters','leases','cases','documents','evidence',
    'communications','tasks','engagements','ledger_entries','payments'
  ]) loop
    execute format($f$
      create policy "%I_select" on eviction_management.%I
        for select using (org_id = eviction_management.current_org_id());
      create policy "%I_insert" on eviction_management.%I
        for insert with check (org_id = eviction_management.current_org_id());
      create policy "%I_update" on eviction_management.%I
        for update using (org_id = eviction_management.current_org_id())
        with check (org_id = eviction_management.current_org_id());
      create policy "%I_delete" on eviction_management.%I
        for delete using (org_id = eviction_management.current_org_id());
    $f$, t, t, t, t, t, t, t, t);
  end loop;
end $$;

create policy "lease_renters_via_lease" on eviction_management.lease_renters
  for all using (
    exists (select 1 from eviction_management.leases l
            where l.id = lease_id and l.org_id = eviction_management.current_org_id())
  ) with check (
    exists (select 1 from eviction_management.leases l
            where l.id = lease_id and l.org_id = eviction_management.current_org_id())
  );

create policy "case_events_select" on eviction_management.case_events
  for select using (
    exists (select 1 from eviction_management.cases c
            where c.id = case_id and c.org_id = eviction_management.current_org_id())
  );
create policy "case_events_insert" on eviction_management.case_events
  for insert with check (
    exists (select 1 from eviction_management.cases c
            where c.id = case_id and c.org_id = eviction_management.current_org_id())
  );

create policy "notices_via_case" on eviction_management.notices
  for all using (
    exists (select 1 from eviction_management.cases c
            where c.id = case_id and c.org_id = eviction_management.current_org_id())
  ) with check (
    exists (select 1 from eviction_management.cases c
            where c.id = case_id and c.org_id = eviction_management.current_org_id())
  );

create policy "filings_via_case" on eviction_management.filings
  for all using (
    exists (select 1 from eviction_management.cases c
            where c.id = case_id and c.org_id = eviction_management.current_org_id())
  ) with check (
    exists (select 1 from eviction_management.cases c
            where c.id = case_id and c.org_id = eviction_management.current_org_id())
  );

create policy "hearings_via_case" on eviction_management.hearings
  for all using (
    exists (select 1 from eviction_management.cases c
            where c.id = case_id and c.org_id = eviction_management.current_org_id())
  ) with check (
    exists (select 1 from eviction_management.cases c
            where c.id = case_id and c.org_id = eviction_management.current_org_id())
  );

-- =====================================================================
-- Identity labels: every EMS object is tagged so it is unmistakably
-- part of the Eviction Management module in any DB browsing tool.
-- =====================================================================
comment on schema eviction_management is
  'Eviction Management module (EMS) — standalone product. All tables, types, functions, and policies in this schema belong to the eviction-management application and are isolated from HOA, Property Management, and other modules.';

do $tag$
declare obj record;
begin
  for obj in
    select c.relname as name,
           case c.relkind when 'r' then 'table' when 'v' then 'view' when 'm' then 'materialized view' end as kind
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'eviction_management' and c.relkind in ('r','v','m')
  loop
    execute format('comment on %s eviction_management.%I is %L',
                   obj.kind, obj.name,
                   'EMS (Eviction Management) — ' || obj.name);
  end loop;
end $tag$;

comment on function eviction_management.ensure_profile(text) is
  'EMS (Eviction Management) — idempotently bootstraps an org + profile for the current user.';
comment on function eviction_management.current_org_id() is
  'EMS (Eviction Management) — returns the current user''s EMS org_id for RLS policies.';
comment on function eviction_management.touch_updated_at() is
  'EMS (Eviction Management) — generic updated_at trigger.';
comment on function eviction_management.case_events_no_mutate() is
  'EMS (Eviction Management) — enforces append-only case_events table.';
