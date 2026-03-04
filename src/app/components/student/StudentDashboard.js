import React, { useEffect, useMemo, useState } from 'react';
import { Box, Card, CardContent, CardHeader, Chip, Grid, LinearProgress, Typography } from '@mui/material';
import { BookOpen, ClipboardCheck, TrendingUp, Award, Calendar } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { getAttendanceByStudentEmail, getClassAssignmentsByStudentEmail, getMarksByStudentEmail, getStudentDashboardSummary, getStudentProfileByEmail } from '../../lib/academicDataApi';
import { supabase } from '../../lib/supabaseClient.js';

export const StudentDashboard = () => {
  const { user } = useAuth();
  const [assignedClasses, setAssignedClasses] = useState([]);
  const [courseCards, setCourseCards] = useState([]);
  const [studentSummary, setStudentSummary] = useState({
    attendanceRate: 0,
    averageMarks: 0,
    enrolledCoursesCount: 0,
    assignmentsCount: 0,
  });
  const [isLoadingAssignedClasses, setIsLoadingAssignedClasses] = useState(false);
  const [resolvedDepartment, setResolvedDepartment] = useState((user?.department || '').trim().toUpperCase());

  const loadStudentDashboardData = async () => {
    if (!user?.email) return;

    setIsLoadingAssignedClasses(true);
    try {
      const profile = await getStudentProfileByEmail(user.email);
      const activeDepartment = ((profile?.department || '').trim().toUpperCase()) || (user?.department || '').trim().toUpperCase();
      setResolvedDepartment(activeDepartment);

      const [assignmentRows, attendanceRows, marksRows, summary] = await Promise.all([
        getClassAssignmentsByStudentEmail(user.email, activeDepartment),
        getAttendanceByStudentEmail(user.email),
        getMarksByStudentEmail(user.email),
        getStudentDashboardSummary(user.email, activeDepartment),
      ]);

      setAssignedClasses(assignmentRows || []);
      setStudentSummary(summary || {
        attendanceRate: 0,
        averageMarks: 0,
        enrolledCoursesCount: 0,
        assignmentsCount: 0,
      });

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
      const mappedCards = [...mergedCodes].map((courseCode, index) => {
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

      setCourseCards(mappedCards);
    } catch (error) {
      console.error('Failed to load assigned classes:', error);
      setAssignedClasses([]);
      setCourseCards([]);
    } finally {
      setIsLoadingAssignedClasses(false);
    }
  };

  const studentStats = [
    { title: 'Overall Attendance', value: `${studentSummary.attendanceRate}%`, icon: ClipboardCheck, color: 'bg-green-500', progress: studentSummary.attendanceRate },
    { title: 'Average Marks', value: `${studentSummary.averageMarks}`, icon: TrendingUp, color: 'bg-blue-500', progress: studentSummary.averageMarks },
    { title: 'Enrolled Courses', value: `${studentSummary.enrolledCoursesCount}`, icon: BookOpen, color: 'bg-purple-500', progress: Math.min(100, studentSummary.enrolledCoursesCount * 20) },
    { title: 'Assigned Classes', value: `${studentSummary.assignmentsCount}`, icon: Award, color: 'bg-orange-500', progress: Math.min(100, studentSummary.assignmentsCount * 20) },
  ];

  useEffect(() => {
    void loadStudentDashboardData();
  }, [user?.email]);

  useEffect(() => {
    setResolvedDepartment((user?.department || '').trim().toUpperCase());
  }, [user?.department]);

  useEffect(() => {
    if (!user?.email) return undefined;

    const assignmentChannel = supabase
      .channel(`student-assignments-${user.email}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'class_assignments',
          filter: `student_email=eq.${user.email}`,
        },
        () => {
          void loadStudentDashboardData();
        }
      )
      .subscribe();

    const departmentAssignmentChannel = resolvedDepartment
      ? supabase
        .channel(`student-assignments-dept-${resolvedDepartment}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'class_assignments',
            filter: `department=eq.${resolvedDepartment}`,
          },
          () => {
            void loadStudentDashboardData();
          }
        )
        .subscribe()
      : null;

    const attendanceChannel = supabase
      .channel(`student-attendance-${user.email}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_records',
          filter: `student_email=eq.${user.email}`,
        },
        () => {
          void loadStudentDashboardData();
        }
      )
      .subscribe();

    const marksChannel = supabase
      .channel(`student-marks-${user.email}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'marks_records',
          filter: `student_email=eq.${user.email}`,
        },
        () => {
          void loadStudentDashboardData();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(assignmentChannel);
      if (departmentAssignmentChannel) {
        void supabase.removeChannel(departmentAssignmentChannel);
      }
      void supabase.removeChannel(attendanceChannel);
      void supabase.removeChannel(marksChannel);
    };
  }, [user?.email, resolvedDepartment]);

  const upcomingClasses = useMemo(
    () =>
      assignedClasses.map((assignment) => ({
        course: `${assignment.course_code} - ${assignment.course_name}`,
        room: assignment.venue || 'Venue not assigned',
        staff: assignment.staff_name || assignment.faculty_email || 'Staff not assigned',
      })),
    [assignedClasses]
  );

  const announcements = [
    { id: 1, title: 'Class assignments synced from faculty', course: 'Live', date: 'Realtime', priority: 'high' },
    { id: 2, title: 'Attendance and marks are fetched from Supabase', course: 'Live', date: 'Realtime', priority: 'medium' },
    { id: 3, title: 'Profile updates are reflected instantly', course: 'Live', date: 'Realtime', priority: 'low' },
  ];

  const glassCardSx = {
    borderRadius: 3,
    backdropFilter: 'blur(12px)',
    backgroundColor: 'rgba(255,255,255,0.72)',
    boxShadow: '0 10px 24px rgba(0,0,0,0.08)',
  };

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography sx={{ fontSize: '1.875rem', fontWeight: 700, color: '#111827' }}>Student Dashboard</Typography>
        <Typography sx={{ color: '#6b7280', mt: 0.5 }}>Track your academic progress and performance</Typography>
      </Box>

      <Grid container spacing={3}>
        {studentStats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Grid key={index} size={{ xs: 12, md: 6, lg: 3 }}>
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

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card sx={glassCardSx}>
            <CardHeader title="Enrolled Courses" />
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {!courseCards.length && (
                  <Typography sx={{ color: '#6b7280', fontSize: '0.875rem' }}>No course data available yet.</Typography>
                )}
                {courseCards.map((course) => (
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
            <CardHeader title="Upcoming Classes" />
            <CardContent>
              {isLoadingAssignedClasses && (
                <Typography sx={{ fontSize: '0.875rem', color: '#6b7280', mb: 1.5 }}>
                  Loading assigned classes...
                </Typography>
              )}

              {!isLoadingAssignedClasses && !upcomingClasses.length && (
                <Typography sx={{ fontSize: '0.875rem', color: '#6b7280', mb: 1.5 }}>
                  No class assignments yet.
                </Typography>
              )}

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {upcomingClasses.map((classItem, index) => (
                  <Box key={index} sx={{ p: 1.5, background: 'linear-gradient(90deg,#eff6ff,#eef2ff)', borderRadius: 1.5, border: '1px solid #dbeafe' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Calendar size={16} color="#2563eb" />
                      <Typography sx={{ fontWeight: 500, color: '#111827', fontSize: '0.875rem' }}>{classItem.course}</Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.75rem', color: '#6b7280' }}>{classItem.room}</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#4b5563', mt: 0.25 }}>Staff: {classItem.staff}</Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>

          <Card sx={glassCardSx}>
            <CardHeader title="Recent Announcements" />
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {announcements.map((announcement) => (
                  <Box key={announcement.id} sx={{ p: 1.5, backgroundColor: '#f9fafb', borderRadius: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, gap: 1 }}>
                      <Typography sx={{ fontWeight: 500, fontSize: '0.875rem', color: '#111827', flex: 1 }}>{announcement.title}</Typography>
                      <Chip
                        size="small"
                        label={announcement.priority}
                        sx={{
                          fontSize: '0.75rem',
                          backgroundColor: announcement.priority === 'high' ? '#fee2e2' : announcement.priority === 'medium' ? '#fef3c7' : '#dcfce7',
                          color: announcement.priority === 'high' ? '#b91c1c' : announcement.priority === 'medium' ? '#a16207' : '#15803d',
                        }}
                      />
                    </Box>
                    <Typography sx={{ fontSize: '0.75rem', color: '#6b7280' }}>{announcement.course}</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#9ca3af', mt: 0.5 }}>{announcement.date}</Typography>
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
