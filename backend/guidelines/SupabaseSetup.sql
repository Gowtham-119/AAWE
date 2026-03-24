-- Run this in Supabase SQL Editor for project: nrrkwzjxjgvjnoiyeghc

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  student_email text not null,
  student_name text,
  roll_no text,
  course_code text not null,
  course_name text,
  semester text,
  academic_year text,
  attendance_date date not null,
  is_present boolean not null,
  faculty_email text,
  created_at timestamptz not null default now(),
  unique (student_email, course_code, attendance_date, semester)
);

create table if not exists public.marks_records (
  id uuid primary key default gen_random_uuid(),
  student_email text not null,
  student_name text,
  roll_no text,
  course_code text not null,
  course_name text,
  semester text,
  academic_year text,
  mid_term numeric(5,2) not null default 0,
  assignment numeric(5,2) not null default 0,
  quiz numeric(5,2) not null default 0,
  end_term numeric(5,2) not null default 0,
  total numeric(5,2) not null default 0,
  grade text,
  faculty_email text,
  updated_at timestamptz not null default now(),
  unique (student_email, course_code, semester)
);

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null check (role in ('admin', 'faculty', 'student')),
  display_name text,
  department text,
  phone text,
  designation text,
  joined_date date,
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

create table if not exists public.departments (
  code text primary key,
  name text not null,
  is_active boolean default true,
  created_at timestamptz default now()
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

insert into public.departments (code, name, is_active)
values
  ('AG', 'Agricultural Engineering', true),
  ('CS', 'Computer Science', true),
  ('IT', 'Information Technology', true)
on conflict (code)
do update set
  name = excluded.name,
  is_active = excluded.is_active;

alter table public.users add column if not exists is_active boolean not null default true;
alter table public.users add column if not exists login_count integer not null default 0;
alter table public.users add column if not exists last_login_at timestamptz;
alter table public.users add column if not exists updated_at timestamptz not null default now();

alter table public.user_profiles
add column if not exists department text;
alter table public.user_profiles add column if not exists phone text;
alter table public.user_profiles add column if not exists designation text;
alter table public.user_profiles add column if not exists joined_date date;

update public.students
set department = case
  when department is null or trim(department) = '' then null
  when upper(trim(department)) in ('AG', 'CS', 'IT') then upper(trim(department))
  when regexp_replace(upper(trim(department)), '[^A-Z]', '', 'g') in ('AGRICULTURALENGINEERING', 'AGRICULTURAL') then 'AG'
  when regexp_replace(upper(trim(department)), '[^A-Z]', '', 'g') in ('COMPUTERSCIENCE', 'CSE') then 'CS'
  when regexp_replace(upper(trim(department)), '[^A-Z]', '', 'g') = 'INFORMATIONTECHNOLOGY' then 'IT'
  else null
end;

alter table public.students
drop constraint if exists fk_student_dept;
alter table public.students
add constraint fk_student_dept
foreign key (department)
references public.departments(code);

create table if not exists public.class_assignments (
  id uuid primary key default gen_random_uuid(),
  student_email text not null,
  student_name text,
  roll_no text,
  department text not null,
  course_code text not null,
  course_name text,
  semester text,
  academic_year text,
  venue text,
  staff_name text,
  staff_email text,
  faculty_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_email, course_code, semester)
);

alter table public.class_assignments
add column if not exists staff_email text;

alter table public.attendance_records
add column if not exists semester text,
add column if not exists academic_year text;

alter table public.marks_records
add column if not exists semester text,
add column if not exists academic_year text;

alter table public.class_assignments
add column if not exists semester text,
add column if not exists academic_year text;

alter table public.attendance_records
drop constraint if exists attendance_records_student_email_course_code_attendance_date_key;
alter table public.attendance_records
drop constraint if exists attendance_records_student_email_course_code_attendance_date_semester_key;
alter table public.attendance_records
add constraint attendance_records_student_email_course_code_attendance_date_semester_key
unique (student_email, course_code, attendance_date, semester);

alter table public.marks_records
drop constraint if exists marks_records_student_email_course_code_key;
alter table public.marks_records
drop constraint if exists marks_records_student_email_course_code_semester_key;
alter table public.marks_records
add constraint marks_records_student_email_course_code_semester_key
unique (student_email, course_code, semester);

alter table public.class_assignments
drop constraint if exists class_assignments_student_email_course_code_key;
alter table public.class_assignments
drop constraint if exists class_assignments_student_email_course_code_semester_key;
alter table public.class_assignments
add constraint class_assignments_student_email_course_code_semester_key
unique (student_email, course_code, semester);

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

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_email text not null,
  actor_role text not null,
  action text not null,
  target_table text,
  target_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_attendance_student_email on public.attendance_records(student_email);
create index if not exists idx_attendance_course_code on public.attendance_records(course_code);
create index if not exists idx_attendance_date on public.attendance_records(attendance_date);
create index if not exists idx_attendance_faculty on public.attendance_records(faculty_email);

create index if not exists idx_marks_student_email on public.marks_records(student_email);
create index if not exists idx_marks_course_code on public.marks_records(course_code);

create index if not exists idx_class_assignments_student on public.class_assignments(student_email);
create index if not exists idx_class_assignments_dept on public.class_assignments(department);
create index if not exists idx_class_assignments_faculty on public.class_assignments(faculty_email);

create index if not exists idx_users_email on public.users(email);
create index if not exists idx_users_role on public.users(role);
create index if not exists idx_students_email on public.students(email);
create index if not exists idx_students_dept on public.students(department);

alter table public.attendance_records enable row level security;
alter table public.marks_records enable row level security;
alter table public.user_profiles enable row level security;
alter table public.class_assignments enable row level security;
alter table public.department_courses enable row level security;
alter table public.department_staff enable row level security;
alter table public.departments enable row level security;
alter table public.audit_logs enable row level security;
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

create or replace function public.get_current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.role
  from public.users u
  where lower(u.email) = public.current_auth_email()
    and u.is_active = true
  limit 1;
$$;

create or replace function public.is_current_user_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.get_current_user_role() is not null;
$$;

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.get_current_user_role() = 'admin';
$$;

create or replace function public.log_audit(
  actor_email text,
  actor_role text,
  action text,
  target_table text,
  target_id text,
  old_data jsonb,
  new_data jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_actor_email text;
  resolved_actor_role text;
begin
  resolved_actor_email := lower(coalesce(nullif(trim(actor_email), ''), public.current_auth_email()));
  resolved_actor_role := lower(coalesce(nullif(trim(actor_role), ''), public.get_current_user_role()));

  if coalesce(resolved_actor_email, '') = '' then
    return;
  end if;

  if coalesce(resolved_actor_role, '') = '' then
    return;
  end if;

  insert into public.audit_logs (
    actor_email,
    actor_role,
    action,
    target_table,
    target_id,
    old_data,
    new_data
  )
  values (
    resolved_actor_email,
    resolved_actor_role,
    action,
    target_table,
    target_id,
    old_data,
    new_data
  );
end;
$$;

revoke all on function public.log_audit(text, text, text, text, text, jsonb, jsonb) from public;
grant execute on function public.log_audit(text, text, text, text, text, jsonb, jsonb) to authenticated;

drop policy if exists "Allow anon full access attendance" on public.attendance_records;
create policy "Allow anon full access attendance"
on public.attendance_records
for all
to anon
using (false)
with check (false);

drop policy if exists "Allow authenticated full access attendance" on public.attendance_records;
drop policy if exists "attendance select by role" on public.attendance_records;
drop policy if exists "attendance insert by faculty or admin" on public.attendance_records;
drop policy if exists "attendance update by faculty or admin" on public.attendance_records;
drop policy if exists "attendance delete by admin" on public.attendance_records;

create policy "attendance select by role"
on public.attendance_records
for select
to authenticated
using (
  public.get_current_user_role() = 'admin'
  or (
    public.get_current_user_role() = 'student'
    and lower(student_email) = public.current_auth_email()
  )
  or (
    public.get_current_user_role() = 'faculty'
    and lower(faculty_email) = public.current_auth_email()
  )
);

create policy "attendance insert by faculty or admin"
on public.attendance_records
for insert
to authenticated
with check (
  public.get_current_user_role() = 'admin'
  or (
    public.get_current_user_role() = 'faculty'
    and lower(faculty_email) = public.current_auth_email()
  )
);

create policy "attendance update by faculty or admin"
on public.attendance_records
for update
to authenticated
using (
  public.get_current_user_role() = 'admin'
  or (
    public.get_current_user_role() = 'faculty'
    and lower(faculty_email) = public.current_auth_email()
  )
)
with check (
  public.get_current_user_role() = 'admin'
  or (
    public.get_current_user_role() = 'faculty'
    and lower(faculty_email) = public.current_auth_email()
  )
);

create policy "attendance delete by admin"
on public.attendance_records
for delete
to authenticated
using (public.get_current_user_role() = 'admin');

drop policy if exists "Allow anon full access marks" on public.marks_records;
create policy "Allow anon full access marks"
on public.marks_records
for all
to anon
using (false)
with check (false);

drop policy if exists "Allow authenticated full access marks" on public.marks_records;
drop policy if exists "marks select by role" on public.marks_records;
drop policy if exists "marks insert by faculty or admin" on public.marks_records;
drop policy if exists "marks update by faculty or admin" on public.marks_records;
drop policy if exists "marks delete by admin" on public.marks_records;

create policy "marks select by role"
on public.marks_records
for select
to authenticated
using (
  public.get_current_user_role() = 'admin'
  or (
    public.get_current_user_role() = 'student'
    and lower(student_email) = public.current_auth_email()
  )
  or (
    public.get_current_user_role() = 'faculty'
    and lower(faculty_email) = public.current_auth_email()
  )
);

create policy "marks insert by faculty or admin"
on public.marks_records
for insert
to authenticated
with check (
  public.get_current_user_role() = 'admin'
  or (
    public.get_current_user_role() = 'faculty'
    and lower(faculty_email) = public.current_auth_email()
  )
);

create policy "marks update by faculty or admin"
on public.marks_records
for update
to authenticated
using (
  public.get_current_user_role() = 'admin'
  or (
    public.get_current_user_role() = 'faculty'
    and lower(faculty_email) = public.current_auth_email()
  )
)
with check (
  public.get_current_user_role() = 'admin'
  or (
    public.get_current_user_role() = 'faculty'
    and lower(faculty_email) = public.current_auth_email()
  )
);

create policy "marks delete by admin"
on public.marks_records
for delete
to authenticated
using (public.get_current_user_role() = 'admin');

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
drop policy if exists "class assignments select by role" on public.class_assignments;
drop policy if exists "class assignments insert by faculty or admin" on public.class_assignments;
drop policy if exists "class assignments update by faculty or admin" on public.class_assignments;
drop policy if exists "class assignments delete by faculty or admin" on public.class_assignments;

create policy "class assignments select by role"
on public.class_assignments
for select
to authenticated
using (
  public.get_current_user_role() = 'admin'
  or (
    public.get_current_user_role() = 'student'
    and lower(student_email) = public.current_auth_email()
  )
  or (
    public.get_current_user_role() = 'faculty'
    and exists (
      select 1
      from public.user_profiles up
      where lower(up.email) = public.current_auth_email()
        and upper(coalesce(up.department, '')) = upper(coalesce(class_assignments.department, ''))
    )
  )
);

create policy "class assignments insert by faculty or admin"
on public.class_assignments
for insert
to authenticated
with check (public.get_current_user_role() in ('faculty', 'admin'));

create policy "class assignments update by faculty or admin"
on public.class_assignments
for update
to authenticated
using (public.get_current_user_role() in ('faculty', 'admin'))
with check (public.get_current_user_role() in ('faculty', 'admin'));

create policy "class assignments delete by faculty or admin"
on public.class_assignments
for delete
to authenticated
using (public.get_current_user_role() in ('faculty', 'admin'));

drop policy if exists "Allow anon full access department courses" on public.department_courses;
create policy "Allow anon full access department courses"
on public.department_courses
for all
to anon
using (false)
with check (false);

drop policy if exists "Allow authenticated full access department courses" on public.department_courses;
drop policy if exists "department courses select active users" on public.department_courses;
drop policy if exists "department courses insert admin" on public.department_courses;
drop policy if exists "department courses update admin" on public.department_courses;
drop policy if exists "department courses delete admin" on public.department_courses;

create policy "department courses select active users"
on public.department_courses
for select
to authenticated
using (public.get_current_user_role() in ('student', 'faculty', 'admin'));

create policy "department courses insert admin"
on public.department_courses
for insert
to authenticated
with check (public.get_current_user_role() = 'admin');

create policy "department courses update admin"
on public.department_courses
for update
to authenticated
using (public.get_current_user_role() = 'admin')
with check (public.get_current_user_role() = 'admin');

create policy "department courses delete admin"
on public.department_courses
for delete
to authenticated
using (public.get_current_user_role() = 'admin');

drop policy if exists "Allow anon full access department staff" on public.department_staff;
create policy "Allow anon full access department staff"
on public.department_staff
for all
to anon
using (false)
with check (false);

drop policy if exists "Allow authenticated full access department staff" on public.department_staff;
drop policy if exists "department staff select active users" on public.department_staff;
drop policy if exists "department staff insert admin" on public.department_staff;
drop policy if exists "department staff update admin" on public.department_staff;
drop policy if exists "department staff delete admin" on public.department_staff;

create policy "department staff select active users"
on public.department_staff
for select
to authenticated
using (public.get_current_user_role() in ('student', 'faculty', 'admin'));

create policy "department staff insert admin"
on public.department_staff
for insert
to authenticated
with check (public.get_current_user_role() = 'admin');

create policy "department staff update admin"
on public.department_staff
for update
to authenticated
using (public.get_current_user_role() = 'admin')
with check (public.get_current_user_role() = 'admin');

create policy "department staff delete admin"
on public.department_staff
for delete
to authenticated
using (public.get_current_user_role() = 'admin');

drop policy if exists "Allow anon full access departments" on public.departments;
create policy "Allow anon full access departments"
on public.departments
for all
to anon
using (false)
with check (false);

drop policy if exists "departments select active users" on public.departments;
drop policy if exists "departments insert admin" on public.departments;
drop policy if exists "departments update admin" on public.departments;
drop policy if exists "departments delete admin" on public.departments;

create policy "departments select active users"
on public.departments
for select
to authenticated
using (public.get_current_user_role() in ('student', 'faculty', 'admin'));

create policy "departments insert admin"
on public.departments
for insert
to authenticated
with check (public.get_current_user_role() = 'admin');

create policy "departments update admin"
on public.departments
for update
to authenticated
using (public.get_current_user_role() = 'admin')
with check (public.get_current_user_role() = 'admin');

create policy "departments delete admin"
on public.departments
for delete
to authenticated
using (public.get_current_user_role() = 'admin');

drop policy if exists "audit logs deny anon" on public.audit_logs;
create policy "audit logs deny anon"
on public.audit_logs
for all
to anon
using (false)
with check (false);

drop policy if exists "audit logs admin select" on public.audit_logs;
create policy "audit logs admin select"
on public.audit_logs
for select
to authenticated
using (public.get_current_user_role() = 'admin');

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
drop policy if exists "students select active users" on public.students;
drop policy if exists "students insert own or admin" on public.students;
drop policy if exists "students update own or admin" on public.students;
drop policy if exists "students delete admin" on public.students;

drop policy if exists "Admin write students" on public.students;
drop policy if exists "Student update own profile" on public.students;
drop policy if exists "Student insert own profile" on public.students;

create policy "students select active users"
on public.students
for select
to authenticated
using (public.get_current_user_role() in ('student', 'faculty', 'admin'));

create policy "students insert own or admin"
on public.students
for insert
to authenticated
with check (
  public.get_current_user_role() = 'admin'
  or (
    public.get_current_user_role() = 'student'
    and lower(email) = public.current_auth_email()
  )
);

create policy "students update own or admin"
on public.students
for update
to authenticated
using (
  public.get_current_user_role() = 'admin'
  or (
    public.get_current_user_role() = 'student'
    and lower(email) = public.current_auth_email()
  )
)
with check (
  public.get_current_user_role() = 'admin'
  or (
    public.get_current_user_role() = 'student'
    and lower(email) = public.current_auth_email()
  )
);

create policy "students delete admin"
on public.students
for delete
to authenticated
using (public.get_current_user_role() = 'admin');

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
  ('current_semester', to_jsonb('2024-ODD'::text)),
  ('maintenance_mode', 'false'::jsonb),
  ('maintenance_message', to_jsonb('System is under maintenance. Please try again later.'::text)),
  ('support_contact', to_jsonb('admin@university.edu'::text))
on conflict (setting_key)
do update set
  setting_value = excluded.setting_value,
  updated_at = now();

-- ============================================================
-- notifications
-- ============================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_email text not null,
  title text not null,
  body text,
  type text not null default 'info' check (type in ('info', 'warning', 'success', 'error')),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_recipient_read_created
  on public.notifications(recipient_email, is_read, created_at desc);

alter table public.notifications enable row level security;

-- add table to supabase realtime publication so postgres_changes works
alter publication supabase_realtime add table public.notifications;

-- deny all anon access
drop policy if exists "notifications deny anon" on public.notifications;
create policy "notifications deny anon"
on public.notifications
for all
to anon
using (false)
with check (false);

-- authenticated users can read their own notifications
drop policy if exists "notifications select own" on public.notifications;
create policy "notifications select own"
on public.notifications
for select
to authenticated
using (lower(recipient_email) = public.current_auth_email());

-- authenticated users can mark their own notifications as read
drop policy if exists "notifications update own" on public.notifications;
create policy "notifications update own"
on public.notifications
for update
to authenticated
using (lower(recipient_email) = public.current_auth_email())
with check (lower(recipient_email) = public.current_auth_email());

-- only admins can send (insert) notifications
drop policy if exists "notifications insert admin" on public.notifications;
create policy "notifications insert admin"
on public.notifications
for insert
to authenticated
with check (public.get_current_user_role() = 'admin');

-- ============================================================
-- timetable
-- ============================================================
create table if not exists public.timetable_entries (
  id uuid primary key default gen_random_uuid(),
  day_of_week text not null check (upper(day_of_week) in ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY')),
  start_time time not null,
  end_time time not null,
  department text not null,
  course_code text not null,
  course_name text,
  venue text,
  faculty_email text,
  faculty_name text,
  staff_email text,
  semester text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department, semester, day_of_week, start_time, course_code)
);

create index if not exists idx_timetable_department_semester
  on public.timetable_entries(department, semester);
create index if not exists idx_timetable_faculty_semester
  on public.timetable_entries(faculty_email, semester);

alter table public.timetable_entries enable row level security;

drop policy if exists "timetable deny anon" on public.timetable_entries;
create policy "timetable deny anon"
on public.timetable_entries
for all
to anon
using (false)
with check (false);

drop policy if exists "timetable select authenticated" on public.timetable_entries;
create policy "timetable select authenticated"
on public.timetable_entries
for select
to authenticated
using (public.get_current_user_role() in ('student', 'faculty', 'admin'));

drop policy if exists "timetable insert faculty admin" on public.timetable_entries;
create policy "timetable insert faculty admin"
on public.timetable_entries
for insert
to authenticated
with check (
  public.get_current_user_role() = 'admin'
  or (
    public.get_current_user_role() = 'faculty'
    and lower(coalesce(faculty_email, '')) = public.current_auth_email()
  )
);

drop policy if exists "timetable update faculty admin" on public.timetable_entries;
create policy "timetable update faculty admin"
on public.timetable_entries
for update
to authenticated
using (
  public.get_current_user_role() = 'admin'
  or (
    public.get_current_user_role() = 'faculty'
    and lower(coalesce(faculty_email, '')) = public.current_auth_email()
  )
)
with check (
  public.get_current_user_role() = 'admin'
  or (
    public.get_current_user_role() = 'faculty'
    and lower(coalesce(faculty_email, '')) = public.current_auth_email()
  )
);

drop policy if exists "timetable delete faculty admin" on public.timetable_entries;
create policy "timetable delete faculty admin"
on public.timetable_entries
for delete
to authenticated
using (
  public.get_current_user_role() = 'admin'
  or (
    public.get_current_user_role() = 'faculty'
    and lower(coalesce(faculty_email, '')) = public.current_auth_email()
  )
);

-- ============================================================
-- notices
-- ============================================================
create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  target_role text not null default 'all' check (target_role in ('all', 'student', 'faculty', 'admin')),
  start_date date not null default current_date,
  end_date date,
  is_active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_notices_role_active_dates
  on public.notices(target_role, is_active, start_date, end_date);

alter table public.notices enable row level security;

drop policy if exists "notices deny anon" on public.notices;
create policy "notices deny anon"
on public.notices
for all
to anon
using (false)
with check (false);

drop policy if exists "notices select authenticated" on public.notices;
create policy "notices select authenticated"
on public.notices
for select
to authenticated
using (public.get_current_user_role() in ('student', 'faculty', 'admin'));

drop policy if exists "notices write admin" on public.notices;
create policy "notices write admin"
on public.notices
for all
to authenticated
using (public.get_current_user_role() = 'admin')
with check (public.get_current_user_role() = 'admin');
