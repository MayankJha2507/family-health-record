-- Role privileges for the API roles.
--
-- PostgREST exposes a table to a role ONLY if that role has privileges on it —
-- otherwise it reports "Could not find the table in the schema cache" (PGRST205).
-- Supabase normally auto-grants to anon/authenticated, but we assert it here so
-- the project is reproducible no matter how migrations are applied.
--
-- SECURITY NOTE: these are TABLE-level grants; row access is still fully gated by
-- the RLS policies in 00001. A grant only makes a table reachable; RLS decides
-- which rows. authenticated gets DML on the app tables (RLS restricts to owner);
-- the biomarker dictionary is read-only (its policies already enforce that).
-- Idempotent: grants are additive and safe to re-run.

grant usage on schema public to anon, authenticated;

-- App tables: authenticated performs all ops; RLS confines them to owner rows.
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.reports  to authenticated;
grant select, insert, update, delete on public.results  to authenticated;

-- Canonical dictionary: readable by signed-in users (read-only policies apply).
grant select on public.biomarkers        to authenticated;
grant select on public.biomarker_aliases to authenticated;

-- Future public tables created by this role inherit the same DML grant.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

-- Make PostgREST pick up the grants immediately.
notify pgrst, 'reload schema';
