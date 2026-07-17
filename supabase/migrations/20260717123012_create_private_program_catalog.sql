create schema if not exists private;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'eu_master_backend') then
    create role eu_master_backend nologin noinherit nosuperuser nocreatedb nocreaterole noreplication;
  end if;
end $$;

grant eu_master_backend to postgres;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to eu_master_backend;

create table private.universities (
  id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (char_length(name) between 2 and 180),
  short_name text not null check (char_length(short_name) between 1 and 40),
  city text not null default '' check (char_length(city) <= 100),
  country text not null default 'NL' check (country ~ '^[A-Z]{2}$'),
  homepage_url text not null check (homepage_url ~ '^https://'),
  catalog_url text not null check (catalog_url ~ '^https://'),
  allowed_hosts text[] not null check (cardinality(allowed_hosts) > 0),
  campus_name text not null default '',
  campus_area text not null default '',
  location_notes text not null default '',
  living_cost_monthly_min_eur numeric check (living_cost_monthly_min_eur is null or living_cost_monthly_min_eur >= 0),
  living_cost_monthly_max_eur numeric check (living_cost_monthly_max_eur is null or living_cost_monthly_max_eur >= 0),
  living_cost_source_url text check (living_cost_source_url is null or living_cost_source_url ~ '^https://'),
  facts_fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.programs (
  id text primary key check (char_length(id) between 1 and 120),
  name text not null check (char_length(name) between 2 and 240),
  categories text[] not null default '{}' check (categories <@ array['business','information','computer','data'] and cardinality(categories) > 0),
  source_url text not null unique check (source_url ~ '^https://'),
  faculty text not null default '',
  degree_type text not null default '',
  language text not null default '',
  duration text not null default '',
  ects text not null default '',
  mode text not null default '',
  intakes text[] not null default '{}',
  deadline text not null default '',
  tuition text not null default '',
  tuition_eur numeric check (tuition_eur is null or tuition_eur >= 0),
  tuition_academic_year text not null default '',
  application_fee text not null default '',
  application_fee_eur numeric check (application_fee_eur is null or application_fee_eur >= 0),
  application_platform text not null default '',
  premaster text not null default '',
  quota text not null default '',
  campus_name text not null default '',
  city text not null default '',
  campus_area text not null default '',
  location_notes text not null default '',
  core_courses jsonb not null default '[]'::jsonb check (jsonb_typeof(core_courses) = 'array'),
  admission_criteria jsonb not null default '[]'::jsonb check (jsonb_typeof(admission_criteria) = 'array'),
  requirements jsonb not null default '[]'::jsonb check (jsonb_typeof(requirements) = 'array'),
  data_completeness numeric not null default 0 check (data_completeness between 0 and 100),
  status text not null default 'active' check (status in ('active','candidate','archived')),
  seeded boolean not null default false,
  last_fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.program_universities (
  program_id text not null references private.programs(id) on delete cascade,
  university_id text not null references private.universities(id) on delete restrict,
  is_primary boolean not null default false,
  primary key (program_id, university_id)
);

create table private.program_sources (
  id uuid primary key default gen_random_uuid(),
  program_id text not null references private.programs(id) on delete cascade,
  source_url text not null check (source_url ~ '^https://'),
  source_kind text not null default 'program' check (source_kind in ('program','admission','curriculum','tuition','living_cost','other')),
  title text not null default '',
  provider text not null default 'seed' check (provider in ('seed','firecrawl','direct','manual','ecb')),
  content_hash text not null default '',
  excerpts jsonb not null default '[]'::jsonb check (jsonb_typeof(excerpts) = 'array'),
  verification_state text not null default 'pending' check (verification_state in ('pending','confirmed','rejected')),
  fetched_at timestamptz,
  created_at timestamptz not null default now(),
  unique (program_id, source_url)
);

create table private.program_refresh_runs (
  id uuid primary key default gen_random_uuid(),
  program_id text not null references private.programs(id) on delete cascade,
  provider text not null check (provider in ('firecrawl','direct','manual')),
  status text not null check (status in ('running','succeeded','partial','failed')),
  warnings jsonb not null default '[]'::jsonb check (jsonb_typeof(warnings) = 'array'),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_message text not null default ''
);

create table private.program_field_changes (
  id uuid primary key default gen_random_uuid(),
  program_id text not null references private.programs(id) on delete cascade,
  refresh_run_id uuid references private.program_refresh_runs(id) on delete set null,
  field text not null check (char_length(field) between 1 and 80),
  label text not null default '',
  previous_value text not null default '',
  proposed_value text not null default '',
  source_url text not null check (source_url ~ '^https://'),
  excerpt text not null default '',
  confidence numeric not null default 0 check (confidence between 0 and 1),
  risk text not null check (risk in ('low','review')),
  status text not null check (status in ('applied','pending','accepted','rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table private.exchange_rates (
  base_currency text not null check (base_currency ~ '^[A-Z]{3}$'),
  quote_currency text not null check (quote_currency ~ '^[A-Z]{3}$'),
  effective_date date not null,
  rate numeric not null check (rate > 0),
  source_url text not null check (source_url ~ '^https://'),
  fetched_at timestamptz not null default now(),
  primary key (base_currency, quote_currency, effective_date)
);

comment on table private.programs is 'Canonical official university programme catalogue; trusted backend access only.';
comment on table private.program_sources is 'Official source provenance and limited excerpts; full scraped pages are not retained.';
comment on table private.exchange_rates is 'ECB reference rates used for planning estimates, not transaction quotes.';

alter table private.universities enable row level security;
alter table private.programs enable row level security;
alter table private.program_universities enable row level security;
alter table private.program_sources enable row level security;
alter table private.program_refresh_runs enable row level security;
alter table private.program_field_changes enable row level security;
alter table private.exchange_rates enable row level security;
alter table private.universities force row level security;
alter table private.programs force row level security;
alter table private.program_universities force row level security;
alter table private.program_sources force row level security;
alter table private.program_refresh_runs force row level security;
alter table private.program_field_changes force row level security;
alter table private.exchange_rates force row level security;

revoke all on all tables in schema private from public, anon, authenticated;
grant select, insert, update on private.applicant_profiles to eu_master_backend;
grant select on private.universities to eu_master_backend;
grant select, insert, update on private.programs to eu_master_backend;
grant select, insert on private.program_universities to eu_master_backend;
grant select, insert, update on private.program_sources to eu_master_backend;
grant select, insert on private.program_refresh_runs to eu_master_backend;
grant select, insert, update on private.program_field_changes to eu_master_backend;
grant select, insert, update on private.exchange_rates to eu_master_backend;

create policy eu_master_backend_all on private.universities for all to eu_master_backend using (true) with check (true);
create policy eu_master_backend_all on private.applicant_profiles for all to eu_master_backend using (true) with check (true);
create policy eu_master_backend_all on private.programs for all to eu_master_backend using (true) with check (true);
create policy eu_master_backend_all on private.program_universities for all to eu_master_backend using (true) with check (true);
create policy eu_master_backend_all on private.program_sources for all to eu_master_backend using (true) with check (true);
create policy eu_master_backend_all on private.program_refresh_runs for all to eu_master_backend using (true) with check (true);
create policy eu_master_backend_all on private.program_field_changes for all to eu_master_backend using (true) with check (true);
create policy eu_master_backend_all on private.exchange_rates for all to eu_master_backend using (true) with check (true);
