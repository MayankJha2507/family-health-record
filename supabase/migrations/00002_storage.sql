-- Private "reports" bucket; objects live under {owner_uid}/{report_id}.pdf.
-- Guarded so the migration also runs on plain Postgres (local RLS tests),
-- where the storage schema doesn't exist.

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema not present (local test db) — skipping bucket + policies';
    return;
  end if;

  insert into storage.buckets (id, name, public)
  values ('reports', 'reports', false)
  on conflict (id) do nothing;

  execute $pol$
    create policy "reports_objects_select_own" on storage.objects
      for select to authenticated
      using (bucket_id = 'reports' and (storage.foldername(name))[1] = (select auth.uid())::text)
  $pol$;

  execute $pol$
    create policy "reports_objects_insert_own" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'reports' and (storage.foldername(name))[1] = (select auth.uid())::text)
  $pol$;

  execute $pol$
    create policy "reports_objects_update_own" on storage.objects
      for update to authenticated
      using (bucket_id = 'reports' and (storage.foldername(name))[1] = (select auth.uid())::text)
      with check (bucket_id = 'reports' and (storage.foldername(name))[1] = (select auth.uid())::text)
  $pol$;

  execute $pol$
    create policy "reports_objects_delete_own" on storage.objects
      for delete to authenticated
      using (bucket_id = 'reports' and (storage.foldername(name))[1] = (select auth.uid())::text)
  $pol$;
end;
$$;
