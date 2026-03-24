import React, { useEffect, useMemo, useState } from 'react';
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
  Tooltip,
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
import { LIVE_STALE_TIME_MS } from '../../lib/queryClient';
import { queryKeys } from '../../lib/queryKeys';
import { supabase } from '../../lib/supabaseClient.js';
import { Calendar as AttendanceCalendar } from '../ui/calendar';

const StudentAttendancePage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const normalizedEmail = (user?.email || '').trim().toLowerCase();
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedTooltipDate, setSelectedTooltipDate] = useState(null);

  const { data: attendanceRows = [], isLoading } = useQuery({
    queryKey: queryKeys.student.attendance(normalizedEmail),
    queryFn: () => getAttendanceByStudentEmail(normalizedEmail),
    enabled: Boolean(normalizedEmail),
    staleTime: LIVE_STALE_TIME_MS,
  });

  const glassCardSx = {
    borderRadius: 3,
    backdropFilter: 'blur(14px)',
    backgroundColor: 'rgba(255,255,255,0.76)',
    boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
    border: '1px solid rgba(148,163,184,0.22)',
  };

  useEffect(() => {
    if (!normalizedEmail) return undefined;

    const channel = supabase
      .channel(`student-attendance-live-${normalizedEmail}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_records' },
        () => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.student.attendance(normalizedEmail) });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [normalizedEmail, queryClient]);

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

  const attendanceByDate = useMemo(() => {
    const map = new Map();

    attendanceRows.forEach((row) => {
      const key = row.attendance_date;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    });

    return map;
  }, [attendanceRows]);

  const presentDates = useMemo(
    () => Array.from(attendanceByDate.entries())
      .filter(([, rows]) => rows.some((row) => row.is_present) && !rows.some((row) => !row.is_present))
      .map(([date]) => new Date(`${date}T00:00:00`)),
    [attendanceByDate]
  );

  const absentDates = useMemo(
    () => Array.from(attendanceByDate.entries())
      .filter(([, rows]) => rows.some((row) => !row.is_present))
      .map(([date]) => new Date(`${date}T00:00:00`)),
    [attendanceByDate]
  );

  const tooltipTextByDate = useMemo(() => {
    const map = new Map();

    attendanceByDate.forEach((rows, dateKey) => {
      const primary = rows[0];
      const status = primary?.is_present ? 'Present' : 'Absent';
      const courseText = primary?.course_code || 'N/A';
      const markedBy = primary?.faculty_email || 'N/A';
      const multiCourseSuffix = rows.length > 1 ? ` (+${rows.length - 1} more)` : '';

      map.set(
        dateKey,
        `Course: ${courseText}${multiCourseSuffix} | Status: ${status} | Marked by: ${markedBy}`
      );
    });

    return map;
  }, [attendanceByDate]);

  const condonationCourses = useMemo(
    () => courses.filter((course) => course.percentage < 75),
    [courses]
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

  const formatDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
                    {courses.filter(c => c.percentage < 85).length}
                  </Typography>
                </Box>
              </Box>
              <Typography variant="caption">Need attention</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        {/* Course-wise Attendance */}
        <Grid size={{ xs: 12, lg: 7 }}>
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
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <Card sx={glassCardSx}>
            <CardHeader title="Monthly Attendance Calendar" />
            <CardContent>
              <AttendanceCalendar
                mode="single"
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
                toMonth={new Date()}
                onDayClick={(day) => setSelectedTooltipDate(day)}
                modifiers={{
                  present: presentDates,
                  absent: absentDates,
                  noClass: (date) => !attendanceByDate.has(formatDateKey(date)),
                  selectedInfo: (date) => {
                    if (!selectedTooltipDate) return false;
                    return formatDateKey(date) === formatDateKey(selectedTooltipDate);
                  },
                }}
                modifiersStyles={{
                  present: {
                    backgroundColor: '#dcfce7',
                    color: '#166534',
                    borderRadius: 6,
                  },
                  absent: {
                    backgroundColor: '#fee2e2',
                    color: '#991b1b',
                    borderRadius: 6,
                  },
                  noClass: {
                    backgroundColor: '#e5e7eb',
                    color: '#4b5563',
                    borderRadius: 6,
                  },
                  selectedInfo: {
                    outline: '2px solid #2563eb',
                    outlineOffset: '-2px',
                  },
                }}
                components={{
                  DayContent: ({ date }) => {
                    const key = formatDateKey(date);
                    const title = tooltipTextByDate.get(key) || 'Course: N/A | Status: No class | Marked by: N/A';
                    const isOpen = selectedTooltipDate && formatDateKey(selectedTooltipDate) === key;
                    return (
                      <Tooltip
                        title={title}
                        arrow
                        open={Boolean(isOpen)}
                        disableFocusListener
                        disableHoverListener
                        disableTouchListener
                      >
                        <span>{date.getDate()}</span>
                      </Tooltip>
                    );
                  },
                }}
              />

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1.5 }}>
                <Chip size="small" label="Present" sx={{ backgroundColor: '#dcfce7', color: '#166534' }} />
                <Chip size="small" label="Absent" sx={{ backgroundColor: '#fee2e2', color: '#991b1b' }} />
                <Chip size="small" label="No Class" sx={{ backgroundColor: '#e5e7eb', color: '#4b5563' }} />
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