-- Eviction Management System — initial schema
-- Domain model from spec §7. RLS enforces multi-tenant isolation by org_id.

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- =====================================================================
-- Enums
-- =====================================================================
create type org_plan as enum ('free', 'per_case', 'pro');
create type user_role as enum ('owner', 'manager', 'viewer');
create type case_status as enum (
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
create type grounds as enum (
  'NON_PAYMENT','LEASE_VIOLATION_CURABLE','LEASE_VIOLATION_NON_CURABLE',
  'HOLDOVER','NUISANCE_ILLEGAL','NO_CAUSE'
);
create type tenancy_type as enum (
  'WRITTEN_LEASE','ORAL_LEASE','M2M','WEEK_TO_WEEK','AT_WILL',
  'SUBSIDIZED','MOBILE_HOME_PARK'
);
create type property_type as enum ('SFR','CONDO','SMALL_MULTI','LARGE_MULTI');
create type rule_type as enum (
  'NOTICE_PERIOD','FILING_FORM','COURT_VENUE','FEE','SERVICE_METHOD',
  'WRIT_WAIT','RELOCATION_ASSIST','ALLOWED_GROUNDS_OVERLAY','ANSWER_PERIOD'
);
create type service_method as enum (
  'PERSONAL','SUBSTITUTE_AND_MAIL','POST_AND_MAIL','CERTIFIED_MAIL','EMAIL'
);
create type document_type as enum (
  'NOTICE','COMPLAINT','SUMMONS','AFFIDAVIT_OF_SERVICE','JUDGMENT',
  'WRIT_OF_POSSESSION','SETTLEMENT','ENGAGEMENT_LETTER','OTHER'
);
create type case_event_actor as enum ('LANDLORD','TENANT','SYSTEM','ATTORNEY','COURT');
create type comm_channel as enum ('EMAIL','SMS','PORTAL','MAIL','IN_PERSON');
create type comm_direction as enum ('INBOUND','OUTBOUND');

-- =====================================================================
-- Helpers
-- =====================================================================
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- =====================================================================
-- Organizations & users
-- =====================================================================
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  plan        org_plan not null default 'free',
  billing_customer_id text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_orgs_updated before update on public.organizations
  for each row execute function public.touch_updated_at();

-- Profiles mirror auth.users; created by trigger on signup.
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  org_id      uuid references public.organizations(id) on delete set null,
  role        user_role not null default 'owner',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on public.profiles (org_id);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Bootstrap profile + org on first signup.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare new_org uuid;
begin
  insert into public.organizations (name)
    values (coalesce(new.raw_user_meta_data->>'org_name', 'My Organization'))
    returning id into new_org;
  insert into public.profiles (id, email, full_name, org_id, role)
    values (new.id, new.email,
            new.raw_user_meta_data->>'full_name',
            new_org, 'owner');
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Convenience helper: current user's org.
create or replace function public.current_org_id() returns uuid
language sql stable security definer set search_path = public as $$
  select org_id from public.profiles where id = auth.uid()
$$;

-- =====================================================================
-- Properties / leases / tenants  (EMS-native; no PM module dependency)
-- =====================================================================
create table public.properties (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  address_line1 text not null,
  address_line2 text,
  city        text not null,
  state       text not null,
  postal_code text not null,
  county      text,
  jurisdiction_code text,
  property_type property_type not null default 'SFR',
  rent_control_flag boolean not null default false,
  federal_funding_flag boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on public.properties (org_id);
create trigger trg_properties_updated before update on public.properties
  for each row execute function public.touch_updated_at();

create table public.tenants (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  full_name   text not null,
  email       text,
  phone       text,
  scra_status text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on public.tenants (org_id);
create trigger trg_tenants_updated before update on public.tenants
  for each row execute function public.touch_updated_at();

create table public.leases (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete restrict,
  tenancy_type tenancy_type not null default 'WRITTEN_LEASE',
  start_date  date not null,
  end_date    date,
  rent_amount_cents integer not null default 0,
  rent_due_day smallint not null default 1,
  terms       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on public.leases (org_id);
create index on public.leases (property_id);
create trigger trg_leases_updated before update on public.leases
  for each row execute function public.touch_updated_at();

create table public.lease_tenants (
  lease_id  uuid not null references public.leases(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  primary key (lease_id, tenant_id)
);

-- =====================================================================
-- Cases
-- =====================================================================
create table public.cases (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  lease_id    uuid not null references public.leases(id) on delete restrict,
  status      case_status not null default 'DRAFT',
  grounds     grounds not null,
  jurisdiction_code text not null,
  opened_at   timestamptz not null default now(),
  resolved_at timestamptz,
  attorney_id uuid,
  flags       jsonb not null default '[]'::jsonb,
  computed    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on public.cases (org_id, status);
create index on public.cases (lease_id);
create trigger trg_cases_updated before update on public.cases
  for each row execute function public.touch_updated_at();

create table public.case_events (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references public.cases(id) on delete cascade,
  type        text not null,
  actor_type  case_event_actor not null,
  actor_id    uuid,
  payload     jsonb not null default '{}'::jsonb,
  prev_state  case_status,
  next_state  case_status,
  created_at  timestamptz not null default now()
);
create index on public.case_events (case_id, created_at desc);

-- Append-only enforcement for case_events.
create or replace function public.case_events_no_mutate() returns trigger
language plpgsql as $$
begin raise exception 'case_events is append-only'; end $$;
create trigger case_events_no_update
  before update or delete on public.case_events
  for each row execute function public.case_events_no_mutate();

-- =====================================================================
-- Jurisdictional rules
-- =====================================================================
create table public.jurisdiction_rules (
  id              uuid primary key default gen_random_uuid(),
  jurisdiction_code text not null,
  rule_type       rule_type not null,
  grounds         grounds[] not null default '{}',
  tenancy_types   tenancy_type[] not null default '{}',
  payload         jsonb not null,
  statute_citation text,
  effective_from  date not null default current_date,
  effective_to    date,
  source_url      text,
  verified_by     text,
  verified_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index on public.jurisdiction_rules (jurisdiction_code, rule_type, effective_from desc);

-- =====================================================================
-- Templates / documents / notices / filings / hearings
-- =====================================================================
create table public.form_templates (
  id          uuid primary key default gen_random_uuid(),
  jurisdiction_code text not null,
  type        document_type not null,
  version     text not null,
  fields_schema jsonb not null default '{}'::jsonb,
  body        text not null,
  attorney_signoff text,
  signoff_at  timestamptz,
  effective_from date not null default current_date,
  effective_to date,
  unique (jurisdiction_code, type, version)
);

create table public.documents (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  case_id     uuid references public.cases(id) on delete cascade,
  type        document_type not null,
  storage_key text,
  hash_sha256 text,
  signed_by   jsonb not null default '[]'::jsonb,
  generated_from_template uuid references public.form_templates(id),
  created_at  timestamptz not null default now()
);
create index on public.documents (case_id);

create table public.notices (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references public.cases(id) on delete cascade,
  type        text not null,
  served_at   timestamptz,
  service_method service_method,
  served_by   uuid,
  evidence_doc_id uuid references public.documents(id),
  computed_expires_at timestamptz,
  created_at  timestamptz not null default now()
);
create index on public.notices (case_id);

create table public.filings (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references public.cases(id) on delete cascade,
  court_name  text,
  filed_at    timestamptz,
  external_filing_id text,
  status      text,
  fee_cents   integer,
  document_id uuid references public.documents(id),
  created_at  timestamptz not null default now()
);
create index on public.filings (case_id);

create table public.hearings (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references public.cases(id) on delete cascade,
  court_name  text,
  scheduled_at timestamptz,
  type        text,
  outcome     text,
  notes       text,
  created_at  timestamptz not null default now()
);
create index on public.hearings (case_id);

-- =====================================================================
-- Ledger / payments
-- =====================================================================
create table public.ledger_entries (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  lease_id    uuid not null references public.leases(id) on delete cascade,
  case_id     uuid references public.cases(id) on delete set null,
  posted_at   timestamptz not null default now(),
  debit_cents integer not null default 0,
  credit_cents integer not null default 0,
  memo        text
);
create index on public.ledger_entries (lease_id, posted_at desc);

create table public.payments (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  case_id     uuid references public.cases(id) on delete set null,
  amount_cents integer not null,
  type        text not null,
  source      text,
  stripe_intent_id text,
  status      text not null default 'pending',
  created_at  timestamptz not null default now()
);
create index on public.payments (case_id);

-- =====================================================================
-- Evidence / communications / tasks
-- =====================================================================
create table public.evidence (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  case_id     uuid not null references public.cases(id) on delete cascade,
  type        text not null,
  captured_at timestamptz,
  geotag      jsonb,
  hash_sha256 text,
  storage_key text,
  description text,
  created_at  timestamptz not null default now()
);
create index on public.evidence (case_id);

create table public.communications (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  case_id     uuid not null references public.cases(id) on delete cascade,
  channel     comm_channel not null,
  direction   comm_direction not null,
  subject     text,
  body        text,
  attachments jsonb not null default '[]'::jsonb,
  delivered_at timestamptz,
  created_at  timestamptz not null default now()
);
create index on public.communications (case_id, created_at desc);

create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  case_id     uuid references public.cases(id) on delete cascade,
  assignee_id uuid references public.profiles(id) on delete set null,
  type        text not null,
  title       text not null,
  due_at      timestamptz,
  status      text not null default 'open',
  blocking_state case_status,
  created_at  timestamptz not null default now()
);
create index on public.tasks (assignee_id, status, due_at);

-- =====================================================================
-- Attorneys / engagements
-- =====================================================================
create table public.attorneys (
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

create table public.engagements (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  case_id     uuid not null references public.cases(id) on delete cascade,
  attorney_id uuid not null references public.attorneys(id) on delete restrict,
  scope       text not null,
  fee_arrangement jsonb not null default '{}'::jsonb,
  status      text not null default 'pending',
  created_at  timestamptz not null default now()
);

-- =====================================================================
-- Row-Level Security
-- =====================================================================
alter table public.organizations    enable row level security;
alter table public.profiles         enable row level security;
alter table public.properties       enable row level security;
alter table public.tenants          enable row level security;
alter table public.leases           enable row level security;
alter table public.lease_tenants    enable row level security;
alter table public.cases            enable row level security;
alter table public.case_events      enable row level security;
alter table public.documents        enable row level security;
alter table public.notices          enable row level security;
alter table public.filings          enable row level security;
alter table public.hearings         enable row level security;
alter table public.ledger_entries   enable row level security;
alter table public.payments         enable row level security;
alter table public.evidence         enable row level security;
alter table public.communications   enable row level security;
alter table public.tasks            enable row level security;
alter table public.engagements      enable row level security;

-- Public-read tables (rules, templates, attorney directory).
alter table public.jurisdiction_rules enable row level security;
alter table public.form_templates     enable row level security;
alter table public.attorneys          enable row level security;
create policy "rules readable by all authenticated"
  on public.jurisdiction_rules for select to authenticated using (true);
create policy "templates readable by all authenticated"
  on public.form_templates for select to authenticated using (true);
create policy "attorneys readable by all authenticated"
  on public.attorneys for select to authenticated using (active);

-- Org-scoped policies.
create policy "own org" on public.organizations
  for select using (id = public.current_org_id());

create policy "own profile read"  on public.profiles
  for select using (id = auth.uid() or org_id = public.current_org_id());
create policy "own profile update" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Macro: same shape applied to every org-scoped table.
do $$
declare t text;
begin
  for t in select unnest(array[
    'properties','tenants','leases','cases','documents','evidence',
    'communications','tasks','engagements','ledger_entries','payments'
  ]) loop
    execute format($f$
      create policy "%I_select" on public.%I
        for select using (org_id = public.current_org_id());
      create policy "%I_insert" on public.%I
        for insert with check (org_id = public.current_org_id());
      create policy "%I_update" on public.%I
        for update using (org_id = public.current_org_id())
        with check (org_id = public.current_org_id());
      create policy "%I_delete" on public.%I
        for delete using (org_id = public.current_org_id());
    $f$, t, t, t, t, t, t, t, t);
  end loop;
end $$;

-- Children scoped via parent.
create policy "lease_tenants_via_lease" on public.lease_tenants
  for all using (
    exists (select 1 from public.leases l
            where l.id = lease_id and l.org_id = public.current_org_id())
  ) with check (
    exists (select 1 from public.leases l
            where l.id = lease_id and l.org_id = public.current_org_id())
  );

create policy "case_events_select" on public.case_events
  for select using (
    exists (select 1 from public.cases c
            where c.id = case_id and c.org_id = public.current_org_id())
  );
create policy "case_events_insert" on public.case_events
  for insert with check (
    exists (select 1 from public.cases c
            where c.id = case_id and c.org_id = public.current_org_id())
  );

create policy "notices_via_case_select" on public.notices
  for select using (
    exists (select 1 from public.cases c
            where c.id = case_id and c.org_id = public.current_org_id())
  );
create policy "notices_via_case_write" on public.notices
  for all using (
    exists (select 1 from public.cases c
            where c.id = case_id and c.org_id = public.current_org_id())
  ) with check (
    exists (select 1 from public.cases c
            where c.id = case_id and c.org_id = public.current_org_id())
  );

create policy "filings_via_case" on public.filings
  for all using (
    exists (select 1 from public.cases c
            where c.id = case_id and c.org_id = public.current_org_id())
  ) with check (
    exists (select 1 from public.cases c
            where c.id = case_id and c.org_id = public.current_org_id())
  );

create policy "hearings_via_case" on public.hearings
  for all using (
    exists (select 1 from public.cases c
            where c.id = case_id and c.org_id = public.current_org_id())
  ) with check (
    exists (select 1 from public.cases c
            where c.id = case_id and c.org_id = public.current_org_id())
  );
