import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RoleGuard } from './ProtectedRoute.jsx';
import { RouteErrorBoundary } from '../components/GlobalErrorBoundary.jsx';
import PageSkeleton from '../components/ui/PageSkeleton.jsx';
import { lazyWithRetry } from '../lib/lazyWithRetry.js';

const AppShell = lazyWithRetry(() => import('../AppShell.jsx'), 'student-app-shell');
const StudentDashboard = lazyWithRetry(() => import('../components/student/StudentDashboard.js'), 'student-dashboard');
const StudentTimetablePage = lazyWithRetry(() => import('../components/student/StudentTimetablePage.js'), 'student-timetable');
const StudentCoursesPage = lazyWithRetry(() => import('../components/student/StudentCoursesPage.js'), 'student-courses');
const StudentAttendancePage = lazyWithRetry(() => import('../components/student/StudentAttendancePage.js'), 'student-attendance');
const StudentMarksPage = lazyWithRetry(() => import('../components/student/StudentMarksPage.js'), 'student-marks');
const StudentProfilePage = lazyWithRetry(() => import('../components/student/StudentProfilePage.js'), 'student-profile');

const StudentRoutes = () => (
  <React.Suspense fallback={<PageSkeleton />}>
    <Routes>
      <Route element={<RoleGuard role="student" />}>
        <Route element={<RouteErrorBoundary scope="student-routes"><AppShell /></RouteErrorBoundary>}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<StudentDashboard />} />
          <Route path="timetable" element={<StudentTimetablePage />} />
          <Route path="courses" element={<StudentCoursesPage />} />
          <Route path="attendance" element={<StudentAttendancePage />} />
          <Route path="marks" element={<StudentMarksPage />} />
          <Route path="profile" element={<StudentProfilePage />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>
      </Route>
    </Routes>
  </React.Suspense>
);

export default StudentRoutes;
