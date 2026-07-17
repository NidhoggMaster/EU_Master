-- Keep seeded programme identifiers stable and undo values extracted from
-- navigation/error-page headings or pre-master descriptions during the first refresh.
with canonical_programs (id, name, ects) as (
  values
    ('tilburg-im-strategy', 'Information Management: Strategy and Governance', null::text),
    ('tilburg-im-intelligence', 'Information Management: Intelligence and Innovation', null::text),
    ('vu-dbi', 'Digital Business and Innovation', '60 ECTS'),
    ('maastricht-biss', 'Business Intelligence and Smart Services', null::text),
    ('utwente-bit', 'Business Information Technology', null::text),
    ('radboud-is', 'Information Sciences', null::text),
    ('vu-is', 'Information Sciences', '60 ECTS'),
    ('tilburg-dss-business', 'Data Science and Society — Business Track', null::text),
    ('uva-is', 'Information Studies — Information Systems', null::text),
    ('uva-ds', 'Information Studies — Data Science', null::text),
    ('uu-bi', 'Business Informatics', null::text),
    ('jads-dsbe', 'Data Science in Business and Entrepreneurship', null::text),
    ('maastricht-dbe', 'Digital Business and Economics', null::text)
)
update private.programs as p
set name = c.name,
    ects = coalesce(c.ects, p.ects),
    updated_at = now()
from canonical_programs as c
where p.id = c.id
  and p.seeded = true;

update private.program_sources as s
set title = p.name
from private.programs as p
where s.program_id = p.id
  and p.seeded = true;

update private.program_field_changes
set status = 'rejected', decided_at = now()
where status = 'applied'
  and (
    field = 'name'
    or (field = 'ects' and program_id in ('vu-dbi', 'vu-is') and proposed_value = '30 ECTS')
  );
