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
  course_code text not null unique,          -- "PSY220"
  subject text not null,                     -- "PSY"
  number text not null,                      -- "220"
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_courses_touch on public.courses;
create trigger trg_courses_touch
before update on public.courses
for each row execute function public.touch_updated_at();

create table if not exists public.terms (
  id uuid primary key default gen_random_uuid(),
  term_code text not null unique,            -- "FA1", "SP2"
  year int,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_terms_touch on public.terms;
create trigger trg_terms_touch
before update on public.terms
for each row execute function public.touch_updated_at();

create table if not exists public.course_offerings (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  term_id uuid not null references public.terms(id) on delete cascade,
  section text not null,
  offering_code text not null unique,        -- "PSY220_FA1_200"
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_course_offerings_touch on public.course_offerings;
create trigger trg_course_offerings_touch
before update on public.course_offerings
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

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references public.course_offerings(id) on delete cascade,
  simulation_version_id uuid not null references public.simulation_versions(id) on delete restrict,
  title text not null,
  opens_at timestamptz,
  due_at timestamptz,
  closed_at timestamptz,
  closed_by uuid references public.profiles(user_id),
  max_submissions int,
  allow_resubmissions boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_activities_touch on public.activities;
create trigger trg_activities_touch
before update on public.activities
for each row execute function public.touch_updated_at();

-- 4) Attempts and instructor feedback

do $$ begin
  create type public.attempt_status as enum ('draft', 'submitted', 'graded');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  simulation_version_id uuid not null references public.simulation_versions(id) on delete restrict,
  student_id uuid not null references public.profiles(user_id) on delete cascade,
  status public.attempt_status not null default 'draft',
  attempt_no int not null,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  transcript text,
  transcript_meta jsonb,                -- confidence, segments, etc.
  response_meta jsonb,                  -- text-only flag, device info
  pins jsonb not null default '[]'::jsonb,
  audio_path text,                      -- Supabase Storage path, optional
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (activity_id, student_id, attempt_no)
);

drop trigger if exists trg_attempts_touch on public.attempts;
create trigger trg_attempts_touch
before update on public.attempts
for each row execute function public.touch_updated_at();

create or replace function public.activity_is_open(activity_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.activities a
    where a.id = activity_is_open.activity_id
      and (a.opens_at is null or a.opens_at <= now())
      and (a.due_at is null or now() <= a.due_at)
      and a.closed_at is null
  );
$$;

create or replace function public.next_attempt_no(activity_id uuid, student_id uuid)
returns int
language sql
stable
as $$
  select coalesce(max(attempt_no), 0) + 1
  from public.attempts a
  where a.activity_id = next_attempt_no.activity_id
    and a.student_id = next_attempt_no.student_id;
$$;

create index if not exists idx_attempts_student on public.attempts(student_id);
create index if not exists idx_attempts_activity on public.attempts(activity_id);
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
  created_by uuid not null references public.profiles(user_id) on delete cascade,
  feedback jsonb not null default '{}'::jsonb,
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
alter table public.terms enable row level security;
alter table public.course_offerings enable row level security;
alter table public.course_instructors enable row level security;
alter table public.course_enrollments enable row level security;
alter table public.simulations enable row level security;
alter table public.simulation_versions enable row level security;
alter table public.course_simulations enable row level security;
alter table public.activities enable row level security;
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

drop policy if exists "terms readable" on public.terms;
create policy "terms readable"
on public.terms for select
using (auth.uid() is not null);

drop policy if exists "terms admin write" on public.terms;
create policy "terms admin write"
on public.terms for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "course_offerings read membership" on public.course_offerings;
create policy "course_offerings read membership"
on public.course_offerings for select
using (
  public.is_admin()
  or exists (select 1 from public.course_instructors ci where ci.course_id = course_offerings.course_id and ci.instructor_id = auth.uid())
  or exists (select 1 from public.course_enrollments ce where ce.course_id = course_offerings.course_id and ce.student_id = auth.uid())
);

drop policy if exists "course_offerings admin write" on public.course_offerings;
create policy "course_offerings admin write"
on public.course_offerings for all
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
create policy "simulations read all"
on public.simulations for select
using (true);

drop policy if exists "simulations admin write" on public.simulations;
create policy "simulations admin write"
on public.simulations for all
using (public.is_admin())
with check (public.is_admin());

-- versions: anyone can read published; admin can read all and write
drop policy if exists "sim_versions read published" on public.simulation_versions;
create policy "sim_versions read published"
on public.simulation_versions for select
using (status = 'published' or public.is_admin());

drop policy if exists "sim_versions admin write" on public.simulation_versions;
create policy "sim_versions admin write"
on public.simulation_versions for all
using (public.is_admin())
with check (public.is_admin());

-- course_simulations: students/instructors can read if in the course; admin writes
drop policy if exists "course_simulations read membership" on public.course_simulations;
create policy "course_simulations read membership"
on public.course_simulations for select
using (
  public.is_admin()
  or exists (select 1 from public.course_instructors ci where ci.course_id = course_simulations.course_id and ci.instructor_id = auth.uid())
  or exists (select 1 from public.course_enrollments ce where ce.course_id = course_simulations.course_id and ce.student_id = auth.uid())
);

drop policy if exists "course_simulations admin write" on public.course_simulations;
create policy "course_simulations admin write"
on public.course_simulations for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "activities read membership" on public.activities;
create policy "activities read membership"
on public.activities for select
using (
  public.is_admin()
  or exists (
    select 1 from public.course_offerings co
    join public.course_enrollments ce on ce.course_id = co.course_id
    where co.id = activities.offering_id
      and ce.student_id = auth.uid()
  )
  or exists (
    select 1 from public.course_offerings co
    join public.course_instructors ci on ci.course_id = co.course_id
    where co.id = activities.offering_id
      and ci.instructor_id = auth.uid()
  )
);

drop policy if exists "activities manage instructors" on public.activities;
create policy "activities manage instructors"
on public.activities for all
using (
  public.is_admin()
  or exists (
    select 1 from public.course_offerings co
    join public.course_instructors ci on ci.course_id = co.course_id
    where co.id = activities.offering_id
      and ci.instructor_id = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.course_offerings co
    join public.course_instructors ci on ci.course_id = co.course_id
    where co.id = activities.offering_id
      and ci.instructor_id = auth.uid()
  )
);

-- attempts: students see their own; instructors see attempts for courses they teach; admin sees all
drop policy if exists "attempts read membership" on public.attempts;
create policy "attempts read membership"
on public.attempts for select
using (
  public.is_admin()
  or student_id = auth.uid()
  or exists (
    select 1 from public.course_instructors ci
    join public.activities a on a.id = attempts.activity_id
    join public.course_offerings co on co.id = a.offering_id
    where ci.course_id = co.course_id
      and ci.instructor_id = auth.uid()
  )
);

drop policy if exists "attempts student insert" on public.attempts;
create policy "attempts student insert"
on public.attempts for insert
with check (
  student_id = auth.uid()
  and exists (
    select 1 from public.activities a
    join public.course_offerings co on co.id = a.offering_id
    join public.course_enrollments ce on ce.course_id = co.course_id
    where a.id = attempts.activity_id
      and ce.student_id = auth.uid()
  )
  and public.activity_is_open(activity_id)
  and (
    exists (
      select 1
      from public.activities a
      where a.id = attempts.activity_id
        and (a.allow_resubmissions or not exists (
          select 1 from public.attempts prev
          where prev.activity_id = attempts.activity_id
            and prev.student_id = auth.uid()
        ))
        and (a.max_submissions is null or public.next_attempt_no(attempts.activity_id, auth.uid()) <= a.max_submissions)
    )
  )
);

drop policy if exists "attempts student update own draft" on public.attempts;
create policy "attempts student update own draft"
on public.attempts for update
using (student_id = auth.uid())
with check (
  student_id = auth.uid()
  and (
    status = 'draft'
    or (status = 'submitted' and public.activity_is_open(activity_id))
  )
);

drop policy if exists "attempts instructor grade" on public.attempts;
create policy "attempts instructor grade"
on public.attempts for update
using (
  public.is_admin()
  or exists (
    select 1 from public.course_instructors ci
    join public.activities a on a.id = attempts.activity_id
    join public.course_offerings co on co.id = a.offering_id
    where ci.course_id = co.course_id
      and ci.instructor_id = auth.uid()
  )
)
with check (true);

-- attempt_events: read same as attempts; insert allowed for attempt owner while draft
drop policy if exists "attempt_events read membership" on public.attempt_events;
create policy "attempt_events read membership"
on public.attempt_events for select
using (
  public.is_admin()
  or exists (
    select 1 from public.attempts a
    where a.id = attempt_events.attempt_id
      and (
        a.student_id = auth.uid()
        or exists (
          select 1 from public.course_instructors ci
          join public.activities act on act.id = a.activity_id
          join public.course_offerings co on co.id = act.offering_id
          where ci.course_id = co.course_id and ci.instructor_id = auth.uid()
        )
      )
  )
);

drop policy if exists "attempt_events insert by student draft" on public.attempt_events;
create policy "attempt_events insert by student draft"
on public.attempt_events for insert
with check (
  exists (
    select 1 from public.attempts a
    where a.id = attempt_events.attempt_id
      and a.student_id = auth.uid()
      and a.status = 'draft'
  )
);

-- feedback: instructors/admin can write for attempts they can see; students can read for their attempts
drop policy if exists "feedback read membership" on public.attempt_feedback;
create policy "feedback read membership"
on public.attempt_feedback for select
using (
  public.is_admin()
  or exists (
    select 1 from public.attempts a
    where a.id = attempt_feedback.attempt_id
      and (
        a.student_id = auth.uid()
        or public.is_instructor()
      )
  )
);

drop policy if exists "feedback write instructor" on public.attempt_feedback;
create policy "feedback write instructor"
on public.attempt_feedback for insert
with check (
  (public.is_admin() or public.is_instructor())
  and created_by = auth.uid()
);

drop policy if exists "feedback update instructor" on public.attempt_feedback;
create policy "feedback update instructor"
on public.attempt_feedback for update
using (
  public.is_admin()
  or created_by = auth.uid()
)
with check (public.is_admin() or created_by = auth.uid());

-- Instructor review policies for simplified attempt storage (user_id-based)
-- The React instructor UI reads attempts plus their responses and events, and writes feedback
-- as a JSON blob. These helpers assume attempts.user_id stores the student id used by the app.

create table if not exists public.attempt_responses (
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  response_key text not null,
  response_text text,
  response_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (attempt_id, response_key)
);

alter table public.attempt_responses enable row level security;

drop policy if exists "attempt_responses read submitted" on public.attempt_responses;
create policy "attempt_responses read submitted"
on public.attempt_responses for select
using (
  public.is_admin()
  or exists (
    select 1 from public.attempts a
    where a.id = attempt_responses.attempt_id
      and (
        a.student_id = auth.uid()
        or (a.status = 'submitted' and public.is_instructor())
      )
  )
);

drop policy if exists "attempt_responses write student" on public.attempt_responses;
create policy "attempt_responses write student"
on public.attempt_responses for all
using (
  exists (
    select 1 from public.attempts a
    where a.id = attempt_responses.attempt_id
      and a.student_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.attempts a
    where a.id = attempt_responses.attempt_id
      and a.student_id = auth.uid()
  )
);

