-- Apply in NABT Supabase SQL Editor before uploading member photos.
-- Public profile photos only; maximum stored image size is 50 KiB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('nabt-avatars','nabt-avatars',true,51200,array['image/jpeg'])
on conflict(id) do update set public=true,file_size_limit=51200,allowed_mime_types=array['image/jpeg'];
create policy "nabt_avatar_public_read" on storage.objects
for select to public using(bucket_id='nabt-avatars');
create policy "nabt_avatar_own_insert" on storage.objects
for insert to authenticated with check(
 bucket_id='nabt-avatars'
 and (storage.foldername(name))[1]=(select auth.uid())::text
);
create policy "nabt_avatar_own_update" on storage.objects
for update to authenticated using(
 bucket_id='nabt-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text
) with check(
 bucket_id='nabt-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text
);
create policy "nabt_avatar_own_delete" on storage.objects
for delete to authenticated using(
 bucket_id='nabt-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text
);
