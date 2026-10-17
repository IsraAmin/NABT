-- Applied to NABT Supabase. Private member details, director-only.
create or replace function public.nabt_director_member_details(p_member_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare result jsonb;
begin
 if auth.uid() is null or not exists(
  select 1 from public.profiles caller where caller.id=auth.uid() and caller.role='director' and caller.active is distinct from false
 ) then
  raise exception 'Not authorized to view private member details' using errcode='42501';
 end if;
 select jsonb_build_object(
  'id',p.id,'full_name',p.full_name,'role',p.role,'active',p.active,
  'joined_at',p.joined_at,'created_at',p.created_at,'email',u.email,
  'phone',coalesce(nullif(p.phone,''),u.raw_user_meta_data->>'phone'),
  'birth_date',coalesce(p.birth_date::text,u.raw_user_meta_data->>'birth_date'),
  'country',coalesce(nullif(p.country,''),u.raw_user_meta_data->>'country'),
  'city',coalesce(nullif(p.city,''),u.raw_user_meta_data->>'city'),
  'university',u.raw_user_meta_data->>'university',
  'bio',u.raw_user_meta_data->>'bio',
  'avatar_url',u.raw_user_meta_data->>'avatar_url'
 ) into result from public.profiles p join auth.users u on u.id=p.id where p.id=p_member_id;
 return result;
end;$$;
revoke all on function public.nabt_director_member_details(uuid) from public,anon;
grant execute on function public.nabt_director_member_details(uuid) to authenticated;
