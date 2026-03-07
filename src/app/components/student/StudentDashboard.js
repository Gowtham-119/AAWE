import React, { useEffect, useMemo, useState } from 'react';
import { Box, Card, CardContent, CardHeader, Chip, Grid, LinearProgress, Typography } from '@mui/material';
import { BookOpen, ClipboardCheck, TrendingUp, Award, Calendar } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { getAttendanceByStudentEmail, getClassAssignmentsByStudentEmail, getMarksByStudentEmail, getStudentProfileByEmail } from '../../lib/academicDataApi';
import { supabase } from '../../lib/supabaseClient.js';

const normalizeDepartmentCode = (value) => {
  const normalized = (value || '').trim().toUpperCase();
  if (!normalized) return '';
  if (['AG', 'CS', 'IT'].includes(normalized)) return normalized;

  const aliasMap = {
    AGRICULTURALENGINEERING: 'AG',
    AGRICULTURAL: 'AG',
    COMPUTERSCIENCE: 'CS',
    CSE: 'CS',
    INFORMATIONTECHNOLOGY: 'IT',
  };

  const compact = normalized.replace(/[^A-Z]/g, '');
  return aliasMap[compact] || normalized;
};

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
  const [assignedClasses, setAssignedClasses] = useState([]);
  const [courseCards, setCourseCards] = useState([]);
  const [studentSummary, setStudentSummary] = useState({
    attendanceRate: 0,
    averageMarks: 0,
    enrolledCoursesCount: 0,
    assignmentsCount: 0,
  });
  const [isLoadingAssignedClasses, setIsLoadingAssignedClasses] = useState(false);
  const [resolvedDepartment, setResolvedDepartment] = useState(normalizeDepartmentCode(user?.department || ''));

  const loadStudentDashboardData = async () => {
    const normalizedEmail = (user?.email || '').trim().toLowerCase();
    if (!normalizedEmail) return;

    setIsLoadingAssignedClasses(true);
    try {
      let activeDepartment = (user?.department || '').trim().toUpperCase();

      try {
        const profile = await getStudentProfileByEmail(normalizedEmail);
        activeDepartment = normalizeDepartmentCode((profile?.department || '').trim().toUpperCase()) || normalizeDepartmentCode(activeDepartment);
      } catch (profileError) {
        console.warn('Failed to resolve student profile. Continuing with auth context data.', profileError);
      }

      activeDepartment = normalizeDepartmentCode(activeDepartment);
      setResolvedDepartment(activeDepartment);

      const [assignmentResult, attendanceResult, marksResult] = await Promise.allSettled([
        getClassAssignmentsByStudentEmail(normalizedEmail, activeDepartment),
        getAttendanceByStudentEmail(normalizedEmail),
        getMarksByStudentEmail(normalizedEmail),
      ]);

      if (assignmentResult.status === 'rejected') {
        console.error('Failed to load class assignments:', assignmentResult.reason);
      }

      if (attendanceResult.status === 'rejected') {
        console.error('Failed to load attendance:', attendanceResult.reason);
      }

      if (marksResult.status === 'rejected') {
        console.error('Failed to load marks:', marksResult.reason);
      }

      const assignmentRows = assignmentResult.status === 'fulfilled' ? (assignmentResult.value || []) : [];
      const attendanceRows = attendanceResult.status === 'fulfilled' ? (attendanceResult.value || []) : [];
      const marksRows = marksResult.status === 'fulfilled' ? (marksResult.value || []) : [];

      const attendanceRate = attendanceRows.length
        ? Number(((attendanceRows.filter((row) => row.is_present).length / attendanceRows.length) * 100).toFixed(1))
        : 0;

      const averageMarks = marksRows.length
        ? Number((marksRows.reduce((accumulator, row) => accumulator + Number(row.total || 0), 0) / marksRows.length).toFixed(1))
        : 0;

      const enrolledCoursesCount = new Set(
        [...attendanceRows, ...marksRows].map((row) => row.course_code).filter(Boolean)
      ).size;

      setAssignedClasses(assignmentRows);
      setStudentSummary({
        attendanceRate,
        averageMarks,
        enrolledCoursesCount,
        assignmentsCount: assignmentRows.length,
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
    setResolvedDepartment(normalizeDepartmentCode(user?.department || ''));
  }, [user?.department]);

  useEffect(() => {
    if (!user?.email) return undefined;
    const normalizedEmail = user.email.trim().toLowerCase();
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
          void loadStudentDashboardData();
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
          void loadStudentDashboardData();
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
          void loadStudentDashboardData();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(assignmentChannel);
      void supabase.removeChannel(attendanceChannel);
      void supabase.removeChannel(marksChannel);
    };
  }, [user?.email]);

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

  const announcements = useMemo(() => {
    if (!assignedClasses.length) return [];

    return assignedClasses
      .slice()
      .sort((first, second) => (second.updated_at || '').localeCompare(first.updated_at || ''))
      .slice(0, 5)
      .map((assignment, index) => ({
        id: `${assignment.course_code || 'course'}-${index}`,
        title: `Faculty assigned ${assignment.course_code || 'course'}${assignment.course_name ? ` - ${assignment.course_name}` : ''}`,
        course: assignment.staff_name || assignment.staff_email || assignment.faculty_email || 'Faculty update',
        date: formatActivityTime(assignment.updated_at),
        priority: index === 0 ? 'high' : index < 3 ? 'medium' : 'low',
      }));
  }, [assignedClasses]);

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

      <Grid container spacing={2}>
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

      <Grid container spacing={2}>
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
            <CardHeader title="Upcoming Activity" />
            <CardContent>
              {!announcements.length && (
                <Typography sx={{ fontSize: '0.875rem', color: '#6b7280', mb: 1.5 }}>
                  No activity updates yet.
                </Typography>
              )}
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
