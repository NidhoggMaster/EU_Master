-- Canonical seed directory. Refreshes enrich this data from official pages;
-- fields that need judgement remain empty until an administrator accepts them.
insert into private.universities (id, name, short_name, city, homepage_url, catalog_url, allowed_hosts)
values
  ('uva','University of Amsterdam','UvA','Amsterdam','https://www.uva.nl/en','https://www.uva.nl/en/education/master-s/master-s-programmes/masters-programmes.html',array['uva.nl','www.uva.nl']),
  ('vu','Vrije Universiteit Amsterdam','VU','Amsterdam','https://vu.nl/en','https://vu.nl/en/education/master',array['vu.nl','www.vu.nl']),
  ('tudelft','Delft University of Technology','TU Delft','Delft','https://www.tudelft.nl/en','https://www.tudelft.nl/en/education/programmes/masters',array['tudelft.nl','www.tudelft.nl']),
  ('tue','Eindhoven University of Technology','TU/e','Eindhoven','https://www.tue.nl/en','https://www.tue.nl/en/education/graduate-school/master-programs',array['tue.nl','www.tue.nl']),
  ('utwente','University of Twente','UT','Enschede','https://www.utwente.nl/en','https://www.utwente.nl/en/education/master/programmes/',array['utwente.nl','www.utwente.nl']),
  ('uu','Utrecht University','UU','Utrecht','https://www.uu.nl/en','https://www.uu.nl/en/masters',array['uu.nl','www.uu.nl']),
  ('rug','University of Groningen','RUG','Groningen','https://www.rug.nl','https://www.rug.nl/masters/',array['rug.nl','www.rug.nl']),
  ('leiden','Leiden University','Leiden','Leiden','https://www.universiteitleiden.nl/en','https://www.universiteitleiden.nl/en/education/study-programmes/master',array['universiteitleiden.nl','www.universiteitleiden.nl']),
  ('maastricht','Maastricht University','UM','Maastricht','https://www.maastrichtuniversity.nl','https://www.maastrichtuniversity.nl/education/master',array['maastrichtuniversity.nl','www.maastrichtuniversity.nl']),
  ('radboud','Radboud University','RU','Nijmegen','https://www.ru.nl/en','https://www.ru.nl/en/education/masters',array['ru.nl','www.ru.nl']),
  ('tilburg','Tilburg University','Tilburg','Tilburg','https://www.tilburguniversity.edu','https://www.tilburguniversity.edu/education/masters-programs',array['tilburguniversity.edu','www.tilburguniversity.edu']),
  ('eur','Erasmus University Rotterdam','EUR','Rotterdam','https://www.eur.nl/en','https://www.eur.nl/en/education/master-programmes',array['eur.nl','www.eur.nl']),
  ('wur','Wageningen University & Research','WUR','Wageningen','https://www.wur.nl/en.htm','https://www.wur.nl/en/education-programmes/master.htm',array['wur.nl','www.wur.nl']),
  ('ou','Open University of the Netherlands','OU','Heerlen','https://www.ou.nl/en','https://www.ou.nl/en/web/english/education',array['ou.nl','www.ou.nl'])
on conflict (id) do nothing;

insert into private.programs (
  id, name, categories, source_url, degree_type, language, duration, ects, mode, intakes,
  tuition, tuition_eur, tuition_academic_year, application_fee, application_fee_eur,
  campus_name, city, seeded, data_completeness
)
values
  ('tilburg-im-strategy','Information Management: Strategy and Governance',array['business','information'],'https://www.tilburguniversity.edu/education/masters-programs/information-management-strategy-and-governance','MSc','English','1 year','60 ECTS','Full-time',array['February'],'',null,'','',null,'Tilburg University campus','Tilburg',true,60),
  ('tilburg-im-intelligence','Information Management: Intelligence and Innovation',array['business','information'],'https://www.tilburguniversity.edu/education/masters-programs/information-management-intelligence-and-innovation','MSc','English','1 year','60 ECTS','Full-time',array['September'],'',null,'','',null,'Tilburg University campus','Tilburg',true,60),
  ('vu-dbi','Digital Business and Innovation',array['business','information'],'https://vu.nl/en/education/master/digital-business-and-innovation','MSc','English','1 year','60 ECTS','Full-time',array['September'],'',null,'','',null,'','Amsterdam',true,70),
  ('maastricht-biss','Business Intelligence and Smart Services',array['business','data'],'https://www.maastrichtuniversity.nl/education/master/programmes/business-intelligence-and-smart-services','Master of Science','English','1 year','60 ECTS','Full-time',array['September'],'Non-EU/EEA institutional fee €21,500 (2026/27)',21500,'2026/27','',null,'','Maastricht',true,70),
  ('utwente-bit','Business Information Technology',array['business','information','computer'],'https://www.utwente.nl/en/education/master/programmes/business-information-technology/','Master of Science','English','2 years','120 ECTS','Full-time',array['September','February'],'Non-EU/EEA institutional fee €21,700 (2026/27)',21700,'2026/27','€100 for applicable international applicants',100,'University of Twente campus','Enschede',true,70),
  ('radboud-is','Information Sciences',array['information','computer'],'https://www.ru.nl/en/education/masters/information-sciences','Master of Science','English','1 year','60 ECTS','Full-time',array['September'],'Non-EEA institutional fee €25,429 (2026/27)',25429,'2026/27','',null,'','Nijmegen',true,60),
  ('vu-is','Information Sciences',array['information','computer'],'https://vu.nl/en/education/master/information-sciences','Master','English','1 year','60 ECTS','Full-time',array['September'],'',null,'','€100 for applicable international applicants',100,'','Amsterdam',true,70),
  ('tilburg-dss-business','Data Science and Society — Business Track',array['business','data'],'https://www.tilburguniversity.edu/education/masters-programs/data-science-and-society','MSc','English','1 year','60 ECTS','Full-time',array['September','February'],'',null,'','',null,'Tilburg University campus','Tilburg',true,60),
  ('uva-is','Information Studies — Information Systems',array['information','computer'],'https://www.uva.nl/en/programmes/masters/information-studies-information-systems/information-systems.html','MSc Information Studies','English','12 months','60 ECTS','Full-time / part-time',array['September'],'',null,'','',null,'Science Park','Amsterdam',true,50),
  ('uva-ds','Information Studies — Data Science',array['data','computer'],'https://www.uva.nl/en/programmes/masters/information-studies-data-science/data-science.html','MSc','English','12 months','60 ECTS','Full-time',array['September'],'',null,'','€100 for applicable international applicants',100,'Science Park','Amsterdam',true,50),
  ('uu-bi','Business Informatics',array['business','information','computer'],'https://www.uu.nl/en/masters/business-informatics','MSc','English','2 years','120 ECTS','Full-time',array['September','February'],'Non-EU/EEA institutional fee €25,306 (2026/27)',25306,'2026/27','',null,'','Utrecht',true,90),
  ('jads-dsbe','Data Science in Business and Entrepreneurship',array['business','data','computer'],'https://www.tilburguniversity.edu/education/masters-programs/data-science-business-entrepreneurship','MSc','English','2 years','120 ECTS','Full-time',array['September','February'],'',null,'','',null,'Jheronimus Academy of Data Science (JADS)','s-Hertogenbosch',true,60),
  ('maastricht-dbe','Digital Business and Economics',array['business','information'],'https://www.maastrichtuniversity.nl/education/master/programmes/digital-business-and-economics','Master of Science','English','1 year','60 ECTS','Full-time',array['September'],'Non-EU/EEA institutional fee €21,500 (2026/27)',21500,'2026/27','',null,'','Maastricht',true,80)
on conflict (id) do nothing;

insert into private.program_universities (program_id, university_id, is_primary)
values
  ('tilburg-im-strategy','tilburg',true), ('tilburg-im-intelligence','tilburg',true), ('vu-dbi','vu',true),
  ('maastricht-biss','maastricht',true), ('utwente-bit','utwente',true), ('radboud-is','radboud',true),
  ('vu-is','vu',true), ('tilburg-dss-business','tilburg',true), ('uva-is','uva',true), ('uva-ds','uva',true),
  ('uu-bi','uu',true), ('jads-dsbe','tilburg',true), ('jads-dsbe','tue',false), ('maastricht-dbe','maastricht',true)
on conflict (program_id, university_id) do nothing;

insert into private.program_sources (program_id, source_url, source_kind, title, provider, verification_state)
select id, source_url, 'program', name, 'seed', 'confirmed'
from private.programs
where seeded = true
on conflict (program_id, source_url) do nothing;
