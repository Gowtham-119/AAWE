export const getRoleDefaultPath = (role) => {
  switch (role) {
    case 'admin':
      return '/admin/dashboard';
    case 'faculty':
      return '/faculty/dashboard';
    case 'student':
      return '/student/dashboard';
    default:
      return '/login';
  }
};

export const getSidebarMenuItems = (role) => {
  if (role === 'admin') {
    return [
      { id: 'dashboard', label: 'Dashboard Overview', path: '/admin/dashboard' },
      { id: 'users', label: 'Manage Users', path: '/admin/users' },
      { id: 'courses', label: 'Manage Courses', path: '/admin/courses' },
      { id: 'departments', label: 'Departments', path: '/admin/departments' },
      { id: 'notices', label: 'Manage Notices', path: '/admin/notices' },
      { id: 'reports', label: 'Reports', path: '/admin/reports' },
      { id: 'settings', label: 'Settings', path: '/admin/settings' },
    ];
  }

  if (role === 'faculty') {
    return [
      { id: 'dashboard', label: 'Dashboard', path: '/faculty/dashboard' },
      { id: 'timetable', label: 'My Timetable', path: '/faculty/timetable' },
      { id: 'attendance', label: 'Attendance Entry', path: '/faculty/attendance' },
      { id: 'marks', label: 'Marks Entry', path: '/faculty/marks' },
      { id: 'profile', label: 'Profile', path: '/faculty/profile' },
    ];
  }

  return [
    { id: 'dashboard', label: 'Dashboard', path: '/student/dashboard' },
    { id: 'timetable', label: 'My Timetable', path: '/student/timetable' },
    { id: 'courses', label: 'My Courses', path: '/student/courses' },
    { id: 'attendance', label: 'My Attendance', path: '/student/attendance' },
    { id: 'marks', label: 'My Marks', path: '/student/marks' },
    { id: 'profile', label: 'Profile', path: '/student/profile' },
  ];
};
