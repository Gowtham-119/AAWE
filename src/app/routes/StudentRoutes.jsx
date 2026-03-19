import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RoleGuard } from './ProtectedRoute.jsx';
import { RouteErrorBoundary } from '../components/GlobalErrorBoundary.jsx';
import PageSkeleton from '../components/ui/PageSkeleton.jsx';

const AppShell = React.lazy(() => import('../AppShell.jsx'));
const StudentDashboard = React.lazy(() => import('../components/student/StudentDashboard.js'));
const StudentTimetablePage = React.lazy(() => import('../components/student/StudentTimetablePage.js'));
const StudentCoursesPage = React.lazy(() => import('../components/student/StudentCoursesPage.js'));
const StudentAttendancePage = React.lazy(() => import('../components/student/StudentAttendancePage.js'));
const StudentMarksPage = React.lazy(() => import('../components/student/StudentMarksPage.js'));
const StudentProfilePage = React.lazy(() => import('../components/student/StudentProfilePage.js'));

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
