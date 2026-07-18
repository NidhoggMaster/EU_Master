alter table private.programs
  add column if not exists overview jsonb,
  add column if not exists rankings jsonb not null default '[]'::jsonb,
  add column if not exists career_outcomes jsonb not null default '[]'::jsonb,
  add column if not exists application_dates jsonb not null default '[]'::jsonb,
  add column if not exists test_requirements jsonb not null default '[]'::jsonb,
  add column if not exists china_eligibility jsonb,
  add column if not exists premaster_info jsonb,
  add column if not exists application_links jsonb not null default '{}'::jsonb,
  add column if not exists admission_probability_prior jsonb,
  add column if not exists field_locks text[] not null default '{}';

alter table private.programs
  drop constraint if exists programs_rankings_check,
  add constraint programs_rankings_check check (jsonb_typeof(rankings) = 'array'),
  drop constraint if exists programs_career_outcomes_check,
  add constraint programs_career_outcomes_check check (jsonb_typeof(career_outcomes) = 'array'),
  drop constraint if exists programs_application_dates_check,
  add constraint programs_application_dates_check check (jsonb_typeof(application_dates) = 'array'),
  drop constraint if exists programs_test_requirements_check,
  add constraint programs_test_requirements_check check (jsonb_typeof(test_requirements) = 'array'),
  drop constraint if exists programs_application_links_check,
  add constraint programs_application_links_check check (jsonb_typeof(application_links) = 'object');

alter table private.program_field_changes drop constraint if exists program_field_changes_status_check;
alter table private.program_field_changes
  add constraint program_field_changes_status_check check (status in ('applied','pending','accepted','rejected','superseded'));

update private.program_field_changes
set status = 'superseded', decided_at = coalesce(decided_at, now())
where status = 'pending';

revoke insert, update, delete on private.applicant_profiles from eu_master_backend;
grant select on private.applicant_profiles to eu_master_backend;

comment on column private.programs.overview is 'Source-backed bilingual programme overview; project data only.';
comment on column private.programs.field_locks is 'Fields protected from automatic official-source refresh.';
comment on table private.applicant_profiles is 'Legacy read-only profile data. Current application profile data is local-only.';
