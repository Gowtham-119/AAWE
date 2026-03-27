import React, { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import { useAuth } from '../../context/AuthContext.js';
import {
  getAttendanceByStudentEmail,
  getClassAssignmentsByStudentEmail,
  getMarksByStudentEmail,
  getNotices,
  getStudentProfileByEmail,
  getStudentTimetableByEmail,
} from '../../lib/academicDataApi';
import { LIVE_STALE_TIME_MS, STATIC_STALE_TIME_MS } from '../../lib/queryClient';
import { queryKeys } from '../../lib/queryKeys';
import { supabase } from '../../lib/supabaseClient.js';
import { Skeleton } from '../ui/skeleton';
import CourseProgress from '../student-dashboard/CourseProgress.jsx';
import RecentActivity from '../student-dashboard/RecentActivity.jsx';
import StudentStats from '../student-dashboard/StudentStats.jsx';
import UpcomingActivities from '../student-dashboard/UpcomingActivities.jsx';
import {
  formatNameFromEmail,
  formatRelativeTime,
  toDateFromDayAndTime,
} from '../student-dashboard/dashboardUtils.js';

export const StudentDashboard = () => {
  const theme = useTheme();
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

  const recentAttendanceActivity = useMemo(() => (
    [...attendanceRows]
      .sort((left, right) => String(right.attendance_date || '').localeCompare(String(left.attendance_date || '')))
      .slice(0, 5)
  ), [attendanceRows]);

  const { data: timetableRows = [], isLoading: isLoadingTimetable } = useQuery({
    queryKey: queryKeys.student.timetable(normalizedEmail, resolvedDepartment),
    queryFn: () => getStudentTimetableByEmail(normalizedEmail, resolvedDepartment),
    enabled: Boolean(normalizedEmail),
    staleTime: LIVE_STALE_TIME_MS,
  });

  const { data: notices = [], isLoading: isLoadingNotices } = useQuery({
    queryKey: queryKeys.common.notices('student', 8),
    queryFn: () => getNotices({ role: 'student', limit: 8 }),
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

  const studentDisplayName = useMemo(() => {
    const profileName = (profileData?.name || '').trim();
    if (profileName) return profileName;
    return formatNameFromEmail(normalizedEmail) || 'Student';
  }, [profileData?.name, normalizedEmail]);

  const isSummaryLoading = !attendanceRows.length && !marksRows.length && (isLoadingAttendance || isLoadingMarks);
  const isCoursesLoading = !courseCards.length && (isLoadingAttendance || isLoadingMarks);
  const isRecentActivityLoading = !recentAttendanceActivity.length && isLoadingAttendance;
  const isUpcomingActivitiesLoading = !upcomingActivities.length
    && (isLoadingAssignedClasses || isLoadingTimetable || isLoadingNotices || isRecentActivityLoading);

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

    const timetableChannel = supabase
      .channel(`student-timetable-${normalizedEmail}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'timetable_entries',
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.student.timetable(normalizedEmail, resolvedDepartment) });
        }
      )
      .subscribe();

    const noticesChannel = supabase
      .channel('student-notices-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notices',
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.common.notices('student', 8) });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(assignmentChannel);
      void supabase.removeChannel(attendanceChannel);
      void supabase.removeChannel(marksChannel);
      void supabase.removeChannel(timetableChannel);
      void supabase.removeChannel(noticesChannel);
    };
  }, [normalizedEmail, queryClient, resolvedDepartment]);

  const upcomingActivities = useMemo(() => {
    const now = new Date();

    const assignmentActivities = assignedClasses.map((assignment, index) => {
      const timestamp = assignment.updated_at ? new Date(assignment.updated_at) : now;
      const isLive = now.getTime() - timestamp.getTime() <= 12 * 60 * 60 * 1000;

      return {
        id: `assignment-${assignment.course_code || index}-${assignment.updated_at || index}`,
        type: 'assignment',
        title: `${assignment.course_code || 'Course'} Assignment`,
        subtitle: `${assignment.course_name || 'Course work'}${assignment.venue ? ` • ${assignment.venue}` : ''}`,
        status: isLive ? 'Live' : 'Upcoming',
        timeLabel: formatRelativeTime(timestamp.toISOString()),
        sortDate: timestamp,
      };
    });

    const classActivities = timetableRows
      .map((entry) => {
        const schedule = toDateFromDayAndTime(entry.dayOfWeek, entry.startTime, entry.endTime);
        if (!schedule) return null;

        const isLive = now >= schedule.start && now <= schedule.end;
        const status = isLive ? 'Live' : schedule.start > now ? 'Upcoming' : 'Completed';

        return {
          id: `class-${entry.id}-${schedule.start.toISOString()}`,
          type: 'class',
          title: `${entry.courseCode || 'Course'}${entry.courseName ? ` - ${entry.courseName}` : ''}`,
          subtitle: `${entry.dayOfWeek} ${entry.startTime}-${entry.endTime}${entry.venue ? ` • ${entry.venue}` : ''}`,
          status,
          timeLabel: isLive ? 'Live now' : formatRelativeTime(schedule.start.toISOString()),
          sortDate: schedule.start,
        };
      })
      .filter(Boolean);

    const noticeActivities = notices.map((notice) => {
      const startDate = notice.startDate ? new Date(`${notice.startDate}T00:00:00`) : now;
      const endDate = notice.endDate ? new Date(`${notice.endDate}T23:59:59`) : null;

      let status = 'Live';
      if (startDate > now) status = 'Upcoming';
      if (endDate && endDate < now) status = 'Completed';

      return {
        id: `notice-${notice.id}`,
        type: 'notice',
        title: notice.title || 'Notice',
        subtitle: notice.body || 'Institution announcement',
        status,
        timeLabel: formatRelativeTime(startDate.toISOString()),
        sortDate: startDate,
      };
    });

    const attendanceActivities = recentAttendanceActivity.map((row, index) => {
      const timestamp = row.created_at
        ? new Date(row.created_at)
        : row.attendance_date
          ? new Date(`${row.attendance_date}T00:00:00`)
          : now;

      const isLive = now.getTime() - timestamp.getTime() < 2 * 60 * 60 * 1000;

      return {
        id: `attendance-${row.course_code || 'course'}-${row.attendance_date || index}`,
        type: 'class',
        title: `${row.course_code || 'Course'} attendance`,
        subtitle: `${row.is_present ? 'Marked present' : 'Marked absent'}${row.faculty_email ? ` • ${row.faculty_email}` : ''}`,
        status: isLive ? 'Live' : 'Completed',
        timeLabel: formatRelativeTime(timestamp.toISOString()),
        sortDate: timestamp,
      };
    });

    const statusPriority = { Live: 0, Upcoming: 1, Completed: 2 };

    return [...assignmentActivities, ...classActivities, ...noticeActivities, ...attendanceActivities]
      .sort((left, right) => {
        const statusDiff = statusPriority[left.status] - statusPriority[right.status];
        if (statusDiff !== 0) return statusDiff;

        if (left.status === 'Completed') {
          return right.sortDate.getTime() - left.sortDate.getTime();
        }

        return left.sortDate.getTime() - right.sortDate.getTime();
      })
      .slice(0, 10);
  }, [assignedClasses, notices, recentAttendanceActivity, timetableRows]);

  const recentActivityFeed = useMemo(
    () => (recentAttendanceActivity || []).map((row, index) => {
      const timestamp = row.created_at
        ? new Date(row.created_at)
        : row.attendance_date
          ? new Date(`${row.attendance_date}T00:00:00`)
          : null;

      const happenedDate = row.attendance_date
        ? new Date(`${row.attendance_date}T00:00:00`).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
        : 'Unknown date';

      return {
        id: `${row.course_code || 'course'}-${row.attendance_date || index}`,
        title: `${row.course_code || 'Course'}${row.course_name ? ` - ${row.course_name}` : ''}`,
        description: `${row.is_present ? 'Present marked' : 'Absent marked'} on ${happenedDate}`,
        facultyEmail: `Updated by: ${row.faculty_email || 'Faculty not set'}`,
        date: timestamp ? formatRelativeTime(timestamp.toISOString()) : 'Just now',
        priority: row.is_present ? 'low' : 'high',
      };
    }),
    [recentAttendanceActivity]
  );

  const glassCardSx = {
    borderRadius: 4,
    backdropFilter: 'blur(16px)',
    backgroundColor: alpha(theme.palette.background.paper, 0.8),
    boxShadow: '0 16px 40px rgba(15, 23, 42, 0.08)',
    border: `1px solid ${alpha(theme.palette.common.white, 0.45)}`,
  };

  return (
    <Box
      sx={{
        p: { xs: 2, md: 3 },
        display: 'flex',
        flexDirection: 'column',
        gap: 2.25,
        alignItems: 'stretch',
        background: 'radial-gradient(circle at 10% 0%, rgba(125,211,252,0.2), transparent 45%), radial-gradient(circle at 100% 90%, rgba(250,204,21,0.15), transparent 40%)',
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
        <Typography sx={{ fontSize: { xs: '1.65rem', md: '1.95rem' }, fontWeight: 700, letterSpacing: '-0.02em', color: '#0f172a' }}>
          Student Dashboard
        </Typography>
        <Typography sx={{ color: '#6b7280', mt: 0.5 }}>
          Track your academic progress with attendance, marks and course insights.
        </Typography>
      </Box>

      <Card sx={{ ...glassCardSx, background: 'linear-gradient(125deg, #ecfeff 0%, #dbeafe 60%, #e0e7ff 100%)' }}>
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

      <Grid container spacing={2}>
        <StudentStats
          loading={isSummaryLoading}
          summary={studentSummary}
        />
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
          <UpcomingActivities
            activities={upcomingActivities}
            isLoading={isUpcomingActivitiesLoading}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <CourseProgress courses={courseCards} isLoading={isCoursesLoading} />
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <RecentActivity activities={recentActivityFeed} isLoading={isRecentActivityLoading} />
        </Grid>
      </Grid>
    </Box>
  );
};

export default StudentDashboard;
