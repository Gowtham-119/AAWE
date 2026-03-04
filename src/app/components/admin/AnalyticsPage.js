import React, { useEffect, useMemo, useState } from 'react';
import { Box, Card, CardContent, CardHeader, Grid, Typography } from '@mui/material';
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { getAdminDashboardData, getAnalyticsData } from '../../lib/academicDataApi';

export const AnalyticsPage = () => {
  const [departmentData, setDepartmentData] = useState([]);
  const [monthlyTrends, setMonthlyTrends] = useState([]);
  const [summary, setSummary] = useState({ avgMarks: 0, attendanceRate: 0 });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadAnalytics = async () => {
      setIsLoading(true);
      try {
        const [departmentAnalytics, dashboardData] = await Promise.all([
          getAnalyticsData(),
          getAdminDashboardData(),
        ]);

        setDepartmentData(departmentAnalytics.departmentData || []);
        setMonthlyTrends(
          (dashboardData.enrollmentTrend || []).map((row) => ({
            month: row.month,
            enrollment: row.students + row.faculty,
            attendance: dashboardData.stats?.attendanceRate || 0,
            performance: dashboardData.stats?.avgMarks || 0,
          }))
        );
        setSummary({
          avgMarks: dashboardData.stats?.avgMarks || 0,
          attendanceRate: dashboardData.stats?.attendanceRate || 0,
        });
      } catch (error) {
        console.error('Failed to load analytics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAnalytics();
  }, []);

  const glassCardSx = useMemo(() => ({
    borderRadius: 3,
    backdropFilter: 'blur(12px)',
    backgroundColor: 'rgba(255,255,255,0.72)',
    boxShadow: '0 10px 24px rgba(0,0,0,0.08)',
  }), []);

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography sx={{ fontSize: '1.875rem', fontWeight: 700, color: '#111827' }}>Advanced Analytics</Typography>
        <Typography sx={{ color: '#6b7280', mt: 0.5 }}>Comprehensive insights into academic performance</Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={glassCardSx}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Box>
                  <Typography sx={{ fontSize: '0.875rem', color: '#4b5563' }}>Avg. Performance</Typography>
                  <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', mt: 0.5 }}>{summary.avgMarks}%</Typography>
                </Box>
                <Box sx={{ backgroundColor: '#dbeafe', p: 1.5, borderRadius: 1.5 }}><TrendingUp size={24} color="#2563eb" /></Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={glassCardSx}>
            <CardContent sx={{ p: 3 }}>
              <Typography sx={{ fontSize: '0.875rem', color: '#4b5563' }}>Attendance Rate</Typography>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', mt: 0.5 }}>{summary.attendanceRate}%</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {isLoading && <Typography sx={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading analytics...</Typography>}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={glassCardSx}>
            <CardHeader title="Department Performance" />
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={departmentData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="department" /><YAxis /><Tooltip /><Legend /><Bar dataKey="avgGrade" fill="#3b82f6" name="Avg Grade" /><Bar dataKey="attendance" fill="#10b981" name="Attendance %" /></BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={glassCardSx}>
            <CardHeader title="Monthly Performance Trends" />
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyTrends}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend /><Line type="monotone" dataKey="attendance" stroke="#3b82f6" strokeWidth={2} name="Attendance %" /><Line type="monotone" dataKey="performance" stroke="#10b981" strokeWidth={2} name="Performance %" /></LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AnalyticsPage;
