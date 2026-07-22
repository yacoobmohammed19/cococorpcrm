-- 0024_capex_reporting.sql - capitalise R&D build effort as intangible assets
--
-- Consulting/build time logged against R&D projects (time_entries, minutes) can be
-- valued at an hourly rate and, when a project is a genuine asset build, capitalised
-- and amortised straight-line over a chosen useful life. These flags/inputs live on
-- rd_projects; the org-wide default rate lives on organizations.
--
-- NOTE: capitalised value is a BALANCE-SHEET concept - it never writes to fact_costs,
-- so the P&L / Income Statement is unaffected. The Reporting tab and Balance Sheet
-- read these columns and compute build value + amortisation on the fly.

-- Per-project capex controls
alter table rd_projects add column if not exists is_capex boolean not null default false;
alter table rd_projects add column if not exists amortisation_months integer;
alter table rd_projects add column if not exists hourly_rate_override numeric(10, 2);

-- Guard rails (drop-then-add so re-running the migration is safe)
alter table rd_projects drop constraint if exists rd_projects_amortisation_months_chk;
alter table rd_projects add constraint rd_projects_amortisation_months_chk
  check (amortisation_months is null or amortisation_months > 0);

alter table rd_projects drop constraint if exists rd_projects_hourly_rate_override_chk;
alter table rd_projects add constraint rd_projects_hourly_rate_override_chk
  check (hourly_rate_override is null or hourly_rate_override >= 0);

-- Org-wide default hourly rate (ZAR). Defaults to 1000.
alter table organizations add column if not exists default_hourly_rate numeric(10, 2) not null default 1000;
