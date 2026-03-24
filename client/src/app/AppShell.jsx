import React, { useEffect, useRef, useState } from 'react';
import { Box, Drawer } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { Outlet } from 'react-router-dom';
import { useAuth } from './context/AuthContext.js';
import { Sidebar } from './components/layout/Sidebar.js';
import Navbar from './components/layout/Navbar.js';
import {
  getAdminAccessOverview,
  getClassAssignmentsByDepartment,
  getFacultyProfileByEmail,
  getStudentDashboardSummary,
  getStudentProfileByEmail,
  getUsersWithProfiles,
} from './lib/academicDataApi.js';
import { queryKeys } from './lib/queryKeys.js';
import { LIVE_STALE_TIME_MS, STATIC_STALE_TIME_MS } from './lib/queryClient.js';

const AppShell = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const prefetchedRoleRef = useRef('');

  useEffect(() => {
    if (!user?.email || !user?.role) return;

    const role = (user.role || '').trim().toLowerCase();
    const email = (user.email || '').trim().toLowerCase();
    const department = (user.department || '').trim().toUpperCase();
    const signature = `${role}:${email}:${department}`;

    if (prefetchedRoleRef.current === signature) return;
    prefetchedRoleRef.current = signature;

    const safePrefetch = async (config) => {
      try {
        await queryClient.prefetchQuery(config);
      } catch (error) {
        console.warn('Prefetch failed for query:', config.queryKey, error);
      }
    };

    if (role === 'student') {
      void Promise.all([
        safePrefetch({
          queryKey: queryKeys.student.profile(email),
          queryFn: () => getStudentProfileByEmail(email),
          staleTime: STATIC_STALE_TIME_MS,
        }),
        safePrefetch({
          queryKey: queryKeys.student.dashboard(email, department),
          queryFn: () => getStudentDashboardSummary(email, department),
          staleTime: LIVE_STALE_TIME_MS,
        }),
      ]);
      return;
    }

    if (role === 'faculty') {
      void Promise.all([
        safePrefetch({
          queryKey: queryKeys.faculty.profile(email),
          queryFn: () => getFacultyProfileByEmail(email),
          staleTime: STATIC_STALE_TIME_MS,
        }),
        safePrefetch({
          queryKey: queryKeys.faculty.assignments(department),
          queryFn: () => getClassAssignmentsByDepartment(department),
          staleTime: LIVE_STALE_TIME_MS,
        }),
      ]);
      return;
    }

    if (role === 'admin') {
      void Promise.all([
        safePrefetch({
          queryKey: queryKeys.admin.accessOverview(),
          queryFn: () => getAdminAccessOverview(),
          staleTime: LIVE_STALE_TIME_MS,
        }),
        safePrefetch({
          queryKey: queryKeys.admin.users(),
          queryFn: () => getUsersWithProfiles(),
          staleTime: LIVE_STALE_TIME_MS,
        }),
      ]);
    }
  }, [queryClient, user?.email, user?.role, user?.department]);

  const handleDesktopSidebarToggle = () => {
    setSidebarCollapsed((prev) => !prev);
  };

  const handleMobileSidebarToggle = () => {
    setMobileSidebarOpen((prev) => !prev);
  };

  const handleMobileOverlayClose = () => {
    setMobileSidebarOpen(false);
  };

  const handleSidebarItemNavigate = () => {
    setMobileSidebarOpen(false);
  };

  if (!user) return null;

  return (
    <Box sx={{ display: 'flex', height: '100vh', background: 'radial-gradient(circle at top left, rgba(186,230,253,0.22), transparent 30%), radial-gradient(circle at bottom right, rgba(221,214,254,0.22), transparent 34%), #edf2f7' }}>
      <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={handleDesktopSidebarToggle}
        />
      </Box>

      <Drawer
        variant="temporary"
        open={mobileSidebarOpen}
        onClose={handleMobileOverlayClose}
        sx={{
          display: { xs: 'block', lg: 'none' },
          '& .MuiDrawer-paper': {
            width: 256,
            backdropFilter: 'blur(18px)',
            backgroundColor: 'rgba(255,255,255,0.82)',
          },
        }}
      >
        <Sidebar
          collapsed={false}
          onItemNavigate={handleSidebarItemNavigate}
          onToggleCollapse={handleMobileOverlayClose}
        />
      </Drawer>

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Navbar onToggleSidebar={handleMobileSidebarToggle} user={user} />
        <Box component="main" sx={{ flex: 1, overflowY: 'auto', width: '100%', background: 'transparent' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};

export default AppShell;
