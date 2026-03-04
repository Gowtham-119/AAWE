import React, { useEffect, useMemo, useState } from 'react';
import { Box, Card, CardContent, CardHeader, Chip, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { BookOpen, Lock, ShieldCheck, Users } from 'lucide-react';
import { getAdminAccessOverview } from '../../lib/academicDataApi';

export const AdminDashboard = () => {
  const [overview, setOverview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadDashboard = async () => {
      setIsLoading(true);
      try {
        const data = await getAdminAccessOverview();
        setOverview(data);
      } catch (error) {
        console.error('Failed to load admin dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();
  }, []);

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

  const recentLogins = overview?.recentLogins || [];

  const glassCardSx = {
    borderRadius: 3,
    backdropFilter: 'blur(12px)',
    backgroundColor: 'rgba(255,255,255,0.72)',
    boxShadow: '0 10px 24px rgba(0,0,0,0.08)',
  };

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography sx={{ fontSize: '1.875rem', fontWeight: 700, color: '#111827' }}>Admin Dashboard</Typography>
        <Typography sx={{ color: '#6b7280', mt: 0.5 }}>Access management overview connected to user login activity</Typography>
      </Box>

      <Grid container spacing={3}>
        {stats.map((stat, i) => (
          <Grid key={i} size={{ xs: 12, md: 6, lg: 4 }}>
            <Card sx={glassCardSx}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Box>
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

      {isLoading && (
        <Typography sx={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading dashboard data...</Typography>
      )}

      <Card sx={glassCardSx}>
        <CardHeader title="Recent Login Activity" />
        <CardContent>
          <TableContainer>
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
                {!recentLogins.length && (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ color: '#6b7280' }}>No login activity yet.</TableCell>
                  </TableRow>
                )}
                {recentLogins.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell sx={{ fontWeight: 500, color: '#111827' }}>{row.email}</TableCell>
                    <TableCell>{row.role}</TableCell>
                    <TableCell sx={{ color: '#6b7280' }}>{(row.lastLoginAt || '').replace('T', ' ').slice(0, 16)}</TableCell>
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
        </CardContent>
      </Card>
    </Box>
  );
};

export default AdminDashboard;
