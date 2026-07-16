-- Private "reports" bucket; objects live under {owner_uid}/{report_id}.pdf.
-- Guarded so the migration also runs on plain Postgres (local RLS tests),
-- where the storage schema doesn't exist.
--
-- IDEMPOTENT: every policy is dropped-then-recreated, so this file can be
-- re-applied cleanly at any time without erroring. Non-reproducible storage
-- policies would be a security leak — the isolation must be re-provable on demand.

do $$
declare
  pol text;
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema not present (local test db) — skipping bucket + policies';
    return;
  end if;

  insert into storage.buckets (id, name, public)
  values ('reports', 'reports', false)
  on conflict (id) do update set public = false;  -- also re-asserts private on re-run

  -- Drop any prior versions so re-application is clean.
  foreach pol in array array[
    'reports_objects_select_own',
    'reports_objects_insert_own',
    'reports_objects_update_own',
    'reports_objects_delete_own'
  ] loop
    execute format('drop policy if exists %I on storage.objects', pol);
  end loop;

  create policy "reports_objects_select_own" on storage.objects
    for select to authenticated
    using (bucket_id = 'reports' and (storage.foldername(name))[1] = (select auth.uid())::text);

  create policy "reports_objects_insert_own" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'reports' and (storage.foldername(name))[1] = (select auth.uid())::text);

  create policy "reports_objects_update_own" on storage.objects
    for update to authenticated
    using (bucket_id = 'reports' and (storage.foldername(name))[1] = (select auth.uid())::text)
    with check (bucket_id = 'reports' and (storage.foldername(name))[1] = (select auth.uid())::text);

  create policy "reports_objects_delete_own" on storage.objects
    for delete to authenticated
    using (bucket_id = 'reports' and (storage.foldername(name))[1] = (select auth.uid())::text);
end;
$$;
