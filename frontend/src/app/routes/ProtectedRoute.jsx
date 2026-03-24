import React from 'react';
import { Box, Card, CardContent, CircularProgress, Skeleton, Typography } from '@mui/material';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import LoginPage from '../components/LoginPage.js';
import { useAuth } from '../context/AuthContext.js';
import { getRoleDefaultPath } from '../lib/routing.js';

const AuthLoadingScreen = () => (
  <Box
    sx={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(180deg, #f5f5f7 0%, #e9ecf3 100%)',
      p: 3,
    }}
  >
    <Card sx={{ width: '100%', maxWidth: 560, borderRadius: '24px', background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(20px)' }}>
      <CardContent sx={{ p: { xs: 3, md: 4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
          <CircularProgress size={30} />
        </Box>
        <Typography sx={{ textAlign: 'center', fontWeight: 700, color: '#1d1d1f', mb: 2 }}>
          Restoring your session...
        </Typography>
        <Skeleton variant="rounded" height={20} sx={{ mb: 1 }} />
        <Skeleton variant="rounded" height={20} sx={{ mb: 1 }} />
        <Skeleton variant="rounded" height={20} width="70%" />
      </CardContent>
    </Card>
  </Box>
);

const MaintenanceScreen = ({ message }) => (
  <Box
    sx={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(180deg, #f5f5f7 0%, #e9ecf3 100%)',
      p: 3,
    }}
  >
    <Box
      sx={{
        width: '100%',
        maxWidth: 560,
        borderRadius: '24px',
        background: 'rgba(255,255,255,0.78)',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 30px 60px rgba(0,0,0,0.08)',
        p: { xs: 3, md: 4 },
        textAlign: 'center',
      }}
    >
      <Typography sx={{ fontSize: { xs: '1.5rem', md: '1.75rem' }, fontWeight: 700, color: '#1d1d1f' }}>
        Under Maintenance
      </Typography>
      <Typography sx={{ mt: 1, color: '#6e6e73' }}>
        {message || 'System is under maintenance. Please try again later.'}
      </Typography>
    </Box>
  </Box>
);

export const ProtectedRoute = () => {
  const { user, authLoading, maintenanceMode, maintenanceMessage } = useAuth();
  const location = useLocation();

  if (authLoading) return <AuthLoadingScreen />;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (maintenanceMode && user.role !== 'admin') {
    return <MaintenanceScreen message={maintenanceMessage} />;
  }

  return <Outlet />;
};

export const RoleGuard = ({ role }) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== role) {
    return <Navigate to={getRoleDefaultPath(user.role)} replace />;
  }

  return <Outlet />;
};

export const LoginRoute = () => {
  const { user, authLoading } = useAuth();

  if (authLoading) return <AuthLoadingScreen />;

  if (user) {
    return <Navigate to={getRoleDefaultPath(user.role)} replace />;
  }

  return <LoginPage />;
};

export const RoleHomeRedirect = () => {
  const { user } = useAuth();

  return <Navigate to={getRoleDefaultPath(user?.role)} replace />;
};
