import React, { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
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
import { getStudentAttendancePageData } from '../../lib/academicDataApi';
import { LIVE_STALE_TIME_MS } from '../../lib/queryClient';
import { queryKeys } from '../../lib/queryKeys';
import { supabase } from '../../lib/supabaseClient.js';

const StudentAttendancePage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const normalizedEmail = (user?.email || '').trim().toLowerCase();
  const attendanceCacheKey = `aawe:student-attendance-snapshot:${normalizedEmail}`;

  const cachedAttendanceSnapshot = useMemo(() => {
    if (typeof window === 'undefined' || !normalizedEmail) {
      return null;
    }

    try {
      const raw = window.localStorage.getItem(attendanceCacheKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return {
        attendanceRows: Array.isArray(parsed?.attendanceRows) ? parsed.attendanceRows : [],
        assignedCourses: Array.isArray(parsed?.assignedCourses) ? parsed.assignedCourses : [],
      };
    } catch {
      return null;
    }
  }, [attendanceCacheKey, normalizedEmail]);

  const { data: attendanceSnapshot = { attendanceRows: [], assignedCourses: [] }, isLoading, isError, error } = useQuery({
    queryKey: queryKeys.student.attendance(normalizedEmail),
    queryFn: () => getStudentAttendancePageData(normalizedEmail, user?.department || ''),
    enabled: Boolean(normalizedEmail),
    staleTime: LIVE_STALE_TIME_MS,
    initialData: cachedAttendanceSnapshot || undefined,
  });

  const attendanceRows = attendanceSnapshot.attendanceRows || [];
  const assignedCourses = attendanceSnapshot.assignedCourses || [];

  const glassCardSx = {
    borderRadius: 3,
    backdropFilter: 'blur(14px)',
    backgroundColor: 'rgba(255,255,255,0.76)',
    boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
    border: '1px solid rgba(148,163,184,0.22)',
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !normalizedEmail) return;

    try {
      window.localStorage.setItem(attendanceCacheKey, JSON.stringify({
        attendanceRows,
        assignedCourses,
        cachedAt: new Date().toISOString(),
      }));
    } catch {
      // Ignore storage errors.
    }
  }, [attendanceCacheKey, assignedCourses, attendanceRows, normalizedEmail]);

  useEffect(() => {
    if (!normalizedEmail) return undefined;

    const attendanceChannel = supabase
      .channel(`student-attendance-live-${normalizedEmail}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_records' },
        () => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.student.attendance(normalizedEmail) });
        }
      )
      .subscribe();

    const assignmentsChannel = supabase
      .channel(`student-attendance-assignments-${normalizedEmail}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'class_assignments' },
        () => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.student.attendance(normalizedEmail) });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(attendanceChannel);
      void supabase.removeChannel(assignmentsChannel);
    };
  }, [normalizedEmail, queryClient]);

  const courses = useMemo(() => {
    const assignmentRows = Array.isArray(assignedCourses) ? assignedCourses : [];
    const grouped = new Map();

    assignmentRows.forEach((row) => {
      const courseCode = (row.course_code || '').trim().toUpperCase();
      if (!courseCode || grouped.has(courseCode)) return;

      grouped.set(courseCode, {
        id: courseCode,
        name: row.course_name || courseCode,
        code: courseCode,
        instructor: row.faculty_email || row.staff_email || 'Faculty',
        totalClasses: 0,
        attended: 0,
        percentage: 0,
        status: 'critical',
      });
    });

    (attendanceRows || []).forEach((row) => {
      const courseCode = (row.course_code || '').trim().toUpperCase();
      if (!courseCode) return;

      if (!grouped.has(courseCode)) {
        grouped.set(courseCode, {
          id: courseCode,
          name: row.course_name || courseCode,
          code: courseCode,
          instructor: row.faculty_email || 'Faculty',
          totalClasses: 0,
          attended: 0,
          percentage: 0,
          status: 'critical',
        });
      }

      const current = grouped.get(courseCode);
      current.totalClasses += 1;
      if (row.is_present) {
        current.attended += 1;
      }
    });

    return Array.from(grouped.values()).map((course) => {
      const percentage = course.totalClasses
        ? (course.attended / course.totalClasses) * 100
        : 0;

      const status = course.totalClasses > 0 ? 'present' : 'critical';

      return {
        ...course,
        percentage: Number(percentage.toFixed(1)),
        status,
      };
    }).sort((left, right) => left.code.localeCompare(right.code));
  }, [assignedCourses, attendanceRows]);

  const recentAttendance = useMemo(
    () =>
      [...attendanceRows]
        .sort((left, right) => String(right.attendance_date || '').localeCompare(String(left.attendance_date || '')))
        .slice(0, 10)
        .map((row) => ({
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

  const condonationCourses = useMemo(
    () => courses.filter((course) => course.totalClasses > 0 && course.percentage < 75),
    [courses]
  );

  const overallAttended = courses.reduce((a, c) => a + c.attended, 0);
  const overallTotal = courses.reduce((a, c) => a + c.totalClasses, 0);
  const overallPercentage = overallTotal ? ((overallAttended / overallTotal) * 100).toFixed(1) : '0.0';

  const getStatusStyle = (status) => {
    switch (status) {
      case 'present':
        return { bg: '#dcfce7', color: '#15803d', label: 'Present' };
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
        {condonationCourses.length > 0 && (
          <Badge
            color="error"
            sx={{ mt: 1.25, '& .MuiBadge-badge': { position: 'relative', transform: 'none', px: 1, py: 1.2, borderRadius: 1.2, fontWeight: 700 } }}
            badgeContent="Condonation Alert"
          >
            <Box sx={{ width: 1, height: 1 }} />
          </Badge>
        )}
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
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

        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
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

        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card sx={{ ...glassCardSx, background: 'linear-gradient(130deg, #ffedd5 0%, #fde68a 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
                <AlertCircle size={24} color="#ea580c" />
                <Box>
                  <Typography variant="body2">Below 85%</Typography>
                  <Typography variant="h6">
                    {courses.filter((c) => c.totalClasses > 0 && c.percentage < 85).length}
                  </Typography>
                </Box>
              </Box>
              <Typography variant="caption">Need attention</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        {/* Subject-wise Attendance */}
        <Grid size={{ xs: 12 }}>
          <Card sx={glassCardSx}>
            <CardHeader title="Subject-wise Attendance" subheader="Attendance for each subject" />
            <CardContent>
              {isLoading && (
                <Typography sx={{ mb: 2, color: '#6b7280' }}>Loading attendance...</Typography>
              )}
              {isError && (
                <Typography sx={{ mb: 2, color: '#b91c1c' }}>
                  Failed to load attendance: {error?.message || 'Please refresh or check your Supabase setup.'}
                </Typography>
              )}
              {!isLoading && courses.length === 0 && (
                <Typography sx={{ mb: 2, color: '#6b7280' }}>
                  No assigned courses found for {user?.email}.
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
                      <Typography sx={{ mt: 0.75, fontSize: '0.8rem', color: '#475569' }}>
                        {course.percentage}% attendance
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

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