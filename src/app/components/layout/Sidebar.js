import React from 'react';
import { LayoutDashboard, Users, BookOpen, Building2, FileText, Settings, ChevronLeft, GraduationCap, CalendarCheck, BarChart3, UserCircle, LogOut, Bell, Clock3 } from 'lucide-react';
import { Box, Button, IconButton, Typography } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { getSidebarMenuItems } from '../../lib/routing.js';

export const Sidebar = ({ collapsed, onToggleCollapse, onItemNavigate }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isStudent = user?.role === 'student';

  const iconMap = {
    dashboard: LayoutDashboard,
    users: Users,
    courses: BookOpen,
    departments: Building2,
    reports: BarChart3,
    settings: Settings,
    notices: Bell,
    timetable: Clock3,
    attendance: CalendarCheck,
    marks: BarChart3,
    profile: UserCircle,
  };

  const menuItems = getSidebarMenuItems(user?.role).map((item) => ({
    ...item,
    icon: iconMap[item.id] || FileText,
  }));

  const isPathActive = (path) => location.pathname === path;

  const handleNavigate = (path) => {
    navigate(path);
    if (onItemNavigate) {
      onItemNavigate();
    }
  };

  return (
    <Box
      sx={{
        backgroundColor: 'rgba(255,255,255,0.62)',
        backdropFilter: 'blur(18px)',
        borderRight: '1px solid rgba(148,163,184,0.26)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 300ms',
        width: collapsed ? 64 : 256,
      }}
    >
      <Box sx={{ p: 2, borderBottom: '1px solid rgba(148,163,184,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: isStudent ? 82 : 'auto' }}>
        {!collapsed && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ backgroundColor: '#2563eb', p: isStudent ? 1.2 : 1, borderRadius: isStudent ? '999px' : 1.5, boxShadow: '0 12px 24px rgba(37,99,235,0.28)' }}><GraduationCap size={isStudent ? 18 : 20} color="#fff" /></Box>
            <Typography sx={{ fontWeight: 700, color: '#111827' }}>AAWE</Typography>
          </Box>
        )}
        {collapsed && <Box sx={{ backgroundColor: '#2563eb', p: 1, borderRadius: isStudent ? '999px' : 1.5, mx: 'auto', boxShadow: '0 12px 24px rgba(37,99,235,0.28)' }}><GraduationCap size={isStudent ? 18 : 20} color="#fff" /></Box>}
        {!collapsed && (
          <IconButton onClick={onToggleCollapse} size="small" sx={{ '&:hover': { backgroundColor: 'rgba(226,232,240,0.72)' } }}>
            <ChevronLeft size={16} color="#4b5563" />
          </IconButton>
        )}
      </Box>

      <Box component="nav" sx={{ flex: 1, p: 1.5, display: 'flex', flexDirection: 'column', gap: isStudent ? 1 : 0.75 }}>
        {menuItems.map(item => {
          const Icon = item.icon;
          const isActive = isPathActive(item.path);
          return (
            <Button
              key={item.id}
              onClick={() => handleNavigate(item.path)}
              title={collapsed ? item.label : undefined}
              sx={{
                width: '100%',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: isStudent ? 1.75 : 1.5,
                px: isStudent ? 1.75 : 1.5,
                py: isStudent ? 1.4 : 1.25,
                borderRadius: isStudent ? 1.75 : 1.5,
                color: isActive ? '#fff' : '#334155',
                background: isActive ? 'linear-gradient(135deg, #4f83ff 0%, #2563eb 100%)' : 'transparent',
                boxShadow: isActive ? '0 10px 20px rgba(37,99,235,0.26)' : 'none',
                textTransform: 'none',
                '&:hover': {
                  backgroundColor: isActive ? '#1d4ed8' : 'rgba(226,232,240,0.75)',
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
        <Box sx={{ p: 1.5, borderTop: '1px solid rgba(148,163,184,0.22)' }}>
          <IconButton onClick={onToggleCollapse} sx={{ width: '100%', borderRadius: 1.5, '&:hover': { backgroundColor: 'rgba(226,232,240,0.75)' } }}>
            <ChevronLeft size={20} color="#4b5563" style={{ transform: 'rotate(180deg)' }} />
          </IconButton>
        </Box>
      )}

      <Box sx={{ p: 1.5, borderTop: '1px solid rgba(148,163,184,0.22)' }}>
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
            '&:hover': { color: '#b91c1c', backgroundColor: 'rgba(254,226,226,0.7)' },
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
