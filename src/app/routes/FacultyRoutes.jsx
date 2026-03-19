import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RoleGuard } from './ProtectedRoute.jsx';
import { RouteErrorBoundary } from '../components/GlobalErrorBoundary.jsx';
import PageSkeleton from '../components/ui/PageSkeleton.jsx';

const AppShell = React.lazy(() => import('../AppShell.jsx'));
const FacultyDashboard = React.lazy(() => import('../components/faculty/FacultyDashboard.js'));
const FacultyTimetablePage = React.lazy(() => import('../components/faculty/FacultyTimetablePage.js'));
const AttendancePage = React.lazy(() => import('../components/faculty/AttendancePage.js'));
const MarksEntryPage = React.lazy(() => import('../components/faculty/MarksEntryPage.js'));
const FacultyProfilePage = React.lazy(() => import('../components/faculty/FacultyProfilePage.js'));

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
