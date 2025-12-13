-- Enable UUID generation
create extension if not exists "pgcrypto";

-- 1) Roles and profiles

do $$ begin
  create type public.user_role as enum ('admin', 'instructor', 'student');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'student',
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'
  );
$$;

create or replace function public.is_instructor()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'instructor'
  );
$$;

-- Keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch
before update on public.profiles
for each row execute function public.touch_updated_at();

-- 2) Courses and membership

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  title text not null,
  term text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_courses_touch on public.courses;
create trigger trg_courses_touch
before update on public.courses
for each row execute function public.touch_updated_at();

create table if not exists public.course_instructors (
  course_id uuid not null references public.courses(id) on delete cascade,
  instructor_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (course_id, instructor_id)
);

create table if not exists public.course_enrollments (
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (course_id, student_id)
);

-- 3) Simulation library and versioning

do $$ begin
  create type public.sim_status as enum ('draft', 'published', 'archived');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.simulations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,            -- "csi-001"
  title text not null,
  description text,
  owner_id uuid references public.profiles(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_simulations_touch on public.simulations;
create trigger trg_simulations_touch
before update on public.simulations
for each row execute function public.touch_updated_at();

create table if not exists public.simulation_versions (
  id uuid primary key default gen_random_uuid(),
  simulation_id uuid not null references public.simulations(id) on delete cascade,
  version text not null,                -- "1.0.0"
  status public.sim_status not null default 'draft',
  manifest jsonb not null,              -- your manifest, stored as JSONB
  package_path text,                    -- storage path to uploaded zip, optional
  created_by uuid references public.profiles(user_id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (simulation_id, version)
);

drop trigger if exists trg_sim_versions_touch on public.simulation_versions;
create trigger trg_sim_versions_touch
before update on public.simulation_versions
for each row execute function public.touch_updated_at();

-- Which simulations are assigned to which course (and optionally which version)
create table if not exists public.course_simulations (
  course_id uuid not null references public.courses(id) on delete cascade,
  simulation_id uuid not null references public.simulations(id) on delete cascade,
  -- if null, player uses latest published version
  pinned_version_id uuid references public.simulation_versions(id),
  created_at timestamptz not null default now(),
  primary key (course_id, simulation_id)
);

-- 4) Attempts and instructor feedback

do $$ begin
  create type public.attempt_status as enum ('draft', 'submitted', 'graded');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  simulation_version_id uuid not null references public.simulation_versions(id) on delete restrict,
  student_id uuid not null references public.profiles(user_id) on delete cascade,
  status public.attempt_status not null default 'draft',
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  transcript text,
  transcript_meta jsonb,                -- confidence, segments, etc.
  response_meta jsonb,                  -- text-only flag, device info
  pins jsonb not null default '[]'::jsonb,
  audio_path text,                      -- Supabase Storage path, optional
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_attempts_touch on public.attempts;
create trigger trg_attempts_touch
before update on public.attempts
for each row execute function public.touch_updated_at();

create index if not exists idx_attempts_student on public.attempts(student_id);
create index if not exists idx_attempts_course on public.attempts(course_id);
create index if not exists idx_attempts_simver on public.attempts(simulation_version_id);

create table if not exists public.attempt_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_attempt_events_attempt on public.attempt_events(attempt_id);

create table if not exists public.attempt_feedback (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique references public.attempts(id) on delete cascade,
  instructor_id uuid not null references public.profiles(user_id) on delete cascade,
  rubric jsonb not null default '{}'::jsonb,
  overall_score numeric,
  comments text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_feedback_touch on public.attempt_feedback;
create trigger trg_feedback_touch
before update on public.attempt_feedback
for each row execute function public.touch_updated_at();

-- 5) Row Level Security (RLS)

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.course_instructors enable row level security;
alter table public.course_enrollments enable row level security;
alter table public.simulations enable row level security;
alter table public.simulation_versions enable row level security;
alter table public.course_simulations enable row level security;
alter table public.attempts enable row level security;
alter table public.attempt_events enable row level security;
alter table public.attempt_feedback enable row level security;

-- profiles
drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read"
on public.profiles for select
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update"
on public.profiles for update
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

-- courses: admin full; instructors can read courses they teach; students can read courses they are enrolled in
drop policy if exists "courses read membership" on public.courses;
create policy "courses read membership"
on public.courses for select
using (
  public.is_admin()
  or exists (select 1 from public.course_instructors ci where ci.course_id = courses.id and ci.instructor_id = auth.uid())
  or exists (select 1 from public.course_enrollments ce where ce.course_id = courses.id and ce.student_id = auth.uid())
);

drop policy if exists "courses admin write" on public.courses;
create policy "courses admin write"
on public.courses for all
using (public.is_admin())
with check (public.is_admin());

-- course_instructors
drop policy if exists "course_instructors read membership" on public.course_instructors;
create policy "course_instructors read membership"
on public.course_instructors for select
using (
  public.is_admin()
  or instructor_id = auth.uid()
);

drop policy if exists "course_instructors admin write" on public.course_instructors;
create policy "course_instructors admin write"
on public.course_instructors for all
using (public.is_admin())
with check (public.is_admin());

-- course_enrollments
drop policy if exists "course_enrollments read membership" on public.course_enrollments;
create policy "course_enrollments read membership"
on public.course_enrollments for select
using (
  public.is_admin()
  or student_id = auth.uid()
  or exists (select 1 from public.course_instructors ci where ci.course_id = course_enrollments.course_id and ci.instructor_id = auth.uid())
);

drop policy if exists "course_enrollments admin write" on public.course_enrollments;
create policy "course_enrollments admin write"
on public.course_enrollments for all
using (public.is_admin())
with check (public.is_admin());

-- simulations and versions
drop policy if exists "simulations read all" on public.simulations;
create poli
