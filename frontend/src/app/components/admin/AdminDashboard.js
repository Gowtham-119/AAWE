import React, { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Card, CardContent, CardHeader, Chip, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { BookOpen, Clock, Lock, ShieldCheck, Users } from 'lucide-react';
import { getAdminAccessOverview } from '../../lib/academicDataApi';
import { LIVE_STALE_TIME_MS } from '../../lib/queryClient';
import { queryKeys } from '../../lib/queryKeys';
import { supabase } from '../../lib/supabaseClient.js';
import EmptyState from '../ui/EmptyState.jsx';
import NoticesPanel from '../ui/NoticesPanel.jsx';

export const AdminDashboard = () => {
  const queryClient = useQueryClient();
  const { data: overview, isLoading } = useQuery({
    queryKey: queryKeys.admin.accessOverview(),
    queryFn: getAdminAccessOverview,
    staleTime: LIVE_STALE_TIME_MS,
  });

  useEffect(() => {
    const usersChannel = supabase
      .channel('admin-users-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.admin.accessOverview() });
        }
      )
      .subscribe();

    const coursesChannel = supabase
      .channel('admin-courses-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'department_courses',
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.admin.accessOverview() });
        }
      )
      .subscribe();

    const staffChannel = supabase
      .channel('admin-staff-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'department_staff',
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.admin.accessOverview() });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(usersChannel);
      void supabase.removeChannel(coursesChannel);
      void supabase.removeChannel(staffChannel);
    };
  }, [queryClient]);

  const stats = useMemo(() => {
    const summary = overview?.stats || {};
    return [
      { title: 'Total Users', value: String(summary.totalUsers || 0), description: 'Integrated login accounts', color: '#007AFF', icon: Users },
      { title: 'Active Access', value: String(summary.activeUsers || 0), description: 'Users currently enabled', color: '#34C759', icon: ShieldCheck },
      { title: 'Disabled Access', value: String(summary.disabledUsers || 0), description: 'Users blocked by admin', color: '#FF3B30', icon: Lock },
      { title: 'Total Courses', value: String(summary.totalCourses || 0), description: 'Department course records', color: '#AF52DE', icon: BookOpen },
      { title: 'Faculty Records', value: String(summary.facultyCount || 0), description: 'Faculty user accounts', color: '#FF9500', icon: Users },
      { title: 'Student Records', value: String(summary.studentCount || 0), description: 'Student user accounts', color: '#5AC8FA', icon: Users },
    ];
  }, [overview]);

  const recentLogins = useMemo(
    () => (overview?.recentLogins || []).map((row) => ({
      ...row,
      formattedLastLogin: (row.lastLoginAt || '').replace('T', ' ').slice(0, 16),
    })),
    [overview]
  );

  const glassCardSx = {
    borderRadius: 3,
    backdropFilter: 'blur(12px)',
    backgroundColor: 'rgba(255,255,255,0.72)',
    boxShadow: '0 10px 24px rgba(0,0,0,0.08)',
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'stretch' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
        <Typography sx={{ fontSize: '1.875rem', fontWeight: 700, color: '#111827' }}>Admin Dashboard</Typography>
        <Typography sx={{ color: '#6b7280', mt: 0.5 }}>Access management overview connected to user login activity</Typography>
      </Box>

      <Grid container spacing={3}>
        {stats.map((stat, i) => (
          <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card sx={glassCardSx}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1.5 }}>
                  <Box sx={{ textAlign: 'left' }}>
                    <Typography sx={{ fontSize: '0.875rem', color: '#4b5563' }}>{stat.title}</Typography>
                    <Typography sx={{ fontSize: '1.875rem', fontWeight: 700, color: '#111827', mt: 1 }}>{stat.value}</Typography>
                    <Typography sx={{ fontSize: '0.875rem', color: '#6b7280', mt: 1 }}>{stat.description}</Typography>
                  </Box>
                  <Box sx={{ p: 1.5, borderRadius: 2, backgroundColor: stat.color }}><stat.icon size={22} color="#fff" /></Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <NoticesPanel
        role="admin"
        title="Admin Notices"
        sx={glassCardSx}
      />

      {isLoading && (
        <Typography sx={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading dashboard data...</Typography>
      )}

      <Card sx={glassCardSx}>
        <CardHeader title="Recent Login Activity" />
        <CardContent>
          {!recentLogins.length ? (
            <EmptyState
              icon={Clock}
              title="No recent logins"
              description="Login activity will appear here."
            />
          ) : (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Last Login</TableCell>
                  <TableCell>Login Count</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentLogins.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell sx={{ fontWeight: 500, color: '#111827' }}>{row.email}</TableCell>
                    <TableCell>{row.role}</TableCell>
                    <TableCell sx={{ color: '#6b7280' }}>{row.formattedLastLogin}</TableCell>
                    <TableCell>{row.loginCount}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={row.isActive ? 'active' : 'disabled'}
                        sx={{
                          backgroundColor: row.isActive ? '#dcfce7' : '#fee2e2',
                          color: row.isActive ? '#15803d' : '#b91c1c',
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default AdminDashboard;
