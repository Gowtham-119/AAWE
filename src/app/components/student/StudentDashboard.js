import React, { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Card, CardContent, CardHeader, Chip, Grid, LinearProgress, Typography } from '@mui/material';
import { BookOpen, ClipboardCheck, TrendingUp, Award, Calendar } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { getAttendanceByStudentEmail, getClassAssignmentsByStudentEmail, getMarksByStudentEmail, getRecentAttendanceActivityByStudentEmail, getStudentProfileByEmail } from '../../lib/academicDataApi';
import { LIVE_STALE_TIME_MS, STATIC_STALE_TIME_MS } from '../../lib/queryClient';
import { queryKeys } from '../../lib/queryKeys';
import { supabase } from '../../lib/supabaseClient.js';
import { Skeleton } from '../ui/skeleton';
import NoticesPanel from '../ui/NoticesPanel.jsx';

const formatActivityTime = (isoString) => {
  if (!isoString) return 'Live update';

  const timestamp = new Date(isoString);
  if (Number.isNaN(timestamp.getTime())) return 'Live update';

  const diffMs = Date.now() - timestamp.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
};

const formatNameFromEmail = (email) => {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized.includes('@')) return '';
  const localPart = normalized.split('@')[0] || '';
  return localPart
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const StudentDashboard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const normalizedEmail = (user?.email || '').trim().toLowerCase();

  const { data: profileData, isLoading: isLoadingProfile } = useQuery({
    queryKey: queryKeys.student.profile(normalizedEmail),
    queryFn: () => getStudentProfileByEmail(normalizedEmail),
    enabled: Boolean(normalizedEmail),
    staleTime: STATIC_STALE_TIME_MS,
  });

  const resolvedDepartment = useMemo(
    () => (profileData?.department || user?.department || '').trim().toUpperCase(),
    [profileData?.department, user?.department]
  );

  const { data: assignedClasses = [], isLoading: isLoadingAssignedClasses } = useQuery({
    queryKey: ['student-assignments', normalizedEmail, resolvedDepartment],
    queryFn: () => getClassAssignmentsByStudentEmail(normalizedEmail, resolvedDepartment),
    enabled: Boolean(normalizedEmail),
    staleTime: LIVE_STALE_TIME_MS,
  });

  const { data: attendanceRows = [], isLoading: isLoadingAttendance } = useQuery({
    queryKey: queryKeys.student.attendance(normalizedEmail),
    queryFn: () => getAttendanceByStudentEmail(normalizedEmail),
    enabled: Boolean(normalizedEmail),
    staleTime: LIVE_STALE_TIME_MS,
  });

  const { data: marksRows = [], isLoading: isLoadingMarks } = useQuery({
    queryKey: queryKeys.student.marks(normalizedEmail),
    queryFn: () => getMarksByStudentEmail(normalizedEmail),
    enabled: Boolean(normalizedEmail),
    staleTime: LIVE_STALE_TIME_MS,
  });

  const { data: recentAttendanceActivity = [], isLoading: isLoadingRecentActivity } = useQuery({
    queryKey: ['student-recent-activity', normalizedEmail],
    queryFn: () => getRecentAttendanceActivityByStudentEmail(normalizedEmail, 5),
    enabled: Boolean(normalizedEmail),
    staleTime: LIVE_STALE_TIME_MS,
  });

  const studentSummary = useMemo(() => {
    const attendanceRate = attendanceRows.length
      ? Number(((attendanceRows.filter((row) => row.is_present).length / attendanceRows.length) * 100).toFixed(1))
      : 0;

    const averageMarks = marksRows.length
      ? Number((marksRows.reduce((accumulator, row) => accumulator + Number(row.total || 0), 0) / marksRows.length).toFixed(1))
      : 0;

    const enrolledCoursesCount = new Set(
      [...attendanceRows, ...marksRows].map((row) => row.course_code).filter(Boolean)
    ).size;

    return {
      attendanceRate,
      averageMarks,
      enrolledCoursesCount,
      assignmentsCount: assignedClasses.length,
    };
  }, [assignedClasses.length, attendanceRows, marksRows]);

  const courseCards = useMemo(() => {
    const attendanceByCourse = new Map();
    attendanceRows.forEach((row) => {
      if (!row.course_code) return;
      if (!attendanceByCourse.has(row.course_code)) {
        attendanceByCourse.set(row.course_code, { total: 0, present: 0, courseName: row.course_name || row.course_code });
      }
      const current = attendanceByCourse.get(row.course_code);
      current.total += 1;
      if (row.is_present) current.present += 1;
    });

    const marksByCourse = new Map();
    marksRows.forEach((row) => {
      if (!row.course_code) return;
      marksByCourse.set(row.course_code, {
        total: Number(row.total || 0),
        grade: row.grade || '-',
        courseName: row.course_name || row.course_code,
      });
    });

    const mergedCodes = new Set([...attendanceByCourse.keys(), ...marksByCourse.keys()]);
    return [...mergedCodes].map((courseCode, index) => {
      const attendance = attendanceByCourse.get(courseCode);
      const marks = marksByCourse.get(courseCode);
      const attendancePct = attendance?.total ? Number(((attendance.present / attendance.total) * 100).toFixed(1)) : 0;
      return {
        id: index + 1,
        code: courseCode,
        name: marks?.courseName || attendance?.courseName || courseCode,
        attendance: attendancePct,
        marks: Number(marks?.total || 0),
        grade: marks?.grade || '-',
      };
    });
  }, [attendanceRows, marksRows]);

  const atRiskCourses = useMemo(
    () => courseCards.filter((course) => Number(course.attendance || 0) < 75),
    [courseCards]
  );

  const studentDisplayName = useMemo(() => {
    const profileName = (profileData?.name || '').trim();
    if (profileName) return profileName;
    return formatNameFromEmail(normalizedEmail) || 'Student';
  }, [profileData?.name, normalizedEmail]);

  const isDashboardLoading = isLoadingProfile || isLoadingAssignedClasses || isLoadingAttendance || isLoadingMarks;

  const studentStats = [
    { title: 'Overall Attendance', value: `${studentSummary.attendanceRate}%`, icon: ClipboardCheck, color: 'bg-green-500', progress: studentSummary.attendanceRate },
    { title: 'Average Marks', value: `${studentSummary.averageMarks}`, icon: TrendingUp, color: 'bg-blue-500', progress: studentSummary.averageMarks },
    { title: 'Enrolled Courses', value: `${studentSummary.enrolledCoursesCount}`, icon: BookOpen, color: 'bg-purple-500', progress: Math.min(100, studentSummary.enrolledCoursesCount * 20) },
    { title: 'Assigned Classes', value: `${studentSummary.assignmentsCount}`, icon: Award, color: 'bg-orange-500', progress: Math.min(100, studentSummary.assignmentsCount * 20) },
  ];

  useEffect(() => {
    if (!normalizedEmail) return undefined;

    const assignmentChannel = supabase
      .channel(`student-assignments-${normalizedEmail}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'class_assignments',
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['student-assignments', normalizedEmail, resolvedDepartment] });
        }
      )
      .subscribe();

    const attendanceChannel = supabase
      .channel(`student-attendance-${normalizedEmail}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_records',
          filter: `student_email=eq.${normalizedEmail}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.student.attendance(normalizedEmail) });
          void queryClient.invalidateQueries({ queryKey: ['student-recent-activity', normalizedEmail] });
        }
      )
      .subscribe();

    const marksChannel = supabase
      .channel(`student-marks-${normalizedEmail}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'marks_records',
          filter: `student_email=eq.${normalizedEmail}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.student.marks(normalizedEmail) });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(assignmentChannel);
      void supabase.removeChannel(attendanceChannel);
      void supabase.removeChannel(marksChannel);
    };
  }, [normalizedEmail, queryClient, resolvedDepartment]);

  const upcomingClasses = useMemo(
    () =>
      assignedClasses.map((assignment) => ({
        course: `${assignment.course_code} - ${assignment.course_name}`,
        room: assignment.venue || 'Venue not assigned',
        assignedBy:
          assignment.staff_name
          || formatNameFromEmail(assignment.faculty_email)
          || formatNameFromEmail(assignment.staff_email)
          || assignment.faculty_email
          || assignment.staff_email
          || 'Faculty',
        updatedAt: assignment.updated_at || null,
      })),
    [assignedClasses]
  );

  const recentActivityFeed = useMemo(
    () => (recentAttendanceActivity || []).map((row, index) => ({
      id: `${row.course_code || 'course'}-${row.attendance_date || index}`,
      title: `${row.course_code || 'Course'}${row.course_name ? ` - ${row.course_name}` : ''}`,
      description: row.is_present ? 'Marked Present' : 'Marked Absent',
      facultyEmail: row.faculty_email || 'Faculty not set',
      date: formatActivityTime(row.created_at),
      priority: row.is_present ? 'low' : 'high',
    })),
    [recentAttendanceActivity]
  );

  const glassCardSx = {
    borderRadius: 3,
    backdropFilter: 'blur(12px)',
    backgroundColor: 'rgba(255,255,255,0.72)',
    boxShadow: '0 10px 24px rgba(0,0,0,0.08)',
  };

  return (
    <Box sx={{ p: { xs: 2, md: 2.5 }, display: 'flex', flexDirection: 'column', gap: 2.25 }}>
      <Box>
        <Typography sx={{ fontSize: { xs: '1.6rem', md: '1.85rem' }, fontWeight: 700, letterSpacing: '-0.02em', color: '#111827' }}>Student Dashboard</Typography>
        <Typography sx={{ color: '#6b7280', mt: 0.5 }}>Track your academic progress and performance</Typography>
      </Box>

      <Card sx={{ ...glassCardSx, background: 'linear-gradient(120deg, #ecfeff 0%, #dbeafe 55%, #e0e7ff 100%)', border: '1px solid rgba(37,99,235,0.22)' }}>
        <CardContent sx={{ py: 2.2 }}>
          {isLoadingProfile ? (
            <Skeleton className="h-8 w-64" />
          ) : (
            <Typography sx={{ fontSize: { xs: '1.1rem', md: '1.35rem' }, fontWeight: 700, color: '#0f172a' }}>
              Welcome back, {studentDisplayName}
            </Typography>
          )}
          <Typography sx={{ color: '#475569', mt: 0.6, fontSize: '0.92rem' }}>
            Here is your latest attendance, marks and course activity snapshot.
          </Typography>
        </CardContent>
      </Card>

      {atRiskCourses.length > 0 && (
        <Card sx={{ ...glassCardSx, border: '1px solid rgba(239,68,68,0.35)', backgroundColor: '#fff7f7' }}>
          <CardHeader title="At Risk" subheader="Attendance below 75% detected" />
          <CardContent sx={{ pt: 0 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {atRiskCourses.map((course) => (
                <Chip
                  key={course.code}
                  label={`${course.code} (${course.attendance}%)`}
                  sx={{ backgroundColor: '#fee2e2', color: '#b91c1c', fontWeight: 600 }}
                />
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      <NoticesPanel
        role="student"
        title="Student Notices"
        sx={glassCardSx}
      />

      <Grid container spacing={2}>
        {isDashboardLoading ? [0, 1, 2, 3].map((slot) => (
          <Grid key={`stats-skeleton-${slot}`} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card sx={glassCardSx}>
              <CardContent sx={{ p: 3 }}>
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-20 mt-3" />
                <Skeleton className="h-2 w-full mt-4" />
              </CardContent>
            </Card>
          </Grid>
        )) : studentStats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Grid key={index} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card sx={glassCardSx}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box>
                    <Typography sx={{ fontSize: '0.875rem', color: '#4b5563' }}>{stat.title}</Typography>
                    <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', mt: 1 }}>{stat.value}</Typography>
                  </Box>
                  <Box sx={{ p: 1.5, borderRadius: 1.5, backgroundColor: stat.color === 'bg-green-500' ? '#22c55e' : stat.color === 'bg-blue-500' ? '#3b82f6' : stat.color === 'bg-purple-500' ? '#a855f7' : '#f97316' }}>
                    <Icon size={24} color="#ffffff" />
                  </Box>
                </Box>
                <LinearProgress variant="determinate" value={stat.progress} sx={{ height: 8, borderRadius: 99 }} />
              </CardContent>
            </Card>
            </Grid>
          );
        })}
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card sx={glassCardSx}>
            <CardHeader title="Enrolled Courses" />
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {isDashboardLoading && (
                  <>
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </>
                )}
                {!isDashboardLoading && !courseCards.length && (
                  <Typography sx={{ color: '#6b7280', fontSize: '0.875rem' }}>No course data available yet.</Typography>
                )}
                {!isDashboardLoading && courseCards.map((course) => (
                  <Box key={course.id} sx={{ border: '1px solid #e5e7eb', borderRadius: 1.5, p: 2, '&:hover': { boxShadow: 2 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography sx={{ fontWeight: 600, color: '#111827' }}>{course.name}</Typography>
                          <Chip size="small" label={course.code} sx={{ backgroundColor: '#dbeafe', color: '#1d4ed8' }} />
                        </Box>
                        <Typography sx={{ fontSize: '0.875rem', color: '#6b7280' }}>From attendance and marks records</Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#2563eb' }}>{course.grade}</Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: '#6b7280' }}>Live Grade</Typography>
                      </Box>
                    </Box>
                    <Grid container spacing={2}>
                      <Grid size={6}>
                        <Typography sx={{ fontSize: '0.75rem', color: '#6b7280', mb: 0.5 }}>Attendance</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress variant="determinate" value={course.attendance} sx={{ flex: 1, height: 8, borderRadius: 99 }} />
                          <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>{course.attendance}%</Typography>
                        </Box>
                      </Grid>
                      <Grid size={6}>
                        <Typography sx={{ fontSize: '0.75rem', color: '#6b7280', mb: 0.5 }}>Marks</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress variant="determinate" value={course.marks} sx={{ flex: 1, height: 8, borderRadius: 99 }} />
                          <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>{course.marks}%</Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Card sx={glassCardSx}>
            <CardHeader
              title="Upcoming Classes"
              subheader="Live sync from faculty assignments"
              sx={{
                '& .MuiCardHeader-title': {
                  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif',
                  fontWeight: 650,
                  letterSpacing: '-0.01em',
                },
                '& .MuiCardHeader-subheader': {
                  color: '#64748b',
                },
              }}
            />
            <CardContent>
              {isLoadingAssignedClasses && (
                <Typography sx={{ fontSize: '0.875rem', color: '#6b7280', mb: 1.5 }}>
                  Loading assigned classes...
                </Typography>
              )}
              {isLoadingAssignedClasses && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 1.5 }}>
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </Box>
              )}

              {!isLoadingAssignedClasses && !upcomingClasses.length && (
                <Typography sx={{ fontSize: '0.875rem', color: '#6b7280', mb: 1.5 }}>
                  No class assignments yet.
                </Typography>
              )}

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {upcomingClasses.map((classItem, index) => (
                  <Box
                    key={index}
                    sx={{
                      p: 1.75,
                      borderRadius: 2.5,
                      border: '1px solid rgba(148,163,184,0.28)',
                      background: 'linear-gradient(145deg, rgba(255,255,255,0.90), rgba(241,245,249,0.75))',
                      boxShadow: '0 10px 25px rgba(15, 23, 42, 0.08)',
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.8 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                        <Calendar size={15} color="#2563eb" />
                        <Typography
                          sx={{
                            fontWeight: 600,
                            color: '#0f172a',
                            fontSize: '0.88rem',
                            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {classItem.course}
                        </Typography>
                      </Box>
                      <Chip size="small" label="Live" sx={{ backgroundColor: '#dbeafe', color: '#1d4ed8', height: 22 }} />
                    </Box>

                    <Typography sx={{ fontSize: '0.77rem', color: '#475569' }}>{classItem.room}</Typography>
                    <Typography sx={{ fontSize: '0.77rem', color: '#334155', mt: 0.35 }}>
                      Assigned by: <Box component="span" sx={{ fontWeight: 600 }}>{classItem.assignedBy}</Box>
                    </Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8', mt: 0.45 }}>
                      Updated {formatActivityTime(classItem.updatedAt)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>

          <Card sx={glassCardSx}>
            <CardHeader title="Recent Activity" subheader="Latest attendance updates" />
            <CardContent>
              {isLoadingRecentActivity && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 1.5 }}>
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </Box>
              )}
              {!isLoadingRecentActivity && !recentActivityFeed.length && (
                <Typography sx={{ fontSize: '0.875rem', color: '#6b7280', mb: 1.5 }}>
                  No activity updates yet.
                </Typography>
              )}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {!isLoadingRecentActivity && recentActivityFeed.map((activity) => (
                  <Box key={activity.id} sx={{ p: 1.5, backgroundColor: '#f9fafb', borderRadius: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, gap: 1 }}>
                      <Typography sx={{ fontWeight: 500, fontSize: '0.875rem', color: '#111827', flex: 1 }}>{activity.title}</Typography>
                      <Chip
                        size="small"
                        label={activity.priority}
                        sx={{
                          fontSize: '0.75rem',
                          backgroundColor: activity.priority === 'high' ? '#fee2e2' : '#dcfce7',
                          color: activity.priority === 'high' ? '#b91c1c' : '#15803d',
                        }}
                      />
                    </Box>
                    <Typography sx={{ fontSize: '0.75rem', color: '#6b7280' }}>{activity.description}</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#6b7280', mt: 0.4 }}>{activity.facultyEmail}</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#9ca3af', mt: 0.5 }}>{activity.date}</Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default StudentDashboard;
