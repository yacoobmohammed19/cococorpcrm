-- Collapse R&D "updates" and "time capture" into a single log on time_entries.
-- Allow 0-minute entries so a pure narrative note is just a log entry with no time.
alter table time_entries drop constraint if exists time_entries_minutes_check;
alter table time_entries drop constraint if exists time_entries_minutes_nonneg;
alter table time_entries add constraint time_entries_minutes_nonneg check (minutes >= 0);

-- Migrate existing R&D project updates into the unified log as 0-minute notes.
insert into time_entries (org_id, entity_type, entity_id, minutes, note, spent_on, author_id, created_at)
select u.org_id, 'rd_project', u.project_id, 0, u.content, u.created_at::date, u.author_id, u.created_at
from rd_project_updates u
where not exists (
  select 1 from time_entries t
  where t.entity_type = 'rd_project'
    and t.entity_id = u.project_id
    and t.note = u.content
    and t.created_at = u.created_at
);
