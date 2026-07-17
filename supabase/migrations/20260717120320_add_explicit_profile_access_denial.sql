create policy "No Data API access"
on private.applicant_profiles
as restrictive
for all
to anon, authenticated
using (false)
with check (false);
