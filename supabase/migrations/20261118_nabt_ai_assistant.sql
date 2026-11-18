
-- NABT AI assistant: private settings, encrypted keys (Supabase Vault), atomic daily limits.
create table if not exists public.nabt_ai_config (
 id boolean primary key default true check (id),
 enabled boolean not null default true,
 model text not null default 'gemini-3.5-flash-lite',
 admin_daily_limit integer not null default 10 check (admin_daily_limit between 1 and 300),
 director_daily_limit integer not null default 10 check (director_daily_limit between 1 and 300),
 allow_member_names boolean not null default true,
 allow_university boolean not null default true,
 allow_phone boolean not null default false,
 allow_email boolean not null default false,
 key1_id uuid, key2_id uuid,
 updated_at timestamptz not null default now()
);
insert into public.nabt_ai_config (id) values (true) on conflict (id) do nothing;
alter table public.nabt_ai_config enable row level security;
revoke all on public.nabt_ai_config from anon, authenticated;
create table if not exists public.nabt_ai_usage (
 user_id uuid not null references auth.users(id) on delete cascade,
 usage_date date not null,
 used integer not null default 0 check (used>=0),
 primary key(user_id,usage_date)
);
alter table public.nabt_ai_usage enable row level security;
revoke all on public.nabt_ai_usage from anon, authenticated;

create or replace function public.nabt_ai_save_key(p_slot integer,p_key text)
returns void language plpgsql security definer set search_path='' as $$
declare old_id uuid; next_id uuid;
begin
 if p_slot not in (1,2) or length(trim(p_key))<12 or length(p_key)>400 or p_key ~ '[[:space:]]'
 then raise exception 'Invalid API key'; end if;
 select case when p_slot=1 then key1_id else key2_id end into old_id
 from public.nabt_ai_config where id=true for update;
 if old_id is null then
   next_id:=vault.create_secret(p_key, 'nabt_ai_gemini_'||p_slot::text);
 else
   perform vault.update_secret(old_id,p_key);
   next_id:=old_id;
 end if;
 if p_slot=1 then update public.nabt_ai_config set key1_id=next_id,updated_at=now() where id=true;
 else update public.nabt_ai_config set key2_id=next_id,updated_at=now() where id=true; end if;
end $$;
create or replace function public.nabt_ai_clear_key(p_slot integer)
returns void language plpgsql security definer set search_path='' as $$
declare old_id uuid;
begin
 if p_slot not in (1,2) then raise exception 'Invalid slot'; end if;
 select case when p_slot=1 then key1_id else key2_id end into old_id from public.nabt_ai_config where id=true for update;
 if p_slot=1 then update public.nabt_ai_config set key1_id=null,updated_at=now() where id=true;
 else update public.nabt_ai_config set key2_id=null,updated_at=now() where id=true; end if;
 if old_id is not null then delete from vault.secrets where id=old_id; end if;
end $$;
create or replace function public.nabt_ai_read_keys()
returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object(
  'primary',(select decrypted_secret from vault.decrypted_secrets where id=c.key1_id),
  'backup',(select decrypted_secret from vault.decrypted_secrets where id=c.key2_id)
 ) from public.nabt_ai_config c where c.id=true
$$;
create or replace function public.nabt_ai_claim(p_user uuid,p_limit integer)
returns integer language plpgsql security definer set search_path='' as $$
declare total integer;
begin
 if p_limit<1 or p_limit>300 then raise exception 'Invalid limit'; end if;
 insert into public.nabt_ai_usage(user_id,usage_date,used)
 values(p_user,(now() at time zone 'Africa/Khartoum')::date,1)
 on conflict (user_id,usage_date) do update set used=public.nabt_ai_usage.used+1
 where public.nabt_ai_usage.used < p_limit
 returning used into total;
 return total;
end $$;
create or replace function public.nabt_ai_refund(p_user uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 update public.nabt_ai_usage set used=greatest(0,used-1)
 where user_id=p_user and usage_date=(now() at time zone 'Africa/Khartoum')::date;
end $$;
revoke all on function public.nabt_ai_save_key(integer,text) from public,anon,authenticated;
revoke all on function public.nabt_ai_clear_key(integer) from public,anon,authenticated;
revoke all on function public.nabt_ai_read_keys() from public,anon,authenticated;
revoke all on function public.nabt_ai_claim(uuid,integer) from public,anon,authenticated;
revoke all on function public.nabt_ai_refund(uuid) from public,anon,authenticated;
grant execute on function public.nabt_ai_save_key(integer,text) to service_role;
grant execute on function public.nabt_ai_clear_key(integer) to service_role;
grant execute on function public.nabt_ai_read_keys() to service_role;
grant execute on function public.nabt_ai_claim(uuid,integer) to service_role;
grant execute on function public.nabt_ai_refund(uuid) to service_role;
