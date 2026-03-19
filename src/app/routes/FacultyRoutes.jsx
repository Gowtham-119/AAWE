import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RoleGuard } from './ProtectedRoute.jsx';
import { RouteErrorBoundary } from '../components/GlobalErrorBoundary.jsx';
import PageSkeleton from '../components/ui/PageSkeleton.jsx';
import { lazyWithRetry } from '../lib/lazyWithRetry.js';

const AppShell = lazyWithRetry(() => import('../AppShell.jsx'), 'faculty-app-shell');
const FacultyDashboard = lazyWithRetry(() => import('../components/faculty/FacultyDashboard.js'), 'faculty-dashboard');
const FacultyTimetablePage = lazyWithRetry(() => import('../components/faculty/FacultyTimetablePage.js'), 'faculty-timetable');
const AttendancePage = lazyWithRetry(() => import('../components/faculty/AttendancePage.js'), 'faculty-attendance');
const MarksEntryPage = lazyWithRetry(() => import('../components/faculty/MarksEntryPage.js'), 'faculty-marks');
const FacultyProfilePage = lazyWithRetry(() => import('../components/faculty/FacultyProfilePage.js'), 'faculty-profile');

const FacultyRoutes = () => (
  <React.Suspense fallback={<PageSkeleton />}>
    <Routes>
      <Route element={<RoleGuard role="faculty" />}>
        <Route element={<RouteErrorBoundary scope="faculty-routes"><AppShell /></RouteErrorBoundary>}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<FacultyDashboard />} />
          <Route path="timetable" element={<FacultyTimetablePage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="marks" element={<MarksEntryPage />} />
          <Route path="profile" element={<FacultyProfilePage />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>
      </Route>
    </Routes>
  </React.Suspense>
);

export default FacultyRoutes;
