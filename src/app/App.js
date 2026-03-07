import React, { useEffect, useState } from 'react';
import { Box, CssBaseline, Typography } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import LoginPage from './components/LoginPage.js';
import { Sidebar } from './components/layout/Sidebar.js';
import Navbar from './components/layout/Navbar.js';
import { AdminDashboard } from './components/admin/AdminDashboard.js';
import { FacultyDashboard } from './components/faculty/FacultyDashboard.js';
import { StudentDashboard } from './components/student/StudentDashboard.js';
import StudentCoursesPage from './components/student/StudentCoursesPage.js';
import StudentAttendancePage from './components/student/StudentAttendancePage.js';
import StudentMarksPage from './components/student/StudentMarksPage.js';
import StudentProfilePage from './components/student/StudentProfilePage.js';
import { AttendancePage } from './components/faculty/AttendancePage.js';
import { MarksEntryPage } from './components/faculty/MarksEntryPage.js';
import FacultyProfilePage from './components/faculty/FacultyProfilePage.js';
import { AnalyticsPage } from './components/admin/AnalyticsPage.js';
import ManageUsersPage from './components/admin/ManageUsersPage.js';
import ManageCoursesPage from './components/admin/ManageCoursesPage.js';
import AdminSettingsPage from './components/admin/AdminSettingsPage.js';
import { prefetchRoleDataToLocalStorage } from './lib/dashboardPrefetch.js';

const appTheme = createTheme({
  palette: {
    mode: 'light',
    background: {
      default: '#e9edf5',
      paper: 'rgba(255,255,255,0.72)',
    },
    text: {
      primary: '#0f172a',
      secondary: '#64748b',
    },
    primary: {
      main: '#2563eb',
    },
  },
  shape: {
    borderRadius: 16,
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif',
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: 'radial-gradient(circle at 10% 10%, rgba(186,230,253,0.28), transparent 30%), radial-gradient(circle at 90% 90%, rgba(221,214,254,0.22), transparent 34%), #e9edf5',
          minHeight: '100vh',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: '1px solid rgba(148,163,184,0.20)',
          boxShadow: '0 16px 34px rgba(15,23,42,0.10)',
          backdropFilter: 'blur(18px)',
          backgroundColor: 'rgba(255,255,255,0.72)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid rgba(148,163,184,0.16)',
          backdropFilter: 'blur(16px)',
          backgroundColor: 'rgba(255,255,255,0.70)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255,255,255,0.66)',
          color: '#111827',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(148,163,184,0.24)',
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          border: '1px solid rgba(148,163,184,0.22)',
          backgroundColor: 'rgba(255,255,255,0.62)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 12,
          fontWeight: 600,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
        },
      },
    },
  },
});

const AppContent = () => {
  const { user, authLoading, maintenanceMode, maintenanceMessage } = useAuth();
  const isStudent = user?.role === 'student';
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (!user?.role) return;

    const routeByRole = {
      admin: '/admin-dashboard',
      faculty: '/faculty-dashboard',
      student: '/student-dashboard',
    };

    const nextPath = routeByRole[user.role] || '/';
    const currentPath = window.location.pathname;
    const shouldKeepRootPath = currentPath === '/' || currentPath === '/login';

    if (!shouldKeepRootPath && currentPath !== nextPath) {
      window.history.replaceState({}, '', nextPath);
    }
    setCurrentPage('dashboard');
  }, [user?.role]);

  useEffect(() => {
    if (!user?.email || !user?.role) return;

    void prefetchRoleDataToLocalStorage(user);
  }, [user?.email, user?.role, user?.department]);

  const handleDesktopSidebarToggle = () => {
    setSidebarCollapsed((prev) => !prev);
  };

  const handleMobileSidebarToggle = () => {
    setMobileSidebarOpen((prev) => !prev);
  };

  const handleMobileOverlayClose = () => {
    setMobileSidebarOpen(false);
  };

  const handleMobileNavigate = (page) => {
    setCurrentPage(page);
    setMobileSidebarOpen(false);
  };

  const renderPageContent = () => {
    if (!user) {
      return null;
    }

    if (user.role === 'admin') {
      switch (currentPage) {
        case 'dashboard':
          return <AdminDashboard />;
        case 'manage-users':
          return <ManageUsersPage />;
        case 'manage-courses':
          return <ManageCoursesPage />;
        case 'reports':
          return <AnalyticsPage />;
        case 'settings':
          return <AdminSettingsPage />;
        default:
          return <AdminDashboard />;
      }
    } else if (user.role === 'faculty') {
      switch (currentPage) {
        case 'dashboard':
          return <FacultyDashboard />;
        case 'attendance':
          return <AttendancePage />;
        case 'marks':
          return <MarksEntryPage />;
        case 'profile':
          return <FacultyProfilePage />;
        default:
          return <FacultyDashboard />;
      }
    } else {
      switch (currentPage) {
        case 'dashboard':
          return <StudentDashboard />;
        case 'courses':
          return <StudentCoursesPage />;
        case 'attendance':
          return <StudentAttendancePage />;
        case 'marks':
          return <StudentMarksPage />;
        case 'profile':
          return <StudentProfilePage />;
        default:
          return <StudentDashboard />;
      }
    }
  };

  if (authLoading) return null;
  if (!user) return <LoginPage />;

  if (maintenanceMode && user.role !== 'admin') {
    return (
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
            {maintenanceMessage || 'System is under maintenance. Please try again later.'}
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', height: '100vh', background: 'radial-gradient(circle at top left, rgba(186,230,253,0.22), transparent 30%), radial-gradient(circle at bottom right, rgba(221,214,254,0.22), transparent 34%), #edf2f7' }}>
      <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
        <Sidebar
          currentPage={currentPage}
          onNavigate={setCurrentPage}
          collapsed={sidebarCollapsed}
          onToggleCollapse={handleDesktopSidebarToggle}
        />
      </Box>

      {mobileSidebarOpen && (
        <Box
          onClick={handleMobileOverlayClose}
          sx={{
            display: { xs: 'block', lg: 'none' },
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 1200,
          }}
        >
          <Box
            onClick={(e) => e.stopPropagation()}
            sx={{
              backgroundColor: 'rgba(255,255,255,0.82)',
              backdropFilter: 'blur(18px)',
              borderRight: '1px solid rgba(148,163,184,0.20)',
              height: '100%',
              width: 256,
            }}
          >
            <Sidebar
              currentPage={currentPage}
              onNavigate={handleMobileNavigate}
              collapsed={false}
              onToggleCollapse={handleMobileOverlayClose}
            />
          </Box>
        </Box>
      )}

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Navbar onToggleSidebar={handleMobileSidebarToggle} user={user} />
        <Box component="main" sx={{ flex: 1, overflowY: 'auto', width: '100%', background: 'transparent' }}>
          {renderPageContent()}
        </Box>
      </Box>
    </Box>
  );
};

const App = () => (
  <ThemeProvider theme={appTheme}>
    <CssBaseline />
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  </ThemeProvider>
);

export default App;