import React from 'react';
import { LayoutDashboard, Users, BookOpen, ClipboardCheck, FileText, Settings, ChevronLeft, GraduationCap, CalendarCheck, BarChart3, UserCircle, LogOut } from 'lucide-react';
import { Box, Button, IconButton, Typography } from '@mui/material';
import { useAuth } from '../../context/AuthContext.js';

export const Sidebar = ({ currentPage, onNavigate, collapsed, onToggleCollapse }) => {
  const { user, logout } = useAuth();
  const isStudent = user?.role === 'student';
  const isAdmin = user?.role === 'admin';

  const getMenuItems = () => {
    if (user?.role === 'admin') {
      return [
        { id: 'dashboard', label: 'Dashboard Overview', icon: LayoutDashboard },
        { id: 'manage-users', label: 'Manage Users', icon: Users },
        { id: 'manage-courses', label: 'Manage Courses', icon: BookOpen },
        { id: 'reports', label: 'Reports', icon: BarChart3 },
        { id: 'settings', label: 'Settings', icon: Settings },
      ];
    }
    if (user?.role === 'faculty') {
      return [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'attendance', label: 'Attendance Entry', icon: CalendarCheck },
        { id: 'marks', label: 'Marks Entry', icon: BarChart3 },
        { id: 'profile', label: 'Profile', icon: UserCircle },
      ];
    }
    return [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'courses', label: 'My Courses', icon: BookOpen },
      { id: 'attendance', label: 'My Attendance', icon: CalendarCheck },
      { id: 'marks', label: 'My Marks', icon: BarChart3 },
      { id: 'profile', label: 'Profile', icon: UserCircle },
    ];
  };
  
  const menuItems = getMenuItems();

  return (
    <Box
      sx={{
        backgroundColor: isStudent || isAdmin ? '#f3f4f6' : '#fff',
        borderRight: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 300ms',
        width: collapsed ? 64 : 256,
      }}
    >
      <Box sx={{ p: 2, borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: isStudent ? 82 : 'auto' }}>
        {!collapsed && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ backgroundColor: isStudent ? '#2f63de' : '#2563eb', p: isStudent ? 1.2 : 1, borderRadius: isStudent ? '999px' : 1.5 }}><GraduationCap size={isStudent ? 18 : 20} color="#fff" /></Box>
            <Typography sx={{ fontWeight: 700, color: '#111827' }}>AAWE</Typography>
          </Box>
        )}
        {collapsed && <Box sx={{ backgroundColor: isStudent ? '#2f63de' : '#2563eb', p: 1, borderRadius: isStudent ? '999px' : 1.5, mx: 'auto' }}><GraduationCap size={isStudent ? 18 : 20} color="#fff" /></Box>}
        {!collapsed && (
          <IconButton onClick={onToggleCollapse} size="small" sx={{ '&:hover': { backgroundColor: '#f3f4f6' } }}>
            <ChevronLeft size={16} color="#4b5563" />
          </IconButton>
        )}
      </Box>

      <Box component="nav" sx={{ flex: 1, p: 1.5, display: 'flex', flexDirection: 'column', gap: isStudent ? 1 : 0.75 }}>
        {menuItems.map(item => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <Button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              title={collapsed ? item.label : undefined}
              sx={{
                width: '100%',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: isStudent ? 1.75 : 1.5,
                px: isStudent ? 1.75 : 1.5,
                py: isStudent ? 1.4 : 1.25,
                borderRadius: isStudent ? 1.75 : 1.5,
                color: isActive ? '#fff' : (isStudent || isAdmin ? '#111827' : '#374151'),
                backgroundColor: isActive ? (isStudent || isAdmin ? '#2f63de' : '#2563eb') : 'transparent',
                boxShadow: isAdmin ? (isActive ? '0 8px 18px rgba(47, 99, 222, 0.28)' : 'none') : (isStudent ? 'none' : (isActive ? 1 : 'none')),
                textTransform: 'none',
                '&:hover': {
                  backgroundColor: isActive ? (isStudent || isAdmin ? '#2b59cb' : '#1d4ed8') : (isStudent || isAdmin ? '#e5e7eb' : '#f3f4f6'),
                },
              }}
            >
              <Icon size={isStudent ? 21 : 20} />
              {!collapsed && <Typography sx={{ fontSize: isStudent ? '1rem' : '0.875rem', fontWeight: 500, lineHeight: 1 }}>{item.label}</Typography>}
            </Button>
          );
        })}
      </Box>

      {collapsed && (
        <Box sx={{ p: 1.5, borderTop: '1px solid #e5e7eb' }}>
          <IconButton onClick={onToggleCollapse} sx={{ width: '100%', borderRadius: 1.5, '&:hover': { backgroundColor: '#f3f4f6' } }}>
            <ChevronLeft size={20} color="#4b5563" style={{ transform: 'rotate(180deg)' }} />
          </IconButton>
        </Box>
      )}

      <Box sx={{ p: 1.5, borderTop: '1px solid #e5e7eb' }}>
        <Button
          onClick={logout}
          sx={{
            width: '100%',
            justifyContent: collapsed ? 'center' : 'flex-start',
            color: '#dc2626',
            px: collapsed ? 0 : 1.5,
            py: 1,
            gap: 1.5,
            textTransform: 'none',
            '&:hover': { color: '#b91c1c', backgroundColor: '#fef2f2' },
          }}
        >
          <LogOut size={20} />
          {!collapsed && <Typography sx={{ ml: 0.5 }}>Logout</Typography>}
        </Button>
      </Box>
    </Box>
  );
};

export default Sidebar;
