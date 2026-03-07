import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Grid,
  LinearProgress,
  Typography
} from '@mui/material';
import {
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { getAttendanceByStudentEmail } from '../../lib/academicDataApi';
import { supabase } from '../../lib/supabaseClient.js';

const StudentAttendancePage = () => {
  const { user } = useAuth();
  const [attendanceRows, setAttendanceRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const glassCardSx = {
    borderRadius: 3,
    backdropFilter: 'blur(14px)',
    backgroundColor: 'rgba(255,255,255,0.76)',
    boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
    border: '1px solid rgba(148,163,184,0.22)',
  };

  const loadAttendance = useCallback(async () => {
    const normalizedEmail = (user?.email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      setAttendanceRows([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const rows = await getAttendanceByStudentEmail(normalizedEmail);
      setAttendanceRows(rows);
    } catch (error) {
      console.error('Failed to fetch attendance:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.email]);

  useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  useEffect(() => {
    if (!user?.email) return undefined;

    const channel = supabase
      .channel(`student-attendance-live-${user.email}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_records' },
        () => {
          void loadAttendance();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.email, loadAttendance]);

  const courses = useMemo(() => {
    const grouped = attendanceRows.reduce((acc, row) => {
      if (!acc[row.course_code]) {
        acc[row.course_code] = {
          id: row.course_code,
          name: row.course_name || row.course_code,
          code: row.course_code,
          instructor: row.faculty_email || 'Faculty',
          totalClasses: 0,
          attended: 0,
          percentage: 0,
          status: 'good',
        };
      }

      acc[row.course_code].totalClasses += 1;
      if (row.is_present) {
        acc[row.course_code].attended += 1;
      }

      return acc;
    }, {});

    return Object.values(grouped).map((course) => {
      const percentage = course.totalClasses
        ? (course.attended / course.totalClasses) * 100
        : 0;

      const status = percentage >= 85 ? 'good' : percentage >= 75 ? 'warning' : 'critical';

      return {
        ...course,
        percentage: Number(percentage.toFixed(1)),
        status,
      };
    });
  }, [attendanceRows]);

  const recentAttendance = useMemo(
    () =>
      attendanceRows.slice(0, 10).map((row) => ({
        date: new Date(row.attendance_date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        course: row.course_code,
        status: row.is_present ? 'present' : 'absent',
      })),
    [attendanceRows]
  );

  const overallAttended = courses.reduce((a, c) => a + c.attended, 0);
  const overallTotal = courses.reduce((a, c) => a + c.totalClasses, 0);
  const overallPercentage = overallTotal ? ((overallAttended / overallTotal) * 100).toFixed(1) : '0.0';

  const getStatusStyle = (status) => {
    switch (status) {
      case 'good':
        return { bg: '#dcfce7', color: '#15803d', label: 'Good Standing' };
      case 'warning':
        return { bg: '#fef3c7', color: '#a16207', label: 'Needs Improvement' };
      default:
        return { bg: '#fee2e2', color: '#b91c1c', label: 'Critical' };
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 2.5 }, display: 'flex', flexDirection: 'column', gap: 2.25, background: 'radial-gradient(circle at 8% 10%, rgba(191,219,254,0.20), transparent 36%), radial-gradient(circle at 100% 92%, rgba(252,211,77,0.14), transparent 42%)' }}>
      {/* Header */}
      <Box>
        <Typography sx={{ fontSize: { xs: '1.6rem', md: '1.85rem' }, fontWeight: 700, letterSpacing: '-0.02em' }}>
          My Attendance
        </Typography>
        <Typography sx={{ color: '#6b7280' }}>
          Track your attendance across all courses
        </Typography>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ ...glassCardSx, background: 'linear-gradient(130deg, #dbeafe 0%, #e0f2fe 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
                <Calendar size={24} color="#2563eb" />
                <Box>
                  <Typography variant="body2">Overall Attendance</Typography>
                  <Typography variant="h6">{overallPercentage}%</Typography>
                </Box>
              </Box>
              <LinearProgress
                variant="determinate"
                value={parseFloat(overallPercentage)}
                sx={{ height: 8, borderRadius: 99 }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ ...glassCardSx, background: 'linear-gradient(130deg, #dcfce7 0%, #d1fae5 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
                <CheckCircle size={24} color="#16a34a" />
                <Box>
                  <Typography variant="body2">Classes Attended</Typography>
                  <Typography variant="h6">{overallAttended}</Typography>
                </Box>
              </Box>
              <Typography variant="caption">
                out of {overallTotal} classes
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ ...glassCardSx, background: 'linear-gradient(130deg, #ffedd5 0%, #fde68a 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
                <AlertCircle size={24} color="#ea580c" />
                <Box>
                  <Typography variant="body2">Below 85%</Typography>
                  <Typography variant="h6">
                    {courses.filter(c => c.percentage < 85).length}
                  </Typography>
                </Box>
              </Box>
              <Typography variant="caption">Need attention</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Course-wise Attendance */}
      <Card sx={glassCardSx}>
        <CardHeader title="Course-wise Attendance" />
        <CardContent>
          {isLoading && (
            <Typography sx={{ mb: 2, color: '#6b7280' }}>Loading attendance...</Typography>
          )}
          {!isLoading && courses.length === 0 && (
            <Typography sx={{ mb: 2, color: '#6b7280' }}>
              No attendance records found in database for {user?.email}.
            </Typography>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {courses.map(course => {
              const status = getStatusStyle(course.status);

              return (
                <Box
                  key={course.id}
                  sx={{
                    border: '1px solid rgba(148,163,184,0.26)',
                    borderRadius: 2.25,
                    p: 1.75,
                    background: 'linear-gradient(145deg, rgba(255,255,255,0.9), rgba(241,245,249,0.72))',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Box>
                      <Typography fontWeight={600}>{course.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {course.code} • {course.instructor}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={status.label}
                      sx={{ backgroundColor: status.bg, color: status.color }}
                    />
                  </Box>

                  <Grid container spacing={2} mb={1}>
                    <Grid size={{ xs: 4 }}>
                      <Typography variant="caption">Total</Typography>
                      <Typography fontWeight={600}>{course.totalClasses}</Typography>
                    </Grid>
                    <Grid size={{ xs: 4 }}>
                      <Typography variant="caption">Attended</Typography>
                      <Typography fontWeight={600} color="#16a34a">
                        {course.attended}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 4 }}>
                      <Typography variant="caption">Missed</Typography>
                      <Typography fontWeight={600} color="#dc2626">
                        {course.totalClasses - course.attended}
                      </Typography>
                    </Grid>
                  </Grid>

                  <LinearProgress
                    variant="determinate"
                    value={course.percentage}
                    sx={{ height: 8, borderRadius: 99 }}
                  />
                </Box>
              );
            })}
          </Box>
        </CardContent>
      </Card>

      {/* Recent Attendance */}
      <Card sx={glassCardSx}>
        <CardHeader title="Recent Attendance Log" />
        <CardContent>
          {!isLoading && recentAttendance.length === 0 && (
            <Typography sx={{ mb: 1, color: '#6b7280' }}>No recent logs available.</Typography>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {recentAttendance.map((r, i) => (
              <Box
                key={i}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  p: 1.5,
                  borderRadius: 1.5,
                  backgroundColor: 'rgba(248,250,252,0.9)',
                  border: '1px solid rgba(148,163,184,0.18)'
                }}
              >
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {r.status === 'present'
                    ? <CheckCircle size={18} color="#16a34a" />
                    : <XCircle size={18} color="#dc2626" />}
                  <Box>
                    <Typography fontWeight={500}>{r.course}</Typography>
                    <Typography variant="caption">{r.date}</Typography>
                  </Box>
                </Box>
                <Chip
                  size="small"
                  label={r.status}
                  sx={{
                    backgroundColor: r.status === 'present' ? '#dcfce7' : '#fee2e2',
                    color: r.status === 'present' ? '#15803d' : '#b91c1c'
                  }}
                />
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default StudentAttendancePage;