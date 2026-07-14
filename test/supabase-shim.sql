-- Reproduces the slice of Supabase's managed environment our migrations rely on,
-- so the exact same migration files can run against a plain local Postgres.
-- On the hosted project these objects already exist; here we create them.

create schema if not exists auth;

create table if not exists auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text
);

-- Roles Supabase provides. NOLOGIN: we reach them via SET ROLE in the test.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
end;
$$;

-- Supabase's auth.uid(): the 'sub' claim of the request JWT, exposed as a GUC.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  -- Guard the empty/missing GUC BEFORE casting to json, or ''::json errors.
  select nullif(
    nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub',
    ''
  )::uuid
$$;

-- The API roles need to reach the public schema; RLS still gates the rows.
grant usage on schema public to authenticated, anon;
grant usage on schema auth to authenticated, anon;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
