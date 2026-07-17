create index programs_status_name_idx on private.programs (status, name);
create index programs_categories_gin_idx on private.programs using gin (categories);
create index program_universities_university_idx on private.program_universities (university_id, program_id);
create index program_sources_program_fetched_idx on private.program_sources (program_id, fetched_at desc);
create index program_refresh_runs_program_started_idx on private.program_refresh_runs (program_id, started_at desc);
create index program_field_changes_pending_idx on private.program_field_changes (program_id, status, created_at desc);
create index program_field_changes_refresh_run_idx on private.program_field_changes (refresh_run_id) where refresh_run_id is not null;
create index exchange_rates_latest_idx on private.exchange_rates (base_currency, quote_currency, effective_date desc);
