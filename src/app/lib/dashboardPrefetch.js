import {
  getAdminAccessOverview,
  getAdminDashboardData,
  getAnalyticsData,
  getAttendanceByStudentEmail,
  getClassAssignmentsByDepartment,
  getClassAssignmentsByStudentEmail,
  getDepartmentCourses,
  getDepartmentCoursesAdmin,
  getDepartmentStaff,
  getFacultyProfileByEmail,
  getMarksByStudentEmail,
  getStudentDashboardSummary,
  getStudentProfileByEmail,
  getStudents,
  getSystemSettings,
  getUsersWithProfiles,
} from './academicDataApi';

const STORAGE_PREFIX = 'aawe.prefetch';

const normalizeEmail = (email) => (email || '').trim().toLowerCase();

const buildStorageKey = ({ role, email, resource }) => {
  const safeRole = (role || 'unknown').toLowerCase();
  const safeEmail = normalizeEmail(email) || 'anonymous';
  return `${STORAGE_PREFIX}.${safeRole}.${safeEmail}.${resource}`;
};

const writeCachedResource = ({ role, email, resource, data }) => {
  if (typeof window === 'undefined') return;

  const payload = {
    updatedAt: new Date().toISOString(),
    role: (role || '').toLowerCase(),
    email: normalizeEmail(email),
    resource,
    data,
  };

  window.localStorage.setItem(buildStorageKey({ role, email, resource }), JSON.stringify(payload));
};

const runAndCacheResources = async ({ role, email, resources }) => {
  const settled = await Promise.allSettled(
    resources.map(async (resourceConfig) => {
      const data = await resourceConfig.fetcher();
      writeCachedResource({
        role,
        email,
        resource: resourceConfig.resource,
        data,
      });
      return resourceConfig.resource;
    })
  );

  const failed = settled.filter((result) => result.status === 'rejected');
  if (failed.length) {
    console.warn(`Prefetch completed with ${failed.length} failure(s) for role ${role}.`);
  }
};

const prefetchStudentData = async ({ email, department }) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;

  const normalizedDepartment = (department || '').trim().toUpperCase();

  await runAndCacheResources({
    role: 'student',
    email: normalizedEmail,
    resources: [
      {
        resource: 'profile',
        fetcher: () => getStudentProfileByEmail(normalizedEmail),
      },
      {
        resource: 'dashboard-summary',
        fetcher: () => getStudentDashboardSummary(normalizedEmail, normalizedDepartment),
      },
      {
        resource: 'assignments',
        fetcher: () => getClassAssignmentsByStudentEmail(normalizedEmail, normalizedDepartment),
      },
      {
        resource: 'attendance',
        fetcher: () => getAttendanceByStudentEmail(normalizedEmail),
      },
      {
        resource: 'marks',
        fetcher: () => getMarksByStudentEmail(normalizedEmail),
      },
    ],
  });
};

const prefetchFacultyData = async ({ email, department }) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;

  let resolvedDepartment = (department || '').trim().toUpperCase();
  try {
    const profile = await getFacultyProfileByEmail(normalizedEmail);
    if (profile?.department) {
      resolvedDepartment = (profile.department || '').trim().toUpperCase();
    }

    writeCachedResource({
      role: 'faculty',
      email: normalizedEmail,
      resource: 'profile',
      data: profile || null,
    });
  } catch (error) {
    console.warn('Faculty prefetch: profile fetch failed.', error);
  }

  if (!resolvedDepartment) return;

  await runAndCacheResources({
    role: 'faculty',
    email: normalizedEmail,
    resources: [
      {
        resource: 'department-courses',
        fetcher: () => getDepartmentCourses(resolvedDepartment),
      },
      {
        resource: 'department-staff',
        fetcher: () => getDepartmentStaff(resolvedDepartment),
      },
      {
        resource: 'department-assignments',
        fetcher: () => getClassAssignmentsByDepartment(resolvedDepartment),
      },
      {
        resource: 'students',
        fetcher: () => getStudents(),
      },
    ],
  });
};

const prefetchAdminData = async ({ email }) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;

  await runAndCacheResources({
    role: 'admin',
    email: normalizedEmail,
    resources: [
      {
        resource: 'dashboard',
        fetcher: () => getAdminDashboardData(),
      },
      {
        resource: 'analytics',
        fetcher: () => getAnalyticsData(),
      },
      {
        resource: 'users-with-profiles',
        fetcher: () => getUsersWithProfiles(),
      },
      {
        resource: 'access-overview',
        fetcher: () => getAdminAccessOverview(),
      },
      {
        resource: 'department-courses-admin',
        fetcher: () => getDepartmentCoursesAdmin(),
      },
      {
        resource: 'system-settings',
        fetcher: () => getSystemSettings(),
      },
      {
        resource: 'students',
        fetcher: () => getStudents(),
      },
    ],
  });
};

export const prefetchRoleDataToLocalStorage = async (user) => {
  const role = (user?.role || '').trim().toLowerCase();
  const email = normalizeEmail(user?.email);

  if (!role || !email) return;

  if (role === 'student') {
    await prefetchStudentData({ email, department: user?.department || '' });
    return;
  }

  if (role === 'faculty') {
    await prefetchFacultyData({ email, department: user?.department || '' });
    return;
  }

  if (role === 'admin') {
    await prefetchAdminData({ email });
  }
};
