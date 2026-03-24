import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RoleGuard } from './ProtectedRoute.jsx';
import { RouteErrorBoundary } from '../components/GlobalErrorBoundary.jsx';
import PageSkeleton from '../components/ui/PageSkeleton.jsx';
import { lazyWithRetry } from '../lib/lazyWithRetry.js';

const AppShell = lazyWithRetry(() => import('../AppShell.jsx'), 'admin-app-shell');
const AdminDashboard = lazyWithRetry(() => import('../components/admin/AdminDashboard.js'), 'admin-dashboard');
const AnalyticsPage = lazyWithRetry(() => import('../components/admin/AnalyticsPage.js'), 'admin-analytics');
const ManageUsersPage = lazyWithRetry(() => import('../components/admin/ManageUsersPage.js'), 'admin-users');
const ManageCoursesPage = lazyWithRetry(() => import('../components/admin/ManageCoursesPage.js'), 'admin-courses');
const ManageDepartmentsPage = lazyWithRetry(() => import('../components/admin/ManageDepartmentsPage.js'), 'admin-departments');
const ManageNoticesPage = lazyWithRetry(() => import('../components/admin/ManageNoticesPage.js'), 'admin-notices');
const AdminSettingsPage = lazyWithRetry(() => import('../components/admin/AdminSettingsPage.js'), 'admin-settings');

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
