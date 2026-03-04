-- Sample seed data for student view testing
-- Login as role: student
-- Use email: alice@university.edu

insert into public.attendance_records (
  student_email,
  student_name,
  roll_no,
  course_code,
  course_name,
  attendance_date,
  is_present,
  faculty_email
)
values
  ('alice@university.edu', 'Alice Johnson', 'CS2021001', 'CS301', 'Data Structures & Algorithms', '2026-02-20', true,  'faculty@university.edu'),
  ('alice@university.edu', 'Alice Johnson', 'CS2021001', 'CS301', 'Data Structures & Algorithms', '2026-02-21', true,  'faculty@university.edu'),
  ('alice@university.edu', 'Alice Johnson', 'CS2021001', 'CS301', 'Data Structures & Algorithms', '2026-02-22', false, 'faculty@university.edu'),
  ('alice@university.edu', 'Alice Johnson', 'CS2021001', 'CS402', 'Database Management Systems', '2026-02-20', true,  'faculty@university.edu'),
  ('alice@university.edu', 'Alice Johnson', 'CS2021001', 'CS402', 'Database Management Systems', '2026-02-21', true,  'faculty@university.edu'),
  ('alice@university.edu', 'Alice Johnson', 'CS2021001', 'CS402', 'Database Management Systems', '2026-02-22', true,  'faculty@university.edu'),
  ('alice@university.edu', 'Alice Johnson', 'CS2021001', 'CS303', 'Operating Systems', '2026-02-20', true,  'faculty@university.edu'),
  ('alice@university.edu', 'Alice Johnson', 'CS2021001', 'CS303', 'Operating Systems', '2026-02-21', false, 'faculty@university.edu'),
  ('alice@university.edu', 'Alice Johnson', 'CS2021001', 'CS303', 'Operating Systems', '2026-02-22', true,  'faculty@university.edu')
on conflict (student_email, course_code, attendance_date)
do update set
  is_present = excluded.is_present,
  student_name = excluded.student_name,
  roll_no = excluded.roll_no,
  course_name = excluded.course_name,
  faculty_email = excluded.faculty_email;

insert into public.marks_records (
  student_email,
  student_name,
  roll_no,
  course_code,
  course_name,
  mid_term,
  assignment,
  quiz,
  end_term,
  total,
  grade,
  faculty_email
)
values
  ('alice@university.edu', 'Alice Johnson', 'CS2021001', 'CS301', 'Data Structures & Algorithms', 85, 90, 88, 87, 87.2, 'A',  'faculty@university.edu'),
  ('alice@university.edu', 'Alice Johnson', 'CS2021001', 'CS402', 'Database Management Systems', 78, 82, 75, 80, 79.3, 'B+', 'faculty@university.edu'),
  ('alice@university.edu', 'Alice Johnson', 'CS2021001', 'CS303', 'Operating Systems', 82, 85, 80, 83, 82.5, 'A-', 'faculty@university.edu')
on conflict (student_email, course_code)
do update set
  mid_term = excluded.mid_term,
  assignment = excluded.assignment,
  quiz = excluded.quiz,
  end_term = excluded.end_term,
  total = excluded.total,
  grade = excluded.grade,
  student_name = excluded.student_name,
  roll_no = excluded.roll_no,
  course_name = excluded.course_name,
  faculty_email = excluded.faculty_email,
  updated_at = now();

insert into public.user_profiles (email, role, display_name, department)
values
  ('admin@university.edu', 'admin', 'Admin User', null),
  ('faculty@university.edu', 'faculty', 'Dr. Sarah Johnson', 'AG'),
  ('gowtham25m@gmail.com', 'faculty', 'Gowtham', 'AG'),
  ('alice@university.edu', 'student', 'Alice Johnson', 'CS')
on conflict (email)
do update set
  role = excluded.role,
  display_name = excluded.display_name,
  department = excluded.department,
  updated_at = now();

insert into public.department_courses (department, course_code, course_name)
values
  ('AG', 'AG601', 'Tractor and Farm Engines'),
  ('AG', 'AG602', 'Farm Power and Machinery'),
  ('AG', 'AG603', 'Soil and Water Engineering'),
  ('AG', 'AG604', 'Post Harvest Technology'),
  ('CS', 'CS601', 'Advanced Data Structures'),
  ('CS', 'CS602', 'Cloud Computing'),
  ('CS', 'CS603', 'Distributed Systems'),
  ('CS', 'CS604', 'Computer Vision'),
  ('IT', 'IT601', 'Enterprise Application Development'),
  ('IT', 'IT602', 'Data Mining'),
  ('IT', 'IT603', 'Cyber Security')
on conflict (department, course_code)
do update set
  course_name = excluded.course_name,
  updated_at = now();

insert into public.department_staff (department, staff_name, staff_email, is_active)
values
  ('AG', 'Dr. Saravanan', 'saravanan.ag@university.edu', true),
  ('AG', 'Dr. Meena', 'meena.ag@university.edu', true),
  ('AG', 'Dr. Raghavan', 'raghavan.ag@university.edu', true),
  ('AG', 'Dr. Priya', 'priya.ag@university.edu', true),
  ('AG', 'Dr. Arun', 'arun.ag@university.edu', true),
  ('CS', 'Dr. Karthik', 'karthik.cs@university.edu', true),
  ('CS', 'Dr. Nivetha', 'nivetha.cs@university.edu', true),
  ('CS', 'Dr. Balaji', 'balaji.cs@university.edu', true),
  ('CS', 'Dr. Harini', 'harini.cs@university.edu', true),
  ('CS', 'Dr. Vivek', 'vivek.cs@university.edu', true),
  ('IT', 'Dr. Santhosh', 'santhosh.it@university.edu', true),
  ('IT', 'Dr. Deepa', 'deepa.it@university.edu', true),
  ('IT', 'Dr. Kumar', 'kumar.it@university.edu', true),
  ('IT', 'Dr. Nisha', 'nisha.it@university.edu', true),
  ('IT', 'Dr. Ajay', 'ajay.it@university.edu', true)
on conflict (department, staff_email)
do update set
  staff_name = excluded.staff_name,
  is_active = excluded.is_active,
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
  login_count = case
    when public.users.login_count is null then 0
    else public.users.login_count
  end,
  last_login_at = coalesce(public.users.last_login_at, now()),
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

insert into public.class_assignments (
  student_email,
  student_name,
  roll_no,
  department,
  course_code,
  course_name,
  venue,
  staff_name,
  staff_email,
  faculty_email
)
values
  ('alice@university.edu', 'Alice Johnson', 'CS2021001', 'CS', 'CS601', 'Advanced Data Structures', 'Room 301', 'Dr. Karthik', 'karthik.cs@university.edu', 'faculty@university.edu'),
  ('alice@university.edu', 'Alice Johnson', 'CS2021001', 'CS', 'CS602', 'Cloud Computing', 'Room 205', 'Dr. Nivetha', 'nivetha.cs@university.edu', 'faculty@university.edu'),
  ('alice@university.edu', 'Alice Johnson', 'CS2021001', 'CS', 'CS603', 'Distributed Systems', 'Block B - Hall 2', 'Dr. Balaji', 'balaji.cs@university.edu', 'faculty@university.edu')
on conflict (student_email, course_code)
do update set
  student_name = excluded.student_name,
  roll_no = excluded.roll_no,
  department = excluded.department,
  course_name = excluded.course_name,
  venue = excluded.venue,
  staff_name = excluded.staff_name,
  staff_email = excluded.staff_email,
  faculty_email = excluded.faculty_email,
  updated_at = now();
