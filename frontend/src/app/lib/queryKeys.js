export const queryKeys = {
  student: {
    profile: (email) => ['student-profile', email],
    attendance: (email) => ['attendance', email],
    marks: (email) => ['marks', email],
    timetable: (email, department) => ['student-timetable', email, department || ''],
    dashboard: (email, department) => ['student-dashboard', email, department || ''],
    coursesSnapshot: (email) => ['student-courses-snapshot', email],
  },
  faculty: {
    profile: (email) => ['faculty-profile', email],
    timetable: (email) => ['faculty-timetable', email],
    students: (department, page, pageSize) => ['faculty-students', department || '', page, pageSize],
    courses: (department) => ['faculty-courses', department || ''],
    staff: (department) => ['faculty-staff', department || ''],
    assignments: (department) => ['faculty-assignments', department || ''],
    attendanceByCourseDate: (courseCode, selectedDate) => ['attendance-course-date', courseCode || '', selectedDate || ''],
    marksByCourse: (courseCode) => ['marks-course', courseCode || ''],
  },
  admin: {
    users: () => ['admin-users'],
    notices: () => ['admin-notices'],
    departments: () => ['admin-departments'],
    analytics: () => ['admin-analytics'],
    dashboard: () => ['admin-dashboard'],
    accessOverview: () => ['admin-access-overview'],
    courses: () => ['admin-courses'],
    settings: () => ['admin-settings'],
  },
  common: {
    notifications: (email) => ['notifications', email],
    notices: (role, limit = 3) => ['notices', role || 'student', limit],
  },
};
