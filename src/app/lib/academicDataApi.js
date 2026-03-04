import { supabase } from './supabaseClient';

const extractDepartmentCode = (email) => {
  const match = (email || '').trim().toLowerCase().match(/\.([a-z]{2})\d*@/);
  return match?.[1]?.toUpperCase() || 'NA';
};

export const getStudents = async () => {
  const pageSize = 1000;
  let from = 0;
  let hasMore = true;
  const allRows = [];

  while (hasMore) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from('students')
      .select('register_no, name, email, department')
      .order('register_no', { ascending: true })
      .range(from, to);

    if (error) throw error;

    const currentRows = data || [];
    allRows.push(...currentRows);

    hasMore = currentRows.length === pageSize;
    from += pageSize;
  }

  return allRows
    .map((row, index) => ({
      id: index + 1,
      rollNo: (row.register_no || '').trim(),
      name: (row.name || '').trim(),
      email: (row.email || '').trim().toLowerCase(),
      department: (row.department || '').trim(),
      departmentCode: ((row.email || '').trim().toLowerCase().match(/\.([a-z]{2})\d*@/) || [])[1]?.toUpperCase() || 'NA',
      attendance: true,
    }))
    .filter((row) => row.email && row.rollNo);
};

export const getStudentProfileByEmail = async (studentEmail) => {
  const { data, error } = await supabase
    .from('students')
    .select('register_no, name, email, mobile_no, department')
    .eq('email', (studentEmail || '').trim().toLowerCase())
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    return null;
  }

  return {
    registerNo: (data.register_no || '').trim(),
    name: (data.name || '').trim(),
    email: (data.email || '').trim().toLowerCase(),
    mobileNo: (data.mobile_no || '').toString().trim(),
    department: (data.department || '').trim(),
  };
};

export const updateStudentProfileByEmail = async ({
  currentEmail,
  registerNo,
  name,
  email,
  mobileNo,
  department,
}) => {
  const normalizedCurrentEmail = (currentEmail || '').trim().toLowerCase();
  if (!normalizedCurrentEmail) {
    throw new Error('Current email is required to update profile.');
  }

  const payload = {
    register_no: (registerNo || '').trim(),
    name: (name || '').trim(),
    email: (email || '').trim().toLowerCase(),
    mobile_no: (mobileNo || '').trim(),
    department: (department || '').trim(),
  };

  const query = supabase
    .from('students')
    .update(payload)
    .eq('email', normalizedCurrentEmail);

  const scopedQuery = payload.register_no
    ? query.eq('register_no', payload.register_no)
    : query;

  const { data, error } = await scopedQuery
    .select('register_no, name, email, mobile_no, department')
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new Error('No student record found to update.');
  }

  return {
    registerNo: (data.register_no || '').trim(),
    name: (data.name || '').trim(),
    email: (data.email || '').trim().toLowerCase(),
    mobileNo: (data.mobile_no || '').toString().trim(),
    department: (data.department || '').trim(),
  };
};

export const assignClassToDepartment = async ({
  departmentCode,
  selectedCourse,
  venue,
  staffName,
  staffEmail,
  facultyEmail,
}) => {
  const normalizedDepartment = (departmentCode || '').trim().toUpperCase();
  if (!normalizedDepartment || normalizedDepartment === 'ALL') {
    throw new Error('Please choose a specific department.');
  }

  if (!selectedCourse?.code || !selectedCourse?.name) {
    throw new Error('Please choose a valid course.');
  }

  const students = await getStudents();
  const targetStudents = students.filter((student) => {
    const emailDepartment = extractDepartmentCode(student.email);
    const profileDepartment = (student.department || '').trim().toUpperCase();
    return emailDepartment === normalizedDepartment || profileDepartment === normalizedDepartment;
  });

  if (!targetStudents.length) {
    throw new Error(`No students found for ${normalizedDepartment} department.`);
  }

  const rows = targetStudents.map((student) => ({
    student_email: student.email,
    student_name: student.name,
    roll_no: student.rollNo,
    department: normalizedDepartment,
    course_code: selectedCourse.code,
    course_name: selectedCourse.name,
    venue: (venue || '').trim(),
    staff_name: (staffName || '').trim(),
    staff_email: (staffEmail || '').trim().toLowerCase() || null,
    faculty_email: facultyEmail || null,
  }));

  const { data, error } = await supabase
    .from('class_assignments')
    .upsert(rows, { onConflict: 'student_email,course_code' })
    .select('student_email');

  if (error) throw error;
  return data || [];
};

export const getClassAssignmentsByStudentEmail = async (studentEmail) => {
  const { data, error } = await supabase
    .from('class_assignments')
    .select('course_code, course_name, venue, staff_name, staff_email, faculty_email, department, updated_at')
    .eq('student_email', studentEmail)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const getClassAssignmentsByDepartment = async (departmentCode) => {
  const normalizedDepartment = (departmentCode || '').trim().toUpperCase();
  if (!normalizedDepartment) return [];

  const { data, error } = await supabase
    .from('class_assignments')
    .select('student_email, course_code, course_name, venue, staff_name, staff_email, faculty_email, department, updated_at')
    .eq('department', normalizedDepartment)
    .order('course_code', { ascending: true })
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return data || [];
};

export const updateClassAssignmentVenueByDepartmentCourse = async ({
  departmentCode,
  courseCode,
  venue,
}) => {
  const normalizedDepartment = (departmentCode || '').trim().toUpperCase();
  const normalizedCourseCode = (courseCode || '').trim().toUpperCase();

  if (!normalizedDepartment || !normalizedCourseCode) {
    throw new Error('Department and course are required.');
  }

  const { data, error } = await supabase
    .from('class_assignments')
    .update({
      venue: (venue || '').trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('department', normalizedDepartment)
    .eq('course_code', normalizedCourseCode)
    .select('student_email');

  if (error) throw error;
  return data || [];
};

export const deleteClassAssignmentsByDepartmentCourse = async ({
  departmentCode,
  courseCode,
}) => {
  const normalizedDepartment = (departmentCode || '').trim().toUpperCase();
  const normalizedCourseCode = (courseCode || '').trim().toUpperCase();

  if (!normalizedDepartment || !normalizedCourseCode) {
    throw new Error('Department and course are required.');
  }

  const { data, error } = await supabase
    .from('class_assignments')
    .delete()
    .eq('department', normalizedDepartment)
    .eq('course_code', normalizedCourseCode)
    .select('student_email');

  if (error) throw error;
  return data || [];
};

export const getFacultyProfileByEmail = async (facultyEmail) => {
  const normalizedEmail = (facultyEmail || '').trim().toLowerCase();
  if (!normalizedEmail) return null;

  const { data, error } = await supabase
    .from('user_profiles')
    .select('email, display_name, role, department')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    email: (data.email || '').trim().toLowerCase(),
    displayName: (data.display_name || '').trim(),
    role: (data.role || '').trim(),
    department: (data.department || '').trim().toUpperCase(),
  };
};

export const updateFacultyDepartmentByEmail = async ({ facultyEmail, department }) => {
  const normalizedEmail = (facultyEmail || '').trim().toLowerCase();
  const normalizedDepartment = (department || '').trim().toUpperCase();

  if (!normalizedEmail) throw new Error('Faculty email is required.');
  if (!normalizedDepartment) throw new Error('Department is required.');

  const { data, error } = await supabase
    .from('user_profiles')
    .update({ department: normalizedDepartment, updated_at: new Date().toISOString() })
    .eq('email', normalizedEmail)
    .select('email, display_name, role, department')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Faculty profile not found.');

  return {
    email: (data.email || '').trim().toLowerCase(),
    displayName: (data.display_name || '').trim(),
    role: (data.role || '').trim(),
    department: (data.department || '').trim().toUpperCase(),
  };
};

export const getDepartmentCourses = async (departmentCode) => {
  const normalizedDepartment = (departmentCode || '').trim().toUpperCase();
  if (!normalizedDepartment) return [];

  const { data, error } = await supabase
    .from('department_courses')
    .select('department, course_code, course_name')
    .eq('department', normalizedDepartment)
    .order('course_code', { ascending: true });

  if (error) throw error;

  return (data || []).map((row) => ({
    department: (row.department || '').trim().toUpperCase(),
    code: (row.course_code || '').trim().toUpperCase(),
    name: (row.course_name || '').trim(),
  }));
};

export const getDepartmentStaff = async (departmentCode) => {
  const normalizedDepartment = (departmentCode || '').trim().toUpperCase();
  if (!normalizedDepartment) return [];

  const { data, error } = await supabase
    .from('department_staff')
    .select('department, staff_name, staff_email, is_active')
    .eq('department', normalizedDepartment)
    .eq('is_active', true)
    .order('staff_name', { ascending: true });

  if (error) throw error;

  return (data || []).map((row) => ({
    department: (row.department || '').trim().toUpperCase(),
    name: (row.staff_name || '').trim(),
    email: (row.staff_email || '').trim().toLowerCase(),
  }));
};

export const getAdminDashboardData = async () => {
  const [
    usersResult,
    studentsResult,
    attendanceResult,
    marksResult,
    assignmentsResult,
  ] = await Promise.all([
    supabase.from('users').select('email, role, created_at').order('created_at', { ascending: false }),
    supabase.from('students').select('email, register_no, name').order('register_no', { ascending: true }),
    supabase.from('attendance_records').select('attendance_date, is_present, student_email'),
    supabase.from('marks_records').select('total, student_email, updated_at'),
    supabase.from('class_assignments').select('course_code, course_name, student_email, updated_at'),
  ]);

  const firstError = [usersResult.error, studentsResult.error, attendanceResult.error, marksResult.error, assignmentsResult.error]
    .find(Boolean);
  if (firstError) throw firstError;

  const usersRows = usersResult.data || [];
  const studentsRows = studentsResult.data || [];
  const attendanceRows = attendanceResult.data || [];
  const marksRows = marksResult.data || [];
  const assignmentRows = assignmentsResult.data || [];

  const totalStudents = usersRows.filter((user) => user.role === 'student').length || studentsRows.length;
  const totalFaculty = usersRows.filter((user) => user.role === 'faculty').length;

  const attendanceRate = attendanceRows.length
    ? Number(
      ((attendanceRows.filter((row) => row.is_present).length / attendanceRows.length) * 100).toFixed(1)
    )
    : 0;

  const avgMarks = marksRows.length
    ? Number(
      (
        marksRows.reduce((accumulator, row) => accumulator + Number(row.total || 0), 0)
        / marksRows.length
      ).toFixed(1)
    )
    : 0;

  const attendanceByDate = new Map();
  attendanceRows.forEach((row) => {
    const key = row.attendance_date;
    if (!key) return;
    if (!attendanceByDate.has(key)) {
      attendanceByDate.set(key, { present: 0, total: 0 });
    }
    const current = attendanceByDate.get(key);
    current.total += 1;
    if (row.is_present) {
      current.present += 1;
    }
  });

  const attendanceTrend = [...attendanceByDate.entries()]
    .sort((first, second) => first[0].localeCompare(second[0]))
    .slice(-6)
    .map(([date, value]) => ({
      label: date,
      rate: value.total ? Number(((value.present / value.total) * 100).toFixed(1)) : 0,
    }));

  const enrollmentByMonth = new Map();
  usersRows.forEach((row) => {
    const month = (row.created_at || '').slice(0, 7);
    if (!month) return;
    if (!enrollmentByMonth.has(month)) {
      enrollmentByMonth.set(month, { students: 0, faculty: 0 });
    }

    const bucket = enrollmentByMonth.get(month);
    if (row.role === 'student') bucket.students += 1;
    if (row.role === 'faculty') bucket.faculty += 1;
  });

  const enrollmentTrend = [...enrollmentByMonth.entries()]
    .sort((first, second) => first[0].localeCompare(second[0]))
    .slice(-6)
    .map(([month, value]) => ({
      month,
      students: value.students,
      faculty: value.faculty,
    }));

  const recentActivities = assignmentRows
    .slice()
    .sort((first, second) => (second.updated_at || '').localeCompare(first.updated_at || ''))
    .slice(0, 8)
    .map((row, index) => ({
      id: index + 1,
      action: `Assigned ${row.course_code}`,
      user: row.student_email,
      time: (row.updated_at || '').replace('T', ' ').slice(0, 16),
      status: 'completed',
    }));

  return {
    stats: {
      totalStudents,
      totalFaculty,
      attendanceRate,
      avgMarks,
    },
    attendanceTrend,
    enrollmentTrend,
    recentActivities,
  };
};

export const getAnalyticsData = async () => {
  const [studentsResult, marksResult, attendanceResult] = await Promise.all([
    supabase.from('students').select('department, email'),
    supabase.from('marks_records').select('student_email, total'),
    supabase.from('attendance_records').select('student_email, is_present'),
  ]);

  const firstError = [studentsResult.error, marksResult.error, attendanceResult.error].find(Boolean);
  if (firstError) throw firstError;

  const studentsRows = studentsResult.data || [];
  const marksRows = marksResult.data || [];
  const attendanceRows = attendanceResult.data || [];

  const departmentStudents = new Map();
  studentsRows.forEach((row) => {
    const dept = (row.department || 'NA').toUpperCase();
    if (!departmentStudents.has(dept)) {
      departmentStudents.set(dept, new Set());
    }
    departmentStudents.get(dept).add((row.email || '').toLowerCase());
  });

  const departmentData = [...departmentStudents.entries()].map(([department, studentSet]) => {
    const emails = [...studentSet];

    const deptMarks = marksRows
      .filter((row) => emails.includes((row.student_email || '').toLowerCase()))
      .map((row) => Number(row.total || 0));

    const deptAttendance = attendanceRows
      .filter((row) => emails.includes((row.student_email || '').toLowerCase()));

    const avgGrade = deptMarks.length
      ? Number((deptMarks.reduce((accumulator, value) => accumulator + value, 0) / deptMarks.length).toFixed(1))
      : 0;

    const attendance = deptAttendance.length
      ? Number(
        ((deptAttendance.filter((row) => row.is_present).length / deptAttendance.length) * 100).toFixed(1)
      )
      : 0;

    return {
      department,
      students: emails.length,
      avgGrade,
      attendance,
    };
  });

  return {
    departmentData,
  };
};

export const getUsersWithProfiles = async () => {
  const [usersResult, profileResult] = await Promise.all([
    supabase.from('users').select('id, email, role, is_active, last_login_at, login_count, created_at').order('created_at', { ascending: false }),
    supabase.from('user_profiles').select('email, display_name, department'),
  ]);

  const firstError = [usersResult.error, profileResult.error].find(Boolean);
  if (firstError) throw firstError;

  const profileByEmail = new Map((profileResult.data || []).map((row) => [
    (row.email || '').trim().toLowerCase(),
    row,
  ]));

  return (usersResult.data || []).map((row) => {
    const normalizedEmail = (row.email || '').trim().toLowerCase();
    const profile = profileByEmail.get(normalizedEmail);
    return {
      id: row.id,
      email: normalizedEmail,
      role: row.role,
      isActive: row.is_active !== false,
      lastLoginAt: row.last_login_at || null,
      loginCount: Number(row.login_count || 0),
      createdAt: row.created_at,
      displayName: (profile?.display_name || '').trim() || normalizedEmail,
      department: (profile?.department || '').trim().toUpperCase() || 'NA',
    };
  });
};

export const upsertUserWithProfile = async ({ email, role, displayName, department }) => {
  const normalizedEmail = (email || '').trim().toLowerCase();
  const normalizedRole = (role || '').trim().toLowerCase();
  const normalizedDepartment = (department || '').trim().toUpperCase() || null;

  if (!normalizedEmail) throw new Error('Email is required.');
  if (!['student', 'faculty', 'admin'].includes(normalizedRole)) {
    throw new Error('Role must be student, faculty, or admin.');
  }

  const { error: usersError } = await supabase
    .from('users')
    .upsert(
      [{ email: normalizedEmail, role: normalizedRole, is_active: true }],
      { onConflict: 'email' }
    );

  if (usersError) throw usersError;

  const { error: profileError } = await supabase
    .from('user_profiles')
    .upsert(
      [{
        email: normalizedEmail,
        role: normalizedRole,
        display_name: (displayName || '').trim() || normalizedEmail,
        department: normalizedDepartment,
      }],
      { onConflict: 'email' }
    );

  if (profileError) throw profileError;
};

export const deleteUserByEmail = async (email) => {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) throw new Error('Email is required.');

  const [usersResult, profileResult] = await Promise.all([
    supabase.from('users').delete().eq('email', normalizedEmail),
    supabase.from('user_profiles').delete().eq('email', normalizedEmail),
  ]);

  const firstError = [usersResult.error, profileResult.error].find(Boolean);
  if (firstError) throw firstError;
};

export const updateUserAccessByEmail = async ({ email, isActive }) => {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) throw new Error('Email is required.');

  const { error } = await supabase
    .from('users')
    .update({
      is_active: Boolean(isActive),
      updated_at: new Date().toISOString(),
    })
    .eq('email', normalizedEmail);

  if (error) throw error;
};

export const getAdminAccessOverview = async () => {
  const [usersResult, coursesCountResult, staffCountResult] = await Promise.all([
    supabase
      .from('users')
      .select('email, role, is_active, last_login_at, login_count, created_at')
      .order('last_login_at', { ascending: false }),
    supabase.from('department_courses').select('id', { count: 'exact', head: true }),
    supabase.from('department_staff').select('staff_email', { count: 'exact', head: true }).eq('is_active', true),
  ]);

  const firstError = [usersResult.error, coursesCountResult.error, staffCountResult.error].find(Boolean);
  if (firstError) throw firstError;

  const usersRows = usersResult.data || [];

  const totalUsers = usersRows.length;
  const activeUsers = usersRows.filter((row) => row.is_active !== false).length;
  const disabledUsers = usersRows.filter((row) => row.is_active === false).length;
  const facultyCount = usersRows.filter((row) => row.role === 'faculty').length;
  const studentCount = usersRows.filter((row) => row.role === 'student').length;

  const recentLogins = usersRows
    .filter((row) => row.last_login_at)
    .slice(0, 10)
    .map((row, index) => ({
      id: index + 1,
      email: (row.email || '').toLowerCase(),
      role: row.role,
      isActive: row.is_active !== false,
      lastLoginAt: row.last_login_at,
      loginCount: Number(row.login_count || 0),
    }));

  return {
    stats: {
      totalUsers,
      activeUsers,
      disabledUsers,
      facultyCount,
      studentCount,
      totalCourses: Number(coursesCountResult.count || 0),
      totalActiveStaff: Number(staffCountResult.count || 0),
    },
    recentLogins,
  };
};

export const getDepartmentCoursesAdmin = async () => {
  const { data, error } = await supabase
    .from('department_courses')
    .select('id, department, course_code, course_name, updated_at')
    .order('department', { ascending: true })
    .order('course_code', { ascending: true });

  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    department: (row.department || '').trim().toUpperCase(),
    courseCode: (row.course_code || '').trim().toUpperCase(),
    courseName: (row.course_name || '').trim(),
    updatedAt: row.updated_at,
  }));
};

export const upsertDepartmentCourse = async ({ department, courseCode, courseName }) => {
  const normalizedDepartment = (department || '').trim().toUpperCase();
  const normalizedCourseCode = (courseCode || '').trim().toUpperCase();
  const normalizedCourseName = (courseName || '').trim();

  if (!normalizedDepartment || !normalizedCourseCode || !normalizedCourseName) {
    throw new Error('Department, course code, and course name are required.');
  }

  const { error } = await supabase
    .from('department_courses')
    .upsert(
      [{
        department: normalizedDepartment,
        course_code: normalizedCourseCode,
        course_name: normalizedCourseName,
      }],
      { onConflict: 'department,course_code' }
    );

  if (error) throw error;
};

export const deleteDepartmentCourse = async ({ department, courseCode }) => {
  const normalizedDepartment = (department || '').trim().toUpperCase();
  const normalizedCourseCode = (courseCode || '').trim().toUpperCase();
  if (!normalizedDepartment || !normalizedCourseCode) {
    throw new Error('Department and course code are required.');
  }

  const { error } = await supabase
    .from('department_courses')
    .delete()
    .eq('department', normalizedDepartment)
    .eq('course_code', normalizedCourseCode);

  if (error) throw error;
};

export const getStudentDashboardSummary = async (studentEmail) => {
  const normalizedEmail = (studentEmail || '').trim().toLowerCase();
  if (!normalizedEmail) return null;

  const [attendanceResult, marksResult, assignmentResult] = await Promise.all([
    getAttendanceByStudentEmail(normalizedEmail),
    getMarksByStudentEmail(normalizedEmail),
    getClassAssignmentsByStudentEmail(normalizedEmail),
  ]);

  const attendanceRate = attendanceResult.length
    ? Number(
      ((attendanceResult.filter((row) => row.is_present).length / attendanceResult.length) * 100).toFixed(1)
    )
    : 0;

  const averageMarks = marksResult.length
    ? Number(
      (
        marksResult.reduce((accumulator, row) => accumulator + Number(row.total || 0), 0)
        / marksResult.length
      ).toFixed(1)
    )
    : 0;

  const enrolledCoursesCount = new Set(
    [...attendanceResult, ...marksResult].map((row) => row.course_code).filter(Boolean)
  ).size;

  return {
    attendanceRate,
    averageMarks,
    enrolledCoursesCount,
    assignmentsCount: assignmentResult.length,
  };
};

const DEFAULT_SYSTEM_SETTINGS = {
  allow_google_student: true,
  allow_google_faculty: true,
  allow_password_admin: true,
  enforce_active_user_access: true,
  maintenance_mode: false,
  support_contact: 'admin@university.edu',
};

export const getSystemSettings = async () => {
  const { data, error } = await supabase
    .from('system_settings')
    .select('setting_key, setting_value')
    .order('setting_key', { ascending: true });

  if (error) throw error;

  const merged = { ...DEFAULT_SYSTEM_SETTINGS };
  (data || []).forEach((row) => {
    const key = row.setting_key;
    if (!key) return;
    merged[key] = row.setting_value;
  });

  return merged;
};

export const saveSystemSettings = async (settings) => {
  const payload = Object.entries(settings || {}).map(([settingKey, settingValue]) => ({
    setting_key: settingKey,
    setting_value: settingValue,
    updated_at: new Date().toISOString(),
  }));

  if (!payload.length) return;

  const { error } = await supabase
    .from('system_settings')
    .upsert(payload, { onConflict: 'setting_key' });

  if (error) throw error;
};

export const saveAttendanceForCourseDate = async ({
  students,
  selectedCourse,
  selectedDate,
  facultyEmail,
}) => {
  const rows = students.map((student) => ({
    student_email: student.email,
    student_name: student.name,
    roll_no: student.rollNo,
    course_code: selectedCourse.code,
    course_name: selectedCourse.name,
    attendance_date: selectedDate,
    is_present: student.attendance,
    faculty_email: facultyEmail || null,
  }));

  const { error } = await supabase
    .from('attendance_records')
    .upsert(rows, { onConflict: 'student_email,course_code,attendance_date' });

  if (error) throw error;
};

export const getAttendanceByStudentEmail = async (studentEmail) => {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('course_code, course_name, attendance_date, is_present, faculty_email')
    .eq('student_email', studentEmail)
    .order('attendance_date', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const getAttendanceForCourseDate = async ({
  courseCode,
  selectedDate,
}) => {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('student_email, is_present')
    .eq('course_code', courseCode)
    .eq('attendance_date', selectedDate);

  if (error) throw error;
  return data || [];
};

export const deleteAttendanceForCourseDate = async ({
  courseCode,
  selectedDate,
}) => {
  const { error } = await supabase
    .from('attendance_records')
    .delete()
    .eq('course_code', courseCode)
    .eq('attendance_date', selectedDate);

  if (error) throw error;
};

export const saveMarksForCourse = async ({ students, selectedCourse, facultyEmail }) => {
  const rows = students.map((student) => ({
    student_email: student.email,
    student_name: student.name,
    roll_no: student.rollNo,
    course_code: selectedCourse.code,
    course_name: selectedCourse.name,
    mid_term: student.midTerm,
    assignment: student.assignment,
    quiz: student.quiz,
    end_term: student.endTerm,
    total: Number(student.total.toFixed(1)),
    grade: student.grade,
    faculty_email: facultyEmail || null,
  }));

  const { error } = await supabase
    .from('marks_records')
    .upsert(rows, { onConflict: 'student_email,course_code' });

  if (error) throw error;
};

export const getMarksByStudentEmail = async (studentEmail) => {
  const { data, error } = await supabase
    .from('marks_records')
    .select('course_code, course_name, mid_term, assignment, quiz, end_term, total, grade')
    .eq('student_email', studentEmail)
    .order('course_code', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const getMarksForCourse = async (courseCode) => {
  const { data, error } = await supabase
    .from('marks_records')
    .select('student_email, mid_term, assignment, quiz, end_term, total, grade')
    .eq('course_code', courseCode);

  if (error) throw error;
  return data || [];
};

export const deleteMarksForCourse = async (courseCode) => {
  const { error } = await supabase
    .from('marks_records')
    .delete()
    .eq('course_code', courseCode);

  if (error) throw error;
};
