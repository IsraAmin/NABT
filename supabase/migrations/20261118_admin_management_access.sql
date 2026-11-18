-- Applied to NABT project cieyyciklonkmeadgnzq on 2026-11-18.
-- Admins may manage books, but system settings and audit remain director-only.
DROP POLICY IF EXISTS books_staff_insert ON public.books;
CREATE POLICY books_staff_insert ON public.books FOR INSERT TO authenticated
WITH CHECK (public.current_role() IN ('director','admin'));
DROP POLICY IF EXISTS books_staff_update ON public.books;
CREATE POLICY books_staff_update ON public.books FOR UPDATE TO authenticated
USING (public.current_role() IN ('director','admin'))
WITH CHECK (public.current_role() IN ('director','admin'));
DROP POLICY IF EXISTS nabt_books_director_delete ON public.books;
CREATE POLICY nabt_books_director_delete ON public.books FOR DELETE TO authenticated
USING (public.current_role() IN ('director','admin'));
DROP POLICY IF EXISTS books_read ON public.books;
CREATE POLICY books_read ON public.books FOR SELECT TO authenticated
USING (public.current_role() IN ('director','admin') OR public.nabt_can_read_groups(nabt_groups));
CREATE OR REPLACE FUNCTION public.nabt_director_member_details(p_member_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare result jsonb;
begin
 if auth.uid() is null or not exists (
  select 1 from public.profiles caller
  join public.profiles target on target.id=p_member_id
  where caller.id=auth.uid() and caller.role in ('director','admin')
    and caller.active=true and caller.approval_status='approved'
    and (caller.role='director' or target.nabt_group=any(caller.supervisor_groups))
 ) then
  raise exception 'Not authorized to view private member details' using errcode='42501';
 end if;
 select jsonb_build_object(
  'id',p.id,'full_name',p.full_name,'role',p.role,'active',p.active,
  'nabt_group',p.nabt_group,'joined_at',p.joined_at,'created_at',p.created_at,
  'email',u.email,'phone',coalesce(nullif(p.phone,''),u.raw_user_meta_data->>'phone'),
  'birth_date',coalesce(p.birth_date::text,u.raw_user_meta_data->>'birth_date'),
  'country',coalesce(nullif(p.country,''),u.raw_user_meta_data->>'country'),
  'city',coalesce(nullif(p.city,''),u.raw_user_meta_data->>'city'),
  'university',u.raw_user_meta_data->>'university',
  'bio',u.raw_user_meta_data->>'bio',
  'avatar_url',u.raw_user_meta_data->>'avatar_url'
 ) into result from public.profiles p
 join auth.users u on u.id=p.id where p.id=p_member_id;
 return result;
end;
$function$;
CREATE OR REPLACE FUNCTION public.nabt_member_avatars()
RETURNS TABLE(member_id uuid,avatar_url text)
LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $function$
 SELECT u.id, nullif(u.raw_user_meta_data->>'avatar_url','')
 FROM auth.users u JOIN public.profiles p ON p.id=u.id
 WHERE public.current_role()='director' OR
   (public.current_role()='admin' AND p.nabt_group = ANY(
     SELECT unnest(caller.supervisor_groups) FROM public.profiles caller
     WHERE caller.id=auth.uid() AND caller.active=true AND caller.approval_status='approved'
   ));
$function$;