import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RoleGuard } from './ProtectedRoute.jsx';
import { RouteErrorBoundary } from '../components/GlobalErrorBoundary.jsx';
import PageSkeleton from '../components/ui/PageSkeleton.jsx';

const AppShell = React.lazy(() => import('../AppShell.jsx'));
const AdminDashboard = React.lazy(() => import('../components/admin/AdminDashboard.js').then((module) => ({ default: module.AdminDashboard })));
const AnalyticsPage = React.lazy(() => import('../components/admin/AnalyticsPage.js').then((module) => ({ default: module.AnalyticsPage })));
const ManageUsersPage = React.lazy(() => import('../components/admin/ManageUsersPage.js'));
const ManageCoursesPage = React.lazy(() => import('../components/admin/ManageCoursesPage.js'));
const ManageDepartmentsPage = React.lazy(() => import('../components/admin/ManageDepartmentsPage.js'));
const ManageNoticesPage = React.lazy(() => import('../components/admin/ManageNoticesPage.js'));
const AdminSettingsPage = React.lazy(() => import('../components/admin/AdminSettingsPage.js'));

const AdminRoutes = () => (
  <React.Suspense fallback={<PageSkeleton />}>
    <Routes>
      <Route element={<RoleGuard role="admin" />}>
        <Route element={<RouteErrorBoundary scope="admin-routes"><AppShell /></RouteErrorBoundary>}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="users" element={<ManageUsersPage />} />
          <Route path="courses" element={<ManageCoursesPage />} />
          <Route path="departments" element={<ManageDepartmentsPage />} />
          <Route path="notices" element={<ManageNoticesPage />} />
          <Route path="reports" element={<AnalyticsPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>
      </Route>
    </Routes>
  </React.Suspense>
);

export default AdminRoutes;
