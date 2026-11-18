create table if not exists public.nabt_ai_chats (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null default 'محادثة جديدة' check(length(title)<=140),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.nabt_ai_chat_messages (
 id uuid primary key default gen_random_uuid(),
 chat_id uuid not null references public.nabt_ai_chats(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check (role in ('user','assistant')),
 body text not null check (length(body)<=6000),
 value_cards jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists nabt_ai_chats_user_recent on public.nabt_ai_chats(user_id,updated_at desc);
create index if not exists nabt_ai_chat_msgs_recent on public.nabt_ai_chat_messages(chat_id,created_at,id);
alter table public.nabt_ai_chats enable row level security;
alter table public.nabt_ai_chat_messages enable row level security;
revoke all on public.nabt_ai_chats from anon;
revoke all on public.nabt_ai_chat_messages from anon;
grant select,insert,update,delete on public.nabt_ai_chats to authenticated;
grant select,insert,delete on public.nabt_ai_chat_messages to authenticated;
drop policy if exists nabt_ai_chat_owner on public.nabt_ai_chats;
create policy nabt_ai_chat_owner on public.nabt_ai_chats for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
drop policy if exists nabt_ai_messages_select on public.nabt_ai_chat_messages;
create policy nabt_ai_messages_select on public.nabt_ai_chat_messages for select to authenticated using (user_id=(select auth.uid()) and exists(select 1 from public.nabt_ai_chats c where c.id=chat_id and c.user_id=(select auth.uid())));
drop policy if exists nabt_ai_messages_insert on public.nabt_ai_chat_messages;
create policy nabt_ai_messages_insert on public.nabt_ai_chat_messages for insert to authenticated with check (user_id=(select auth.uid()) and exists(select 1 from public.nabt_ai_chats c where c.id=chat_id and c.user_id=(select auth.uid())));
drop policy if exists nabt_ai_messages_delete on public.nabt_ai_chat_messages;
create policy nabt_ai_messages_delete on public.nabt_ai_chat_messages for delete to authenticated using (user_id=(select auth.uid()) and exists(select 1 from public.nabt_ai_chats c where c.id=chat_id and c.user_id=(select auth.uid())));
