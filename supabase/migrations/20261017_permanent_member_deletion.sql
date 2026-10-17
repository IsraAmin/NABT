-- Member deletion support: preserve shared records.
-- Apply only once; already applied to production NABT database on 2026-10-17.
-- Member-owned attendance and session_responses cascade via profiles.
alter table public.sessions drop constraint if exists sessions_created_by_fkey;
alter table public.sessions add constraint sessions_created_by_fkey foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.attendance drop constraint if exists attendance_marked_by_fkey;
alter table public.attendance add constraint attendance_marked_by_fkey foreign key (marked_by) references public.profiles(id) on delete set null;

alter table public.announcements drop constraint if exists announcements_created_by_fkey;
alter table public.announcements add constraint announcements_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
