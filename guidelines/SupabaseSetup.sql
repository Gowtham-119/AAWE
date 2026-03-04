-- Run this in Supabase SQL Editor for project: nrrkwzjxjgvjnoiyeghc

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  student_email text not null,
  student_name text,
  roll_no text,
  course_code text not null,
  course_name text,
  attendance_date date not null,
  is_present boolean not null,
  faculty_email text,
  created_at timestamptz not null default now(),
  unique (student_email, course_code, attendance_date)
);

create table if not exists public.marks_records (
  id uuid primary key default gen_random_uuid(),
  student_email text not null,
  student_name text,
  roll_no text,
  course_code text not null,
  course_name text,
  mid_term numeric(5,2) not null default 0,
  assignment numeric(5,2) not null default 0,
  quiz numeric(5,2) not null default 0,
  end_term numeric(5,2) not null default 0,
  total numeric(5,2) not null default 0,
  grade text,
  faculty_email text,
  updated_at timestamptz not null default now(),
  unique (student_email, course_code)
);

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null check (role in ('admin', 'faculty', 'student')),
  display_name text,
  department text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null check (role in ('student', 'faculty', 'admin')),
  is_active boolean not null default true,
  login_count integer not null default 0,
  last_login_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  register_no text primary key,
  name text,
  email text not null unique,
  mobile_no text,
  department text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users add column if not exists is_active boolean not null default true;
alter table public.users add column if not exists login_count integer not null default 0;
alter table public.users add column if not exists last_login_at timestamptz;
alter table public.users add column if not exists updated_at timestamptz not null default now();

alter table public.user_profiles
add column if not exists department text;

create table if not exists public.class_assignments (
  id uuid primary key default gen_random_uuid(),
  student_email text not null,
  student_name text,
  roll_no text,
  department text not null,
  course_code text not null,
  course_name text,
  venue text,
  staff_name text,
  staff_email text,
  faculty_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_email, course_code)
);

alter table public.class_assignments
add column if not exists staff_email text;

create table if not exists public.department_courses (
  id uuid primary key default gen_random_uuid(),
  department text not null,
  course_code text not null,
  course_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department, course_code)
);

create table if not exists public.department_staff (
  id uuid primary key default gen_random_uuid(),
  department text not null,
  staff_name text not null,
  staff_email text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department, staff_email)
);

create table if not exists public.system_settings (
  setting_key text primary key,
  setting_value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.attendance_records enable row level security;
alter table public.marks_records enable row level security;
alter table public.user_profiles enable row level security;
alter table public.class_assignments enable row level security;
alter table public.department_courses enable row level security;
alter table public.department_staff enable row level security;
alter table public.users enable row level security;
alter table public.system_settings enable row level security;
alter table public.students enable row level security;

create or replace function public.current_auth_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.is_current_user_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where lower(u.email) = public.current_auth_email()
      and u.is_active = true
  );
$$;

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where lower(u.email) = public.current_auth_email()
      and u.is_active = true
      and u.role = 'admin'
  );
$$;

drop policy if exists "Allow anon full access attendance" on public.attendance_records;
create policy "Allow anon full access attendance"
on public.attendance_records
for all
to anon
using (false)
with check (false);

drop policy if exists "Allow authenticated full access attendance" on public.attendance_records;
create policy "Allow authenticated full access attendance"
on public.attendance_records
for all
to authenticated
using (public.is_current_user_active())
with check (public.is_current_user_active());

drop policy if exists "Allow anon full access marks" on public.marks_records;
create policy "Allow anon full access marks"
on public.marks_records
for all
to anon
using (false)
with check (false);

drop policy if exists "Allow authenticated full access marks" on public.marks_records;
create policy "Allow authenticated full access marks"
on public.marks_records
for all
to authenticated
using (public.is_current_user_active())
with check (public.is_current_user_active());

drop policy if exists "Allow anon full access user profiles" on public.user_profiles;
create policy "Allow anon full access user profiles"
on public.user_profiles
for all
to anon
using (false)
with check (false);

drop policy if exists "Allow authenticated full access user profiles" on public.user_profiles;
create policy "Allow authenticated full access user profiles"
on public.user_profiles
for all
to authenticated
using (public.is_current_user_active())
with check (public.is_current_user_active());

drop policy if exists "Allow anon full access class assignments" on public.class_assignments;
create policy "Allow anon full access class assignments"
on public.class_assignments
for all
to anon
using (false)
with check (false);

drop policy if exists "Allow authenticated full access class assignments" on public.class_assignments;
create policy "Allow authenticated full access class assignments"
on public.class_assignments
for all
to authenticated
using (public.is_current_user_active())
with check (public.is_current_user_active());

drop policy if exists "Allow anon full access department courses" on public.department_courses;
create policy "Allow anon full access department courses"
on public.department_courses
for all
to anon
using (false)
with check (false);

drop policy if exists "Allow authenticated full access department courses" on public.department_courses;
create policy "Allow authenticated full access department courses"
on public.department_courses
for all
to authenticated
using (public.is_current_user_active())
with check (public.is_current_user_active());

drop policy if exists "Allow anon full access department staff" on public.department_staff;
create policy "Allow anon full access department staff"
on public.department_staff
for all
to anon
using (false)
with check (false);

drop policy if exists "Allow authenticated full access department staff" on public.department_staff;
create policy "Allow authenticated full access department staff"
on public.department_staff
for all
to authenticated
using (public.is_current_user_active())
with check (public.is_current_user_active());

drop policy if exists "Allow anon full access users" on public.users;
create policy "Allow anon full access users"
on public.users
for all
to anon
using (false)
with check (false);

drop policy if exists "Allow authenticated full access users" on public.users;
create policy "Allow authenticated full access users"
on public.users
for all
to authenticated
using (false)
with check (false);

drop policy if exists "Authenticated read users" on public.users;
create policy "Authenticated read users"
on public.users
for select
to authenticated
using (
  public.is_current_user_admin()
  or lower(email) = public.current_auth_email()
);

drop policy if exists "Authenticated update users" on public.users;
create policy "Authenticated update users"
on public.users
for update
to authenticated
using (
  public.is_current_user_admin()
  or lower(email) = public.current_auth_email()
)
with check (
  public.is_current_user_admin()
  or lower(email) = public.current_auth_email()
);

drop policy if exists "Admin insert users" on public.users;
create policy "Admin insert users"
on public.users
for insert
to authenticated
with check (public.is_current_user_admin());

drop policy if exists "Authenticated insert own users" on public.users;
create policy "Authenticated insert own users"
on public.users
for insert
to authenticated
with check (
  lower(email) = public.current_auth_email()
  and role in ('student', 'faculty')
);

drop policy if exists "Admin delete users" on public.users;
create policy "Admin delete users"
on public.users
for delete
to authenticated
using (public.is_current_user_admin());

drop policy if exists "No anon students access" on public.students;
create policy "No anon students access"
on public.students
for all
to anon
using (false)
with check (false);

drop policy if exists "Authenticated read students" on public.students;
create policy "Authenticated read students"
on public.students
for select
to authenticated
using (public.is_current_user_active());

drop policy if exists "Admin write students" on public.students;
create policy "Admin write students"
on public.students
for all
to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

drop policy if exists "Student update own profile" on public.students;
create policy "Student update own profile"
on public.students
for update
to authenticated
using (lower(email) = public.current_auth_email())
with check (lower(email) = public.current_auth_email());

drop policy if exists "Student insert own profile" on public.students;
create policy "Student insert own profile"
on public.students
for insert
to authenticated
with check (lower(email) = public.current_auth_email());

drop policy if exists "No anon system settings" on public.system_settings;
create policy "No anon system settings"
on public.system_settings
for all
to anon
using (false)
with check (false);

drop policy if exists "Anon read maintenance settings" on public.system_settings;
create policy "Anon read maintenance settings"
on public.system_settings
for select
to anon
using (setting_key in ('maintenance_mode', 'maintenance_message', 'support_contact'));

drop policy if exists "Authenticated read system settings" on public.system_settings;
create policy "Authenticated read system settings"
on public.system_settings
for select
to authenticated
using (public.is_current_user_active());

drop policy if exists "Admin write system settings" on public.system_settings;
create policy "Admin write system settings"
on public.system_settings
for all
to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

insert into public.user_profiles (email, role, display_name, department)
values ('gowtham25m@gmail.com', 'faculty', 'Gowtham', 'AG')
on conflict (email)
do update set
  role = excluded.role,
  display_name = excluded.display_name,
  department = excluded.department,
  updated_at = now();

insert into public.users (email, role)
values
  ('admin@university.edu', 'admin'),
  ('faculty@university.edu', 'faculty'),
  ('gowtham25m@gmail.com', 'faculty'),
  ('alice@university.edu', 'student')
on conflict (email)
do update set
  role = excluded.role,
  is_active = true,
  updated_at = now();

insert into public.users (email, role, is_active)
select lower(s.email), 'student', true
from public.students s
where coalesce(trim(s.email), '') <> ''
on conflict (email)
do update set
  is_active = true,
  updated_at = now();

insert into public.users (email, role, is_active)
select lower(up.email), up.role, true
from public.user_profiles up
where coalesce(trim(up.email), '') <> ''
  and up.role in ('student', 'faculty', 'admin')
on conflict (email)
do update set
  role = excluded.role,
  is_active = true,
  updated_at = now();

insert into public.system_settings (setting_key, setting_value)
values
  ('allow_google_student', 'true'::jsonb),
  ('allow_google_faculty', 'true'::jsonb),
  ('allow_password_admin', 'true'::jsonb),
  ('enforce_active_user_access', 'true'::jsonb),
  ('maintenance_mode', 'false'::jsonb),
  ('maintenance_message', to_jsonb('System is under maintenance. Please try again later.'::text)),
  ('support_contact', to_jsonb('admin@university.edu'::text))
on conflict (setting_key)
do update set
  setting_value = excluded.setting_value,
  updated_at = now();
