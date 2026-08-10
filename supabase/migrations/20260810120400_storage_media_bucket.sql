-- 20260810120400_storage_media_bucket.sql
-- Phase 4 · Supabase foundations #5: public `media` bucket for avatars and
-- quiz covers. NEXT_PUBLIC_SUPABASE_BUCKET=media. Authenticated users own
-- files under avatars/{uid}/ and covers/{uid}/; public read.

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

create policy "media_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'media');

create policy "media_insert_own_folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] in ('avatars', 'covers')
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "media_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and owner = auth.uid())
  with check (bucket_id = 'media' and owner = auth.uid());

create policy "media_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and owner = auth.uid());