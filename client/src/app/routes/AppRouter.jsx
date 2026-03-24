import React from 'react';
import { Navigate, Route, Routes, createBrowserRouter } from 'react-router-dom';
import AdminRoutes from './AdminRoutes.jsx';
import FacultyRoutes from './FacultyRoutes.jsx';
import StudentRoutes from './StudentRoutes.jsx';
import { LoginRoute, ProtectedRoute, RoleHomeRedirect } from './ProtectedRoute.jsx';
import GlobalErrorBoundary from '../components/GlobalErrorBoundary.jsx';
import PageSkeleton from '../components/ui/PageSkeleton.jsx';

const AppContent = () => (
  <GlobalErrorBoundary scope="app-content">
    <React.Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<RoleHomeRedirect />} />
          <Route path="/admin/*" element={<AdminRoutes />} />
          <Route path="/faculty/*" element={<FacultyRoutes />} />
          <Route path="/student/*" element={<StudentRoutes />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </React.Suspense>
  </GlobalErrorBoundary>
);

export const appRouter = createBrowserRouter([
  {
    path: '*',
    element: <AppContent />,
  },
]);
