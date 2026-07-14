-- Family Longitudinal Health Record — core schema + RLS
-- Ownership root: profiles.owner_id = auth.uid(). Everything else derives from it.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (length(trim(name)) > 0),
  dob        date,
  sex        text check (sex in ('male', 'female', 'other')),
  relation   text,
  created_at timestamptz not null default now()
);

create index profiles_owner_id_idx on public.profiles (owner_id);

create table public.reports (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references public.profiles (id) on delete cascade,
  storage_path   text,
  lab_name       text,
  collected_at   date,  -- sample collection date: the timeline key
  reported_at    date,
  status         text not null default 'processing'
                 check (status in ('processing', 'needs_review', 'confirmed', 'failed')),
  parser_used    text check (parser_used in ('groq', 'gemini', 'manual')),
  raw_extraction jsonb, -- raw LLM output, kept for re-normalization
  created_at     timestamptz not null default now()
);

create index reports_profile_id_idx on public.reports (profile_id);

create table public.biomarkers (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  display_name   text not null,
  category       text not null,
  canonical_unit text not null
);

create table public.biomarker_aliases (
  id           uuid primary key default gen_random_uuid(),
  biomarker_id uuid not null references public.biomarkers (id) on delete cascade,
  alias        text not null check (alias = lower(alias))
);

create unique index biomarker_aliases_alias_key on public.biomarker_aliases (lower(alias));

create table public.results (
  id               uuid primary key default gen_random_uuid(),
  report_id        uuid not null references public.reports (id) on delete cascade,
  profile_id       uuid not null references public.profiles (id) on delete cascade,
  biomarker_id     uuid references public.biomarkers (id), -- null = unmatched analyte, stored raw
  raw_name         text not null,
  value            numeric,
  unit             text,
  canonical_value  numeric,
  canonical_unit   text,
  ref_low          numeric, -- the lab's own printed range
  ref_high         numeric,
  ref_text         text,    -- non-numeric ranges: "<200", "Negative"
  flag             text check (flag in ('low', 'normal', 'high', 'abnormal')),
  measured_at      date not null,
  entered_manually boolean not null default false,
  created_at       timestamptz not null default now()
);

create index results_trend_idx on public.results (profile_id, biomarker_id, measured_at);
create index results_report_id_idx on public.results (report_id);

-- The denormalized results.profile_id must always match the parent report's.
create or replace function public.enforce_result_profile_matches_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.profile_id is distinct from (select profile_id from public.reports where id = new.report_id) then
    raise exception 'results.profile_id must match the parent report''s profile_id';
  end if;
  return new;
end;
$$;

create trigger results_profile_matches_report
  before insert or update of report_id, profile_id on public.results
  for each row execute function public.enforce_result_profile_matches_report();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles          enable row level security;
alter table public.reports           enable row level security;
alter table public.results           enable row level security;
alter table public.biomarkers        enable row level security;
alter table public.biomarker_aliases enable row level security;

-- profiles: owner-only, all four operations
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "profiles_delete_own" on public.profiles
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- reports: gated through the owning profile
create policy "reports_select_own" on public.reports
  for select to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = profile_id and p.owner_id = (select auth.uid())));

create policy "reports_insert_own" on public.reports
  for insert to authenticated
  with check (exists (select 1 from public.profiles p
                      where p.id = profile_id and p.owner_id = (select auth.uid())));

create policy "reports_update_own" on public.reports
  for update to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = profile_id and p.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.profiles p
                      where p.id = profile_id and p.owner_id = (select auth.uid())));

create policy "reports_delete_own" on public.reports
  for delete to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = profile_id and p.owner_id = (select auth.uid())));

-- results: gated through the owning profile
create policy "results_select_own" on public.results
  for select to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = profile_id and p.owner_id = (select auth.uid())));

create policy "results_insert_own" on public.results
  for insert to authenticated
  with check (exists (select 1 from public.profiles p
                      where p.id = profile_id and p.owner_id = (select auth.uid())));

create policy "results_update_own" on public.results
  for update to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = profile_id and p.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.profiles p
                      where p.id = profile_id and p.owner_id = (select auth.uid())));

create policy "results_delete_own" on public.results
  for delete to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = profile_id and p.owner_id = (select auth.uid())));

-- dictionary: read-only for signed-in users; only migrations/service role write
create policy "biomarkers_read" on public.biomarkers
  for select to authenticated
  using (true);

create policy "biomarker_aliases_read" on public.biomarker_aliases
  for select to authenticated
  using (true);
