import { supabase } from './supabaseClient';

const extractDepartmentCode = (email) => {
  const match = (email || '').trim().toLowerCase().match(/\.([a-z]{2})\d*@/);
  return match?.[1]?.toUpperCase() || 'NA';
};

const isPermissionError = (error) => {
  const status = Number(error?.status || 0);
  const message = String(error?.message || '').toLowerCase();
  return (
    status === 401
    || status === 403
    || message.includes('permission denied')
    || message.includes('row-level security')
    || message.includes('forbidden')
  );
};

const isMissingTableError = (error) => {
  const status = Number(error?.status || 0);
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();

  return (
    status === 404
    || code === 'PGRST205'
    || message.includes('could not find the table')
    || message.includes('relation') && message.includes('does not exist')
  );
};

const DEFAULT_QUERY_TIMEOUT_MS = 15000;

const query = async (fn, context = '', timeoutMs = DEFAULT_QUERY_TIMEOUT_MS) => {
  let timeoutId = null;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = globalThis.setTimeout(() => {
      reject(new Error(`Timed out while loading ${context || 'data'}.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve().then(fn), timeoutPromise]);
  } catch (err) {
    if (isPermissionError(err)) {
      console.warn(`[AAWE] Permission denied: ${context}`);
      return null;
    }
    console.error(`[AAWE] Query error in ${context}:`, err);
    throw err;
  } finally {
    if (timeoutId) {
      globalThis.clearTimeout(timeoutId);
    }
  }
};

const uniqueNonEmpty = (values) => [...new Set((values || []).map((value) => (value || '').trim()).filter(Boolean))];
const DEFAULT_ACTIVE_SEMESTER = '2024-ODD';

const normalizeSemester = (value) => (value || '').toString().trim().toUpperCase();

const toAcademicYearFromSemester = (semester) => {
  const normalized = normalizeSemester(semester);
  const yearMatch = normalized.match(/^(\d{4})-(ODD|EVEN)$/);
  if (!yearMatch) return '';

  const startYear = Number(yearMatch[1]);
  const endYear = (startYear + 1).toString().slice(-2);
  return `${startYear}-${endYear}`;
};

const normalizeSettingText = (settingValue) => {
  if (typeof settingValue === 'string') return settingValue;
  if (settingValue === null || settingValue === undefined) return '';
  if (typeof settingValue === 'number' || typeof settingValue === 'boolean') return String(settingValue);
  return '';
};

const getActiveSemester = async () => {
  const { data, error } = await query(() => supabase
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', 'current_semester')
    .maybeSingle(), '');

  if (error && !isPermissionError(error)) throw error;

  const fromSettings = normalizeSemester(normalizeSettingText(data?.setting_value));
  return fromSettings || DEFAULT_ACTIVE_SEMESTER;
};

const getSemesterContext = async () => {
  const semester = await getActiveSemester();
  return {
    semester,
    academicYear: toAcademicYearFromSemester(semester),
  };
};

const addOneHourToTime = (startTime) => {
  const [hoursText, minutesText] = String(startTime || '').split(':');
  const hours = Number(hoursText);
  const minutes = Number(minutesText);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error('Start time must be in HH:MM format.');
  }

  const startMinutes = (hours * 60) + minutes;
  const endMinutes = (startMinutes + 60) % (24 * 60);
  const endHours = Math.floor(endMinutes / 60);
  const endMins = endMinutes % 60;
  return `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}:00`;
};

const auditSafe = (value) => {
  if (value === undefined) return null;
  return value;
};

const logAuditEvent = async ({
  actorEmail,
  actorRole,
  action,
  targetTable,
  targetId,
  oldData,
  newData,
}) => {
  const normalizedActorEmail = (actorEmail || '').trim().toLowerCase();
  const normalizedActorRole = (actorRole || '').trim().toLowerCase();

  if (!normalizedActorEmail || !normalizedActorRole || !action) return;

  const { error } = await query(() => supabase.rpc('log_audit', {
    actor_email: normalizedActorEmail,
    actor_role: normalizedActorRole,
    action,
    target_table: targetTable || null,
    target_id: targetId || null,
    old_data: auditSafe(oldData),
    new_data: auditSafe(newData),
  }), '');

  if (error) {
    console.error('Failed to write audit log:', error);
  }
};

const scoreStudentRow = (row, targetEmail) => {
  const normalizedTargetEmail = (targetEmail || '').trim().toLowerCase();
  const normalizedRowEmail = (row?.email || '').trim().toLowerCase();

  let score = 0;
  if (normalizedRowEmail === normalizedTargetEmail) score += 8;
  if ((row?.register_no || '').toString().trim()) score += 4;
  if ((row?.name || '').trim()) score += 3;
  if ((row?.mobile_no || '').toString().trim()) score += 2;
  if ((row?.department || '').trim()) score += 1;
  return score;
};

const pickBestStudentRow = (rows, targetEmail) => {
  const normalizedTargetEmail = (targetEmail || '').trim().toLowerCase();
  const candidates = (rows || []).filter(
    (row) => ((row?.email || '').trim().toLowerCase() === normalizedTargetEmail)
  );

  if (!candidates.length) return null;

  return candidates
    .slice()
    .sort((first, second) => scoreStudentRow(second, normalizedTargetEmail) - scoreStudentRow(first, normalizedTargetEmail))[0] || null;
};

const resolveStudentIdentityByEmail = async (studentEmail) => {
  const normalizedEmail = (studentEmail || '').trim().toLowerCase();
  if (!normalizedEmail) {
    return {
      emails: [],
      registerNo: '',
      department: '',
      name: '',
    };
  }

  const { data, error } = await query(() => supabase
    .from('students')
    .select('email, register_no, department, name')
    .eq('email', normalizedEmail), '');

  if (error && !isPermissionError(error)) {
    throw error;
  }

  const bestStudentRow = pickBestStudentRow(data || [], normalizedEmail);
  const canonicalEmail = (bestStudentRow?.email || normalizedEmail).trim().toLowerCase();

  return {
    emails: uniqueNonEmpty([normalizedEmail, canonicalEmail]),
    registerNo: (bestStudentRow?.register_no || '').trim(),
    department: (bestStudentRow?.department || '').trim().toUpperCase(),
    name: (bestStudentRow?.name || '').trim(),
  };
};

const fetchClassAssignmentsByIdentity = async (identity, semester, departmentCode = null) => {
  const normalizedEmail = identity.emails[0] || '';
  const normalizedDepartment = (departmentCode || '').trim().toUpperCase();
  const inferredDepartment = extractDepartmentCode(normalizedEmail);
  const fallbackDepartment = normalizedDepartment || identity.department || (inferredDepartment !== 'NA' ? inferredDepartment : '');

  if (!identity.emails.length && !fallbackDepartment) return [];

  if (identity.emails.length) {
    const assignmentResults = await Promise.all(
      identity.emails.map((email) =>
        query(() => supabase
          .from('class_assignments')
          .select('course_code, course_name, venue, staff_name, staff_email, faculty_email, department, updated_at')
          .ilike('student_email', email)
          .eq('semester', semester)
          .order('updated_at', { ascending: false }), 'getClassAssignmentsByStudentEmail:by-email')
      )
    );

    const firstEmailError = assignmentResults.map((result) => result.error).find(Boolean);
    if (firstEmailError) throw firstEmailError;

    const emailRows = assignmentResults.flatMap((result) => result.data || []);
    if (emailRows.length) {
      const grouped = new Map();
      emailRows.forEach((row) => {
        const key = `${row.course_code || ''}::${row.staff_email || row.staff_name || ''}::${row.venue || ''}`;
        if (!grouped.has(key)) grouped.set(key, row);
      });
      return Array.from(grouped.values());
    }
  }

  const additionalLookupQueries = [];
  if (identity.registerNo) {
    additionalLookupQueries.push(
      query(() => supabase
        .from('class_assignments')
        .select('course_code, course_name, venue, staff_name, staff_email, faculty_email, department, updated_at')
        .ilike('roll_no', `%${identity.registerNo}%`)
        .eq('semester', semester)
        .order('updated_at', { ascending: false }), 'getClassAssignmentsByStudentEmail:by-roll')
    );
  }

  if (identity.name && identity.name.length >= 3) {
    additionalLookupQueries.push(
      query(() => supabase
        .from('class_assignments')
        .select('course_code, course_name, venue, staff_name, staff_email, faculty_email, department, updated_at')
        .ilike('student_name', `%${identity.name}%`)
        .eq('semester', semester)
        .order('updated_at', { ascending: false }), 'getClassAssignmentsByStudentEmail:by-name')
    );
  }

  if (additionalLookupQueries.length) {
    const additionalResults = await Promise.all(additionalLookupQueries);
    const additionalError = additionalResults.map((result) => result.error).find(Boolean);
    if (additionalError) throw additionalError;

    const additionalRows = additionalResults.flatMap((result) => result.data || []);
    if (additionalRows.length) {
      const grouped = new Map();
      additionalRows.forEach((row) => {
        const key = `${row.course_code || ''}::${row.staff_email || row.staff_name || ''}::${row.venue || ''}`;
        if (!grouped.has(key)) grouped.set(key, row);
      });
      return Array.from(grouped.values());
    }
  }

  if (!fallbackDepartment) return [];

  const { data: departmentRows, error: departmentError } = await query(() => supabase
    .from('class_assignments')
    .select('course_code, course_name, venue, staff_name, staff_email, faculty_email, department, updated_at')
    .ilike('department', fallbackDepartment)
    .eq('semester', semester)
    .order('updated_at', { ascending: false }), 'getClassAssignmentsByStudentEmail:by-department');

  if (departmentError) throw departmentError;

  const grouped = new Map();
  (departmentRows || []).forEach((row) => {
    const key = `${row.course_code || ''}::${row.staff_email || row.staff_name || ''}::${row.venue || ''}`;
    if (!grouped.has(key)) grouped.set(key, row);
  });

  return Array.from(grouped.values());
};

const fetchAttendanceRowsByIdentity = async (identity, semester) => {
  if (!identity.emails.length && !identity.registerNo && !identity.name) return [];

  const emailResults = await Promise.all(
    identity.emails.map((email) =>
      query(() => supabase
        .from('attendance_records')
        .select('course_code, course_name, attendance_date, is_present, faculty_email, roll_no')
        .ilike('student_email', email)
        .eq('semester', semester)
        .order('attendance_date', { ascending: false }), 'getAttendanceByStudentEmail:by-email')
    )
  );

  const firstEmailError = emailResults.map((result) => result.error).find(Boolean);
  if (firstEmailError) throw firstEmailError;

  let rollNoRows = [];
  if (identity.registerNo) {
    const { data: rollRows, error: rollError } = await query(() => supabase
      .from('attendance_records')
      .select('course_code, course_name, attendance_date, is_present, faculty_email, roll_no')
      .ilike('roll_no', `%${identity.registerNo}%`)
      .eq('semester', semester)
      .order('attendance_date', { ascending: false }), 'getAttendanceByStudentEmail:by-roll');

    if (rollError) throw rollError;
    rollNoRows = rollRows || [];
  }

  let nameRows = [];
  if (identity.name && identity.name.length >= 3) {
    const { data: studentNameRows, error: nameError } = await query(() => supabase
      .from('attendance_records')
      .select('course_code, course_name, attendance_date, is_present, faculty_email, roll_no')
      .ilike('student_name', `%${identity.name}%`)
      .eq('semester', semester)
      .order('attendance_date', { ascending: false }), 'getAttendanceByStudentEmail:by-name');

    if (nameError) throw nameError;
    nameRows = studentNameRows || [];
  }

  let mergedRows = [...emailResults.flatMap((result) => result.data || []), ...rollNoRows, ...nameRows];

  if (!mergedRows.length) {
    const emailFallbackResults = await Promise.all(
      identity.emails.map((email) =>
        query(() => supabase
          .from('attendance_records')
          .select('course_code, course_name, attendance_date, is_present, faculty_email, roll_no')
          .ilike('student_email', email)
          .order('attendance_date', { ascending: false })
          .limit(300), 'getAttendanceByStudentEmail:fallback-by-email')
      )
    );

    const firstEmailFallbackError = emailFallbackResults.map((result) => result.error).find(Boolean);
    if (firstEmailFallbackError) throw firstEmailFallbackError;

    let rollFallbackRows = [];
    if (identity.registerNo) {
      const { data: rollRows, error: rollError } = await query(() => supabase
        .from('attendance_records')
        .select('course_code, course_name, attendance_date, is_present, faculty_email, roll_no')
        .ilike('roll_no', `%${identity.registerNo}%`)
        .order('attendance_date', { ascending: false })
        .limit(300), 'getAttendanceByStudentEmail:fallback-by-roll');

      if (rollError) throw rollError;
      rollFallbackRows = rollRows || [];
    }

    let nameFallbackRows = [];
    if (identity.name && identity.name.length >= 3) {
      const { data: studentNameRows, error: nameError } = await query(() => supabase
        .from('attendance_records')
        .select('course_code, course_name, attendance_date, is_present, faculty_email, roll_no')
        .ilike('student_name', `%${identity.name}%`)
        .order('attendance_date', { ascending: false })
        .limit(300), 'getAttendanceByStudentEmail:fallback-by-name');

      if (nameError) throw nameError;
      nameFallbackRows = studentNameRows || [];
    }

    mergedRows = [...emailFallbackResults.flatMap((result) => result.data || []), ...rollFallbackRows, ...nameFallbackRows];
  }

  const deduped = new Map();
  mergedRows.forEach((row) => {
    const key = `${row.course_code || ''}::${row.attendance_date || ''}`;
    if (!deduped.has(key)) deduped.set(key, row);
  });

  return Array.from(deduped.values());
};

export const getStudentAttendancePageData = async (studentEmail, departmentCode = null) => {
  const { semester } = await getSemesterContext();
  const identity = await resolveStudentIdentityByEmail(studentEmail);

  if (!identity.emails.length && !identity.registerNo && !identity.name && !departmentCode) {
    return { attendanceRows: [], assignedCourses: [] };
  }

  const [attendanceRows, assignedCourses] = await Promise.all([
    fetchAttendanceRowsByIdentity(identity, semester),
    fetchClassAssignmentsByIdentity(identity, semester, departmentCode),
  ]);

  return { attendanceRows, assignedCourses };
};

export const getStudents = async ({ page = 1, pageSize = 50, department = '' } = {}) => {
  const normalizedPage = Math.max(1, Number(page) || 1);
  const normalizedPageSize = Math.max(1, Number(pageSize) || 50);
  const normalizedDepartment = (department || '').trim().toUpperCase();

  let studentsQuery = supabase
    .from('students')
    .select('*', { count: 'exact' });

  if (normalizedDepartment) {
    studentsQuery = studentsQuery.eq('department', normalizedDepartment);
  }

  const from = (normalizedPage - 1) * normalizedPageSize;
  const { data, error, count } = await query(() => studentsQuery
    .range(from, from + normalizedPageSize - 1)
    .order('register_no', { ascending: true }), 'getStudents');

  if (error) throw error;

  const mappedRows = (data || [])
    .map((row, index) => ({
      id: from + index + 1,
      rollNo: (row.register_no || '').trim(),
      name: (row.name || '').trim(),
      email: (row.email || '').trim().toLowerCase(),
      department: (row.department || '').trim(),
      departmentCode: ((row.email || '').trim().toLowerCase().match(/\.([a-z]{2})\d*@/) || [])[1]?.toUpperCase() || 'NA',
      attendance: true,
    }))
    .filter((row) => row.email && row.rollNo);

  return {
    data: mappedRows,
    total: count || 0,
    page: normalizedPage,
    pageSize: normalizedPageSize,
  };
};

export const getStudentProfileByEmail = async (studentEmail) => {
  const normalizedEmail = (studentEmail || '').trim().toLowerCase();
  if (!normalizedEmail) return null;

  const { data, error } = await query(() => supabase
    .from('students')
    .select('register_no, name, email, mobile_no, department')
    .eq('email', normalizedEmail), '');

  let studentRows = data || [];

  // Some environments may not have mobile_no in students. Retry without it.
  if (error && String(error?.message || '').toLowerCase().includes('mobile_no')) {
    const { data: fallbackRows, error: fallbackError } = await query(() => supabase
      .from('students')
      .select('register_no, name, email, department')
      .eq('email', normalizedEmail), '');

    if (fallbackError && !isPermissionError(fallbackError)) throw fallbackError;
    studentRows = (fallbackRows || []).map((row) => ({ ...row, mobile_no: '' }));
  } else if (error && !isPermissionError(error)) {
    throw error;
  }

  const bestStudentRow = pickBestStudentRow(studentRows, normalizedEmail);

  if (bestStudentRow) {
    return {
      registerNo: (bestStudentRow.register_no || '').trim(),
      name: (bestStudentRow.name || '').trim(),
      email: (bestStudentRow.email || '').trim().toLowerCase(),
      mobileNo: (bestStudentRow.mobile_no || '').toString().trim(),
      department: (bestStudentRow.department || '').trim(),
    };
  }

  const { data: profileRow, error: profileError } = await query(() => supabase
    .from('user_profiles')
    .select('email, display_name, department')
    .eq('email', normalizedEmail)
    .maybeSingle(), '');

  if (profileError && !isPermissionError(profileError)) throw profileError;
  if (!profileRow) return null;

  return {
    registerNo: '',
    name: (profileRow.display_name || '').trim(),
    email: (profileRow.email || normalizedEmail).trim().toLowerCase(),
    mobileNo: '',
    department: (profileRow.department || '').trim(),
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
  const normalizedNextEmail = (email || '').trim().toLowerCase();
  const lookupEmail = normalizedCurrentEmail || normalizedNextEmail;
  if (!lookupEmail) throw new Error('Email is required to update profile.');

  const payload = {
    register_no: (registerNo || '').trim(),
    name: (name || '').trim(),
    email: normalizedNextEmail,
    mobile_no: (mobileNo || '').trim(),
    department: (department || '').trim(),
  };

  const { data: existingRow, error: existingError } = await query(() => supabase
    .from('students')
    .select('register_no, email')
    .or(`email.ilike.${lookupEmail}${payload.register_no ? `,register_no.eq.${payload.register_no}` : ''}`)
    .limit(1)
    .maybeSingle(), '');

  if (existingError && !isPermissionError(existingError)) throw existingError;

  let data = null;

  if (existingRow) {
    const { data: updatedRow, error: updateError } = await query(() => supabase
      .from('students')
      .update(payload)
      .ilike('email', (existingRow.email || '').trim().toLowerCase())
      .select('register_no, name, email, mobile_no, department')
      .limit(1)
      .maybeSingle(), 'updateStudentProfileByEmail:update-existing');

    if (updateError) {
      if (!isPermissionError(updateError)) throw updateError;
    }
    data = updatedRow;
  } else {
    const { data: insertedRow, error: insertError } = await query(() => supabase
      .from('students')
      .insert(payload)
      .select('register_no, name, email, mobile_no, department')
      .limit(1)
      .maybeSingle(), '');

    if (insertError) {
      if (!isPermissionError(insertError)) throw insertError;
    }
    data = insertedRow;
  }

  const fallbackData = {
    register_no: payload.register_no,
    name: payload.name,
    email: payload.email || lookupEmail,
    mobile_no: payload.mobile_no,
    department: payload.department,
  };

  const finalRow = data || fallbackData;

  const { error: profileUpsertError } = await query(() => supabase
    .from('user_profiles')
    .upsert(
      [{
        email: (finalRow.email || lookupEmail || '').trim().toLowerCase(),
        role: 'student',
        display_name: (finalRow.name || '').trim(),
        department: (finalRow.department || '').trim().toUpperCase() || null,
      }],
      { onConflict: 'email' }
    ), '');

  if (profileUpsertError && !isPermissionError(profileUpsertError)) {
    throw profileUpsertError;
  }

  return {
    registerNo: (finalRow.register_no || '').trim(),
    name: (finalRow.name || '').trim(),
    email: (finalRow.email || '').trim().toLowerCase(),
    mobileNo: (finalRow.mobile_no || '').toString().trim(),
    department: (finalRow.department || '').trim(),
  };
};

export const assignClassToDepartment = async ({
  departmentCode,
  selectedCourse,
  venue,
  staffName,
  staffEmail,
  facultyEmail,
  actorEmail,
  actorRole,
  targetStudentEmails,
  dayOfWeek,
  startTime,
}) => {
  const { semester, academicYear } = await getSemesterContext();
  const normalizedDepartment = (departmentCode || '').trim().toUpperCase();
  if (!normalizedDepartment || normalizedDepartment === 'ALL') {
    throw new Error('Please choose a specific department.');
  }

  if (!selectedCourse?.code || !selectedCourse?.name) {
    throw new Error('Please choose a valid course.');
  }

  const normalizedDayOfWeek = (dayOfWeek || '').trim().toUpperCase();
  const validDays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
  if (!validDays.includes(normalizedDayOfWeek)) {
    throw new Error('Please choose a valid day.');
  }

  const normalizedStartTime = String(startTime || '').trim();
  if (!/^\d{2}:\d{2}$/.test(normalizedStartTime)) {
    throw new Error('Please provide start time in HH:MM format.');
  }
  const normalizedEndTime = addOneHourToTime(normalizedStartTime);

  const departmentStudents = [];
  let studentsPage = 1;
  const fetchPageSize = 500;
  let totalStudents = 0;

  do {
    const studentsResult = await getStudents({
      page: studentsPage,
      pageSize: fetchPageSize,
      department: normalizedDepartment,
    });

    totalStudents = studentsResult.total || 0;
    departmentStudents.push(...(studentsResult.data || []));
    studentsPage += 1;
  } while (departmentStudents.length < totalStudents);

  const normalizedTargetEmails = [...new Set(
    (Array.isArray(targetStudentEmails) ? targetStudentEmails : [])
      .map((email) => (email || '').trim().toLowerCase())
      .filter(Boolean)
  )];

  const targetStudents = normalizedTargetEmails.length
    ? departmentStudents.filter((student) => normalizedTargetEmails.includes(student.email))
    : departmentStudents;

  if (!targetStudents.length) {
    if (normalizedTargetEmails.length) {
      throw new Error(`No matching students found for selected emails in ${normalizedDepartment} department.`);
    }
    throw new Error(`No students found for ${normalizedDepartment} department.`);
  }

  const rows = targetStudents.map((student) => ({
    student_email: student.email,
    student_name: student.name,
    roll_no: student.rollNo,
    department: normalizedDepartment,
    course_code: selectedCourse.code,
    course_name: selectedCourse.name,
    semester,
    academic_year: academicYear || null,
    venue: (venue || '').trim(),
    staff_name: (staffName || '').trim(),
    staff_email: (staffEmail || '').trim().toLowerCase() || null,
    faculty_email: facultyEmail || null,
  }));

  const { data: oldRows } = await query(() => supabase
    .from('class_assignments')
    .select('student_email, course_code, venue, staff_name, staff_email, faculty_email, semester, academic_year')
    .eq('department', normalizedDepartment)
    .eq('course_code', selectedCourse.code)
    .eq('semester', semester), '');

  const { data, error } = await query(() => supabase
    .from('class_assignments')
    .upsert(rows, { onConflict: 'student_email,course_code,semester' })
    .select('student_email'), '');

  if (error) throw error;

  const timetablePayload = {
    day_of_week: normalizedDayOfWeek,
    start_time: `${normalizedStartTime}:00`,
    end_time: normalizedEndTime,
    department: normalizedDepartment,
    course_code: selectedCourse.code,
    course_name: selectedCourse.name,
    venue: (venue || '').trim() || null,
    faculty_email: (facultyEmail || '').trim().toLowerCase() || null,
    faculty_name: (staffName || '').trim() || null,
    staff_email: (staffEmail || '').trim().toLowerCase() || null,
    semester,
    is_active: true,
  };

  const { error: timetableError } = await query(() => supabase
    .from('timetable_entries')
    .upsert([timetablePayload], { onConflict: 'department,semester,day_of_week,start_time,course_code' }), 'assignClassToDepartment:timetable');

  if (timetableError && !isMissingTableError(timetableError)) throw timetableError;

  await logAuditEvent({
    actorEmail: actorEmail || facultyEmail,
    actorRole: actorRole || 'faculty',
    action: 'class_assignments.change',
    targetTable: 'class_assignments',
    targetId: `${selectedCourse.code}:${semester}`,
    oldData: {
      department: normalizedDepartment,
      records: oldRows || [],
    },
    newData: {
      department: normalizedDepartment,
      records: rows,
      timetable: timetablePayload,
    },
  });

  return data || [];
};

export const getClassAssignmentsByStudentEmail = async (studentEmail, departmentCode = null) => {
  const { semester } = await getSemesterContext();
  const identity = await resolveStudentIdentityByEmail(studentEmail);
  const normalizedEmail = identity.emails[0] || '';
  const normalizedDepartment = (departmentCode || '').trim().toUpperCase();
  const inferredDepartment = extractDepartmentCode(normalizedEmail);
  const fallbackDepartment = normalizedDepartment || identity.department || (inferredDepartment !== 'NA' ? inferredDepartment : '');

  if (!identity.emails.length && !fallbackDepartment) return [];

  if (identity.emails.length) {
    const assignmentResults = await Promise.all(
      identity.emails.map((email) =>
        query(() => supabase
          .from('class_assignments')
          .select('course_code, course_name, venue, staff_name, staff_email, faculty_email, department, updated_at')
          .ilike('student_email', email)
          .eq('semester', semester)
          .order('updated_at', { ascending: false }), 'getClassAssignmentsByStudentEmail:by-email')
      )
    );

    const firstEmailError = assignmentResults.map((result) => result.error).find(Boolean);
    if (firstEmailError) throw firstEmailError;

    const emailRows = assignmentResults.flatMap((result) => result.data || []);
    if (emailRows.length) {
      const grouped = new Map();
      emailRows.forEach((row) => {
        const key = `${row.course_code || ''}::${row.staff_email || row.staff_name || ''}::${row.venue || ''}`;
        if (!grouped.has(key)) {
          grouped.set(key, row);
        }
      });
      return Array.from(grouped.values());
    }
  }

  const additionalLookupQueries = [];
  if (identity.registerNo) {
    additionalLookupQueries.push(
      query(() => supabase
        .from('class_assignments')
        .select('course_code, course_name, venue, staff_name, staff_email, faculty_email, department, updated_at')
        .ilike('roll_no', `%${identity.registerNo}%`)
        .eq('semester', semester)
        .order('updated_at', { ascending: false }), 'getClassAssignmentsByStudentEmail:by-roll')
    );
  }

  if (identity.name && identity.name.length >= 3) {
    additionalLookupQueries.push(
      query(() => supabase
        .from('class_assignments')
        .select('course_code, course_name, venue, staff_name, staff_email, faculty_email, department, updated_at')
        .ilike('student_name', `%${identity.name}%`)
        .eq('semester', semester)
        .order('updated_at', { ascending: false }), 'getClassAssignmentsByStudentEmail:by-name')
    );
  }

  if (additionalLookupQueries.length) {
    const additionalResults = await Promise.all(additionalLookupQueries);
    const additionalError = additionalResults.map((result) => result.error).find(Boolean);
    if (additionalError) throw additionalError;

    const additionalRows = additionalResults.flatMap((result) => result.data || []);
    if (additionalRows.length) {
      const grouped = new Map();
      additionalRows.forEach((row) => {
        const key = `${row.course_code || ''}::${row.staff_email || row.staff_name || ''}::${row.venue || ''}`;
        if (!grouped.has(key)) {
          grouped.set(key, row);
        }
      });
      return Array.from(grouped.values());
    }
  }

  if (!fallbackDepartment) return [];

  const { data: departmentRows, error: departmentError } = await query(() => supabase
    .from('class_assignments')
    .select('course_code, course_name, venue, staff_name, staff_email, faculty_email, department, updated_at')
    .ilike('department', fallbackDepartment)
    .eq('semester', semester)
    .order('updated_at', { ascending: false }), '');

  if (departmentError) throw departmentError;

  const grouped = new Map();
  (departmentRows || []).forEach((row) => {
    const key = `${row.course_code || ''}::${row.staff_email || row.staff_name || ''}::${row.venue || ''}`;
    if (!grouped.has(key)) {
      grouped.set(key, row);
    }
  });

  return Array.from(grouped.values());
};

export const getClassAssignmentsByDepartment = async (departmentCode) => {
  const { semester } = await getSemesterContext();
  const normalizedDepartment = (departmentCode || '').trim().toUpperCase();
  if (!normalizedDepartment) return [];

  const { data, error } = await query(() => supabase
    .from('class_assignments')
    .select('student_email, course_code, course_name, venue, staff_name, staff_email, faculty_email, department, updated_at')
    .eq('department', normalizedDepartment)
    .eq('semester', semester)
    .order('course_code', { ascending: true })
    .order('updated_at', { ascending: false }), '');

  if (error) throw error;

  return data || [];
};

export const updateClassAssignmentVenueByDepartmentCourse = async ({
  departmentCode,
  courseCode,
  venue,
  actorEmail,
  actorRole,
}) => {
  const { semester } = await getSemesterContext();
  const normalizedDepartment = (departmentCode || '').trim().toUpperCase();
  const normalizedCourseCode = (courseCode || '').trim().toUpperCase();

  if (!normalizedDepartment || !normalizedCourseCode) {
    throw new Error('Department and course are required.');
  }

  const { data: oldRows } = await query(() => supabase
    .from('class_assignments')
    .select('student_email, venue, semester')
    .eq('department', normalizedDepartment)
    .eq('course_code', normalizedCourseCode)
    .eq('semester', semester), '');

  const { data, error } = await query(() => supabase
    .from('class_assignments')
    .update({
      venue: (venue || '').trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('department', normalizedDepartment)
    .eq('course_code', normalizedCourseCode)
    .eq('semester', semester)
    .select('student_email'), '');

  if (error) throw error;

  await logAuditEvent({
    actorEmail,
    actorRole,
    action: 'class_assignments.change',
    targetTable: 'class_assignments',
    targetId: `${normalizedCourseCode}:${semester}`,
    oldData: oldRows || [],
    newData: {
      venue: (venue || '').trim(),
      affectedRows: data || [],
    },
  });

  return data || [];
};

export const deleteClassAssignmentsByDepartmentCourse = async ({
  departmentCode,
  courseCode,
  actorEmail,
  actorRole,
}) => {
  const { semester } = await getSemesterContext();
  const normalizedDepartment = (departmentCode || '').trim().toUpperCase();
  const normalizedCourseCode = (courseCode || '').trim().toUpperCase();

  if (!normalizedDepartment || !normalizedCourseCode) {
    throw new Error('Department and course are required.');
  }

  const { data: oldRows } = await query(() => supabase
    .from('class_assignments')
    .select('student_email, course_code, semester')
    .eq('department', normalizedDepartment)
    .eq('course_code', normalizedCourseCode)
    .eq('semester', semester), '');

  const { data, error } = await query(() => supabase
    .from('class_assignments')
    .delete()
    .eq('department', normalizedDepartment)
    .eq('course_code', normalizedCourseCode)
    .eq('semester', semester)
    .select('student_email'), '');

  if (error) throw error;

  await logAuditEvent({
    actorEmail,
    actorRole,
    action: 'class_assignments.change',
    targetTable: 'class_assignments',
    targetId: `${normalizedCourseCode}:${semester}`,
    oldData: oldRows || [],
    newData: {
      deletedRows: data || [],
    },
  });

  return data || [];
};

export const getFacultyProfileByEmail = async (facultyEmail) => {
  const normalizedEmail = (facultyEmail || '').trim().toLowerCase();
  if (!normalizedEmail) return null;

  const isFilled = (value) => String(value || '').trim().length > 0;
  const getCompleteness = ({ displayName, department, phone, designation, joinedDate }) => {
    const fields = [displayName, department, phone, designation, joinedDate];
    const filledCount = fields.filter(isFilled).length;
    return Math.round((filledCount / fields.length) * 100);
  };

  const { data, error } = await query(() => supabase
    .from('user_profiles')
    .select('email, display_name, role, department, phone, designation, joined_date')
    .eq('email', normalizedEmail)
    .maybeSingle(), '');

  if (error) throw error;
  if (!data) return null;

  const normalizedProfile = {
    email: (data.email || '').trim().toLowerCase(),
    displayName: (data.display_name || '').trim(),
    role: (data.role || '').trim(),
    department: (data.department || '').trim().toUpperCase(),
    phone: (data.phone || '').trim(),
    designation: (data.designation || '').trim(),
    joinedDate: (data.joined_date || '').toString().slice(0, 10),
  };

  return {
    ...normalizedProfile,
    completeness: getCompleteness(normalizedProfile),
  };
};

export const updateFacultyDepartmentByEmail = async ({ facultyEmail, department }) => {
  const normalizedEmail = (facultyEmail || '').trim().toLowerCase();
  const normalizedDepartment = (department || '').trim().toUpperCase();

  if (!normalizedEmail) throw new Error('Faculty email is required.');
  if (!normalizedDepartment) throw new Error('Department is required.');

  const { data, error } = await query(() => supabase
    .from('user_profiles')
    .update({ department: normalizedDepartment, updated_at: new Date().toISOString() })
    .eq('email', normalizedEmail)
    .select('email, display_name, role, department, phone, designation, joined_date')
    .maybeSingle(), '');

  if (error) throw error;
  if (!data) throw new Error('Faculty profile not found.');

  const normalizedProfile = {
    email: (data.email || '').trim().toLowerCase(),
    displayName: (data.display_name || '').trim(),
    role: (data.role || '').trim(),
    department: (data.department || '').trim().toUpperCase(),
    phone: (data.phone || '').trim(),
    designation: (data.designation || '').trim(),
    joinedDate: (data.joined_date || '').toString().slice(0, 10),
  };

  const profileFields = [
    normalizedProfile.displayName,
    normalizedProfile.department,
    normalizedProfile.phone,
    normalizedProfile.designation,
    normalizedProfile.joinedDate,
  ];

  return {
    ...normalizedProfile,
    completeness: Math.round((profileFields.filter((value) => String(value || '').trim()).length / profileFields.length) * 100),
  };
};

export const updateFacultyProfileByEmail = async ({
  facultyEmail,
  displayName,
  department,
  phone,
  designation,
  joinedDate,
}) => {
  const normalizedEmail = (facultyEmail || '').trim().toLowerCase();
  if (!normalizedEmail) throw new Error('Faculty email is required.');

  const normalizedDepartment = (department || '').trim().toUpperCase();
  const payload = {
    display_name: (displayName || '').trim() || null,
    department: normalizedDepartment || null,
    phone: (phone || '').trim() || null,
    designation: (designation || '').trim() || null,
    joined_date: joinedDate || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await query(() => supabase
    .from('user_profiles')
    .update(payload)
    .eq('email', normalizedEmail)
    .select('email, display_name, role, department, phone, designation, joined_date')
    .maybeSingle(), '');

  if (error) throw error;
  if (!data) throw new Error('Faculty profile not found.');

  const normalizedProfile = {
    email: (data.email || '').trim().toLowerCase(),
    displayName: (data.display_name || '').trim(),
    role: (data.role || '').trim(),
    department: (data.department || '').trim().toUpperCase(),
    phone: (data.phone || '').trim(),
    designation: (data.designation || '').trim(),
    joinedDate: (data.joined_date || '').toString().slice(0, 10),
  };

  const profileFields = [
    normalizedProfile.displayName,
    normalizedProfile.department,
    normalizedProfile.phone,
    normalizedProfile.designation,
    normalizedProfile.joinedDate,
  ];

  return {
    ...normalizedProfile,
    completeness: Math.round((profileFields.filter((value) => String(value || '').trim()).length / profileFields.length) * 100),
  };
};

export const getDepartmentCourses = async (departmentCode) => {
  const normalizedDepartment = (departmentCode || '').trim().toUpperCase();
  if (!normalizedDepartment) return [];

  const { data, error } = await query(() => supabase
    .from('department_courses')
    .select('department, course_code, course_name')
    .eq('department', normalizedDepartment)
    .order('course_code', { ascending: true }), '');

  if (error) throw error;

  return (data || []).map((row) => ({
    department: (row.department || '').trim().toUpperCase(),
    code: (row.course_code || '').trim().toUpperCase(),
    name: (row.course_name || '').trim(),
  }));
};

export const getDepartments = async () => {
  const { data, error } = await query(() => supabase
    .from('departments')
    .select('code, name, is_active')
    .eq('is_active', true)
    .order('code', { ascending: true }), '');

  if (error) throw error;

  return (data || []).map((row) => ({
    code: (row.code || '').trim().toUpperCase(),
    name: (row.name || '').trim(),
    isActive: row.is_active !== false,
  }));
};

export const getDepartmentsAdmin = async () => {
  const [departmentsResult, studentsResult, facultyProfilesResult] = await Promise.all([
    query(() => supabase
      .from('departments')
      .select('code, name, is_active')
      .order('code', { ascending: true }), 'getDepartmentsAdmin:departments'),
    query(() => supabase
      .from('students')
      .select('department, email'), 'getDepartmentsAdmin:students'),
    query(() => supabase
      .from('user_profiles')
      .select('department, email')
      .eq('role', 'faculty'), 'getDepartmentsAdmin:faculty-profiles'),
  ]);

  const firstError = [departmentsResult.error, studentsResult.error, facultyProfilesResult.error].find(Boolean);
  if (firstError) throw firstError;

  const studentCountByDepartment = new Map();
  (studentsResult.data || []).forEach((row) => {
    const department = (row.department || 'NA').trim().toUpperCase();
    studentCountByDepartment.set(department, (studentCountByDepartment.get(department) || 0) + 1);
  });

  const facultyCountByDepartment = new Map();
  (facultyProfilesResult.data || []).forEach((row) => {
    const department = (row.department || 'NA').trim().toUpperCase();
    facultyCountByDepartment.set(department, (facultyCountByDepartment.get(department) || 0) + 1);
  });

  return (departmentsResult.data || []).map((row) => {
    const code = (row.code || '').trim().toUpperCase();
    return {
      code,
      name: (row.name || '').trim(),
      isActive: row.is_active !== false,
      studentCount: studentCountByDepartment.get(code) || 0,
      facultyCount: facultyCountByDepartment.get(code) || 0,
    };
  });
};

export const createDepartment = async ({ code, name }) => {
  const normalizedCode = (code || '').trim().toUpperCase();
  const normalizedName = (name || '').trim();
  if (!/^[A-Z]{2,4}$/.test(normalizedCode)) {
    throw new Error('Department code must be 2 to 4 uppercase letters.');
  }
  if (!normalizedName) {
    throw new Error('Department name is required.');
  }

  const { error } = await query(() => supabase
    .from('departments')
    .insert([{ code: normalizedCode, name: normalizedName, is_active: true }]), 'createDepartment');

  if (error) throw error;
};

export const updateDepartmentName = async ({ code, name }) => {
  const normalizedCode = (code || '').trim().toUpperCase();
  const normalizedName = (name || '').trim();

  if (!normalizedCode) throw new Error('Department code is required.');
  if (!normalizedName) throw new Error('Department name is required.');

  const { error } = await query(() => supabase
    .from('departments')
    .update({ name: normalizedName })
    .eq('code', normalizedCode), 'updateDepartmentName');

  if (error) throw error;
};

export const setDepartmentActiveStatus = async ({ code, isActive }) => {
  const normalizedCode = (code || '').trim().toUpperCase();
  if (!normalizedCode) {
    throw new Error('Department code is required.');
  }

  const { error } = await query(() => supabase
    .from('departments')
    .update({ is_active: Boolean(isActive) })
    .eq('code', normalizedCode), 'setDepartmentActiveStatus');

  if (error) throw error;
};

export const getDepartmentStaff = async (departmentCode) => {
  const normalizedDepartment = (departmentCode || '').trim().toUpperCase();
  if (!normalizedDepartment) return [];

  const { data, error } = await query(() => supabase
    .from('user_profiles')
    .select('email, display_name, department, role')
    .eq('role', 'faculty')
    .eq('department', normalizedDepartment)
    .order('display_name', { ascending: true }), 'getDepartmentStaff');

  if (error) throw error;

  return (data || []).map((row) => ({
    email: (row.email || '').trim().toLowerCase(),
    displayName: (row.display_name || '').trim(),
    department: (row.department || '').trim().toUpperCase(),
    role: (row.role || '').trim(),
  }));
};

export const getAnalyticsData = async () => {
  const { semester } = await getSemesterContext();
  const [studentsResult, marksResult, attendanceResult] = await Promise.all([
    query(() => supabase.from('students').select('department, email'), 'getAnalyticsData:students'),
    query(() => supabase.from('marks_records').select('student_email, total').eq('semester', semester), 'getAnalyticsData:marks'),
    query(() => supabase.from('attendance_records').select('student_email, is_present').eq('semester', semester), 'getAnalyticsData:attendance'),
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

const toIsoDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeGrade = (grade, total) => {
  const normalized = (grade || '').toString().trim().toUpperCase();
  const allowed = ['A+', 'A', 'B', 'C', 'D', 'F'];
  if (allowed.includes(normalized)) return normalized;

  const score = Number(total || 0);
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
};

export const getAdvancedAnalyticsData = async ({ startDate, endDate } = {}) => {
  const today = new Date();
  const defaultStart = new Date(today);
  defaultStart.setDate(today.getDate() - 29);

  const start = toIsoDate(startDate || defaultStart);
  const end = toIsoDate(endDate || today);

  const [studentsResult, attendanceResult, marksResult, usersResult, profilesResult] = await Promise.all([
    query(() => supabase
      .from('students')
      .select('email, department'), 'getAdvancedAnalyticsData:students'),
    query(() => supabase
      .from('attendance_records')
      .select('student_email, attendance_date, is_present')
      .gte('attendance_date', start)
      .lte('attendance_date', end), 'getAdvancedAnalyticsData:attendance'),
    query(() => supabase
      .from('marks_records')
      .select('student_email, total, grade, updated_at')
      .gte('updated_at', `${start}T00:00:00.000Z`)
      .lte('updated_at', `${end}T23:59:59.999Z`), 'getAdvancedAnalyticsData:marks'),
    query(() => supabase
      .from('users')
      .select('email, role, created_at')
      .eq('role', 'student')
      .gte('created_at', `${start}T00:00:00.000Z`)
      .lte('created_at', `${end}T23:59:59.999Z`), 'getAdvancedAnalyticsData:users'),
    query(() => supabase
      .from('user_profiles')
      .select('email, department, role')
      .eq('role', 'student'), 'getAdvancedAnalyticsData:profiles'),
  ]);

  const firstError = [studentsResult.error, attendanceResult.error, marksResult.error, usersResult.error, profilesResult.error].find(Boolean);
  if (firstError) throw firstError;

  const studentsRows = studentsResult.data || [];
  const attendanceRows = attendanceResult.data || [];
  const marksRows = marksResult.data || [];
  const usersRows = usersResult.data || [];
  const profileRows = profilesResult.data || [];

  const departmentByEmail = new Map();
  studentsRows.forEach((row) => {
    const email = (row.email || '').trim().toLowerCase();
    if (!email) return;
    departmentByEmail.set(email, (row.department || 'NA').trim().toUpperCase() || 'NA');
  });
  profileRows.forEach((row) => {
    const email = (row.email || '').trim().toLowerCase();
    if (!email || departmentByEmail.has(email)) return;
    departmentByEmail.set(email, (row.department || 'NA').trim().toUpperCase() || 'NA');
  });

  const attendanceByDate = new Map();
  const attendanceByStudent = new Map();
  const attendanceByDepartment = new Map();

  attendanceRows.forEach((row) => {
    const dateKey = (row.attendance_date || '').trim();
    const email = (row.student_email || '').trim().toLowerCase();
    if (!dateKey) return;

    if (!attendanceByDate.has(dateKey)) {
      attendanceByDate.set(dateKey, { present: 0, total: 0 });
    }
    const byDate = attendanceByDate.get(dateKey);
    byDate.total += 1;
    if (row.is_present) byDate.present += 1;

    if (email) {
      if (!attendanceByStudent.has(email)) {
        attendanceByStudent.set(email, { present: 0, total: 0 });
      }
      const byStudent = attendanceByStudent.get(email);
      byStudent.total += 1;
      if (row.is_present) byStudent.present += 1;

      const department = departmentByEmail.get(email) || 'NA';
      if (!attendanceByDepartment.has(department)) {
        attendanceByDepartment.set(department, { present: 0, total: 0 });
      }
      const byDepartment = attendanceByDepartment.get(department);
      byDepartment.total += 1;
      if (row.is_present) byDepartment.present += 1;
    }
  });

  const attendanceTrend = [...attendanceByDate.entries()]
    .sort((left, right) => right[0].localeCompare(left[0]))
    .slice(0, 30)
    .reverse()
    .map(([date, value]) => ({
      date,
      attendancePct: value.total ? Number(((value.present / value.total) * 100).toFixed(1)) : 0,
    }));

  const gradeOrder = ['A+', 'A', 'B', 'C', 'D', 'F'];
  const marksByDepartmentAndGrade = new Map();
  const marksByDepartment = new Map();

  marksRows.forEach((row) => {
    const email = (row.student_email || '').trim().toLowerCase();
    const department = departmentByEmail.get(email) || 'NA';
    const grade = normalizeGrade(row.grade, row.total);

    const gradeBucketKey = `${department}::${grade}`;
    marksByDepartmentAndGrade.set(gradeBucketKey, (marksByDepartmentAndGrade.get(gradeBucketKey) || 0) + 1);

    if (!marksByDepartment.has(department)) {
      marksByDepartment.set(department, { total: 0, count: 0 });
    }
    const deptMarks = marksByDepartment.get(department);
    deptMarks.total += Number(row.total || 0);
    deptMarks.count += 1;
  });

  const allDepartments = [...new Set([
    ...[...departmentByEmail.values()],
    ...[...attendanceByDepartment.keys()],
    ...[...marksByDepartment.keys()],
  ])].filter(Boolean).sort((a, b) => a.localeCompare(b));

  const marksDistribution = gradeOrder.map((grade) => {
    const row = { grade };
    allDepartments.forEach((department) => {
      const key = `${department}::${grade}`;
      row[department] = marksByDepartmentAndGrade.get(key) || 0;
    });
    return row;
  });

  const enrollmentByDepartment = new Map();
  usersRows.forEach((row) => {
    const email = (row.email || '').trim().toLowerCase();
    const department = departmentByEmail.get(email) || 'NA';
    enrollmentByDepartment.set(department, (enrollmentByDepartment.get(department) || 0) + 1);
  });

  const departmentComparison = ['AG', 'CS', 'IT'].map((department) => {
    const attendance = attendanceByDepartment.get(department);
    const marks = marksByDepartment.get(department);

    return {
      department,
      avgAttendancePct: attendance?.total ? Number(((attendance.present / attendance.total) * 100).toFixed(1)) : 0,
      avgMarks: marks?.count ? Number((marks.total / marks.count).toFixed(1)) : 0,
      enrollmentCount: enrollmentByDepartment.get(department) || 0,
    };
  });

  const topDefaulters = [...attendanceByStudent.entries()]
    .map(([email, stats]) => ({
      email,
      department: departmentByEmail.get(email) || 'NA',
      attendancePct: stats.total ? Number(((stats.present / stats.total) * 100).toFixed(1)) : 0,
      totalDays: stats.total,
    }))
    .filter((student) => student.totalDays > 0 && student.attendancePct < 75)
    .sort((left, right) => left.attendancePct - right.attendancePct)
    .slice(0, 25);

  return {
    range: { start, end },
    attendanceTrend,
    marksDistribution,
    departments: allDepartments,
    departmentComparison,
    topDefaulters,
  };
};

export const getUsersWithProfiles = async () => {
  const [usersResult, profileResult] = await Promise.all([
    query(() => supabase.from('users').select('id, email, role, is_active, last_login_at, login_count, created_at').order('created_at', { ascending: false }), 'getUsersWithProfiles:users'),
    query(() => supabase.from('user_profiles').select('email, display_name, department'), 'getUsersWithProfiles:profiles'),
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

  const { error: usersError } = await query(() => supabase
    .from('users')
    .upsert(
      [{ email: normalizedEmail, role: normalizedRole, is_active: true }],
      { onConflict: 'email' }
    ), '');

  if (usersError) throw usersError;

  const { error: profileError } = await query(() => supabase
    .from('user_profiles')
    .upsert(
      [{
        email: normalizedEmail,
        role: normalizedRole,
        display_name: (displayName || '').trim() || normalizedEmail,
        department: normalizedDepartment,
      }],
      { onConflict: 'email' }
    ), '');

  if (profileError) throw profileError;
};

export const deleteUserByEmail = async (email) => {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) throw new Error('Email is required.');

  const [usersResult, profileResult] = await Promise.all([
    query(() => supabase.from('users').delete().eq('email', normalizedEmail), 'deleteUserByEmail:users'),
    query(() => supabase.from('user_profiles').delete().eq('email', normalizedEmail), 'deleteUserByEmail:profiles'),
  ]);

  const firstError = [usersResult.error, profileResult.error].find(Boolean);
  if (firstError) throw firstError;
};

export const updateUserAccessByEmail = async ({ email, isActive, actorEmail, actorRole }) => {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) throw new Error('Email is required.');

  const { data: oldRow, error: oldRowError } = await query(() => supabase
    .from('users')
    .select('email, role, is_active')
    .eq('email', normalizedEmail)
    .maybeSingle(), '');

  if (oldRowError) throw oldRowError;

  const { data: updatedRows, error } = await query(() => supabase
    .from('users')
    .update({
      is_active: Boolean(isActive),
      updated_at: new Date().toISOString(),
    })
    .eq('email', normalizedEmail)
    .select('email, role, is_active'), '');

  if (error) throw error;

  await logAuditEvent({
    actorEmail,
    actorRole,
    action: 'user.disable',
    targetTable: 'users',
    targetId: normalizedEmail,
    oldData: oldRow || null,
    newData: (updatedRows || [])[0] || null,
  });
};

export const getAdminAccessOverview = async () => {
  const [usersResult, coursesCountResult, staffCountResult] = await Promise.all([
    query(() => supabase
      .from('users')
      .select('email, role, is_active, last_login_at, login_count, created_at')
      .order('last_login_at', { ascending: false }), 'getAdminAccessOverview:users'),
    query(() => supabase.from('department_courses').select('id', { count: 'exact', head: true }), 'getAdminAccessOverview:courses-count'),
    query(() => supabase.from('department_staff').select('staff_email', { count: 'exact', head: true }).eq('is_active', true), 'getAdminAccessOverview:staff-count'),
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
  const { data, error } = await query(() => supabase
    .from('department_courses')
    .select('id, department, course_code, course_name, updated_at')
    .order('department', { ascending: true })
    .order('course_code', { ascending: true }), '');

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

  const { error } = await query(() => supabase
    .from('department_courses')
    .upsert(
      [{
        department: normalizedDepartment,
        course_code: normalizedCourseCode,
        course_name: normalizedCourseName,
      }],
      { onConflict: 'department,course_code' }
    ), '');

  if (error) throw error;
};

export const deleteDepartmentCourse = async ({ department, courseCode }) => {
  const normalizedDepartment = (department || '').trim().toUpperCase();
  const normalizedCourseCode = (courseCode || '').trim().toUpperCase();
  if (!normalizedDepartment || !normalizedCourseCode) {
    throw new Error('Department and course code are required.');
  }

  const { error } = await query(() => supabase
    .from('department_courses')
    .delete()
    .eq('department', normalizedDepartment)
    .eq('course_code', normalizedCourseCode), '');

  if (error) throw error;
};

export const getStudentDashboardSummary = async (studentEmail, studentDepartment = null) => {
  const normalizedEmail = (studentEmail || '').trim().toLowerCase();
  if (!normalizedEmail) return null;

  const [attendanceResult, marksResult, assignmentResult] = await Promise.all([
    getAttendanceByStudentEmail(normalizedEmail),
    getMarksByStudentEmail(normalizedEmail),
    getClassAssignmentsByStudentEmail(normalizedEmail, studentDepartment),
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
  allow_student_self_register: true,
  current_semester: DEFAULT_ACTIVE_SEMESTER,
  grade_boundaries: '{"A+":90,"A":80,"B":70,"C":60,"D":50,"F":0}',
  max_attendance_edit_days: 7,
  maintenance_mode: false,
  institution_name: 'AAWE',
  support_email: 'admin@university.edu',
  support_contact: 'admin@university.edu',
};

export const getSystemSettings = async () => {
  const { data, error } = await query(() => supabase
    .from('system_settings')
    .select('setting_key, setting_value')
    .order('setting_key', { ascending: true }), '');

  if (error) throw error;

  const merged = { ...DEFAULT_SYSTEM_SETTINGS };
  (data || []).forEach((row) => {
    const key = row.setting_key;
    if (!key) return;
    merged[key] = row.setting_value;
  });

  if (!merged.support_email && merged.support_contact) {
    merged.support_email = merged.support_contact;
  }
  if (!merged.support_contact && merged.support_email) {
    merged.support_contact = merged.support_email;
  }

  return merged;
};

export const saveSystemSettings = async (settings) => {
  const payload = Object.entries(settings || {}).map(([settingKey, settingValue]) => ({
    setting_key: settingKey,
    setting_value: settingValue,
    updated_at: new Date().toISOString(),
  }));

  if (!payload.length) return;

  const { error } = await query(() => supabase
    .from('system_settings')
    .upsert(payload, { onConflict: 'setting_key' }), '');

  if (error) throw error;
};

export const saveAttendanceForCourseDate = async ({
  students,
  selectedCourse,
  selectedDate,
  facultyEmail,
  actorEmail,
  actorRole,
}) => {
  const { semester, academicYear } = await getSemesterContext();
  const normalizedStudentEmails = uniqueNonEmpty((students || []).map((student) => (student?.email || '').trim().toLowerCase()));

  const { data: oldRows } = normalizedStudentEmails.length
    ? await query(() => supabase
      .from('attendance_records')
      .select('student_email, course_code, attendance_date, is_present, semester')
      .eq('course_code', selectedCourse.code)
      .eq('attendance_date', selectedDate)
      .eq('semester', semester)
      .in('student_email', normalizedStudentEmails), '')
    : { data: [] };

  const rows = students.map((student) => ({
    student_email: student.email,
    student_name: student.name,
    roll_no: student.rollNo,
    course_code: selectedCourse.code,
    course_name: selectedCourse.name,
    semester,
    academic_year: academicYear || null,
    attendance_date: selectedDate,
    is_present: student.attendance,
    faculty_email: facultyEmail || null,
  }));

  const { error } = await query(() => supabase
    .from('attendance_records')
    .upsert(rows, { onConflict: 'student_email,course_code,attendance_date,semester' }), '');

  if (error) throw error;

  await logAuditEvent({
    actorEmail: actorEmail || facultyEmail,
    actorRole: actorRole || 'faculty',
    action: 'attendance.bulk_insert',
    targetTable: 'attendance_records',
    targetId: `${selectedCourse.code}:${selectedDate}:${semester}`,
    oldData: oldRows || [],
    newData: rows,
  });
};

export const getAttendanceByStudentEmail = async (studentEmail) => {
  const { semester } = await getSemesterContext();
  const identity = await resolveStudentIdentityByEmail(studentEmail);
  if (!identity.emails.length && !identity.registerNo && !identity.name) return [];

  const emailResults = await Promise.all(
    identity.emails.map((email) =>
      query(() => supabase
        .from('attendance_records')
        .select('course_code, course_name, attendance_date, is_present, faculty_email, roll_no')
        .ilike('student_email', email)
        .eq('semester', semester)
        .order('attendance_date', { ascending: false }), 'getAttendanceByStudentEmail:by-email')
    )
  );

  const firstEmailError = emailResults.map((result) => result.error).find(Boolean);
  if (firstEmailError) throw firstEmailError;

  let rollNoRows = [];
  if (identity.registerNo) {
    const { data: rollRows, error: rollError } = await query(() => supabase
      .from('attendance_records')
      .select('course_code, course_name, attendance_date, is_present, faculty_email, roll_no')
      .ilike('roll_no', `%${identity.registerNo}%`)
      .eq('semester', semester)
      .order('attendance_date', { ascending: false }), '');

    if (rollError) throw rollError;
    rollNoRows = rollRows || [];
  }

  let nameRows = [];
  if (identity.name && identity.name.length >= 3) {
    const { data: studentNameRows, error: nameError } = await query(() => supabase
      .from('attendance_records')
      .select('course_code, course_name, attendance_date, is_present, faculty_email, roll_no')
      .ilike('student_name', `%${identity.name}%`)
      .eq('semester', semester)
      .order('attendance_date', { ascending: false }), '');

    if (nameError) throw nameError;
    nameRows = studentNameRows || [];
  }

  let mergedRows = [...emailResults.flatMap((result) => result.data || []), ...rollNoRows, ...nameRows];

  // Fallback for legacy/misaligned semester data: if current semester has no rows, fetch across semesters.
  if (!mergedRows.length) {
    const emailFallbackResults = await Promise.all(
      identity.emails.map((email) =>
        query(() => supabase
          .from('attendance_records')
          .select('course_code, course_name, attendance_date, is_present, faculty_email, roll_no')
          .ilike('student_email', email)
          .order('attendance_date', { ascending: false })
          .limit(300), 'getAttendanceByStudentEmail:fallback-by-email')
      )
    );

    const firstEmailFallbackError = emailFallbackResults.map((result) => result.error).find(Boolean);
    if (firstEmailFallbackError) throw firstEmailFallbackError;

    let rollFallbackRows = [];
    if (identity.registerNo) {
      const { data: rollRows, error: rollError } = await query(() => supabase
        .from('attendance_records')
        .select('course_code, course_name, attendance_date, is_present, faculty_email, roll_no')
        .ilike('roll_no', `%${identity.registerNo}%`)
        .order('attendance_date', { ascending: false })
        .limit(300), 'getAttendanceByStudentEmail:fallback-by-roll');

      if (rollError) throw rollError;
      rollFallbackRows = rollRows || [];
    }

    let nameFallbackRows = [];
    if (identity.name && identity.name.length >= 3) {
      const { data: studentNameRows, error: nameError } = await query(() => supabase
        .from('attendance_records')
        .select('course_code, course_name, attendance_date, is_present, faculty_email, roll_no')
        .ilike('student_name', `%${identity.name}%`)
        .order('attendance_date', { ascending: false })
        .limit(300), 'getAttendanceByStudentEmail:fallback-by-name');

      if (nameError) throw nameError;
      nameFallbackRows = studentNameRows || [];
    }

    mergedRows = [...emailFallbackResults.flatMap((result) => result.data || []), ...rollFallbackRows, ...nameFallbackRows];
  }
  const deduped = new Map();
  mergedRows.forEach((row) => {
    const key = `${row.course_code || ''}::${row.attendance_date || ''}`;
    if (!deduped.has(key)) {
      deduped.set(key, row);
    }
  });

  return Array.from(deduped.values());
};

export const getRecentAttendanceActivityByStudentEmail = async (studentEmail, limit = 5) => {
  const normalizedLimit = Number.isFinite(Number(limit)) ? Math.max(1, Math.min(20, Number(limit))) : 5;
  const attendanceRows = await getAttendanceByStudentEmail(studentEmail);

  return [...attendanceRows]
    .sort((left, right) => String(right.attendance_date || '').localeCompare(String(left.attendance_date || '')))
    .slice(0, normalizedLimit)
    .map((row) => ({
      course_code: row.course_code,
      course_name: row.course_name,
      attendance_date: row.attendance_date,
      is_present: row.is_present,
      faculty_email: row.faculty_email,
    }));
};

export const getAttendanceForCourseDate = async ({ courseCode, selectedDate }) => {
  const { semester } = await getSemesterContext();
  const { data, error } = await query(() => supabase
    .from('attendance_records')
    .select('student_email, is_present')
    .eq('course_code', courseCode)
    .eq('semester', semester)
    .eq('attendance_date', selectedDate), '');

  if (error) throw error;
  return data || [];
};

export const deleteAttendanceForCourseDate = async ({
  courseCode,
  selectedDate,
}) => {
  const { semester } = await getSemesterContext();
  const { error } = await query(() => supabase
    .from('attendance_records')
    .delete()
    .eq('course_code', courseCode)
    .eq('semester', semester)
    .eq('attendance_date', selectedDate), '');

  if (error) throw error;
};

export const saveMarksForCourse = async ({ students, selectedCourse, facultyEmail, actorEmail, actorRole }) => {
  const { semester, academicYear } = await getSemesterContext();
  const normalizedStudentEmails = uniqueNonEmpty((students || []).map((student) => (student?.email || '').trim().toLowerCase()));

  const { data: oldRows } = normalizedStudentEmails.length
    ? await query(() => supabase
      .from('marks_records')
      .select('student_email, course_code, mid_term, assignment, quiz, end_term, total, grade, semester')
      .eq('course_code', selectedCourse.code)
      .eq('semester', semester)
      .in('student_email', normalizedStudentEmails), '')
    : { data: [] };

  const rows = students.map((student) => ({
    student_email: student.email,
    student_name: student.name,
    roll_no: student.rollNo,
    course_code: selectedCourse.code,
    course_name: selectedCourse.name,
    semester,
    academic_year: academicYear || null,
    mid_term: student.midTerm,
    assignment: student.assignment,
    quiz: student.quiz,
    end_term: student.endTerm,
    total: Number(student.total.toFixed(1)),
    grade: normalizeGrade(student.grade, student.total),
    faculty_email: facultyEmail || null,
  }));

  const { error } = await query(() => supabase
    .from('marks_records')
    .upsert(rows, { onConflict: 'student_email,course_code,semester' }), '');

  if (error) throw error;

  await logAuditEvent({
    actorEmail: actorEmail || facultyEmail,
    actorRole: actorRole || 'faculty',
    action: 'marks.update',
    targetTable: 'marks_records',
    targetId: `${selectedCourse.code}:${semester}`,
    oldData: oldRows || [],
    newData: rows,
  });
};

export const getMarksByStudentEmail = async (studentEmail) => {
  const { semester } = await getSemesterContext();
  const identity = await resolveStudentIdentityByEmail(studentEmail);
  if (!identity.emails.length && !identity.registerNo && !identity.name) return [];

  const emailResults = await Promise.all(
    identity.emails.map((email) =>
      query(() => supabase
        .from('marks_records')
        .select('course_code, course_name, mid_term, assignment, quiz, end_term, total, grade, roll_no')
        .ilike('student_email', email)
        .eq('semester', semester)
        .order('course_code', { ascending: true }), 'getMarksByStudentEmail:by-email')
    )
  );

  const firstEmailError = emailResults.map((result) => result.error).find(Boolean);
  if (firstEmailError) throw firstEmailError;

  let rollNoRows = [];
  if (identity.registerNo) {
    const { data: rollRows, error: rollError } = await query(() => supabase
      .from('marks_records')
      .select('course_code, course_name, mid_term, assignment, quiz, end_term, total, grade, roll_no')
      .ilike('roll_no', `%${identity.registerNo}%`)
      .eq('semester', semester)
      .order('course_code', { ascending: true }), '');

    if (rollError) throw rollError;
    rollNoRows = rollRows || [];
  }

  let nameRows = [];
  if (identity.name && identity.name.length >= 3) {
    const { data: studentNameRows, error: nameError } = await query(() => supabase
      .from('marks_records')
      .select('course_code, course_name, mid_term, assignment, quiz, end_term, total, grade, roll_no')
      .ilike('student_name', `%${identity.name}%`)
      .eq('semester', semester)
      .order('course_code', { ascending: true }), '');

    if (nameError) throw nameError;
    nameRows = studentNameRows || [];
  }

  const mergedRows = [...emailResults.flatMap((result) => result.data || []), ...rollNoRows, ...nameRows];
  const deduped = new Map();
  mergedRows.forEach((row) => {
    const key = `${row.course_code || ''}`;
    if (!deduped.has(key)) {
      deduped.set(key, row);
    }
  });

  return Array.from(deduped.values());
};

export const getMarksForCourse = async (courseCode) => {
  const { semester } = await getSemesterContext();
  const { data, error } = await query(() => supabase
    .from('marks_records')
    .select('student_email, mid_term, assignment, quiz, end_term, total, grade')
    .eq('course_code', courseCode)
    .eq('semester', semester), '');

  if (error) throw error;
  return data || [];
};

export const getMarksForCourseInSemester = async ({ courseCode, semester }) => {
  const normalizedSemester = normalizeSemester(semester);
  if (!courseCode || !normalizedSemester) return [];

  const { data, error } = await query(() => supabase
    .from('marks_records')
    .select('student_email, mid_term, assignment, quiz, end_term, total, grade')
    .eq('course_code', courseCode)
    .eq('semester', normalizedSemester), '');

  if (error) throw error;
  return data || [];
};

export const deleteMarksForCourse = async (courseCode) => {
  const { semester } = await getSemesterContext();
  const { error } = await query(() => supabase
    .from('marks_records')
    .delete()
    .eq('course_code', courseCode)
    .eq('semester', semester), '');

  if (error) throw error;
};

// ─── Notifications ────────────────────────────────────────────────────────────

export const getNotifications = async (recipientEmail, limit = 30) => {
  if (!recipientEmail) return [];
  const { data, error } = await query(() => supabase
    .from('notifications')
    .select('id, title, body, type, is_read, created_at')
    .eq('recipient_email', recipientEmail.trim().toLowerCase())
    .order('created_at', { ascending: false })
    .limit(limit), '');
  if (error) throw error;
  return data || [];
};

export const markAllNotificationsRead = async (recipientEmail) => {
  if (!recipientEmail) return;
  const { error } = await query(() => supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('recipient_email', recipientEmail.trim().toLowerCase())
    .eq('is_read', false), '');
  if (error) throw error;
};

export const sendNotification = async ({ recipientEmail, title, body = null, type = 'info' }) => {
  const { error } = await query(() => supabase
    .from('notifications')
    .insert({
      recipient_email: (recipientEmail || '').trim().toLowerCase(),
      title,
      body,
      type,
    }), '');
  if (error) throw error;
};

const TIMETABLE_DAY_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

const sortTimetableRows = (rows) => (rows || []).slice().sort((left, right) => {
  const dayDiff = TIMETABLE_DAY_ORDER.indexOf((left.day_of_week || '').toUpperCase()) - TIMETABLE_DAY_ORDER.indexOf((right.day_of_week || '').toUpperCase());
  if (dayDiff !== 0) return dayDiff;
  return String(left.start_time || '').localeCompare(String(right.start_time || ''));
});

const mapTimetableRow = (row) => ({
  id: row.id,
  dayOfWeek: (row.day_of_week || '').trim().toUpperCase(),
  startTime: (row.start_time || '').toString().slice(0, 5),
  endTime: (row.end_time || '').toString().slice(0, 5),
  department: (row.department || '').trim().toUpperCase(),
  courseCode: (row.course_code || '').trim().toUpperCase(),
  courseName: (row.course_name || '').trim(),
  venue: (row.venue || '').trim(),
  facultyEmail: (row.faculty_email || '').trim().toLowerCase(),
  facultyName: (row.faculty_name || '').trim(),
  semester: (row.semester || '').trim().toUpperCase(),
  isActive: row.is_active !== false,
});

export const getStudentTimetableByEmail = async (studentEmail, studentDepartment = '') => {
  const { semester } = await getSemesterContext();
  const identity = await resolveStudentIdentityByEmail(studentEmail);
  const normalizedDepartment = (studentDepartment || identity.department || '').trim().toUpperCase();
  if (!normalizedDepartment) return [];

  const { data, error } = await query(() => supabase
    .from('timetable_entries')
    .select('id, day_of_week, start_time, end_time, department, course_code, course_name, venue, faculty_email, faculty_name, semester, is_active')
    .eq('department', normalizedDepartment)
    .eq('semester', semester)
    .eq('is_active', true), 'getStudentTimetableByEmail');

  if (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
  return sortTimetableRows(data).map(mapTimetableRow);
};

export const getFacultyTimetableByEmail = async (facultyEmail) => {
  const { semester } = await getSemesterContext();
  const normalizedEmail = (facultyEmail || '').trim().toLowerCase();
  if (!normalizedEmail) return [];

  const { data, error } = await query(() => supabase
    .from('timetable_entries')
    .select('id, day_of_week, start_time, end_time, department, course_code, course_name, venue, faculty_email, faculty_name, semester, is_active')
    .eq('semester', semester)
    .eq('is_active', true)
    .or(`faculty_email.ilike.${normalizedEmail},staff_email.ilike.${normalizedEmail}`), 'getFacultyTimetableByEmail');

  if (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
  return sortTimetableRows(data).map(mapTimetableRow);
};

const mapNoticeRow = (row) => ({
  id: row.id,
  title: (row.title || '').trim(),
  body: (row.body || '').trim(),
  targetRole: (row.target_role || 'all').trim().toLowerCase(),
  startDate: (row.start_date || '').toString().slice(0, 10),
  endDate: row.end_date ? (row.end_date || '').toString().slice(0, 10) : '',
  isActive: row.is_active !== false,
  createdAt: row.created_at || null,
  createdBy: (row.created_by || '').trim().toLowerCase(),
});

export const getNotices = async ({ role = 'student', limit = 3 } = {}) => {
  const normalizedRole = (role || '').trim().toLowerCase() || 'student';
  const normalizedLimit = Math.max(1, Math.min(50, Number(limit) || 3));
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await query(() => supabase
    .from('notices')
    .select('id, title, body, target_role, start_date, end_date, is_active, created_at, created_by')
    .eq('is_active', true)
    .in('target_role', ['all', normalizedRole])
    .lte('start_date', today)
    .order('start_date', { ascending: false })
    .limit(normalizedLimit * 3), 'getNotices');

  if (error) {
    if (isMissingTableError(error)) {
      return [];
    }
    throw error;
  }

  return (data || [])
    .filter((row) => !row.end_date || row.end_date >= today)
    .slice(0, normalizedLimit)
    .map(mapNoticeRow);
};

export const getAdminNotices = async () => {
  const { data, error } = await query(() => supabase
    .from('notices')
    .select('id, title, body, target_role, start_date, end_date, is_active, created_at, created_by')
    .order('created_at', { ascending: false }), 'getAdminNotices');

  if (error) {
    if (isMissingTableError(error)) {
      return [];
    }
    throw error;
  }
  return (data || []).map(mapNoticeRow);
};

export const upsertNotice = async ({ id, title, body, targetRole, startDate, endDate, isActive = true, actorEmail }) => {
  const normalizedTitle = (title || '').trim();
  const normalizedTargetRole = (targetRole || 'all').trim().toLowerCase();

  if (!normalizedTitle) throw new Error('Notice title is required.');
  if (!['all', 'student', 'faculty', 'admin'].includes(normalizedTargetRole)) {
    throw new Error('Target role must be all, student, faculty, or admin.');
  }

  const payload = {
    id: id || undefined,
    title: normalizedTitle,
    body: (body || '').trim() || null,
    target_role: normalizedTargetRole,
    start_date: startDate || new Date().toISOString().slice(0, 10),
    end_date: endDate || null,
    is_active: Boolean(isActive),
    created_by: (actorEmail || '').trim().toLowerCase() || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await query(() => supabase
    .from('notices')
    .upsert([payload], { onConflict: 'id' }), 'upsertNotice');

  if (error) throw error;
};

export const deleteNotice = async (noticeId) => {
  if (!noticeId) throw new Error('Notice id is required.');

  const { error } = await query(() => supabase
    .from('notices')
    .delete()
    .eq('id', noticeId), 'deleteNotice');

  if (error) throw error;
};

