create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table private.applicant_profiles (
  id text primary key
    check (char_length(id) between 1 and 64),
  full_name text not null default ''
    check (char_length(full_name) <= 120),
  email text not null default ''
    check (char_length(email) <= 254),
  nationality text not null default ''
    check (char_length(nationality) <= 120),
  current_city text not null default ''
    check (char_length(current_city) <= 120),
  education jsonb not null default '[]'::jsonb
    check (jsonb_typeof(education) = 'array'),
  courses jsonb not null default '[]'::jsonb
    check (jsonb_typeof(courses) = 'array'),
  tests jsonb not null default '[]'::jsonb
    check (jsonb_typeof(tests) = 'array'),
  experiences jsonb not null default '[]'::jsonb
    check (jsonb_typeof(experiences) = 'array'),
  skills jsonb not null default '[]'::jsonb
    check (jsonb_typeof(skills) = 'array'),
  preferences jsonb not null default '{"countries":[],"fields":[],"intake":"","budget":"","cityPreference":"","employmentPreference":""}'::jsonb
    check (jsonb_typeof(preferences) = 'object'),
  client_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table private.applicant_profiles is
  'Applicant personal profiles; accessible only from the trusted backend PostgreSQL connection.';

alter table private.applicant_profiles enable row level security;
alter table private.applicant_profiles force row level security;

revoke all on table private.applicant_profiles from public, anon, authenticated;
